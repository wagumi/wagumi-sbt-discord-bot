const fetch = require("node-fetch");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);


const getMember = async (userid) => {
	const response = await fetch("https://discord.com/api/guilds/914960638365810748/members/488544515976724480", {
		headers: {
			Authorization: `Bot ${process.env.DISCORD_TOKEN}`
		},
	});
	//console.log(response);

	const headers = await response.headers;
	console.log(headers);

};

(async () => {
	await getMember("488544515976724480");
})();