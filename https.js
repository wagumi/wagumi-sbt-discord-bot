const express = require("express");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { Client } = require('@notionhq/client');
const settings = require("./settings.json");
const sbtImage = require("./sbt-image/sbtImage.js");
const fs = require("fs");
const fetch = require('node-fetch');

require('dotenv').config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

const app = express();
app.use(express.json());
app.use(express.urlencoded({
	extended: true
}));
app.use('/base', express.static('./sbt-image/base'));
app.use('/svg', express.static('./sbt-image/svg'));


const server = app.listen(8080, function() {
	console.log(`Node.js is listening to PORT:${server.address().port}`);
});

app.get("/ping", (req, res) => {
	res.send("pong");
});

app.get("/list", function(req, res, next) {
	const list = require("./requests");
	const result = {};

	if (list[req.query.userid]) {
		result.userid = req.query.userid;
		result.username = list[req.query.userid].username;
		result.address = list[req.query.userid].address;
		result.image = list[req.query.userid].image;
	}
	res.json(result);
});

app.get("/image", async (req, res, next) => {
	console.log(req.query.userid);
	let pngData;
	if (fs.existsSync(`./sbt-image/png/${req.query.userid}.png`)) {
		pngData = fs.readFileSync(`./sbt-image/png/${req.query.userid}.png`);
	} else {
		const result = await getMember(req.query.userid);
		if (result) {
			const filePath = "./requests.json";
			let requests = {};
			try {
				requests = JSON.parse(fs.readFileSync(filePath));
			} catch {
			}

			let baseImage;
			let textColor;


			try {
				image = requests[req.query.userid].image;
			} catch {
				image = "default";
			}


			const baseURI = "https://apps.wagumi.xyz/sbt/base"
			switch (image) {
				case "Shichifuku":
					baseImage = `${baseURI}/wagumi_sbt_base_shichifuku.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_omamori.png`;
					baseSvg = `./sbt-image/base/base_omamori_1.svg`;
					textColor = "#FF319D";
					break;
				case "Kokuryu":
					baseImage = `${baseURI}/wagumi_sbt_base_kokuryu.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_omamori.png`;
					baseSvg = `./sbt-image/base/base_omamori_2.svg`;
					textColor = "#ffffff";
					break;
				case "Houou":
					baseImage = `${baseURI}/wagumi_sbt_base_houou.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_omamori.png`;
					baseSvg = `./sbt-image/base/base_omamori_2.svg`;
					textColor = "#ffffff";
					break;
				case "YumeCawaii":
					baseImage = `${baseURI}/wagumi_sbt_base_yumecawaii.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_yumecawaii.png`;
					baseSvg = `./sbt-image/base/base.svg`;
					textColor = "#ff6bdf";
					break;
				case "MakeMoney":
					baseImage = `${baseURI}/wagumi_sbt_base_makemoney.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_makemoney.png`;
					baseSvg = `./sbt-image/base/base.svg`;
					textColor = "#ffffff";
					break;
				default:
					baseImage = `${baseURI}/wagumi_sbt_base_dafault.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_default.png`;
					baseSvg = `./sbt-image/base/base.svg`;
					textColor = "#0B76D9";
			}

			pngData = await sbtImage.createSBTImage(
				req.query.userid,
				result.username,
				result.avatar,
				baseImage,
				borderImage,
				baseSvg,
				textColor
			);
		} else {
			pngData = fs.readFileSync("./sbt-image/no-image.png");
			res.status(404);
		}
	}
	res.type("png");
	//res.set('content-type', 'image/png');
	res.send(pngData);
});

app.post('/minted/', async (req, res) => {
	addMinter(req.body);
	res.send("Received POST Data!");
});

app.get('/tokenId', async (req, res) => {
	if (!req.query.address) {
		return res.status(400).json({
			error: "Specify an address for a requested token ID"
		});
	}

	const address = req.query.address;
	try {
		const tokenId = await getTokenIdForAddress(address);
		if (!tokenId) {
			return res.status(404).json({
				error: "Can't find the requested token ID"
			});
		}
		res.json({
			tokenId
		});
	} catch(error) {
		res.status(400).json({
			error: error.message
		});
	}
});

const addMinter = async (data) => {
	let resMsg;
	let mintedUserName;
	const channelId = settings.SBT_ADMIN_CHANNEL_ID;
	const mentionCode = "<@&" + settings.ADMIN_ROLE_ID + ">";

	try {
		if (data.webhookId === "wh_bhpiswlt06zoazc3") {
			//test setting
			//const address = data.event.activity[0].fromAddress.toLowerCase();
			const address = "0x5a21e07c07faf6549ce8247ba7dd7b1257c0fc4d";
			const filePath = "./requests.json";
			let requests = {};
			try {
				requests = JSON.parse(fs.readFileSync(filePath));
			} catch {
			}
			const userIds = Object.keys(requests);
			const userid = userIds.find(id => requests[id].address.toLowerCase() === address);
			mintedUserName = userIds.filter(id => requests[id].address.toLowerCase() === address).map(id => requests[id].username);
			await addMinterToNotion(userid);
  		//await rest.put(
		//		Routes.guildMemberRole(settings.GUILD_ID, userid,"1017617843916902411")
		//	);

		resMsg = mentionCode + `\n` + mintedUserName + 'さんのMintが正常に行われました。';
		}
	}
	catch (e) {
		console.error("other message recieved:", e);
		resMsg = mentionCode + `\n` + mintedUserName + `さんのMintでエラーが発生しました。\n${e}`;
	}

	const message = {"username":"SBT-ADMIN","content":resMsg};

	function postData(url = ``, data = {}) {
		return fetch(url, {
		  method: "POST",
		  mode: "cors",
		  headers: {
			'Content-type': 'application/json'
		  },
		  body: JSON.stringify(data),
		});
	  }
	  
	async function sendRequest() {
		try {
			const response = await postData(settings.SBT_ADMIN_CHANNEL_WEBHOOK, message);
			
			if (!response.ok) {
			throw new Error(await response.text());
			}
		} catch (error) {
			console.error(error);
		}
	}
	
	sendRequest();
	  
}

const addMinterToNotion = async (userid) => {
	const request = {
		database_id: settings.WAGUMI_USER_DATABASE_ID,
		filter: {
			property: 'id',
			rich_text: {
				equals: userid,
			},
		},
	};

	const client = new Client({ auth: process.env.NOTION_API_TOKEN });
	let response = await client.databases.query(request);
	const userpage = response.results[0].id;

	//const pageId = '82462e9c-3a16-47cd-bd19-784671cbdf05';
	//const pageId = 'c822ee89-d3a8-464f-87bb-dee91a5d4053';
	//TEST setting
	//const pageId = '0f19d0b0de8a41948ed893e0b5ee73fb';
	//const propertyId = "%3DVLE"
	const pageId = settings.SBT_PAGE_ID;
	const propertyId = settings.SBT_PROPERTY_ID;
	response = await client.pages.properties.retrieve({ page_id: pageId, property_id: propertyId });

	const relations = response.results.map((item) => {
		return item.relation;
	});

	relations.push({ id: userpage });

	const target = {
		page_id: pageId,
		properties: {
			"users": {
				"relation": relations
			}
		}
	}
	const result = await client.pages.update(target);

	response = await client.pages.properties.retrieve({ page_id: pageId, property_id: propertyId });

	const updateRelations = response.results.map((item) => {
		return item.relation;
	});

	let hasUserpage = false;
	for (const obj of updateRelations) {
		if (obj.id === userpage) {
		    hasUserpage = true;
		    break;
		}
	  }

	if (!hasUserpage) {
		throw "Error registering with Notion";
	};

	return result.id;
}

const getMember = async (userid) => {
	try {
		const result = await rest.get(
			Routes.guildMember(settings.GUILD_ID, userid),
		);

		let icon;
		if (result.avatar) {
			icon = `https://cdn.discordapp.com/guilds/${settings.GUILD_ID}/users/${result
				.user.id}/avatars/${result.avatar}.png`;
		} else if (result.user.avatar) {
			icon = `https://cdn.discordapp.com/avatars/${result.user.id}/${result.user
				.avatar}.png`;
		} else {
			icon = "https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.png";
		}
		return { username: result.nick ?? result.user.username, avatar: icon };
	} catch (e) {
		return null;
	}
};

const getTokenIdForAddress = async (address) => {
	const url = new URL(`https://polygon-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getNFTs`);
	url.searchParams.set('owner', address);
	url.searchParams.set('contractAddresses[]', [settings.SBT_CONTRACT_ADDRESS]);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(await response.text());
	}
	const json = await response.json();
	if (json.totalCount === 1) {
		const tokenIdInHex = json.ownedNfts[0].id.tokenId;
		return BigInt(tokenIdInHex).toString();
	} else {
		return null;
	}
};
