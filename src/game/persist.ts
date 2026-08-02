import {
  SAVE_KEY,
  STARTING_INVENTORY,
  type ActivityKind,
  type CutTool,
  type DurationId,
  type RecipeId,
  type StorageTierId,
  type ShelterTierId,
} from "./balance";
import type { DiaryEntry } from "./diary";
import { makeSeed } from "./rng";
import { emptyToolRack } from "./tools";

export type InventorySlot = {
  itemId: string;
  qty: number;
  /** Remaining uses for tools / ignition items. */
  durability?: number;
};

export type ActiveAilment = {
  id: "cut_finger" | "twisted_ankle" | "heatstroke" | "cold";
  startedAt: number;
  endsAt: number;
};

export type WornGear = {
  head: string | null;
  body: string | null;
  legs: string | null;
  feet: string | null;
};

export type ActiveActivity = {
  kind: Exclude<ActivityKind, "cook">;
  startedAt: number;
  endsAt: number;
  durationId?: DurationId;
  tool?: CutTool;
  recipeId?: RecipeId;
};

/** Unattended cook on the fire — independent of the player activity channel. */
export type FireActivity = {
  kind: "cook";
  cookItemId: string;
  cookSlotIndex: number;
  startedAt: number;
  endsAt: number;
  /** Set while the fire is out; cook clock is frozen until relit. */
  pausedAt: number | null;
};

export type PendingResults = {
  title: string;
  kept: InventorySlot[];
  lost: InventorySlot[];
  resolvedAt: number;
};

/** Haul waiting on the overflow screen — not yet in inventory. */
export type PendingOverflow = {
  title: string;
  eyebrow: "Washed up" | "Found";
  incoming: InventorySlot[];
};

export type WaterSpot = {
  itemId: string | null;
  placedAt: number;
  drunkPercent: number;
};

export type FireplaceSlots = {
  ignition: InventorySlot | null;
  tinder: InventorySlot | null;
  /** Whole wood count in the fuel slot (0–12). */
  fuelWood: number;
  /** Food slots; index 1 only used when a pan is in slot 0. */
  food: (InventorySlot | null)[];
};

export type FireplaceState = {
  built: "none" | "simple" | "stone" | "cooking";
  lit: boolean;
  /** Last wall-clock sync for fuel burn / storm check. */
  syncedAt: number;
  slots: FireplaceSlots;
};

export type SaveState = {
  version: 1;
  seed: string;
  runStartedAt: number;
  /** Wall-clock cursor for vitals / fire / activity catch-up. */
  lastSimulatedAt: number;
  thirst: number;
  hunger: number;
  health: number;
  /** Display only — recomputed each sim step from sources + weather. */
  comfort: number;
  storageTier: StorageTierId;
  inventory: InventorySlot[];
  activity: ActiveActivity | null;
  /** Cooking on the fire — runs beside player activities. */
  fireActivity: FireActivity | null;
  pendingResults: PendingResults | null;
  /** Incoming haul that does not fit — player must choose. */
  pendingOverflow: PendingOverflow | null;
  collectedTickIndex: number | null;
  /** @deprecated use fireplace.built — kept during migrate */
  fireplaceBuilt?: "none" | "simple" | "stone" | "cooking";
  fireplace: FireplaceState;
  waterSpot: WaterSpot;
  shelterTier: ShelterTierId;
  /** Comfort items on display in the shelter (up to 3; unused = null). */
  shelterDecor: (string | null)[];
  bedTier: "none" | "mat";
  hasLogChair: boolean;
  /** Shore Log entries, newest first. */
  diary: DiaryEntry[];
  /** Remaining idle observation indices (no repeat until reshuffle). */
  diaryIdleRemaining: number[];
  /** Wall-clock ms of last idle diary entry (or run start). */
  diaryLastIdleAt: number;
  /** True after logging a brim-full water entry until fill drops. */
  diaryWaterFullNoted: boolean;
  /** Active ailments (lightning never persists — it ends the run). */
  ailments: ActiveAilment[];
  /** Equipped clothing by body slot. */
  worn: WornGear;
  /** Document numbers found and not burned (1–9). */
  recoveredDocuments: number[];
  /** Document numbers read at least once — permanent, survives burns. */
  documentsRead: number[];
  /** Built the Tool Rack (separate from storage tier). */
  hasToolRack: boolean;
  /** Up to three tools living on the rack. */
  toolRack: (InventorySlot | null)[];
};

export function emptyFireplace(): FireplaceState {
  return {
    built: "none",
    lit: false,
    syncedAt: 0,
    slots: {
      ignition: null,
      tinder: null,
      fuelWood: 0,
      food: [null],
    },
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function migrate(raw: SaveState): SaveState {
  const legacyBuilt = raw.fireplaceBuilt ?? "none";
  const fireplace = raw.fireplace
    ? {
        ...emptyFireplace(),
        ...raw.fireplace,
        built: raw.fireplace.built ?? legacyBuilt,
        slots: {
          ...emptyFireplace().slots,
          ...raw.fireplace.slots,
          food: raw.fireplace.slots?.food?.length
            ? raw.fireplace.slots.food
            : [null],
        },
      }
    : { ...emptyFireplace(), built: legacyBuilt };

  return {
    ...raw,
    lastSimulatedAt: raw.lastSimulatedAt ?? raw.runStartedAt,
    storageTier: raw.storageTier ?? "sand",
    inventory:
      raw.inventory && raw.inventory.length > 0
        ? raw.inventory
        : STARTING_INVENTORY.map((s) => ({ ...s })),
    activity: (() => {
      const a = raw.activity as
        | {
            kind: string;
            startedAt: number;
            endsAt: number;
            durationId?: DurationId;
            tool?: CutTool;
            recipeId?: RecipeId;
            cookItemId?: string;
            cookSlotIndex?: number;
          }
        | null
        | undefined;
      if (!a || a.kind === "cook") return null;
      return a as ActiveActivity;
    })(),
    fireActivity: (() => {
      if (raw.fireActivity) {
        return {
          ...raw.fireActivity,
          pausedAt: raw.fireActivity.pausedAt ?? null,
        };
      }
      const a = raw.activity as
        | {
            kind: string;
            cookItemId?: string;
            cookSlotIndex?: number;
            startedAt: number;
            endsAt: number;
          }
        | null
        | undefined;
      if (a?.kind === "cook" && a.cookItemId) {
        return {
          kind: "cook" as const,
          cookItemId: a.cookItemId,
          cookSlotIndex: a.cookSlotIndex ?? 0,
          startedAt: a.startedAt,
          endsAt: a.endsAt,
          pausedAt: null,
        };
      }
      return null;
    })(),
    pendingResults: raw.pendingResults ?? null,
    pendingOverflow: raw.pendingOverflow ?? null,
    collectedTickIndex: raw.collectedTickIndex ?? null,
    fireplace,
    waterSpot: raw.waterSpot
      ? {
          itemId: raw.waterSpot.itemId ?? null,
          placedAt: raw.waterSpot.placedAt ?? 0,
          drunkPercent: raw.waterSpot.drunkPercent ?? 0,
        }
      : { itemId: null, placedAt: 0, drunkPercent: 0 },
    shelterTier: (raw.shelterTier as ShelterTierId) ?? "none",
    shelterDecor: Array.isArray(raw.shelterDecor)
      ? [raw.shelterDecor[0] ?? null, raw.shelterDecor[1] ?? null, raw.shelterDecor[2] ?? null]
      : [null, null, null],
    bedTier: raw.bedTier ?? "none",
    hasLogChair: raw.hasLogChair ?? false,
    diary: Array.isArray(raw.diary) ? raw.diary : [],
    diaryIdleRemaining: Array.isArray(raw.diaryIdleRemaining)
      ? raw.diaryIdleRemaining
      : [],
    // Missing field → anchor to last sim so catch-up does not backfill idles.
    diaryLastIdleAt:
      raw.diaryLastIdleAt ??
      raw.lastSimulatedAt ??
      raw.runStartedAt,
    diaryWaterFullNoted: raw.diaryWaterFullNoted ?? false,
    ailments: Array.isArray(raw.ailments) ? raw.ailments : [],
    worn: raw.worn
      ? {
          head: raw.worn.head ?? null,
          body: raw.worn.body ?? null,
          legs: raw.worn.legs ?? null,
          feet: raw.worn.feet ?? null,
        }
      : { head: null, body: null, legs: null, feet: null },
    recoveredDocuments: Array.isArray(raw.recoveredDocuments)
      ? raw.recoveredDocuments.filter(
          (n): n is number => typeof n === "number" && n >= 1 && n <= 9,
        )
      : [],
    documentsRead: Array.isArray(raw.documentsRead)
      ? raw.documentsRead.filter(
          (n): n is number => typeof n === "number" && n >= 1 && n <= 9,
        )
      : [],
    hasToolRack: raw.hasToolRack ?? false,
    toolRack: Array.isArray(raw.toolRack)
      ? [0, 1, 2].map((i) => {
          const s = raw.toolRack![i];
          if (!s || typeof s.itemId !== "string") return null;
          return {
            itemId: s.itemId,
            qty: 1,
            durability: s.durability,
          };
        })
      : emptyToolRack(),
  };
}

export function loadSave(): SaveState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveState;
    if (parsed.version !== 1 || !parsed.seed) return null;
    return migrate(parsed);
  } catch {
    return null;
  }
}

export function writeSave(state: SaveState): void {
  if (!canUseStorage()) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSave(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(SAVE_KEY);
}

export function createNewRun(now = Date.now()): SaveState {
  return {
    version: 1,
    seed: makeSeed(),
    runStartedAt: now,
    lastSimulatedAt: now,
    thirst: 100,
    hunger: 100,
    health: 100,
    comfort: 0,
    storageTier: "sand",
    inventory: STARTING_INVENTORY.map((s) => ({ ...s })),
    activity: null,
    fireActivity: null,
    pendingResults: null,
    pendingOverflow: null,
    collectedTickIndex: null,
    fireplace: emptyFireplace(),
    waterSpot: {
      itemId: null,
      placedAt: 0,
      drunkPercent: 0,
    },
    shelterTier: "none",
    shelterDecor: [null, null, null],
    bedTier: "none",
    hasLogChair: false,
    diary: [],
    diaryIdleRemaining: [],
    diaryLastIdleAt: now,
    diaryWaterFullNoted: false,
    ailments: [],
    worn: { head: null, body: null, legs: null, feet: null },
    recoveredDocuments: [],
    documentsRead: [],
    hasToolRack: false,
    toolRack: emptyToolRack(),
  };
}

export function loadOrCreate(now = Date.now()): SaveState {
  const existing = loadSave();
  if (existing) return existing;
  const fresh = createNewRun(now);
  writeSave(fresh);
  return fresh;
}
