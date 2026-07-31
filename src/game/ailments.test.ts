import { describe, expect, it } from "vitest";
import {
  buildAilmentViews,
  cureAilmentWithItem,
  forceAilment,
  rollAilmentsForActivityMinute,
} from "./ailments";
import { createNewRun } from "./persist";
import { catchUp, computeComfort } from "./vitals";

describe("ailments", () => {
  it("twisted ankle applies −3 comfort when other sources exist", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      shelterTier: "lean_to",
      inventory: [{ itemId: "bandage", qty: 1 }],
    };
    state = forceAilment(state, "twisted_ankle", 1_000_000);
    expect(computeComfort(state, "clear")).toBe(7); // 10 lean-to − 3 ankle
    const views = buildAilmentViews(state);
    expect(views[0]!.cureActionLabel).toBe("Use Bandage");
  });

  it("bandage cure clears twisted ankle and writes a diary entry", () => {
    let state = createNewRun(1_000_000);
    state = {
      ...state,
      inventory: [{ itemId: "bandage", qty: 1 }],
    };
    state = forceAilment(state, "twisted_ankle", 1_000_000);
    const cured = cureAilmentWithItem(state, "twisted_ankle", 1_100_000);
    expect(cured).not.toBeNull();
    expect(cured!.ailments).toHaveLength(0);
    expect(cured!.inventory.find((s) => s.itemId === "bandage")).toBeUndefined();
    expect(cured!.diary.some((e) => e.kind === "ailment")).toBe(true);
  });

  it("does not roll ailments during crafting", () => {
    let state = createNewRun(2_000_000);
    state = {
      ...state,
      activity: {
        kind: "craft",
        recipeId: "lean_to",
        startedAt: 2_000_000,
        endsAt: 2_000_000 + 60_000,
      },
    };
    // Force many rolls by using a seed — craft should never apply
    for (let i = 0; i < 200; i++) {
      const r = rollAilmentsForActivityMinute(
        { ...state, seed: `craft-${i}` },
        "craft",
        "storm",
        2_000_000 + i * 60_000,
      );
      expect(r.death).toBeNull();
      expect(r.state.ailments).toHaveLength(0);
    }
  });

  it("catch-up can apply a forced outdoor roll path without crashing", () => {
    let state = forceAilment(createNewRun(0), "cut_finger", 0);
    const { state: next, death } = catchUp(state, 60_000);
    expect(death).toBeNull();
    expect(next.ailments.some((a) => a.id === "cut_finger")).toBe(true);
  });
});
