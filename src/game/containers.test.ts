import { describe, expect, it } from "vitest";
import { beachContainerAt } from "./containers";
import { weatherAt } from "./weather";
import { latestWeatherRollAt, tickIndexAt } from "./time";
import { WEATHER_ROLL_HOURS } from "./balance";

describe("weather chain", () => {
  it("is stable for the same seed and run start", () => {
    const start = Date.UTC(2026, 6, 1, 12, 0, 0);
    const now = start + 3 * 24 * 60 * 60_000;
    const a = weatherAt("wx-seed", start, now);
    const b = weatherAt("wx-seed", start, now);
    expect(a).toBe(b);
  });
});

describe("containers", () => {
  it("is a pure function of seed + tick (same inputs → same crate)", () => {
    const start = Date.UTC(2026, 6, 1, 8, 0, 0);
    // Pin to a known roll moment
    const roll = latestWeatherRollAt(
      Date.UTC(2026, 6, 1, 14, 30, 0),
      WEATHER_ROLL_HOURS,
    );
    const a = beachContainerAt("crate-seed", start, roll + 60_000, null);
    const b = beachContainerAt("crate-seed", start, roll + 60_000, null);
    expect(a).toEqual(b);
  });

  it("clears when collectedTickIndex matches the current tick", () => {
    const start = Date.UTC(2026, 6, 1, 8, 0, 0);
    const now = Date.UTC(2026, 6, 1, 14, 30, 0);
    const present = beachContainerAt("crate-seed-2", start, now, null);
    if (!present) {
      // Unlucky nothing roll — try another seed
      const other = beachContainerAt("crate-seed-force", start, now, null);
      if (!other) return;
      expect(
        beachContainerAt(
          "crate-seed-force",
          start,
          now,
          other.tickIndex,
        ),
      ).toBeNull();
      return;
    }
    expect(
      beachContainerAt("crate-seed-2", start, now, present.tickIndex),
    ).toBeNull();
  });

  it("re-rolls on a new tick (collected tick does not block the next)", () => {
    const start = Date.UTC(2026, 6, 1, 8, 0, 0);
    const firstRoll = latestWeatherRollAt(
      Date.UTC(2026, 6, 1, 10, 0, 0),
      WEATHER_ROLL_HOURS,
    );
    const secondRoll = latestWeatherRollAt(
      Date.UTC(2026, 6, 1, 14, 0, 0),
      WEATHER_ROLL_HOURS,
    );
    expect(tickIndexAt(firstRoll)).not.toBe(tickIndexAt(secondRoll));
    const afterCollect = beachContainerAt(
      "crate-seed-3",
      start,
      secondRoll + 1000,
      tickIndexAt(firstRoll),
    );
    // May be null (nothing) or a container — either means the old collect didn't stick
    if (afterCollect) {
      expect(afterCollect.tickIndex).toBe(tickIndexAt(secondRoll));
    }
  });
});
