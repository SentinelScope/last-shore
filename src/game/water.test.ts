import { describe, expect, it } from "vitest";
import { accumulateWaterFill } from "./water";

describe("water fill", () => {
  it("returns non-negative accumulation over a window", () => {
    const start = Date.UTC(2026, 6, 1, 12, 0, 0);
    const gained = accumulateWaterFill("w", start, start, start + 50 * 60_000);
    expect(gained).toBeGreaterThanOrEqual(0);
  });
});
