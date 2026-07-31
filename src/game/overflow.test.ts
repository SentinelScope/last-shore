import { describe, expect, it } from "vitest";
import { createNewRun } from "./persist";
import {
  confirmOverflow,
  lootFits,
  makeOverflow,
  projectOverflowSlots,
  slotsRequiredFor,
} from "./overflow";

describe("overflow fit", () => {
  it("stacks into existing slots before needing a new one", () => {
    const inv = [{ itemId: "wood", qty: 8 }];
    // wood stacks to 10 — 2 more fits in the same slot
    expect(slotsRequiredFor(inv, [{ itemId: "wood", qty: 2 }])).toBe(1);
    expect(lootFits(inv, "sand", [{ itemId: "wood", qty: 2 }])).toBe(true);
    // 3 more needs a second slot
    expect(slotsRequiredFor(inv, [{ itemId: "wood", qty: 3 }])).toBe(2);
  });

  it("detects when new slots would exceed sand capacity", () => {
    // Fill 8 slots with different items (stone stacks, so mix ids)
    const full = [
      { itemId: "stone", qty: 1 },
      { itemId: "wood", qty: 1 },
      { itemId: "plant_fiber", qty: 1 },
      { itemId: "string", qty: 1 },
      { itemId: "coconut", qty: 1 },
      { itemId: "tinder", qty: 1 },
      { itemId: "flint", qty: 1 },
      { itemId: "handkerchief", qty: 1 },
    ];
    expect(lootFits(full, "sand", [{ itemId: "photo", qty: 1 }])).toBe(false);
    expect(lootFits(full, "sand", [{ itemId: "stone", qty: 2 }])).toBe(true);
  });

  it("confirm leaves items and frees destroyed slots", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [
        { itemId: "stone", qty: 1 },
        { itemId: "wood", qty: 1 },
        { itemId: "plant_fiber", qty: 1 },
        { itemId: "string", qty: 1 },
        { itemId: "coconut", qty: 1 },
        { itemId: "tinder", qty: 1 },
        { itemId: "flint", qty: 1 },
        { itemId: "handkerchief", qty: 1 },
      ],
      pendingOverflow: makeOverflow("Scoured the tideline", "Found", [
        { itemId: "photo", qty: 1 },
        { itemId: "magazine", qty: 1 },
      ]),
    };

    const proj = projectOverflowSlots(state.inventory, state.storageTier, {
      destroyIndices: new Set([0]),
      keepIncoming: [{ itemId: "photo", qty: 1 }],
    });
    expect(proj.fits).toBe(true);

    const next = confirmOverflow(state, {
      keepIncoming: [true, false],
      destroyIndices: [0],
      at: 1_000_100,
    });
    expect(next.pendingOverflow).toBeNull();
    expect(next.inventory.some((s) => s.itemId === "stone")).toBe(false);
    expect(next.inventory.some((s) => s.itemId === "photo")).toBe(true);
    expect(next.inventory.some((s) => s.itemId === "magazine")).toBe(false);
    expect(next.diary.some((d) => /Left .*magazine/i.test(d.text))).toBe(true);
  });
});
