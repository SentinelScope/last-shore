"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FIRE_FUEL_MAX,
  FIRE_LIGHT_HOLD_MS,
  IGNITION_USES,
} from "@/game/balance";
import { formatRemaining } from "@/game/activities";
import {
  canLight,
  hasPanInFood,
  isCookable,
  isIgnition,
  lightFire,
  placeInFireplace,
  startCook,
  takeFromFireplace,
} from "@/game/fire";
import { ITEMS, itemArtSrc } from "@/game/items";
import type { InventorySlot, SaveState } from "@/game/persist";

const SLOT_HINTS = {
  ignition: "Flint, Wooden Matches, Lighter",
  tinder: "Tinder",
  fuel: "Wood",
  food: "Fish, Crab, Can of Food, or a Cooking Pan",
} as const;

type DropTarget =
  | { kind: "ignition" }
  | { kind: "tinder" }
  | { kind: "fuel" }
  | { kind: "food"; slotIndex: number };

function EmptySlotHint({
  hint,
  empty,
}: {
  hint: string;
  empty: boolean;
}) {
  const [show, setShow] = useState(false);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
    };
  }, []);

  if (!empty) return null;

  return (
    <span
      className={`fp-hint-tip${show ? " on" : ""}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
        pressTimer.current = window.setTimeout(() => setShow(true), 420);
      }}
      onPointerUp={() => {
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }}
      onPointerCancel={() => {
        if (pressTimer.current) window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
        setShow(false);
      }}
    >
      {show && <em>{hint}</em>}
    </span>
  );
}

type Props = {
  open: boolean;
  save: SaveState;
  now: number;
  onClose: () => void;
  onChange: (next: SaveState) => void;
};

function SlotArt({
  slot,
  woodCount,
}: {
  slot: InventorySlot | null;
  woodCount?: number;
}) {
  if (woodCount !== undefined) {
    if (woodCount < 1) return null;
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={itemArtSrc("wood")} alt="" />
        <span className="qty">{Math.floor(woodCount)}</span>
      </>
    );
  }
  if (!slot) return null;
  const uses =
    slot.durability ??
    (isIgnition(slot.itemId) ? IGNITION_USES[slot.itemId] : undefined);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={itemArtSrc(slot.itemId)} alt="" />
      {slot.qty > 1 && <span className="qty">{slot.qty}</span>}
      {uses !== undefined && <span className="uses">{uses}</span>}
    </>
  );
}

export function FireplaceScreen({
  open,
  save,
  now,
  onClose,
  onChange,
}: Props) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const holdRaf = useRef<number | null>(null);
  const holdStart = useRef<number | null>(null);
  const holding = useRef(false);
  const saveRef = useRef(save);
  const onChangeRef = useRef(onChange);
  saveRef.current = save;
  onChangeRef.current = onChange;

  const fp = save.fireplace;
  const lit = fp.lit;
  const ready = canLight(save);
  const pan = hasPanInFood(fp.slots.food);
  const foodSlots = pan
    ? fp.slots.food.length < 2
      ? [...fp.slots.food, null]
      : fp.slots.food
    : fp.slots.food.slice(0, 1);

  const cancelHold = useCallback(() => {
    holding.current = false;
    holdStart.current = null;
    if (holdRaf.current) cancelAnimationFrame(holdRaf.current);
    holdRaf.current = null;
    setHoldProgress(0);
  }, []);

  useEffect(() => {
    if (!open) cancelHold();
  }, [open, cancelHold]);

  useEffect(() => {
    return () => {
      if (holdRaf.current) cancelAnimationFrame(holdRaf.current);
    };
  }, []);

  function tickHold(t: number) {
    if (!holding.current || holdStart.current === null) return;
    const elapsed = t - holdStart.current;
    const p = Math.min(1, elapsed / FIRE_LIGHT_HOLD_MS);
    setHoldProgress(p);
    if (p >= 1) {
      holding.current = false;
      holdStart.current = null;
      holdRaf.current = null;
      setHoldProgress(1);
      const next = lightFire(saveRef.current, Date.now());
      onChangeRef.current(next);
      requestAnimationFrame(() => setHoldProgress(0));
      return;
    }
    holdRaf.current = requestAnimationFrame(tickHold);
  }

  function onHoldStart(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!ready || lit) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    holding.current = true;
    holdStart.current = performance.now();
    setHoldProgress(0);
    holdRaf.current = requestAnimationFrame(tickHold);
  }

  function onHoldEnd(e: React.PointerEvent) {
    e.preventDefault();
    if (holding.current) cancelHold();
  }

  function acceptDrop(itemId: string, target: DropTarget): boolean {
    if (target.kind === "ignition") return isIgnition(itemId);
    if (target.kind === "tinder") return itemId === "tinder";
    if (target.kind === "fuel") return itemId === "wood";
    if (itemId === "cooking_pan") return true;
    if (target.slotIndex === 1 && !pan && itemId !== "cooking_pan") return false;
    return isCookable(itemId);
  }

  function onInvDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("application/x-last-shore-inv", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropTarget(e: React.DragEvent, target: DropTarget) {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("application/x-last-shore-inv");
    if (raw === "") return;
    const index = Number(raw);
    if (Number.isNaN(index)) return;
    const slot = save.inventory[index];
    if (!slot || !acceptDrop(slot.itemId, target)) return;
    const next = placeInFireplace(save, index, target, Date.now());
    if (next) onChange(next);
  }

  function take(
    target:
      | { kind: "ignition" }
      | { kind: "tinder" }
      | { kind: "fuel"; qty?: number }
      | { kind: "food"; slotIndex: number },
  ) {
    const next = takeFromFireplace(save, target, Date.now());
    if (next) onChange(next);
  }

  function cookAt(slotIndex: number) {
    const next = startCook(save, slotIndex, Date.now());
    if (next) onChange(next);
  }

  if (!open) return null;

  const ringC = 2 * Math.PI * 46;
  const ringOffset = ringC * (1 - holdProgress);
  const flameScale = 0.72 + holdProgress * 0.55;
  const flameGlow = 0.25 + holdProgress * 0.75;

  const cooking =
    save.activity?.kind === "cook" ? save.activity : null;

  return (
    <div className="fireplace-page" onClick={(e) => e.stopPropagation()}>
      <div className="fp-head">
        <h1>Fireplace</h1>
        <button type="button" onClick={onClose}>
          Back
        </button>
      </div>

      <div className="fireplace-stage">
        <div className="fp-slots">
          <div className="fp-slot ignition">
            <span className="fp-slot-label">Ignition</span>
            <button
              type="button"
              className={`fp-slot-box${dragOver === "ignition" ? " over" : ""}`}
              title={fp.slots.ignition ? undefined : SLOT_HINTS.ignition}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver("ignition");
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDropTarget(e, { kind: "ignition" })}
              onClick={() => take({ kind: "ignition" })}
            >
              <SlotArt slot={fp.slots.ignition} />
              <EmptySlotHint
                hint={SLOT_HINTS.ignition}
                empty={!fp.slots.ignition}
              />
            </button>
          </div>

          <div className="fp-slot tinder">
            <span className="fp-slot-label">Tinder</span>
            <button
              type="button"
              className={`fp-slot-box${dragOver === "tinder" ? " over" : ""}`}
              title={fp.slots.tinder ? undefined : SLOT_HINTS.tinder}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver("tinder");
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDropTarget(e, { kind: "tinder" })}
              onClick={() => take({ kind: "tinder" })}
            >
              <SlotArt slot={fp.slots.tinder} />
              <EmptySlotHint
                hint={SLOT_HINTS.tinder}
                empty={!fp.slots.tinder}
              />
            </button>
          </div>

          <div className="fp-slot fuel">
            <span className="fp-slot-label">Fuel</span>
            <button
              type="button"
              className={`fp-slot-box${dragOver === "fuel" ? " over" : ""}`}
              title={fp.slots.fuelWood >= 1 ? undefined : SLOT_HINTS.fuel}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver("fuel");
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDropTarget(e, { kind: "fuel" })}
              onClick={() => take({ kind: "fuel", qty: 1 })}
            >
              <SlotArt slot={null} woodCount={fp.slots.fuelWood} />
              {fp.slots.fuelWood < 1 && (
                <span style={{ fontSize: 10, opacity: 0.4 }}>0/{FIRE_FUEL_MAX}</span>
              )}
              <EmptySlotHint
                hint={SLOT_HINTS.fuel}
                empty={fp.slots.fuelWood < 1}
              />
            </button>
          </div>

          <div className="fp-slot food">
            <span className="fp-slot-label">Food</span>
            {foodSlots.map((food, i) => {
              const cookable =
                lit &&
                food &&
                isCookable(food.itemId) &&
                food.itemId !== "cooking_pan" &&
                !save.activity;
              return (
                <div key={i} className={i > 0 ? "fp-food-extra" : undefined}>
                  <button
                    type="button"
                    className={`fp-slot-box${dragOver === `food-${i}` ? " over" : ""}`}
                    title={food ? undefined : SLOT_HINTS.food}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(`food-${i}`);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) =>
                      onDropTarget(e, { kind: "food", slotIndex: i })
                    }
                    onClick={() => take({ kind: "food", slotIndex: i })}
                  >
                    <SlotArt slot={food} />
                    <EmptySlotHint hint={SLOT_HINTS.food} empty={!food} />
                  </button>
                  {cookable && (
                    <button
                      type="button"
                      className="fp-cook"
                      onClick={(e) => {
                        e.stopPropagation();
                        cookAt(i);
                      }}
                    >
                      Cook
                    </button>
                  )}
                  {cooking?.cookSlotIndex === i && (
                    <span className="fp-slot-label" style={{ opacity: 0.8 }}>
                      {formatRemaining(cooking.endsAt, now)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="fireplace-closeup"
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerCancel={onHoldEnd}
          onLostPointerCapture={onHoldEnd}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            cursor: ready && !lit ? "pointer" : "default",
          }}
        >
          {(holdProgress > 0 || (ready && !lit)) && (
            <div
              className="fp-hold-ring"
              aria-hidden
              style={{
                transform: `scale(${1 - holdProgress * 0.22})`,
                opacity: 0.45 + holdProgress * 0.55,
              }}
            >
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="rgba(255,178,92,.22)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#FFB25C"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 50 50)"
                  style={{
                    transition: holding.current
                      ? "none"
                      : "stroke-dashoffset .12s linear",
                  }}
                />
              </svg>
            </div>
          )}

          <svg viewBox="0 0 200 200" aria-hidden>
            <defs>
              <radialGradient id="fp-glow" cx=".5" cy=".55" r=".5">
                <stop
                  offset="0"
                  stopColor="#FFAF54"
                  stopOpacity={lit ? 0.7 : flameGlow * 0.55}
                />
                <stop offset="1" stopColor="#E4763F" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse
              cx="100"
              cy="118"
              rx="88"
              ry="42"
              fill="url(#fp-glow)"
              opacity={lit ? 1 : 0.35 + holdProgress * 0.65}
            />
            <ellipse cx="100" cy="148" rx="42" ry="12" fill="#3A322C" opacity=".7" />
            <g fill="#6B5A4A">
              <polygon points="68,142 78,134 90,142 80,150" />
              <polygon points="110,140 122,132 134,142 120,150" />
              <polygon points="88,154 100,148 114,156 100,162" />
            </g>
            <g fill="#4A3828">
              <polygon points="78,138 118,124 122,130 82,144" />
              <polygon points="82,128 120,142 116,148 78,134" />
            </g>
            <g
              style={{
                transformOrigin: "100px 132px",
                transform: `scale(${lit ? 1.05 : flameScale})`,
                opacity: lit ? 1 : 0.15 + holdProgress * 0.85,
                transition: holding.current ? "none" : "opacity .2s, transform .2s",
              }}
            >
              <path
                d="M100 132c-14-9-17-24-8-38 2 9 6 15 12 18 4-14 3-26-6-36 20 9 32 26 32 42 0 12-9 20-21 23z"
                fill="#E4763F"
              />
              <path
                d="M102 128c-8-6-9-16-4-24 1 6 4 10 9 12 2-8 0-15-3-21 12 7 18 16 18 26 0 8-6 12-13 14z"
                fill="#FFC578"
              />
            </g>
          </svg>
        </div>
      </div>

      <p className="fp-hint">
        {lit
          ? `Burning · ${Math.floor(fp.slots.fuelWood)} wood · 1/hour`
          : ready
            ? "Hold the flame to light · 5 seconds"
            : "Ignition, tinder, and at least 1 wood"}
      </p>

      <div className="fp-strip">
        {save.inventory.map((slot, i) => {
          const def = ITEMS[slot.itemId];
          if (!def) return null;
          const uses =
            slot.durability ??
            (isIgnition(slot.itemId) ? IGNITION_USES[slot.itemId] : undefined);
          return (
            <button
              key={`${slot.itemId}-${i}`}
              type="button"
              className="slot"
              draggable
              onDragStart={(e) => onInvDragStart(e, i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemArtSrc(slot.itemId)} alt={def.name} />
              {slot.qty > 1 && <span className="qty">{slot.qty}</span>}
              {uses !== undefined && <span className="uses">{uses}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
