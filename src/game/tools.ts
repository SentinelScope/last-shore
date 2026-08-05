/**
 * Tools — durability, rack eligibility, and inventory∪rack availability.
 */

import type { CutTool, FishingToolId } from "./balance";
import { FISHING_TOOLS_PRIORITY } from "./balance";
import { freeInventorySlots } from "./clothing";
import { hasItem, placeLoot, removeFromSlot } from "./inventory";
import type { InventorySlot, SaveState } from "./persist";

/** Tools that may sit on the Tool Rack. */
export const RACKABLE_TOOLS = [
  "stone_axe",
  "metal_axe",
  "wooden_spear",
  "stone_spear",
  "wooden_hammer",
  "stone_hammer",
  "fishing_stick",
  "fishing_rod",
] as const;

export type RackableToolId = (typeof RACKABLE_TOOLS)[number];

export const TOOL_RACK_SLOTS = 3;

/** Max uses; hammers and fishing stick omit — they do not wear. */
export const TOOL_MAX_USES: Partial<Record<string, number>> = {
  stone_axe: 25,
  metal_axe: 60,
  wooden_spear: 15,
  stone_spear: 30,
  fishing_rod: 80,
};

export function isRackableTool(itemId: string): itemId is RackableToolId {
  return (RACKABLE_TOOLS as readonly string[]).includes(itemId);
}

export function toolMaxUses(itemId: string): number | null {
  return TOOL_MAX_USES[itemId] ?? null;
}

export function toolUsesRemaining(slot: InventorySlot): number | null {
  const max = toolMaxUses(slot.itemId);
  if (max == null) return null;
  return slot.durability ?? max;
}

export function emptyToolRack(): (InventorySlot | null)[] {
  return [null, null, null];
}

/** True if the item is in inventory or on the rack. */
export function hasTool(state: SaveState, itemId: string): boolean {
  if (hasItem(state.inventory, itemId)) return true;
  return (state.toolRack ?? []).some((s) => s?.itemId === itemId);
}

export function bestCutTool(state: SaveState): CutTool | null {
  if (hasTool(state, "metal_axe")) return "metal_axe";
  if (hasTool(state, "stone_axe")) return "stone_axe";
  if (hasItem(state.inventory, "stone")) return "bare";
  return null;
}

export function ownedFishingTools(state: SaveState): FishingToolId[] {
  return FISHING_TOOLS_PRIORITY.filter((id) => hasTool(state, id));
}

export function bestFishingTool(state: SaveState): FishingToolId | null {
  return ownedFishingTools(state)[0] ?? null;
}

export function fishingToolLabel(id: FishingToolId): string {
  switch (id) {
    case "fishing_rod":
      return "Fishing Rod";
    case "stone_spear":
      return "Stone Spear";
    case "fishing_stick":
      return "Fishing Stick";
    case "wooden_spear":
      return "Wooden Spear";
  }
}

/**
 * Spend one use of a tool in inventory or on the rack.
 * Tools without a max (stick, hammers) are untouched. At 0 uses the tool is removed.
 */
export function wearToolUse(
  state: SaveState,
  itemId: string,
): { state: SaveState; broke: boolean } {
  const max = toolMaxUses(itemId);
  if (max == null) return { state, broke: false };

  const invIdx = state.inventory.findIndex((s) => s.itemId === itemId);
  if (invIdx >= 0) {
    const slot = state.inventory[invIdx]!;
    const current = slot.durability ?? max;
    const next = current - 1;
    if (next <= 0) {
      const inventory = removeFromSlot(state.inventory, invIdx, 1);
      if (!inventory) return { state, broke: false };
      return { state: { ...state, inventory }, broke: true };
    }
    const inventory = state.inventory.map((s, i) =>
      i === invIdx ? { ...s, durability: next } : s,
    );
    return { state: { ...state, inventory }, broke: false };
  }

  const rack = [...(state.toolRack ?? emptyToolRack())];
  const rackIdx = rack.findIndex((s) => s?.itemId === itemId);
  if (rackIdx < 0) return { state, broke: false };
  const tool = rack[rackIdx]!;
  const current = tool.durability ?? max;
  const next = current - 1;
  if (next <= 0) {
    rack[rackIdx] = null;
    return { state: { ...state, toolRack: rack }, broke: true };
  }
  rack[rackIdx] = { ...tool, durability: next };
  return { state: { ...state, toolRack: rack }, broke: false };
}

export function withToolDurability(slot: InventorySlot): InventorySlot {
  const max = toolMaxUses(slot.itemId);
  if (max == null) return { ...slot };
  return {
    ...slot,
    durability: slot.durability ?? max,
  };
}

export function placeOnToolRack(
  state: SaveState,
  inventoryIndex: number,
  rackIndex: number,
): { ok: true; state: SaveState } | { ok: false; reason: string } {
  if (!state.hasToolRack) {
    return { ok: false, reason: "No tool rack yet." };
  }
  const slot = state.inventory[inventoryIndex];
  if (!slot) return { ok: false, reason: "Nothing there." };
  if (!isRackableTool(slot.itemId)) {
    return { ok: false, reason: "Only tools go on the rack." };
  }
  if (rackIndex < 0 || rackIndex >= TOOL_RACK_SLOTS) {
    return { ok: false, reason: "No room there." };
  }

  const rack = [...(state.toolRack ?? emptyToolRack())];
  while (rack.length < TOOL_RACK_SLOTS) rack.push(null);

  const placing = withToolDurability({
    itemId: slot.itemId,
    qty: 1,
    durability: slot.durability,
  });

  let inventory = removeFromSlot(state.inventory, inventoryIndex, 1);
  if (!inventory) return { ok: false, reason: "Nothing there." };

  const displaced = rack[rackIndex];
  if (displaced) {
    const back = placeLoot(inventory, state.storageTier, [
      {
        itemId: displaced.itemId,
        qty: 1,
      },
    ]);
    if (back.lost.length) {
      return { ok: false, reason: "No room to take the other tool off." };
    }
    inventory = back.inventory;
    const restored = inventory.find((s) => s.itemId === displaced.itemId);
    if (restored && displaced.durability !== undefined) {
      restored.durability = displaced.durability;
    }
  }

  rack[rackIndex] = placing;
  return {
    ok: true,
    state: { ...state, inventory, toolRack: rack },
  };
}

export function takeFromToolRack(
  state: SaveState,
  rackIndex: number,
): { ok: true; state: SaveState } | { ok: false; reason: string } {
  const rack = [...(state.toolRack ?? emptyToolRack())];
  const tool = rack[rackIndex];
  if (!tool) return { ok: false, reason: "Empty." };
  if (freeInventorySlots(state.inventory, state.storageTier) < 1) {
    return { ok: false, reason: "No room in your pack." };
  }
  const placed = placeLoot(state.inventory, state.storageTier, [
    { itemId: tool.itemId, qty: 1 },
  ]);
  if (placed.lost.length) {
    return { ok: false, reason: "No room in your pack." };
  }
  const inv = placed.inventory;
  const slot = inv.find((s) => s.itemId === tool.itemId);
  if (slot && tool.durability !== undefined) slot.durability = tool.durability;
  rack[rackIndex] = null;
  return { ok: true, state: { ...state, inventory: inv, toolRack: rack } };
}

/** Consume one duct tape to restore a racked tool to full durability. */
export function repairRackedToolWithTape(
  state: SaveState,
  rackIndex: number,
  tapeInventoryIndex: number,
): { ok: true; state: SaveState } | { ok: false; reason: string } {
  const tape = state.inventory[tapeInventoryIndex];
  if (!tape || tape.itemId !== "duct_tape") {
    return { ok: false, reason: "Need duct tape." };
  }
  const rack = [...(state.toolRack ?? emptyToolRack())];
  const tool = rack[rackIndex];
  if (!tool) return { ok: false, reason: "Empty." };
  const max = toolMaxUses(tool.itemId);
  if (max == null) {
    return { ok: false, reason: "That tool does not wear." };
  }
  const current = tool.durability ?? max;
  if (current >= max) {
    return { ok: false, reason: "Already sound." };
  }
  const inventory = removeFromSlot(state.inventory, tapeInventoryIndex, 1);
  if (!inventory) return { ok: false, reason: "Need duct tape." };
  rack[rackIndex] = { ...tool, durability: max };
  return { ok: true, state: { ...state, inventory, toolRack: rack } };
}

/** Repair a tool still in the inventory (duct tape drop). */
export function repairInventoryToolWithTape(
  state: SaveState,
  toolInventoryIndex: number,
  tapeInventoryIndex: number,
): { ok: true; state: SaveState } | { ok: false; reason: string } {
  if (toolInventoryIndex === tapeInventoryIndex) {
    return { ok: false, reason: "Need duct tape." };
  }
  const tool = state.inventory[toolInventoryIndex];
  const tape = state.inventory[tapeInventoryIndex];
  if (!tool || !isRackableTool(tool.itemId)) {
    return { ok: false, reason: "Only tools take tape." };
  }
  if (!tape || tape.itemId !== "duct_tape") {
    return { ok: false, reason: "Need duct tape." };
  }
  const max = toolMaxUses(tool.itemId);
  if (max == null) {
    return { ok: false, reason: "That tool does not wear." };
  }
  const current = tool.durability ?? max;
  if (current >= max) {
    return { ok: false, reason: "Already sound." };
  }
  // Remove tape first; index may shift if tape is before tool.
  const inventory = state.inventory.map((s) => ({ ...s }));
  const tapeSlot = inventory[tapeInventoryIndex]!;
  if (tapeSlot.qty <= 1) inventory.splice(tapeInventoryIndex, 1);
  else inventory[tapeInventoryIndex] = { ...tapeSlot, qty: tapeSlot.qty - 1 };

  const toolIdx =
    tapeInventoryIndex < toolInventoryIndex
      ? toolInventoryIndex - (tapeSlot.qty <= 1 ? 1 : 0)
      : toolInventoryIndex;
  const cur = inventory[toolIdx];
  if (!cur || cur.itemId !== tool.itemId) {
    return { ok: false, reason: "Tool moved." };
  }
  inventory[toolIdx] = { ...cur, durability: max };
  return { ok: true, state: { ...state, inventory } };
}
