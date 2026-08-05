"use client";

import {
  ACTIVITY_DURATIONS,
  ACTIVITY_LABEL,
  WEATHER_LABEL,
  type ActivityKind,
  type DurationId,
  type WeatherId,
} from "@/game/balance";

type Props = {
  open: boolean;
  kind: ActivityKind | null;
  weather: WeatherId;
  blockedReason?: string | null;
  /** e.g. "Stone Spear" — shown as "Fishing — Stone Spear". */
  toolLabel?: string | null;
  /** When set, the tool name is tappable to cycle owned fishing tools. */
  onCycleTool?: (() => void) | null;
  onPick: (durationId: DurationId) => void;
  onClose: () => void;
};

export function DurationPicker({
  open,
  kind,
  weather,
  blockedReason,
  toolLabel,
  onCycleTool,
  onPick,
  onClose,
}: Props) {
  if (!kind) return null;

  const title = toolLabel
    ? `${ACTIVITY_LABEL[kind]} — ${toolLabel}`
    : ACTIVITY_LABEL[kind];

  return (
    <div
      className={`caption picker${open ? " on" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>
        {toolLabel && onCycleTool ? (
          <button
            type="button"
            className="picker-tool"
            onClick={onCycleTool}
            title="Tap to switch tool"
          >
            {title}
          </button>
        ) : (
          title
        )}
      </h2>
      <p className="picker-wx">
        Weather · {WEATHER_LABEL[weather]}
      </p>
      {blockedReason ? (
        <p>{blockedReason}</p>
      ) : (
        <>
          <p>How long will you spend?</p>
          <div className="durations">
            {(Object.keys(ACTIVITY_DURATIONS) as DurationId[]).map((id) => (
              <button
                key={id}
                type="button"
                className="dur"
                onClick={() => onPick(id)}
              >
                {ACTIVITY_DURATIONS[id].label}
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className="act muted" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
