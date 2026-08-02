"use client";

import { memo, useLayoutEffect, useRef } from "react";
import {
  DAY_PART_CLASS,
  WEATHER_CLASS,
  type DayPart,
  type WeatherId,
} from "@/game/balance";
import {
  BEACH_FIRE_FEET,
  BEACH_FIRE_SCALE,
  FIREPLACE_SRC,
  fireplaceAshAt,
  fireplaceImageRect,
  isFireplaceBuiltTier,
  type FireplaceBuiltTier,
} from "@/game/fireplaceArt";
import type { PoseId } from "@/game/pose";
import {
  BEACH_STORAGE_FEET,
  BEACH_STORAGE_SCALE,
  STORAGE_PNG,
  STORAGE_SRC,
  storageImageRect,
  isStorageTierId,
} from "@/game/storageArt";
import type { StorageTierId } from "@/game/balance";
import {
  BEACH_WATER_FEET,
  BEACH_WATER_SCALE,
  WATER_ALPHA,
  WATER_BODY,
  WATER_FILL_GEOM,
  WATER_PLINTH_SRC,
  WATER_SURFACE,
  WATER_VESSEL_SRC,
  isWaterVesselId,
  waterImageRect,
  waterLevelY,
  waterSrcToScene,
  type WaterVesselId,
} from "@/game/waterArt";
import { WORLD_SVG } from "@/scene/worldMarkup";

/** PNG ground line y=880, centre x=512 → standing figure ≈80 SVG units tall. */
const CASTAWAY_SIZE = (1024 * 80) / 880;
const CASTAWAY_SRC: Record<PoseId, string> = {
  stare: "/character/pose_stare.png",
  lean: "/character/pose_lean.png",
  fish: "/character/pose_fish.png",
  fire: "/character/pose_fire.png",
  hut: "/character/pose_shelter.png",
  bed: "/character/pose_sleep.png",
};
/** Feet / ground contact in world viewBox coords (matches old pose placements). */
const CASTAWAY_FEET: Record<PoseId, { x: number; y: number }> = {
  stare: { x: 197, y: 653 },
  lean: { x: 66, y: 693 },
  fish: { x: 234, y: 516 },
  fire: { x: 172, y: 717 },
  hut: { x: 272, y: 697 },
  bed: { x: 280, y: 694 },
};

export type WorldSceneProps = {
  dayPart: DayPart;
  weather: WeatherId;
  pose: PoseId;
  fireLit: boolean;
  hasFireplace: boolean;
  /** Active built tier when hasFireplace. */
  fireplaceTier: FireplaceBuiltTier;
  storageTier: StorageTierId;
  hasShelter: boolean;
  hasWater: boolean;
  /** Placed vessel itemId, or null when empty. */
  waterItemId: string | null;
  /** 0–100 cup fill. */
  waterLevel: number;
  /** False while an activity is running — empty beach. */
  figureVisible: boolean;
};

export const DEFAULT_SCENE_PROPS: WorldSceneProps = {
  dayPart: "golden",
  weather: "clear",
  pose: "stare",
  fireLit: false,
  hasFireplace: false,
  fireplaceTier: "simple",
  storageTier: "sand",
  hasShelter: false,
  hasWater: false,
  waterItemId: null,
  waterLevel: 0,
  figureVisible: true,
};

function placeImageRect(
  img: Element,
  rect: { x: number; y: number; size: number },
  src?: string,
) {
  if (src) setImageHref(img, src);
  img.setAttribute("x", String(rect.x));
  img.setAttribute("y", String(rect.y));
  img.setAttribute("width", String(rect.size));
  img.setAttribute("height", String(rect.size));
}

function applyWaterSpot(
  svg: Element,
  itemId: string | null,
  fillPercent: number,
) {
  const rect = waterImageRect(BEACH_WATER_FEET, BEACH_WATER_SCALE);
  const plinth = svg.querySelector("#water-plinth");
  const vessel = svg.querySelector("#water-vessel");
  const maskImg = svg.querySelector("#water-mask-img");
  const mask = svg.querySelector("#water-vessel-mask");
  const fillRoot = svg.querySelector("#water-fill");
  const body = svg.querySelector("#water-body");
  const surface = svg.querySelector("#water-surface");
  const shadow = svg.querySelector("#water-shadow");

  if (plinth) placeImageRect(plinth, rect, WATER_PLINTH_SRC);
  if (mask) {
    mask.setAttribute("x", String(rect.x));
    mask.setAttribute("y", String(rect.y));
    mask.setAttribute("width", String(rect.size));
    mask.setAttribute("height", String(rect.size));
  }
  if (shadow) {
    shadow.setAttribute("cx", String(BEACH_WATER_FEET.x));
    shadow.setAttribute("cy", String(BEACH_WATER_FEET.y));
    shadow.setAttribute("rx", String(rect.size * 0.32));
    shadow.setAttribute("ry", String(rect.size * 0.075));
  }

  const vesselId =
    itemId && isWaterVesselId(itemId) ? (itemId as WaterVesselId) : null;
  const src = vesselId ? WATER_VESSEL_SRC[vesselId] : null;

  if (vessel) {
    if (src) placeImageRect(vessel, rect, src);
    vessel.setAttribute("opacity", src ? "1" : "0");
  }
  if (maskImg) {
    if (src) placeImageRect(maskImg, rect, src);
  }

  if (!fillRoot || !body || !surface || !vesselId || fillPercent <= 0) {
    if (fillRoot) fillRoot.setAttribute("opacity", "0");
    return;
  }

  const geom = WATER_FILL_GEOM[vesselId];
  const scale = BEACH_WATER_SCALE;
  const feet = BEACH_WATER_FEET;
  const ySrc = waterLevelY(geom, fillPercent);
  const topLeft = waterSrcToScene(feet, scale, { x: geom.x0, y: ySrc });
  const bottomRight = waterSrcToScene(feet, scale, {
    x: geom.x1,
    y: geom.yEmpty,
  });
  const width = Math.max(0.5, bottomRight.x - topLeft.x);
  const height = Math.max(0, bottomRight.y - topLeft.y);
  const cx = (topLeft.x + bottomRight.x) / 2;

  body.setAttribute("x", String(topLeft.x));
  body.setAttribute("y", String(topLeft.y));
  body.setAttribute("width", String(width));
  body.setAttribute("height", String(height));
  body.setAttribute("fill", WATER_BODY);
  body.setAttribute("fill-opacity", String(WATER_ALPHA));

  if (geom.style === "sight") {
    // Opaque canister — only the narrow sight strip; no surface disc.
    surface.setAttribute("opacity", "0");
  } else {
    const rx = width * 0.48;
    const ry = Math.max(1.2, scale * (geom.style === "body" ? 10 : 14));
    surface.setAttribute("cx", String(cx));
    surface.setAttribute("cy", String(topLeft.y));
    surface.setAttribute("rx", String(rx));
    surface.setAttribute("ry", String(ry));
    surface.setAttribute("fill", WATER_SURFACE);
    surface.setAttribute("fill-opacity", String(WATER_ALPHA));
    surface.setAttribute("opacity", "1");
  }

  fillRoot.setAttribute("opacity", "1");
}

function worldClassName(p: WorldSceneProps): string {
  return [
    "scene",
    "world",
    DAY_PART_CLASS[p.dayPart],
    WEATHER_CLASS[p.weather],
    `show-${p.pose}`,
    p.hasFireplace ? "has-fireplace" : "",
    p.fireLit ? "fire-lit" : "",
    p.hasShelter ? "has-shelter" : "",
    p.hasWater ? "has-water" : "",
    p.figureVisible ? "" : "figure-away",
  ]
    .filter(Boolean)
    .join(" ");
}

function setImageHref(img: Element, src: string) {
  if (img.getAttribute("href") !== src) {
    img.setAttribute("href", src);
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", src);
  }
}

function placeCastaway(svg: Element, pose: PoseId, visible: boolean) {
  const img = svg.querySelector("#castaway");
  if (!img) return;
  const feet = CASTAWAY_FEET[pose];
  const src = CASTAWAY_SRC[pose];
  const x = String(feet.x - CASTAWAY_SIZE / 2);
  const y = String(feet.y - 80);
  const size = String(CASTAWAY_SIZE);
  setImageHref(img, src);
  if (img.getAttribute("x") !== x) img.setAttribute("x", x);
  if (img.getAttribute("y") !== y) img.setAttribute("y", y);
  if (img.getAttribute("width") !== size) img.setAttribute("width", size);
  if (img.getAttribute("height") !== size) img.setAttribute("height", size);
  img.setAttribute("visibility", visible ? "visible" : "hidden");
}

function placeFireplaceStruct(img: Element, tier: FireplaceBuiltTier) {
  const rect = fireplaceImageRect(BEACH_FIRE_FEET, BEACH_FIRE_SCALE);
  const src = FIREPLACE_SRC[tier];
  setImageHref(img, src);
  img.setAttribute("x", String(rect.x));
  img.setAttribute("y", String(rect.y));
  img.setAttribute("width", String(rect.size));
  img.setAttribute("height", String(rect.size));
}

function placeFireFx(svg: Element, tier: FireplaceBuiltTier) {
  const ash = fireplaceAshAt(BEACH_FIRE_FEET, BEACH_FIRE_SCALE, tier);
  const light = svg.querySelector("#firelight");
  if (light) {
    light.setAttribute("cx", String(ash.x));
    light.setAttribute("cy", String(ash.y));
  }
  const live = svg.querySelector("#fire-live-root");
  if (live) {
    // Keep flame art proportional to the beach PNG scale (was authored at 100/880).
    const fx = BEACH_FIRE_SCALE / (100 / 880);
    live.setAttribute("transform", `translate(${ash.x},${ash.y}) scale(${fx})`);
  }
}

/**
 * Cross-fade fireplace PNG over ~300ms when the tier changes.
 * Uses two stacked <image> nodes so the outgoing art stays visible while fading.
 */
function applyFireplaceTier(
  host: HTMLDivElement,
  svg: Element,
  tier: FireplaceBuiltTier,
  hasFireplace: boolean,
) {
  if (!hasFireplace) {
    host.dataset.fireTier = "";
    return;
  }
  const a = svg.querySelector("#fireplace-a");
  const b = svg.querySelector("#fireplace-b");
  if (!a || !b) return;

  const prev = host.dataset.fireTier;
  if (prev === tier) {
    placeFireFx(svg, tier);
    return;
  }

  placeFireFx(svg, tier);

  if (!prev || !isFireplaceBuiltTier(prev)) {
    placeFireplaceStruct(a, tier);
    a.setAttribute("opacity", "1");
    b.setAttribute("opacity", "0");
    host.dataset.fireTier = tier;
    host.dataset.fireFront = "a";
    return;
  }

  const frontIsA = host.dataset.fireFront !== "b";
  const front = frontIsA ? a : b;
  const back = frontIsA ? b : a;

  placeFireplaceStruct(back, tier);
  back.setAttribute("opacity", "0");
  // Force layout so the opacity transition runs from 0 → 1.
  void (back as SVGElement).getBoundingClientRect?.();
  requestAnimationFrame(() => {
    back.setAttribute("opacity", "1");
    front.setAttribute("opacity", "0");
  });
  host.dataset.fireFront = frontIsA ? "b" : "a";
  host.dataset.fireTier = tier;
}

function placeStorageStruct(img: Element, tier: StorageTierId) {
  const rect = storageImageRect(BEACH_STORAGE_FEET, BEACH_STORAGE_SCALE);
  const src = STORAGE_SRC[tier];
  setImageHref(img, src);
  img.setAttribute("x", String(rect.x));
  img.setAttribute("y", String(rect.y));
  img.setAttribute("width", String(rect.size));
  img.setAttribute("height", String(rect.size));
}

function placeStorageShadow(svg: Element) {
  const shadow = svg.querySelector("#storage-shadow");
  if (!shadow) return;
  const size = BEACH_STORAGE_SCALE * STORAGE_PNG;
  shadow.setAttribute("cx", String(BEACH_STORAGE_FEET.x));
  shadow.setAttribute("cy", String(BEACH_STORAGE_FEET.y));
  shadow.setAttribute("rx", String(size * 0.26));
  shadow.setAttribute("ry", String(size * 0.055));
}

/**
 * Cross-fade storage PNG over ~300ms when the tier changes.
 */
function applyStorageTier(
  host: HTMLDivElement,
  svg: Element,
  tier: StorageTierId,
) {
  const a = svg.querySelector("#storage-a");
  const b = svg.querySelector("#storage-b");
  if (!a || !b) return;

  placeStorageShadow(svg);

  const prev = host.dataset.storageTier;
  if (prev === tier) return;

  if (!prev || !isStorageTierId(prev)) {
    placeStorageStruct(a, tier);
    a.setAttribute("opacity", "1");
    b.setAttribute("opacity", "0");
    host.dataset.storageTier = tier;
    host.dataset.storageFront = "a";
    return;
  }

  const frontIsA = host.dataset.storageFront !== "b";
  const front = frontIsA ? a : b;
  const back = frontIsA ? b : a;

  placeStorageStruct(back, tier);
  back.setAttribute("opacity", "0");
  void (back as SVGElement).getBoundingClientRect?.();
  requestAnimationFrame(() => {
    back.setAttribute("opacity", "1");
    front.setAttribute("opacity", "0");
  });
  host.dataset.storageFront = frontIsA ? "b" : "a";
  host.dataset.storageTier = tier;
}

function applyAppearance(host: HTMLDivElement, props: WorldSceneProps) {
  const svg = host.querySelector("svg.scene");
  if (!svg) return;
  const nextClass = worldClassName(props);
  if (svg.getAttribute("class") !== nextClass) {
    svg.setAttribute("class", nextClass);
  }
  const castKey = `${props.pose}|${props.figureVisible ? 1 : 0}`;
  if (host.dataset.castaway !== castKey) {
    host.dataset.castaway = castKey;
    placeCastaway(svg, props.pose, props.figureVisible);
  }
  applyFireplaceTier(host, svg, props.fireplaceTier, props.hasFireplace);
  applyStorageTier(host, svg, props.storageTier);
  const level = props.hasWater ? props.waterLevel : 0;
  const vesselKey = props.hasWater ? (props.waterItemId ?? "") : "";
  const waterKey = `${vesselKey}|${level}`;
  if (host.dataset.waterKey !== waterKey) {
    host.dataset.waterKey = waterKey;
    applyWaterSpot(svg, props.hasWater ? props.waterItemId : null, level);
  }
}

function ensureInjected(host: HTMLDivElement, props: WorldSceneProps) {
  if (!host.dataset.injected) {
    host.innerHTML = WORLD_SVG;
    host.dataset.injected = "1";
  }
  applyAppearance(host, props);
}

function scenePropsEqual(a: WorldSceneProps, b: WorldSceneProps): boolean {
  return (
    a.dayPart === b.dayPart &&
    a.weather === b.weather &&
    a.pose === b.pose &&
    a.fireLit === b.fireLit &&
    a.hasFireplace === b.hasFireplace &&
    a.fireplaceTier === b.fireplaceTier &&
    a.storageTier === b.storageTier &&
    a.hasShelter === b.hasShelter &&
    a.hasWater === b.hasWater &&
    a.waterItemId === b.waterItemId &&
    a.waterLevel === b.waterLevel &&
    a.figureVisible === b.figureVisible
  );
}

/**
 * Beach SVG is injected once into a stable host. Simulation ticks must never
 * remount this component — CSS palm/flame animations restart if the markup
 * is rewritten or the host unmounts.
 */
export const WorldScene = memo(function WorldScene(props: WorldSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Ref callback injects as soon as the node exists (before paint when possible).
  const setHost = (node: HTMLDivElement | null) => {
    hostRef.current = node;
    if (node) ensureInjected(node, propsRef.current);
  };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    ensureInjected(host, props);
  }, [
    props.dayPart,
    props.weather,
    props.pose,
    props.fireLit,
    props.hasFireplace,
    props.fireplaceTier,
    props.storageTier,
    props.hasShelter,
    props.hasWater,
    props.waterItemId,
    props.waterLevel,
    props.figureVisible,
  ]);

  return <div className="world-host" ref={setHost} />;
}, scenePropsEqual);
