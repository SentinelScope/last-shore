"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  src: string;
  onClose: () => void;
};

/**
 * Full-screen Look at the gated photograph.
 * Loads only when opened. Pinch-zoom + pan; tap outside or Close to leave.
 * No caption, frame, or beach chrome.
 */
export function SecretLookViewer({ open, src, onClose }: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setLoadedSrc(null);
      setScale(1);
      setTx(0);
      setTy(0);
      pointers.current.clear();
      pinchStart.current = null;
      panStart.current = null;
      return;
    }
    setLoadedSrc(src);
  }, [open, src]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      pinchStart.current = { dist, scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
      pinchStart.current = null;
    }
  }, [scale, tx, ty]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const next = Math.min(
        4,
        Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist),
      );
      setScale(next);
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTx(panStart.current.tx + dx);
      setTy(panStart.current.ty + dy);
    }
  }, [scale]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
    if (pointers.current.size === 1) {
      const only = [...pointers.current.entries()][0];
      if (only) {
        panStart.current = {
          x: only[1].x,
          y: only[1].y,
          tx,
          ty,
        };
      }
    }
  }, [tx, ty]);

  if (!open) return null;

  return (
    <div
      className="secret-look"
      ref={wrapRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="secret-look-close" onClick={onClose}>
        Close
      </button>
      {loadedSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={loadedSrc}
          alt=""
          className="secret-look-img"
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}
