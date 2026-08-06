import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canStartStorageUpgrade,
  resolveActivityIfDue,
  startActivity,
  startStorageUpgrade,
} from "./activities";
import { storageSlotCount } from "./balance";
import { countItem } from "./inventory";
import { createNewRun } from "./persist";

vi.mock("./weather", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./weather")>();
  return {
    ...actual,
    weatherAt: () => "clear" as const,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storage upgrades", () => {
  it("starts satchel from sand, consumes materials, keeps old slot count until done", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      inventory: [
        { itemId: "plant_fiber", qty: 6 },
        { itemId: "string", qty: 2 },
        { itemId: "stone", qty: 1 },
      ],
    };

    expect(canStartStorageUpgrade(state).ok).toBe(true);
    state = startStorageUpgrade(state, t0);

    expect(state.storageTier).toBe("sand");
    expect(storageSlotCount(state.storageTier)).toBe(8);
    expect(countItem(state.inventory, "plant_fiber")).toBe(0);
    expect(countItem(state.inventory, "string")).toBe(0);
    expect(countItem(state.inventory, "stone")).toBe(1);
    expect(state.activity?.kind).toBe("craft");
    expect(state.activity?.recipeId).toBe("satchel");
    expect(state.activity?.endsAt).toBe(t0 + 10 * 60_000);
  });

  it("blocks while another player activity is running", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      inventory: [
        { itemId: "plant_fiber", qty: 6 },
        { itemId: "string", qty: 2 },
      ],
    };
    state = startActivity(state, "scour", "5m", t0);
    const gate = canStartStorageUpgrade(state);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.reason.toLowerCase()).toContain("scour");
    }
  });

  it("raises capacity and writes diary on completion", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      inventory: [
        { itemId: "plant_fiber", qty: 6 },
        { itemId: "string", qty: 2 },
      ],
    };
    state = startStorageUpgrade(state, t0);
    state = resolveActivityIfDue(state, t0 + 10 * 60_000);

    expect(state.activity).toBeNull();
    expect(state.storageTier).toBe("satchel");
    expect(storageSlotCount(state.storageTier)).toBe(12);
    expect(state.pendingResults).toBeNull();
    expect(state.diary[0]?.text.toLowerCase()).toMatch(/satchel|twelve|12/);
    expect(state.diary[0]?.deltas).toEqual([]);
  });

  it("is sequential — cannot skip to wooden box from sand", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      inventory: [
        { itemId: "wood", qty: 8 },
        { itemId: "string", qty: 2 },
      ],
    };
    // From sand, only satchel is offered — wood alone is not enough for it.
    expect(canStartStorageUpgrade(state).ok).toBe(false);
    state = startStorageUpgrade(state, t0);
    expect(state.activity).toBeNull();
    expect(state.storageTier).toBe("sand");
  });

  it("upgrades satchel → wooden → storage", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      storageTier: "satchel",
      inventory: [
        { itemId: "wood", qty: 20 },
        { itemId: "string", qty: 2 },
        { itemId: "metal_scrap", qty: 4 },
      ],
    };

    state = startStorageUpgrade(state, t0);
    expect(state.activity?.recipeId).toBe("wooden_box");
    state = resolveActivityIfDue(state, t0 + 20 * 60_000);
    expect(state.storageTier).toBe("wooden");
    expect(storageSlotCount(state.storageTier)).toBe(16);

    state = startStorageUpgrade(state, t0 + 21 * 60_000);
    expect(state.activity?.recipeId).toBe("storage_box");
    state = resolveActivityIfDue(state, t0 + 21 * 60_000 + 90 * 60_000);
    expect(state.storageTier).toBe("storage");
    expect(storageSlotCount(state.storageTier)).toBe(20);
    expect(canStartStorageUpgrade(state).ok).toBe(false);
  });
});
