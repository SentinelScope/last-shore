"use client";

import {
  RECIPES,
  type RecipeId,
} from "@/game/balance";
import { canStartCraft } from "@/game/activities";
import { ITEMS, itemArtSrc } from "@/game/items";
import { missingCosts } from "@/game/inventory";
import type { SaveState } from "@/game/persist";

type Props = {
  open: boolean;
  save: SaveState;
  onClose: () => void;
  onCraft: (recipeId: RecipeId) => void;
};

function formatTime(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m === 1 ? "1 min" : `${m} min`;
}

export function CraftSheet({ open, save, onClose, onCraft }: Props) {
  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="craft-panel" onClick={(e) => e.stopPropagation()}>
        <div className="craft-head">
          <h1>Build</h1>
          <p className="cap">One craft at a time · wall-clock</p>
        </div>
        <ul className="craft-list">
          {RECIPES.map((recipe) => {
            const missing = missingCosts(save.inventory, recipe.cost);
            const gate = canStartCraft(save, recipe.id);
            const locked = !gate.ok;
            return (
              <li
                key={recipe.id}
                className={`craft-row${locked ? " locked" : ""}`}
              >
                <div className="craft-main">
                  <div className="craft-title">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={itemArtSrc(recipe.result?.itemId ?? recipe.id)}
                      alt=""
                    />
                    <div>
                      <strong>{recipe.name}</strong>
                      <em>{formatTime(recipe.timeMs)}</em>
                    </div>
                  </div>
                  <ul className="craft-cost">
                    {recipe.cost.map((c) => {
                      const def = ITEMS[c.itemId];
                      const have = save.inventory
                        .filter((s) => s.itemId === c.itemId)
                        .reduce((n, s) => n + s.qty, 0);
                      const short = have < c.qty;
                      return (
                        <li
                          key={c.itemId}
                          className={short ? "short" : undefined}
                        >
                          {def?.name ?? c.itemId}{" "}
                          <span className={short ? "short" : undefined}>
                            {have}/{c.qty}
                          </span>
                        </li>
                      );
                    })}
                    {recipe.tool && (
                      <li
                        className={
                          !save.inventory.some((s) => s.itemId === recipe.tool)
                            ? "short"
                            : undefined
                        }
                      >
                        Needs {ITEMS[recipe.tool]?.name ?? recipe.tool}
                      </li>
                    )}
                  </ul>
                  {locked &&
                    gate.ok === false &&
                    missing.length === 0 &&
                    !gate.reason.startsWith("Needs ") && (
                      <p className="craft-reason">{gate.reason}</p>
                    )}
                </div>
                <button
                  type="button"
                  className="craft-go"
                  disabled={locked}
                  onClick={() => onCraft(recipe.id)}
                >
                  Craft
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        type="button"
        className="sheetClose"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Close
      </button>
    </div>
  );
}
