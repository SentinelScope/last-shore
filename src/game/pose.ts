import type { DayPart, WeatherId } from "./balance";

export type PoseId = "stare" | "lean" | "fish" | "fire" | "hut" | "bed";

/**
 * Milestone 1 pose rules (from the brief):
 * asleep at Dawn and Night, at the fire in Golden Hour,
 * watching the sea at Day, sheltering in Rain and Storm.
 */
export function poseFor(dayPart: DayPart, weather: WeatherId): PoseId {
  if (weather === "rain" || weather === "storm") return "hut";
  if (dayPart === "dawn" || dayPart === "night") return "bed";
  if (dayPart === "golden") return "fire";
  return "stare";
}
