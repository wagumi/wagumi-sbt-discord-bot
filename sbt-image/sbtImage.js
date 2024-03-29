const fs = require("fs");
const fetch = require("node-fetch");
const { Resvg } = require("@resvg/resvg-js");

const createSBTImage = async (userid, username, icon, baseImage, borderImage, baseSvg, textColor) => {
	const base = fs.readFileSync(baseSvg, "utf8");

	let fontsize = "64";
	username = username.substring(0, 24);
	for (let i = 0; i < username.length; i++) {
		if (username.charCodeAt(i) >= 256) {
			username = username.substring(0, 24);
			fontsize = "56";
			break;
		}
	};

	let svg = base.replaceAll("$username$", username);
	svg = svg.replaceAll("$base-image$", baseImage);
	svg = svg.replaceAll("$border-image$", borderImage);
	svg = svg.replaceAll("$icon$", icon);
	svg = svg.replaceAll("$text-color$", textColor);
	svg = svg.replaceAll("$font-size$", fontsize);

	//fs.writeFileSync(`./sbt-image/svg/${userid}.svg`, svg);

	const opts = {
		font: {
			fontFiles: ["./sbt-image/MPLUSRounded1c-Medium.ttf", "./sbt-image/NotoEmoji-Medium.ttf"],
			loadSystemFonts: true,
			defaultFontFamily: 'Rounded Mplus 1c Medium',
		}
	};
	const resvg = new Resvg(svg, opts);

	const resolved = await Promise.all(
		resvg.imagesToResolve().map(async (url) => {
			const img = await fetch(url);
			const buffer = await img.arrayBuffer();
			return {
				url,
				buffer: Buffer.from(buffer),
			};
		}),
	);

	if (resolved.length > 0) {
		for (const result of resolved) {
			const { url, buffer } = result;
			resvg.resolveImage(url, buffer);
		}
	}

	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	//fs.writeFileSync(`./sbt-image/png/${userid}.png`, pngBuffer);
	//console.log(`created ${userid}.png`);
	return pngBuffer;
};

module.exports = { createSBTImage };