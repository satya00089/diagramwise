import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/**
 * Where the user wants the island, anchored to an edge. Anchoring (rather than
 * storing raw pixels) means a right-docked island stays right-docked whether
 * it is expanded or collapsed, and the saved intent is never overwritten by
 * the temporary shift needed to keep a wide island on screen.
 */
export type IslandPlacement = Readonly<{
  h: "left" | "center" | "right";
  v: "top" | "bottom";
  /** Distance from the left edge (left) or the right edge (right). */
  x: number;
  /** Distance from the top edge (top) or the bottom edge (bottom). */
  y: number;
}>;

type Box = Readonly<{
  width: number;
  height: number;
  islandWidth: number;
  islandHeight: number;
}>;

type Point = Readonly<{ left: number; top: number }>;

const STORAGE_KEY = "sim-island-placement";
const EDGE_MARGIN = 12;
const SNAP_DISTANCE = 32;
const CENTER_SNAP_DISTANCE = 48;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
const DESKTOP_QUERY = "(min-width: 701px)";

function isPlacement(value: unknown): value is IslandPlacement {
  const p = value as Partial<IslandPlacement> | null;
  return (
    !!p &&
    (p.h === "left" || p.h === "center" || p.h === "right") &&
    (p.v === "top" || p.v === "bottom") &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y)
  );
}

function readStoredPlacement(): IslandPlacement | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isPlacement(value) ? value : null;
  } catch {
    return null;
  }
}

function storePlacement(placement: IslandPlacement | null) {
  try {
    if (placement) localStorage.setItem(STORAGE_KEY, JSON.stringify(placement));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable; the island still moves for this session.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampPoint(point: Point, box: Box): Point {
  return {
    left: clamp(
      point.left,
      EDGE_MARGIN,
      box.width - box.islandWidth - EDGE_MARGIN,
    ),
    top: clamp(
      point.top,
      EDGE_MARGIN,
      box.height - box.islandHeight - EDGE_MARGIN,
    ),
  };
}

/** Turns an anchored placement into pixels for the island's current size. */
function resolvePlacement(placement: IslandPlacement, box: Box): Point {
  let left = placement.x;
  if (placement.h === "center") left = (box.width - box.islandWidth) / 2;
  else if (placement.h === "right")
    left = box.width - box.islandWidth - placement.x;
  const top =
    placement.v === "bottom"
      ? box.height - box.islandHeight - placement.y
      : placement.y;
  return clampPoint({ left, top }, box);
}

/** Picks anchors for a dropped position, snapping to nearby edges/center. */
function placementFromPoint(point: Point, box: Box): IslandPlacement {
  const right = box.width - box.islandWidth - EDGE_MARGIN;
  const bottom = box.height - box.islandHeight - EDGE_MARGIN;
  const center = (box.width - box.islandWidth) / 2;
  const clamped = clampPoint(point, box);

  let h: IslandPlacement["h"] = "left";
  let x = clamped.left;
  if (Math.abs(clamped.left - center) <= CENTER_SNAP_DISTANCE) {
    h = "center";
    x = 0;
  } else if (clamped.left - EDGE_MARGIN <= SNAP_DISTANCE) {
    x = EDGE_MARGIN;
  } else if (right - clamped.left <= SNAP_DISTANCE) {
    h = "right";
    x = EDGE_MARGIN;
  }

  let v: IslandPlacement["v"] = "top";
  let y = clamped.top;
  if (clamped.top - EDGE_MARGIN <= SNAP_DISTANCE) {
    y = EDGE_MARGIN;
  } else if (bottom - clamped.top <= SNAP_DISTANCE) {
    v = "bottom";
    y = EDGE_MARGIN;
  }
  return { h, v, x, y };
}

/**
 * Lets the simulation island be moved anywhere inside its canvas container.
 * `placement === null` means "default": docked top-center.
 */
export function useDraggableIsland(
  containerRef: RefObject<HTMLElement | null>,
  islandRef: RefObject<HTMLElement | null>,
) {
  const [placement, setPlacement] = useState<IslandPlacement | null>(
    readStoredPlacement,
  );
  const [box, setBox] = useState<Box | null>(null);
  // While dragging, follow the pointer in raw pixels without touching the
  // saved placement until the drop.
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [enabled, setEnabled] = useState(
    () => globalThis.matchMedia?.(DESKTOP_QUERY).matches ?? true,
  );
  const drag = useRef<{ dx: number; dy: number; last: Point } | null>(null);
  const dragging = dragPoint !== null;

  useEffect(() => {
    const query = globalThis.matchMedia?.(DESKTOP_QUERY);
    if (!query) return;
    const update = () => setEnabled(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("sim-island-dragging");
    return () => document.body.classList.remove("sim-island-dragging");
  }, [dragging]);

  const measure = useCallback((): Box | null => {
    const container = containerRef.current;
    const island = islandRef.current;
    if (!container || !island) return null;
    return {
      width: container.clientWidth,
      height: container.clientHeight,
      islandWidth: island.offsetWidth,
      islandHeight: island.offsetHeight,
    };
  }, [containerRef, islandRef]);

  // Track sizes so the rendered spot is always derived from the saved
  // placement and the current container/island size.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const island = islandRef.current;
    if (!container || !island) return;
    const update = () => {
      const next = measure();
      if (!next) return;
      setBox((current) =>
        current &&
        current.width === next.width &&
        current.height === next.height &&
        current.islandWidth === next.islandWidth &&
        current.islandHeight === next.islandHeight
          ? current
          : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(island);
    return () => observer.disconnect();
  }, [containerRef, islandRef, measure]);

  const commit = useCallback((next: IslandPlacement | null) => {
    setPlacement(next);
    storePlacement(next);
  }, []);

  const currentOrigin = useCallback((): Point | null => {
    const container = containerRef.current;
    const island = islandRef.current;
    if (!container || !island) return null;
    const c = container.getBoundingClientRect();
    const i = island.getBoundingClientRect();
    return { left: i.left - c.left, top: i.top - c.top };
  }, [containerRef, islandRef]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return;
    const origin = currentOrigin();
    if (!origin) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      dx: event.clientX - origin.left,
      dy: event.clientY - origin.top,
      last: origin,
    };
    setDragPoint(origin);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const current = measure();
    if (!state || !current) return;
    const next = clampPoint(
      { left: event.clientX - state.dx, top: event.clientY - state.dy },
      current,
    );
    state.last = next;
    setDragPoint(next);
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    setDragPoint(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const current = measure();
    if (current) commit(placementFromPoint(state.last, current));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!enabled) return;
    if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      commit(null);
      return;
    }
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const delta: Record<string, Point> = {
      ArrowLeft: { left: -step, top: 0 },
      ArrowRight: { left: step, top: 0 },
      ArrowUp: { left: 0, top: -step },
      ArrowDown: { left: 0, top: step },
    };
    const move = delta[event.key];
    const current = measure();
    const origin = currentOrigin();
    if (!move || !current || !origin) return;
    event.preventDefault();
    commit(
      placementFromPoint(
        { left: origin.left + move.left, top: origin.top + move.top },
        current,
      ),
    );
  };

  let rendered: Point | null = null;
  if (enabled) {
    if (dragPoint) rendered = dragPoint;
    else if (placement && box) rendered = resolvePlacement(placement, box);
  }

  return {
    enabled,
    dragging,
    /** Pixel position to render at, or null while docked at top-center. */
    position: rendered,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
      onDoubleClick: () => commit(null),
    },
  };
}
