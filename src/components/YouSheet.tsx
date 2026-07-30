"use client";

import {
  buildLedger,
  type LedgerRow,
} from "@/game/vitals";
import { itemArtSrc } from "@/game/items";
import type { SaveState } from "@/game/persist";
import type { WeatherId } from "@/game/balance";

type Props = {
  open: boolean;
  save: SaveState;
  weather: WeatherId;
  onClose: () => void;
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

export function YouSheet({ open, save, weather, onClose }: Props) {
  const sections = buildLedger(save, weather);

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
