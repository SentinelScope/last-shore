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
  onPick: (durationId: DurationId) => void;
  onClose: () => void;
};

export function DurationPicker({
  open,
  kind,
  weather,
  blockedReason,
  onPick,
  onClose,
}: Props) {
  if (!kind) return null;

  return (
    <div
      className={`caption picker${open ? " on" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>{ACTIVITY_LABEL[kind]}</h2>
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
