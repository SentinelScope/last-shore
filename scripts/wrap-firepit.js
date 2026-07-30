const fs = require("fs");
const p = "src/scene/world.svg";
let s = fs.readFileSync(p, "utf8");
if (!s.includes('class="firepit"')) {
  s = s.replace(
    "<!-- ================= FIRE ================= -->\n  <ellipse class=\"firelight\"",
    "<!-- ================= FIRE ================= -->\n  <g class=\"firepit\">\n  <ellipse class=\"firelight\"",
  );
  const marker = "  <!-- ================= PALMS ================= -->";
  s = s.replace(marker, "  </g>\n\n" + marker);
  fs.writeFileSync(p, s);
}
const svg = fs.readFileSync(p, "utf8");
fs.writeFileSync(
  "src/scene/worldMarkup.ts",
  "/* Auto-generated from world.svg */\nexport const WORLD_SVG = " +
    JSON.stringify(svg) +
    ";\n",
);
console.log("firepit", svg.includes("firepit"));
