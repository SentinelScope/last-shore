import { describe, expect, it } from "vitest";
import { emptyFireplace, type SaveState } from "./persist";
import {
  computeComfort,
  hoursUntilDeathAtComfort,
} from "./vitals";

function bareState(inventory: SaveState["inventory"] = []): SaveState {
  return {
    version: 1,
    seed: "test",
    runStartedAt: 0,
    lastSimulatedAt: 0,
    thirst: 100,
    hunger: 100,
    health: 100,
    comfort: 0,
    storageTier: "sand",
    inventory,
    activity: null,
    pendingResults: null,
    collectedTickIndex: null,
    fireplace: emptyFireplace(),
    waterSpot: { itemId: null, placedAt: 0, drunkPercent: 0 },
    shelterTier: "none",
    bedTier: "none",
    hasLogChair: false,
  };
}

describe("vitals death times", () => {
  it("dies at 48.5 hours at 0% comfort when left alone", () => {
    const hours = hoursUntilDeathAtComfort(0);
    expect(hours).toBeCloseTo(48.5, 1);
  });

  it("dies at 73.0 hours at 100% comfort when left alone", () => {
    const hours = hoursUntilDeathAtComfort(100);
    expect(hours).toBeCloseTo(73.0, 1);
  });
});

describe("carried comfort items", () => {
  it("adds inventory comfort items into the comfort bar", () => {
    const state = bareState([
      { itemId: "photo", qty: 1 },
      { itemId: "volleyball", qty: 1 },
      { itemId: "wood", qty: 3 },
    ]);
    // clear weather: photo 2 + volleyball 10
    expect(computeComfort(state, "clear")).toBe(12);
  });

  it("does not count clothing left in the bag (must be worn)", () => {
    const state = bareState([{ itemId: "shirt", qty: 1 }]);
    expect(computeComfort(state, "clear")).toBe(0);
  });

  it("stacks with fire and weather", () => {
    const state = bareState([{ itemId: "book", qty: 1 }]);
    state.fireplace = { ...emptyFireplace(), built: "simple", lit: true };
    // book 4 + fire 15 + storm -20 = -1 → clamp 0? 4+15-20 = -1 → 0
    expect(computeComfort(state, "storm")).toBe(0);
    // book 4 + fire 15 = 19
    expect(computeComfort(state, "clear")).toBe(19);
  });
});
