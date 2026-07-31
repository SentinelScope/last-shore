/**
 * Inventory overflow — choose what to keep when a haul will not fit.
 */

import { storageSlotCount, type StorageTierId } from "./balance";
import { writeLeftBehindDiary } from "./diary";
import { ITEMS } from "./items";
import type { InventorySlot, PendingOverflow, SaveState } from "./persist";
import {
  mergeLoot,
  placeLoot,
  type LootPile,
} from "./inventory";

/** Slots needed after merging loot into inventory (no capacity cap). */
export function slotsRequiredFor(
  inventory: InventorySlot[],
  loot: LootPile,
): number {
  const next = inventory.map((s) => ({ ...s }));
  for (const { itemId, qty: total } of mergeLoot(loot)) {
    const def = ITEMS[itemId];
    if (!def || total <= 0) continue;
    let remaining = total;

    for (const slot of next) {
      if (remaining <= 0) break;
      if (slot.itemId !== itemId) continue;
      const room = def.stack - slot.qty;
      if (room <= 0) continue;
      const add = Math.min(room, remaining);
      slot.qty += add;
      remaining -= add;
    }

    while (remaining > 0) {
      const add = Math.min(def.stack, remaining);
      next.push({ itemId, qty: add });
      remaining -= add;
    }
  }
  return next.length;
}

/** True when every unit of loot fits into free stack room + free slots. */
export function lootFits(
  inventory: InventorySlot[],
  storageTier: StorageTierId,
  loot: LootPile,
): boolean {
  if (loot.length === 0) return true;
  return (
    slotsRequiredFor(inventory, loot) <= storageSlotCount(storageTier)
  );
}

export function projectOverflowSlots(
  inventory: InventorySlot[],
  storageTier: StorageTierId,
  opts: {
    destroyIndices: ReadonlySet<number>;
    keepIncoming: InventorySlot[];
  },
): { used: number; max: number; fits: boolean } {
  const base = inventory.filter((_, i) => !opts.destroyIndices.has(i));
  const used = slotsRequiredFor(base, opts.keepIncoming);
  const max = storageSlotCount(storageTier);
  return { used, max, fits: used <= max };
}

export function makeOverflow(
  title: string,
  eyebrow: PendingOverflow["eyebrow"],
  incoming: LootPile,
): PendingOverflow {
  return {
    title,
    eyebrow,
    incoming: mergeLoot(incoming).map((s) => ({ ...s })),
  };
}

/**
 * Apply the player's keep / leave / destroy choices.
 * Destroyed inventory slots are removed; left incoming is gone.
 */
export function confirmOverflow(
  state: SaveState,
  opts: {
    keepIncoming: boolean[];
    destroyIndices: number[];
    at: number;
  },
): SaveState {
  const overflow = state.pendingOverflow;
  if (!overflow) return state;

  const destroy = new Set(opts.destroyIndices);
  let inventory = state.inventory.filter((_, i) => !destroy.has(i));

  const kept: LootPile = [];
  const left: LootPile = [];
  overflow.incoming.forEach((slot, i) => {
    if (opts.keepIncoming[i]) kept.push({ ...slot });
    else left.push({ ...slot });
  });

  const placed = placeLoot(inventory, state.storageTier, kept);
  // After the player made it fit, nothing should be lost — but be safe.
  inventory = placed.inventory;
  if (placed.lost.length > 0) {
    left.push(...placed.lost);
  }

  let next: SaveState = {
    ...state,
    inventory,
    pendingOverflow: null,
    pendingResults: {
      title: overflow.title,
      kept: placed.kept,
      lost: left,
      resolvedAt: opts.at,
    },
  };

  if (left.length > 0) {
    next = writeLeftBehindDiary(next, { left, at: opts.at });
  }
  return next;
}
