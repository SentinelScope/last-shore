/**
 * Tool Rack beach placement — small prop near storage.
 * Uses the item PNG (1024×1024, ground ~y=880).
 */

export const TOOL_RACK_SRC = "/items/tool_rack.png";

export const TOOL_RACK_PNG = 1024;
export const TOOL_RACK_GROUND_Y = 880;
export const TOOL_RACK_CENTRE_X = 512;

/** Smaller than storage so it stays secondary. */
export const BEACH_TOOL_RACK_SCALE = 48 / TOOL_RACK_GROUND_Y;
export const BEACH_TOOL_RACK_SIZE = TOOL_RACK_PNG * BEACH_TOOL_RACK_SCALE;

/** Just left of storage, clear of the fire and drying poles. */
export const BEACH_TOOL_RACK_FEET = { x: 198, y: 748 };

export function toolRackImageRect(
  feet: { x: number; y: number } = BEACH_TOOL_RACK_FEET,
  scale: number = BEACH_TOOL_RACK_SCALE,
): { x: number; y: number; size: number } {
  const size = TOOL_RACK_PNG * scale;
  return {
    x: feet.x - TOOL_RACK_CENTRE_X * scale,
    y: feet.y - TOOL_RACK_GROUND_Y * scale,
    size,
  };
}
