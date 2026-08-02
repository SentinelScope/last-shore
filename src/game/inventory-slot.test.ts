import { describe, expect, it } from "vitest";
import { destroyItem, eatItem } from "./vitals";
import { createNewRun } from "./persist";
import { rollActivityLoot, startActivity, resolveActivityIfDue } from "./activities";

describe("destroyItem slot index", () => {
  it("destroys from the selected overflow stack, not the full stack", () => {
    let state = createNewRun(0);
    // Full stone stack + overflow slot of 2
    state = {
      ...state,
      inventory: [
        { itemId: "stone", qty: 20 },
        { itemId: "wood", qty: 1 },
        { itemId: "stone", qty: 2 },
      ],
    };
    const next = destroyItem(state, 2, 2);
    expect(next).not.toBeNull();
    expect(next!.inventory).toEqual([
      { itemId: "stone", qty: 20 },
      { itemId: "wood", qty: 1 },
    ]);
  });

  it("eatItem consumes from the selected slot only", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      inventory: [
        { itemId: "coconut", qty: 5 },
        { itemId: "coconut", qty: 1 },
      ],
      hunger: 50,
    };
    const next = eatItem(state, 1);
    expect(next).not.toBeNull();
    expect(next!.inventory).toEqual([{ itemId: "coconut", qty: 5 }]);
  });
});

describe("cut fibre by-product", () => {
  it("returns plant fiber at ~25% of wood yield", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [{ itemId: "stone", qty: 1 }],
    };
    state = startActivity(state, "cut", "1h", 1_000_000);
    const loot = rollActivityLoot(state.activity!, state.seed);
    const wood = loot.find((l) => l.itemId === "wood")?.qty ?? 0;
    const fibre = loot.find((l) => l.itemId === "plant_fiber")?.qty ?? 0;
    expect(wood).toBe(9);
    // 9 * 0.25 = 2.25 → 2 or 3
    expect(fibre).toBeGreaterThanOrEqual(2);
    expect(fibre).toBeLessThanOrEqual(3);
  });
});
