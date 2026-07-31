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
  kind: ActivityKind;
  startedAt: number;
  endsAt: number;
  durationId?: DurationId;
  tool?: CutTool;
  recipeId?: RecipeId;
  /** Item being cooked (raw id). */
  cookItemId?: string;
  cookSlotIndex?: number;
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
  built: "none" | "simple";
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
  pendingResults: PendingResults | null;
  /** Incoming haul that does not fit — player must choose. */
  pendingOverflow: PendingOverflow | null;
  collectedTickIndex: number | null;
  /** @deprecated use fireplace.built — kept during migrate */
  fireplaceBuilt?: "none" | "simple";
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
    activity: raw.activity ?? null,
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
  };
}

export function loadOrCreate(now = Date.now()): SaveState {
  const existing = loadSave();
  if (existing) return existing;
  const fresh = createNewRun(now);
  writeSave(fresh);
  return fresh;
}
