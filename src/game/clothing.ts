/**
 * Worn clothing — comfort only while equipped.
 */

import {
  storageSlotCount,
  type StorageTierId,
} from "./balance";
import { ITEMS, itemComfortBonus } from "./items";
import type { InventorySlot, SaveState, WornGear } from "./persist";

export type ClothingSlotId = keyof WornGear;

export const CLOTHING_SLOTS: ClothingSlotId[] = [
  "head",
  "body",
  "legs",
  "feet",
];

/** itemId → body slot. Comfort comes from item tags / CLOTHING_COMFORT. */
export const CLOTHING_SLOT: Record<string, ClothingSlotId> = {
  fibre_hat: "head",
  hat: "head",
  sunglasses: "head",
  fibre_shirt: "body",
  shirt: "body",
  fibre_pants: "legs",
  pants: "legs",
  fibre_sandals: "feet",
  pair_of_boots: "feet",
  sandals: "feet",
  sneakers: "feet",
};

/** Explicit comfort while worn (matches design table). */
export const CLOTHING_COMFORT: Record<string, number> = {
  fibre_hat: 1,
  hat: 3,
  sunglasses: 5,
  fibre_shirt: 2,
  shirt: 5,
  fibre_pants: 2,
  pants: 4,
  fibre_sandals: 1,
  pair_of_boots: 2,
  sandals: 3,
  sneakers: 5,
};

export function emptyWorn(): WornGear {
  return { head: null, body: null, legs: null, feet: null };
}

export function isClothing(itemId: string): boolean {
  return itemId in CLOTHING_SLOT;
}

export function clothingSlotFor(itemId: string): ClothingSlotId | null {
  return CLOTHING_SLOT[itemId] ?? null;
}

export function wornComfortBonus(itemId: string): number {
  if (itemId in CLOTHING_COMFORT) return CLOTHING_COMFORT[itemId]!;
  const def = ITEMS[itemId];
  return def ? itemComfortBonus(def) : 0;
}

export function totalWornComfort(worn: WornGear | undefined): number {
  if (!worn) return 0;
  let n = 0;
  for (const slot of CLOTHING_SLOTS) {
    const id = worn[slot];
    if (id) n += wornComfortBonus(id);
  }
  return n;
}

export function freeInventorySlots(
  inventory: InventorySlot[],
  storageTier: StorageTierId,
): number {
  return Math.max(0, storageSlotCount(storageTier) - inventory.length);
}

export type WearResult =
  | { ok: true; state: SaveState }
  | { ok: false; reason: string };

/** Move inventory clothing into its worn slot (swap if occupied). */
export function wearClothing(
  state: SaveState,
  inventoryIndex: number,
): WearResult {
  const slot = state.inventory[inventoryIndex];
  if (!slot) return { ok: false, reason: "Nothing there." };
  const bodySlot = clothingSlotFor(slot.itemId);
  if (!bodySlot) return { ok: false, reason: "That cannot be worn." };

  const worn = { ...(state.worn ?? emptyWorn()) };
  const previous = worn[bodySlot];
  let inventory = state.inventory.map((s) => ({ ...s }));

  // Remove one from inventory (clothing stacks to 1).
  const cur = inventory[inventoryIndex]!;
  if (cur.qty <= 1) inventory.splice(inventoryIndex, 1);
  else cur.qty -= 1;

  if (previous) {
    // Need a free slot for the swapped-off piece.
    if (freeInventorySlots(inventory, state.storageTier) < 1) {
      return {
        ok: false,
        reason: "No room to take off what you are wearing.",
      };
    }
    inventory.push({ itemId: previous, qty: 1 });
  }

  worn[bodySlot] = slot.itemId;
  return { ok: true, state: { ...state, inventory, worn } };
}

/** Remove worn item back into inventory. */
export function unequipClothing(
  state: SaveState,
  bodySlot: ClothingSlotId,
): WearResult {
  const worn = { ...(state.worn ?? emptyWorn()) };
  const itemId = worn[bodySlot];
  if (!itemId) return { ok: false, reason: "Nothing worn there." };
  if (freeInventorySlots(state.inventory, state.storageTier) < 1) {
    return { ok: false, reason: "Inventory is full." };
  }
  worn[bodySlot] = null;
  return {
    ok: true,
    state: {
      ...state,
      worn,
      inventory: [...state.inventory, { itemId, qty: 1 }],
    },
  };
}

/** Hat or plant-fibre hat on the head blocks heatstroke. */
export function isWearingSunHat(state: SaveState): boolean {
  const head = state.worn?.head;
  return head === "hat" || head === "fibre_hat";
}
