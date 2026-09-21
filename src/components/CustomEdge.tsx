import React, { useState, useRef, useEffect, useMemo } from "react";
import type {
  Edge,
  EdgeProps,
  Node,
  ReactFlowState,
} from "@xyflow/react";
import {
  EdgeLabelRenderer,
  getBezierPath,
  getEdgeCenter,
  getStraightPath,
  getSmoothStepPath,
  useStore,
  Position,
} from "@xyflow/react";
import {
  getEdgeLabelLayout,
  type EdgeLabelRect,
  type EdgeLabelNode,
} from "../utils/edgeLabelLayout";

export type EdgePathType = "bezier" | "straight" | "step" | "smoothstep";
export type EdgeLabelPosition = "source" | "center" | "target";

type CustomEdgeData = {
  label?: string;
  hasLabel?: boolean;
  description?: string;
  pathType?: EdgePathType;
  labelPosition?: EdgeLabelPosition;
  labelOffset?: number;
  labelMaxWidth?: number;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
  bidirectional?: boolean;
  readOnly?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
};

const FALLBACK_NODE_WIDTH = 320;
const FALLBACK_NODE_HEIGHT = 200;

type PositionedNode = Node & {
  internals?: { positionAbsolute?: { x: number; y: number } };
};

const nodePosition = (node: Node) =>
  (node as PositionedNode).internals?.positionAbsolute ?? node.position;

const handlePosition = (handleId: string | null | undefined): Position | null => {
  const normalized = handleId?.split(":").at(-1);
  if (!normalized) return null;
  if (normalized.startsWith("top")) return Position.Top;
  if (normalized.startsWith("right")) return Position.Right;
  if (normalized.startsWith("bottom")) return Position.Bottom;
  if (normalized.startsWith("left")) return Position.Left;
  return null;
};

const handleFraction = (handleId: string | null | undefined) => {
  const normalized = handleId?.split(":").at(-1) ?? "";
  if (normalized.endsWith("-top")) return 0.25;
  if (normalized.endsWith("-bottom")) return 0.75;
  if (normalized.endsWith("-left")) return 0.25;
  if (normalized.endsWith("-right")) return 0.75;
  return 0.5;
};

const getNodeAnchor = (
  node: Node,
  handleId: string | null | undefined,
  fallbackPosition: Position,
) => {
  const position = nodePosition(node);
  const width = node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT;
  const side = handlePosition(handleId) ?? fallbackPosition;
  const fraction = handleFraction(handleId);

  if (side === Position.Top || side === Position.Bottom) {
    return {
      x: position.x + width * fraction,
      y: position.y + (side === Position.Top ? 0 : height),
      position: side,
    };
  }

  return {
    x: position.x + (side === Position.Left ? 0 : width),
    y: position.y + height * fraction,
    position: side,
  };
};

const fallbackHandlePositions = (source: Node, target: Node) => {
  const sourcePosition = nodePosition(source);
  const targetPosition = nodePosition(target);
  const sourceSide =
    targetPosition.x >= sourcePosition.x ? Position.Right : Position.Left;
  const targetSide =
    sourceSide === Position.Right ? Position.Left : Position.Right;
  return {
    sourcePosition: sourceSide,
    targetPosition: targetSide,
  };
};

type ResolvedColors = {
  surface: string;
  text: string;
  border: string;
  brand: string;
  bgHover: string;
};

/** Resolve a CSS custom property to its actual computed value so html-to-image can capture it. */
function resolveCssVar(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw || fallback;
}

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

// Compute edge path and center point; extracted to reduce complexity in the main component
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

  // When two edges connect the same nodes in opposite directions, offset the curve
  if (isBiDirectionEdge) {
    const offset = sourceX < targetX ? 25 : -25;
    const edgePath = getSpecialPath(
      { sourceX, sourceY, targetX, targetY },
      offset,
    );
    const centerX = (sourceX + targetX) / 2;
    const centerY = (sourceY + targetY) / 2 + offset / 2;
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

  // Default: bezier
  const [edgePath] = getBezierPath(params);
  const [centerX, centerY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  return { edgePath, centerX, centerY };
};

const getEdgeLabelData = (edge: Edge) => {
  const data = (edge.data ?? {}) as CustomEdgeData;
  const label = typeof data.label === "string" ? data.label : "";
  const hasLabel = data.hasLabel ?? Boolean(label);
  return { data, label, hasLabel };
};

const estimateEdgeLabelRect = ({
  edge,
  nodes,
  edges,
  occupiedLabels,
}: {
  edge: Edge;
  nodes: Node[];
  edges: Edge[];
  occupiedLabels: EdgeLabelRect[];
}): EdgeLabelRect | null => {
  const { data, label, hasLabel } = getEdgeLabelData(edge);
  if (!hasLabel || !label) return null;

  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  if (!sourceNode || !targetNode) return null;

  const fallback = fallbackHandlePositions(sourceNode, targetNode);
  const sourceAnchor = getNodeAnchor(
    sourceNode,
    edge.sourceHandle,
    fallback.sourcePosition,
  );
  const targetAnchor = getNodeAnchor(
    targetNode,
    edge.targetHandle,
    fallback.targetPosition,
  );
  const pathType: EdgePathType = data.pathType || "smoothstep";
  const isBidirectional = edges.some(
    (candidate) =>
      candidate.id !== edge.id &&
      candidate.source === edge.target &&
      candidate.target === edge.source,
  );
  const { edgePath, centerX, centerY } = computeEdgeParams(
    {
      sourceX: sourceAnchor.x,
      sourceY: sourceAnchor.y,
      targetX: targetAnchor.x,
      targetY: targetAnchor.y,
      sourcePosition: sourceAnchor.position,
      targetPosition: targetAnchor.position,
    },
    isBidirectional,
    pathType,
  );
  const labelOffset = Math.min(Math.max(data.labelOffset ?? 0.18, 0), 0.95);
  const labelDirection = { source: -1, target: 1, center: 0 };
  const labelShift =
    (labelDirection[data.labelPosition ?? "center"] ?? 0) * labelOffset;
  const textWidth = Math.max(6, label.length * 6);
  return getEdgeLabelLayout({
    label,
    edgePath,
    centerX,
    centerY,
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    targetX: targetAnchor.x,
    targetY: targetAnchor.y,
    labelShift,
    textWidth,
    nodes: nodes as EdgeLabelNode[],
    occupiedLabels,
    labelMaxWidth: data.labelMaxWidth,
  });
};

const EdgeLabelContent: React.FC<{
  hasLabel: boolean;
  editing: boolean;
  readOnly: boolean;
  selected: boolean;
  value: string;
  description?: string;
  colors: ResolvedColors;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onEdit: (event: React.MouseEvent) => void;
  onAdd: (event: React.MouseEvent) => void;
  onRemove: (event: React.MouseEvent) => void;
  labelWidth: number;
}> = ({
  hasLabel,
  editing,
  readOnly,
  selected,
  value,
  description,
  colors,
  inputRef,
  onChange,
  onCommit,
  onCancel,
  onEdit,
  onAdd,
  onRemove,
  labelWidth,
}) => {
  if (!hasLabel) {
    if (!selected || readOnly) return null;
    return (
      <button
        onClick={onAdd}
        style={{
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "4px",
          backgroundColor: colors.surface,
          color: colors.brand,
          border: `1px dashed ${colors.brand}`,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        data-tooltip="Add label"
        type="button"
      >
        + Label
      </button>
    );
  }

  if (editing && !readOnly) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
          if (event.key === "Escape") onCancel();
        }}
        style={{
          fontSize: "11px",
          border: `1px solid ${colors.border}`,
          borderRadius: "4px",
          padding: "2px 8px",
          backgroundColor: colors.surface,
          color: colors.text,
          width: `${Math.max(100, labelWidth)}px`,
          maxWidth: `${labelWidth}px`,
          textAlign: "center",
          outline: "none",
          boxShadow: `0 0 0 2px ${colors.brand}55`,
        }}
        placeholder="Label..."
      />
    );
  }

  const borderColor = selected ? colors.brand : colors.border;
  const boxShadow = selected ? `0 0 0 1px ${colors.brand}` : "none";
  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    backgroundColor: colors.surface,
    color: colors.text,
    border: `1px solid ${borderColor}`,
    boxShadow,
    textAlign: "center",
    minWidth: "100px",
    width: `${labelWidth}px`,
    maxWidth: `${labelWidth}px`,
    boxSizing: "border-box",
    lineHeight: "14px",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "normal",
    display: "block",
  };

  if (readOnly) {
    return (
      <span
        style={labelStyle}
        data-tooltip={description || value}
        aria-label={value || "Connection"}
      >
        {value || "Connection"}
      </span>
    );
  }

  return (
    <>
      <button
        onDoubleClick={onEdit}
        style={{ ...labelStyle, cursor: "text" }}
        data-tooltip="Double-click to edit"
        type="button"
      >
        {value || "Label"}
      </button>
      {selected && (
        <button
          onClick={onRemove}
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
  );
};

const CustomEdge: React.FC<EdgeProps> = (props) => {
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
    data,
    selected,
    markerEnd,
  } = props;

  const edgeData = data as CustomEdgeData | undefined;
  const isHighlighted = edgeData?.highlighted ?? false;
  const isDimmed = edgeData?.dimmed ?? false;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(edgeData?.label ?? "");
  const [hasLabel, setHasLabel] = useState<boolean>(
    edgeData?.hasLabel ?? false,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync label/hasLabel when edge data changes (e.g. after undo/redo or collab)
  useEffect(() => {
    setValue(edgeData?.label ?? "");
    setHasLabel(edgeData?.hasLabel ?? false);
  }, [edgeData?.label, edgeData?.hasLabel]);

  // Resolve CSS variables to real color values so html-to-image can capture them.
  const [resolvedColors, setResolvedColors] = useState({
    surface: "#ffffff",
    text: "#111827",
    border: "#e5e7eb",
    brand: "#6366f1",
    bgHover: "#f3f4f6",
  });
  useEffect(() => {
    const update = () =>
      setResolvedColors({
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
  const isBiDirectionEdge = useStore((s: ReactFlowState) =>
    s.edges.some(
      (e) => e.id !== id && e.source === target && e.target === source,
    ),
  );
  const flowNodes = useStore((s: ReactFlowState) => s.nodes);
  const flowEdges = useStore((s: ReactFlowState) => s.edges);

  // Calculate path and center using extracted helper
  const pathType: EdgePathType = edgeData?.pathType || "smoothstep";
  const edgeColor =
    edgeData?.color ||
    (selected || isHighlighted
      ? resolvedColors.brand
      : resolvedColors.text + "99");
  const strokeW = edgeData?.strokeWidth ?? (selected || isHighlighted ? 3 : 2);
  const isBidirectional = edgeData?.bidirectional ?? false;
  const readOnly = edgeData?.readOnly ?? false;

  const edgePathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const { edgePath, centerX, centerY } = computeEdgeParams(
    edgePathParams,
    isBiDirectionEdge,
    pathType,
  );
  const labelOffset = Math.min(
    Math.max(edgeData?.labelOffset ?? 0.18, 0),
    0.95,
  );
  const labelDirection = { source: -1, target: 1, center: 0 };
  const labelShift = (labelDirection[edgeData?.labelPosition ?? "center"] ?? 0) * labelOffset;
  const labelText = value || "Connection";
  const textWidth = useMemo(() => {
    const fallbackWidth = Math.max(6, labelText.length * 6);
    if (typeof document === "undefined") return fallbackWidth;

    const context = document.createElement("canvas").getContext("2d");
    if (!context) return fallbackWidth;

    const fontFamily =
      getComputedStyle(document.body).fontFamily || "Inter, sans-serif";
    context.font = `11px ${fontFamily}`;
    return context.measureText(labelText).width;
  }, [labelText]);
  const labelVisible = hasLabel || (!readOnly && Boolean(selected));
  const occupiedLabels = useMemo(() => {
    if (!labelVisible) return [];

    const orderedEdges = [...flowEdges].sort((first, second) =>
      first.id.localeCompare(second.id),
    );
    const currentIndex = orderedEdges.findIndex((edge) => edge.id === id);
    const labels: EdgeLabelRect[] = [];
    for (const edge of orderedEdges.slice(0, Math.max(currentIndex, 0))) {
      const rect = estimateEdgeLabelRect({
        edge,
        nodes: flowNodes,
        edges: flowEdges,
        occupiedLabels: labels,
      });
      if (rect) labels.push(rect);
    }
    return labels;
  }, [flowEdges, flowNodes, id, labelVisible]);
  const labelLayout = getEdgeLabelLayout({
    label: labelText,
    edgePath,
    centerX,
    centerY,
    sourceX,
    sourceY,
    targetX,
    targetY,
    labelShift,
    textWidth,
    nodes: flowNodes as EdgeLabelNode[],
    occupiedLabels,
    labelMaxWidth: edgeData?.labelMaxWidth,
  });

  const onLabelDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onAddLabel = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setHasLabel(true);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onRemoveLabel = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setHasLabel(false);
    setValue("");
    // broadcast update
    globalThis.dispatchEvent(
      new CustomEvent("diagram:edge-label-change", {
        detail: { id, label: "", hasLabel: false },
      }),
    );
  };

  const commit = () => {
    setEditing(false);
    // broadcast update — playground listens and updates edge state
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

  const labelContent = labelVisible ? (
    <div
      style={{
        width: `${labelLayout.width}px`,
        minHeight: `${labelLayout.height}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: readOnly ? "none" : "auto",
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
        }}
      >
        <EdgeLabelContent
          hasLabel={hasLabel}
          editing={editing}
          readOnly={readOnly}
          selected={Boolean(selected || isHighlighted)}
          value={value}
          description={edgeData?.description}
          colors={resolvedColors}
          inputRef={inputRef}
          onChange={setValue}
          onCommit={commit}
          onCancel={() => {
            setEditing(false);
            setValue(edgeData?.label ?? "");
          }}
          onEdit={onLabelDoubleClick}
          onAdd={onAddLabel}
          onRemove={onRemoveLabel}
          labelWidth={labelLayout.width}
        />
      </div>
    </div>
  ) : null;
  const foreignObjectWidth =
    labelLayout.width + (!readOnly && selected && hasLabel ? 28 : 0);

  return (
    <>
      <g
        className="react-flow__edge"
        style={{
          opacity: isDimmed ? 0.22 : 1,
          transition: "opacity 150ms ease",
        }}
      >
        <defs>
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
          </marker>
          {isBidirectional && (
            <marker
              id={`arrow-start-${id}`}
              viewBox="0 0 10 10"
              refX="2"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
            </marker>
          )}
        </defs>

        {/* Wider transparent hit-area for easier clicking */}
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />

        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeW}
          strokeDasharray={edgeData?.animated ? "6 3" : undefined}
          markerEnd={markerEnd || `url(#arrow-${id})`}
          markerStart={isBidirectional ? `url(#arrow-start-${id})` : undefined}
          className="transition-colors"
        />

        {!readOnly && labelContent && (
          <foreignObject
            x={labelLayout.center.x - foreignObjectWidth / 2}
            y={labelLayout.center.y - labelLayout.height / 2}
            width={foreignObjectWidth}
            height={labelLayout.height}
            style={{ overflow: "visible" }}
          >
            {labelContent}
          </foreignObject>
        )}
      </g>
      {readOnly && labelContent && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              left: labelLayout.center.x,
              top: labelLayout.center.y,
              width: `${labelLayout.width}px`,
              minHeight: `${labelLayout.height}px`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            {labelContent}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
