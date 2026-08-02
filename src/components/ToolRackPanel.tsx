"use client";

import { useState } from "react";
import { ITEMS, itemArtSrc } from "@/game/items";
import type { SaveState } from "@/game/persist";
import {
  isRackableTool,
  placeOnToolRack,
  repairRackedToolWithTape,
  takeFromToolRack,
  toolMaxUses,
  toolUsesRemaining,
  TOOL_RACK_SLOTS,
} from "@/game/tools";
import {
  DropTarget,
  usePointerDrag,
  type PointerDragPayload,
} from "./pointerDrag";

type Props = {
  open: boolean;
  save: SaveState;
  onClose: () => void;
  onChange: (next: SaveState) => void;
};

export function ToolRackPanel({ open, save, onClose, onChange }: Props) {
  const { bindDraggable } = usePointerDrag();
  const [hint, setHint] = useState<string | null>(null);
  const rack = save.toolRack ?? [null, null, null];

  if (!open) return null;

  function onPlace(inventoryIndex: number, rackIndex: number) {
    const slot = save.inventory[inventoryIndex];
    if (!slot) return;
    if (slot.itemId === "duct_tape") {
      const result = repairRackedToolWithTape(save, rackIndex, inventoryIndex);
      if (!result.ok) {
        setHint(result.reason);
        return;
      }
      setHint(null);
      onChange(result.state);
      return;
    }
    if (!isRackableTool(slot.itemId)) {
      setHint("Only tools go on the rack.");
      return;
    }
    const result = placeOnToolRack(save, inventoryIndex, rackIndex);
    if (!result.ok) {
      setHint(result.reason);
      return;
    }
    setHint(null);
    onChange(result.state);
  }

  function onTake(rackIndex: number) {
    const result = takeFromToolRack(save, rackIndex);
    if (!result.ok) {
      setHint(result.reason);
      return;
    }
    setHint(null);
    onChange(result.state);
  }

  const strip = save.inventory
    .map((slot, i) => ({ slot, i }))
    .filter(
      ({ slot }) => isRackableTool(slot.itemId) || slot.itemId === "duct_tape",
    );

  return (
    <div
      className="sheet on tool-rack-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tool-rack-card" onClick={(e) => e.stopPropagation()}>
        <div className="tool-rack-head">
          <h2>Tool Rack</h2>
          <button type="button" className="tool-rack-x" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="tool-rack-blurb">
          Three pegs. Tools here still cut, fish, and hammer.
        </p>
        <div className="tool-rack-slots">
          {Array.from({ length: TOOL_RACK_SLOTS }, (_, i) => {
            const tool = rack[i] ?? null;
            const max = tool ? toolMaxUses(tool.itemId) : null;
            const uses = tool ? toolUsesRemaining(tool) : null;
            const frac =
              max != null && uses != null ? Math.max(0, uses / max) : null;
            return (
              <DropTarget
                key={i}
                id={`tool-rack-${i}`}
                className="tool-rack-slot"
                overClassName="drop-over"
                accept={(p) =>
                  p.kind === "tool" ||
                  p.kind === "duct_tape" ||
                  (p.kind === "inventory" &&
                    (isRackableTool(p.itemId) || p.itemId === "duct_tape"))
                }
                onDrop={(p) => onPlace(p.inventoryIndex, i)}
              >
                {tool ? (
                  <button
                    type="button"
                    className="tool-rack-tool"
                    onClick={() => onTake(i)}
                    title="Take back"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={itemArtSrc(tool.itemId)} alt="" />
                    <span className="nm">
                      {ITEMS[tool.itemId]?.name ?? tool.itemId}
                    </span>
                    {frac != null && (
                      <span className="tool-rack-bar" aria-hidden>
                        <span style={{ width: `${frac * 100}%` }} />
                      </span>
                    )}
                    {uses != null && (
                      <span className="uses">
                        {uses}/{max}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="tool-rack-empty">Empty</span>
                )}
              </DropTarget>
            );
          })}
        </div>
        {hint && <p className="tool-rack-hint">{hint}</p>}
        <div className="tool-rack-strip">
          {strip.length === 0 ? (
            <p className="tool-rack-strip-empty">No tools in your pack.</p>
          ) : (
            strip.map(({ slot, i }) => {
              const def = ITEMS[slot.itemId];
              if (!def) return null;
              const payload: PointerDragPayload = {
                kind: slot.itemId === "duct_tape" ? "duct_tape" : "tool",
                itemId: slot.itemId,
                artSrc: itemArtSrc(slot.itemId),
                inventoryIndex: i,
              };
              const bind = bindDraggable({
                sourceKey: `rack-inv-${i}-${slot.itemId}`,
                payload,
              });
              const uses = toolUsesRemaining(slot);
              const max = toolMaxUses(slot.itemId);
              return (
                <button
                  key={`${slot.itemId}-${i}`}
                  type="button"
                  {...bind}
                  className={`slot ${bind.className}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemArtSrc(slot.itemId)} alt={def.name} />
                  {slot.qty > 1 && <span className="qty">{slot.qty}</span>}
                  {uses != null && max != null && (
                    <span className="uses">
                      {uses}/{max}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
