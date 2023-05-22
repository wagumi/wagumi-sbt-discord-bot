# wagumi-sbt-discord-bot

和組SBTの発行承認や画像生成をするDiscordボットとExpressサーバ

# Dev

## Install node modules

```shell
npm install
```

## Create .env and requests.json

やり方については和組Discordサーバの開発メンバーに問い合わせてください

## Run the bot and server

```shell
node index.js
```

注意: 本番サーバでも同じDiscordトークンを使用してボットを稼働しているのでテストの際は本番サーバ側を一時停止するなどの処置が必要

# Production

```shell
pm2 start pm2.config.js
```
