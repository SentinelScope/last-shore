"use client";

import { ITEMS, itemArtSrc } from "@/game/items";
import type { PendingResults } from "@/game/persist";

type Props = {
  results: PendingResults | null;
  onDismiss: () => void;
};

function LootRow({
  label,
  items,
}: {
  label: string;
  items: { itemId: string; qty: number }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="results-group">
      <div className="results-label">{label}</div>
      <ul className="results-list">
        {items.map((s) => {
          const def = ITEMS[s.itemId];
          if (!def) return null;
          return (
            <li key={s.itemId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemArtSrc(def.id)} alt="" />
              <span>
                {def.name}
                {s.qty > 1 ? ` ×${s.qty}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ResultsPanel({ results, onDismiss }: Props) {
  if (!results) return null;

  return (
    <div
      className="sheet on results-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="results-card" onClick={(e) => e.stopPropagation()}>
        <p className="results-eyebrow">Washed up</p>
        <h2>{results.title}</h2>
        <LootRow label="Kept" items={results.kept} />
        <LootRow label="Lost to the sea" items={results.lost} />
        {results.kept.length === 0 && results.lost.length === 0 && (
          <p className="results-empty">
            {results.title.startsWith("Crafted")
              ? "Done."
              : "Nothing came of it."}
          </p>
        )}
        <button type="button" className="sheetClose" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
