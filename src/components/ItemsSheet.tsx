"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  canStartActivity,
  formatRemaining,
} from "@/game/activities";
import {
  EAT_EFFECT,
  STORAGE_TIERS,
  storageSlotCount,
  storageUpgradeByRecipeId,
  storageUpgradeFrom,
  WATER_CAPACITY,
  type StorageTierId,
} from "@/game/balance";
import {
  DOCUMENT_COUNT,
  documentNumber,
  isDocumentItemId,
  SECRET_PHOTO_ID,
  type DocumentNumber,
} from "@/game/documents";
import { countItem, isWaterContainer, missingCosts } from "@/game/inventory";
import { ITEMS, itemActions, itemArtSrc } from "@/game/items";
import type { ActiveActivity, InventorySlot, SaveState } from "@/game/persist";
import { isRackableTool } from "@/game/tools";
import { DocumentViewer } from "./DocumentViewer";
import { SecretLookViewer } from "./SecretLookViewer";
import { usePointerDrag } from "./pointerDrag";

type Props = {
  open: boolean;
  inventory: InventorySlot[];
  storageTier: StorageTierId;
  activity: ActiveActivity | null;
  now: number;
  recoveredDocuments?: number[];
  onDocumentRead?: (n: DocumentNumber) => void;
  onClose: () => void;
  onSetOutside?: (inventoryIndex: number) => void;
  onEat?: (inventoryIndex: number) => void;
  onDestroy?: (inventoryIndex: number, qty: number) => void;
  onWear?: (inventoryIndex: number) => string | null;
  onStorageUpgrade?: () => string | null;
};

function formatUpgradeTime(ms: number): string {
  const m = Math.round(ms / 60_000);
  return m === 1 ? "1 min" : `${m} min`;
}

function UpgradeCostLine({
  inventory,
  cost,
  timeMs,
}: {
  inventory: InventorySlot[];
  cost: { itemId: string; qty: number }[];
  timeMs: number;
}) {
  const parts: ReactNode[] = [];
  cost.forEach((c, i) => {
    if (i > 0) parts.push(" · ");
    const have = countItem(inventory, c.itemId);
    const name = ITEMS[c.itemId]?.name ?? c.itemId.replace(/_/g, " ");
    if (have < c.qty) {
      parts.push(
        <span key={c.itemId} className="short">
          {name} {have}/{c.qty}
        </span>,
      );
    } else {
      parts.push(
        <span key={c.itemId}>
          {c.qty} {name}
        </span>,
      );
    }
  });
  parts.push(` · ${formatUpgradeTime(timeMs)}`);
  return <>{parts}</>;
}

export function ItemsSheet({
  open,
  inventory,
  storageTier,
  activity,
  now,
  recoveredDocuments = [],
  onDocumentRead,
  onClose,
  onSetOutside,
  onEat,
  onDestroy,
  onWear,
  onStorageUpgrade,
}: Props) {
  const { bindDraggable } = usePointerDrag();
  const [selected, setSelected] = useState<number | null>(null);
  const [destroyQty, setDestroyQty] = useState(1);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [actionReason, setActionReason] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);
  const [reading, setReading] = useState<DocumentNumber | null>(null);
  const [looking, setLooking] = useState(false);
  const slots = storageSlotCount(storageTier);
  const used = inventory.length;
  const free = Math.max(0, slots - used);
  const upgrade = storageUpgradeFrom(storageTier);
  const lockedCount = upgrade
    ? Math.max(0, storageSlotCount(upgrade.to) - slots)
    : 0;
  const label = STORAGE_TIERS[storageTier].label;
  const selectedSlot = selected !== null ? inventory[selected] : null;
  const selectedDef = selectedSlot ? ITEMS[selectedSlot.itemId] : null;
  const selectedDocNum = selectedSlot
    ? documentNumber(selectedSlot.itemId)
    : null;
  const recovered = [...new Set(recoveredDocuments)]
    .filter((n) => n >= 1 && n <= DOCUMENT_COUNT)
    .sort((a, b) => a - b) as DocumentNumber[];

  const runningUpgrade =
    activity?.kind === "craft" && activity.recipeId
      ? storageUpgradeByRecipeId(activity.recipeId)
      : null;
  const ready = upgrade
    ? missingCosts(inventory, upgrade.cost).length === 0
    : false;
  const busyGate = canStartActivity({ activity } as SaveState, "craft");

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setConfirmDestroy(false);
      setActionReason(null);
      setUpgradeReason(null);
      setReading(null);
      setLooking(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedSlot) setDestroyQty(selectedSlot.qty);
    else setConfirmDestroy(false);
    setActionReason(null);
  }, [selected, selectedSlot]);

  function openDocument(n: DocumentNumber) {
    onDocumentRead?.(n);
    setReading(n);
  }

  function handleUpgrade() {
    if (!onStorageUpgrade) return;
    if (!busyGate.ok) {
      setUpgradeReason(busyGate.reason);
      return;
    }
    const reason = onStorageUpgrade();
    if (reason) setUpgradeReason(reason);
    else setUpgradeReason(null);
  }

  function handleAction(action: string) {
    if (selected === null || !selectedSlot) return;
    if (action === "Read" && selectedDocNum != null) {
      openDocument(selectedDocNum);
      return;
    }
    if (action === "Look" && selectedSlot.itemId === SECRET_PHOTO_ID) {
      setLooking(true);
      return;
    }
    if (action === "Eat" && onEat) {
      onEat(selected);
      setSelected(null);
      return;
    }
    if (action === "Wear" && onWear) {
      const reason = onWear(selected);
      if (reason) {
        setActionReason(reason);
        return;
      }
      setSelected(null);
      setActionReason(null);
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
    <>
      <div
        className={`sheet${open && !reading && !looking ? " on" : ""}`}
        id="items"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="crate" onClick={(e) => e.stopPropagation()}>
          <div className="crateTop">
            <h1>Items</h1>
            <div className="cap">
              {used} of {slots} slots · {label}
            </div>
          </div>

          <div className="storage-upgrade">
            {runningUpgrade && activity ? (
              <p className="storage-upgrade-timer">
                Building the {runningUpgrade.name.toLowerCase()} —{" "}
                {formatRemaining(activity.endsAt, now)} left
              </p>
            ) : !upgrade ? (
              <p className="storage-upgrade-max">
                Storage Box — 20 slots. Nothing bigger washes up here.
              </p>
            ) : (
              <div className="storage-upgrade-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={itemArtSrc(upgrade.iconId)}
                  alt=""
                  className="storage-upgrade-icon"
                />
                <div className="storage-upgrade-copy">
                  <strong>
                    {upgrade.name.toUpperCase()} — {upgrade.slots} slots
                  </strong>
                  <span>
                    <UpgradeCostLine
                      inventory={inventory}
                      cost={upgrade.cost}
                      timeMs={upgrade.timeMs}
                    />
                  </span>
                </div>
                <button
                  type="button"
                  className="storage-upgrade-go"
                  disabled={!ready}
                  onClick={handleUpgrade}
                >
                  {ready ? "Upgrade" : "Not enough"}
                </button>
              </div>
            )}
            {!runningUpgrade &&
              (upgradeReason || (!busyGate.ok && ready)) && (
                <p className="storage-upgrade-reason">
                  {upgradeReason ?? (!busyGate.ok ? busyGate.reason : null)}
                </p>
              )}
          </div>

          <div className="grid">
            {inventory.map((slot, i) => {
              const def = ITEMS[slot.itemId];
              if (!def) return null;
              const water = isWaterContainer(slot.itemId);
              const select = () => {
                setSelected(i);
                setConfirmDestroy(false);
                setActionReason(null);
              };

              if (water) {
                const bind = bindDraggable({
                  sourceKey: `items-water-${i}`,
                  payload: {
                    kind: "water",
                    itemId: slot.itemId,
                    artSrc: itemArtSrc(def.id),
                    inventoryIndex: i,
                  },
                  onTap: select,
                });
                return (
                  <button
                    key={`${slot.itemId}-${i}`}
                    type="button"
                    {...bind}
                    className={`slot ${bind.className}`}
                    data-sel={selected === i ? "" : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ic" src={itemArtSrc(def.id)} alt="" />
                    <span className="nm">{def.name}</span>
                    {slot.qty > 1 && <span className="qty">×{slot.qty}</span>}
                  </button>
                );
              }

              if (isRackableTool(slot.itemId) || slot.itemId === "duct_tape") {
                const bind = bindDraggable({
                  sourceKey: `items-tool-${i}`,
                  payload: {
                    kind:
                      slot.itemId === "duct_tape" ? "duct_tape" : "tool",
                    itemId: slot.itemId,
                    artSrc: itemArtSrc(def.id),
                    inventoryIndex: i,
                  },
                  onTap: select,
                });
                return (
                  <button
                    key={`${slot.itemId}-${i}`}
                    type="button"
                    {...bind}
                    className={`slot ${bind.className}`}
                    data-sel={selected === i ? "" : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ic" src={itemArtSrc(def.id)} alt="" />
                    <span className="nm">{def.name}</span>
                    {slot.qty > 1 && <span className="qty">×{slot.qty}</span>}
                  </button>
                );
              }

              return (
                <button
                  key={`${slot.itemId}-${i}`}
                  type="button"
                  className="slot"
                  data-sel={selected === i ? "" : undefined}
                  onClick={select}
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

            {Array.from({ length: lockedCount }, (_, i) => (
              <div
                key={`locked-${i}`}
                className="slot locked"
                aria-hidden
                title="Locked until upgrade"
              >
                <span className="lk">▿</span>
              </div>
            ))}
          </div>

          <div className="detail">
            {!selectedDef || !selectedSlot || selected === null ? (
              <div className="empty">
                {slots} slots · {label}.
                <br />
                Drag a cup to the water spot, or use Set outside.
              </div>
            ) : confirmDestroy ? (
              <div className="destroy-confirm">
                <h3>Destroy {selectedDef.name}?</h3>
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
                    <div className="meta">
                      {isDocumentItemId(selectedSlot.itemId)
                        ? `${selectedDef.name} — ${recovered.length} of ${DOCUMENT_COUNT} recovered`
                        : selectedDef.type}
                    </div>
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
                {isDocumentItemId(selectedSlot.itemId) &&
                  recovered.length > 1 && (
                    <div className="doc-recovered">
                      {recovered.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={
                            n === selectedDocNum ? "doc-num on" : "doc-num"
                          }
                          onClick={() => openDocument(n)}
                        >
                          #{n}
                        </button>
                      ))}
                    </div>
                  )}
                {selectedDef.tags.length > 0 && (
                  <div className="tags">
                    {selectedDef.tags.map(([kind, tagLabel]) => (
                      <span key={tagLabel} className={`tag ${kind}`}>
                        {tagLabel}
                      </span>
                    ))}
                  </div>
                )}
                {actionReason && (
                  <p className="wear-block">{actionReason}</p>
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

      <DocumentViewer
        open={!!reading}
        documentNumber={reading}
        recoveredCount={recovered.length}
        onClose={() => setReading(null)}
      />

      <SecretLookViewer
        open={looking}
        src="/secret/LAB04_S4_A51.jpg"
        onClose={() => setLooking(false)}
      />
    </>
  );
}
