import { beforeEach, describe, expect, it, vi } from "vitest";
import { canLight, lightFire, startCook, syncFireplace } from "./fire";
import { resolveActivityIfDue } from "./activities";
import { createNewRun, emptyFireplace } from "./persist";

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

describe("fireplace fuel", () => {
  it("burns 1 wood per hour and extinguishes when empty", () => {
    const t0 = 1_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      fireplace: {
        ...emptyFireplace(),
        built: "simple",
        lit: true,
        syncedAt: t0,
        slots: {
          ignition: null,
          tinder: null,
          fuelWood: 6,
          food: [null],
        },
      },
    };
    const after8h = syncFireplace(state, t0 + 8 * 3_600_000);
    expect(after8h.fireplace.lit).toBe(false);
    expect(after8h.fireplace.slots.fuelWood).toBe(0);
  });

  it("extends burn when wood remains after partial hours", () => {
    const t0 = 2_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      fireplace: {
        ...emptyFireplace(),
        built: "simple",
        lit: true,
        syncedAt: t0,
        slots: {
          ignition: null,
          tinder: null,
          fuelWood: 3,
          food: [null],
        },
      },
    };
    const after2h = syncFireplace(state, t0 + 2 * 3_600_000);
    expect(after2h.fireplace.lit).toBe(true);
    expect(after2h.fireplace.slots.fuelWood).toBe(1);
  });
});

describe("light and cook", () => {
  it("lights when ignition, tinder, and fuel are set", () => {
    const t0 = 3_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      fireplace: {
        ...emptyFireplace(),
        built: "simple",
        lit: false,
        syncedAt: t0,
        slots: {
          ignition: { itemId: "flint", qty: 1, durability: 8 },
          tinder: { itemId: "tinder", qty: 1 },
          fuelWood: 2,
          food: [null],
        },
      },
    };
    expect(canLight(state)).toBe(true);
    const lit = lightFire(state, t0);
    expect(lit.fireplace.lit).toBe(true);
    expect(lit.fireplace.slots.tinder).toBeNull();
    expect(lit.fireplace.slots.ignition?.durability).toBe(7);
  });

  it("cooks crab into cooked_crab after duration", () => {
    const t0 = 4_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      fireplace: {
        ...emptyFireplace(),
        built: "simple",
        lit: true,
        syncedAt: t0,
        slots: {
          ignition: null,
          tinder: null,
          fuelWood: 5,
          food: [{ itemId: "crab", qty: 1 }],
        },
      },
    };
    const cooking = startCook(state, 0, t0);
    expect(cooking).not.toBeNull();
    expect(cooking!.fireActivity?.kind).toBe("cook");
    const done = resolveActivityIfDue(cooking!, cooking!.fireActivity!.endsAt);
    expect(done.fireplace.slots.food[0]?.itemId).toBe("cooked_crab");
  });
});
