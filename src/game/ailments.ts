/**
 * Ailments — rolled per minute of outdoor activity during catch-up.
 */

import {
  AILMENT_TABLE,
  type AilmentActivity,
  type AilmentId,
  type ActivityKind,
  type WeatherId,
} from "./balance";
import { isWearingSunHat } from "./clothing";
import { appendDiaryEntry } from "./diary";
import { hasItem, removeItems } from "./inventory";
import type { ActiveAilment, SaveState } from "./persist";
import { rngFor } from "./rng";
import { dayNumber, tickIndexAt } from "./time";

export type { ActiveAilment };

export function isOutdoorActivity(kind: ActivityKind | string): boolean {
  return kind !== "craft" && kind !== "cook";
}

function appliesToActivity(
  ailmentId: AilmentId,
  kind: ActivityKind | string,
): boolean {
  if (!isOutdoorActivity(kind)) return false;
  const row = AILMENT_TABLE[ailmentId];
  if (row.appliesTo === "outdoor") return true;
  return (row.appliesTo as readonly AilmentActivity[]).includes(
    kind as AilmentActivity,
  );
}

function hasAilment(
  state: SaveState,
  id: Exclude<AilmentId, "lightning" | "freak_wave">,
): boolean {
  return (state.ailments ?? []).some((a) => a.id === id);
}

function ordinalDay(n: number): string {
  const words = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
    "twentieth",
    "twenty-first",
    "twenty-second",
    "twenty-third",
    "twenty-fourth",
    "twenty-fifth",
    "twenty-sixth",
    "twenty-seventh",
    "twenty-eighth",
    "twenty-ninth",
    "thirtieth",
  ];
  return words[n - 1] ?? `${n}th`;
}

export function lightningDeathLine(days: number): string {
  return (
    `Struck by lightning on the ${ordinalDay(days)} day.\n` +
    `You were out on the sand when the storm turned. There was no sound before it.`
  );
}

export function freakWaveDeathLine(days: number): string {
  return (
    `Taken by a freak wave on the ${ordinalDay(days)} day.\n` +
    `The sky had been red since morning and the sea had gone quiet with it. It came ` +
    `from behind, and it did not break until it was already past.`
  );
}

export function ailmentComfortPenalty(state: SaveState): number {
  let pen = 0;
  for (const a of state.ailments ?? []) {
    pen += AILMENT_TABLE[a.id].whileActive.comfort ?? 0;
  }
  return pen;
}

export function ailmentHealthPerHour(state: SaveState): number {
  let rate = 0;
  for (const a of state.ailments ?? []) {
    rate += AILMENT_TABLE[a.id].whileActive.healthPerHour ?? 0;
  }
  return rate;
}

function impactDiaryText(
  id: Exclude<AilmentId, "lightning" | "freak_wave">,
  impact: { health?: number; thirst?: number },
): { text: string; deltas: { stat: "health" | "water"; amount: number }[] } {
  const deltas: { stat: "health" | "water"; amount: number }[] = [];
  if (id === "cut_finger") {
    deltas.push({ stat: "health", amount: impact.health ?? -5 });
    return {
      text: `Cut my finger open while working. It will not stop seeping.`,
      deltas,
    };
  }
  if (id === "twisted_ankle") {
    return {
      text: `Twisted an ankle on the uneven ground. Walking is careful now.`,
      deltas: [],
    };
  }
  if (id === "heatstroke") {
    deltas.push({ stat: "water", amount: impact.thirst ?? -10 });
    return {
      text: `The heat got into me. Thirst hit like a wall.`,
      deltas,
    };
  }
  // cold
  return {
    text: `Caught a cold in the wet. The chill sits in the chest.`,
    deltas: [],
  };
}

function cureDiaryText(id: Exclude<AilmentId, "lightning" | "freak_wave">): string {
  if (id === "cut_finger") return "Bound the cut. The finger will hold.";
  if (id === "twisted_ankle") return "Ankle wrapped. Weight comes back slowly.";
  if (id === "heatstroke") return "Drank until the heat let go. Clear-headed again.";
  return "Medicine down. The cold is leaving.";
}

export function applyAilmentImpact(
  state: SaveState,
  id: Exclude<AilmentId, "lightning" | "freak_wave">,
  at: number,
): SaveState {
  const row = AILMENT_TABLE[id];
  const duration = row.durationMs ?? 24 * 60 * 60 * 1000;
  const ailments: ActiveAilment[] = [
    ...(state.ailments ?? []),
    { id, startedAt: at, endsAt: at + duration },
  ];

  let health = state.health;
  let thirst = state.thirst;
  if (row.impact.health) {
    health = Math.max(0, Math.min(100, health + row.impact.health));
  }
  if (row.impact.thirst) {
    thirst = Math.max(0, Math.min(100, thirst + row.impact.thirst));
  }

  const { text, deltas } = impactDiaryText(id, row.impact);
  const next: SaveState = {
    ...state,
    ailments,
    health,
    thirst,
  };
  return appendDiaryEntry(next, {
    dayNumber: dayNumber(state.runStartedAt, at),
    text,
    deltas,
    kind: "ailment",
    at,
  });
}

export function clearAilment(
  state: SaveState,
  id: Exclude<AilmentId, "lightning" | "freak_wave">,
  at: number,
  opts?: { silent?: boolean },
): SaveState {
  const ailments = (state.ailments ?? []).filter((a) => a.id !== id);
  const next: SaveState = { ...state, ailments };
  if (opts?.silent) return next;
  return appendDiaryEntry(next, {
    dayNumber: dayNumber(state.runStartedAt, at),
    text: cureDiaryText(id),
    deltas: [],
    kind: "ailment",
    at,
  });
}

/** Expire wait-outs and thirst-cure heatstroke. */
export function tickAilmentExpiry(state: SaveState, now: number): SaveState {
  let s = state;
  for (const a of [...(s.ailments ?? [])]) {
    if (now >= a.endsAt) {
      s = clearAilment(s, a.id, now);
    }
  }
  const heat = (s.ailments ?? []).find((a) => a.id === "heatstroke");
  if (heat) {
    const need = AILMENT_TABLE.heatstroke.cureThirstAtLeast ?? 80;
    if (s.thirst >= need) {
      s = clearAilment(s, "heatstroke", now);
    }
  }
  return s;
}

export type InstantDeathCause = "lightning" | "freak_wave";

export type AilmentMinuteResult = {
  state: SaveState;
  death: null | { cause: InstantDeathCause; at: number };
};

/**
 * One outdoor activity minute: independent rolls for each eligible ailment.
 */
export function rollAilmentsForActivityMinute(
  state: SaveState,
  kind: ActivityKind | string,
  weather: WeatherId,
  at: number,
): AilmentMinuteResult {
  if (!isOutdoorActivity(kind)) {
    return { state, death: null };
  }

  let s = state;
  const wearingHat = isWearingSunHat(s);
  const order: AilmentId[] = [
    "cut_finger",
    "twisted_ankle",
    "heatstroke",
    "cold",
    "lightning",
    "freak_wave",
  ];

  for (const id of order) {
    if (!appliesToActivity(id, kind)) continue;
    if (id !== "lightning" && id !== "freak_wave" && hasAilment(s, id)) {
      continue;
    }
    if (id === "heatstroke" && wearingHat) continue;

    const pct = AILMENT_TABLE[id].chancePerMinutePercent[weather];
    if (pct == null || pct <= 0) continue;

    const rng = rngFor(s.seed, `ailment-${id}`, tickIndexAt(at));
    if (rng() * 100 >= pct) continue;

    if (id === "lightning" || id === "freak_wave") {
      return { state: s, death: { cause: id, at } };
    }
    s = applyAilmentImpact(s, id, at);
  }

  return { state: s, death: null };
}

/** Use a cure item from inventory (Bandage / Medicine Bottle). */
export function cureAilmentWithItem(
  state: SaveState,
  ailmentId: Exclude<AilmentId, "lightning" | "freak_wave">,
  now: number,
): SaveState | null {
  if (!hasAilment(state, ailmentId)) return null;
  const items = AILMENT_TABLE[ailmentId].cureItems;
  if (items.length === 0) return null;
  const itemId = items.find((id) => hasItem(state.inventory, id));
  if (!itemId) return null;
  const inventory = removeItems(state.inventory, [{ itemId, qty: 1 }]);
  if (!inventory) return null;
  return clearAilment({ ...state, inventory }, ailmentId, now);
}

export type AilmentView = {
  id: Exclude<AilmentId, "lightning" | "freak_wave">;
  label: string;
  impactLine: string;
  activeLine: string;
  cureLine: string;
  /** Item id for the cure button, if owned. */
  cureActionItemId: string | null;
  cureActionLabel: string | null;
};

export function buildAilmentViews(state: SaveState): AilmentView[] {
  return (state.ailments ?? []).map((a) => {
    const row = AILMENT_TABLE[a.id];
    let impactLine = "";
    if (a.id === "cut_finger") {
      impactLine = `Cut finger ${row.impact.health ?? -5}% health.`;
    } else if (a.id === "heatstroke") {
      impactLine = `Increased thirst by ${row.impact.thirst ?? -10}%.`;
    } else if (a.id === "twisted_ankle") {
      impactLine = "Twisted an ankle.";
    } else if (a.id === "cold") {
      impactLine = "Caught a cold.";
    }

    let activeLine = "No ongoing effect.";
    if (row.whileActive.healthPerHour) {
      activeLine = `Still draining ${row.whileActive.healthPerHour}% health per hour.`;
    } else if (row.whileActive.comfort) {
      activeLine = `Still costing ${row.whileActive.comfort}% comfort.`;
    }

    let cureLine = "Wait it out.";
    if (a.id === "cut_finger" || a.id === "twisted_ankle") {
      cureLine = "Cure with a Bandage, or wait it out (24 hours).";
    } else if (a.id === "heatstroke") {
      cureLine = `Drink to ${row.cureThirstAtLeast ?? 80}% thirst or higher, or wait it out (12 hours).`;
    } else if (a.id === "cold") {
      cureLine = "Cure with a Medicine Bottle, or wait it out (48 hours).";
    }

    const owned = row.cureItems.find((id) => hasItem(state.inventory, id));
    let cureActionLabel: string | null = null;
    if (owned === "bandage") cureActionLabel = "Use Bandage";
    if (owned === "medicine_bottle") cureActionLabel = "Use Medicine";

    return {
      id: a.id,
      label: row.label,
      impactLine,
      activeLine,
      cureLine,
      cureActionItemId: owned ?? null,
      cureActionLabel,
    };
  });
}

/** Test / debug helper. */
export function forceAilment(
  state: SaveState,
  id: Exclude<AilmentId, "lightning" | "freak_wave">,
  at: number,
): SaveState {
  if (hasAilment(state, id)) return state;
  return applyAilmentImpact(state, id, at);
}
