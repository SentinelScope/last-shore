"use client";

import { memo, useLayoutEffect, useRef } from "react";
import {
  DAY_PART_CLASS,
  WEATHER_CLASS,
  type DayPart,
  type WeatherId,
} from "@/game/balance";
import type { PoseId } from "@/game/pose";
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
  hasShelter: boolean;
  hasWater: boolean;
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
  hasShelter: false,
  hasWater: false,
  waterLevel: 0,
  figureVisible: true,
};

function setCupFill(svg: Element, pct: number) {
  const top = 740 - 24 * (Math.max(0, Math.min(100, pct)) / 100);
  const f = svg.querySelector("#cupfill");
  const t = svg.querySelector("#cupfilltop");
  if (f) {
    f.setAttribute("y", String(top));
    f.setAttribute("height", String(740 - top));
  }
  if (t) t.setAttribute("y", String(top - 1));
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

function placeCastaway(svg: Element, pose: PoseId, visible: boolean) {
  const img = svg.querySelector("#castaway");
  if (!img) return;
  const feet = CASTAWAY_FEET[pose];
  const src = CASTAWAY_SRC[pose];
  const x = String(feet.x - CASTAWAY_SIZE / 2);
  const y = String(feet.y - 80);
  const size = String(CASTAWAY_SIZE);
  if (img.getAttribute("href") !== src) {
    img.setAttribute("href", src);
    // Some browsers still resolve xlink:href for SVG <image>
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", src);
  }
  if (img.getAttribute("x") !== x) img.setAttribute("x", x);
  if (img.getAttribute("y") !== y) img.setAttribute("y", y);
  if (img.getAttribute("width") !== size) img.setAttribute("width", size);
  if (img.getAttribute("height") !== size) img.setAttribute("height", size);
  img.setAttribute("visibility", visible ? "visible" : "hidden");
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
  const level = props.hasWater ? props.waterLevel : 0;
  const prev = host.dataset.waterLevel;
  const next = String(level);
  if (prev !== next) {
    host.dataset.waterLevel = next;
    setCupFill(svg, level);
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
    a.hasShelter === b.hasShelter &&
    a.hasWater === b.hasWater &&
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
    props.hasShelter,
    props.hasWater,
    props.waterLevel,
    props.figureVisible,
  ]);

  return <div className="world-host" ref={setHost} />;
}, scenePropsEqual);
