import { describe, expect, it } from "vitest";
import { wearClothing, unequipClothing, totalWornComfort } from "./clothing";
import { createNewRun } from "./persist";
import { computeComfort } from "./vitals";

describe("clothing", () => {
  it("wearing a plant fibre hat raises comfort and frees the inventory slot", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [{ itemId: "fibre_hat", qty: 1 }],
    };
    expect(computeComfort(state, "clear")).toBe(0);

    const worn = wearClothing(state, 0);
    expect(worn.ok).toBe(true);
    if (!worn.ok) return;
    expect(worn.state.inventory).toHaveLength(0);
    expect(worn.state.worn.head).toBe("fibre_hat");
    expect(totalWornComfort(worn.state.worn)).toBe(1);
    expect(computeComfort(worn.state, "clear")).toBe(1);
  });

  it("clothing in the bag does not add comfort", () => {
    const state = {
      ...createNewRun(0),
      inventory: [{ itemId: "shirt", qty: 1 }],
    };
    expect(computeComfort(state, "clear")).toBe(0);
  });

  it("blocks unequip when inventory is full", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      storageTier: "sand",
      worn: { head: "hat", body: null, legs: null, feet: null },
      inventory: [
        { itemId: "wood", qty: 1 },
        { itemId: "stone", qty: 1 },
        { itemId: "coconut", qty: 1 },
        { itemId: "plant_fiber", qty: 1 },
        { itemId: "string", qty: 1 },
        { itemId: "tinder", qty: 1 },
        { itemId: "flint", qty: 1 },
        { itemId: "handkerchief", qty: 1 },
      ],
    };
    const result = unequipClothing(state, "head");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/full/i);
  });

  it("swap succeeds when bag is full but the worn piece frees a slot", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      storageTier: "sand",
      worn: { head: "hat", body: null, legs: null, feet: null },
      inventory: [
        { itemId: "fibre_hat", qty: 1 },
        { itemId: "wood", qty: 1 },
        { itemId: "stone", qty: 1 },
        { itemId: "coconut", qty: 1 },
        { itemId: "plant_fiber", qty: 1 },
        { itemId: "string", qty: 1 },
        { itemId: "tinder", qty: 1 },
        { itemId: "flint", qty: 1 },
      ],
    };
    const result = wearClothing(state, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.worn.head).toBe("fibre_hat");
    expect(result.state.inventory.some((s) => s.itemId === "hat")).toBe(true);
  });

  it("unequip returns the item to inventory", () => {
    let state = createNewRun(0);
    state = {
      ...state,
      worn: { head: "fibre_hat", body: null, legs: null, feet: null },
      inventory: [],
    };
    const off = unequipClothing(state, "head");
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.state.worn.head).toBeNull();
    expect(off.state.inventory).toEqual([{ itemId: "fibre_hat", qty: 1 }]);
  });
});
