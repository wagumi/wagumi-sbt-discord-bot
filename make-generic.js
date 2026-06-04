const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const sbtDir = path.join(__dirname, "sbt-image");
const baseImage = fs.readFileSync(path.join(sbtDir, "base", "wagumi_sbt_base_dafault.png"));
const iconImage = fs.readFileSync(path.join(__dirname, "tmp", "wagumi-cat-0.png"));

const username = "和組メンバー";
const fontsize = "56";
const textColor = "#0B76D9";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1500" viewBox="0 0 1500 1500">
  <image href="data:image/png;base64,${baseImage.toString("base64")}" width="1500" height="1500"/>
  <image href="data:image/png;base64,${iconImage.toString("base64")}" x="330" y="844" width="200" height="200" transform="rotate(340,430,944)"/>
  <text x="265" y="1275" font-size="${fontsize}" stroke-width="1" stroke="#ffffff" fill="${textColor}" transform="rotate(340,150,700)">${username}</text>
  <text x="265" y="1275" font-size="${fontsize}" fill="${textColor}" transform="rotate(340,150,700)">${username}</text>
</svg>`;

const resvg = new Resvg(svg, {
	font: {
		fontFiles: [
			path.join(sbtDir, "MPLUSRounded1c-Medium.ttf"),
			path.join(sbtDir, "NotoEmoji-Medium.ttf"),
		],
		loadSystemFonts: true,
		defaultFontFamily: "Rounded Mplus 1c Medium",
	},
});

const tmpDir = path.join(__dirname, "tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const outPath = path.join(tmpDir, "wagumi-sbt-generic.png");
fs.writeFileSync(outPath, resvg.render().asPng());
console.log(`Wrote ${outPath}`);
