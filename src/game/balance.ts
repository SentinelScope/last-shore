/**
 * Tunable numbers for Last Shore.
 */

export const WEATHER_ROLL_HOURS = [2, 6, 10, 14, 18, 22] as const;

export type WeatherId =
  | "clear"
  | "hot"
  | "overcast"
  | "rain"
  | "storm"
  | "omen";
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
  omen: "w-omen",
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
  omen: "omen",
};

/** Base row — every weather roll totals 100. */
export const WEATHER_BASE_WEIGHTS: Record<WeatherId, number> = {
  clear: 35,
  hot: 10,
  overcast: 25,
  rain: 15,
  storm: 10,
  omen: 5,
};

export const SAVE_KEY = "last-shore-save-v2";

export type StorageTierId = "sand" | "satchel" | "wooden" | "storage";

export const STORAGE_TIERS: Record<
  StorageTierId,
  { slots: number; label: string; strip: string }
> = {
  sand: { slots: 8, label: "stored in the sand", strip: "Sand 8" },
  satchel: { slots: 12, label: "woven satchel", strip: "Satchel 12" },
  wooden: { slots: 16, label: "wooden box", strip: "Wooden 16" },
  storage: { slots: 20, label: "storage box", strip: "Storage 20" },
};

/** Extra slots on top of the current tier when the supporter perk is active. */
export const SUPPORTER_SLOT_BONUS = 5;

/** Effective inventory capacity for a storage tier. */
export function storageSlotCount(
  tier: StorageTierId,
  supporter = false,
): number {
  return STORAGE_TIERS[tier].slots + (supporter ? SUPPORTER_SLOT_BONUS : 0);
}

export const LOCK_HINT: Record<StorageTierId, string> = {
  sand: "Craft a satchel",
  satchel: "Build a wooden box",
  wooden: "Build a storage box",
  storage: "Supporter · +5",
};

/** Starting kit for a new run — empty by default. */
export const STARTING_INVENTORY: { itemId: string; qty: number }[] = [];

export const HOTSPOT_IDLE_MS = 10_000;

/* ---------- activities ---------- */

export type ActivityKind = "scour" | "cut" | "craft" | "cook";
export type DurationId = "5m" | "20m" | "1h";
export type CutTool = "bare" | "stone_axe" | "metal_axe";

/** Test clock only — shipping values are [5, 20, 60]. */
export const ACTIVITY_DURATIONS_MINUTES = [1, 5, 10] as const;

export const ACTIVITY_DURATIONS: Record<
  DurationId,
  { label: string; ms: number }
> = {
  "5m": {
    label: `${ACTIVITY_DURATIONS_MINUTES[0]} min`,
    ms: ACTIVITY_DURATIONS_MINUTES[0] * 60_000,
  },
  "20m": {
    label: `${ACTIVITY_DURATIONS_MINUTES[1]} min`,
    ms: ACTIVITY_DURATIONS_MINUTES[1] * 60_000,
  },
  "1h": {
    label: `${ACTIVITY_DURATIONS_MINUTES[2]} min`,
    ms: ACTIVITY_DURATIONS_MINUTES[2] * 60_000,
  },
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
      stone: 22,
      coconut: 27,
      plant_fiber: 36,
      wood: 7,
      crab: 3,
      flint: 5,
    },
  },
  "20m": {
    maxItems: 5,
    weights: {
      stone: 15,
      coconut: 22,
      plant_fiber: 30,
      wood: 20,
      crab: 8,
      flint: 5,
    },
  },
  "1h": {
    maxItems: 7,
    weights: {
      stone: 9,
      coconut: 17,
      plant_fiber: 24,
      wood: 29,
      crab: 16,
      flint: 5,
    },
  },
};

/** Wood yielded by cutting trees: [5m, 20m, 1h] keyed by tool. */
export const CUT_YIELD: Record<CutTool, Record<DurationId, number>> = {
  bare: { "5m": 1, "20m": 4, "1h": 9 },
  stone_axe: { "5m": 2, "20m": 8, "1h": 18 },
  metal_axe: { "5m": 3, "20m": 12, "1h": 27 },
};

/* ---------- weather conditional (full rows, each totals 100) ---------- */

export const WEATHER_CONDITIONAL: Partial<
  Record<WeatherId, Record<WeatherId, number>>
> = {
  overcast: {
    clear: 40,
    hot: 0,
    overcast: 25,
    rain: 20,
    storm: 10,
    omen: 5,
  },
  rain: {
    clear: 40,
    hot: 10,
    overcast: 25,
    rain: 10,
    storm: 10,
    omen: 5,
  },
  omen: {
    clear: 15,
    hot: 35,
    overcast: 10,
    rain: 15,
    storm: 25,
    omen: 0,
  },
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
    "document",
    "message_bottle",
    "granola_bar",
    "wooden_matches",
    "cup",
    "sandals",
    "candle",
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
    "compass",
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
  | "tool_rack"
  | "palm_frond_mat"
  | "log_chair"
  | "lean_to"
  | "walled_shelter"
  | "storm_shelter"
  | "fibre_hat"
  | "fibre_shirt"
  | "fibre_pants"
  | "fibre_sandals";

export type Recipe = {
  id: RecipeId;
  name: string;
  timeMs: number;
  cost: { itemId: string; qty: number }[];
  /** Required in inventory or on the tool rack, not consumed. */
  tool?: string;
  result?: { itemId: string; qty: number };
  effect?:
    | "satchel"
    | "tool_rack"
    | "simple_fireplace"
    | "mat"
    | "log_chair"
    | "lean_to"
    | "walled"
    | "storm";
  /** Build-page band. */
  band?: "early" | "medium" | "late";
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
    band: "medium",
  },
  {
    id: "tool_rack",
    name: "Tool Rack",
    timeMs: 15 * 60_000,
    cost: [
      { itemId: "wood", qty: 6 },
      { itemId: "string", qty: 2 },
    ],
    tool: "wooden_hammer",
    effect: "tool_rack",
    band: "medium",
  },
  {
    id: "palm_frond_mat",
    name: "Palm-frond Mat",
    timeMs: 5 * 60_000,
    cost: [{ itemId: "plant_fiber", qty: 6 }],
    effect: "mat",
    band: "medium",
  },
  {
    id: "log_chair",
    name: "Log Chair",
    timeMs: 10 * 60_000,
    cost: [{ itemId: "wood", qty: 4 }],
    effect: "log_chair",
    band: "medium",
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
    band: "medium",
  },
  {
    id: "walled_shelter",
    name: "Walled Shelter",
    timeMs: 25 * 60_000,
    cost: [
      { itemId: "wood", qty: 10 },
      { itemId: "plant_fiber", qty: 6 },
      { itemId: "string", qty: 2 },
    ],
    tool: "wooden_hammer",
    effect: "walled",
    band: "late",
  },
  {
    id: "storm_shelter",
    name: "Storm-proof Shelter",
    timeMs: 40 * 60_000,
    cost: [
      { itemId: "wood", qty: 8 },
      { itemId: "metal_scrap", qty: 4 },
      { itemId: "string", qty: 3 },
    ],
    tool: "stone_hammer",
    effect: "storm",
    band: "late",
  },
  {
    id: "fibre_hat",
    name: "Plant Fibre Hat",
    timeMs: 3 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 3 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "fibre_hat", qty: 1 },
    band: "late",
  },
  {
    id: "fibre_shirt",
    name: "Plant Fibre Shirt",
    timeMs: 5 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 5 },
      { itemId: "string", qty: 2 },
    ],
    result: { itemId: "fibre_shirt", qty: 1 },
    band: "late",
  },
  {
    id: "fibre_pants",
    name: "Plant Fibre Pants",
    timeMs: 5 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 5 },
      { itemId: "string", qty: 2 },
    ],
    result: { itemId: "fibre_pants", qty: 1 },
    band: "late",
  },
  {
    id: "fibre_sandals",
    name: "Plant Fibre Sandals",
    timeMs: 3 * 60_000,
    cost: [
      { itemId: "plant_fiber", qty: 3 },
      { itemId: "string", qty: 1 },
    ],
    result: { itemId: "fibre_sandals", qty: 1 },
    band: "late",
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
  walled: 18,
  storm: 28,
  mat: 5,
  log_chair: 5,
  fire_lit: 15,
} as const;

/* ---------- shelter ---------- */

export type ShelterTierId = "none" | "lean_to" | "walled" | "storm";

export const SHELTER_LABEL: Record<Exclude<ShelterTierId, "none">, string> = {
  lean_to: "Lean-to",
  walled: "Walled Shelter",
  storm: "Storm-proof Shelter",
};

/** Comfort-display slots by shelter tier. */
export const SHELTER_DECOR_SLOTS: Record<
  Exclude<ShelterTierId, "none">,
  number
> = {
  lean_to: 1,
  walled: 2,
  storm: 3,
};

export const COMFORT_WEATHER: Partial<Record<WeatherId, number>> = {
  hot: -10,
  rain: -10,
  storm: -20,
  omen: -15,
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

/* ---------- ailments ---------- */

export type AilmentId =
  | "cut_finger"
  | "twisted_ankle"
  | "heatstroke"
  | "cold"
  | "lightning"
  | "freak_wave";

/** Activity kinds that can roll ailments (includes future fishing). */
export type AilmentActivity = ActivityKind | "fish";

/**
 * Single editable table: chance % per minute of outdoor activity by weather.
 * `null` = never rolls in that weather. Crafting/Cooking never roll.
 * Omen triples clear rates for cut / ankle; freak wave is omen-only flat 0.20%.
 */
export const AILMENT_TABLE: Record<
  AilmentId,
  {
    label: string;
    /** Which outdoor activities can roll this. Empty = all outdoor. */
    appliesTo: readonly AilmentActivity[] | "outdoor";
    chancePerMinutePercent: Record<WeatherId, number | null>;
    /** Wait-out duration; lightning / freak wave have none. */
    durationMs: number | null;
    impact: {
      health?: number;
      thirst?: number;
    };
    whileActive: {
      healthPerHour?: number;
      comfort?: number;
    };
    /** Inventory item ids that cure, if any. */
    cureItems: readonly string[];
    /** Thirst % at or above which heatstroke clears. */
    cureThirstAtLeast?: number;
  }
> = {
  cut_finger: {
    label: "Cut Finger",
    appliesTo: ["cut"],
    chancePerMinutePercent: {
      clear: 0.1,
      overcast: 0.1,
      hot: 0.12,
      rain: 0.18,
      storm: 0.25,
      omen: 0.3,
    },
    durationMs: 24 * 60 * 60 * 1000,
    impact: { health: -5 },
    whileActive: { healthPerHour: -0.2 },
    cureItems: ["bandage"],
  },
  twisted_ankle: {
    label: "Twisted Ankle",
    appliesTo: ["scour", "fish", "cut"],
    chancePerMinutePercent: {
      clear: 0.05,
      overcast: 0.05,
      hot: 0.06,
      rain: 0.18,
      storm: 0.28,
      omen: 0.15,
    },
    durationMs: 24 * 60 * 60 * 1000,
    impact: {},
    whileActive: { comfort: -3 },
    cureItems: ["bandage"],
  },
  heatstroke: {
    label: "Heatstroke",
    appliesTo: "outdoor",
    chancePerMinutePercent: {
      clear: null,
      overcast: null,
      hot: 0.3,
      rain: null,
      storm: null,
      omen: null,
    },
    durationMs: 12 * 60 * 60 * 1000,
    impact: { thirst: -10 },
    whileActive: { comfort: -5 },
    cureItems: [],
    cureThirstAtLeast: 80,
  },
  cold: {
    label: "Cold",
    appliesTo: "outdoor",
    chancePerMinutePercent: {
      clear: null,
      overcast: 0.03,
      hot: null,
      rain: 0.18,
      storm: 0.28,
      omen: null,
    },
    durationMs: 48 * 60 * 60 * 1000,
    impact: {},
    whileActive: { comfort: -5 },
    cureItems: ["medicine_bottle"],
  },
  lightning: {
    label: "Lightning",
    appliesTo: "outdoor",
    chancePerMinutePercent: {
      clear: null,
      overcast: null,
      hot: null,
      rain: null,
      storm: 0.05,
      omen: null,
    },
    durationMs: null,
    impact: {},
    whileActive: {},
    cureItems: [],
  },
  freak_wave: {
    label: "Freak Wave",
    appliesTo: "outdoor",
    chancePerMinutePercent: {
      clear: null,
      overcast: null,
      hot: null,
      rain: null,
      storm: null,
      omen: 0.2,
    },
    durationMs: null,
    impact: {},
    whileActive: {},
    cureItems: [],
  },
};

/** Diary lines when Omen weather begins (no deltas). */
export const DIARY_OMEN_BEGIN = [
  "The sky went red and stayed that way. The sea has gone quiet.",
  "Red light over everything. The water stopped speaking.",
  "The sky bruised red and held. No wind. No birds.",
  "Morning came wrong — red from edge to edge, and the sea still as glass.",
] as const;

/** Hat in inventory blocks the Heatstroke roll entirely. */
export const HEATSTROKE_HAT_ITEM = "hat";

/* ---------- diary ---------- */

/** Idle observations — pick without repeat until exhausted, then reshuffle. */
export const DIARY_IDLE_OBSERVATIONS = [
  "Counted the palms again. Still four.",
  "Saw a ship. Waved until my arm hurt. Nobody waved back.",
  "A star fell across the water. Slowly, though. Stars do not fall slowly.",
  "Woke twice. The wind gets under the roof on the seaward side.",
  "Found a footprint. Mine, from yesterday.",
  "The tide went further out than usual. Nothing under it but more sand.",
  "A bird sat on the ridge for an hour, then left without doing anything.",
  "Tried to remember the name of my street. Got it on the third go.",
  "Rearranged the crate. It is not better, but it is different.",
  "The fire made a sound like a word.",
  "Something moved far out. Too big to be a fish. Probably a fish.",
  "Slept badly. Dreamt of a corridor.",
  "Watched the light go orange and then go. Same as yesterday. Not tired of it.",
  "Wrote my name in the sand. The tide took it. Fair enough.",
  "There is a rock that looks like a face if you stand in the right place.",
  "Hummed something for an hour before working out what it was.",
  "A crab watched me eat. I let it.",
  "The horizon was perfectly flat today. No line at all between sky and sea.",
  "Counted to a thousand for no reason. Lost my place at six hundred.",
  "Found a shell worth keeping. Kept it. Lost it.",
  "My shadow was longer than the beach this evening.",
  "Talked out loud for a while. Stopped when I noticed.",
  "The palms sound different when it is about to rain.",
  "Nothing happened today. Writing that down anyway.",
  "Saw a plane. Very high, very slow. Did not wave.",
  "The water was warm as a bath and I stayed in too long.",
  "Learned to sleep through the noise. Not sure that is good.",
  "A moth got into the shelter and would not leave. Company, I suppose.",
  "The moon came up the colour of a tooth.",
  "Thought about the last thing I said to anyone. It was about parking.",
] as const;

/** Wall-clock spacing between idle diary entries. */
export const DIARY_IDLE_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** Drop diary entries older than this. */
export const DIARY_RETENTION_MS = 72 * 60 * 60 * 1000;
