"use client";

import { containerTitle, type BeachContainer } from "@/game/containers";
import { ITEMS, itemArtSrc } from "@/game/items";
import type { InventorySlot } from "@/game/persist";

type Props = {
  container: BeachContainer | null;
  open: boolean;
  onClose: () => void;
  onTake: () => void;
  preview?: { kept: InventorySlot[]; lost: InventorySlot[] } | null;
};

export function ContainerPanel({
  container,
  open,
  onClose,
  onTake,
  preview,
}: Props) {
  if (!container || !open) return null;

  return (
    <div
      className="sheet on container-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="results-card" onClick={(e) => e.stopPropagation()}>
        <p className="results-eyebrow">Washed up</p>
        <h2>{containerTitle(container.tier)}</h2>
        <p className="container-blurb">
          Everything inside. Take what fits — the rest goes back to the sea.
        </p>

        <ul className="results-list container-loot">
          {container.contents.map((slot, i) => {
            const def = ITEMS[slot.itemId];
            if (!def) return null;
            return (
              <li key={`${slot.itemId}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemArtSrc(def.id)} alt="" />
                <span>{def.name}</span>
              </li>
            );
          })}
        </ul>

        {preview && preview.lost.length > 0 && (
          <p className="container-warn">
            You only have room for some of this. The rest will be lost.
          </p>
        )}

        <div className="container-acts">
          <button type="button" className="sheetClose solid" onClick={onTake}>
            Take what fits
          </button>
          <button type="button" className="sheetClose" onClick={onClose}>
            Leave it
          </button>
        </div>
      </div>
    </div>
  );
}
