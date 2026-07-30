import { describe, expect, it } from "vitest";
import { startActivity, resolveActivityIfDue, rollActivityLoot } from "./activities";
import { createNewRun } from "./persist";

describe("activities", () => {
  it("does not resolve before endsAt", () => {
    let state = createNewRun(1_000_000);
    state = startActivity(state, "scour", "5m", 1_000_000);
    expect(state.activity).not.toBeNull();
    const mid = resolveActivityIfDue(state, 1_000_000 + 60_000);
    expect(mid.activity).not.toBeNull();
    expect(mid).toBe(state);
  });

  it("resolves after endsAt and always keeps at least one stone from scour", () => {
    let state = createNewRun(1_000_000);
    state = startActivity(state, "scour", "5m", 1_000_000);
    const ends = state.activity!.endsAt;
    const done = resolveActivityIfDue(state, ends);
    expect(done.activity).toBeNull();
    expect(done.pendingResults).not.toBeNull();
    const stone =
      (done.pendingResults!.kept.find((k) => k.itemId === "stone")?.qty ?? 0) +
      (done.pendingResults!.lost.find((k) => k.itemId === "stone")?.qty ?? 0);
    expect(stone).toBeGreaterThanOrEqual(1);
  });

  it("scour loot is deterministic for the same seed and start time", () => {
    const a = createNewRun(1_000_000);
    a.seed = "fixed-seed";
    const act = startActivity(a, "scour", "1h", 5_000_000).activity!;
    const x = rollActivityLoot(act, "fixed-seed");
    const y = rollActivityLoot(act, "fixed-seed");
    expect(x).toEqual(y);
  });

  it("cut yields wood from bare stone", () => {
    let state = createNewRun(1_000_000);
    state = startActivity(state, "cut", "5m", 1_000_000);
    expect(state.activity?.tool).toBe("bare");
    const done = resolveActivityIfDue(state, state.activity!.endsAt);
    const wood =
      (done.pendingResults!.kept.find((k) => k.itemId === "wood")?.qty ?? 0) +
      (done.pendingResults!.lost.find((k) => k.itemId === "wood")?.qty ?? 0);
    expect(wood).toBe(1);
  });
});
