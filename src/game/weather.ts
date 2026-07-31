import {
  WEATHER_BASE_WEIGHTS,
  WEATHER_CONDITIONAL,
  WEATHER_ROLL_HOURS,
  type WeatherId,
} from "./balance";
import { rngFor, weightedPick } from "./rng";
import { latestWeatherRollAt, tickIndexAt } from "./time";

function weatherWeights(prev: WeatherId | null): Record<WeatherId, number> {
  if (prev) {
    const row = WEATHER_CONDITIONAL[prev];
    if (row) return { ...row };
  }
  return { ...WEATHER_BASE_WEIGHTS };
}

/** All weather-roll epoch ms from `fromRollMs` through `toRollMs` inclusive. */
export function weatherRollsBetween(fromRollMs: number, toRollMs: number): number[] {
  if (toRollMs < fromRollMs) return [];
  const out: number[] = [];
  let t = fromRollMs;
  // Safety: 100 days * 6 = 600; allow a little headroom
  for (let i = 0; i < 800; i++) {
    out.push(t);
    if (t >= toRollMs) break;
    t = nextWeatherRollAfter(t);
  }
  return out;
}

export function nextWeatherRollAfter(ms: number): number {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const hour = d.getHours();
  const sorted = [...WEATHER_ROLL_HOURS].sort((a, b) => a - b);
  for (const h of sorted) {
    if (h > hour) return new Date(y, mo, day, h, 0, 0, 0).getTime();
  }
  return new Date(y, mo, day + 1, sorted[0]!, 0, 0, 0).getTime();
}

/** Memo: seed|runStartedAt|tick → weather at that roll tick. */
const weatherMemo = new Map<string, WeatherId>();

/**
 * Weather at `now`, chaining conditional weights from the run's first
 * applicable roll (latest roll at or before runStartedAt) forward.
 */
export function weatherAt(
  seed: string,
  runStartedAt: number,
  now: number,
): WeatherId {
  const currentRoll = latestWeatherRollAt(now, WEATHER_ROLL_HOURS);
  const startRoll = latestWeatherRollAt(runStartedAt, WEATHER_ROLL_HOURS);
  const currentTick = tickIndexAt(currentRoll);
  const memoKey = `${seed}|${runStartedAt}|${currentTick}`;
  const hit = weatherMemo.get(memoKey);
  if (hit) return hit;

  let prev: WeatherId | null = null;
  let result: WeatherId = "clear";
  for (const rollMs of weatherRollsBetween(startRoll, currentRoll)) {
    const tick = tickIndexAt(rollMs);
    const key = `${seed}|${runStartedAt}|${tick}`;
    const cached = weatherMemo.get(key);
    if (cached) {
      result = cached;
      prev = cached;
      continue;
    }
    const rng = rngFor(seed, "weather", tick);
    result = weightedPick(rng, weatherWeights(prev));
    weatherMemo.set(key, result);
    prev = result;
  }

  return result;
}

/** Weather that was rolled on a specific weather-roll moment. */
export function weatherAtRollMs(
  seed: string,
  runStartedAt: number,
  rollMs: number,
): WeatherId {
  return weatherAt(seed, runStartedAt, rollMs);
}
