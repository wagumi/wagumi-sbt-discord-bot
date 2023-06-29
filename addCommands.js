const { REST } = require("@discordjs/rest");
const { Routes } = require("discord.js");
const settings = require("./settings.json");

const commands = [
    {
        name: "ping",
        description: "Replies with Pong!",
    },
    {
        name: "init",
        description: "Create PrivateKey and Shared.",
        options: [
            {
                name: "role",
                description: "Select a role.",
                type: 8,
                required: true,
            },
            {
                name: "threshold",
                description: "threshold.",
                type: 4,
                required: false,
            },
            {
                name: "create",
                description: "Create or Update flag. If you would like to create new validator,you have to set true",
                type: 5,
                required: false,
            },
        ],
    },
    {
        name: "test_dm",
        description: "Send test DMs from the bot to members with a selected role",
        options: [
            {
                name: "role",
                description: "Select a role.",
                type: 8,
                required: true,
            },
        ],
    },
    {
        name: "approve",
        description: "send your share.",
        options: [
            {
                name: "share",
                description: "your share.",
                type: 3,
                required: false,
            },
        ],
    },
    {
        name: "sign",
        description: "sign.",
    },
    {
        name: "delete_approvals",
        description: "Delete Approvals.",
    },
    {
        name: "register",
        description: "register address for mint.",
        options: [
            {
                name: "address",
                description: "your mint address.",
                type: 3,
                required: false,
            },
        ],
    },
    {
        name: "mint",
        description: "mint.",
    },
    {
        name: "customize",
        description: "customize your SBT image.",
    },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationGuildCommands(
            settings.APPLICATION_ID,
            settings.GUILD_ID,
        ), { body: commands });

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
