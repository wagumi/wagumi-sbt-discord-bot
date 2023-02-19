const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	const member = "969528057792708619";
	await rest.put(
		Routes.guildMemberRole("914960638365810748", member, "1017617843916902411")
	);
})()
