/**
 * Water-spot PNG placement and fill geometry.
 * Sources are 1024×1024, plinth ground at y=880, vessel ground at y=715
 * (165px higher — rests on the plinth top face). Shared centre x=512.
 */

import { WATER_CAPACITY } from "./balance";

export type WaterVesselId =
  | "empty_can"
  | "cup"
  | "coconut_cup"
  | "bottle"
  | "canister";

export const WATER_PLINTH_SRC = "/structures/water_spot.png";

export const WATER_VESSEL_SRC: Record<WaterVesselId, string> = {
  empty_can: "/structures/vessel_empty_can.png",
  cup: "/structures/vessel_cup.png",
  coconut_cup: "/structures/vessel_coconut_cup.png",
  bottle: "/structures/vessel_bottle.png",
  canister: "/structures/vessel_canister.png",
};

/** Caption names (sentence case). */
export const WATER_VESSEL_NAME: Record<WaterVesselId, string> = {
  empty_can: "Empty can",
  cup: "Cup",
  coconut_cup: "Coconut cup",
  bottle: "Bottle",
  canister: "Canister",
};

export type WaterFillStyle = "bowl" | "body" | "sight";

export type WaterFillGeom = {
  x0: number;
  x1: number;
  yFull: number;
  yEmpty: number;
  style: WaterFillStyle;
};

export const WATER_FILL_GEOM: Record<WaterVesselId, WaterFillGeom> = {
  empty_can: { x0: 428, x1: 596, yFull: 600, yEmpty: 852, style: "bowl" },
  cup: { x0: 448, x1: 640, yFull: 624, yEmpty: 846, style: "bowl" },
  coconut_cup: { x0: 392, x1: 636, yFull: 676, yEmpty: 846, style: "bowl" },
  bottle: { x0: 422, x1: 602, yFull: 470, yEmpty: 856, style: "body" },
  canister: { x0: 672, x1: 696, yFull: 470, yEmpty: 800, style: "sight" },
};

export const WATER_PNG = 1024;
export const WATER_GROUND_Y = 880;
/** Vessel art ground line — 165px above the plinth ground in source space. */
export const WATER_VESSEL_GROUND_Y = 715;
export const WATER_CENTRE_X = 512;

export const WATER_SURFACE = "#5AA5CC";
export const WATER_BODY = "#337395";
export const WATER_ALPHA = 0.92;

/**
 * Shared beach scale — plinth reads as a low stone cluster left of the fire.
 */
export const BEACH_WATER_SCALE = 80 / WATER_GROUND_Y;
export const BEACH_WATER_SIZE = WATER_PNG * BEACH_WATER_SCALE;

/** Sand contact under the stone plinth (old watercatch world position). */
export const BEACH_WATER_FEET = { x: 70, y: 778 };

export function waterImageRect(
  feet: { x: number; y: number },
  scale: number,
): { x: number; y: number; size: number } {
  const size = WATER_PNG * scale;
  return {
    x: feet.x - WATER_CENTRE_X * scale,
    y: feet.y - WATER_GROUND_Y * scale,
    size,
  };
}

/** Map a source-canvas point into scene coords (plinth ground = feet). */
export function waterSrcToScene(
  feet: { x: number; y: number },
  scale: number,
  src: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: feet.x + (src.x - WATER_CENTRE_X) * scale,
    y: feet.y + (src.y - WATER_GROUND_Y) * scale,
  };
}

/** Water surface Y in source space for a 0–100 fill. */
export function waterLevelY(geom: WaterFillGeom, fillPercent: number): number {
  const t = Math.max(0, Math.min(100, fillPercent)) / 100;
  return geom.yEmpty + (geom.yFull - geom.yEmpty) * t;
}

export function isWaterVesselId(value: string): value is WaterVesselId {
  return value in WATER_VESSEL_SRC;
}

export function waterVesselCapacity(itemId: WaterVesselId): number {
  return WATER_CAPACITY[itemId] ?? 25;
}

/** Caption: "Coconut cup — 18 of 25%" */
export function waterSpotCaption(
  itemId: WaterVesselId,
  fillPercent: number,
): string {
  const name = WATER_VESSEL_NAME[itemId];
  const cap = waterVesselCapacity(itemId);
  return `${name} — ${Math.round(fillPercent)} of ${cap}%`;
}
