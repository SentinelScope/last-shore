import { describe, expect, it } from "vitest";
import {
  WEATHER_BASE_WEIGHTS,
  WEATHER_CONDITIONAL,
  type WeatherId,
} from "./balance";
import { freakWaveDeathLine } from "./ailments";
import { AILMENT_TABLE } from "./balance";

function sumWeights(row: Record<WeatherId, number>): number {
  return Object.values(row).reduce((a, b) => a + b, 0);
}

describe("omen weather", () => {
  it("every weather weight row totals 100", () => {
    expect(sumWeights(WEATHER_BASE_WEIGHTS)).toBe(100);
    expect(sumWeights(WEATHER_CONDITIONAL.overcast!)).toBe(100);
    expect(sumWeights(WEATHER_CONDITIONAL.rain!)).toBe(100);
    expect(sumWeights(WEATHER_CONDITIONAL.omen!)).toBe(100);
  });

  it("omen triples clear rates for cut and ankle; freak wave is flat 0.2", () => {
    expect(AILMENT_TABLE.cut_finger.chancePerMinutePercent.omen).toBe(0.3);
    expect(AILMENT_TABLE.twisted_ankle.chancePerMinutePercent.omen).toBe(0.15);
    expect(AILMENT_TABLE.freak_wave.chancePerMinutePercent.omen).toBe(0.2);
    expect(AILMENT_TABLE.lightning.chancePerMinutePercent.omen).toBeNull();
    expect(AILMENT_TABLE.heatstroke.chancePerMinutePercent.omen).toBeNull();
  });

  it("freak wave ending uses the real day number", () => {
    const line = freakWaveDeathLine(14);
    expect(line).toMatch(/fourteenth day/);
    expect(line).toMatch(/sky had been red/);
  });
});
