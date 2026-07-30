"use client";

import { useEffect, useState } from "react";
import {
  EAT_EFFECT,
  STORAGE_TIERS,
  WATER_CAPACITY,
  type StorageTierId,
} from "@/game/balance";
import {
  ITEMS,
  itemActions,
  itemArtSrc,
} from "@/game/items";
import { isWaterContainer } from "@/game/inventory";
import type { InventorySlot } from "@/game/persist";

type Props = {
  open: boolean;
  inventory: InventorySlot[];
  storageTier: StorageTierId;
  onClose: () => void;
  onSetOutside?: (inventoryIndex: number) => void;
  onEat?: (inventoryIndex: number) => void;
  onDestroy?: (inventoryIndex: number, qty: number) => void;
};

export function ItemsSheet({
  open,
  inventory,
  storageTier,
  onClose,
  onSetOutside,
  onEat,
  onDestroy,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [destroyQty, setDestroyQty] = useState(1);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const tier = STORAGE_TIERS[storageTier];
  const used = inventory.length;
  const free = Math.max(0, tier.slots - used);
  const selectedSlot = selected !== null ? inventory[selected] : null;
  const selectedDef = selectedSlot ? ITEMS[selectedSlot.itemId] : null;

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setConfirmDestroy(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedSlot) setDestroyQty(selectedSlot.qty);
    else setConfirmDestroy(false);
  }, [selected, selectedSlot]);

  function handleAction(action: string) {
    if (selected === null || !selectedSlot) return;
    if (action === "Eat" && onEat) {
      onEat(selected);
      setSelected(null);
      return;
    }
    if (action === "Destroy") {
      setDestroyQty(selectedSlot.qty);
      setConfirmDestroy(true);
      return;
    }
    if (action === "Set outside" && onSetOutside) {
      onSetOutside(selected);
      setSelected(null);
    }
  }

  function confirmDestroyAction() {
    if (selected === null || !onDestroy) return;
    onDestroy(selected, destroyQty);
    setConfirmDestroy(false);
    setSelected(null);
  }

  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      id="items"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="crate" onClick={(e) => e.stopPropagation()}>
        <div className="crateTop">
          <h1>Items</h1>
          <div className="cap">
            {used} of {tier.slots} slots · {tier.label}
          </div>
        </div>

        <div className="grid">
          {inventory.map((slot, i) => {
            const def = ITEMS[slot.itemId];
            if (!def) return null;
            const water = isWaterContainer(slot.itemId);
            return (
              <button
                key={`${slot.itemId}-${i}`}
                type="button"
                className="slot"
                data-sel={selected === i ? "" : undefined}
                draggable={water}
                onDragStart={(e) => {
                  if (!water) return;
                  e.dataTransfer.setData(
                    "application/x-last-shore-water",
                    String(i),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => {
                  setSelected(i);
                  setConfirmDestroy(false);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ic" src={itemArtSrc(def.id)} alt="" />
                <span className="nm">{def.name}</span>
                {slot.qty > 1 && <span className="qty">×{slot.qty}</span>}
              </button>
            );
          })}

          {Array.from({ length: free }, (_, i) => (
            <div key={`free-${i}`} className="slot free" />
          ))}
        </div>

        <div className="detail">
          {!selectedDef || !selectedSlot || selected === null ? (
            <div className="empty">
              {tier.slots} slots · {tier.label}.
              <br />
              Drag a cup to the water spot, or use Set outside.
            </div>
          ) : confirmDestroy ? (
            <div className="destroy-confirm">
              <h3>
                Destroy {selectedDef.name}?
              </h3>
              {selectedSlot.qty > 1 ? (
                <>
                  <p className="stack-line">
                    How many · {destroyQty} of {selectedSlot.qty}
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={selectedSlot.qty}
                    value={destroyQty}
                    onChange={(e) => setDestroyQty(Number(e.target.value))}
                  />
                </>
              ) : (
                <p className="stack-line">This cannot be undone.</p>
              )}
              <div className="acts">
                <button
                  type="button"
                  onClick={() => setConfirmDestroy(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={confirmDestroyAction}
                >
                  Destroy
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="dhead">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemArtSrc(selectedDef.id)} alt="" />
                <div>
                  <h3>{selectedDef.name}</h3>
                  <div className="meta">{selectedDef.type}</div>
                </div>
              </div>
              <p>{selectedDef.description}</p>
              <p className="stack-line">
                Stack {selectedSlot.qty}
                {selectedDef.stack > 1 ? ` of ${selectedDef.stack}` : ""}
                {selectedSlot.itemId in WATER_CAPACITY
                  ? ` · holds ${WATER_CAPACITY[selectedSlot.itemId]}`
                  : ""}
              </p>
              {selectedDef.tags.length > 0 && (
                <div className="tags">
                  {selectedDef.tags.map(([kind, label]) => (
                    <span key={label} className={`tag ${kind}`}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <div className="acts">
                {isWaterContainer(selectedSlot.itemId) && onSetOutside && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetOutside(selected);
                      setSelected(null);
                    }}
                  >
                    Set outside
                  </button>
                )}
                {itemActions(selectedDef)
                  .filter((a) => {
                    if (a === "Eat") return selectedSlot.itemId in EAT_EFFECT;
                    if (a === "Set outside") return false;
                    if (a === "Craft with") return false;
                    return true;
                  })
                  .map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={a === "Destroy" ? "danger" : undefined}
                      onClick={() => handleAction(a)}
                    >
                      {a}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className="sheetClose"
        onClick={(e) => {
          e.stopPropagation();
          setSelected(null);
          setConfirmDestroy(false);
          onClose();
        }}
      >
        Close
      </button>
    </div>
  );
}
