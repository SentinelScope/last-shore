/**
 * Shelter decoration — comfort display case (not general storage).
 */

import {
  SHELTER_DECOR_SLOTS,
  type ShelterTierId,
} from "./balance";
import {
  ITEMS,
  isCarriedComfortItem,
  itemComfortBonus,
} from "./items";
import { freeInventorySlots } from "./clothing";
import type { SaveState } from "./persist";

export function emptyShelterDecor(): (string | null)[] {
  return [null, null, null];
}

export function shelterSlotCount(tier: ShelterTierId): number {
  if (tier === "none") return 0;
  return SHELTER_DECOR_SLOTS[tier];
}

export function shelterDecorComfort(state: SaveState): number {
  let n = 0;
  for (const id of state.shelterDecor ?? []) {
    if (!id) continue;
    const def = ITEMS[id];
    if (!def || !isCarriedComfortItem(def)) continue;
    n += itemComfortBonus(def);
  }
  return n;
}

export type ShelterPlaceResult =
  | { ok: true; state: SaveState }
  | { ok: false; reason: string };

export function placeInShelter(
  state: SaveState,
  inventoryIndex: number,
  slotIndex: number,
): ShelterPlaceResult {
  const max = shelterSlotCount(state.shelterTier);
  if (max < 1) return { ok: false, reason: "No shelter yet." };
  if (slotIndex < 0 || slotIndex >= max) {
    return { ok: false, reason: "That shelf is not built yet." };
  }

  const invSlot = state.inventory[inventoryIndex];
  if (!invSlot) return { ok: false, reason: "Nothing there." };
  const def = ITEMS[invSlot.itemId];
  if (!def || !isCarriedComfortItem(def)) {
    return { ok: false, reason: "Only comfort items belong in the shelter." };
  }

  const decor = [...(state.shelterDecor ?? emptyShelterDecor())];
  while (decor.length < 3) decor.push(null);

  const displaced = decor[slotIndex];
  const inventory = state.inventory.map((s) => ({ ...s }));

  // Remove one from inventory
  const cur = inventory[inventoryIndex]!;
  if (cur.qty <= 1) inventory.splice(inventoryIndex, 1);
  else cur.qty -= 1;

  if (displaced) {
    if (freeInventorySlots(inventory, state.storageTier) < 1) {
      return {
        ok: false,
        reason: "No room to take back what was there.",
      };
    }
    inventory.push({ itemId: displaced, qty: 1 });
  }

  decor[slotIndex] = invSlot.itemId;
  return { ok: true, state: { ...state, inventory, shelterDecor: decor } };
}

export function takeFromShelter(
  state: SaveState,
  slotIndex: number,
): ShelterPlaceResult {
  const decor = [...(state.shelterDecor ?? emptyShelterDecor())];
  const itemId = decor[slotIndex];
  if (!itemId) return { ok: false, reason: "Empty." };
  if (freeInventorySlots(state.inventory, state.storageTier) < 1) {
    return { ok: false, reason: "Inventory is full." };
  }
  decor[slotIndex] = null;
  return {
    ok: true,
    state: {
      ...state,
      shelterDecor: decor,
      inventory: [...state.inventory, { itemId, qty: 1 }],
    },
  };
}
