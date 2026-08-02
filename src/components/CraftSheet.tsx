"use client";

import {
  RECIPES,
  type Recipe,
  type RecipeId,
} from "@/game/balance";
import { canStartCraft } from "@/game/activities";
import { ITEMS, itemArtSrc } from "@/game/items";
import { missingCosts } from "@/game/inventory";
import type { SaveState } from "@/game/persist";
import { hasTool } from "@/game/tools";

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

const BAND_ORDER = ["early", "medium", "late"] as const;
const BAND_LABEL: Record<(typeof BAND_ORDER)[number], string> = {
  early: "Early",
  medium: "Medium",
  late: "Late",
};

function bandOf(recipe: Recipe): (typeof BAND_ORDER)[number] {
  return recipe.band ?? "early";
}

export function CraftSheet({ open, save, onClose, onCraft }: Props) {
  const grouped = BAND_ORDER.map((band) => ({
    band,
    recipes: RECIPES.filter((r) => bandOf(r) === band),
  })).filter((g) => g.recipes.length > 0);

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
          {grouped.map(({ band, recipes }) => (
            <li key={band} className="craft-band">
              <div className="craft-band-label">{BAND_LABEL[band]}</div>
              <ul>
                {recipes.map((recipe) => {
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
                                !hasTool(save, recipe.tool) ? "short" : undefined
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
            </li>
          ))}
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
