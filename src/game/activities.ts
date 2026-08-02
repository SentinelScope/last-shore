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
  mergeLoot,
  missingCosts,
  placeLoot,
  removeItems,
  type LootPile,
} from "./inventory";
import { lootFits, makeOverflow } from "./overflow";
import type {
  ActiveActivity,
  FireActivity,
  PendingResults,
  SaveState,
} from "./persist";
import { rngFor, weightedPick } from "./rng";
import { tickIndexAt } from "./time";
import { bestCutTool, hasTool, withToolDurability } from "./tools";

export { bestCutTool } from "./tools";

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
    if (!bestCutTool(state)) {
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

  const tool = kind === "cut" ? bestCutTool(state)! : undefined;
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
  if (recipe.effect === "tool_rack" && state.hasToolRack) {
    return { ok: false, reason: "Tool rack already built." };
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
  if (recipe.tool && !hasTool(state, recipe.tool)) {
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

function rollCutLoot(
  tool: CutTool,
  durationId: DurationId,
  seed: string,
  startedAt: number,
): LootPile {
  const wood = CUT_YIELD[tool][durationId];
  const exact = wood * 0.25;
  const base = Math.floor(exact);
  const frac = exact - base;
  const rng = rngFor(seed, "cut-fibre", tickIndexAt(startedAt));
  const fibre = base + (frac > 0 && rng() < frac ? 1 : 0);
  const loot: LootPile = [{ itemId: "wood", qty: wood }];
  if (fibre > 0) loot.push({ itemId: "plant_fiber", qty: fibre });
  return loot;
}

export function rollActivityLoot(
  activity: ActiveActivity,
  seed: string,
): LootPile {
  if (activity.kind === "scour" && activity.durationId) {
    return rollScourLoot(seed, activity.durationId, activity.startedAt);
  }
  if (activity.kind === "cut" && activity.durationId) {
    return rollCutLoot(
      activity.tool ?? "bare",
      activity.durationId,
      seed,
      activity.startedAt,
    );
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
  let hasToolRack = state.hasToolRack;
  const kept: LootPile = [];
  const lost: LootPile = [];
  let pendingOverflow = state.pendingOverflow;

  if (recipe.result) {
    const resultSlot = withToolDurability({
      itemId: recipe.result.itemId,
      qty: recipe.result.qty,
    });
    const pile = [
      {
        itemId: resultSlot.itemId,
        qty: resultSlot.qty,
      },
    ];
    if (lootFits(inventory, storageTier, pile)) {
      const placed = placeLoot(inventory, storageTier, pile);
      inventory = placed.inventory.map((s) =>
        s.itemId === resultSlot.itemId && resultSlot.durability !== undefined
          ? { ...s, durability: s.durability ?? resultSlot.durability }
          : s,
      );
      kept.push(...placed.kept);
      lost.push(...placed.lost);
    } else {
      pendingOverflow = makeOverflow(
        `Crafted · ${recipe.name}`,
        "Found",
        pile,
      );
    }
  }

  if (recipe.effect === "satchel") {
    storageTier = "satchel";
  }
  if (recipe.effect === "tool_rack") {
    hasToolRack = true;
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
      hasToolRack,
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
    hasToolRack,
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
  const activity = state.fireActivity;
  if (!activity?.cookItemId || activity.cookSlotIndex === undefined) {
    return { ...state, fireActivity: null };
  }
  if (activity.pausedAt != null) return state;

  const synced = syncFireplace(state, now);
  // sync may pause the cook if the fire died this tick
  if (synced.fireActivity?.pausedAt != null) return synced;

  const slotIndex = activity.cookSlotIndex;
  const foodSlots = [...synced.fireplace.slots.food];
  const current = foodSlots[slotIndex];
  if (!current || current.itemId !== activity.cookItemId) {
    return { ...synced, fireActivity: null };
  }

  const resultId = COOK_RESULT[activity.cookItemId] ?? activity.cookItemId;
  foodSlots[slotIndex] = { itemId: resultId, qty: 1 };

  const next: SaveState = {
    ...synced,
    fireActivity: null,
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
  let s = state;
  const activity = s.activity;
  if (activity && now >= activity.endsAt) {
    if (activity.kind === "craft") {
      s = resolveCraft(s, now);
    } else {
      const loot = rollActivityLoot(activity, s.seed);

      if (!lootFits(s.inventory, s.storageTier, loot)) {
        const next: SaveState = {
          ...s,
          activity: null,
          pendingOverflow: makeOverflow(
            ACTIVITY_LABEL[activity.kind],
            "Found",
            loot,
          ),
          pendingResults: null,
        };
        s = writeActivityDiary(next, {
          kind: activity.kind,
          durationId: activity.durationId,
          kept: mergeLoot(loot),
          lost: [],
          at: now,
        });
      } else {
        const { inventory, kept, lost } = placeLoot(
          s.inventory,
          s.storageTier,
          loot,
        );

        const next: SaveState = {
          ...s,
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
        s = writeActivityDiary(next, {
          kind: activity.kind,
          durationId: activity.durationId,
          kept,
          lost,
          at: now,
        });
      }
    }
  }

  const fire = s.fireActivity;
  if (fire && fire.pausedAt == null && now >= fire.endsAt) {
    s = resolveCook(s, now);
  }
  return s;
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
  activity: ActiveActivity | FireActivity,
  now: number,
): string {
  if (activity.kind === "craft" && activity.recipeId) {
    const recipe = RECIPES.find((r) => r.id === activity.recipeId);
    return `Crafting ${recipe?.name ?? "…"} · ${formatRemaining(activity.endsAt, now)}`;
  }
  if (activity.kind === "cook") {
    const name = activity.cookItemId.replace(/_/g, " ");
    if (activity.pausedAt != null) {
      return `Cooking ${name} · paused`;
    }
    return `Cooking ${name} · ${formatRemaining(activity.endsAt, now)}`;
  }
  return `${ACTIVITY_LABEL[activity.kind]} · ${formatRemaining(activity.endsAt, now)}`;
}
