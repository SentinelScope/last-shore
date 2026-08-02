"use client";

import {
  DOCUMENT_BODIES,
  DOCUMENT_COUNT,
  documentTitle,
  type DocumentNumber,
} from "@/game/documents";

type Props = {
  open: boolean;
  documentNumber: DocumentNumber | null;
  recoveredCount: number;
  onClose: () => void;
};

/**
 * Cold typed report — same sheet chrome as the diary, colder paper and typewriter body.
 * No page-flip SFX (silence; no dry rustle asset).
 */
export function DocumentViewer({
  open,
  documentNumber: n,
  recoveredCount,
  onClose,
}: Props) {
  if (!n) return null;
  const body = DOCUMENT_BODIES[n];

  return (
    <div
      className={`sheet${open ? " on" : ""}`}
      id="document-viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="scrollwrap report-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="report-edge" aria-hidden />
        <div className="report">
          <h1>{documentTitle(n)}</h1>
          <div className="sub">
            {recoveredCount} of {DOCUMENT_COUNT} recovered
          </div>
          <pre className="report-body">{body}</pre>
        </div>
        <div className="report-edge" aria-hidden />
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
