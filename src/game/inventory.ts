import { ITEMS } from "./items";
import type { InventorySlot } from "./persist";
import {
  storageSlotCount,
  WATER_CAPACITY,
  type StorageTierId,
} from "./balance";

export type LootPile = { itemId: string; qty: number }[];

export function countItem(inventory: InventorySlot[], itemId: string): number {
  return inventory
    .filter((s) => s.itemId === itemId)
    .reduce((n, s) => n + s.qty, 0);
}

export function hasItem(inventory: InventorySlot[], itemId: string): boolean {
  return countItem(inventory, itemId) > 0;
}

/** Collapse identical itemIds into a display list (sums qty). */
export function mergeLoot(loot: LootPile): LootPile {
  const map = new Map<string, number>();
  for (const { itemId, qty } of loot) {
    map.set(itemId, (map.get(itemId) ?? 0) + qty);
  }
  return [...map.entries()].map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * Try to place loot into inventory honouring stack sizes and slot count.
 * Returns the updated inventory plus what was kept / lost to the sea.
 */
export function placeLoot(
  inventory: InventorySlot[],
  storageTier: StorageTierId,
  loot: LootPile,
): { inventory: InventorySlot[]; kept: LootPile; lost: LootPile } {
  const maxSlots = storageSlotCount(storageTier);
  const next = inventory.map((s) => ({ ...s }));
  const kept: LootPile = [];
  const lost: LootPile = [];

  for (const { itemId, qty: total } of mergeLoot(loot)) {
    const def = ITEMS[itemId];
    if (!def || total <= 0) continue;
    let remaining = total;
    let accepted = 0;

    // Fill existing stacks first
    for (const slot of next) {
      if (remaining <= 0) break;
      if (slot.itemId !== itemId) continue;
      const room = def.stack - slot.qty;
      if (room <= 0) continue;
      const add = Math.min(room, remaining);
      slot.qty += add;
      remaining -= add;
      accepted += add;
    }

    // New stacks while slots remain
    while (remaining > 0 && next.length < maxSlots) {
      const add = Math.min(def.stack, remaining);
      next.push({ itemId, qty: add });
      remaining -= add;
      accepted += add;
    }

    if (accepted > 0) kept.push({ itemId, qty: accepted });
    if (remaining > 0) lost.push({ itemId, qty: remaining });
  }

  return { inventory: next, kept, lost };
}

export function removeItems(
  inventory: InventorySlot[],
  costs: { itemId: string; qty: number }[],
): InventorySlot[] | null {
  const next = inventory.map((s) => ({ ...s }));
  for (const { itemId, qty } of costs) {
    let need = qty;
    for (const slot of next) {
      if (need <= 0) break;
      if (slot.itemId !== itemId) continue;
      const take = Math.min(slot.qty, need);
      slot.qty -= take;
      need -= take;
    }
    if (need > 0) return null;
  }
  return next.filter((s) => s.qty > 0);
}

export function missingCosts(
  inventory: InventorySlot[],
  costs: { itemId: string; qty: number }[],
): { itemId: string; need: number; have: number }[] {
  return costs
    .map(({ itemId, qty }) => ({
      itemId,
      need: qty,
      have: countItem(inventory, itemId),
    }))
    .filter((m) => m.have < m.need);
}

export function isWaterContainer(itemId: string): boolean {
  return itemId in WATER_CAPACITY;
}
