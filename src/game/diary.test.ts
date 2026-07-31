import { describe, expect, it } from "vitest";
import { startActivity, resolveActivityIfDue } from "./activities";
import {
  DIARY_IDLE_OBSERVATIONS,
  DIARY_IDLE_INTERVAL_MS,
  DIARY_RETENTION_MS,
} from "./balance";
import {
  appendDiaryEntry,
  groupDiaryByDay,
  maybeWriteIdleDiary,
  pruneDiary,
  writeContainerDiary,
} from "./diary";
import { createNewRun } from "./persist";

describe("diary", () => {
  it("writes an activity entry when scour resolves", () => {
    let state = createNewRun(1_000_000);
    state = startActivity(state, "scour", "5m", 1_000_000);
    const done = resolveActivityIfDue(state, state.activity!.endsAt);
    expect(done.diary.length).toBeGreaterThanOrEqual(1);
    expect(done.diary[0]!.kind).toBe("activity");
    expect(done.diary[0]!.text.length).toBeGreaterThan(10);
    expect(done.diary[0]!.text).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("prunes entries older than 72 hours", () => {
    const now = 10_000_000;
    const entries = [
      {
        id: "old",
        dayNumber: 1,
        text: "old",
        deltas: [],
        kind: "idle" as const,
        at: now - DIARY_RETENTION_MS - 1,
      },
      {
        id: "new",
        dayNumber: 2,
        text: "new",
        deltas: [],
        kind: "idle" as const,
        at: now - 1000,
      },
    ];
    expect(pruneDiary(entries, now).map((e) => e.id)).toEqual(["new"]);
  });

  it("cycles idle observations without repeat until exhausted", () => {
    let state = createNewRun(0);
    state = { ...state, diaryLastIdleAt: 0 };
    const seen = new Set<string>();
    for (let i = 1; i <= DIARY_IDLE_OBSERVATIONS.length; i++) {
      state = maybeWriteIdleDiary(state, i * DIARY_IDLE_INTERVAL_MS);
      const latest = state.diary[0]!;
      expect(latest.kind).toBe("idle");
      expect(seen.has(latest.text)).toBe(false);
      seen.add(latest.text);
    }
    expect(seen.size).toBe(DIARY_IDLE_OBSERVATIONS.length);
  });

  it("writes a chest entry and very-rare lines for kept VR loot", () => {
    let state = createNewRun(2_000_000);
    state = writeContainerDiary(state, {
      tier: "chest",
      kept: [
        { itemId: "canister", qty: 1 },
        { itemId: "wood", qty: 1 },
      ],
      at: 2_000_000,
    });
    const kinds = state.diary.map((e) => e.kind);
    expect(kinds).toContain("chest");
    expect(kinds).toContain("very_rare");
    expect(state.diary.some((e) => /canister/i.test(e.text))).toBe(true);
  });

  it("groups newest-first entries under Day headings", () => {
    let state = createNewRun(0);
    // Append oldest first so unshift yields newest-first order
    state = appendDiaryEntry(state, {
      dayNumber: 1,
      text: "first day",
      deltas: [],
      kind: "idle",
      at: 100,
    });
    state = appendDiaryEntry(state, {
      dayNumber: 2,
      text: "second day earlier",
      deltas: [],
      kind: "idle",
      at: 200,
    });
    state = appendDiaryEntry(state, {
      dayNumber: 2,
      text: "second day newer",
      deltas: [],
      kind: "idle",
      at: 300,
    });
    const groups = groupDiaryByDay(state.diary);
    expect(groups[0]!.dayNumber).toBe(2);
    expect(groups[0]!.entries).toHaveLength(2);
    expect(groups[1]!.dayNumber).toBe(1);
  });
});
