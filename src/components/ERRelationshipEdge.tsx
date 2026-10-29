import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { EdgeProps, ReactFlowState, Position } from "@xyflow/react";
import {
  getBezierPath,
  getEdgeCenter,
  getSmoothStepPath,
  getStraightPath,
  useStore,
} from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import type { EdgePathType } from "./CustomEdge";
import {
  getAdaptiveEdgeGeometry,
  type AdaptiveHorizontalSide,
} from "../utils/adaptiveEdgeRouting";

/** Resolve a CSS custom property to its actual computed color for html-to-image compatibility. */
function resolveCssVar(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw || fallback;
}

// Cardinality types for ER relationships
export type ERCardinality =
  // Basic cardinalities
  | "one-to-one" // 1:1
  | "one-to-many" // 1:N
  | "many-to-one" // N:1
  | "many-to-many" // N:M

  // Mandatory participation (must participate)
  | "mandatory-one-to-one" // 1:1 (both sides mandatory)
  | "mandatory-one-to-many" // 1:N (both sides mandatory)
  | "mandatory-many-to-many" // M:N (both sides mandatory)

  // Optional participation (may or may not participate)
  | "optional-zero-to-one" // 0:1 (optional on both sides)
  | "optional-zero-to-many" // 0:N (optional zero or many)
  | "optional-many-to-many" // 0:M to 0:N (optional on both)

  // Mixed participation
  | "one-mandatory-many-optional" // 1 to 0..N (one side mandatory, other optional)
  | "zero-to-one" // 0..1 (zero or one)
  | "zero-to-many" // 0..N (zero or many)
  | "one-or-many" // 1..N (one or many - at least one)

  // Recursive relationships (self-referencing)
  | "recursive-one-to-one" // Self 1:1
  | "recursive-one-to-many" // Self 1:N
  | "recursive-many-to-many"; // Self M:N

// Helper function for creating curved paths for bi-directional edges
const getSpecialPath = (
  {
    sourceX,
    sourceY,
    targetX,
    targetY,
  }: { sourceX: number; sourceY: number; targetX: number; targetY: number },
  offset: number,
) => {
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;
  return `M ${sourceX} ${sourceY} Q ${centerX} ${centerY + offset} ${targetX} ${targetY}`;
};

// Compute edge path and center point
const computeEdgeParams = (
  params: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
  },
  isBiDirectionEdge: boolean,
  pathType: EdgePathType = "smoothstep",
) => {
  const { sourceX, sourceY, targetX, targetY } = params;

  if (isBiDirectionEdge) {
    const offset = sourceX < targetX ? 25 : -25;
    const edgePath = getSpecialPath(
      { sourceX, sourceY, targetX, targetY },
      offset,
    );
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const centerX = midX;
    const centerY = midY + offset / 2;
    return { edgePath, centerX, centerY };
  }

  if (pathType === "straight") {
    const [edgePath, centerX, centerY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    return { edgePath, centerX, centerY };
  }

  if (pathType === "step") {
    const [edgePath, centerX, centerY] = getSmoothStepPath({
      ...params,
      borderRadius: 0,
    });
    return { edgePath, centerX, centerY };
  }

  if (pathType === "smoothstep") {
    const [edgePath, centerX, centerY] = getSmoothStepPath(params);
    return { edgePath, centerX, centerY };
  }

  const [edgePath] = getBezierPath(params);
  const [centerX, centerY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  return { edgePath, centerX, centerY };
};

// Get marker definitions for different cardinalities
const getSourceMarker = (cardinality: ERCardinality) => {
  switch (cardinality) {
    // Basic one at source
    case "one-to-one":
    case "one-to-many":
    case "zero-to-one":
    case "one-mandatory-many-optional":
    case "one-or-many":
      return "one";

    // Many/crow's foot at source
    case "many-to-one":
    case "many-to-many":
    case "mandatory-many-to-many":
    case "optional-many-to-many":
      return "many";

    // Mandatory (double line) at source
    case "mandatory-one-to-one":
    case "mandatory-one-to-many":
      return "mandatory-one";

    // Optional (circle + line) at source
    case "optional-zero-to-one":
    case "optional-zero-to-many":
    case "zero-to-many":
      return "optional-zero";

    // Recursive relationships
    case "recursive-one-to-one":
      return "one";
    case "recursive-one-to-many":
      return "one";
    case "recursive-many-to-many":
      return "many";

    default:
      return "one";
  }
};

const getTargetMarker = (cardinality: ERCardinality) => {
  switch (cardinality) {
    // Basic one at target
    case "one-to-one":
    case "many-to-one":
    case "zero-to-one":
      return "one";

    // Many/crow's foot at target
    case "one-to-many":
    case "many-to-many":
    case "zero-to-many":
    case "one-mandatory-many-optional":
    case "one-or-many":
      return "many";

    // Mandatory (double line) at target
    case "mandatory-one-to-one":
      return "mandatory-one";
    case "mandatory-one-to-many":
    case "mandatory-many-to-many":
      return "mandatory-many";

    // Optional (circle + crow's foot) at target
    case "optional-zero-to-one":
      return "optional-one";
    case "optional-zero-to-many":
    case "optional-many-to-many":
      return "optional-many";

    // Recursive relationships
    case "recursive-one-to-one":
      return "one";
    case "recursive-one-to-many":
      return "many";
    case "recursive-many-to-many":
      return "many";

    default:
      return "many";
  }
};

interface EREdgeData {
  label?: string;
  hasLabel?: boolean;
  cardinality?: ERCardinality;
  pathType?: EdgePathType;
}

const getInitialEdgeState = (data: unknown, label: React.ReactNode) => {
  const edgeData = (data as EREdgeData) || {};
  return {
    pathType: edgeData.pathType ?? "smoothstep",
    initialLabel: edgeData.label ?? (typeof label === "string" ? label : ""),
    initialHasLabel: edgeData.hasLabel ?? false,
    initialCardinality: edgeData.cardinality ?? "one-to-many",
  };
};

const getRouteAnimation = (animate: boolean) => {
  if (!animate) return { initial: false as const, transition: { duration: 0 } };
  return {
    initial: { opacity: 0.45, pathLength: 0.82 },
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
  };
};

const ERRelationshipEdge: React.FC<EdgeProps> = (props) => {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    sourceHandleId,
    targetHandleId,
    data,
    label,
    selected,
  } = props;

  const { pathType, initialLabel, initialHasLabel, initialCardinality } =
    getInitialEdgeState(data, label);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(initialLabel);
  const [hasLabel, setHasLabel] = useState<boolean>(initialHasLabel);
  const [cardinality, setCardinality] =
    useState<ERCardinality>(initialCardinality);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [routeAnimationId, setRouteAnimationId] = useState(0);

  // Resolve CSS variables to real colors so html-to-image captures them correctly.
  const [rc, setRc] = useState({
    surface: "#ffffff",
    text: "#111827",
    border: "#e5e7eb",
    brand: "#6366f1",
    bgHover: "#f3f4f6",
  });
  useEffect(() => {
    const update = () =>
      setRc({
        surface: resolveCssVar("--surface", "#ffffff"),
        text: resolveCssVar("--text", "#111827"),
        border: resolveCssVar("--border", "#e5e7eb"),
        brand: resolveCssVar("--brand", "#6366f1"),
        bgHover: resolveCssVar("--bg-hover", "#f3f4f6"),
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Detect if there's a bi-directional connection
  const isBiDirectionEdge = useStore((s: ReactFlowState) => {
    const edgeExists = s.edges.some(
      (e) => e.id !== id && e.source === target && e.target === source,
    );
    return edgeExists;
  });

  const sourceNode = useStore((s: ReactFlowState) => s.nodeLookup.get(source));
  const targetNode = useStore((s: ReactFlowState) => s.nodeLookup.get(target));
  const previousSourceSideRef = useRef<AdaptiveHorizontalSide | undefined>(
    undefined,
  );
  const handleSignature = [
    source,
    target,
    sourceHandleId ?? "",
    targetHandleId ?? "",
    sourcePosition,
    targetPosition,
  ].join("|");
  const lastHandleSignatureRef = useRef(handleSignature);
  if (lastHandleSignatureRef.current !== handleSignature) {
    lastHandleSignatureRef.current = handleSignature;
    previousSourceSideRef.current = undefined;
  }

  const adaptiveGeometry = getAdaptiveEdgeGeometry({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    sourceHandleId,
    targetHandleId,
    sourceNode,
    targetNode,
    previousSourceSide: previousSourceSideRef.current,
  });

  useLayoutEffect(() => {
    const previousSourceSide = previousSourceSideRef.current;
    const nextSourceSide = adaptiveGeometry.sourceSide;

    if (
      previousSourceSide &&
      nextSourceSide &&
      previousSourceSide !== nextSourceSide &&
      !reduceMotion
    ) {
      setRouteAnimationId((currentId) => currentId + 1);
    }

    previousSourceSideRef.current = nextSourceSide;
  }, [adaptiveGeometry.sourceSide, handleSignature, reduceMotion]);

  // Calculate path and center
  const edgePathParams = {
    sourceX: adaptiveGeometry.sourceX,
    sourceY: adaptiveGeometry.sourceY,
    sourcePosition: adaptiveGeometry.sourcePosition,
    targetX: adaptiveGeometry.targetX,
    targetY: adaptiveGeometry.targetY,
    targetPosition: adaptiveGeometry.targetPosition,
  };
  const { edgePath, centerX, centerY } = computeEdgeParams(
    edgePathParams,
    isBiDirectionEdge,
    pathType,
  );

  const onLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onAddLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasLabel(true);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onRemoveLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasLabel(false);
    setValue("");
    globalThis.dispatchEvent(
      new CustomEvent("diagram:edge-label-change", {
        detail: { id, label: "", hasLabel: false },
      }),
    );
  };

  const commit = () => {
    setEditing(false);
    globalThis.dispatchEvent(
      new CustomEvent("diagram:edge-label-change", {
        detail: {
          id,
          label: value,
          hasLabel: hasLabel || value.trim().length > 0,
        },
      }),
    );
  };

  const handleCardinalityChange = (newCardinality: ERCardinality) => {
    setCardinality(newCardinality);
    globalThis.dispatchEvent(
      new CustomEvent("diagram:edge-cardinality-change", {
        detail: { id, cardinality: newCardinality },
      }),
    );
  };

  const sourceMarkerType = getSourceMarker(cardinality);
  const targetMarkerType = getTargetMarker(cardinality);

  return (
    <g className="react-flow__edge">
      {/* React Flow scopes theme variables on the edge SVG. Keep markers on the resolved
          canvas accent so cardinality symbols do not inherit the edge subtree's white value. */}
      <defs style={{ "--brand": rc.brand } as React.CSSProperties}>
        {/* One (single line) marker */}
        <marker
          id={`er-one-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Many (crow's foot) marker */}
        <marker
          id={`er-many-${id}`}
          viewBox="0 0 22 20"
          refX="22"
          refY="10"
          markerWidth="12"
          markerHeight="12"
          orient="auto"
        >
          {/* Crow's foot - three lines spreading out */}
          <line
            x1="0"
            y1="10"
            x2="22"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="15"
            y1="10"
            x2="22"
            y2="5"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="15"
            y1="10"
            x2="22"
            y2="15"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Mandatory One (double line) marker */}
        <marker
          id={`er-mandatory-one-${id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="3"
            y1="0"
            x2="3"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Mandatory Many (double line + crow's foot) marker */}
        <marker
          id={`er-mandatory-many-${id}`}
          viewBox="0 0 22 20"
          refX="22"
          refY="10"
          markerWidth="12"
          markerHeight="12"
          orient="auto"
        >
          {/* Double lines for mandatory */}
          <line
            x1="0"
            y1="10"
            x2="22"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="3"
            y1="8"
            x2="3"
            y2="12"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          {/* Crow's foot for many */}
          <line
            x1="12"
            y1="10"
            x2="22"
            y2="5"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="12"
            y1="10"
            x2="22"
            y2="15"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Optional Zero (circle) marker */}
        <marker
          id={`er-optional-zero-${id}`}
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <circle
            cx="6"
            cy="6"
            r="3"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Optional One (circle + line) marker */}
        <marker
          id={`er-optional-one-${id}`}
          viewBox="0 0 15 12"
          refX="14"
          refY="6"
          markerWidth="12"
          markerHeight="10"
          orient="auto"
        >
          <circle
            cx="4"
            cy="6"
            r="3"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.5"
          />
          <line
            x1="10"
            y1="0"
            x2="10"
            y2="12"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Optional Many (circle + crow's foot) marker */}
        <marker
          id={`er-optional-many-${id}`}
          viewBox="0 0 27 20"
          refX="27"
          refY="10"
          markerWidth="14"
          markerHeight="12"
          orient="auto"
        >
          <circle
            cx="4"
            cy="10"
            r="3"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.5"
          />
          <line
            x1="10"
            y1="10"
            x2="27"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="18"
            y1="10"
            x2="27"
            y2="5"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="18"
            y1="10"
            x2="27"
            y2="15"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        {/* Source markers (pointing backwards) */}
        <marker
          id={`er-one-source-${id}`}
          viewBox="0 0 10 10"
          refX="1"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <line
            x1="10"
            y1="0"
            x2="10"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        <marker
          id={`er-many-source-${id}`}
          viewBox="0 0 20 20"
          refX="2"
          refY="10"
          markerWidth="12"
          markerHeight="12"
          orient="auto"
        >
          {/* Crow's foot - three lines spreading out (reversed) */}
          <line
            x1="20"
            y1="10"
            x2="5"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="5"
            y1="10"
            x2="0"
            y2="5"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="5"
            y1="10"
            x2="0"
            y2="15"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        <marker
          id={`er-mandatory-one-source-${id}`}
          viewBox="0 0 10 10"
          refX="1"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <line
            x1="10"
            y1="0"
            x2="10"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
          <line
            x1="7"
            y1="0"
            x2="7"
            y2="10"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>

        <marker
          id={`er-optional-zero-source-${id}`}
          viewBox="0 0 12 12"
          refX="2"
          refY="6"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <circle
            cx="6"
            cy="6"
            r="3"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
          />
        </marker>
      </defs>

      <motion.path
        key={routeAnimationId}
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? rc.brand : "var(--muted)"}
        strokeWidth={selected ? 3 : 2}
        {...getRouteAnimation(routeAnimationId > 0 && !reduceMotion)}
        animate={{ opacity: 1, pathLength: 1 }}
        markerEnd={`url(#er-${targetMarkerType}-${id})`}
        markerStart={`url(#er-${sourceMarkerType}-source-${id})`}
        className="transition-colors"
      />

      {/* Label and cardinality selector */}
      <foreignObject
        x={centerX - 100}
        y={centerY - 40}
        width={200}
        height={80}
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            width: "200px",
            height: "80px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            gap: "6px",
            overflow: "visible",
          }}
        >
          {/* Label area */}
          {hasLabel ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {editing ? (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setEditing(false);
                      setValue(initialLabel);
                    }
                  }}
                  style={{
                    fontSize: "11px",
                    border: `1px solid ${rc.border}`,
                    borderRadius: "4px",
                    padding: "2px 8px",
                    backgroundColor: rc.surface,
                    color: rc.text,
                    width: "96px",
                    textAlign: "center",
                    outline: "none",
                    boxShadow: `0 0 0 2px ${rc.brand}55`,
                  }}
                  placeholder="Label..."
                />
              ) : (
                <>
                  <button
                    onDoubleClick={onLabelDoubleClick}
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      cursor: "text",
                      backgroundColor: rc.surface,
                      color: rc.text,
                      border: `1px solid ${selected ? rc.brand : rc.border}`,
                      boxShadow: selected ? `0 0 0 1px ${rc.brand}` : "none",
                      textAlign: "center",
                      minWidth: "60px",
                      whiteSpace: "nowrap",
                    }}
                    data-tooltip="Double-click to edit"
                    type="button"
                  >
                    {value || "Label"}
                  </button>
                  {selected && (
                    <button
                      onClick={onRemoveLabel}
                      style={{
                        fontSize: "11px",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label="Remove label"
                      data-tooltip="Remove label"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            selected && (
              <button
                onClick={onAddLabel}
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: rc.surface,
                  color: rc.brand,
                  border: `1px dashed ${rc.brand}`,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                data-tooltip="Add label"
                type="button"
              >
                + Label
              </button>
            )
          )}

          {/* Cardinality selector - only show when edge is selected */}
          {selected && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: rc.surface,
                border: `1px solid ${rc.brand}`,
                borderRadius: "4px",
                padding: "2px 8px",
              }}
            >
              <select
                value={cardinality}
                onChange={(e) =>
                  handleCardinalityChange(e.target.value as ERCardinality)
                }
                style={{
                  fontSize: "11px",
                  background: "transparent",
                  color: rc.text,
                  outline: "none",
                  cursor: "pointer",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <optgroup label="─── Basic Cardinality ───">
                  <option value="one-to-one">1:1 (One to One)</option>
                  <option value="one-to-many">1:N (One to Many)</option>
                  <option value="many-to-one">N:1 (Many to One)</option>
                  <option value="many-to-many">N:M (Many to Many)</option>
                </optgroup>

                <optgroup label="─── Mandatory (Must Participate) ───">
                  <option value="mandatory-one-to-one">
                    1:1 Mandatory (Both must exist)
                  </option>
                  <option value="mandatory-one-to-many">
                    1:N Mandatory (Both must exist)
                  </option>
                  <option value="mandatory-many-to-many">
                    M:N Mandatory (Both must exist)
                  </option>
                </optgroup>

                <optgroup label="─── Optional (May Participate) ───">
                  <option value="optional-zero-to-one">
                    0:1 Optional (Zero or One)
                  </option>
                  <option value="optional-zero-to-many">
                    0:N Optional (Zero or Many)
                  </option>
                  <option value="optional-many-to-many">
                    0:M to 0:N Optional (Both optional)
                  </option>
                </optgroup>

                <optgroup label="─── Mixed Participation ───">
                  <option value="one-mandatory-many-optional">
                    1 to 0..N (One mandatory, many optional)
                  </option>
                  <option value="zero-to-one">0..1 (Zero or One)</option>
                  <option value="zero-to-many">0..N (Zero or Many)</option>
                  <option value="one-or-many">
                    1..N (One or Many - at least one)
                  </option>
                </optgroup>

                <optgroup label="─── Recursive (Self-Referencing) ───">
                  <option value="recursive-one-to-one">
                    Self 1:1 (Recursive One-to-One)
                  </option>
                  <option value="recursive-one-to-many">
                    Self 1:N (Recursive One-to-Many)
                  </option>
                  <option value="recursive-many-to-many">
                    Self M:N (Recursive Many-to-Many)
                  </option>
                </optgroup>
              </select>
            </div>
          )}
        </div>
      </foreignObject>
    </g>
  );
};

export default ERRelationshipEdge;
