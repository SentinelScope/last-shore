import {
  ACTIVITY_DURATIONS,
  ACTIVITY_LABEL,
  COOK_RESULT,
  CUT_YIELD,
  RECIPES,
  SCOUR_TABLE,
  type ActivityKind,
  type CutTool,
  type DurationId,
  type RecipeId,
  type ScourLootId,
} from "./balance";
import { writeActivityDiary } from "./diary";
import { syncFireplace } from "./fire";
import {
  hasItem,
  mergeLoot,
  missingCosts,
  placeLoot,
  removeItems,
  type LootPile,
} from "./inventory";
import { lootFits, makeOverflow } from "./overflow";
import type {
  ActiveActivity,
  PendingResults,
  SaveState,
} from "./persist";
import { rngFor, weightedPick } from "./rng";
import { tickIndexAt } from "./time";

export function bestCutTool(inventory: SaveState["inventory"]): CutTool | null {
  if (hasItem(inventory, "metal_axe")) return "metal_axe";
  if (hasItem(inventory, "stone_axe")) return "stone_axe";
  if (hasItem(inventory, "stone")) return "bare";
  return null;
}

export function canStartActivity(
  state: SaveState,
  kind: ActivityKind,
): { ok: true } | { ok: false; reason: string } {
  if (state.activity) {
    return {
      ok: false,
      reason: `Already ${ACTIVITY_LABEL[state.activity.kind].toLowerCase()}.`,
    };
  }
  if (kind === "cut") {
    if (!bestCutTool(state.inventory)) {
      return { ok: false, reason: "Needs a stone in your inventory." };
    }
  }
  return { ok: true };
}

export function startActivity(
  state: SaveState,
  kind: "scour" | "cut",
  durationId: DurationId,
  now: number,
): SaveState {
  const gate = canStartActivity(state, kind);
  if (!gate.ok) return state;

  const tool = kind === "cut" ? bestCutTool(state.inventory)! : undefined;
  const duration = ACTIVITY_DURATIONS[durationId];
  const activity: ActiveActivity = {
    kind,
    durationId,
    startedAt: now,
    endsAt: now + duration.ms,
    tool,
  };

  return { ...state, activity };
}

export function canStartCraft(
  state: SaveState,
  recipeId: RecipeId,
): { ok: true } | { ok: false; reason: string } {
  const busy = canStartActivity(state, "craft");
  if (!busy.ok) return busy;
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, reason: "Unknown recipe." };
  if (
    recipe.effect === "simple_fireplace" &&
    state.fireplace.built !== "none"
  ) {
    return { ok: false, reason: "Fireplace already built." };
  }
  if (recipe.effect === "satchel" && state.storageTier !== "sand") {
    return { ok: false, reason: "Already using a better store." };
  }
  if (recipe.effect === "mat" && state.bedTier !== "none") {
    return { ok: false, reason: "Already have a mat." };
  }
  if (recipe.effect === "log_chair" && state.hasLogChair) {
    return { ok: false, reason: "Already have a chair." };
  }
  if (recipe.effect === "lean_to" && state.shelterTier !== "none") {
    return { ok: false, reason: "Shelter already built." };
  }
  if (recipe.effect === "walled" && state.shelterTier !== "lean_to") {
    return {
      ok: false,
      reason:
        state.shelterTier === "none"
          ? "Build a lean-to first."
          : "Already past a lean-to.",
    };
  }
  if (recipe.effect === "storm" && state.shelterTier !== "walled") {
    return {
      ok: false,
      reason:
        state.shelterTier === "storm"
          ? "Already storm-proof."
          : "Needs a walled shelter first.",
    };
  }
  if (recipe.tool && !hasItem(state.inventory, recipe.tool)) {
    const toolName = recipe.tool.replace(/_/g, " ");
    return { ok: false, reason: `Needs ${toolName}.` };
  }
  const missing = missingCosts(state.inventory, recipe.cost);
  if (missing.length > 0) {
    const parts = missing.map(
      (m) => `${m.need - m.have} more ${m.itemId.replace(/_/g, " ")}`,
    );
    return { ok: false, reason: `Need ${parts.join(", ")}.` };
  }
  return { ok: true };
}

/** Deducts materials immediately and starts the craft timer. */
export function startCraft(
  state: SaveState,
  recipeId: RecipeId,
  now: number,
): SaveState {
  const gate = canStartCraft(state, recipeId);
  if (!gate.ok) return state;
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
  const inventory = removeItems(state.inventory, recipe.cost);
  if (!inventory) return state;

  return {
    ...state,
    inventory,
    activity: {
      kind: "craft",
      recipeId,
      startedAt: now,
      endsAt: now + recipe.timeMs,
    },
  };
}

function rollScourLoot(
  seed: string,
  durationId: DurationId,
  startedAt: number,
): LootPile {
  const table = SCOUR_TABLE[durationId];
  const rng = rngFor(seed, "scour", tickIndexAt(startedAt));
  const count = 1 + Math.floor(rng() * table.maxItems);
  const items: ScourLootId[] = ["stone"];
  for (let i = 1; i < count; i++) {
    items.push(weightedPick(rng, table.weights));
  }
  return mergeLoot(items.map((itemId) => ({ itemId, qty: 1 })));
}

function rollCutLoot(tool: CutTool, durationId: DurationId): LootPile {
  return [{ itemId: "wood", qty: CUT_YIELD[tool][durationId] }];
}

export function rollActivityLoot(
  activity: ActiveActivity,
  seed: string,
): LootPile {
  if (activity.kind === "scour" && activity.durationId) {
    return rollScourLoot(seed, activity.durationId, activity.startedAt);
  }
  if (activity.kind === "cut" && activity.durationId) {
    return rollCutLoot(activity.tool ?? "bare", activity.durationId);
  }
  return [];
}

function resolveCraft(state: SaveState, now: number): SaveState {
  const activity = state.activity;
  if (!activity?.recipeId) return state;
  const recipe = RECIPES.find((r) => r.id === activity.recipeId);
  if (!recipe) {
    return { ...state, activity: null };
  }

  let inventory = state.inventory;
  let storageTier = state.storageTier;
  let fireplace = state.fireplace;
  let bedTier = state.bedTier;
  let hasLogChair = state.hasLogChair;
  let shelterTier = state.shelterTier;
  const kept: LootPile = [];
  const lost: LootPile = [];
  let pendingOverflow = state.pendingOverflow;

  if (recipe.result) {
    if (lootFits(inventory, storageTier, [recipe.result])) {
      const placed = placeLoot(inventory, storageTier, [recipe.result]);
      inventory = placed.inventory;
      kept.push(...placed.kept);
      lost.push(...placed.lost);
    } else {
      pendingOverflow = makeOverflow(
        `Crafted · ${recipe.name}`,
        "Found",
        [recipe.result],
      );
    }
  }

  if (recipe.effect === "satchel") {
    storageTier = "satchel";
  }
  if (recipe.effect === "simple_fireplace") {
    fireplace = {
      ...fireplace,
      built: "simple",
      syncedAt: now,
    };
  }
  if (recipe.effect === "mat") {
    bedTier = "mat";
  }
  if (recipe.effect === "log_chair") {
    hasLogChair = true;
  }
  if (recipe.effect === "lean_to") {
    shelterTier = "lean_to";
  }
  if (recipe.effect === "walled") {
    shelterTier = "walled";
  }
  if (recipe.effect === "storm") {
    shelterTier = "storm";
  }

  if (pendingOverflow && recipe.result) {
    const next: SaveState = {
      ...state,
      activity: null,
      inventory,
      storageTier,
      fireplace,
      bedTier,
      hasLogChair,
      shelterTier,
      pendingOverflow,
      pendingResults: null,
    };
    return writeActivityDiary(next, {
      kind: "craft",
      recipeName: recipe.name,
      kept: [recipe.result],
      lost: [],
      at: now,
    });
  }

  const pendingResults: PendingResults = {
    title: `Crafted · ${recipe.name}`,
    kept:
      kept.length > 0
        ? kept
        : recipe.effect
          ? [{ itemId: recipe.id, qty: 1 }]
          : [],
    lost,
    resolvedAt: now,
  };

  if (recipe.effect && !recipe.result) {
    pendingResults.kept = [];
  }

  const next: SaveState = {
    ...state,
    activity: null,
    inventory,
    storageTier,
    fireplace,
    bedTier,
    hasLogChair,
    shelterTier,
    pendingResults,
    pendingOverflow: null,
  };
  return writeActivityDiary(next, {
    kind: "craft",
    recipeName: recipe.name,
    kept: pendingResults.kept,
    lost,
    at: now,
  });
}

function resolveCook(state: SaveState, now: number): SaveState {
  const activity = state.activity;
  if (!activity?.cookItemId || activity.cookSlotIndex === undefined) {
    return { ...state, activity: null };
  }

  const synced = syncFireplace(state, now);
  const slotIndex = activity.cookSlotIndex;
  const foodSlots = [...synced.fireplace.slots.food];
  const current = foodSlots[slotIndex];
  if (!current || current.itemId !== activity.cookItemId) {
    return { ...synced, activity: null };
  }

  const resultId = COOK_RESULT[activity.cookItemId] ?? activity.cookItemId;
  foodSlots[slotIndex] = { itemId: resultId, qty: 1 };

  const next: SaveState = {
    ...synced,
    activity: null,
    fireplace: {
      ...synced.fireplace,
      slots: { ...synced.fireplace.slots, food: foodSlots },
    },
    pendingResults: {
      title: `Cooked · ${resultId.replace(/_/g, " ")}`,
      kept: [{ itemId: resultId, qty: 1 }],
      lost: [],
      resolvedAt: now,
    },
  };
  return writeActivityDiary(next, {
    kind: "cook",
    cookItemId: resultId,
    kept: [{ itemId: resultId, qty: 1 }],
    lost: [],
    at: now,
  });
}

export function resolveActivityIfDue(state: SaveState, now: number): SaveState {
  const activity = state.activity;
  if (!activity || now < activity.endsAt) return state;

  if (activity.kind === "craft") {
    return resolveCraft(state, now);
  }
  if (activity.kind === "cook") {
    return resolveCook(state, now);
  }

  const loot = rollActivityLoot(activity, state.seed);

  if (!lootFits(state.inventory, state.storageTier, loot)) {
    const next: SaveState = {
      ...state,
      activity: null,
      pendingOverflow: makeOverflow(
        ACTIVITY_LABEL[activity.kind],
        "Found",
        loot,
      ),
      pendingResults: null,
    };
    return writeActivityDiary(next, {
      kind: activity.kind,
      durationId: activity.durationId,
      kept: mergeLoot(loot),
      lost: [],
      at: now,
    });
  }

  const { inventory, kept, lost } = placeLoot(
    state.inventory,
    state.storageTier,
    loot,
  );

  const next: SaveState = {
    ...state,
    activity: null,
    inventory,
    pendingResults: {
      title: ACTIVITY_LABEL[activity.kind],
      kept,
      lost,
      resolvedAt: now,
    },
    pendingOverflow: null,
  };
  return writeActivityDiary(next, {
    kind: activity.kind,
    durationId: activity.durationId,
    kept,
    lost,
    at: now,
  });
}

export function clearPendingResults(state: SaveState): SaveState {
  return { ...state, pendingResults: null };
}

export function formatRemaining(endsAt: number, now: number): string {
  const ms = Math.max(0, endsAt - now);
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function activityChipLabel(
  activity: ActiveActivity,
  now: number,
): string {
  if (activity.kind === "craft" && activity.recipeId) {
    const recipe = RECIPES.find((r) => r.id === activity.recipeId);
    return `Crafting ${recipe?.name ?? "…"} · ${formatRemaining(activity.endsAt, now)}`;
  }
  if (activity.kind === "cook" && activity.cookItemId) {
    const name = activity.cookItemId.replace(/_/g, " ");
    return `Cooking ${name} · ${formatRemaining(activity.endsAt, now)}`;
  }
  return `${ACTIVITY_LABEL[activity.kind]} · ${formatRemaining(activity.endsAt, now)}`;
}
