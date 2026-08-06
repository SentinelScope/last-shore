/**
 * Shore Log — diary entries written into the save.
 * No timestamps are ever shown; `at` is only for retention.
 */

import {
  ACTIVITY_DURATIONS,
  DIARY_IDLE_INTERVAL_MS,
  DIARY_IDLE_OBSERVATIONS,
  DIARY_OMEN_BEGIN,
  DIARY_RETENTION_MS,
  LOOT_POOLS,
  WATER_CAPACITY,
  type ActivityKind,
  type ContainerTier,
  type DurationId,
} from "./balance";
import { documentNumber } from "./documents";
import { ITEMS } from "./items";
import type { InventorySlot, SaveState } from "./persist";
import { rngFor } from "./rng";
import { dayNumber, tickIndexAt } from "./time";
import { currentWaterFill } from "./water";
import { weatherAt } from "./weather";

export type DiaryStat = "water" | "food" | "health" | "comfort";
export type DiaryKind =
  | "activity"
  | "water_full"
  | "idle"
  | "chest"
  | "very_rare"
  | "ailment";

export type DiaryDelta = {
  stat: DiaryStat;
  amount: number;
};

export type DiaryEntry = {
  id: string;
  dayNumber: number;
  text: string;
  deltas: DiaryDelta[];
  kind: DiaryKind;
  /** Wall-clock ms when written — never rendered. */
  at: number;
};

const VERY_RARE = new Set<string>(LOOT_POOLS.very_rare);

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  12: "twelve",
  15: "fifteen",
  18: "eighteen",
  20: "twenty",
  27: "twenty-seven",
};

function wordNumber(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function shuffleIndices(rng: () => number, n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function itemNoun(itemId: string, qty: number): string {
  const name = (ITEMS[itemId]?.name ?? itemId.replace(/_/g, " ")).toLowerCase();
  if (itemId === "plant_fiber") {
    return qty === 1 ? "a good length of fibre" : `${wordNumber(qty)} lengths of fibre`;
  }
  if (itemId === "wood") {
    return qty === 1 ? "one wood" : `${wordNumber(qty)} wood`;
  }
  if (qty === 1) {
    if (/^[aeiou]/i.test(name)) return `an ${name}`;
    return `a ${name}`;
  }
  // crude plurals for common haul nouns
  if (name.endsWith("s")) return `${wordNumber(qty)} ${name}`;
  if (name.endsWith("y") && !/[aeiou]y$/i.test(name)) {
    return `${wordNumber(qty)} ${name.slice(0, -1)}ies`;
  }
  return `${wordNumber(qty)} ${name}s`;
}

function formatHaul(slots: InventorySlot[]): string {
  if (slots.length === 0) return "nothing worth keeping";
  const parts = slots.map((s) => itemNoun(s.itemId, s.qty));
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function durationMinutes(durationId: DurationId): number {
  return Math.round(ACTIVITY_DURATIONS[durationId].ms / 60_000);
}

function durationPhrase(durationId: DurationId): string {
  const m = durationMinutes(durationId);
  if (m === 1) return "a minute";
  if (m === 60) return "an hour";
  return `${wordNumber(m)} minutes`;
}

function Capital(s: string): string {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

function newId(seed: string, kind: string, at: number): string {
  return `${kind}-${at}-${tickIndexAt(at)}-${seed.slice(0, 6)}`;
}

export function pruneDiary(
  entries: DiaryEntry[],
  now: number,
): DiaryEntry[] {
  const cutoff = now - DIARY_RETENTION_MS;
  return entries.filter((e) => e.at >= cutoff);
}

export function appendDiaryEntry(
  state: SaveState,
  entry: Omit<DiaryEntry, "id"> & { id?: string },
): SaveState {
  const full: DiaryEntry = {
    ...entry,
    id: entry.id ?? newId(state.seed, entry.kind, entry.at),
  };
  const diary = pruneDiary([full, ...(state.diary ?? [])], entry.at);
  return { ...state, diary };
}

function ensureIdleQueue(state: SaveState, at: number): number[] {
  const existing = state.diaryIdleRemaining;
  if (existing && existing.length > 0) return existing;
  const rng = rngFor(state.seed, "diary-idle-shuffle", tickIndexAt(at));
  return shuffleIndices(rng, DIARY_IDLE_OBSERVATIONS.length);
}

function scourText(
  rng: () => number,
  durationId: DurationId,
  haul: string,
  lost: InventorySlot[],
): string {
  const dur = durationPhrase(durationId);
  const openings = [
    () => `Walked the tideline for ${dur}. ${Capital(haul)}.`,
    () => `Scoured the shore for ${dur}. Came back with ${haul}.`,
    () => `${Capital(dur)} along the tideline. ${Capital(haul)}.`,
    () => `Bent over the wet sand for ${dur}. ${Capital(haul)}.`,
    () => `The sea left what it left. ${Capital(dur)} of looking: ${haul}.`,
    () => `Tide work, ${dur}. ${Capital(haul)}.`,
    () => `Combed the beach for ${dur} and found ${haul}.`,
    () => `Down at the waterline for ${dur}. ${Capital(haul)}.`,
    () => `Picked through the wrack for ${dur}. ${Capital(haul)}.`,
  ];
  let text = pick(rng, openings)();
  if (lost.length > 0) {
    text += ` Left ${formatHaul(lost)} behind — nowhere to put it.`;
  }
  return text;
}

function cutText(
  rng: () => number,
  durationId: DurationId,
  haul: string,
  lost: InventorySlot[],
  kept: InventorySlot[],
): string {
  const dur = durationPhrase(durationId);
  const hasFibre = kept.some((k) => k.itemId === "plant_fiber");
  const openings = hasFibre
    ? [
        () =>
          `${Capital(dur)} at the palms. Stripped husk and fibre from the felled trunks. ${Capital(haul)}.`,
        () =>
          `Cut for ${dur}. Husk peeled back, fibre wound off the wood. ${Capital(haul)}.`,
        () =>
          `Worked the grove for ${dur}. Brought back ${haul} — fibre stripped from the cut palms.`,
        () =>
          `The trunks gave ${haul} after ${dur}. Fibre came free with the bark.`,
        () =>
          `Axe and patience, ${dur}. ${Capital(haul)}, husk and fibre included.`,
        () =>
          `Stood under the palms for ${dur}. ${Capital(haul)}. Stripped what fibre the trunks would give.`,
      ]
    : [
        () => `${Capital(dur)} at the palms. ${Capital(haul)}.`,
        () => `Cut for ${dur}. ${Capital(haul)}.`,
        () => `Worked the grove for ${dur}. Brought back ${haul}.`,
        () => `The trunks gave ${haul} after ${dur}.`,
        () => `Axe and patience, ${dur}. ${Capital(haul)}.`,
        () => `Stood under the palms for ${dur}. ${Capital(haul)}.`,
        () => `Wood duty, ${dur}. ${Capital(haul)}.`,
        () => `Hacked until the arms shook — ${dur}. ${Capital(haul)}.`,
        () => `${Capital(dur)} among the four trunks. ${Capital(haul)}.`,
      ];
  let text = pick(rng, openings)();
  if (lost.length > 0) {
    text += ` Could not carry ${formatHaul(lost)}.`;
  }
  return text;
}

function craftText(
  rng: () => number,
  recipeName: string,
  kept: InventorySlot[],
  lost: InventorySlot[],
): string {
  const name = recipeName.toLowerCase();
  const openings = [
    () => `Finished the ${name}.`,
    () => `Made a ${name}. Hands still smell of fibre.`,
    () => `The ${name} is done. It will have to be enough.`,
    () => `Put the last lashing on the ${name}.`,
    () => `Spent the hours on a ${name}. Done.`,
    () => `Crafted a ${name} before the light changed.`,
    () => `Another thing made: a ${name}.`,
    () => `Worked until the ${name} held together.`,
  ];
  let text = pick(rng, openings)();
  if (kept.length > 0) text += ` ${Capital(formatHaul(kept))}.`;
  if (lost.length > 0) {
    text += ` No room for ${formatHaul(lost)}.`;
  }
  return text;
}

function storageUpgradeText(
  rng: () => number,
  name: string,
  slots: number,
): string {
  const n = name.toLowerCase();
  const openings = [
    () => `Finished the ${n}. ${Capital(numWord(slots))} things now, instead of ${numWord(slots - 4)}.`,
    () =>
      slots === 12
        ? `Finished the satchel. Twelve things now, instead of eight.`
        : slots === 16
          ? `The crate holds sixteen. That is four more decisions I do not have to make.`
          : `The storage box takes twenty. Room enough to stop choosing what to leave.`,
    () =>
      `Built the ${n}. ${Capital(numWord(slots))} slots where there were ${numWord(slots - 4)}.`,
    () =>
      `The ${n} is done. Capacity: ${slots}. That is the whole point.`,
    () =>
      `Switched to the ${n}. ${slots} places to put a thing.`,
    () =>
      `Finished upgrading. ${Capital(numWord(slots))} slots now.`,
  ];
  return pick(rng, openings)();
}

function numWord(n: number): string {
  const words: Record<number, string> = {
    8: "eight",
    12: "twelve",
    16: "sixteen",
    20: "twenty",
  };
  return words[n] ?? String(n);
}

function cookText(
  rng: () => number,
  cookedId: string,
): string {
  const name = (ITEMS[cookedId]?.name ?? cookedId.replace(/_/g, " ")).toLowerCase();
  const openings = [
    () => `${Capital(name)} off the coals.`,
    () => `Cooked ${name}. The smell stayed in the clothes.`,
    () => `Fire did its work. ${Capital(name)}.`,
    () => `Turned ${name} until it was done.`,
    () => `A proper meal, after a fashion: ${name}.`,
    () => `Watched ${name} go from raw to ready.`,
    () => `Cooking took the edge off the day. ${Capital(name)}.`,
    () => `Hot food. ${Capital(name)}.`,
  ];
  return pick(rng, openings)();
}

function fishToolPhrase(toolId: string): string {
  return (ITEMS[toolId]?.name ?? toolId.replace(/_/g, " ")).toLowerCase();
}

function fishBreakLine(toolId: string): string {
  const name = fishToolPhrase(toolId);
  if (toolId === "wooden_spear") {
    return " The wooden spear finally gave out. It had one more fish in it than I expected.";
  }
  if (toolId === "stone_spear") {
    return " The stone spear split on the way home.";
  }
  if (toolId === "fishing_rod") {
    return " The rod gave out on the walk back. Eighty casts was generous.";
  }
  return ` The ${name} finally gave out.`;
}

function fishText(
  rng: () => number,
  durationId: DurationId,
  toolId: string,
  kept: InventorySlot[],
  lost: InventorySlot[],
  toolBroke: boolean,
): string {
  const dur = durationPhrase(durationId);
  const tool = fishToolPhrase(toolId);
  const empty = kept.length === 0 && lost.length === 0;
  const haul = formatHaul([...kept, ...lost]);

  const emptyOpenings = [
    () => `Nothing. Stood there ${dur} and the sea kept it all.`,
    () => `${Capital(dur)} in the shallows with the ${tool}. Empty hands.`,
    () => `Took the ${tool} out. ${Capital(dur)} of waiting — nothing bit.`,
    () => `The drop-off gave nothing. ${Capital(dur)} wasted, or nearly.`,
    () => `Cast and waited for ${dur}. The sea owed me nothing today.`,
    () => `Quiet water for ${dur}. Came back with nothing.`,
    () => `${Capital(dur)} on the line. Not a pull worth keeping.`,
    () => `Stood in the shallows ${dur}. Left empty.`,
  ];

  const haulOpenings = [
    () =>
      `${Capital(dur)} on the line. ${Capital(haul)}.`,
    () =>
      `Took the ${tool} out to the shallows. ${Capital(haul)}.`,
    () =>
      `Worked the drop-off for ${dur} with the ${tool}. ${Capital(haul)}.`,
    () =>
      `${Capital(dur)} in the wet. ${Capital(haul)}.`,
    () =>
      `Fished with the ${tool} for ${dur}. Came back with ${haul}.`,
    () =>
      `The shallows answered after ${dur}: ${haul}.`,
    () =>
      `Patience and the ${tool}, ${dur}. ${Capital(haul)}.`,
    () =>
      `Out to where the sand falls away. ${Capital(dur)}. ${Capital(haul)}.`,
    () =>
      `Stood in the cool for ${dur}. ${Capital(haul)}.`,
  ];

  let text = empty
    ? pick(rng, emptyOpenings)()
    : pick(rng, haulOpenings)();
  if (lost.length > 0) {
    text += ` Left ${formatHaul(lost)} behind — nowhere to put it.`;
  }
  if (toolBroke) {
    text += fishBreakLine(toolId);
  }
  return text;
}

export function writeActivityDiary(
  state: SaveState,
  args: {
    kind: ActivityKind;
    durationId?: DurationId;
    recipeName?: string;
    /** When set, diary uses storage-upgrade lines (no deltas). */
    storageSlots?: number;
    cookItemId?: string;
    toolId?: string;
    toolBroke?: boolean;
    kept: InventorySlot[];
    lost: InventorySlot[];
    at: number;
  },
): SaveState {
  const rng = rngFor(state.seed, "diary-activity", tickIndexAt(args.at));
  const haul = formatHaul([...args.kept, ...args.lost]);
  let text: string;

  if (args.kind === "scour" && args.durationId) {
    text = scourText(rng, args.durationId, haul, args.lost);
  } else if (args.kind === "cut" && args.durationId) {
    text = cutText(rng, args.durationId, haul, args.lost, args.kept);
  } else if (args.kind === "fish" && args.durationId && args.toolId) {
    text = fishText(
      rng,
      args.durationId,
      args.toolId,
      args.kept,
      args.lost,
      !!args.toolBroke,
    );
  } else if (args.kind === "craft" && args.storageSlots != null) {
    text = storageUpgradeText(
      rng,
      args.recipeName ?? "store",
      args.storageSlots,
    );
  } else if (args.kind === "craft") {
    text = craftText(rng, args.recipeName ?? "thing", args.kept, args.lost);
  } else if (args.kind === "cook" && args.cookItemId) {
    text = cookText(rng, args.cookItemId);
  } else {
    text = `Finished the work. ${Capital(haul)}.`;
  }

  return appendDiaryEntry(state, {
    dayNumber: dayNumber(state.runStartedAt, args.at),
    text,
    deltas: [],
    kind: "activity",
    at: args.at,
  });
}

const WATER_FULL_LINES: Record<string, string[]> = {
  empty_can: [
    "Rain found the can. Full, if you can call this full.",
    "The little can brimmed over. Not much, but it is something.",
  ],
  cup: [
    "Rain all afternoon. The cup is full to the brim.",
    "Left the cup out. Came back to it full.",
    "The cup took all it could. Brimming.",
  ],
  coconut_cup: [
    "The coconut shell filled while I was gone.",
    "Shell full of rain. Almost too careful to move.",
  ],
  bottle: [
    "The bottle is full. Heavier than it looks.",
    "Rain through the night. Bottle topped off.",
  ],
  canister: [
    "The storm gave more than it took. Canister full.",
    "Canister full to the shoulder. This changes the next days.",
    "Every drop found the canister. It is full.",
  ],
};

export function maybeWriteWaterFullDiary(
  state: SaveState,
  now: number,
): SaveState {
  const spot = state.waterSpot;
  if (!spot?.itemId) {
    return state.diaryWaterFullNoted
      ? { ...state, diaryWaterFullNoted: false }
      : state;
  }

  const fill = currentWaterFill(state, now);
  if (fill < 100) {
    return state.diaryWaterFullNoted
      ? { ...state, diaryWaterFullNoted: false }
      : state;
  }
  if (state.diaryWaterFullNoted) return state;

  const cap = WATER_CAPACITY[spot.itemId] ?? 25;
  const rng = rngFor(state.seed, "diary-water", tickIndexAt(now));
  const weather = weatherAt(state.seed, state.runStartedAt, now);
  const pool =
    WATER_FULL_LINES[spot.itemId] ??
    WATER_FULL_LINES.cup!;
  let text = pick(rng, pool);
  if (weather === "storm" && spot.itemId !== "canister" && rng() < 0.4) {
    text = "Storm rain. The container is full.";
  } else if (weather === "rain" && rng() < 0.3) {
    text = "Soft rain for hours. Full to the brim.";
  }

  const next = appendDiaryEntry(state, {
    dayNumber: dayNumber(state.runStartedAt, now),
    text,
    deltas: [{ stat: "water", amount: cap }],
    kind: "water_full",
    at: now,
  });
  return { ...next, diaryWaterFullNoted: true };
}

/** When Omen weather begins — no deltas. */
export function maybeWriteOmenDiary(state: SaveState, at: number): SaveState {
  const rng = rngFor(state.seed, "diary-omen", tickIndexAt(at));
  const text = pick(rng, DIARY_OMEN_BEGIN);
  return appendDiaryEntry(state, {
    id: newId(state.seed, "omen", at),
    dayNumber: dayNumber(state.runStartedAt, at),
    text,
    deltas: [],
    kind: "activity",
    at,
  });
}

export function maybeWriteIdleDiary(
  state: SaveState,
  now: number,
): SaveState {
  let s = state;
  let last = s.diaryLastIdleAt ?? s.runStartedAt;
  // Cap catch-up idle spam: at most a few per catchUp call via loop
  let guard = 0;
  while (last + DIARY_IDLE_INTERVAL_MS <= now && guard < 8) {
    const at = last + DIARY_IDLE_INTERVAL_MS;
    let queue = ensureIdleQueue(s, at);
    const idx = queue[0]!;
    queue = queue.slice(1);
    const text = DIARY_IDLE_OBSERVATIONS[idx]!;
    s = appendDiaryEntry(
      { ...s, diaryIdleRemaining: queue, diaryLastIdleAt: at },
      {
        dayNumber: dayNumber(s.runStartedAt, at),
        text,
        deltas: [],
        kind: "idle",
        at,
      },
    );
    last = at;
    guard += 1;
  }
  return s;
}

const CHEST_LINES = [
  "Something heavy came in on the tide. Iron bands, and a lock that gave up years ago.",
  "A chest on the sand, half buried. The lock was rust and memory.",
  "Washed up sealed. I broke it open. The sea had kept it for someone else.",
  "Iron and wood and a smell like old attics. A chest, against all sense.",
  "The tide left a chest. I sat with it a while before I opened it.",
  "Bands, a broken hasp, sand in every seam. Whatever was inside had waited.",
] as const;

const VERY_RARE_LINES: Record<string, string[]> = {
  canister: [
    "A canister. Actually watertight. This changes things.",
    "Found a canister. The seal still holds. I almost laughed.",
  ],
  medicine_bottle: [
    "A medicine bottle. Four tablets left. Better than none.",
    "Glass and a faded label. Medicine, if the label can be trusted.",
  ],
  voice_recorder: [
    "A voice recorder. The last message is someone humming.",
    "Found a recorder. Pressed play. Wish I had not, and glad I did.",
  ],
  volleyball: [
    "A volleyball. Soft from the salt. Company of a sort.",
    "Washed-up volleyball. I named it and then felt foolish.",
  ],
  treasure_map: [
    "A treasure map. Or a joke that survived the water.",
    "Found a map. The X is inland. There is no inland.",
  ],
  sneakers: [
    "A pair of sneakers. One size too small. Still better than bare feet.",
    "Sneakers in the wrack. Worn, but they fit well enough.",
  ],
  sunglasses: [
    "Sunglasses. The world looks less bright and somehow kinder.",
    "Found sunglasses. Put them on. Kept them on.",
  ],
  wristwatch: [
    "Found a wristwatch in the sand. Still going. Somebody wound it recently enough.",
    "A wristwatch, ticking. Time again, whether I want it or not.",
  ],
  compass: [
    "A compass. The needle settles on the sea and stays there.",
    "Found a compass. North is out there. I already knew.",
  ],
};

export function writeContainerDiary(
  state: SaveState,
  args: {
    tier: ContainerTier;
    kept: InventorySlot[];
    at: number;
  },
): SaveState {
  let s = state;
  const rng = rngFor(state.seed, "diary-chest", tickIndexAt(args.at));

  if (args.tier === "chest") {
    s = appendDiaryEntry(s, {
      dayNumber: dayNumber(s.runStartedAt, args.at),
      text: pick(rng, CHEST_LINES),
      deltas: [],
      kind: "chest",
      at: args.at,
    });
  }

  let vrIndex = 0;
  for (const slot of args.kept) {
    if (!VERY_RARE.has(slot.itemId)) continue;
    const lines =
      VERY_RARE_LINES[slot.itemId] ??
      [
        `Found ${itemNoun(slot.itemId, 1)}. Rare enough to write down.`,
      ];
    const vrRng = rngFor(
      state.seed,
      `diary-vr-${slot.itemId}`,
      tickIndexAt(args.at),
    );
    s = appendDiaryEntry(s, {
      id: newId(state.seed, `very_rare-${vrIndex++}`, args.at),
      dayNumber: dayNumber(s.runStartedAt, args.at),
      text: pick(vrRng, lines),
      deltas: [],
      kind: "very_rare",
      at: args.at,
    });
  }

  return s;
}

/** After the overflow screen — something was left on the sand. */
export function writeLeftBehindDiary(
  state: SaveState,
  args: { left: InventorySlot[]; at: number },
): SaveState {
  if (args.left.length === 0) return state;
  const haul = formatHaul(args.left);
  const units = args.left.reduce((n, s) => n + s.qty, 0);
  const pronoun = units === 1 ? "it" : "them";
  const text = `Left ${haul} on the sand. There was nowhere to put ${pronoun}.`;
  return appendDiaryEntry(state, {
    id: newId(state.seed, "left-behind", args.at),
    dayNumber: dayNumber(state.runStartedAt, args.at),
    text,
    deltas: [],
    kind: "activity",
    at: args.at,
  });
}

/** Lighting the fire with a salvaged document page. */
export function writeBurnedDocumentDiary(
  state: SaveState,
  opts: { itemId: string; at: number },
): SaveState {
  const n = documentNumber(opts.itemId);
  if (n == null) return state;
  const rng = rngFor(state.seed, "diary-burn-doc", tickIndexAt(opts.at));
  const lines = [
    () =>
      `Burned Document #${n} to get the fire going. It was mostly about pigeons anyway.`,
    () =>
      `Document #${n} made decent tinder. The typed lines curled before I could finish them.`,
    () =>
      `Fed Document #${n} to the fire. Whatever committee wrote it can stay warm with me.`,
    () =>
      `Document #${n} went into the pit. Ash reads the same as classified ink.`,
    () =>
      `Lit the fire with Document #${n}. Paper is paper when the night is this cold.`,
    () =>
      `Burned Document #${n}. If it mattered, it should have stayed dry.`,
  ];
  return appendDiaryEntry(state, {
    id: newId(state.seed, "burn-doc", opts.at),
    dayNumber: dayNumber(state.runStartedAt, opts.at),
    text: pick(rng, lines)(),
    deltas: [],
    kind: "activity",
    at: opts.at,
  });
}

/** Group newest-first entries under Day N headings. */
export function groupDiaryByDay(
  entries: DiaryEntry[],
): { dayNumber: number; entries: DiaryEntry[] }[] {
  const groups: { dayNumber: number; entries: DiaryEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.dayNumber === entry.dayNumber) {
      last.entries.push(entry);
    } else {
      groups.push({ dayNumber: entry.dayNumber, entries: [entry] });
    }
  }
  return groups;
}

export function deltaClass(stat: DiaryStat): string {
  if (stat === "health") return "hp";
  if (stat === "comfort") return "comf";
  return stat;
}

export function deltaLabel(stat: DiaryStat): string {
  if (stat === "health") return "Health";
  if (stat === "comfort") return "Comfort";
  if (stat === "food") return "Food";
  return "Water";
}
