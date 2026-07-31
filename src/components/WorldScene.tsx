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
  ]
    .filter(Boolean)
    .join(" ");
}

function applyAppearance(host: HTMLDivElement, props: WorldSceneProps) {
  const svg = host.querySelector("svg.scene");
  if (!svg) return;
  const nextClass = worldClassName(props);
  if (svg.getAttribute("class") !== nextClass) {
    svg.setAttribute("class", nextClass);
  }
  const level = props.hasWater ? props.waterLevel : 0;
  const prev = host.dataset.waterLevel;
  const next = String(level);
  if (prev !== next) {
    host.dataset.waterLevel = next;
    setCupFill(svg, level);
  }
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
    a.waterLevel === b.waterLevel
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

  // Mount host + inject markup exactly once for this DOM node.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!host.dataset.injected) {
      host.innerHTML = WORLD_SVG;
      host.dataset.injected = "1";
    }
    applyAppearance(host, propsRef.current);
  }, []);

  // Appearance only — never touch innerHTML after inject.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host?.dataset.injected) return;
    applyAppearance(host, props);
  }, [
    props.dayPart,
    props.weather,
    props.pose,
    props.fireLit,
    props.hasFireplace,
    props.hasShelter,
    props.hasWater,
    props.waterLevel,
  ]);

  return <div className="world-host" ref={hostRef} />;
}, scenePropsEqual);
