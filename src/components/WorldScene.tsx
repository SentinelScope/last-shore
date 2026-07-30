"use client";

import { memo, useEffect, useRef } from "react";
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

/**
 * Beach SVG lives here once. Sim ticks must not remount it — CSS animations
 * (palms, flames, birds, waves) restart if the markup is rewritten.
 */
export const WorldScene = memo(function WorldScene(props: WorldSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  // Inject markup exactly once for the life of this host.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || injected.current) return;
    host.innerHTML = WORLD_SVG;
    injected.current = true;
    const svg = host.querySelector("svg.scene");
    if (svg) {
      svg.setAttribute("class", worldClassName(props));
      setCupFill(svg, props.hasWater ? props.waterLevel : 0);
    }
    // props read only for initial paint; later updates go through the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Appearance changes only — never rewrite innerHTML.
  useEffect(() => {
    if (!injected.current) return;
    const svg = hostRef.current?.querySelector("svg.scene");
    if (!svg) return;
    const nextClass = worldClassName(props);
    if (svg.getAttribute("class") !== nextClass) {
      svg.setAttribute("class", nextClass);
    }
    setCupFill(svg, props.hasWater ? props.waterLevel : 0);
    // Intentionally depend on scene fields, not the whole props object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
});
