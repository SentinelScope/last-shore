const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  "C:/Users/Olsze/Desktop/last-shore-screens.html",
  "utf8",
);

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("no style");

const svgStart = html.indexOf('<svg class="scene world');
const svgEnd = html.indexOf("</svg>", svgStart) + "</svg>".length;
if (svgStart < 0) throw new Error("no svg");
const svg = html.slice(svgStart, svgEnd);

let css = styleMatch[1];
// Drop the development-panel block only
css = css.replace(
  /\/\* ---------- development panel[\s\S]*?(?=\/\* ---------- diary)/,
  "",
);

const outDir = path.join("src", "scene");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "scene.css"), css);
fs.writeFileSync(path.join(outDir, "world.svg"), svg);

console.log("wrote css", css.length, "svg", svg.length);
