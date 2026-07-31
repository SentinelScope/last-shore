"use client";

import {
  deltaClass,
  deltaLabel,
  groupDiaryByDay,
  type DiaryEntry,
} from "@/game/diary";

type Props = {
  open: boolean;
  entries: DiaryEntry[];
  onClose: () => void;
  /** Page-flip SFX after the sheet fades in. */
  onOpened?: () => void;
};

function formatDelta(amount: number): string {
  const sign = amount > 0 ? "+" : "−";
  return `${sign}${Math.abs(amount)}`;
}

export function DiarySheet({ open, entries, onClose, onOpened }: Props) {
  const groups = groupDiaryByDay(entries);

  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      id="diary"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTransitionEnd={(e) => {
        if (
          open &&
          e.propertyName === "opacity" &&
          e.target === e.currentTarget
        ) {
          onOpened?.();
        }
      }}
    >
      <div className="scrollwrap" onClick={(e) => e.stopPropagation()}>
        <div className="rod" aria-hidden />
        <div className="paper">
          <h1>The Shore Log</h1>
          <div className="sub">Written in salt and charcoal</div>

          {groups.length === 0 ? (
            <p className="fade">
              The first page is still blank. The charcoal is ready.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.dayNumber}>
                <h2>Day {group.dayNumber}</h2>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      {entry.text}
                      {entry.deltas.map((d, i) => (
                        <span
                          key={`${entry.id}-${d.stat}-${i}`}
                          className={`d ${deltaClass(d.stat)}`}
                        >
                          {formatDelta(d.amount)} {deltaLabel(d.stat)}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {groups.length > 0 ? (
            <p className="fade">
              Older pages have gone soft in the damp. The charcoal runs when it
              rains.
            </p>
          ) : null}
        </div>
        <div className="rod" aria-hidden />
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
