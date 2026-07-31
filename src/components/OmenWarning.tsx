"use client";

type Props = {
  open: boolean;
  onGo: () => void;
  onStay: () => void;
};

/** The only confirmation modal — shown before outdoor work in Omen. */
export function OmenWarning({ open, onGo, onStay }: Props) {
  if (!open) return null;
  return (
    <div className="sheet on omen-warn-sheet" role="dialog" aria-modal>
      <div className="omen-warn-card" onClick={(e) => e.stopPropagation()}>
        <p className="omen-warn-body">I have a bad feeling about this...</p>
        <div className="omen-warn-acts">
          <button type="button" className="omen-go" onClick={onGo}>
            Go anyway
          </button>
          <button type="button" className="omen-stay" onClick={onStay}>
            Stay put
          </button>
        </div>
      </div>
    </div>
  );
}
