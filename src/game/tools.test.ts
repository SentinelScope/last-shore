import { describe, expect, it } from "vitest";
import { canStartCraft, startActivity } from "./activities";
import { createNewRun } from "./persist";
import {
  bestCutTool,
  emptyToolRack,
  hasTool,
  placeOnToolRack,
  repairRackedToolWithTape,
  takeFromToolRack,
} from "./tools";

describe("tool rack", () => {
  it("frees an inventory slot while keeping the tool usable for cutting", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: emptyToolRack(),
      inventory: [
        { itemId: "stone_axe", qty: 1, durability: 20 },
        { itemId: "wood", qty: 1 },
      ],
    };
    const placed = placeOnToolRack(state, 0, 0);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    state = placed.state;
    expect(state.inventory.some((s) => s.itemId === "stone_axe")).toBe(false);
    expect(state.toolRack[0]?.itemId).toBe("stone_axe");
    expect(hasTool(state, "stone_axe")).toBe(true);
    expect(bestCutTool(state)).toBe("stone_axe");
    state = startActivity(state, "cut", "5m", 1_000_000);
    expect(state.activity?.tool).toBe("stone_axe");
  });

  it("rejects non-tools with a short reason", () => {
    let state = createNewRun(2_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: emptyToolRack(),
      inventory: [{ itemId: "wood", qty: 1 }],
    };
    const result = placeOnToolRack(state, 0, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/only tools/i);
  });

  it("lets a racked wooden hammer satisfy shelter crafts", () => {
    let state = createNewRun(3_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: [{ itemId: "wooden_hammer", qty: 1 }, null, null],
      inventory: [
        { itemId: "wood", qty: 6 },
        { itemId: "plant_fiber", qty: 4 },
      ],
    };
    expect(hasTool(state, "wooden_hammer")).toBe(true);
    const gate = canStartCraft(state, "lean_to");
    expect(gate.ok).toBe(true);
  });

  it("repairs a worn racked axe with duct tape", () => {
    let state = createNewRun(4_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: [{ itemId: "stone_axe", qty: 1, durability: 4 }, null, null],
      inventory: [{ itemId: "duct_tape", qty: 1 }],
    };
    const repaired = repairRackedToolWithTape(state, 0, 0);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.state.toolRack[0]?.durability).toBe(25);
    expect(repaired.state.inventory.some((s) => s.itemId === "duct_tape")).toBe(
      false,
    );
  });

  it("returns a racked tool to inventory on take", () => {
    let state = createNewRun(5_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: [{ itemId: "fishing_stick", qty: 1 }, null, null],
      inventory: [],
    };
    const taken = takeFromToolRack(state, 0);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.state.toolRack[0]).toBeNull();
    expect(taken.state.inventory[0]?.itemId).toBe("fishing_stick");
  });
});
