/**
 * Storage PNG placement on the beach.
 * Sources are 1024×1024, ground at y=880, horizontal centre x=512.
 */

import type { StorageTierId } from "./balance";

export const STORAGE_SRC: Record<StorageTierId, string> = {
  sand: "/structures/storage_sand.png",
  satchel: "/structures/storage_satchel.png",
  wooden: "/structures/storage_wooden_box.png",
  storage: "/structures/storage_box.png",
};

/** Caption / UI names (title case). */
export const STORAGE_TIER_NAME: Record<StorageTierId, string> = {
  sand: "Sand",
  satchel: "Satchel",
  wooden: "Wooden box",
  storage: "Storage box",
};

export const STORAGE_PNG = 1024;
export const STORAGE_GROUND_Y = 880;
export const STORAGE_CENTRE_X = 512;

/**
 * Shared beach scale — storage box reads largest because its art fills more of
 * the canvas. Kept under the fireplace width so fire / water / storage can share
 * the lower sand without overlapping.
 */
export const BEACH_STORAGE_SCALE = 72 / STORAGE_GROUND_Y;
export const BEACH_STORAGE_SIZE = STORAGE_PNG * BEACH_STORAGE_SCALE;

/**
 * Ground contact — left and slightly down of the old crate (~248,740), clear of
 * the fire on the left and the drying rack on the right.
 */
export const BEACH_STORAGE_FEET = { x: 236, y: 762 };

export function storageImageRect(
  feet: { x: number; y: number },
  scale: number,
): { x: number; y: number; size: number } {
  const size = STORAGE_PNG * scale;
  return {
    x: feet.x - STORAGE_CENTRE_X * scale,
    y: feet.y - STORAGE_GROUND_Y * scale,
    size,
  };
}

export function isStorageTierId(value: string): value is StorageTierId {
  return (
    value === "sand" ||
    value === "satchel" ||
    value === "wooden" ||
    value === "storage"
  );
}
