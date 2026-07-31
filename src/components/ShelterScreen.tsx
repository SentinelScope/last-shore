"use client";

import { useState } from "react";
import {
  SHELTER_LABEL,
  type ShelterTierId,
} from "@/game/balance";
import { isCarriedComfortItem, ITEMS, itemArtSrc } from "@/game/items";
import type { SaveState } from "@/game/persist";
import {
  placeInShelter,
  shelterSlotCount,
  takeFromShelter,
} from "@/game/shelter";
import { DropTarget, usePointerDrag } from "./pointerDrag";

type Props = {
  open: boolean;
  save: SaveState;
  onClose: () => void;
  onChange: (next: SaveState) => void;
};

function DecorIcon({ itemId }: { itemId: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={itemArtSrc(itemId)} alt={ITEMS[itemId]?.name ?? ""} />
  );
}

/** Lean-to: open sides, sand, sloping frond roof, light from left. */
function LeanToInterior({
  decor,
}: {
  decor: (string | null)[];
}) {
  const hanky = decor[0] === "handkerchief";
  const other = decor[0] && decor[0] !== "handkerchief" ? decor[0] : null;

  return (
    <svg className="shelter-art" viewBox="0 0 320 280" aria-hidden>
      <defs>
        <linearGradient id="sh-day" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE6B8" stopOpacity=".55" />
          <stop offset=".45" stopColor="#FFE6B8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sh-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4A882" />
          <stop offset="1" stopColor="#A88862" />
        </linearGradient>
      </defs>
      {/* outside light */}
      <rect width="320" height="280" fill="#1a2218" />
      <rect width="320" height="280" fill="url(#sh-day)" />
      {/* sand floor */}
      <ellipse cx="160" cy="248" rx="150" ry="28" fill="url(#sh-sand)" />
      <ellipse cx="160" cy="248" rx="150" ry="28" fill="#8B7355" opacity=".25" />
      {/* open sides — sparse posts */}
      <polygon points="40,240 52,90 68,92 58,240" fill="#6B5340" />
      <polygon points="52,90 68,92 72,88" fill="#8A6A4A" />
      <polygon points="260,240 250,95 268,93 278,240" fill="#5A4535" />
      <polygon points="250,95 268,93 262,88" fill="#7A5A3A" />
      {/* back fronds suggestion */}
      <polygon points="70,230 90,120 110,230" fill="#3E5A38" opacity=".45" />
      <polygon points="200,230 230,110 250,230" fill="#2F4A30" opacity=".4" />
      {/* sloping roof poles + fronds */}
      <polygon points="30,100 160,48 290,105 280,118 160,68 42,112" fill="#4A6B3E" />
      <polygon points="30,100 160,48 290,105 270,100 160,58" fill="#5C7E4A" opacity=".85" />
      <line x1="48" y1="98" x2="160" y2="58" stroke="#6B5340" strokeWidth="3" />
      <line x1="160" y1="58" x2="275" y2="102" stroke="#5A4535" strokeWidth="3" />
      <line x1="70" y1="108" x2="160" y2="72" stroke="#6B5340" strokeWidth="2" opacity=".7" />
      <line x1="160" y1="72" x2="250" y2="108" stroke="#5A4535" strokeWidth="2" opacity=".7" />
      {/* ridge pole for hanging */}
      <line x1="100" y1="78" x2="210" y2="78" stroke="#7A5A3A" strokeWidth="2.5" />

      {/* handkerchief hanging from the ridge */}
      {hanky && (
        <g className="shelter-hanky">
          <line x1="148" y1="78" x2="148" y2="92" stroke="#A09070" strokeWidth="1.2" />
          <polygon points="132,92 164,92 160,138 148,148 136,138" fill="#F2EDE3" />
          <polygon points="148,92 164,92 160,138 148,148" fill="#D5C7A8" opacity=".55" />
          <circle cx="148" cy="118" r="3" fill="#5AA5CC" opacity=".55" />
        </g>
      )}
      {/* other comfort item on the sand / ledge */}
      {other && (
        <foreignObject x="132" y="175" width="56" height="56">
          <div className="shelter-prop">
            <DecorIcon itemId={other} />
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

/** Walled: plank walls, doorway, proper floor, warmer dim. */
function WalledInterior({ decor }: { decor: (string | null)[] }) {
  return (
    <svg className="shelter-art" viewBox="0 0 320 280" aria-hidden>
      <rect width="320" height="280" fill="#1c1612" />
      <rect x="24" y="40" width="272" height="200" fill="#3A2E24" />
      <rect x="24" y="40" width="272" height="200" fill="#5A4030" opacity=".35" />
      {/* planks */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={28}
          y={48 + i * 28}
          width={110}
          height={24}
          fill={i % 2 ? "#4A382C" : "#3E3026"}
          opacity=".9"
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={`r${i}`}
          x={182}
          y={48 + i * 28}
          width={110}
          height={24}
          fill={i % 2 ? "#3E3026" : "#4A382C"}
          opacity=".9"
        />
      ))}
      {/* doorway */}
      <rect x="138" y="100" width="44" height="140" fill="#0E1210" />
      <rect x="138" y="100" width="44" height="140" fill="#2A2018" opacity=".4" />
      {/* floor */}
      <polygon points="24,240 160,220 296,240 296,255 24,255" fill="#5C4A36" />
      <polygon points="24,240 160,220 296,240" fill="#6B5640" opacity=".5" />
      {/* warm dim */}
      <rect width="320" height="280" fill="#C4783A" opacity=".08" />

      {decor[0] && (
        <foreignObject x="48" y="150" width="48" height="48">
          <div className="shelter-prop">
            <DecorIcon itemId={decor[0]} />
          </div>
        </foreignObject>
      )}
      {decor[1] && (
        <foreignObject x="224" y="160" width="48" height="48">
          <div className="shelter-prop">
            <DecorIcon itemId={decor[1]} />
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

/** Storm-proof: reinforced, shuttered, dark, rain outside. */
function StormInterior({ decor }: { decor: (string | null)[] }) {
  return (
    <svg className="shelter-art" viewBox="0 0 320 280" aria-hidden>
      <rect width="320" height="280" fill="#0A0C10" />
      {/* rain outside shutter */}
      <rect x="210" y="70" width="70" height="90" fill="#1A2430" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={i}
          x1={218 + i * 9}
          y1="78"
          x2={212 + i * 9}
          y2="152"
          stroke="#6A8AAA"
          strokeWidth="1.2"
          opacity=".35"
        >
          <animate
            attributeName="opacity"
            values=".2;.45;.2"
            dur={`${1.2 + i * 0.1}s`}
            repeatCount="indefinite"
          />
        </line>
      ))}
      {/* shutter bars */}
      <rect x="210" y="70" width="70" height="90" fill="none" stroke="#6A7A88" strokeWidth="3" />
      <line x1="245" y1="70" x2="245" y2="160" stroke="#6A7A88" strokeWidth="2" />
      <line x1="210" y1="115" x2="280" y2="115" stroke="#6A7A88" strokeWidth="2" />
      {/* metal scrap plates */}
      <rect x="30" y="50" width="160" height="180" fill="#2A3038" />
      <rect x="38" y="60" width="50" height="36" fill="#5A6570" opacity=".55" />
      <rect x="100" y="110" width="60" height="28" fill="#6A7580" opacity=".4" />
      <rect x="44" y="160" width="70" height="40" fill="#4A5560" opacity=".5" />
      {/* rivets */}
      <circle cx="46" cy="68" r="2" fill="#9AA4AE" />
      <circle cx="80" cy="68" r="2" fill="#9AA4AE" />
      <circle cx="46" cy="88" r="2" fill="#9AA4AE" />
      {/* floor */}
      <rect x="20" y="230" width="280" height="30" fill="#1A1E24" />
      <rect x="20" y="230" width="280" height="30" fill="#2A323C" opacity=".5" />

      {decor[0] && (
        <foreignObject x="50" y="175" width="44" height="44">
          <div className="shelter-prop">
            <DecorIcon itemId={decor[0]} />
          </div>
        </foreignObject>
      )}
      {decor[1] && (
        <foreignObject x="120" y="120" width="44" height="44">
          <div className="shelter-prop">
            <DecorIcon itemId={decor[1]} />
          </div>
        </foreignObject>
      )}
      {decor[2] && (
        <foreignObject x="55" y="70" width="44" height="44">
          <div className="shelter-prop">
            <DecorIcon itemId={decor[2]} />
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

function ShelterStage({
  tier,
  decor,
}: {
  tier: Exclude<ShelterTierId, "none">;
  decor: (string | null)[];
}) {
  if (tier === "walled") return <WalledInterior decor={decor} />;
  if (tier === "storm") return <StormInterior decor={decor} />;
  return <LeanToInterior decor={decor} />;
}

export function ShelterScreen({ open, save, onClose, onChange }: Props) {
  const { bindDraggable } = usePointerDrag();
  const [hint, setHint] = useState<string | null>(null);

  function placeComfort(inventoryIndex: number, slotIndex: number) {
    const result = placeInShelter(save, inventoryIndex, slotIndex);
    if (!result.ok) {
      setHint(result.reason);
      return;
    }
    setHint(null);
    onChange(result.state);
  }

  function onTake(slotIndex: number) {
    const result = takeFromShelter(save, slotIndex);
    if (!result.ok) {
      setHint(result.reason);
      return;
    }
    setHint(null);
    onChange(result.state);
  }

  if (!open) return null;
  if (save.shelterTier === "none") return null;

  const tier = save.shelterTier;
  const slots = shelterSlotCount(tier);
  const decor = save.shelterDecor ?? [null, null, null];
  const title = SHELTER_LABEL[tier];

  return (
    <div className={`shelter-page tier-${tier}`}>
      <div className="sp-head">
        <h1>{title}</h1>
        <button type="button" onClick={onClose}>
          Back
        </button>
      </div>

      <div className="shelter-stage">
        <ShelterStage tier={tier} decor={decor} />

        <div className="sp-slots">
          {Array.from({ length: slots }, (_, i) => (
            <div key={i} className={`sp-slot sp-slot-${i}`}>
              <span className="sp-slot-label">Place</span>
              <DropTarget
                id={`shelter-slot-${i}`}
                as="button"
                className={`sp-slot-box${
                  tier === "lean_to" && decor[i] === "handkerchief"
                    ? " art-placed"
                    : ""
                }`}
                overClassName="over"
                accept={(p) => {
                  if (p.kind !== "comfort" && p.kind !== "inventory") return false;
                  const def = ITEMS[p.itemId];
                  return !!def && isCarriedComfortItem(def);
                }}
                onDrop={(p) => placeComfort(p.inventoryIndex, i)}
                onClick={() => {
                  if (decor[i]) onTake(i);
                }}
              >
                {decor[i] &&
                !(tier === "lean_to" && decor[i] === "handkerchief") ? (
                  <DecorIcon itemId={decor[i]!} />
                ) : null}
              </DropTarget>
            </div>
          ))}
        </div>
      </div>

      <p className="sp-hint">
        {hint ??
          "Comfort items only. Drag one in — tap a placed item to take it back."}
      </p>

      <div className="sp-strip">
        {save.inventory.map((slot, i) => {
          const def = ITEMS[slot.itemId];
          if (!def) return null;
          const comfort = isCarriedComfortItem(def);
          const bind = bindDraggable({
            sourceKey: `shelter-inv-${i}-${slot.itemId}`,
            payload: {
              kind: "comfort",
              itemId: slot.itemId,
              artSrc: itemArtSrc(slot.itemId),
              inventoryIndex: i,
            },
            disabled: !comfort,
            onTap: () => {
              if (!comfort) {
                setHint("Only comfort items belong in the shelter.");
              }
            },
          });
          return (
            <button
              key={`${slot.itemId}-${i}`}
              type="button"
              {...bind}
              className={`slot${comfort ? "" : " muted"} ${bind.className}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemArtSrc(slot.itemId)} alt="" />
              {slot.qty > 1 && <span className="qty">{slot.qty}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
