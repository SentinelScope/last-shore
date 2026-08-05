/**
 * Fireplace PNG placement — shared by beach SVG and the fireplace page.
 * Sources are 1024×1024, ground at y≈880, horizontal centre x=512.
 */

export type FireplaceBuiltTier = "simple" | "stone" | "cooking";

export const FIREPLACE_SRC: Record<FireplaceBuiltTier, string> = {
  simple: "/structures/fireplace_simple.png",
  stone: "/structures/fireplace_stone.png",
  cooking: "/structures/fireplace_cooking.png",
};

/**
 * Flame / ember origin in source-canvas coordinates.
 * Pit centres sit near x≈498; ash.x is nudged left so the asymmetric
 * flame path (leans right of its transform origin) reads centred over
 * the wood / grate. ash.y sits a bit above the fuel so the animated
 * flame clears the structure rather than sitting inside it.
 */
export const FIREPLACE_ASH: Record<
  FireplaceBuiltTier,
  { x: number; y: number }
> = {
  simple: { x: 488, y: 485 },
  stone: { x: 490, y: 445 },
  cooking: { x: 492, y: 350 },
};

export const FIREPLACE_PNG = 1024;
export const FIREPLACE_GROUND_Y = 880;
export const FIREPLACE_CENTRE_X = 512;

/**
 * Shared beach scale — cooking reads tallest because its art fills more of the
 * canvas above the ground line. ~93 SVG units across (20% under the prior 100).
 */
export const BEACH_FIRE_SCALE = 80 / FIREPLACE_GROUND_Y;
export const BEACH_FIRE_SIZE = FIREPLACE_PNG * BEACH_FIRE_SCALE;

/** Sand contact under the stone ring / pit base. */
export const BEACH_FIRE_FEET = { x: 134, y: 722 };

/**
 * Fireplace page ≈ 6× beach, then trimmed ~15% so the closeup fits and the
 * ash-bed anchors stay readable.
 */
export const PAGE_FIRE_SCALE = BEACH_FIRE_SCALE * 6 * 0.85;
export const PAGE_FIRE_SIZE = FIREPLACE_PNG * PAGE_FIRE_SCALE;
/** Flame / ember / smoke scale relative to beach SVG units. */
export const PAGE_FIRE_FX_SCALE = PAGE_FIRE_SCALE / BEACH_FIRE_SCALE;

export function fireplaceImageRect(
  feet: { x: number; y: number },
  scale: number,
): { x: number; y: number; size: number } {
  const size = FIREPLACE_PNG * scale;
  return {
    x: feet.x - FIREPLACE_CENTRE_X * scale,
    y: feet.y - FIREPLACE_GROUND_Y * scale,
    size,
  };
}

/** Scene / page coordinates of the flame origin for the active tier. */
export function fireplaceAshAt(
  feet: { x: number; y: number },
  scale: number,
  tier: FireplaceBuiltTier,
): { x: number; y: number } {
  const ash = FIREPLACE_ASH[tier];
  return {
    x: feet.x + (ash.x - FIREPLACE_CENTRE_X) * scale,
    y: feet.y + (ash.y - FIREPLACE_GROUND_Y) * scale,
  };
}

export function isFireplaceBuiltTier(
  value: string,
): value is FireplaceBuiltTier {
  return value === "simple" || value === "stone" || value === "cooking";
}
