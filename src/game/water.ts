import {
  WATER_CAPACITY,
  WATER_DRINK_UNITS,
  WATER_FILL,
  WEATHER_ROLL_HOURS,
  type WeatherId,
} from "./balance";
import { placeLoot } from "./inventory";
import type { SaveState, WaterSpot } from "./persist";
import { latestWeatherRollAt } from "./time";
import { nextWeatherRollAfter, weatherAt } from "./weather";

/** Percent points added by weather between fromMs and toMs. */
export function accumulateWaterFill(
  seed: string,
  runStartedAt: number,
  fromMs: number,
  toMs: number,
): number {
  if (toMs <= fromMs) return 0;
  let fill = 0;
  let t = fromMs;
  for (let i = 0; i < 2000 && t < toMs; i++) {
    const rollStart = latestWeatherRollAt(t, WEATHER_ROLL_HOURS);
    const nextRoll = nextWeatherRollAfter(rollStart);
    const segmentEnd = Math.min(toMs, nextRoll);
    const weather: WeatherId = weatherAt(seed, runStartedAt, t);
    const minutes = (segmentEnd - t) / 60_000;
    if (weather === "rain") {
      fill += (minutes / 5) * WATER_FILL.rainPercentPerFiveMin;
    } else if (weather === "storm") {
      fill += minutes * WATER_FILL.stormPercentPerMin;
    }
    t = segmentEnd;
  }
  return fill;
}

/**
 * Current fill % — pure from wall clock + weather history − drunk amount.
 * Never needs a ticking writer.
 */
export function currentWaterFill(
  state: SaveState,
  now: number,
): number {
  const spot = state.waterSpot;
  if (!spot?.itemId) return 0;
  const gained = accumulateWaterFill(
    state.seed,
    state.runStartedAt,
    spot.placedAt,
    now,
  );
  return Math.max(0, Math.min(100, gained - spot.drunkPercent));
}

export function placeWaterContainer(
  state: SaveState,
  itemId: string,
  inventoryIndex: number,
  now: number,
): SaveState | null {
  if (!(itemId in WATER_CAPACITY)) return null;
  const slot = state.inventory[inventoryIndex];
  if (!slot || slot.itemId !== itemId) return null;

  const inv = state.inventory.map((s) => ({ ...s }));
  const target = inv[inventoryIndex]!;
  if (target.qty <= 1) inv.splice(inventoryIndex, 1);
  else target.qty -= 1;

  let nextInv = inv;
  if (state.waterSpot?.itemId) {
    const { inventory: returned, lost } = placeLoot(
      nextInv,
      state.storageTier,
      [{ itemId: state.waterSpot.itemId, qty: 1 }],
    );
    if (lost.length > 0) return null;
    nextInv = returned;
  }

  return {
    ...state,
    inventory: nextInv,
    waterSpot: {
      itemId,
      placedAt: now,
      drunkPercent: 0,
    },
    diaryWaterFullNoted: false,
  };
}

export function drinkFromWater(state: SaveState, now: number): SaveState {
  const spot = state.waterSpot;
  if (!spot?.itemId) return state;
  const fill = currentWaterFill(state, now);
  if (fill <= 0) return state;
  const cap = WATER_CAPACITY[spot.itemId] ?? 25;
  const drinkPercent = (WATER_DRINK_UNITS / cap) * 100;
  const taken = Math.min(fill, drinkPercent);
  const waterUnits = (taken / 100) * cap;
  return {
    ...state,
    thirst: Math.max(0, Math.min(100, state.thirst + waterUnits)),
    waterSpot: {
      ...spot,
      drunkPercent: spot.drunkPercent + taken,
    },
  };
}

export function waterFillLabel(fillPercent: number, itemId: string | null): string {
  if (!itemId) return "Nothing set out";
  return `${Math.round(fillPercent)}% full`;
}

export function emptyWaterSpot(): WaterSpot {
  return { itemId: null, placedAt: 0, drunkPercent: 0 };
}
