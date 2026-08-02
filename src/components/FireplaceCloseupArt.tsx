"use client";

import {
  FIREPLACE_SRC,
  PAGE_FIRE_FX_SCALE,
  PAGE_FIRE_SCALE,
  PAGE_FIRE_SIZE,
  fireplaceAshAt,
  fireplaceImageRect,
  type FireplaceBuiltTier,
} from "@/game/fireplaceArt";

const PAGE_FEET = {
  x: PAGE_FIRE_SIZE / 2,
  y: (PAGE_FIRE_SIZE * 880) / 1024,
};
const FX_SCALE = PAGE_FIRE_FX_SCALE;

type Props = {
  tier: FireplaceBuiltTier;
  displayTier: FireplaceBuiltTier;
  fadeTier: FireplaceBuiltTier | null;
  fadeOn: boolean;
  lit: boolean;
  holdProgress: number;
  flameScale: number;
  flameGlow: number;
  holding: boolean;
};

/** PNG structure + scaled glow / flames / embers / smoke for the fireplace page. */
export function FireplaceCloseupArt({
  tier,
  displayTier,
  fadeTier,
  fadeOn,
  lit,
  holdProgress,
  flameScale,
  flameGlow,
  holding,
}: Props) {
  const ash = fireplaceAshAt(PAGE_FEET, PAGE_FIRE_SCALE, tier);
  const imgRect = fireplaceImageRect(PAGE_FEET, PAGE_FIRE_SCALE);
  const liveScale = FX_SCALE * (lit ? 1.05 : flameScale);

  return (
    <svg
      className="fp-art"
      viewBox={`0 0 ${PAGE_FIRE_SIZE} ${PAGE_FIRE_SIZE}`}
      aria-hidden
    >
      <defs>
        <radialGradient id="fp-glow" cx=".5" cy=".55" r=".5">
          <stop
            offset="0"
            stopColor="#FFAF54"
            stopOpacity={lit ? 0.7 : flameGlow * 0.55}
          />
          <stop offset="1" stopColor="#E4763F" stopOpacity="0" />
        </radialGradient>
        <filter id="fp-blur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <image
        href={FIREPLACE_SRC[displayTier]}
        x={imgRect.x}
        y={imgRect.y}
        width={imgRect.size}
        height={imgRect.size}
        opacity={fadeOn ? 0 : 1}
        style={{ transition: "opacity .3s ease" }}
        preserveAspectRatio="xMidYMax meet"
      />
      {fadeTier && (
        <image
          href={FIREPLACE_SRC[fadeTier]}
          x={imgRect.x}
          y={imgRect.y}
          width={imgRect.size}
          height={imgRect.size}
          opacity={fadeOn ? 1 : 0}
          style={{ transition: "opacity .3s ease" }}
          preserveAspectRatio="xMidYMax meet"
        />
      )}

      <ellipse
        className="fp-firelight"
        cx={ash.x}
        cy={ash.y}
        rx={130 * FX_SCALE * 0.55}
        ry={64 * FX_SCALE * 0.55}
        fill="url(#fp-glow)"
        opacity={lit ? 1 : 0.35 + holdProgress * 0.65}
      />

      <g
        transform={`translate(${ash.x} ${ash.y}) scale(${liveScale})`}
        opacity={lit ? 1 : 0.15 + holdProgress * 0.85}
        style={{ transition: holding ? "none" : "opacity .2s" }}
      >
        <path
          className="fp-flame"
          d="M0 0c-9-6-11-16-5-25 1 6 4 10 8 12 3-9 2-17-4-24 13 6 21 17 21 28 0 8-6 13-14 15z"
          fill="#E4763F"
        />
        <path
          className="fp-flame-in"
          d="M2 -2c-5-4-6-11-3-16 1 4 3 7 6 8 1-5 0-10-2-14 8 5 12 11 12 18 0 5-4 8-9 9z"
          fill="#FFC578"
        />
        {lit && (
          <>
            <g fill="#FFB25C">
              <circle cx="6" cy="-20" r="1.3">
                <animate
                  attributeName="cy"
                  values="-14;-58"
                  dur="4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="-6" cy="-24" r="1.1">
                <animate
                  attributeName="cy"
                  values="-12;-66"
                  dur="6s"
                  begin="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values=".9;0"
                  dur="6s"
                  begin="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
            <g opacity=".2" fill="#CFC6BA" filter="url(#fp-blur)">
              <ellipse cx="0" cy="-16" rx="8" ry="14">
                <animate
                  attributeName="cy"
                  values="-10;-106"
                  dur="10s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="rx"
                  values="5;24"
                  dur="10s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values=".35;0"
                  dur="10s"
                  repeatCount="indefinite"
                />
              </ellipse>
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

export function fireplaceAshCss(tier: FireplaceBuiltTier): {
  left: string;
  top: string;
} {
  const ash = fireplaceAshAt(PAGE_FEET, PAGE_FIRE_SCALE, tier);
  return {
    left: `${(ash.x / PAGE_FIRE_SIZE) * 100}%`,
    top: `${(ash.y / PAGE_FIRE_SIZE) * 100}%`,
  };
}

export { PAGE_FIRE_SIZE };
