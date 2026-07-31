"use client";

import { useEffect, useMemo, useState } from "react";
import { STORAGE_TIERS } from "@/game/balance";
import { ITEMS, itemArtSrc } from "@/game/items";
import { projectOverflowSlots } from "@/game/overflow";
import type { PendingOverflow, SaveState } from "@/game/persist";

type Props = {
  open: boolean;
  save: SaveState;
  overflow: PendingOverflow;
  onConfirm: (decision: {
    keepIncoming: boolean[];
    destroyIndices: number[];
  }) => void;
};

export function OverflowScreen({ open, save, overflow, onConfirm }: Props) {
  const [keep, setKeep] = useState<boolean[]>([]);
  const [destroy, setDestroy] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setKeep(overflow.incoming.map(() => true));
    setDestroy(new Set());
  }, [open, overflow]);

  const keepIncoming = useMemo(
    () =>
      overflow.incoming.filter((_, i) => keep[i]).map((s) => ({ ...s })),
    [overflow.incoming, keep],
  );

  const projection = useMemo(
    () =>
      projectOverflowSlots(save.inventory, save.storageTier, {
        destroyIndices: destroy,
        keepIncoming,
      }),
    [save.inventory, save.storageTier, destroy, keepIncoming],
  );

  if (!open) return null;

  const label = STORAGE_TIERS[save.storageTier].label;

  return (
    <div className="sheet on overflow-sheet" role="dialog" aria-modal>
      <div className="overflow-card" onClick={(e) => e.stopPropagation()}>
        <div className="ov-top">
          <p className="results-eyebrow">{overflow.eyebrow}</p>
          <h2>{overflow.title}</h2>
          <div className="ov-incoming">
            {overflow.incoming.map((slot, i) => {
              const def = ITEMS[slot.itemId];
              if (!def) return null;
              const keeping = keep[i] !== false;
              const dim = keeping && !projection.fits;
              return (
                <button
                  key={`${slot.itemId}-${i}`}
                  type="button"
                  className={`ov-card${keeping ? " keep" : " leave"}${
                    dim ? " dim" : ""
                  }`}
                  onClick={() => {
                    setKeep((prev) => {
                      const next = [...prev];
                      next[i] = !next[i];
                      return next;
                    });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemArtSrc(def.id)} alt="" />
                  <span className="ov-name">{def.name}</span>
                  {slot.qty > 1 && (
                    <span className="ov-qty">×{slot.qty}</span>
                  )}
                  <span className="ov-tog">
                    {keeping ? "Keep" : "Leave"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`ov-counter${projection.fits ? " ok" : " over"}`}
          aria-live="polite"
        >
          {projection.used} of {projection.max} slots
          <span className="ov-cap"> · {label}</span>
        </div>

        <div className="ov-bottom">
          <p className="ov-stored-label">Stored</p>
          <div className="ov-grid">
            {save.inventory.map((slot, i) => {
              const def = ITEMS[slot.itemId];
              if (!def) return null;
              const doomed = destroy.has(i);
              return (
                <button
                  key={`inv-${i}-${slot.itemId}`}
                  type="button"
                  className={`ov-slot${doomed ? " doom" : ""}`}
                  onClick={() => {
                    setDestroy((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemArtSrc(def.id)} alt="" />
                  <span className="nm">{def.name}</span>
                  {slot.qty > 1 && <span className="qty">×{slot.qty}</span>}
                </button>
              );
            })}
            {Array.from(
              { length: Math.max(0, projection.max - save.inventory.length) },
              (_, i) => (
                <div key={`free-${i}`} className="ov-slot free" />
              ),
            )}
          </div>
        </div>

        <button
          type="button"
          className={`ov-confirm${projection.fits ? "" : " blocked"}`}
          disabled={!projection.fits}
          onClick={() => {
            if (!projection.fits) return;
            onConfirm({
              keepIncoming: overflow.incoming.map((_, i) => keep[i] !== false),
              destroyIndices: [...destroy],
            });
          }}
        >
          {projection.fits ? "Take these" : "Too many"}
        </button>
      </div>
    </div>
  );
}
