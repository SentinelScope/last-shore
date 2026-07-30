/**
 * Tunable numbers for Last Shore.
 */

export const WEATHER_ROLL_HOURS = [2, 6, 10, 14, 18, 22] as const;

export type WeatherId = "clear" | "hot" | "overcast" | "rain" | "storm";
export type DayPart = "dawn" | "day" | "golden" | "night";

/** CSS class suffix on .world for day part */
export const DAY_PART_CLASS: Record<DayPart, string> = {
  dawn: "t-dawn",
  day: "t-day",
  golden: "t-golden",
  night: "t-night",
};

/** CSS class suffix on .world for weather (HTML uses w-cloudy for overcast) */
export const WEATHER_CLASS: Record<WeatherId, string> = {
  clear: "w-clear",
  hot: "w-hot",
  overcast: "w-cloudy",
  rain: "w-rain",
  storm: "w-storm",
};

export const DAY_PART_LABEL: Record<DayPart, string> = {
  dawn: "Dawn",
  day: "Midday",
  golden: "Golden hour",
  night: "Night",
};

export const WEATHER_LABEL: Record<WeatherId, string> = {
  clear: "clear",
  hot: "hot",
  overcast: "overcast",
  rain: "rain",
  storm: "storm",
};

export const WEATHER_BASE_WEIGHTS: Record<WeatherId, number> = {
  clear: 50,
  hot: 10,
  overcast: 25,
  rain: 10,
  storm: 5,
};

export const SAVE_KEY = "last-shore-save-v1";

export type StorageTierId = "sand" | "satchel" | "wooden" | "storage";

export const STORAGE_TIERS: Record<
  StorageTierId,
  { slots: number; label: string; strip: string }
> = {
  sand: { slots: 5, label: "stored in the sand", strip: "Sand 5" },
  satchel: { slots: 10, label: "woven satchel", strip: "Satchel 10" },
  wooden: { slots: 15, label: "wooden box", strip: "Wooden 15" },
  storage: { slots: 20, label: "storage box", strip: "Storage 20" },
};

export const LOCK_HINT: Record<StorageTierId, string> = {
  sand: "Craft a satchel",
  satchel: "Build a wooden box",
  wooden: "Build a storage box",
  storage: "Full",
};

/** Starting kit for a new run. */
export const STARTING_INVENTORY: { itemId: string; qty: number }[] = [
  { itemId: "stone", qty: 2 },
  { itemId: "wood", qty: 5 },
  { itemId: "plant_fiber", qty: 2 },
  { itemId: "coconut", qty: 1 },
];

export const HOTSPOT_IDLE_MS = 10_000;

/* ---------- activities ---------- */

export type ActivityKind = "scour" | "cut" | "craft" | "cook";
export type DurationId = "5m" | "20m" | "1h";
export type CutTool = "bare" | "stone_axe" | "metal_axe";

export const ACTIVITY_DURATIONS: Record<
  DurationId,
  { label: string; ms: number }
> = {
  "5m": { label: "5 min", ms: 5 * 60_000 },
  "20m": { label: "20 min", ms: 20 * 60_000 },
  "1h": { label: "1 hour", ms: 60 * 60_000 },
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  scour: "Scouring the shore",
  cut: "Cutting trees",
  craft: "Crafting",
  cook: "Cooking",
};

/** Hotspot → activity, if any (milestone 3a). */
export const HOTSPOT_ACTIVITY: Partial<Record<string, ActivityKind>> = {
  shore: "scour",
  palm: "cut",
};

export type ScourLootId =
  | "stone"
  | "coconut"
  | "plant_fiber"
  | "wood"
  | "crab"
  | "flint";

export const SCOUR_TABLE: Record<
  DurationId,
  { maxItems: number; weights: Record<ScourLootId, number> }
> = {
  "5m": {
    maxItems: 3,
    weights: {
      stone: 33,
      coconut: 29,
      plant_fiber: 24,
      wood: 6,
      crab: 3,
      flint: 5,
    },
  },
  "20m": {
    maxItems: 5,
    weights: {
      stone: 23,
      coconut: 24,
      plant_fiber: 19,
      wood: 19,
      crab: 9,
      flint: 6,
    },
  },
  "1h": {
    maxItems: 7,
    weights: {
      stone: 14,
      coconut: 19,
      plant_fiber: 14,
      wood: 28,
      crab: 18,
      flint: 7,
    },
  },
};

/** Wood yielded by cutting trees: [5m, 20m, 1h] keyed by tool. */
export const CUT_YIELD: Record<CutTool, Record<DurationId, number>> = {
  bare: { "5m": 1, "20m": 4, "1h": 9 },
  stone_axe: { "5m": 2, "20m": 8, "1h": 18 },
  metal_axe: { "5m": 3, "20m": 12, "1h": 27 },
};

/* ---------- weather conditional (one step, no chaining) ---------- */

export const WEATHER_CONDITIONAL: Partial<
  Record<WeatherId, Partial<Record<WeatherId, number>>>
> = {
  overcast: { rain: 15, hot: 5 },
  rain: { storm: 10, hot: 5 },
};

/* ---------- washed-up containers ---------- */

export type ContainerTier = "small" | "medium" | "large" | "chest";
export type ContainerRoll = "nothing" | ContainerTier;

export const CONTAINER_ODDS: Record<
  "normal" | "storm" | "golden",
  Record<ContainerRoll, number>
> = {
  normal: {
    nothing: 60,
    small: 25,
    medium: 10,
    large: 4.5,
    chest: 0.5,
  },
  storm: {
    nothing: 0,
    small: 62.5,
    medium: 25,
    large: 11.25,
    chest: 1.25,
  },
  golden: {
    nothing: 44.5,
    small: 25,
    medium: 20,
    large: 9,
    chest: 1.5,
  },
};

export const CONTAINER_LABEL: Record<ContainerTier, string> = {
  small: "Small crate",
  medium: "Crate",
  large: "Large crate",
  chest: "Chest",
};

/** Uniform pools — ids match public/items/*.png */
export const LOOT_POOLS = {
  common: [
    "wood",
    "string",
    "photo",
    "magazine",
    "wooden_toy",
    "book",
    "message_bottle",
    "granola_bar",
    "wooden_matches",
    "cup",
    "sandals",
  ],
  rare: [
    "cooking_pan",
    "lighter",
    "can_of_food",
    "bottle",
    "bandage",
    "handkerchief",
    "music_box",
    "looking_glass",
    "chocolate_bar",
    "soda",
    "hat",
    "shirt",
    "pants",
    "metal_scrap",
    "duct_tape",
    "rubber_ducky",
  ],
  very_rare: [
    "canister",
    "medicine_bottle",
    "voice_recorder",
    "volleyball",
    "treasure_map",
    "sneakers",
    "sunglasses",
    "wristwatch",
  ],
} as const;

export type LootRarity = keyof typeof LOOT_POOLS;

/* ---------- crafting ---------- */

export type RecipeId =
  | "string"
  | "tinder"
  | "coconut_cup"
  | "stone_axe"
  | "wooden_spear"
  | "stone_spear"
  | "wooden_hammer"
  | "stone_hammer"
  | "fishing_stick"
  | "simple_fireplace"
  | "satchel"
  | "palm_frond_mat"
  | "log_chair"
  | "lean_to";

export type Recipe = {
  id: RecipeId;
  name: string;
  timeMs: number;
  cost: { itemId: string; qty: number }[];
  /** Required in inventory, not consumed. */
  tool?: string;
  result?: { itemId: string; qty: number };
  effect?:
    | "satchel"
    | "simple_fireplace"
    | "mat"
    | "log_chair"
    | "lean_to";
};

export const RECIPES: Recipe[] = [
  {
    id: "string",
    name: "String",
    timeMs: 1 * 60_000,
    cost: [{ itemId: "plant_fiber", qty: 2 }],
    result: { itemId: "string", qty: 1 },
  },
  {
    id: "tinder",
    name: "Tinder",
    timeMs: 1 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 2 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "tinder", qty: 1 },
  },
  {
    id: "coconut_cup",
    name: "Coconut Cup",
    timeMs: 1 * 60_000,
    cost: [{ itemId: "coconut", qty: 1 }],
    result: { itemId: "coconut_cup", qty: 1 },
  },
  {
    id: "stone_axe",
    name: "Stone Axe",
    timeMs: 2 * 60_000,
    cost: [
      { itemId: "stone", qty: 2 },
      { itemId: "wood", qty: 2 },
    ],
    result: { itemId: "stone_axe", qty: 1 },
  },
  {
    id: "wooden_spear",
    name: "Wooden Spear",
    timeMs: 2 * 60_000,
    cost: [{ itemId: "wood", qty: 3 }],
    result: { itemId: "wooden_spear", qty: 1 },
  },
  {
    id: "stone_spear",
    name: "Stone Spear",
    timeMs: 2 * 60_000,
    cost: [
      { itemId: "stone", qty: 1 },
      { itemId: "wood", qty: 3 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "stone_spear", qty: 1 },
  },
  {
    id: "wooden_hammer",
    name: "Wooden Hammer",
    timeMs: 2 * 60_000,
    cost: [{ itemId: "wood", qty: 4 }],
    result: { itemId: "wooden_hammer", qty: 1 },
  },
  {
    id: "stone_hammer",
    name: "Stone Hammer",
    timeMs: 5 * 60_000,
    cost: [
      { itemId: "stone", qty: 2 },
      { itemId: "wood", qty: 3 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "stone_hammer", qty: 1 },
  },
  {
    id: "fishing_stick",
    name: "Fishing Stick",
    timeMs: 3 * 60_000,
    cost: [
      { itemId: "wood", qty: 2 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "fishing_stick", qty: 1 },
  },
  {
    id: "simple_fireplace",
    name: "Simple Fireplace",
    timeMs: 3 * 60_000,
    cost: [{ itemId: "wood", qty: 3 }],
    effect: "simple_fireplace",
  },
  {
    id: "satchel",
    name: "Satchel",
    timeMs: 10 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 6 },
      { itemId: "string", qty: 2 },
    ],
    result: { itemId: "satchel", qty: 1 },
    effect: "satchel",
  },
  {
    id: "palm_frond_mat",
    name: "Palm-frond Mat",
    timeMs: 5 * 60_000,
    cost: [{ itemId: "plant_fiber", qty: 6 }],
    effect: "mat",
  },
  {
    id: "log_chair",
    name: "Log Chair",
    timeMs: 10 * 60_000,
    cost: [{ itemId: "wood", qty: 4 }],
    effect: "log_chair",
  },
  {
    id: "lean_to",
    name: "Lean-to",
    timeMs: 15 * 60_000,
    cost: [
      { itemId: "wood", qty: 6 },
      { itemId: "plant_fiber", qty: 4 },
    ],
    tool: "wooden_hammer",
    effect: "lean_to",
  },
];

/* ---------- water ---------- */

export const WATER_CAPACITY: Record<string, number> = {
  empty_can: 10,
  cup: 25,
  coconut_cup: 25,
  bottle: 50,
  canister: 100,
};

export const WATER_FILL = {
  rainPercentPerFiveMin: 1,
  stormPercentPerMin: 3,
} as const;

export const WATER_DRINK_UNITS = 10;

/* ---------- fire ---------- */

export const FIRE_LIGHT_HOLD_MS = 5_000;
export const FIRE_FUEL_MAX = 12;
/** Wood consumed per hour while lit. */
export const FIRE_WOOD_PER_HOUR = 1;

export const IGNITION_USES: Record<string, number> = {
  flint: 8,
  wooden_matches: 20,
  lighter: 60,
};

export const IGNITION_ITEMS = ["flint", "wooden_matches", "lighter"] as const;

/** Base cook times before tier / pan multipliers. */
export const COOK_BASE_MS: Record<string, number> = {
  small_fish: 30 * 60_000,
  medium_fish: 30 * 60_000,
  large_fish: 30 * 60_000,
  crab: 20 * 60_000,
  can_of_food: 5 * 60_000,
};

/** Raw → cooked. Can of food stays itself. */
export const COOK_RESULT: Record<string, string> = {
  small_fish: "cooked_small_fish",
  medium_fish: "cooked_medium_fish",
  large_fish: "cooked_large_fish",
  crab: "cooked_crab",
  can_of_food: "can_of_food",
};

export const FIREPLACE_COOK_MULT: Record<"simple" | "stone" | "cooking", number> =
  {
    simple: 1.0,
    stone: 0.7,
    cooking: 0.5,
  };

export const COOKING_PAN_MULT = 0.7;

export const RAW_FOOD = new Set([
  "small_fish",
  "medium_fish",
  "large_fish",
  "crab",
]);

/* ---------- vitals ---------- */

/** Catch-up steps at most this many wall-clock days. */
export const CATCH_UP_MAX_DAYS = 14;

export const THIRST_EMPTY_HOURS = 24;
export const HUNGER_EMPTY_HOURS = 48;
/** Health loss per hour for each empty thirst/hunger bar. */
export const HEALTH_EMPTY_BAR_PER_HOUR = 4;
/** Base health regen per hour while both bars are above 0. */
export const HEALTH_REGEN_BASE_PER_HOUR = 1;
/** Extra regen per comfort point per hour (while both bars above 0). */
export const HEALTH_REGEN_PER_COMFORT = 0.125;

export const COMFORT_SOURCES = {
  lean_to: 10,
  mat: 5,
  log_chair: 5,
  fire_lit: 15,
} as const;

export const COMFORT_WEATHER: Partial<Record<WeatherId, number>> = {
  hot: -10,
  rain: -10,
  storm: -20,
};

/** Edible items: hunger / thirst restored. */
export const EAT_EFFECT: Record<string, { food: number; water: number }> = {
  coconut: { food: 5, water: 10 },
  cooked_crab: { food: 10, water: 2 },
  cooked_small_fish: { food: 15, water: 3 },
  cooked_medium_fish: { food: 25, water: 5 },
  cooked_large_fish: { food: 40, water: 8 },
  can_of_food: { food: 30, water: 10 },
  granola_bar: { food: 10, water: 0 },
  chocolate_bar: { food: 20, water: 0 },
  soda: { food: 0, water: 20 },
};

export const META_KEY = "last-shore-meta-v1";
