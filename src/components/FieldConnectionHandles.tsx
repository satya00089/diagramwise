import React from "react";
import { Handle, Position } from "@xyflow/react";

export type FieldConnectionHandleProps = {
  fieldId: string;
  label: string;
  top: string | number;
  visible?: boolean;
  showIcon?: boolean;
  isConnectable?: boolean;
};

const getFieldConnectionHandleId = (fieldId: string, side: "left" | "right") =>
  `field:${fieldId}:${side}`;

const getHandleStyle = (
  side: "left" | "right",
  top: string | number,
  visible: boolean,
  isConnectable: boolean,
): React.CSSProperties => ({
  top: typeof top === "number" ? `${top}px` : top,
  [side]: "-1px",
  width: "10px",
  height: "18px",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  zIndex: 10,
  pointerEvents: isConnectable ? "all" : "none",
  visibility: visible ? "visible" : "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const ConnectionCross = ({
  side,
  showIcon,
}: {
  side: "left" | "right";
  showIcon: boolean;
}) => (
  <svg
    aria-hidden="true"
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    className="pointer-events-none transition-opacity duration-100"
    style={{
      opacity: showIcon ? 1 : 0,
      transform: `translateX(${side === "left" ? -0.6 : 0.6}px)`,
    }}
  >
    <path
      d="M5 1v8M1 5h8"
      transform="rotate(45 5 5)"
      stroke="var(--brand)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const FieldConnectionHandles: React.FC<FieldConnectionHandleProps> = ({
  fieldId,
  label,
  top,
  visible = true,
  showIcon = true,
  isConnectable = true,
}) => (
  <>
    <Handle
      id={getFieldConnectionHandleId(fieldId, "left")}
      type="source"
      position={Position.Left}
      isConnectable={isConnectable}
      aria-label={isConnectable ? `Connect ${label} on the left` : undefined}
      aria-hidden={!isConnectable}
      className={
        isConnectable
          ? "!pointer-events-auto opacity-100"
          : "!pointer-events-none"
      }
      style={getHandleStyle("left", top, visible, isConnectable)}
    >
      <ConnectionCross side="left" showIcon={showIcon} />
    </Handle>
    <Handle
      id={getFieldConnectionHandleId(fieldId, "right")}
      type="source"
      position={Position.Right}
      isConnectable={isConnectable}
      aria-label={isConnectable ? `Connect ${label} on the right` : undefined}
      aria-hidden={!isConnectable}
      className={
        isConnectable
          ? "!pointer-events-auto opacity-100"
          : "!pointer-events-none"
      }
      style={getHandleStyle("right", top, visible, isConnectable)}
    >
      <ConnectionCross side="right" showIcon={showIcon} />
    </Handle>
  </>
);

FieldConnectionHandles.displayName = "FieldConnectionHandles";
