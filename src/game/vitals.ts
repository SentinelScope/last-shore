import {
  CATCH_UP_MAX_DAYS,
  COMFORT_SOURCES,
  COMFORT_WEATHER,
  EAT_EFFECT,
  HEALTH_EMPTY_BAR_PER_HOUR,
  HEALTH_REGEN_BASE_PER_HOUR,
  HEALTH_REGEN_PER_COMFORT,
  HUNGER_EMPTY_HOURS,
  META_KEY,
  THIRST_EMPTY_HOURS,
  WEATHER_LABEL,
  type WeatherId,
} from "./balance";
import { resolveActivityIfDue } from "./activities";
import {
  ailmentComfortPenalty,
  ailmentHealthPerHour,
  freakWaveDeathLine,
  lightningDeathLine,
  rollAilmentsForActivityMinute,
  tickAilmentExpiry,
} from "./ailments";
import { totalWornComfort } from "./clothing";
import { shelterDecorComfort } from "./shelter";
import {
  maybeWriteIdleDiary,
  maybeWriteOmenDiary,
  maybeWriteWaterFullDiary,
} from "./diary";
import { syncFireplace } from "./fire";
import { removeItems } from "./inventory";
import {
  ITEMS,
  isCarriedComfortItem,
  itemComfortBonus,
} from "./items";
import type { SaveState } from "./persist";
import { dayNumber, dayPartAt } from "./time";
import { weatherAt } from "./weather";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export function clampBar(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export type LedgerRow = {
  label: string;
  /** Signed effect; 0 rows are usually omitted by the UI. */
  value: number;
  /** e.g. "%/h" — omit for flat comfort points. */
  unit?: string;
  /** Always show even when value is 0 (base drain). */
  always?: boolean;
  kind?: "water" | "food" | "hp" | "comf";
};

export type LedgerSection = {
  id: string;
  title: string;
  /** e.g. "24%" under COMFORT */
  headline?: string;
  rows: LedgerRow[];
  net?: LedgerRow;
};

/** Comfort from structure / fire / weather / carried comfort / worn clothes. */
export function computeComfort(
  state: SaveState,
  weather: WeatherId,
): number {
  let c = 0;
  if (state.shelterTier === "lean_to") c += COMFORT_SOURCES.lean_to;
  else if (state.shelterTier === "walled") c += COMFORT_SOURCES.walled;
  else if (state.shelterTier === "storm") c += COMFORT_SOURCES.storm;
  if (state.bedTier === "mat") c += COMFORT_SOURCES.mat;
  if (state.hasLogChair) c += COMFORT_SOURCES.log_chair;
  if (state.fireplace.lit) c += COMFORT_SOURCES.fire_lit;
  for (const slot of state.inventory) {
    const def = ITEMS[slot.itemId];
    if (!def || !isCarriedComfortItem(def)) continue;
    const bonus = itemComfortBonus(def);
    if (bonus !== 0) c += bonus * slot.qty;
  }
  c += totalWornComfort(state.worn);
  c += shelterDecorComfort(state);
  c += COMFORT_WEATHER[weather] ?? 0;
  c += ailmentComfortPenalty(state);
  return clampBar(c);
}

/** Itemised breakdown for the You page. */
export function buildLedger(
  state: SaveState,
  weather: WeatherId,
): LedgerSection[] {
  const comfort = computeComfort(state, weather);

  const comfortRows: LedgerRow[] = [];
  if (state.shelterTier === "lean_to") {
    comfortRows.push({
      label: "Lean-to",
      value: COMFORT_SOURCES.lean_to,
      kind: "comf",
    });
  } else if (state.shelterTier === "walled") {
    comfortRows.push({
      label: "Walled Shelter",
      value: COMFORT_SOURCES.walled,
      kind: "comf",
    });
  } else if (state.shelterTier === "storm") {
    comfortRows.push({
      label: "Storm-proof Shelter",
      value: COMFORT_SOURCES.storm,
      kind: "comf",
    });
  }
  if (state.bedTier === "mat") {
    comfortRows.push({
      label: "Palm-frond Mat",
      value: COMFORT_SOURCES.mat,
      kind: "comf",
    });
  }
  if (state.hasLogChair) {
    comfortRows.push({
      label: "Log Chair",
      value: COMFORT_SOURCES.log_chair,
      kind: "comf",
    });
  }
  if (state.fireplace.lit) {
    comfortRows.push({
      label: "Fire burning",
      value: COMFORT_SOURCES.fire_lit,
      kind: "comf",
    });
  }
  for (const slot of state.inventory) {
    const def = ITEMS[slot.itemId];
    if (!def || !isCarriedComfortItem(def)) continue;
    const bonus = itemComfortBonus(def);
    if (bonus === 0) continue;
    comfortRows.push({
      label: def.name,
      value: bonus * slot.qty,
      kind: "comf",
    });
  }
  for (const id of state.shelterDecor ?? []) {
    if (!id) continue;
    const def = ITEMS[id];
    if (!def || !isCarriedComfortItem(def)) continue;
    const bonus = itemComfortBonus(def);
    if (bonus === 0) continue;
    comfortRows.push({
      label: `${def.name} (shelter)`,
      value: bonus,
      kind: "comf",
    });
  }
  const worn = state.worn;
  if (worn) {
    for (const key of ["head", "body", "legs", "feet"] as const) {
      const id = worn[key];
      if (!id) continue;
      const def = ITEMS[id];
      const bonus = totalWornComfort({
        head: null,
        body: null,
        legs: null,
        feet: null,
        [key]: id,
      });
      if (bonus === 0) continue;
      comfortRows.push({
        label: def?.name ?? id,
        value: bonus,
        kind: "comf",
      });
    }
  }
  const wxDelta = COMFORT_WEATHER[weather] ?? 0;
  if (wxDelta !== 0) {
    comfortRows.push({
      label: WEATHER_LABEL[weather].replace(/^./, (c) => c.toUpperCase()),
      value: wxDelta,
      kind: "comf",
    });
  }
  for (const a of state.ailments ?? []) {
    const pen = ailmentComfortPenalty({
      ...state,
      ailments: [a],
    });
    if (pen === 0) continue;
    const label =
      a.id === "cut_finger"
        ? "Cut Finger"
        : a.id === "twisted_ankle"
          ? "Twisted Ankle"
          : a.id === "heatstroke"
            ? "Heatstroke"
            : "Cold";
    comfortRows.push({ label, value: pen, kind: "comf" });
  }

  const thirstBase = 100 / THIRST_EMPTY_HOURS;
  const thirstActual = 100 / (THIRST_EMPTY_HOURS * (1 + comfort / 100));
  const thirstRelief = thirstBase - thirstActual;
  const thirstRows: LedgerRow[] = [
    {
      label: "Base drain",
      value: -thirstBase,
      unit: "%/h",
      always: true,
      kind: "water",
    },
  ];
  if (thirstRelief > 0.001) {
    thirstRows.push({
      label: `Comfort ${Math.round(comfort)}%`,
      value: thirstRelief,
      unit: "%/h",
      kind: "water",
    });
  }

  const hungerBase = 100 / HUNGER_EMPTY_HOURS;
  const hungerActual = 100 / (HUNGER_EMPTY_HOURS * (1 + comfort / 100));
  const hungerRelief = hungerBase - hungerActual;
  const hungerRows: LedgerRow[] = [
    {
      label: "Base drain",
      value: -hungerBase,
      unit: "%/h",
      always: true,
      kind: "food",
    },
  ];
  if (hungerRelief > 0.001) {
    hungerRows.push({
      label: `Comfort ${Math.round(comfort)}%`,
      value: hungerRelief,
      unit: "%/h",
      kind: "food",
    });
  }

  const healthRows: LedgerRow[] = [];
  if (state.thirst <= 0) {
    healthRows.push({
      label: "Thirst empty",
      value: -HEALTH_EMPTY_BAR_PER_HOUR,
      unit: "%/h",
      kind: "hp",
    });
  }
  if (state.hunger <= 0) {
    healthRows.push({
      label: "Hunger empty",
      value: -HEALTH_EMPTY_BAR_PER_HOUR,
      unit: "%/h",
      kind: "hp",
    });
  }
  if (state.thirst > 0 && state.hunger > 0) {
    healthRows.push({
      label: "Base recovery",
      value: HEALTH_REGEN_BASE_PER_HOUR,
      unit: "%/h",
      always: true,
      kind: "hp",
    });
    const fromComf = HEALTH_REGEN_PER_COMFORT * comfort;
    if (fromComf > 0.001) {
      healthRows.push({
        label: `Comfort ${Math.round(comfort)}%`,
        value: fromComf,
        unit: "%/h",
        kind: "hp",
      });
    }
  }
  const ailmentHp = ailmentHealthPerHour(state);
  if (ailmentHp !== 0) {
    healthRows.push({
      label: "Cut Finger",
      value: ailmentHp,
      unit: "%/h",
      kind: "hp",
    });
  }

  const healthNet =
    healthRows.reduce((n, r) => n + r.value, 0);

  return [
    {
      id: "comfort",
      title: "Comfort",
      headline: `${Math.round(comfort)}%`,
      rows: comfortRows,
    },
    {
      id: "thirst",
      title: "Thirst",
      rows: thirstRows,
      net: {
        label: "Net",
        value: -thirstActual,
        unit: "%/h",
        kind: "water",
      },
    },
    {
      id: "hunger",
      title: "Hunger",
      rows: hungerRows,
      net: {
        label: "Net",
        value: -hungerActual,
        unit: "%/h",
        kind: "food",
      },
    },
    {
      id: "health",
      title: "Health",
      rows: healthRows,
      net:
        healthRows.length > 0
          ? { label: "Net", value: healthNet, unit: "%/h", kind: "hp" }
          : undefined,
    },
  ];
}

/**
 * Apply thirst, hunger, then health for `dtHours` at a fixed comfort.
 * Comfort must already be decided for this step.
 */
export function stepBars(
  state: SaveState,
  comfort: number,
  dtHours: number,
): SaveState {
  if (dtHours <= 0) {
    return { ...state, comfort: clampBar(comfort) };
  }

  const thirstHours = THIRST_EMPTY_HOURS * (1 + comfort / 100);
  const hungerHours = HUNGER_EMPTY_HOURS * (1 + comfort / 100);
  const thirst = clampBar(
    state.thirst - (100 / thirstHours) * dtHours,
  );
  const hunger = clampBar(
    state.hunger - (100 / hungerHours) * dtHours,
  );

  let healthDelta = 0;
  if (thirst <= 0) healthDelta -= HEALTH_EMPTY_BAR_PER_HOUR;
  if (hunger <= 0) healthDelta -= HEALTH_EMPTY_BAR_PER_HOUR;
  if (thirst > 0 && hunger > 0) {
    healthDelta +=
      HEALTH_REGEN_BASE_PER_HOUR + HEALTH_REGEN_PER_COMFORT * comfort;
  }
  healthDelta += ailmentHealthPerHour(state);

  const health = clampBar(state.health + healthDelta * dtHours);

  return {
    ...state,
    thirst,
    hunger,
    health,
    comfort: clampBar(comfort),
  };
}

export type DeathInfo = {
  at: number;
  days: number;
  /** e.g. "Dehydration, on a clear morning." */
  line: string;
};

function deathCauseLine(
  state: SaveState,
  at: number,
): string {
  const weather = weatherAt(state.seed, state.runStartedAt, at);
  const part = dayPartAt(at);
  const timeWord =
    part === "dawn"
      ? "morning"
      : part === "day"
        ? "midday"
        : part === "golden"
          ? "evening"
          : "night";
  // Thirst empties first under normal rates — name dehydration when thirst is gone.
  const cause =
    state.thirst <= 0
      ? "Dehydration"
      : state.hunger <= 0
        ? "Starvation"
        : "Exhaustion";
  const wx = WEATHER_LABEL[weather];
  return `${cause}, on a ${wx} ${timeWord}.`;
}

export type CatchUpResult = {
  state: SaveState;
  death: DeathInfo | null;
};

/**
 * Advance from lastSimulatedAt → now in 1-minute steps.
 * Order each step: bar decay → health → fire → (water derived) → activity.
 * Cap at 14 days of steps.
 */
export function catchUp(state: SaveState, now: number): CatchUpResult {
  let from = state.lastSimulatedAt ?? state.runStartedAt;
  const capStart = now - CATCH_UP_MAX_DAYS * 86_400_000;
  if (from < capStart) from = capStart;

  let s: SaveState = { ...state };
  if (now <= from) {
    const weather = weatherAt(s.seed, s.runStartedAt, now);
    return {
      state: {
        ...s,
        comfort: computeComfort(s, weather),
        lastSimulatedAt: now,
      },
      death: null,
    };
  }

  let t = from;
  const maxSteps = CATCH_UP_MAX_DAYS * 24 * 60 + 2;
  for (let i = 0; i < maxSteps && t < now; i++) {
    const stepEnd = Math.min(t + MINUTE_MS, now);
    const dtHours = (stepEnd - t) / HOUR_MS;
    const weather = weatherAt(s.seed, s.runStartedAt, t);
    const comfort = computeComfort(s, weather);

    // Omen diary when the red sky first arrives
    const prevWx = weatherAt(
      s.seed,
      s.runStartedAt,
      Math.max(s.runStartedAt, t - MINUTE_MS),
    );
    if (weather === "omen" && prevWx !== "omen") {
      s = maybeWriteOmenDiary(s, t);
    }

    // 1–2: bar decay then health (stepBars does thirst/hunger then health)
    s = stepBars(s, comfort, dtHours);

    // 3: fire burn / storm
    s = syncFireplace(s, stepEnd);

    // 4: water brim transition → diary
    s = maybeWriteWaterFullDiary(s, stepEnd);

    // 5: ailment wait-out / thirst cure, then outdoor activity rolls this minute
    s = tickAilmentExpiry(s, stepEnd);
    if (
      s.activity &&
      t >= s.activity.startedAt &&
      t < s.activity.endsAt
    ) {
      const rolled = rollAilmentsForActivityMinute(
        s,
        s.activity.kind,
        weather,
        t,
      );
      s = rolled.state;
      if (rolled.death) {
        const at = rolled.death.at;
        const days = dayNumber(s.runStartedAt, at);
        const line =
          rolled.death.cause === "freak_wave"
            ? freakWaveDeathLine(days)
            : lightningDeathLine(days);
        return {
          state: { ...s, lastSimulatedAt: at },
          death: {
            at,
            days,
            line,
          },
        };
      }
    }

    // 6: activity completion (also writes activity diary)
    s = resolveActivityIfDue(s, stepEnd);

    // 7: idle observations every 12h
    s = maybeWriteIdleDiary(s, stepEnd);

    t = stepEnd;
    s = { ...s, lastSimulatedAt: t };

    // Recompute comfort after ailment changes this step
    s = {
      ...s,
      comfort: computeComfort(
        s,
        weatherAt(s.seed, s.runStartedAt, t),
      ),
    };

    if (s.health <= 0) {
      const at = t;
      return {
        state: { ...s, health: 0, lastSimulatedAt: at },
        death: {
          at,
          days: dayNumber(s.runStartedAt, at),
          line: deathCauseLine(s, at),
        },
      };
    }
  }

  const weather = weatherAt(s.seed, s.runStartedAt, now);
  return {
    state: {
      ...s,
      comfort: computeComfort(s, weather),
      lastSimulatedAt: now,
    },
    death: null,
  };
}

/**
 * Pure vitals-only simulation at fixed comfort (for death-time assertions).
 * Returns hours until health hits 0.
 */
export function hoursUntilDeathAtComfort(
  comfort: number,
  stepHours = 1 / 60,
): number {
  let thirst = 100;
  let hunger = 100;
  let health = 100;
  let hours = 0;
  const limit = 200;
  while (health > 0 && hours < limit) {
    const snapped = stepBars(
      {
        thirst,
        hunger,
        health,
        comfort,
      } as SaveState,
      comfort,
      stepHours,
    );
    thirst = snapped.thirst;
    hunger = snapped.hunger;
    health = snapped.health;
    hours += stepHours;
  }
  return hours;
}

export function eatItem(
  state: SaveState,
  inventoryIndex: number,
): SaveState | null {
  const slot = state.inventory[inventoryIndex];
  if (!slot) return null;
  const effect = EAT_EFFECT[slot.itemId];
  if (!effect) return null;
  const inventory = removeItems(state.inventory, [
    { itemId: slot.itemId, qty: 1 },
  ]);
  if (!inventory) return null;
  return {
    ...state,
    inventory,
    hunger: clampBar(state.hunger + effect.food),
    thirst: clampBar(state.thirst + effect.water),
  };
}

export function destroyItem(
  state: SaveState,
  inventoryIndex: number,
  qty = 1,
): SaveState | null {
  const slot = state.inventory[inventoryIndex];
  if (!slot) return null;
  const take = Math.min(Math.max(1, qty), slot.qty);
  const inventory = removeItems(state.inventory, [
    { itemId: slot.itemId, qty: take },
  ]);
  if (!inventory) return null;
  return { ...state, inventory };
}

export type MetaState = { bestDays: number };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadMeta(): MetaState {
  if (!canUseStorage()) return { bestDays: 0 };
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { bestDays: 0 };
    const parsed = JSON.parse(raw) as MetaState;
    return { bestDays: Math.max(0, parsed.bestDays ?? 0) };
  } catch {
    return { bestDays: 0 };
  }
}

export function writeMeta(meta: MetaState): void {
  if (!canUseStorage()) return;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function recordBestDays(days: number): MetaState {
  const meta = loadMeta();
  const next = { bestDays: Math.max(meta.bestDays, days) };
  writeMeta(next);
  return next;
}
