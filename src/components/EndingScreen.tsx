"use client";

type Props = {
  days: number;
  line: string;
  bestDays: number;
  onNewRun: () => void;
};

export function EndingScreen({ days, line, bestDays, onNewRun }: Props) {
  return (
    <div className="ending" onClick={(e) => e.stopPropagation()}>
      <div className="ending-inner">
        <p className="ending-kicker">The shore keeps what it takes</p>
        <h1 className="ending-days">
          {days === 1 ? "1 day" : `${days} days`}
        </h1>
        <p className="ending-cause">{line}</p>
        {bestDays > 0 && (
          <p className="ending-best">
            Best · {bestDays === 1 ? "1 day" : `${bestDays} days`}
          </p>
        )}
        <button type="button" className="ending-go" onClick={onNewRun}>
          New run
        </button>
      </div>
    </div>
  );
}
