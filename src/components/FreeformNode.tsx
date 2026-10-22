import React from "react";
import ReactDOM from "react-dom";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  MdSettings,
  MdDelete,
  MdOutlineVerticalAlignTop,
  MdOutlineVerticalAlignBottom,
} from "react-icons/md";
import { IoDuplicateOutline } from "react-icons/io5";
import { FiUnlock } from "react-icons/fi";
import { FaLongArrowAltRight } from "react-icons/fa";
import DOMPurify from "dompurify";

export type FreeformShape = {
  type?:
    | "rect"
    | "square"
    | "circle"
    | "ellipse"
    | "line"
    | "diamond"
    | "triangle"
    | "hexagon"
    | "parallelogram"
    | "text"
    | "textbox";
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
};

export interface FreeformNodeData {
  label?: string;
  componentId?: string;
  shape?: FreeformShape;
  backgroundColor?: string;
  borderColor?: string;
  shapeType?:
    | "rect"
    | "square"
    | "circle"
    | "ellipse"
    | "line"
    | "diamond"
    | "triangle"
    | "hexagon"
    | "parallelogram"
    | "text"
    | "textbox";
  text?: string;
  description?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
}

type Pt = { x: number; y: number };

// Build polygon vertices for non-ellipsoid shapes so we can compute exact
// perimeter intersections for cardinal directions.
function buildPolygonVertices(
  shapeType: string,
  w: number,
  h: number,
  pad: number,
  cx: number,
  cy: number,
): Pt[] {
  if (shapeType === "triangle") {
    return [
      { x: cx, y: pad },
      { x: w - pad, y: h - pad },
      { x: pad, y: h - pad },
    ];
  }
  if (shapeType === "diamond") {
    return [
      { x: cx, y: pad },
      { x: w - pad, y: cy },
      { x: cx, y: h - pad },
      { x: pad, y: cy },
    ];
  }
  if (shapeType === "hexagon") {
    const rx = (w - pad * 2) / 2;
    const ry = (h - pad * 2) / 2;
    const out: Pt[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      out.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }
    return out;
  }
  if (shapeType === "parallelogram") {
    const skew = w * 0.2;
    return [
      { x: pad + skew, y: pad },
      { x: w - pad, y: pad },
      { x: w - pad - skew, y: h - pad },
      { x: pad, y: h - pad },
    ];
  }
  if (
    shapeType === "textbox" ||
    shapeType === "text" ||
    shapeType === "rect" ||
    shapeType === "square"
  ) {
    return [
      { x: pad, y: pad },
      { x: w - pad, y: pad },
      { x: w - pad, y: h - pad },
      { x: pad, y: h - pad },
    ];
  }
  if (shapeType === "line") {
    return [
      { x: 8, y: cy },
      { x: w - 8, y: cy },
    ];
  }
  // Fallback: bbox
  return [
    { x: pad, y: pad },
    { x: w - pad, y: pad },
    { x: w - pad, y: h - pad },
    { x: pad, y: h - pad },
  ];
}

function intersectVertical(
  ptsArr: Pt[],
  cxVal: number,
  cyVal: number,
  lookingUp: boolean,
): number | null {
  const eps = 1e-6;
  const cmp = (v: number) => (lookingUp ? v <= cyVal + eps : v >= cyVal - eps);
  const ys = ptsArr.flatMap((p1, i) => {
    const p2 = ptsArr[(i + 1) % ptsArr.length];
    if (Math.abs(p1.x - p2.x) < eps) {
      if (Math.abs(p1.x - cxVal) < eps) {
        return [p1.y, p2.y].filter((y) => cmp(y));
      }
      return [] as number[];
    }
    const t = (cxVal - p1.x) / (p2.x - p1.x);
    if (t >= -eps && t <= 1 + eps) {
      const y = p1.y + t * (p2.y - p1.y);
      return cmp(y) ? [y] : ([] as number[]);
    }
    return [] as number[];
  });
  if (ys.length === 0) return null;
  return lookingUp ? Math.max(...ys) : Math.min(...ys);
}

function intersectHorizontal(
  ptsArr: Pt[],
  cxVal: number,
  cyVal: number,
  lookingLeft: boolean,
): number | null {
  const eps = 1e-6;
  const cmp = (v: number) =>
    lookingLeft ? v <= cxVal + eps : v >= cxVal - eps;
  const xs = ptsArr.flatMap((p1, i) => {
    const p2 = ptsArr[(i + 1) % ptsArr.length];
    if (Math.abs(p1.y - p2.y) < eps) {
      if (Math.abs(p1.y - cyVal) < eps) {
        return [p1.x, p2.x].filter((x) => cmp(x));
      }
      return [] as number[];
    }
    const t = (cyVal - p1.y) / (p2.y - p1.y);
    if (t >= -eps && t <= 1 + eps) {
      const x = p1.x + t * (p2.x - p1.x);
      return cmp(x) ? [x] : ([] as number[]);
    }
    return [] as number[];
  });
  if (xs.length === 0) return null;
  return lookingLeft ? Math.max(...xs) : Math.min(...xs);
}

function computeCardinalPoints(
  shapeType: string,
  w: number,
  h: number,
  sw: number,
  pad: number,
) {
  const cx = w / 2;
  const cy = h / 2;
  if (shapeType === "ellipse" || shapeType === "circle") {
    const rx = Math.max(1, (w - sw * 2) / 2);
    const ry = Math.max(1, (h - sw * 2) / 2);
    return {
      tPt: { x: cx, y: cy - ry },
      rPt: { x: cx + rx, y: cy },
      bPt: { x: cx, y: cy + ry },
      lPt: { x: cx - rx, y: cy },
    };
  }
  const pts = buildPolygonVertices(shapeType, w, h, pad, cx, cy);
  const topY = intersectVertical(pts, cx, cy, true);
  const bottomY = intersectVertical(pts, cx, cy, false);
  const leftX = intersectHorizontal(pts, cx, cy, true);
  const rightX = intersectHorizontal(pts, cx, cy, false);
  return {
    tPt: topY == null ? { x: cx, y: pad } : { x: cx, y: topY },
    bPt: bottomY == null ? { x: cx, y: h - pad } : { x: cx, y: bottomY },
    lPt: leftX == null ? { x: pad, y: cy } : { x: leftX, y: cy },
    rPt: rightX == null ? { x: w - pad, y: cy } : { x: rightX, y: cy },
  };
}

type Props = {
  id: string;
  data: FreeformNodeData;
  selected?: boolean;
  onCopy?: (id: string, data: FreeformNodeData) => void;
  isInGroup?: boolean;
};

// Default background similar to other node types
const DEFAULT_BG = "color-mix(in srgb, var(--surface) 92%, #6366f1 8%)";

const FreeformNode: React.FC<Props> = ({
  id,
  data,
  selected,
  onCopy,
  isInGroup,
}) => {
  const shape = data?.shape || ({} as FreeformShape);
  const shapeType =
    (shape.type as string) || (data?.shapeType as string) || "rect";
  const initialW = (shape.width as number) || 180;
  const initialH = (shape.height as number) || 120;
  const stroke =
    (shape.stroke as string) || (data?.borderColor as string) || "#374151";
  // Default fill: prefer explicit shape.fill, then node backgroundColor, then DEFAULT_BG
  // (applies DEFAULT_BG to all shapes so they get a pleasant default fill).
  const fill =
    (shape.fill as string) || (data?.backgroundColor as string) || DEFAULT_BG;
  const strokeWidth = (shape.strokeWidth as number) ?? 2;

  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });

  // Live dimensions for SVG shapes — updated via NodeResizer callbacks
  const [measured, setMeasured] = React.useState({ w: initialW, h: initialH });
  const [isResizing, setIsResizing] = React.useState(false);
  const containerRef = React.useRef<HTMLFieldSetElement | null>(null);

  // Determine if this shape should maintain its aspect ratio while resizing.
  // We treat an explicit `shapeType: "square"` as a square-like shape, and
  // also treat rect/ellipse as square-like when their initial dimensions are equal.
  const ASPECT_TOLERANCE = 0.5; // pixels
  const isSquareLike =
    shapeType === "square" ||
    shapeType === "circle" ||
    ((shapeType === "rect" || shapeType === "ellipse") &&
      Math.abs(initialW - initialH) <= ASPECT_TOLERANCE);
  const aspectRatio =
    shapeType === "square" || shapeType === "circle"
      ? 1
      : initialW / Math.max(1, initialH);

  // Called on every resize drag tick — keeps SVG in sync with the live handle position
  const handleResize = React.useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      if (!isResizing) setIsResizing(true);
      // If square-like (or circle), constrain the live measured size to keep proportions.
      if (isSquareLike) {
        const MIN_W = 48;
        const MIN_H = 32;
        const prevW = measured.w;
        const prevH = measured.h;
        const deltaW = params.width - prevW;
        const deltaH = params.height - prevH;

        let newW = params.width;
        let newH = params.height;

        if (Math.abs(deltaW) >= Math.abs(deltaH)) {
          // Width-driven resize — compute height from width (use floats)
          newW = Math.max(MIN_W, params.width);
          newH = Math.max(MIN_H, newW / aspectRatio);
        } else {
          // Height-driven resize — compute width from height (use floats)
          newH = Math.max(MIN_H, params.height);
          newW = Math.max(MIN_W, newH * aspectRatio);
        }

        // For nearly-square case (aspectRatio ~ 1) keep perfect square (float)
        if (Math.abs(aspectRatio - 1) < 1e-6) {
          const side = Math.max(MIN_W, MIN_H, Math.min(newW, newH));
          newW = newH = side;
        }

        setMeasured({ w: newW, h: newH });
      } else {
        setMeasured({ w: params.width, h: params.height });
      }
    },
    [measured, isSquareLike, aspectRatio, isResizing],
  );

  // Keep measured in sync when shape dimensions change externally (e.g. after persistence).
  // Do NOT include `measured` in deps — that would fight live pointer-drag updates.
  React.useEffect(() => {
    const w = (shape.width as number) || initialW;
    const h = (shape.height as number) || initialH;
    setMeasured({ w, h });
  }, [shape.width, shape.height, initialW, initialH]);

  // Called only when the drag ends — persist to the playground store once
  const handleResizeEnd = React.useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      setIsResizing(false);
      // Ensure final persisted size respects square/circle constraints if applicable
      let finalW = params.width;
      let finalH = params.height;
      if (isSquareLike) {
        const MIN_W = 48;
        const MIN_H = 32;
        // Choose the dominant delta like in live resize
        const deltaW = params.width - measured.w;
        const deltaH = params.height - measured.h;
        if (Math.abs(deltaW) >= Math.abs(deltaH)) {
          finalW = Math.max(MIN_W, params.width);
          finalH = Math.max(MIN_H, finalW / aspectRatio);
        } else {
          finalH = Math.max(MIN_H, params.height);
          finalW = Math.max(MIN_W, finalH * aspectRatio);
        }
        if (Math.abs(aspectRatio - 1) < 1e-6) {
          const side = Math.max(MIN_W, MIN_H, Math.min(finalW, finalH));
          finalW = finalH = side;
        }
      }

      // Persist rounded integer sizes only when ending the resize
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-resize", {
          detail: { id, width: Math.round(finalW), height: Math.round(finalH) },
        }),
      );
    },
    [id, isSquareLike, aspectRatio, measured],
  );

  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  React.useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = (e: MouseEvent) => {
      const menu = document.querySelector("[data-context-menu]");
      if (menu && !menu.contains(e.target as Node)) closeContextMenu();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [contextMenu.visible, closeContextMenu]);

  const onDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-delete", { detail: { id } }),
      );
      closeContextMenu();
    },
    [id, closeContextMenu],
  );

  const onToggle = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-toggle", { detail: { id } }),
      );
      closeContextMenu();
    },
    [id, closeContextMenu],
  );

  const handleCopy = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCopy) onCopy(id, data);
      closeContextMenu();
    },
    [id, data, onCopy, closeContextMenu],
  );

  const handleDetach = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-detach", { detail: { id } }),
      );
      closeContextMenu();
    },
    [id, closeContextMenu],
  );

  // ── draw.io-style handle visibility ─────────────────────────────────────────
  // Handles (resize + connection arrows) appear on hover or when selected.
  // We use React state + a 150 ms leave-debounce so the arrows stay alive when
  // the mouse moves from the node body to a handle positioned outside the node's
  // layout box (CSS :hover on the parent is lost in that case).
  const [isHovered, setIsHovered] = React.useState(false);
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const nodePointerEnter = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const nodePointerLeave = React.useCallback(() => {
    leaveTimerRef.current = setTimeout(() => setIsHovered(false), 150);
  }, []);

  // Clean up timer on unmount
  React.useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    },
    [],
  );

  const showHandles = isHovered || !!selected;

  const SVG_SHAPES = [
    "ellipse",
    "circle",
    "line",
    "diamond",
    "triangle",
    "hexagon",
    "parallelogram",
    "text",
    "textbox",
  ];
  const isSvgShape = SVG_SHAPES.includes(shapeType);
  // We render shape fills inside SVG for all shapes (rect/square use an SVG rect)
  // so keep the fieldset transparent and draw borders/fills in SVG to avoid
  // a background "box" behind the shape.
  const bgColor = "transparent";
  const cssBorder = "none";

  return (
    <fieldset
      ref={containerRef}
      className="freeform-node rounded-md"
      onContextMenu={handleContextMenu}
      onPointerEnter={nodePointerEnter}
      onPointerLeave={nodePointerLeave}
      data-node-id={id}
      data-shape={shapeType}
      data-has-copy={onCopy ? "1" : "0"}
      data-is-in-group={isInGroup ? "1" : "0"}
      style={{
        width: `${measured.w}px`,
        height: `${measured.h}px`,
        backgroundColor: bgColor,
        border: cssBorder,
        boxSizing: "border-box",
        overflow: "visible", // allow handles outside node bounds to be visible
        position: "relative",
        margin: 0,
        padding: 0,
      }}
    >
      <legend className="sr-only">{`Freeform ${shapeType}`}</legend>
      {/* NodeResizer — visible on hover or select for ALL shapes; provides the bounding box UI */}
      <NodeResizer
        isVisible={showHandles}
        minWidth={48}
        minHeight={32}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        lineStyle={{
          borderColor: "#6366f1",
          borderStyle: "dashed",
          opacity: 0.75,
        }}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: "var(--surface)",
          border: "2px solid #6366f1",
          boxShadow: "0 1px 3px rgba(99,102,241,0.25)",
        }}
      />

      {/* SVG overlay for rect / square so fill is drawn inside the shape (not as fieldset background) */}
      {(shapeType === "rect" || shapeType === "square") &&
        (() => {
          const w = measured.w;
          const h = measured.h;
          const sw = strokeWidth;
          const pad = sw;
          const rx = Math.min(
            8,
            Math.max(2, Math.round(Math.min(w, h) * 0.04)),
          );
          // Show dashed selection ring when selected or actively resizing
          const showSel = selected || isResizing;
          const selStyle: React.CSSProperties = {
            opacity: showSel ? 0.9 : 0,
            transition: "opacity 0.1s",
          };
          const selProps = {
            fill: "none",
            stroke: "#6366f1",
            strokeWidth: 1.5,
            strokeDasharray: "6 4",
          };
          return (
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
                overflow: "visible",
              }}
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x={pad}
                y={pad}
                width={w - pad * 2}
                height={h - pad * 2}
                rx={rx}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
              />
              {/* selection outline — matches shape exactly */}
              <rect
                x={pad - 2}
                y={pad - 2}
                width={w - pad * 2 + 4}
                height={h - pad * 2 + 4}
                rx={rx + 2}
                style={selStyle}
                {...selProps}
              />
            </svg>
          );
        })()}

      {/* ── Draw.io-style connection arrows ─────────────────────────────────────
          Handle sits exactly at the shape's perimeter — React Flow anchors the
          edge there so connections start with zero gap.
          The arrow icon is a child of the Handle, absolutely offset G px outside
          the perimeter so the user can see where to drag.  Clicks on the icon
          bubble up to the Handle which starts the React Flow connection drag.  */}
      {(() => {
        const w = measured.w;
        const h = measured.h;
        const sw = strokeWidth;
        const pad = sw;
        const HS = 14; // Handle size — edge anchors at Handle center = perimeter
        const A = 22; // Arrow icon visual size (px)
        const G = 10; // gap: perimeter → arrow icon visual centre

        // ── Cardinal perimeter points per shape ──────────────────────────────
        const { tPt, rPt, bPt, lPt } = computeCardinalPoints(
          shapeType,
          w,
          h,
          sw,
          pad,
        );

        // Handle: invisible, positioned so its centre = perimeter point.
        // overflow:visible lets the icon render outside the Handle's box.
        const handleBase: React.CSSProperties = {
          position: "absolute",
          width: HS,
          height: HS,
          background: "transparent",
          border: "none",
          borderRadius: 0,
          minWidth: 0,
          minHeight: 0,
          padding: 0,
          transform: "none", // cancel React Flow's centering translate
          overflow: "visible", // icon extends outside Handle's border box
          zIndex: 50,
          cursor: "crosshair",
          opacity: showHandles ? 1 : 0,
          pointerEvents: showHandles ? "all" : "none",
          transition: "opacity 0.12s ease",
        };

        // Arrow icon: absolute inside Handle, offset so visual centre is G px
        // outside the perimeter. Compute offsets along the outward normal from
        // the node center to the perimeter point so icons for slanted shapes
        // (triangle, hexagon, etc.) appear outside the shape's box.
        const mkIcon = (
          deg: number,
          offL: number,
          offT: number,
        ): React.CSSProperties => ({
          position: "absolute",
          left: offL,
          top: offT,
          width: A,
          height: A,
          transform: `rotate(${deg}deg)`,
          flexShrink: 0,
          pointerEvents: "all",
          cursor: "crosshair",
        });

        const cx = w / 2;
        const cy = h / 2;
        const computeIconOffset = (pt: Pt, fallback: Pt) => {
          const dx = pt.x - cx;
          const dy = pt.y - cy;
          const dist = Math.hypot(dx, dy);
          let fx = fallback.x;
          let fy = fallback.y;
          if (dist > 1e-6) {
            fx = dx / dist;
            fy = dy / dist;
          }
          // Compute distance (t) along the outward vector to the rectangle edge.
          // Solve for t where pt + t*(fx,fy) crosses one of the box sides (pad..w-pad, pad..h-pad).
          const ts: number[] = [];
          if (Math.abs(fx) > 1e-6) {
            const tRight = (w - pad - pt.x) / fx;
            const tLeft = (pad - pt.x) / fx;
            if (tRight > 0) ts.push(tRight);
            if (tLeft > 0) ts.push(tLeft);
          }
          if (Math.abs(fy) > 1e-6) {
            const tBottom = (h - pad - pt.y) / fy;
            const tTop = (pad - pt.y) / fy;
            if (tBottom > 0) ts.push(tBottom);
            if (tTop > 0) ts.push(tTop);
          }
          const tEdge = ts.length > 0 ? Math.min(...ts) : 0;
          const outDist = (tEdge || 0) + G;
          const centerX = HS / 2 + fx * outDist;
          const centerY = HS / 2 + fy * outDist;
          return { l: centerX - A / 2, t: centerY - A / 2 };
        };

        return (
          <>
            {(() => {
              const topOff = computeIconOffset(tPt, { x: 0, y: -1 });
              const rightOff = computeIconOffset(rPt, { x: 1, y: 0 });
              const bottomOff = computeIconOffset(bPt, { x: 0, y: 1 });
              const leftOff = computeIconOffset(lPt, { x: -1, y: 0 });
              return (
                <>
                  <Handle
                    id="top"
                    type="source"
                    position={Position.Top}
                    isConnectable
                    className="freeform-handle"
                    onPointerEnter={nodePointerEnter}
                    style={{
                      ...handleBase,
                      left: tPt.x - HS / 2,
                      top: tPt.y - HS / 2,
                    }}
                  >
                    <div
                      className="arrow-icon"
                      style={
                        {
                          ["--arrow-default-color"]: fill,
                          ...mkIcon(-90, topOff.l, topOff.t),
                        } as React.CSSProperties
                      }
                    >
                      <FaLongArrowAltRight />
                    </div>
                  </Handle>
                  <Handle
                    id="right"
                    type="source"
                    position={Position.Right}
                    isConnectable
                    className="freeform-handle"
                    onPointerEnter={nodePointerEnter}
                    style={{
                      ...handleBase,
                      left: rPt.x - HS / 2,
                      top: rPt.y - HS / 2,
                    }}
                  >
                    <div
                      className="arrow-icon"
                      style={
                        {
                          ["--arrow-default-color"]: fill,
                          ...mkIcon(0, rightOff.l, rightOff.t),
                        } as React.CSSProperties
                      }
                    >
                      <FaLongArrowAltRight />
                    </div>
                  </Handle>
                  <Handle
                    id="bottom"
                    type="source"
                    position={Position.Bottom}
                    isConnectable
                    className="freeform-handle"
                    onPointerEnter={nodePointerEnter}
                    style={{
                      ...handleBase,
                      left: bPt.x - HS / 2,
                      top: bPt.y - HS / 2,
                    }}
                  >
                    <div
                      className="arrow-icon"
                      style={
                        {
                          ["--arrow-default-color"]: fill,
                          ...mkIcon(90, bottomOff.l, bottomOff.t),
                        } as React.CSSProperties
                      }
                    >
                      <FaLongArrowAltRight />
                    </div>
                  </Handle>
                  <Handle
                    id="left"
                    type="source"
                    position={Position.Left}
                    isConnectable
                    className="freeform-handle"
                    onPointerEnter={nodePointerEnter}
                    style={{
                      ...handleBase,
                      left: lPt.x - HS / 2,
                      top: lPt.y - HS / 2,
                    }}
                  >
                    <div
                      className="arrow-icon"
                      style={
                        {
                          ["--arrow-default-color"]: fill,
                          ...mkIcon(180, leftOff.l, leftOff.t),
                        } as React.CSSProperties
                      }
                    >
                      <FaLongArrowAltRight />
                    </div>
                  </Handle>
                </>
              );
            })()}
          </>
        );
      })()}

      {/* SVG rendering for all non-rect shapes */}
      {isSvgShape &&
        (() => {
          const w = measured.w;
          const h = measured.h;
          const cx = w / 2;
          const cy = h / 2;
          const sw = strokeWidth;
          const pad = sw;

          // Helpers
          const ellipseRx = Math.max(1, (w - sw * 2) / 2);
          const ellipseRy = Math.max(1, (h - sw * 2) / 2);

          // Diamond: points at top/right/bottom/left midpoints
          const diamondPts = `${cx},${pad} ${w - pad},${cy} ${cx},${h - pad} ${pad},${cy}`;

          // Triangle: equilateral-ish, pointing up
          const trianglePts = `${cx},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`;

          // Hexagon (flat-top): 6 points
          const hexPts = (() => {
            const rx = (w - pad * 2) / 2;
            const ry = (h - pad * 2) / 2;
            const pts: string[] = [];
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i - Math.PI / 6;
              pts.push(
                `${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`,
              );
            }
            return pts.join(" ");
          })();

          // Parallelogram: offset left top/bottom by ~20% of width
          const skew = w * 0.2;
          const paraPts = `${pad + skew},${pad} ${w - pad},${pad} ${w - pad - skew},${h - pad} ${pad},${h - pad}`;

          // Selection / resize dashed overlay — shown when selected or actively resizing
          const showSel = selected || isResizing;
          const dashStyle: React.CSSProperties = {
            opacity: showSel ? 0.9 : 0,
            transition: "opacity 0.1s",
          };
          const dashProps = {
            fill: "none",
            stroke: "#6366f1",
            strokeWidth: 1.5,
            strokeDasharray: "6 4",
          };

          return (
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
                overflow: "visible",
              }}
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {(shapeType === "ellipse" || shapeType === "circle") && (
                <>
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={ellipseRx}
                    ry={ellipseRy}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={ellipseRx}
                    ry={ellipseRy}
                    style={dashStyle}
                    {...dashProps}
                  />
                </>
              )}
              {shapeType === "line" && (
                <>
                  <line
                    x1={8}
                    y1={cy}
                    x2={w - 8}
                    y2={cy}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeLinecap="round"
                  />
                  <line
                    x1={8}
                    y1={cy}
                    x2={w - 8}
                    y2={cy}
                    style={dashStyle}
                    {...dashProps}
                    strokeLinecap="round"
                  />
                </>
              )}
              {shapeType === "diamond" && (
                <>
                  <polygon
                    points={diamondPts}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  <polygon
                    points={diamondPts}
                    style={dashStyle}
                    {...dashProps}
                  />
                </>
              )}
              {shapeType === "triangle" && (
                <>
                  <polygon
                    points={trianglePts}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  <polygon
                    points={trianglePts}
                    style={dashStyle}
                    {...dashProps}
                  />
                </>
              )}
              {shapeType === "hexagon" && (
                <>
                  <polygon
                    points={hexPts}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  <polygon points={hexPts} style={dashStyle} {...dashProps} />
                </>
              )}
              {shapeType === "parallelogram" && (
                <>
                  <polygon
                    points={paraPts}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  <polygon points={paraPts} style={dashStyle} {...dashProps} />
                </>
              )}
              {shapeType === "text" &&
                (() => {
                  const rawHtml =
                    (shape.text as string) ?? (data?.label as string) ?? "Text";
                  const sanitized = DOMPurify.sanitize(rawHtml);
                  const textFontSize =
                    (shape.fontSize as number) ??
                    (data?.fontSize as number) ??
                    Math.max(12, Math.round(initialH * 0.35));
                  const align = ((shape.textAlign as unknown) ||
                    (data?.textAlign as unknown) ||
                    "center") as "left" | "center" | "right";
                  let justify: "flex-start" | "center" | "flex-end" = "center";
                  if (align === "left") justify = "flex-start";
                  else if (align === "right") justify = "flex-end";
                  return (
                    <foreignObject
                      x={pad}
                      y={pad}
                      width={Math.max(0, w - pad * 2)}
                      height={Math.max(0, h - pad * 2)}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: justify,
                          textAlign: align,
                          pointerEvents: "none",
                          userSelect: "none",
                          color: stroke,
                          fontFamily: "inherit",
                          fontSize: `${textFontSize}px`,
                          overflow: "hidden",
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitized }}
                      />
                    </foreignObject>
                  );
                })()}
              {shapeType === "textbox" && (
                <>
                  {/* Outer border */}
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                  />
                  {/* Header divider line ~30% from top */}
                  <line
                    x1={pad}
                    y1={h * 0.32}
                    x2={w - pad}
                    y2={h * 0.32}
                    stroke={stroke}
                    strokeWidth={sw * 0.7}
                  />
                  {/* Header text */}
                  {/* Header text (font size and alignment controlled by properties) */}
                  {(() => {
                    const headerFontSize =
                      (shape.fontSize as number) ??
                      (data?.fontSize as number) ??
                      Math.max(10, Math.round(initialH * 0.12));
                    const align =
                      (shape.textAlign as string) ??
                      (data?.textAlign as string) ??
                      "center";
                    let anchor: "start" | "middle" | "end" = "middle";
                    if (align === "left") anchor = "start";
                    else if (align === "right") anchor = "end";
                    let xPos = cx;
                    if (align === "left") xPos = pad + 12;
                    else if (align === "right") xPos = w - pad - 12;
                    return (
                      <text
                        x={xPos}
                        y={h * 0.18}
                        textAnchor={anchor}
                        dominantBaseline="central"
                        fill={stroke}
                        fontSize={headerFontSize}
                        fontWeight="bold"
                        fontFamily="inherit"
                        style={{ userSelect: "none", pointerEvents: "none" }}
                      >
                        {(data?.label as string) || "Header"}
                      </text>
                    );
                  })()}
                  {/* Body: render description HTML if provided, otherwise show placeholder lines */}
                  {(() => {
                    const bodyHtml = (data?.description as string) || "";
                    if (bodyHtml?.trim()) {
                      const sanitizedBody = DOMPurify.sanitize(bodyHtml);
                      const bodyTop = h * 0.36;
                      const bodyHeight = Math.max(0, h - bodyTop - pad);
                      return (
                        <foreignObject
                          x={pad + 8}
                          y={bodyTop}
                          width={Math.max(0, w - pad * 2 - 16)}
                          height={bodyHeight}
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              pointerEvents: "none",
                              userSelect: "none",
                              color: stroke,
                              fontFamily: "inherit",
                              fontSize: `${Math.max(10, Math.round(initialH * 0.12))}px`,
                              overflow: "hidden",
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
                          />
                        </foreignObject>
                      );
                    }
                    return ([0.48, 0.62, 0.76] as const).map(
                      (yFrac, lineIdx) => (
                        <line
                          key={`body-line-${yFrac}`}
                          x1={pad + 8}
                          y1={h * yFrac}
                          x2={w - pad - (lineIdx === 2 ? w * 0.25 : 8)}
                          y2={h * yFrac}
                          stroke={stroke}
                          strokeWidth={1}
                          strokeOpacity={0.4}
                        />
                      ),
                    );
                  })()}
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={4}
                    style={dashStyle}
                    {...dashProps}
                  />
                </>
              )}
            </svg>
          );
        })()}

      {contextMenu.visible &&
        ReactDOM.createPortal(
          <motion.div
            data-context-menu
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed z-[10000] bg-[var(--surface)] border border-theme rounded-lg shadow-lg py-1 min-w-[140px] pointer-events-auto"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: "translate(-50%, -10px)",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(e as unknown as React.MouseEvent);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
            >
              <MdSettings className="w-4 h-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                globalThis.dispatchEvent(
                  new CustomEvent("diagram:node-to-front", { detail: { id } }),
                );
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
            >
              <MdOutlineVerticalAlignTop className="w-4 h-4" />
              Bring to Front
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                globalThis.dispatchEvent(
                  new CustomEvent("diagram:node-to-back", { detail: { id } }),
                );
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
            >
              <MdOutlineVerticalAlignBottom className="w-4 h-4" />
              Send to Back
            </button>
            {isInGroup && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDetach(e as unknown as React.MouseEvent);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm text-orange-500"
              >
                <FiUnlock className="w-4 h-4" />
                Detach from Group
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(e as unknown as React.MouseEvent);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
            >
              <IoDuplicateOutline className="w-4 h-4" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e as unknown as React.MouseEvent);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm text-red-600"
            >
              <MdDelete className="w-4 h-4" />
              Delete
            </button>
          </motion.div>,
          document.body,
        )}
    </fieldset>
  );
};

export default FreeformNode;
