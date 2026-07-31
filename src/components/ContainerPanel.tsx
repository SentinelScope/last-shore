"use client";

import { containerTitle, type BeachContainer } from "@/game/containers";
import { ITEMS, itemArtSrc } from "@/game/items";

type Props = {
  container: BeachContainer | null;
  open: boolean;
  onClose: () => void;
  onTake: () => void;
};

export function ContainerPanel({
  container,
  open,
  onClose,
  onTake,
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
          Everything inside. Take it all — if there is no room, you will choose.
        </p>

        <ul className="results-list container-loot">
          {container.contents.map((slot, i) => {
            const def = ITEMS[slot.itemId];
            if (!def) return null;
            return (
              <li key={`${slot.itemId}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemArtSrc(def.id)} alt="" />
                <span>
                  {def.name}
                  {slot.qty > 1 ? ` ×${slot.qty}` : ""}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="container-acts">
          <button type="button" className="sheetClose solid" onClick={onTake}>
            Take
          </button>
          <button type="button" className="sheetClose" onClick={onClose}>
            Leave it
          </button>
        </div>
      </div>
    </div>
  );
}
