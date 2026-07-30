import {
  COOK_BASE_MS,
  COOKING_PAN_MULT,
  FIRE_FUEL_MAX,
  FIRE_WOOD_PER_HOUR,
  FIREPLACE_COOK_MULT,
  IGNITION_ITEMS,
  IGNITION_USES,
  WEATHER_ROLL_HOURS,
} from "./balance";
import { placeLoot, removeItems } from "./inventory";
import type { InventorySlot, SaveState } from "./persist";
import { latestWeatherRollAt } from "./time";
import { nextWeatherRollAfter, weatherAt } from "./weather";

function stormDuring(
  seed: string,
  runStartedAt: number,
  fromMs: number,
  toMs: number,
): boolean {
  if (toMs <= fromMs) return false;
  let t = fromMs;
  for (let i = 0; i < 2000 && t < toMs; i++) {
    const rollStart = latestWeatherRollAt(t, WEATHER_ROLL_HOURS);
    const nextRoll = nextWeatherRollAfter(rollStart);
    const segmentEnd = Math.min(toMs, nextRoll);
    if (weatherAt(seed, runStartedAt, t) === "storm") return true;
    t = segmentEnd;
  }
  return false;
}

/**
 * Apply fuel burn and storm extinguish from fireplace.syncedAt → now.
 * Wall-clock; safe to call on load and each tick.
 */
export function syncFireplace(state: SaveState, now: number): SaveState {
  const fp = state.fireplace;
  if (fp.built === "none") return state;
  if (!fp.lit) return state;

  const from = fp.syncedAt || now;
  if (now <= from) return state;

  if (stormDuring(state.seed, state.runStartedAt, from, now)) {
    return {
      ...state,
      fireplace: {
        ...fp,
        lit: false,
        syncedAt: now,
      },
    };
  }

  const hours = (now - from) / 3_600_000;
  const consumed = hours * FIRE_WOOD_PER_HOUR;
  const remaining = fp.slots.fuelWood - consumed;

  if (remaining <= 0) {
    return {
      ...state,
      fireplace: {
        ...fp,
        lit: false,
        syncedAt: now,
        slots: { ...fp.slots, fuelWood: 0 },
      },
    };
  }

  return {
    ...state,
    fireplace: {
      ...fp,
      syncedAt: now,
      slots: { ...fp.slots, fuelWood: remaining },
    },
  };
}

export function canLight(state: SaveState): boolean {
  const fp = state.fireplace;
  if (fp.built === "none" || fp.lit) return false;
  if (!fp.slots.ignition || !fp.slots.tinder) return false;
  if (fp.slots.fuelWood < 1) return false;
  return true;
}

/** Complete a successful hold-to-light. Consumes tinder + 1 ignition use. */
export function lightFire(state: SaveState, now: number): SaveState {
  const next = syncFireplace(state, now);
  if (!canLight(next)) return next;
  const fp = next.fireplace;
  const ign = fp.slots.ignition!;
  const uses = (ign.durability ?? IGNITION_USES[ign.itemId] ?? 1) - 1;

  return {
    ...next,
    fireplace: {
      ...fp,
      lit: true,
      syncedAt: now,
      slots: {
        ...fp.slots,
        tinder: null,
        ignition:
          uses <= 0 ? null : { ...ign, qty: 1, durability: uses },
      },
    },
  };
}

export function isIgnition(itemId: string): boolean {
  return (IGNITION_ITEMS as readonly string[]).includes(itemId);
}

export function isCookable(itemId: string): boolean {
  return itemId in COOK_BASE_MS;
}

export function cookDurationMs(
  itemId: string,
  fireplaceTier: "simple" | "stone" | "cooking",
  hasPan: boolean,
): number {
  const base = COOK_BASE_MS[itemId] ?? 30 * 60_000;
  const tier = FIREPLACE_COOK_MULT[fireplaceTier];
  const pan = hasPan ? COOKING_PAN_MULT : 1;
  return Math.round(base * tier * pan);
}

export function hasPanInFood(slots: (InventorySlot | null)[]): boolean {
  return slots.some((s) => s?.itemId === "cooking_pan");
}

/** Move one inventory item into a fireplace slot. */
export function placeInFireplace(
  state: SaveState,
  inventoryIndex: number,
  target:
    | { kind: "ignition" }
    | { kind: "tinder" }
    | { kind: "fuel" }
    | { kind: "food"; slotIndex: number },
  now: number,
): SaveState | null {
  let next = syncFireplace(state, now);
  const slot = next.inventory[inventoryIndex];
  if (!slot) return null;
  const fp = next.fireplace;
  if (fp.built === "none") return null;

  if (target.kind === "ignition") {
    if (!isIgnition(slot.itemId)) return null;
    let inv = next.inventory.map((s) => ({ ...s }));
    const taking = inv[inventoryIndex]!;
    const piece: InventorySlot = {
      itemId: taking.itemId,
      qty: 1,
      durability: taking.durability ?? IGNITION_USES[taking.itemId] ?? 1,
    };
    if (taking.qty <= 1) inv.splice(inventoryIndex, 1);
    else inv[inventoryIndex] = { ...taking, qty: taking.qty - 1 };
    if (fp.slots.ignition) {
      const back = placeLoot(inv, next.storageTier, [
        { itemId: fp.slots.ignition.itemId, qty: 1 },
      ]);
      inv = back.inventory;
      const returned = inv.find((s) => s.itemId === fp.slots.ignition!.itemId);
      if (returned && fp.slots.ignition.durability !== undefined) {
        returned.durability = fp.slots.ignition.durability;
      }
      if (back.lost.length) return null;
    }
    return {
      ...next,
      inventory: inv,
      fireplace: {
        ...fp,
        slots: { ...fp.slots, ignition: piece },
      },
    };
  }

  if (target.kind === "tinder") {
    if (slot.itemId !== "tinder") return null;
    let inv = removeItems(next.inventory, [{ itemId: "tinder", qty: 1 }]);
    if (!inv) return null;
    if (fp.slots.tinder) {
      const back = placeLoot(inv, next.storageTier, [
        { itemId: "tinder", qty: 1 },
      ]);
      if (back.lost.length) return null;
      inv = back.inventory;
    }
    return {
      ...next,
      inventory: inv,
      fireplace: {
        ...fp,
        slots: { ...fp.slots, tinder: { itemId: "tinder", qty: 1 } },
      },
    };
  }

  if (target.kind === "fuel") {
    if (slot.itemId !== "wood") return null;
    const room = FIRE_FUEL_MAX - Math.floor(fp.slots.fuelWood);
    if (room <= 0) return null;
    const take = Math.min(room, slot.qty);
    const inv = removeItems(next.inventory, [{ itemId: "wood", qty: take }]);
    if (!inv) return null;
    next = syncFireplace({ ...next, inventory: inv }, now);
    return {
      ...next,
      fireplace: {
        ...next.fireplace,
        syncedAt: now,
        slots: {
          ...next.fireplace.slots,
          fuelWood: next.fireplace.slots.fuelWood + take,
        },
      },
    };
  }

  const foodSlots = [...fp.slots.food];
  const panPresent =
    hasPanInFood(foodSlots) || slot.itemId === "cooking_pan";
  if (
    target.slotIndex === 1 &&
    !panPresent &&
    foodSlots[0]?.itemId !== "cooking_pan"
  ) {
    return null;
  }

  if (slot.itemId === "cooking_pan") {
    const idx = target.slotIndex;
    let inv = next.inventory.map((s) => ({ ...s }));
    const taking = inv[inventoryIndex]!;
    if (taking.qty <= 1) inv.splice(inventoryIndex, 1);
    else inv[inventoryIndex] = { ...taking, qty: taking.qty - 1 };

    while (foodSlots.length < 2) foodSlots.push(null);
    if (foodSlots[idx]) {
      const back = placeLoot(inv, next.storageTier, [
        { itemId: foodSlots[idx]!.itemId, qty: foodSlots[idx]!.qty },
      ]);
      if (back.lost.length) return null;
      inv = back.inventory;
    }
    foodSlots[idx] = { itemId: "cooking_pan", qty: 1 };
    if (foodSlots.length < 2) foodSlots.push(null);
    return {
      ...next,
      inventory: inv,
      fireplace: { ...fp, slots: { ...fp.slots, food: foodSlots } },
    };
  }

  if (!isCookable(slot.itemId)) return null;

  let inv = next.inventory.map((s) => ({ ...s }));
  const taking = inv[inventoryIndex]!;
  const piece = { itemId: taking.itemId, qty: 1 };
  if (taking.qty <= 1) inv.splice(inventoryIndex, 1);
  else inv[inventoryIndex] = { ...taking, qty: taking.qty - 1 };

  while (foodSlots.length <= target.slotIndex) foodSlots.push(null);
  if (foodSlots[target.slotIndex]) {
    const back = placeLoot(inv, next.storageTier, [
      {
        itemId: foodSlots[target.slotIndex]!.itemId,
        qty: foodSlots[target.slotIndex]!.qty,
      },
    ]);
    if (back.lost.length) return null;
    inv = back.inventory;
  }
  foodSlots[target.slotIndex] = piece;
  return {
    ...next,
    inventory: inv,
    fireplace: { ...fp, slots: { ...fp.slots, food: foodSlots } },
  };
}

export function takeFromFireplace(
  state: SaveState,
  target:
    | { kind: "ignition" }
    | { kind: "tinder" }
    | { kind: "fuel"; qty?: number }
    | { kind: "food"; slotIndex: number },
  now: number,
): SaveState | null {
  const next = syncFireplace(state, now);
  const fp = next.fireplace;

  if (target.kind === "ignition" && fp.slots.ignition) {
    const item = fp.slots.ignition;
    const { inventory, lost } = placeLoot(next.inventory, next.storageTier, [
      { itemId: item.itemId, qty: 1 },
    ]);
    if (lost.length) return null;
    const slot = inventory.find((s) => s.itemId === item.itemId);
    if (slot && item.durability !== undefined) slot.durability = item.durability;
    return {
      ...next,
      inventory,
      fireplace: {
        ...fp,
        slots: { ...fp.slots, ignition: null },
      },
    };
  }

  if (target.kind === "tinder" && fp.slots.tinder) {
    const { inventory, lost } = placeLoot(next.inventory, next.storageTier, [
      { itemId: "tinder", qty: 1 },
    ]);
    if (lost.length) return null;
    return {
      ...next,
      inventory,
      fireplace: { ...fp, slots: { ...fp.slots, tinder: null } },
    };
  }

  if (target.kind === "fuel" && fp.slots.fuelWood >= 1) {
    const qty = Math.min(
      target.qty ?? Math.floor(fp.slots.fuelWood),
      Math.floor(fp.slots.fuelWood),
    );
    if (qty < 1) return null;
    const synced = syncFireplace(next, now);
    const { inventory, lost } = placeLoot(
      synced.inventory,
      synced.storageTier,
      [{ itemId: "wood", qty }],
    );
    if (lost.length) return null;
    return {
      ...synced,
      inventory,
      fireplace: {
        ...synced.fireplace,
        slots: {
          ...synced.fireplace.slots,
          fuelWood: synced.fireplace.slots.fuelWood - qty,
        },
      },
    };
  }

  if (target.kind === "food") {
    const food = fp.slots.food[target.slotIndex];
    if (!food) return null;
    const { inventory, lost } = placeLoot(next.inventory, next.storageTier, [
      { itemId: food.itemId, qty: food.qty },
    ]);
    if (lost.length) return null;
    const foodSlots = [...fp.slots.food];
    foodSlots[target.slotIndex] = null;
    if (food.itemId === "cooking_pan" && foodSlots[1]) {
      const back = placeLoot(inventory, next.storageTier, [
        { itemId: foodSlots[1]!.itemId, qty: foodSlots[1]!.qty },
      ]);
      foodSlots[1] = null;
      if (back.lost.length) return null;
      return {
        ...next,
        inventory: back.inventory,
        fireplace: {
          ...fp,
          slots: { ...fp.slots, food: [null] },
        },
      };
    }
    return {
      ...next,
      inventory,
      fireplace: { ...fp, slots: { ...fp.slots, food: foodSlots } },
    };
  }

  return null;
}

export function startCook(
  state: SaveState,
  slotIndex: number,
  now: number,
): SaveState | null {
  const next = syncFireplace(state, now);
  if (next.activity) return null;
  if (!next.fireplace.lit) return null;
  const food = next.fireplace.slots.food[slotIndex];
  if (!food || !isCookable(food.itemId)) return null;
  if (food.itemId === "cooking_pan") return null;

  const pan = hasPanInFood(next.fireplace.slots.food);
  const duration = cookDurationMs(food.itemId, "simple", pan);

  return {
    ...next,
    activity: {
      kind: "cook",
      cookItemId: food.itemId,
      cookSlotIndex: slotIndex,
      startedAt: now,
      endsAt: now + duration,
    },
  };
}
