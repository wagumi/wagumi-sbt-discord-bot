# Wagumi SBT 静的画像マイグレーション: ハンドオフプロンプト

`wagumi/sbt` リポジトリ (`https://wagumi.github.io/sbt/` で配信されている静的サイト) で作業します。タスクは、まもなく停止する動的画像 URL を全トークンのメタデータから取り除き、1 枚の静的画像を指すように移行することです。

## 背景

Wagumi SBT Discord ボットとその Express サーバ (`apps.wagumi.xyz` を提供している Google Cloud ホスト) は近日中に停止します。`metadata/*.json` の各ファイルは現在以下のフィールドを持っています。

```json
"image": "https://apps.wagumi.xyz/sbt/image?userid=<userid>"
```

OpenSea はこの URL を各トークンのオンチェーン `tokenURI` から読み取って画像を表示しています。`apps.wagumi.xyz` が停止すると全 URL が 404 を返し、OpenSea 上で SBT 画像が壊れた表示になります。

対応: 各メタデータの `image` フィールドを、同じリポジトリから GitHub Pages 経由で配信する 1 枚の静的画像 URL に置き換えます。差し替え画像は汎用の「Wagumi メンバーシップカード」(デフォルトベース、アバター部分に Wagumi Cat #0、NAME 欄に `和組メンバー`) です。トークンごとの `name`、`description`、`external_url`、`properties`、`attributes` は変更しません。`image` フィールドだけを書き換えます。

## 制約 (必ず守る)

- **コミットしない。プッシュしない。** 作業ツリーは dirty のまま残します。レビューとプッシュはユーザが行います。
- 変更は `main` ではなく新規ブランチに載せます。
- 冪等性を保ち、再実行しても問題ないようにします。

## 前提

- `cwd` が `wagumi/sbt` のルート。`metadata/`、`mint/`、`burn/`、`README.md` が見える状態であること。
- 同じマシンに `wagumi-sbt-discord-bot` リポジトリがチェックアウトされていること。差し替え画像はそこの `<wagumi-sbt-discord-bot>/wind-down/wagumi-sbt-generic.png` にあります。絶対パスが分からない場合はユーザに確認してください。
- Node.js が使えること (任意の最新版、追加依存なし)。

## 手順

### 1. ブランチを作成

```sh
git checkout main
git pull
git checkout -b static-image-migration
```

### 2. 静的画像をこのリポジトリに配置

```sh
mkdir -p images
cp <wagumi-sbt-discord-bot>/wind-down/wagumi-sbt-generic.png images/wagumi-sbt.png
```

`<wagumi-sbt-discord-bot>` はローカルの絶対パスに置換してください。

任意: `pngquant` または `oxipng` が利用できる場合は事前に圧縮できます。元の PNG は約 2.6 MB ですが、見た目を損なわずに 200〜500 KB 程度まで縮められることが多いです。必須ではありません。

### 3. マイグレーションスクリプトを作成

以下を `migrate-image.js` としてリポジトリのルートに保存します。

```js
const fs = require("fs");
const path = require("path");

const metadataDir = path.join(process.cwd(), "metadata");
const newImageURL = "https://wagumi.github.io/sbt/images/wagumi-sbt.png";
const apply = process.argv.includes("--apply");

if (!fs.existsSync(metadataDir)) {
  console.error(`No metadata/ dir in ${process.cwd()}; are you in the wagumi/sbt repo root?`);
  process.exit(1);
}

const files = fs.readdirSync(metadataDir).filter((f) => f.endsWith(".json"));
let toUpdate = 0;
let already = 0;
let other = 0;
const samples = [];

for (const file of files) {
  const fp = path.join(metadataDir, file);
  const json = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (json.image === newImageURL) {
    already++;
    continue;
  }
  if (typeof json.image !== "string") {
    other++;
    console.warn(`WARN: ${file} has no string image field`);
    continue;
  }
  toUpdate++;
  if (samples.length < 3) samples.push({ file, before: json.image });
  if (apply) {
    json.image = newImageURL;
    fs.writeFileSync(fp, JSON.stringify(json, null, 2) + "\n");
  }
}

console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
console.log(`Total: ${files.length}`);
console.log(`To update: ${toUpdate}`);
console.log(`Already migrated: ${already}`);
console.log(`No string image field: ${other}`);
console.log("Sample diffs:");
for (const s of samples) {
  console.log(`  ${s.file}`);
  console.log(`    - ${s.before}`);
  console.log(`    + ${newImageURL}`);
}
```

### 4. ドライラン

```sh
node migrate-image.js
```

初回実行時の期待出力:
- `Total: 254` (新規 mint があれば前後します)
- `To update: <Total>`
- `Already migrated: 0`
- `No string image field: 0`
- 旧 `apps.wagumi.xyz` URL を新しい GitHub Pages URL に置き換えるサンプル diff が 3 件。

サンプル diff を確認し、問題なければ次に進みます。

### 5. 適用

```sh
node migrate-image.js --apply
```

### 6. 検証

```sh
git branch --show-current             # static-image-migration になっていること
ls images/wagumi-sbt.png              # ファイルが存在すること
SAMPLE=$(ls metadata | head -1)
jq .image metadata/$SAMPLE            # 新しい GitHub Pages URL が返ること
git status --short                    # metadata/*.json が約 254 件 modified、images/wagumi-sbt.png が新規
git diff metadata/$SAMPLE             # 1 行だけ変更されていること
git diff --stat | tail -1             # 約 254 ファイル + PNG

# 冪等性チェック: もう一度ドライラン。すべて已移行と表示されること
node migrate-image.js
```

### 7. 停止

ユーザに引き渡します。**コミットしない。プッシュしない。** `migrate-image.js` は作業ツリーに残しておいてください。保持するか gitignore するか削除するかはユーザが判断します。

## 参照用ターゲット URL

`https://wagumi.github.io/sbt/images/wagumi-sbt.png`
