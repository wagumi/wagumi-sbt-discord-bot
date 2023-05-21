module.exports = {
    apps: [
        {
            name: "sbt-bot-and-server",
            script: "./index.js",
            watch: true,
            ignore_watch: [requests.json],
            time: true,
        },
    ],
};
