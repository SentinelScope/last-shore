"use client";

/**
 * Pointer-based drag (touch + mouse). Replaces HTML5 drag-and-drop.
 * Movement > 6px starts a drag — no long-press delay.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MOVE_THRESHOLD_PX = 6;
const GHOST_OFFSET_Y = 40;
const GHOST_SIZE = 56;
const SETTLE_MS = 200;

export type PointerDragPayload = {
  itemId: string;
  artSrc: string;
  inventoryIndex: number;
  /** Discriminator for drop handlers. */
  kind: "inventory" | "water" | "comfort" | "duct_tape" | "tool";
};

type DropRegistration = {
  id: string;
  accept: (payload: PointerDragPayload) => boolean;
  onDrop: (payload: PointerDragPayload) => void;
  element: HTMLElement;
};

type GhostState = {
  artSrc: string;
  x: number;
  y: number;
  live: boolean;
  settling: boolean;
};

type Session = {
  pointerId: number;
  startX: number;
  startY: number;
  live: boolean;
  payload: PointerDragPayload;
  sourceKey: string;
  onTap?: () => void;
  captureEl: HTMLElement;
  /** When true, horizontal pans are left to a scroll parent (strip). */
  allowPanX: boolean;
};

type DragContextValue = {
  overTargetId: string | null;
  activeSourceKey: string | null;
  registerDropTarget: (reg: DropRegistration) => () => void;
  bindDraggable: (opts: {
    sourceKey: string;
    payload: PointerDragPayload;
    disabled?: boolean;
    onTap?: () => void;
    /** Defaults to "none". Use "pan-x" on horizontal inventory strips. */
    touchAction?: string;
  }) => {
    onPointerDown: (e: ReactPointerEvent) => void;
    className: string;
    style: CSSProperties;
    "data-draggable": string;
  };
};

const DragContext = createContext<DragContextValue | null>(null);

function findDropTargetEl(from: Element | null): HTMLElement | null {
  let el: Element | null = from;
  while (el) {
    if (el instanceof HTMLElement && el.hasAttribute("data-drop-target")) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function PointerDragProvider({ children }: { children: ReactNode }) {
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [overTargetId, setOverTargetId] = useState<string | null>(null);
  const [activeSourceKey, setActiveSourceKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const targetsRef = useRef(new Map<string, DropRegistration>());
  const sessionRef = useRef<Session | null>(null);
  const ghostPosRef = useRef({ x: 0, y: 0 });
  const overIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const registerDropTarget = useCallback((reg: DropRegistration) => {
    targetsRef.current.set(reg.id, reg);
    return () => {
      const cur = targetsRef.current.get(reg.id);
      if (cur === reg) targetsRef.current.delete(reg.id);
    };
  }, []);

  const setOver = useCallback((id: string | null) => {
    if (overIdRef.current === id) return;
    overIdRef.current = id;
    setOverTargetId(id);
  }, []);

  const resolveOver = useCallback(
    (clientX: number, clientY: number): DropRegistration | null => {
      const session = sessionRef.current;
      if (!session?.live) {
        setOver(null);
        return null;
      }
      const stack = document.elementsFromPoint(clientX, clientY);
      let hit: HTMLElement | null = null;
      for (const node of stack) {
        hit = findDropTargetEl(node);
        if (hit) break;
      }
      if (!hit) {
        setOver(null);
        return null;
      }
      const id = hit.getAttribute("data-drop-target");
      if (!id) {
        setOver(null);
        return null;
      }
      const reg = targetsRef.current.get(id);
      if (!reg || !reg.accept(session.payload)) {
        setOver(null);
        return null;
      }
      setOver(id);
      return reg;
    },
    [setOver],
  );

  const abort = useCallback(() => {
    sessionRef.current = null;
    setGhost(null);
    setOver(null);
    setActiveSourceKey(null);
  }, [setOver]);

  const settleInto = useCallback(
    (targetEl: HTMLElement, artSrc: string, x: number, y: number) => {
      const rect = targetEl.getBoundingClientRect();
      const tx = rect.left + rect.width / 2 - GHOST_SIZE / 2;
      const ty = rect.top + rect.height / 2 - GHOST_SIZE / 2;
      setGhost({
        artSrc,
        x,
        y,
        live: true,
        settling: false,
      });
      requestAnimationFrame(() => {
        setGhost({
          artSrc,
          x: tx,
          y: ty + GHOST_OFFSET_Y,
          live: true,
          settling: true,
        });
      });
      window.setTimeout(() => {
        abort();
      }, SETTLE_MS);
    },
    [abort],
  );

  const detachWindow = useRef<() => void>(() => {});

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      if (!session.live) {
        const dist2 = dx * dx + dy * dy;
        if (dist2 < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) return;

        // Horizontal strip: let the browser keep scrolling; abandon the drag.
        if (session.allowPanX && Math.abs(dx) >= Math.abs(dy)) {
          detachWindow.current();
          sessionRef.current = null;
          return;
        }

        session.live = true;
        try {
          session.captureEl.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setActiveSourceKey(session.sourceKey);
        setGhost({
          artSrc: session.payload.artSrc,
          x: e.clientX,
          y: e.clientY,
          live: true,
          settling: false,
        });
      }

      e.preventDefault();
      ghostPosRef.current = { x: e.clientX, y: e.clientY };
      setGhost({
        artSrc: session.payload.artSrc,
        x: e.clientX,
        y: e.clientY,
        live: true,
        settling: false,
      });
      resolveOver(e.clientX, e.clientY);
    },
    [resolveOver],
  );

  const endPointer = useCallback(
    (e: PointerEvent, cancelled: boolean) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      try {
        session.captureEl.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      detachWindow.current();

      if (cancelled) {
        abort();
        return;
      }

      if (!session.live) {
        const tap = session.onTap;
        sessionRef.current = null;
        setActiveSourceKey(null);
        tap?.();
        return;
      }

      const reg = resolveOver(e.clientX, e.clientY);
      const payload = session.payload;
      const { x, y } = ghostPosRef.current;

      if (reg) {
        reg.onDrop(payload);
        settleInto(reg.element, payload.artSrc, x, y);
        sessionRef.current = null;
        setOver(null);
        setActiveSourceKey(null);
        return;
      }

      abort();
    },
    [abort, resolveOver, settleInto, setOver],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => endPointer(e, false),
    [endPointer],
  );
  const onPointerCancel = useCallback(
    (e: PointerEvent) => endPointer(e, true),
    [endPointer],
  );

  useEffect(() => {
    detachWindow.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [onPointerMove, onPointerUp, onPointerCancel]);

  const bindDraggable = useCallback(
    (opts: {
      sourceKey: string;
      payload: PointerDragPayload;
      disabled?: boolean;
      onTap?: () => void;
      touchAction?: string;
    }) => {
      return {
        "data-draggable": "1" as const,
        className: `ptr-drag-src${
          activeSourceKey === opts.sourceKey ? " is-lifted" : ""
        }`,
        style: {
          touchAction: opts.touchAction ?? "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as CSSProperties,
        onPointerDown: (e: ReactPointerEvent) => {
          if (opts.disabled) return;
          if (e.button !== 0 && e.pointerType === "mouse") return;
          if (sessionRef.current) return;

          const allowPanX = (opts.touchAction ?? "none").includes("pan-x");
          // Defer preventDefault / capture when a parent strip may scroll.
          if (!allowPanX) {
            e.preventDefault();
            e.stopPropagation();
          }
          const el = e.currentTarget as HTMLElement;
          if (!allowPanX) {
            el.setPointerCapture(e.pointerId);
          }

          const suppressClick = (ev: Event) => {
            ev.preventDefault();
            ev.stopPropagation();
            el.removeEventListener("click", suppressClick, true);
          };
          el.addEventListener("click", suppressClick, true);

          sessionRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            live: false,
            payload: opts.payload,
            sourceKey: opts.sourceKey,
            onTap: opts.onTap,
            captureEl: el,
            allowPanX,
          };
          ghostPosRef.current = { x: e.clientX, y: e.clientY };

          window.addEventListener("pointermove", onPointerMove, {
            passive: false,
          });
          window.addEventListener("pointerup", onPointerUp);
          window.addEventListener("pointercancel", onPointerCancel);
        },
      };
    },
    [activeSourceKey, onPointerMove, onPointerUp, onPointerCancel],
  );

  const value: DragContextValue = {
    overTargetId,
    activeSourceKey,
    registerDropTarget,
    bindDraggable,
  };

  const ghostStyle: CSSProperties | undefined = ghost
    ? {
        transform: `translate3d(${ghost.x - GHOST_SIZE / 2}px, ${
          ghost.y - GHOST_OFFSET_Y - GHOST_SIZE / 2
        }px, 0) scale(${ghost.settling ? 0.92 : 1.12})`,
        transition: ghost.settling
          ? `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out`
          : undefined,
        opacity: ghost.settling ? 0.35 : 1,
      }
    : undefined;

  return (
    <DragContext.Provider value={value}>
      {children}
      {mounted &&
        ghost &&
        createPortal(
          <div
            className={`ptr-drag-ghost${ghost.live ? " live" : ""}${
              ghost.settling ? " settling" : ""
            }`}
            style={ghostStyle}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ghost.artSrc} alt="" />
          </div>,
          document.body,
        )}
    </DragContext.Provider>
  );
}

export function usePointerDrag(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) {
    throw new Error("usePointerDrag requires PointerDragProvider");
  }
  return ctx;
}

type DropTargetProps = {
  id: string;
  accept: (payload: PointerDragPayload) => boolean;
  onDrop: (payload: PointerDragPayload) => void;
  className?: string;
  overClassName?: string;
  children?: ReactNode;
  as?: "div" | "button";
  type?: "button";
  title?: string;
  onClick?: () => void;
  style?: CSSProperties;
};

export function DropTarget({
  id,
  accept,
  onDrop,
  className = "",
  overClassName = "drop-over",
  children,
  as = "div",
  type = "button",
  title,
  onClick,
  style,
}: DropTargetProps) {
  const { registerDropTarget } = usePointerDrag();
  const ref = useRef<HTMLElement | null>(null);
  const acceptRef = useRef(accept);
  const onDropRef = useRef(onDrop);
  acceptRef.current = accept;
  onDropRef.current = onDrop;
  const { overTargetId } = usePointerDrag();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerDropTarget({
      id,
      element: el,
      accept: (p) => acceptRef.current(p),
      onDrop: (p) => onDropRef.current(p),
    });
  }, [id, registerDropTarget]);

  const over = overTargetId === id;
  const mergedClass = `${className} ptr-drop-target${over ? ` ${overClassName}` : ""}`;

  const shared = {
    ref: ref as React.Ref<HTMLButtonElement & HTMLDivElement>,
    "data-drop-target": id,
    className: mergedClass,
    title,
    onClick,
    style: {
      touchAction: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
      WebkitTouchCallout: "none",
      ...style,
    } as CSSProperties,
  };

  if (as === "button") {
    return createElement("button", { ...shared, type }, children);
  }
  return createElement("div", shared, children);
}
