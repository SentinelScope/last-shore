import { describe, expect, it } from "vitest";
import { createNewRun } from "./persist";
import { placeInShelter, takeFromShelter } from "./shelter";
import { computeComfort } from "./vitals";

describe("shelter decor", () => {
  it("places a handkerchief in a lean-to and keeps its comfort", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      shelterTier: "lean_to",
      inventory: [{ itemId: "handkerchief", qty: 1 }],
    };
    expect(computeComfort(state, "clear")).toBe(13); // lean-to 10 + hanky 3

    const placed = placeInShelter(state, 0, 0);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.state.inventory).toHaveLength(0);
    expect(placed.state.shelterDecor[0]).toBe("handkerchief");
    // still lean-to + handkerchief comfort
    expect(computeComfort(placed.state, "clear")).toBe(13);
  });

  it("rejects non-comfort items", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      shelterTier: "lean_to",
      inventory: [{ itemId: "wood", qty: 1 }],
    };
    const result = placeInShelter(state, 0, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/comfort/i);
  });

  it("returns a placed item to inventory", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      shelterTier: "lean_to",
      shelterDecor: ["handkerchief", null, null],
      inventory: [],
    };
    const taken = takeFromShelter(state, 0);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.state.shelterDecor[0]).toBeNull();
    expect(taken.state.inventory).toEqual([{ itemId: "handkerchief", qty: 1 }]);
  });
});
