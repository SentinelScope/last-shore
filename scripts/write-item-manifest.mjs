import fs from "fs";

const pngs = fs
  .readdirSync("public/items")
  .filter((f) => f.endsWith(".png"))
  .map((f) => f.slice(0, -4))
  .sort();

/** Maps an item/recipe id to a PNG basename (without .png). */
const aliases = {
  cooked_crab: "crab",
  cooked_small_fish: "small_fish",
  cooked_medium_fish: "medium_fish",
  cooked_large_fish: "large_fish",
  fish_small: "small_fish",
  fish_medium: "medium_fish",
  fish_large: "large_fish",
  fiber: "plant_fiber",
  pan: "cooking_pan",
  metal: "metal_scrap",
  recorder: "voice_recorder",
  leanto: "lean_to",
  "palm-frond-mat": "palm_frond_mat",
  wood_hammer: "wooden_hammer",
  wood_spear: "wooden_spear",
  stormproof_shelter: "storm_shelter",
  medicine: "medicine_bottle",
  boot: "pair_of_boots",
  can: "empty_can",
  mat: "palm_frond_mat",
};

const manifest = {
  files: pngs.map((id) => `${id}.png`),
  aliases,
};

fs.writeFileSync(
  "public/items/_manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("wrote manifest", pngs.length, "files", Object.keys(aliases).length, "aliases");
