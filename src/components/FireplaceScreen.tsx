"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  isFireplaceBuiltTier,
  type FireplaceBuiltTier,
} from "@/game/fireplaceArt";
import { ITEMS, itemArtSrc } from "@/game/items";
import type { InventorySlot, SaveState } from "@/game/persist";
import {
  DropTarget,
  usePointerDrag,
  type PointerDragPayload,
} from "./pointerDrag";
import {
  FireplaceCloseupArt,
  fireplaceAshCss,
  PAGE_FIRE_SIZE as FP_ART_SIZE,
} from "./FireplaceCloseupArt";

const SLOT_HINTS = {
  ignition: "Flint, Wooden Matches, Lighter",
  tinder: "Tinder",
  fuel: "Wood",
  food: "Fish, Crab, Can of Food, or a Cooking Pan",
} as const;

function tierOf(save: SaveState): FireplaceBuiltTier {
  const built = save.fireplace.built;
  return isFireplaceBuiltTier(built) ? built : "simple";
}

type DropKind =
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

function FireplaceSlot({
  id,
  target,
  className,
  title,
  acceptDrop,
  onPlace,
  onTake,
  children,
}: {
  id: string;
  target: DropKind;
  className: string;
  title?: string;
  acceptDrop: (itemId: string, target: DropKind) => boolean;
  onPlace: (inventoryIndex: number, target: DropKind) => void;
  onTake: () => void;
  children: ReactNode;
}) {
  return (
    <DropTarget
      id={id}
      as="button"
      className={className}
      overClassName="over"
      title={title}
      accept={(p) => acceptDrop(p.itemId, target)}
      onDrop={(p) => onPlace(p.inventoryIndex, target)}
      onClick={onTake}
    >
      {children}
    </DropTarget>
  );
}

export function FireplaceScreen({
  open,
  save,
  now,
  onClose,
  onChange,
}: Props) {
  const { bindDraggable } = usePointerDrag();
  const [holdProgress, setHoldProgress] = useState(0);
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
  const tier = tierOf(save);
  const pan = hasPanInFood(fp.slots.food);
  const foodSlots = pan
    ? fp.slots.food.length < 2
      ? [...fp.slots.food, null]
      : fp.slots.food
    : fp.slots.food.slice(0, 1);

  const ashCss = fireplaceAshCss(tier);
  const [displayTier, setDisplayTier] = useState(tier);
  const [fadeTier, setFadeTier] = useState<FireplaceBuiltTier | null>(null);
  const [fadeOn, setFadeOn] = useState(false);

  useEffect(() => {
    if (!open || tier === displayTier) return;
    setFadeTier(tier);
    setFadeOn(false);
    const kick = requestAnimationFrame(() => setFadeOn(true));
    const done = window.setTimeout(() => {
      setDisplayTier(tier);
      setFadeTier(null);
      setFadeOn(false);
    }, 300);
    return () => {
      cancelAnimationFrame(kick);
      window.clearTimeout(done);
    };
  }, [tier, open, displayTier]);

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

  function acceptDrop(itemId: string, target: DropKind): boolean {
    if (target.kind === "ignition") return isIgnition(itemId);
    if (target.kind === "tinder") return itemId === "tinder";
    if (target.kind === "fuel") return itemId === "wood";
    if (itemId === "cooking_pan") return true;
    if (target.slotIndex === 1 && !pan && itemId !== "cooking_pan") return false;
    return isCookable(itemId);
  }

  function onPlace(inventoryIndex: number, target: DropKind) {
    const slot = save.inventory[inventoryIndex];
    if (!slot || !acceptDrop(slot.itemId, target)) return;
    const next = placeInFireplace(save, inventoryIndex, target, Date.now());
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
        <div
          className="fireplace-closeup"
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerCancel={onHoldEnd}
          onLostPointerCapture={onHoldEnd}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            cursor: ready && !lit ? "pointer" : "default",
            width: `min(92%, ${Math.round(FP_ART_SIZE)}px)`,
          }}
        >
          {(holdProgress > 0 || (ready && !lit)) && (
            <div
              className="fp-hold-ring"
              aria-hidden
              style={{
                left: ashCss.left,
                top: ashCss.top,
                transform: `translate(-50%, -50%) scale(${1 - holdProgress * 0.22})`,
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

          <FireplaceCloseupArt
            tier={tier}
            displayTier={displayTier}
            fadeTier={fadeTier}
            fadeOn={fadeOn}
            lit={lit}
            holdProgress={holdProgress}
            flameScale={flameScale}
            flameGlow={flameGlow}
            holding={!!holding.current}
          />

          <div className="fp-slots">
            <div
              className="fp-slot ignition"
              style={{
                left: ashCss.left,
                top: ashCss.top,
                transform: "translate(calc(-50% - 96px), calc(-50% - 120px))",
              }}
            >
              <span className="fp-slot-label">Ignition</span>
              <FireplaceSlot
                id="fp-ignition"
                target={{ kind: "ignition" }}
                className="fp-slot-box"
                title={fp.slots.ignition ? undefined : SLOT_HINTS.ignition}
                acceptDrop={acceptDrop}
                onPlace={onPlace}
                onTake={() => take({ kind: "ignition" })}
              >
                <SlotArt slot={fp.slots.ignition} />
                <EmptySlotHint
                  hint={SLOT_HINTS.ignition}
                  empty={!fp.slots.ignition}
                />
              </FireplaceSlot>
            </div>

            <div
              className="fp-slot tinder"
              style={{
                left: ashCss.left,
                top: ashCss.top,
                transform: "translate(calc(-50% + 96px), calc(-50% - 120px))",
              }}
            >
              <span className="fp-slot-label">Tinder</span>
              <FireplaceSlot
                id="fp-tinder"
                target={{ kind: "tinder" }}
                className="fp-slot-box"
                title={fp.slots.tinder ? undefined : SLOT_HINTS.tinder}
                acceptDrop={acceptDrop}
                onPlace={onPlace}
                onTake={() => take({ kind: "tinder" })}
              >
                <SlotArt slot={fp.slots.tinder} />
                <EmptySlotHint
                  hint={SLOT_HINTS.tinder}
                  empty={!fp.slots.tinder}
                />
              </FireplaceSlot>
            </div>

            <div
              className="fp-slot fuel"
              style={{
                left: ashCss.left,
                top: ashCss.top,
                transform: "translate(calc(-50% - 96px), calc(-50% + 100px))",
              }}
            >
              <span className="fp-slot-label">Fuel</span>
              <FireplaceSlot
                id="fp-fuel"
                target={{ kind: "fuel" }}
                className="fp-slot-box"
                title={fp.slots.fuelWood >= 1 ? undefined : SLOT_HINTS.fuel}
                acceptDrop={acceptDrop}
                onPlace={onPlace}
                onTake={() => take({ kind: "fuel", qty: 1 })}
              >
                <SlotArt slot={null} woodCount={fp.slots.fuelWood} />
                {fp.slots.fuelWood < 1 && (
                  <span style={{ fontSize: 10, opacity: 0.4 }}>
                    0/{FIRE_FUEL_MAX}
                  </span>
                )}
                <EmptySlotHint
                  hint={SLOT_HINTS.fuel}
                  empty={fp.slots.fuelWood < 1}
                />
              </FireplaceSlot>
            </div>

            <div
              className="fp-slot food"
              style={{
                left: ashCss.left,
                top: ashCss.top,
                transform: "translate(calc(-50% + 96px), calc(-50% + 100px))",
              }}
            >
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
                    <FireplaceSlot
                      id={`fp-food-${i}`}
                      target={{ kind: "food", slotIndex: i }}
                      className="fp-slot-box"
                      title={food ? undefined : SLOT_HINTS.food}
                      acceptDrop={acceptDrop}
                      onPlace={onPlace}
                      onTake={() => take({ kind: "food", slotIndex: i })}
                    >
                      <SlotArt slot={food} />
                      <EmptySlotHint hint={SLOT_HINTS.food} empty={!food} />
                    </FireplaceSlot>
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
          const payload: PointerDragPayload = {
            kind: "inventory",
            itemId: slot.itemId,
            artSrc: itemArtSrc(slot.itemId),
            inventoryIndex: i,
          };
          const bind = bindDraggable({
            sourceKey: `fp-inv-${i}-${slot.itemId}`,
            payload,
          });
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
              {uses !== undefined && <span className="uses">{uses}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
