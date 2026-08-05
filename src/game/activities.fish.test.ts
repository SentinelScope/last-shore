import { describe, expect, it } from "vitest";
import {
  startActivity,
  resolveActivityIfDue,
  rollActivityLoot,
  canStartActivity,
} from "./activities";
import { createNewRun } from "./persist";
import { bestFishingTool, ownedFishingTools, wearToolUse } from "./tools";
import { FISH_CATCH_MAX } from "./balance";

describe("fishing", () => {
  it("requires a fishing tool", () => {
    const state = createNewRun(1_000_000);
    const gate = canStartActivity(state, "fish");
    expect(gate.ok).toBe(false);
  });

  it("picks fishing rod over spears and stick", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [
        { itemId: "wooden_spear", qty: 1, durability: 15 },
        { itemId: "fishing_stick", qty: 1 },
        { itemId: "stone_spear", qty: 1, durability: 30 },
        { itemId: "fishing_rod", qty: 1, durability: 80 },
      ],
    };
    expect(bestFishingTool(state)).toBe("fishing_rod");
    expect(ownedFishingTools(state)).toEqual([
      "fishing_rod",
      "stone_spear",
      "fishing_stick",
      "wooden_spear",
    ]);
  });

  it("accepts a tool on the rack", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      hasToolRack: true,
      toolRack: [{ itemId: "fishing_stick", qty: 1 }, null, null],
    };
    expect(canStartActivity(state, "fish").ok).toBe(true);
    state = startActivity(state, "fish", "5m", 1_000_000, {
      fishTool: "fishing_stick",
    });
    expect(state.activity?.kind).toBe("fish");
    expect(state.activity?.tool).toBe("fishing_stick");
  });

  it("resolves with only raw catches and wears the rod", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      seed: "fish-seed",
      inventory: [{ itemId: "fishing_rod", qty: 1, durability: 80 }],
    };
    state = startActivity(state, "fish", "1h", 1_000_000, {
      fishTool: "fishing_rod",
    });
    const ends = state.activity!.endsAt;
    const done = resolveActivityIfDue(state, ends);
    expect(done.activity).toBeNull();
    expect(done.pendingResults).not.toBeNull();
    const all = [
      ...done.pendingResults!.kept,
      ...done.pendingResults!.lost,
    ];
    for (const slot of all) {
      expect([
        "small_fish",
        "medium_fish",
        "large_fish",
        "boot",
        "empty_can",
        "gear",
        "glowing_rod",
      ]).toContain(slot.itemId);
      expect(slot.itemId.startsWith("cooked_")).toBe(false);
    }
    const rod = done.inventory.find((s) => s.itemId === "fishing_rod");
    expect(rod?.durability).toBe(79);
  });

  it("catch count never exceeds the tool/duration max", () => {
    const state = createNewRun(1_000_000);
    state.seed = "bounds-seed";
    const act = startActivity(
      {
        ...state,
        inventory: [{ itemId: "fishing_stick", qty: 1 }],
      },
      "fish",
      "5m",
      2_000_000,
      { fishTool: "fishing_stick" },
    ).activity!;
    for (let i = 0; i < 40; i++) {
      const loot = rollActivityLoot(
        { ...act, startedAt: 2_000_000 + i * 60_000 },
        "bounds-seed",
      );
      const qty = loot.reduce((n, s) => n + s.qty, 0);
      expect(qty).toBeLessThanOrEqual(FISH_CATCH_MAX.fishing_stick["5m"]);
    }
  });

  it("breaks a wooden spear at zero uses and still keeps the catch", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      seed: "break-seed",
      inventory: [{ itemId: "wooden_spear", qty: 1, durability: 1 }],
    };
    state = startActivity(state, "fish", "20m", 1_000_000, {
      fishTool: "wooden_spear",
    });
    const done = resolveActivityIfDue(state, state.activity!.endsAt);
    expect(done.inventory.find((s) => s.itemId === "wooden_spear")).toBeUndefined();
    expect(done.diary.some((e) => /spear/i.test(e.text))).toBe(true);
  });

  it("wearToolUse is a no-op for fishing stick", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [{ itemId: "fishing_stick", qty: 1 }],
    };
    const worn = wearToolUse(state, "fishing_stick");
    expect(worn.broke).toBe(false);
    expect(worn.state.inventory).toEqual(state.inventory);
  });
});
