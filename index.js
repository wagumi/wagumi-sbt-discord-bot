require('dotenv').config();
const secp = require("@noble/secp256k1");
const { ethers, utils } = require("ethers");
const fs = require("fs");
const Locker = require("node-file-lock");
const { CreatePrivateKey, Share, Recover } = require("./bls");

const https = require("./https");

const {
	Client,
	GatewayIntentBits,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
	Partials,
} = require("discord.js");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

const settings = require("./settings.json");

let approveList = {};

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.rest.on('rateLimited', (limited) => {
	fs.appendFile("./rateLimitd.log", limited);
	console.log(`Late Limits: ${limited}`);
});

client.on("interactionCreate", async (interaction) => {
	if (
		!(
			interaction.isChatInputCommand() ||
			interaction.isModalSubmit() ||
			interaction.isStringSelectMenu()
		)
	) {
		return;
	}
	console.log(
		interaction.user.id,
		interaction.commandName,
		interaction.customId,
	);

	if (interaction.commandName === "init") {
		const guild = await client.guilds.fetch(settings.GUILD_ID);
		await guild.members.fetch();
		const role = guild.roles.cache.get(interaction.options.getRole("role").id);
		const threshold =
			interaction.options.getInteger("threshold") ?? role.members.size;

		const members = role.members.map((member) => {
			return member.id;
		});

		if (members.length < threshold) {
			await interaction.reply({
				content: "閾値は管理を行うメンバー数より小さい必要があります。",
				ephemeral: true,
			});
			return;
		}

		const isCreate = interaction.options.getBoolean("create") ?? false;
		let specifiedPrivateKey;
		if (isCreate) {
			specifiedPrivateKey = null;
		} else {
			specifiedPrivateKey = await getPrivateKey(settings.USEENCRYPTION);
			if (specifiedPrivateKey === "") {
				await interaction.reply({
					content: "Shareを再生成しようとしましたが秘密鍵の復元に失敗しました。",
					ephemeral: true,
				});
				return;
			}
		}
		await interaction.deferReply({ ephemeral: true });
		const shares = await execInit(
			members,
			threshold,
			settings.USEENCRYPTION,
			specifiedPrivateKey,
		);

		let i = 0;
		role.members.forEach((user) => {
			try {
				user.send(shares[i]);
				i++
			} catch {
				interaction.editReply({
					content: `シェアのDM送信中にエラーが発生しました。\nuser:${user.id}`,
					ephemeral: true,
				});
				execDeleteApprove();
				return;
			}
		});
		await interaction.editReply({
			content: `初期化されました\nshareOwners:${members}\nthreshold:${threshold}\nvalidator:${settings.VALIDATOR}`,
			ephemeral: true,
		});
		execDeleteApprove();
	}

	if (interaction.customId === "approveModal") {
		const share = interaction.fields.getTextInputValue("shareInput");
		execApprove(interaction.user.id, share);
		const approves = Object.keys(approveList);
		await interaction.reply({
			content: `シェアが送信されました。\nshares count:${approves.length}`,
			ephemeral: true,
		});
	}

	if (interaction.commandName === "approve") {
		const share = interaction.options.getString("share") ?? "";
		if (share === "") {
			const modal = await getApproveModal();
			await interaction.showModal(modal);
		} else {
			execApprove(interaction.user.id, share);
			const approves = Object.keys(approveList);
			await interaction.reply({
				content: `シェアが送信されました。\nshares count:${approves.length}`,
				ephemeral: true,
			});
		}
	}

	if (interaction.customId === "registModal") {
		await interaction.deferReply({ ephemeral: true });
		const address = interaction.fields.getTextInputValue(
			"addressInput",
		).replaceAll("\n", "");
		try {
			const result = utils.getAddress(address);
		} catch (e) {
			await interaction.editReply({
				content: `入力されたアドレスは正しい形式ではありません。\n${address}`,
				ephemeral: true,
			});
			return;
		}

		const result = await execRegist(interaction.user.id, interaction.member.nickname ?? interaction.user.username, address);
		await postRegist(interaction, address, result);
	}

	if (interaction.commandName === "register") {
		const address = interaction.options.getString("address") ?? "";

		if (address === "") {
			const modal = await getRegistModal();
			await interaction.showModal(modal);
		} else {
			try {
				const result = utils.getAddress(address);
			} catch (e) {
				await interaction.reply({
					content: `入力されたアドレスは正しい形式ではありません。\n${address}`,
					ephemeral: true,
				});
				return;
			}
			await interaction.deferReply({ ephemeral: true });
			const result = await execRegist(interaction.user.id, interaction.member.nickname ?? interaction.user.username, address);
			await postRegist(interaction, address, result);
		}
	}


	if (interaction.commandName === "mint") {
		const url = execMint(interaction.user.id);
		let result = `以下のSBT発行サイトにアクセスして、SBTを発行してください。\n\n${url}\n\n`
		//result = result+ `【MOBILE】\n${url.replace("https://","https://metamask.app.link/dapp/")}`;
		await interaction.reply({ content: result, ephemeral: true });
	}

	if (interaction.commandName === "sign") {
		await interaction.deferReply({ ephemeral: true });
		const privateKey = await getPrivateKey(settings.USEENCRYPTION);
		if (privateKey !== "") {
			await execSign(privateKey);
			await interaction.editReply({
				content: `署名を行いました。\nvalidator:${settings.VALIDATOR}`,
				ephemeral: true,
			});
			execDeleteApprove();
		} else {
			await interaction.editReply({
				content: `秘密鍵の復元に失敗しました。\nshares count:${Object.keys(approveList).length}`,
				ephemeral: true,
			});
		}
	}

	if (interaction.commandName === "delete_approvals") {
		execDeleteApprove();
		await interaction.reply({
			content: `受信済みシェアを削除しました。\nshares count:${Object.keys(approveList).length}`,
			ephemeral: true,
		});
	}

	if (interaction.commandName === "ping") {
		/*
		try {
			const channel = await client.channels.fetch("1020849054445482016");
			const date = new Date().toLocaleString();
			const data = { datetime: date, users: channel.members.map((member) => member.user.tag) };
			fs.appendFileSync("./voice_users.json", JSON.stringify(data) + "\n");
		} catch {
		}
		*/
		try {
			await interaction.reply({ content: "pong", ephemeral: true });
		}
		catch (e) {
			console.log(e);
		}
	}

	if (interaction.commandName === "customize") {
		const options = require("./imageOption.json");
		await interaction.reply({
			content: "customize",
			components: options,
			ephemeral: true,
		});
	}
	if (interaction.customId === "firstOption") {
		let lock;
		try {
			lock = new Locker('wagumi-lock');
			const selected = interaction.values[0];
			const filePath = "./requests.json";
			let requests = {};
			try {
				requests = JSON.parse(fs.readFileSync(filePath));
			} catch {
			}
			if (requests[interaction.user.id]) {
				requests[interaction.user.id].image = selected;
				fs.writeFileSync("./requests.json", JSON.stringify(requests, null, 2));
				await interaction.update({
					content: `${selected} が選択されました。`,
					components: [],
				});
			}
			else {
				await interaction.update({
					content: `申請を先に行ってください。`,
					components: [],
				})
			}
			lock.unlock();
		} catch (e) {
			await interaction.update({
				content: "申請が込みあっています。しばらく待ってから再度申請してください。",
				ephemeral: true,
			})
		}
	}
});

const execInit = async (
	members,
	threshold,
	useEncryption = true,
	specifiedPrivateKey = null,
) => {
	if (!specifiedPrivateKey) {
		specifiedPrivateKey = await CreatePrivateKey();
	}
	const wallet = new ethers.Wallet(specifiedPrivateKey);
	settings.VALIDATOR = utils.keccak256(wallet.address);
	fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 2));

	const shares = await Share(
		members,
		threshold,
		useEncryption,
		specifiedPrivateKey,
	);
	return shares;
};

const getApproveModal = async () => {
	const modal = new ModalBuilder().setCustomId("approveModal").setTitle(
		"Send Your Share",
	);

	const shareInput = new TextInputBuilder()
		.setCustomId("shareInput")
		.setLabel("copy-and-paste your share here.")
		.setStyle(TextInputStyle.Paragraph);

	const firstActionRow = new ActionRowBuilder().addComponents(shareInput);

	modal.addComponents(firstActionRow);

	return modal;
};

const execApprove = (userid, share) => {
	approveList[userid] = share.replaceAll("\n", "");
};

const execDeleteApprove = () => {
	if (settings.ERASE_SHARE_EVERY_TIME) {
		approveList = {};
	}
};

const getRegistModal = async () => {
	const modal = new ModalBuilder().setCustomId("registModal").setTitle(
		"アドレスの入力",
	);

	const addressInput = new TextInputBuilder()
		.setCustomId("addressInput")
		.setLabel("和組SBTを受け取るアドレスを入力してください。(コピペ推奨）")
		.setStyle(TextInputStyle.Paragraph);

	const firstActionRow = new ActionRowBuilder().addComponents(addressInput);

	modal.addComponents(firstActionRow);

	return modal;
};

const execRegist = async (userid, username, address) => {
	let lock;
	try {
		lock = new Locker("wagumi-lock");
		const filePath = "./requests.json";
		let requests = {};
		try {
			requests = JSON.parse(fs.readFileSync(filePath));
		} catch {
		}

		requests[userid] = {};
		requests[userid].username = username;
		requests[userid].address = address;
		requests[userid].salt = Date.now();
		requests[userid].published = false;
		requests[userid].signature = "";
		requests[userid].image = "Default";
		fs.writeFileSync(filePath, JSON.stringify(requests, null, 2));
		lock.unlock();
		return true;
	}
	catch {
		return false;
	}
};

const postRegist = async (interaction, address, result) => {
	if (result) {
		try {
			await interaction.editReply({
				content: `${address}で登録されました。\n承認されるまでお待ちください。\n承認後「/mint」コマンドでSBTの発行が行えるようになります。`,
				ephemeral: true,
			});
			const sbtAdminChannel = await client.channels.cache.get(settings.SBT_ADMIN_CHANNEL_ID);
			await sbtAdminChannel.send(`${interaction.user.tag}さんがSBTのregisterを行いました`);
		} catch(error) {
			console.error(error);
		}
	} else {
		await interaction.editReply({
			content: "申請が込みあっています。しばらく待ってから再度申請してください。",
			ephemeral: true,
		});
	}
};

const execSign = async (privateKey) => {
	let lock;
	try {
		lock = new Locker("wagumi-lock");
		if (privateKey === "") {
			lock.unlock();
			return;
		}
		const filePath = "./requests.json";
		let requests = {};
		try {
			requests = JSON.parse(fs.readFileSync(filePath));
		} catch (e) {
			console.log(e);
		}
		const userids = Object.keys(requests);
		for (let userid of userids) {
			if (requests[userid].signature !== "") {
				continue;
			}

			const sender = requests[userid].address;
			const discordId = BigInt(userid);
			const salt = requests[userid].salt;

			const abiCoder = new utils.AbiCoder();
			const message = abiCoder.encode(
				["address", "address", "uint256", "uint256"],
				[sender, sender, discordId, salt],
			);
			const messageHash = utils.keccak256(message).substring(2);
			const [hex, recovery] = await secp.sign(messageHash, privateKey, {
				recovered: true,
				canonical: true,
			});
			const signature = secp.Signature.fromHex(hex);
			//const publicKey = secp.getPublicKey(privateKey);
			//console.log(secp.verify(signature, messageHash, publicKey));
			const r = padZero(signature.r.toString(16));
			const s = padZero(signature.s.toString(16));
			const v = (recovery + 27).toString(16);
			requests[userid].messageHash = `0x${messageHash}`;
			requests[userid].signature = `0x${r}${s}${v}`;
		}
		fs.writeFileSync(filePath, JSON.stringify(requests, null, 2));
		lock.unlock();
	}
	catch (e) {
		console.log(e);
	}
};

const execMint = (discordId) => {
	const filePath = "./requests.json";
	let requests = {};
	try {
		requests = JSON.parse(fs.readFileSync(filePath));
	} catch (e) {
		console.log(e);
	}
	if (requests[discordId]) {
		if (requests[discordId].signature !== "") {
			const address = requests[discordId].address;
			const userid = discordId;
			const username = requests[discordId].username;
			const salt = requests[discordId].salt;
			const signature = requests[discordId].signature;
			const url = encodeURI(`https://wagumi.github.io/sbt/mint/?address=${address}&userid=${userid}&username=${username}&salt=${salt}&signature=${signature}`);
			return url;
		}
		return "あなたのSBTは承認待ちです。しばらくお待ちください。";
	}

	return "あなたのSBTは申請されていません。申請を行ってください。";
};

const getPrivateKey = async (encrypted) => {
	try {
		const shares = [];
		const members = [];
		for (const [key, value] of Object.entries(approveList)) {
			members.push(key);
			shares.push(value);
		}

		const privatekey = await Recover(members, shares, encrypted);
		const wallet = new ethers.Wallet(privatekey);
		const accountHash = utils.keccak256(wallet.address);
		if (accountHash === settings.VALIDATOR) {
			return privatekey;
		} else {
			return "";
		}
	} catch (e) {
		console.log(e);
		return "";
	}
};

const padZero = (str) => {
	let ret = (
		`0000000000000000000000000000000000000000000000000000000000000000${str}`
	).slice(-64);
	return ret;
};

(async () => {
	console.log("login...");
	client.login(process.env.DISCORD_TOKEN);
	//await test();
})();
