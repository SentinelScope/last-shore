import {
  CONTAINER_LABEL,
  CONTAINER_ODDS,
  LOOT_POOLS,
  WEATHER_ROLL_HOURS,
  type ContainerRoll,
  type ContainerTier,
  type LootRarity,
} from "./balance";
import { pickDocumentItemId, veryRarePoolFor } from "./documents";
import type { InventorySlot } from "./persist";
import { rngFor, weightedPick } from "./rng";
import { latestWeatherRollAt, tickIndexAt } from "./time";
import { weatherAtRollMs } from "./weather";

// Re-export for tests / callers that want the gated pool helper.
export { veryRarePoolFor } from "./documents";

export type BeachContainer = {
  tier: ContainerTier;
  tickIndex: number;
  rollMs: number;
  contents: InventorySlot[];
};

function pickFromPool(
  rng: () => number,
  rarity: LootRarity,
  tier: ContainerTier,
  documentsRead: readonly number[],
): string {
  if (rarity === "very_rare") {
    const pool = veryRarePoolFor(tier, documentsRead);
    return pool[Math.floor(rng() * pool.length)]!;
  }
  const pool = LOOT_POOLS[rarity];
  const id = pool[Math.floor(rng() * pool.length)]!;
  // One common pool entry expands to a random numbered document (repeats ok).
  if (id === "document") return pickDocumentItemId(rng);
  return id;
}

function push(contents: InventorySlot[], itemId: string): void {
  contents.push({ itemId, qty: 1 });
}

function rollExtra(
  rng: () => number,
  weights: Record<string, number>,
): string {
  return weightedPick(rng, weights);
}

function rollContents(
  seed: string,
  tickIndex: number,
  tier: ContainerTier,
  documentsRead: readonly number[],
): InventorySlot[] {
  const rng = rngFor(seed, "container-loot", tickIndex);
  const contents: InventorySlot[] = [];
  const pick = (rarity: LootRarity) =>
    pickFromPool(rng, rarity, tier, documentsRead);

  if (tier === "small") {
    push(contents, pick("common"));
    const extra = rollExtra(rng, {
      second: 30,
      third: 10,
      none: 60,
    });
    if (extra === "second" || extra === "third") {
      push(contents, pick("common"));
    }
    if (extra === "third") {
      push(contents, pick("common"));
    }
  } else if (tier === "medium") {
    push(contents, pick("common"));
    push(contents, pick("common"));
    const extra = rollExtra(rng, {
      third: 50,
      rare: 30,
      two_rares: 10,
      none: 10,
    });
    if (extra === "third") push(contents, pick("common"));
    if (extra === "rare") push(contents, pick("rare"));
    if (extra === "two_rares") {
      push(contents, pick("rare"));
      push(contents, pick("rare"));
    }
  } else if (tier === "large") {
    push(contents, pick("common"));
    push(contents, pick("common"));
    push(contents, pick("common"));
    push(contents, pick("rare"));
    const extra = rollExtra(rng, {
      second_rare: 50,
      very_rare: 30,
      both: 20,
    });
    if (extra === "second_rare" || extra === "both") {
      push(contents, pick("rare"));
    }
    if (extra === "very_rare" || extra === "both") {
      push(contents, pick("very_rare"));
    }
  } else {
    // chest
    push(contents, pick("rare"));
    push(contents, pick("rare"));
    push(contents, pick("rare"));
    push(contents, pick("very_rare"));
    const extra = rollExtra(rng, {
      further_rare: 50,
      second_vr: 30,
      third_vr: 20,
    });
    if (extra === "further_rare") push(contents, pick("rare"));
    if (extra === "second_vr") push(contents, pick("very_rare"));
    if (extra === "third_vr") {
      push(contents, pick("very_rare"));
      push(contents, pick("very_rare"));
    }
  }

  return contents;
}

function oddsTable(
  weather: string,
  rollMs: number,
): Record<ContainerRoll, number> {
  if (weather === "storm") return CONTAINER_ODDS.storm;
  const hour = new Date(rollMs).getHours();
  if (hour === 18) return CONTAINER_ODDS.golden;
  return CONTAINER_ODDS.normal;
}

/**
 * Pure function of (seed, current weather-roll tick, documents read).
 * Returns null for a "nothing" roll, or if the player already collected this tick.
 */
export function beachContainerAt(
  seed: string,
  runStartedAt: number,
  now: number,
  collectedTickIndex: number | null,
  documentsRead: readonly number[] = [],
): BeachContainer | null {
  const rollMs = latestWeatherRollAt(now, WEATHER_ROLL_HOURS);
  const tickIndex = tickIndexAt(rollMs);
  if (collectedTickIndex === tickIndex) return null;

  const weather = weatherAtRollMs(seed, runStartedAt, rollMs);
  const odds = oddsTable(weather, rollMs);
  const rng = rngFor(seed, "container", tickIndex);
  const roll = weightedPick(rng, odds);
  if (roll === "nothing") return null;

  return {
    tier: roll,
    tickIndex,
    rollMs,
    contents: rollContents(seed, tickIndex, roll, documentsRead),
  };
}

export function containerTitle(tier: ContainerTier): string {
  return CONTAINER_LABEL[tier];
}
