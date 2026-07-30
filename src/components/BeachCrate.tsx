"use client";

import type { BeachContainer } from "@/game/containers";
import { containerTitle } from "@/game/containers";

type Props = {
  container: BeachContainer;
  onOpen: () => void;
};

/** Always-visible washed-up crate on the sand — sized by tier. */
export function BeachCrate({ container, onOpen }: Props) {
  return (
    <button
      type="button"
      className={`beach-crate tier-${container.tier}`}
      aria-label={containerTitle(container.tier)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <svg viewBox="0 0 64 48" aria-hidden className="crate-svg">
        {container.tier === "chest" ? (
          <>
            <ellipse cx="32" cy="42" rx="22" ry="4" className="crate-shadow" />
            <path
              d="M10 28 L10 18 Q10 10 32 10 Q54 10 54 18 L54 28 Z"
              className="crate-lid"
            />
            <path d="M10 28 L10 38 Q10 42 32 42 Q54 42 54 38 L54 28 Z" className="crate-body" />
            <rect x="28" y="24" width="8" height="6" rx="1" className="crate-latch" />
          </>
        ) : (
          <>
            <ellipse cx="32" cy="42" rx="20" ry="4" className="crate-shadow" />
            <path d="M12 20 L32 12 L52 20 L32 28 Z" className="crate-top" />
            <path d="M12 20 L12 34 L32 42 L32 28 Z" className="crate-side" />
            <path d="M52 20 L52 34 L32 42 L32 28 Z" className="crate-front" />
            {container.tier !== "small" && (
              <path
                d="M22 24 L42 24 M18 30 L46 30"
                className="crate-band"
                fill="none"
              />
            )}
          </>
        )}
      </svg>
    </button>
  );
}
