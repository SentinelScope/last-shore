"use client";

/** Quiet HUD widgets unlocked by carrying wristwatch / compass. */

export function WristwatchHud({ now }: { now: number }) {
  const d = new Date(now);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return (
    <div className="hud-trinket hud-watch" aria-label={`Time ${hh}:${mm}`}>
      <svg viewBox="0 0 40 40" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r="15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity=".55"
        />
        <circle cx="20" cy="20" r="1.4" fill="currentColor" opacity=".7" />
        {/* 12 mark */}
        <line
          x1="20"
          y1="7"
          x2="20"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity=".75"
        />
      </svg>
      <span>
        {hh}:{mm}
      </span>
    </div>
  );
}

/** Needle always points north — up the screen, out to sea. */
export function CompassHud() {
  return (
    <div className="hud-trinket hud-compass" aria-label="Compass · north is the sea">
      <svg viewBox="0 0 40 40" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r="15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity=".55"
        />
        <polygon
          points="20,7 23.2,22 20,20 16.8,22"
          fill="currentColor"
          opacity=".85"
        />
        <polygon
          points="20,33 23.2,22 20,20 16.8,22"
          fill="currentColor"
          opacity=".28"
        />
        <text
          x="20"
          y="14.5"
          textAnchor="middle"
          fontSize="6"
          fill="currentColor"
          opacity=".7"
          fontFamily="ui-serif, Georgia, serif"
        >
          N
        </text>
      </svg>
    </div>
  );
}
