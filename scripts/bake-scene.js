const fs = require("fs");
const path = require("path");

/** Deterministic mulberry32 — bake rain so the scene never uses Math.random. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgPath = path.join("src", "scene", "world.svg");
let svg = fs.readFileSync(svgPath, "utf8");

const rng = mulberry32(0x5a0ce); // fixed — visual rain field, not game RNG
const lines = [];
for (let i = 0; i < 90; i++) {
  const x = rng() * 460 - 40;
  const y = rng() * 400 + 100;
  const len = 12 + rng() * 16;
  const delay = (-rng() * 1.2).toFixed(3);
  const op = (0.22 + rng() * 0.3).toFixed(3);
  lines.push(
    `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x - 5).toFixed(2)}" y2="${(y + len).toFixed(2)}" style="animation-delay:${delay}s;opacity:${op}"/>`,
  );
}

svg = svg.replace(
  '<g class="rain" id="rain"></g>',
  `<g class="rain" id="rain">${lines.join("")}</g>`,
);

fs.writeFileSync(svgPath, svg);

const markup = `/* Auto-generated from last-shore-screens.html — do not redesign. */\nexport const WORLD_SVG = ${JSON.stringify(svg)};\n`;
fs.writeFileSync(path.join("src", "scene", "worldMarkup.ts"), markup);
console.log("baked rain + worldMarkup.ts", svg.length);
