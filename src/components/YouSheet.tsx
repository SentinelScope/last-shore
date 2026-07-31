"use client";

import { buildAilmentViews } from "@/game/ailments";
import type { WeatherId } from "@/game/balance";
import {
  CLOTHING_SLOTS,
  totalWornComfort,
  type ClothingSlotId,
} from "@/game/clothing";
import { ITEMS, itemArtSrc } from "@/game/items";
import type { SaveState } from "@/game/persist";
import {
  buildLedger,
  type LedgerRow,
} from "@/game/vitals";

type Props = {
  open: boolean;
  save: SaveState;
  weather: WeatherId;
  onClose: () => void;
  onCureAilment?: (ailmentId: "cut_finger" | "twisted_ankle" | "cold") => void;
  onUnequip?: (slot: ClothingSlotId) => string | null;
};

function formatSigned(value: number, unit?: string): string {
  const abs = Math.abs(value);
  const body =
    abs >= 10 ? abs.toFixed(0) : abs >= 1 ? abs.toFixed(2) : abs.toFixed(2);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const num = value === 0 ? "0" : `${sign}${body}`;
  return unit ? `${num} ${unit}` : num;
}

function Row({ row }: { row: LedgerRow }) {
  if (!row.always && Math.abs(row.value) < 0.0005) return null;
  const cls = row.value > 0 ? "pos" : row.value < 0 ? "neg" : "zero";
  return (
    <li className={`you-row ${cls}${row.kind ? ` ${row.kind}` : ""}`}>
      <span>{row.label}</span>
      <em>{formatSigned(row.value, row.unit)}</em>
    </li>
  );
}

const BAR_META = [
  {
    key: "thirst" as const,
    label: "Water",
    kind: "w",
    icon: "cup",
  },
  {
    key: "hunger" as const,
    label: "Food",
    kind: "f",
    icon: "coconut",
  },
  {
    key: "health" as const,
    label: "Health",
    kind: "h",
    icon: "bandage",
  },
  {
    key: "comfort" as const,
    label: "Comfort",
    kind: "c",
    icon: "handkerchief",
  },
];

/** Percent of the paper-doll wrap — anchored to body regions on character_front.png. */
const SLOT_POS: Record<ClothingSlotId, { left: string; top: string }> = {
  head: { left: "50%", top: "18%" },
  body: { left: "50%", top: "38%" },
  legs: { left: "50%", top: "58%" },
  feet: { left: "50%", top: "78%" },
};

function YouFigure({
  save,
  onUnequip,
}: {
  save: SaveState;
  onUnequip?: (slot: ClothingSlotId) => string | null;
}) {
  const worn = save.worn ?? {
    head: null,
    body: null,
    legs: null,
    feet: null,
  };
  const wornTotal = totalWornComfort(worn);

  return (
    <div className="you-figure-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="you-figure"
        src="/character/character_front.png"
        alt="You, front view"
        width={1024}
        height={1024}
      />

      {CLOTHING_SLOTS.map((slot) => {
        const itemId = worn[slot];
        const pos = SLOT_POS[slot];
        const def = itemId ? ITEMS[itemId] : null;
        return (
          <button
            key={slot}
            type="button"
            className={`you-slot you-slot-${slot}${itemId ? " filled" : ""}`}
            style={pos}
            title={def ? `Remove ${def.name}` : `${slot} — empty`}
            aria-label={def ? `Unequip ${def.name}` : `Empty ${slot} slot`}
            disabled={!itemId}
            onClick={() => {
              if (!itemId || !onUnequip) return;
              onUnequip(slot);
            }}
          >
            {itemId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`you-wear you-wear-${slot}`}
                src={itemArtSrc(itemId)}
                alt={def?.name ?? ""}
              />
            ) : (
              <span className="you-slot-empty" aria-hidden />
            )}
          </button>
        );
      })}

      <p className="you-worn-line">Worn: +{wornTotal}% comfort</p>
    </div>
  );
}

export function YouSheet({
  open,
  save,
  weather,
  onClose,
  onCureAilment,
  onUnequip,
}: Props) {
  const sections = buildLedger(save, weather);
  const ailments = buildAilmentViews(save);

  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="you-panel" onClick={(e) => e.stopPropagation()}>
        <div className="you-head">
          <h1>You</h1>
          <p className="cap">What is draining you, and what is holding you</p>
        </div>

        <YouFigure save={save} onUnequip={onUnequip} />

        <div className="you-bars">
          {BAR_META.map((b) => {
            const value = Math.round(save[b.key]);
            const filled = b.kind === "c" && value >= 40;
            return (
              <div
                key={b.key}
                className={`you-bar ${b.kind}`}
                data-filled={filled ? "" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemArtSrc(b.icon)} alt="" />
                <div className="you-bar-track">
                  <div
                    className="you-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                  />
                  <span className="you-bar-label">{b.label}</span>
                  <span className="you-bar-pct">{value}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="you-ledger">
          {sections.map((sec) => {
            const visible = sec.rows.filter(
              (r) => r.always || Math.abs(r.value) >= 0.0005,
            );
            const showEmptyComfort =
              sec.id === "comfort" && visible.length === 0;
            if (visible.length === 0 && !sec.net && !showEmptyComfort) {
              return null;
            }
            return (
              <section key={sec.id} className="you-sec">
                <header>
                  <h2>{sec.title}</h2>
                  {sec.headline && <span>{sec.headline}</span>}
                </header>
                <ul>
                  {showEmptyComfort && (
                    <li className="you-row zero">
                      <span>Nothing holding you yet</span>
                      <em>0</em>
                    </li>
                  )}
                  {visible.map((row) => (
                    <Row key={row.label} row={row} />
                  ))}
                  {sec.net && (
                    <>
                      <li className="you-rule" aria-hidden />
                      <Row row={sec.net} />
                    </>
                  )}
                </ul>
              </section>
            );
          })}

          <section className="you-sec you-ailments">
            <header>
              <h2>Ailments</h2>
            </header>
            {ailments.length === 0 ? (
              <p className="you-ailments-empty">
                Nothing wrong with you today.
              </p>
            ) : (
              <ul className="you-ailment-list">
                {ailments.map((a) => (
                  <li key={a.id} className="you-ailment">
                    <strong>{a.label}</strong>
                    <p>{a.impactLine}</p>
                    <p>{a.activeLine}</p>
                    <p>{a.cureLine}</p>
                    {a.cureActionItemId && a.cureActionLabel && onCureAilment ? (
                      <button
                        type="button"
                        className="you-cure"
                        onClick={() => {
                          if (
                            a.id === "cut_finger" ||
                            a.id === "twisted_ankle" ||
                            a.id === "cold"
                          ) {
                            onCureAilment(a.id);
                          }
                        }}
                      >
                        {a.cureActionLabel}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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
