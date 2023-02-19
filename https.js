const express = require("express");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { Client } = require('@notionhq/client');
const settings = require("./settings.json");
const sbtImage = require("./sbt-image/sbtImage.js");
const fs = require("fs");

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


			const baseURI = "https://wagumi-sbt.ukishima.repl.co/base"
			switch (image) {
				case "YumeCawaii":
					baseImage = `${baseURI}/wagumi_sbt_base_yumecawaii.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_yumecawaii.png`;
					textColor = "#ff6bdf";
					break;
				case "MakeMoney":
					baseImage = `${baseURI}/wagumi_sbt_base_makemoney.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_makemoney.png`;
					textColor = "#ffffff";
					break;
				default:
					baseImage = `${baseURI}/wagumi_sbt_base_dafault.png`;
					borderImage = `${baseURI}/wagumi_sbt_border_default.png`;
					textColor = "#0B76D9";
			}

			pngData = await sbtImage.createSBTImage(
				req.query.userid,
				result.username,
				result.avatar,
				baseImage,
				borderImage,
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

const addMinter = async (data) => {
	try {
		if (data.webhookId === "wh_30q0qgq7pqd5azfq") {
			const address = data.event.activity[0].fromAddress.toLowerCase();
			const filePath = "./requests.json";
			let requests = {};
			try {
				requests = JSON.parse(fs.readFileSync(filePath));
			} catch {
			}
			const userIds = Object.keys(requests);
			const userid = userIds.find(id => requests[id].address.toLowerCase() === address);
			await addMinterToNotion(userid);
  		await rest.put(
				Routes.guildMemberRole(settings.GUILD_ID, userid,"1017617843916902411")
			);

		}
	}
	catch (e) {
		console.error("other message recieved");
	}
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
	const pageId = 'c822ee89-d3a8-464f-87bb-dee91a5d4053';
	const propertyId = "%3DVLE"
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
