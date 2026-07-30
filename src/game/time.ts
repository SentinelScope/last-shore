import type { DayPart } from "./balance";

export function dayPartAt(ms: number): DayPart {
  const h = new Date(ms).getHours();
  if (h >= 4 && h < 10) return "dawn";
  if (h >= 10 && h < 18) return "day";
  if (h >= 18 && h < 20) return "golden";
  return "night";
}

/** Minute-index since Unix epoch — key for weather rolls. */
export function tickIndexAt(ms: number): number {
  return Math.floor(ms / 60_000);
}

/**
 * Epoch ms of the most recent weather-roll minute at or before `ms`
 * (local clock hours 02, 06, 10, 14, 18, 22).
 */
export function latestWeatherRollAt(
  ms: number,
  hours: readonly number[],
): number {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const sorted = [...hours].sort((a, b) => a - b);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const candidate = new Date(y, mo, day, sorted[i]!, 0, 0, 0).getTime();
    if (candidate <= ms) return candidate;
  }
  // Before today's first roll → yesterday's last roll
  const last = sorted[sorted.length - 1]!;
  return new Date(y, mo, day - 1, last, 0, 0, 0).getTime();
}

export function dayNumber(runStartedAt: number, now: number): number {
  return Math.floor((now - runStartedAt) / 86_400_000) + 1;
}
