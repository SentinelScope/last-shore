/**
 * Item definitions — ids match PNG filenames in public/items/.
 */

import { assertItemArt, itemArtSrc } from "./itemArt";

export type ItemTag = [kind: "water" | "food" | "hp" | "comf", label: string];

export type ItemDef = {
  id: string;
  name: string;
  type: string;
  description: string;
  stack: number;
  tags: ItemTag[];
};

function mat(id: string, name: string, stack: number, description: string): ItemDef {
  return {
    id,
    name,
    type: `Material · stacks to ${stack}`,
    description,
    stack,
    tags: [],
  };
}

function food(
  id: string,
  name: string,
  stack: number,
  description: string,
  tags: ItemTag[],
): ItemDef {
  return {
    id,
    name,
    type: stack > 1 ? `Food · stacks to ${stack}` : "Food",
    description,
    stack,
    tags,
  };
}

function comfort(
  id: string,
  name: string,
  description: string,
  amount: number,
): ItemDef {
  return {
    id,
    name,
    type: "Comfort · carried",
    description,
    stack: 1,
    tags: [["comf", `+${amount} Comfort`]],
  };
}

export const ITEMS: Record<string, ItemDef> = {
  stone: mat(
    "stone",
    "Stone",
    10,
    "The most basic thing on the island, and the one that starts everything.",
  ),
  wood: mat(
    "wood",
    "Wood",
    10,
    "Cut from the palms. Storage, fireplace, shelter, tool handles.",
  ),
  plant_fiber: mat(
    "plant_fiber",
    "Plant Fibers",
    10,
    "Torn from the scrub above the tideline. Twists into string and clothing.",
  ),
  string: mat(
    "string",
    "String",
    10,
    "Twisted plant fibre. Holds a spear head on, ties a line, stitches cloth.",
  ),
  coconut: food("coconut", "Coconut", 10, "Both a meal and a drink.", [
    ["food", "+5 Food"],
    ["water", "+10 Water"],
  ]),
  crab: food(
    "crab",
    "Crab",
    5,
    "Small, but it fights back. Cook it before you eat.",
    [
      ["food", "+10 Food (cooked)"],
      ["water", "+2 Water (cooked)"],
    ],
  ),
  cooked_crab: food(
    "cooked_crab",
    "Cooked Crab",
    5,
    "The shell is blackened. The meat is sweet.",
    [
      ["food", "+10 Food"],
      ["water", "+2 Water"],
    ],
  ),
  small_fish: food(
    "small_fish",
    "Small Fish",
    5,
    "Barely a mouthful once cooked. Raw, it is nothing.",
    [["food", "+15 Food (cooked)"]],
  ),
  cooked_small_fish: food(
    "cooked_small_fish",
    "Cooked Small Fish",
    5,
    "Flaked white over the coals.",
    [
      ["food", "+15 Food"],
      ["water", "+3 Water"],
    ],
  ),
  medium_fish: food(
    "medium_fish",
    "Medium Fish",
    5,
    "A proper catch. Cook it.",
    [["food", "+25 Food (cooked)"]],
  ),
  cooked_medium_fish: food(
    "cooked_medium_fish",
    "Cooked Medium Fish",
    5,
    "Hot, oily, enough to matter.",
    [
      ["food", "+25 Food"],
      ["water", "+5 Water"],
    ],
  ),
  large_fish: food(
    "large_fish",
    "Large Fish",
    3,
    "Heavy in the hand. Needs the fire.",
    [["food", "+40 Food (cooked)"]],
  ),
  cooked_large_fish: food(
    "cooked_large_fish",
    "Cooked Large Fish",
    3,
    "A feast by island standards.",
    [
      ["food", "+40 Food"],
      ["water", "+8 Water"],
    ],
  ),
  granola_bar: food(
    "granola_bar",
    "Granola Bar",
    5,
    "Still sealed. A little soft at the edges.",
    [["food", "+10 Food"]],
  ),
  chocolate_bar: food(
    "chocolate_bar",
    "Chocolate Bar",
    5,
    "Bloomed white in the heat. Still sweet.",
    [["food", "+20 Food"]],
  ),
  soda: {
    id: "soda",
    name: "Soda",
    type: "Drink · stacks to 5",
    description: "Flat, warm, and somehow still a gift.",
    stack: 5,
    tags: [["water", "+20 Water"]],
  },
  can_of_food: food(
    "can_of_food",
    "Can of Food",
    5,
    "Label long gone. Whatever is inside has outlived whoever packed it.",
    [
      ["food", "+30 Food"],
      ["water", "+10 Water"],
    ],
  ),
  metal_scrap: mat(
    "metal_scrap",
    "Metal Scrap",
    5,
    "Only ever from a washed-up container. Every best upgrade waits on this.",
  ),
  wooden_matches: {
    id: "wooden_matches",
    name: "Wooden Matches",
    type: "Tool · stacks to 3",
    description: "Damp-proof enough, if you are careful. Twenty fires in the box.",
    stack: 3,
    tags: [],
  },
  bandage: {
    id: "bandage",
    name: "Bandage",
    type: "Medicine · stacks to 3",
    description: "Fibre and string, boiled and wound. Closes a cut.",
    stack: 3,
    tags: [["hp", "Heals cuts"]],
  },
  duct_tape: {
    id: "duct_tape",
    name: "Duct Tape",
    type: "Tool · stacks to 3",
    description: "The answer to most broken things, for a while.",
    stack: 3,
    tags: [],
  },
  medicine_bottle: {
    id: "medicine_bottle",
    name: "Medicine Bottle",
    type: "Medicine · very rare",
    description: "Four tablets left. Cold or infection — no way to know which is coming.",
    stack: 3,
    tags: [["hp", "Cold · infection"]],
  },
  stone_axe: {
    id: "stone_axe",
    name: "Stone Axe",
    type: "Tool · durability",
    description: "A stone lashed to a handle.",
    stack: 1,
    tags: [],
  },
  metal_axe: {
    id: "metal_axe",
    name: "Metal Axe",
    type: "Tool · durability",
    description: "The fastest and longest-lasting axe.",
    stack: 1,
    tags: [],
  },
  cooking_pan: {
    id: "cooking_pan",
    name: "Cooking Pan",
    type: "Tool · very rare",
    description: "Dented, blackened, still perfectly good.",
    stack: 1,
    tags: [],
  },
  lighter: {
    id: "lighter",
    name: "Lighter",
    type: "Tool · durability",
    description: "Sparks on the third strike. Sixty fires if you are lucky.",
    stack: 1,
    tags: [],
  },
  cup: {
    id: "cup",
    name: "Cup",
    type: "Container · 25 water",
    description: "Plastic, scratched. Holds rain if you leave it out.",
    stack: 1,
    tags: [["water", "Holds 25"]],
  },
  bottle: {
    id: "bottle",
    name: "Bottle",
    type: "Container · 50 water",
    description: "Twice a cup, and it cannot be made — only found.",
    stack: 1,
    tags: [["water", "Holds 50"]],
  },
  canister: {
    id: "canister",
    name: "Canister",
    type: "Container · 100 water",
    description: "A full day of thirst in one object.",
    stack: 1,
    tags: [["water", "Holds 100"]],
  },
  photo: comfort("photo", "Photo", "Four people at a table. You have decided who they are.", 2),
  magazine: comfort(
    "magazine",
    "Magazine",
    "Adverts for things that no longer exist.",
    3,
  ),
  wooden_toy: comfort(
    "wooden_toy",
    "Wooden Toy",
    "A little boat. Someone carved it badly, and with care.",
    3,
  ),
  book: comfort("book", "Book", "Swollen with salt water. The last forty pages are gone.", 4),
  handkerchief: comfort(
    "handkerchief",
    "Handkerchief",
    "Someone embroidered the corner. Not anyone you know.",
    3,
  ),
  looking_glass: comfort(
    "looking_glass",
    "Looking Glass",
    "The horizon, closer. Still empty.",
    4,
  ),
  music_box: comfort(
    "music_box",
    "Music Box",
    "Eleven notes, then it needs winding again.",
    5,
  ),
  rubber_ducky: comfort(
    "rubber_ducky",
    "Rubber Ducky",
    "It squeaks. You are not proud of how often you squeeze it.",
    5,
  ),
  volleyball: comfort(
    "volleyball",
    "Volleyball",
    "It has a face on it. You did not draw the face.",
    10,
  ),
  voice_recorder: {
    id: "voice_recorder",
    name: "Voice Recorder",
    type: "Comfort · interactive",
    description:
      "One recording on it. A stranger, mid-sentence. You have played it more times than you would admit.",
    stack: 1,
    tags: [["comf", "+7 Comfort"]],
  },
  wristwatch: comfort(
    "wristwatch",
    "Wristwatch",
    "Still ticking. You have stopped checking it.",
    5,
  ),
  compass: comfort(
    "compass",
    "Compass",
    "Always points north. North is the sea. You had worked that out.",
    3,
  ),
  candle: comfort(
    "candle",
    "Candle",
    "Half gone. The wick still takes a flame.",
    3,
  ),
  message_bottle: {
    id: "message_bottle",
    name: "Message in a Bottle",
    type: "Curiosity",
    description: "Corked tight. The paper inside is dry. Not yet.",
    stack: 1,
    tags: [],
  },
  treasure_map: {
    id: "treasure_map",
    name: "Treasure Map",
    type: "Curiosity · very rare",
    description: "An island that looks a little like this one. Or not.",
    stack: 1,
    tags: [],
  },
  fibre_hat: {
    id: "fibre_hat",
    name: "Plant Fibre Hat",
    type: "Clothing · head",
    description: "Woven close. Keeps the worst of the sun off.",
    stack: 1,
    tags: [["comf", "+1 Comfort"]],
  },
  hat: {
    id: "hat",
    name: "Hat",
    type: "Clothing · head",
    description: "Keeps the sun off. A little.",
    stack: 1,
    tags: [["comf", "+3 Comfort"]],
  },
  fibre_shirt: {
    id: "fibre_shirt",
    name: "Plant Fibre Shirt",
    type: "Clothing · body",
    description: "Rough weave. Better than bare shoulders.",
    stack: 1,
    tags: [["comf", "+2 Comfort"]],
  },
  shirt: {
    id: "shirt",
    name: "Shirt",
    type: "Clothing · body",
    description: "Salt-stiff, but it is not rags.",
    stack: 1,
    tags: [["comf", "+5 Comfort"]],
  },
  fibre_pants: {
    id: "fibre_pants",
    name: "Plant Fibre Pants",
    type: "Clothing · legs",
    description: "Tied at the waist with string. They hold.",
    stack: 1,
    tags: [["comf", "+2 Comfort"]],
  },
  pants: {
    id: "pants",
    name: "Pants",
    type: "Clothing · legs",
    description: "One pocket still holds.",
    stack: 1,
    tags: [["comf", "+4 Comfort"]],
  },
  fibre_sandals: {
    id: "fibre_sandals",
    name: "Plant Fibre Sandals",
    type: "Clothing · feet",
    description: "Thin soles. The sand still gets in.",
    stack: 1,
    tags: [["comf", "+1 Comfort"]],
  },
  pair_of_boots: {
    id: "pair_of_boots",
    name: "Pair of Boots",
    type: "Clothing · feet",
    description: "Heavy. One lace is gone.",
    stack: 1,
    tags: [["comf", "+2 Comfort"]],
  },
  sandals: {
    id: "sandals",
    name: "Sandals",
    type: "Clothing · feet",
    description: "Better than bare feet on the noon sand.",
    stack: 1,
    tags: [["comf", "+3 Comfort"]],
  },
  sneakers: {
    id: "sneakers",
    name: "Sneakers",
    type: "Clothing · feet",
    description: "Almost dry. Almost a size that fits.",
    stack: 1,
    tags: [["comf", "+5 Comfort"]],
  },
  sunglasses: {
    id: "sunglasses",
    name: "Sunglasses",
    type: "Clothing · head",
    description: "One lens cracked. The glare still softens.",
    stack: 1,
    tags: [["comf", "+5 Comfort"]],
  },
  flint: {
    id: "flint",
    name: "Flint",
    type: "Tool · durability",
    description:
      "Struck right, it throws a spark. Eight fires if you are careful with it.",
    stack: 3,
    tags: [],
  },
  tinder: mat(
    "tinder",
    "Tinder",
    10,
    "A dry nest of fibre and string. Consumed whole by each fire you start.",
  ),
  coconut_cup: {
    id: "coconut_cup",
    name: "Coconut Cup",
    type: "Container · 25 water",
    description:
      "Half a shell, set out in the open. Fills when it rains. Lives at the water spot.",
    stack: 1,
    tags: [["water", "Holds 25"]],
  },
  empty_can: {
    id: "empty_can",
    name: "Empty Can",
    type: "Container · 10 water",
    description: "Rust at the rim. Holds a little rain if you leave it out.",
    stack: 5,
    tags: [["water", "Holds 10"]],
  },
  wooden_spear: {
    id: "wooden_spear",
    name: "Wooden Spear",
    type: "Tool · durability",
    description: "Sharpened wood. Better than bare hands in the shallows.",
    stack: 1,
    tags: [],
  },
  wooden_hammer: {
    id: "wooden_hammer",
    name: "Wooden Hammer",
    type: "Tool",
    description: "For posts and pegs. Does not wear.",
    stack: 1,
    tags: [],
  },
  stone_hammer: {
    id: "stone_hammer",
    name: "Stone Hammer",
    type: "Tool",
    description: "Heavier. Needed for stronger shelters.",
    stack: 1,
    tags: [],
  },
  fishing_stick: {
    id: "fishing_stick",
    name: "Fishing Stick",
    type: "Tool",
    description: "A stick, a string, and patience. Does not wear.",
    stack: 1,
    tags: [],
  },
  satchel: {
    id: "satchel",
    name: "Satchel",
    type: "Storage",
    description: "Woven fibre. Twelve slots where the sand held eight.",
    stack: 1,
    tags: [],
  },
};

assertItemArt(ITEMS);
export { itemArtSrc };

/** Flat comfort points from a `comf` tag (e.g. "+4 Comfort" → 4). */
export function itemComfortBonus(def: ItemDef): number {
  for (const [kind, label] of def.tags) {
    if (kind !== "comf") continue;
    const m = label.match(/([+-]?\d+)/);
    if (m) return Number(m[1]);
  }
  return 0;
}

/** Carried comfort items (not clothing — those need to be worn). */
export function isCarriedComfortItem(def: ItemDef): boolean {
  return def.type.startsWith("Comfort");
}

export function itemActions(def: ItemDef): string[] {
  if (
    def.id === "crab" ||
    def.id === "small_fish" ||
    def.id === "medium_fish" ||
    def.id === "large_fish"
  ) {
    return ["Destroy"];
  }
  if (def.type.startsWith("Food") || def.type.startsWith("Drink")) {
    return ["Eat", "Destroy"];
  }
  if (def.type.startsWith("Container")) return ["Drink", "Set outside", "Destroy"];
  if (def.type.startsWith("Medicine")) return ["Apply", "Destroy"];
  if (def.type.startsWith("Comfort")) {
    return def.id === "voice_recorder" ? ["Play", "Destroy"] : ["Destroy"];
  }
  if (def.type.startsWith("Clothing")) return ["Wear", "Destroy"];
  if (def.type.startsWith("Tool") || def.type.startsWith("Material") || def.type.startsWith("Storage")) {
    return ["Destroy"];
  }
  return ["Destroy"];
}
