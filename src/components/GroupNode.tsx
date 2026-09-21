import React from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { MdSettings, MdDelete } from "react-icons/md";
import { motion } from "framer-motion";
import type { IconType } from "react-icons";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import SpriteIcon from "./SpriteIcon";
import { loadSpriteManifest } from "../store/slices/spritesSlice";
import { shouldUseDirectIcon } from "../utils/iconRendering";

function providerFromId(id: string): string | null {
  const prefix = id.split("-")[0].toLowerCase();
  return ["aws", "azure", "gcp", "kubernetes"].includes(prefix) ? prefix : null;
}

export interface GroupNodeData {
  label: string;
  icon?: IconType;
  iconUrl?: string;
  componentId?: string;
  subtitle?: string;
  backgroundColor?: string;
  borderColor?: string;
}

interface GroupNodeProps {
  id: string;
  data: GroupNodeData;
  disableProviderSprites?: boolean;
}

const GroupNode: React.FC<GroupNodeProps> = ({
  id,
  data,
  disableProviderSprites = false,
}) => {
  const dispatch = useAppDispatch();
  const bgColor = data.backgroundColor || "rgba(100, 100, 255, 0.05)";
  const borderColor = data.borderColor || "rgba(100, 100, 255, 0.3)";
  const spriteIcons = useAppSelector((state) => state.sprites.allIcons);
  const sprite =
    !disableProviderSprites && data.componentId
      ? spriteIcons[data.componentId]
      : undefined;
  const useDirectIcon =
    shouldUseDirectIcon(data.componentId) && Boolean(data.iconUrl);

  // condition in the thunk deduplicates — safe to dispatch every mount.
  React.useEffect(() => {
    if (disableProviderSprites || !data.componentId) return;
    const provider = providerFromId(data.componentId);
    if (!provider) return;
    dispatch(loadSpriteManifest(provider));
  }, [data.componentId, disableProviderSprites, dispatch]);

  const onDelete = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-delete", { detail: { id } }),
      );
    },
    [id],
  );

  const onToggle = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      globalThis.dispatchEvent(
        new CustomEvent("diagram:node-toggle", { detail: { id } }),
      );
    },
    [id],
  );

  return (
    <div
      className="group-node"
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: `2px dashed ${borderColor}`,
        backgroundColor: bgColor,
        minWidth: "300px",
        minHeight: "200px",
        height: "100%",
        position: "relative",
      }}
    >
      {/* Node Resizer - allows resizing the group */}
      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={true}
        lineStyle={{
          borderColor: borderColor,
          borderWidth: 2,
          borderStyle: "dashed",
        }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: "2px",
          backgroundColor: "var(--surface)",
          border: `2px solid ${borderColor}`,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      />

      {/* Action buttons - positioned at top-right */}
      <div className="absolute -top-3 right-2 flex items-center z-10 bg-[var(--surface)]/90 border border-theme rounded-full shadow-sm">
        <motion.button
          type="button"
          onClick={onToggle}
          className="p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
          aria-label="Group settings"
          data-tooltip="Group settings"
          whileHover={{ scale: 1.1, y: -1, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <MdSettings className="w-3 h-3" />
        </motion.button>
        <motion.button
          type="button"
          onClick={onDelete}
          className="p-1 text-red-600 rounded-full hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center"
          aria-label="Delete group"
          data-tooltip="Delete group"
          whileHover={{ scale: 1.15, y: -2, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <MdDelete className="w-3 h-3" />
        </motion.button>
      </div>

      {/* Group Header */}
      <div
        className="group-header"
        style={{
          position: "absolute",
          top: "-12px",
          left: "10px",
          padding: "4px 12px",
          borderRadius: "6px",
          backgroundColor: "var(--surface)",
          border: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "14px",
          fontWeight: "600",
          color: "var(--theme)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {useDirectIcon ? (
          <img
            src={data.iconUrl}
            alt=""
            style={{ width: "16px", height: "16px" }}
          />
        ) : data.icon ? (
          React.createElement(data.icon, { size: 16 })
        ) : sprite ? (
          <SpriteIcon sprite={sprite} displaySize={16} alt="" />
        ) : data.iconUrl ? (
          <img
            src={data.iconUrl}
            alt=""
            style={{ width: "16px", height: "16px" }}
          />
        ) : null}
        <span>{data.label}</span>
      </div>

      {/* Group Subtitle */}
      {data.subtitle && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "var(--muted)",
            fontStyle: "italic",
          }}
        >
          {data.subtitle}
        </div>
      )}

      {/* Handles for connections - invisible but available in all directions */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        isConnectable={true}
        style={{
          width: "100%",
          height: "8px",
          background: "transparent",
          border: "none",
          opacity: 0,
          cursor: "crosshair",
        }}
      />

      <Handle
        id="right"
        type="source"
        position={Position.Right}
        isConnectable={true}
        style={{
          width: "8px",
          height: "100%",
          background: "transparent",
          border: "none",
          opacity: 0,
          cursor: "crosshair",
        }}
      />

      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        isConnectable={true}
        style={{
          width: "100%",
          height: "8px",
          background: "transparent",
          border: "none",
          opacity: 0,
          cursor: "crosshair",
        }}
      />

      <Handle
        id="left"
        type="source"
        position={Position.Left}
        isConnectable={true}
        style={{
          width: "8px",
          height: "100%",
          background: "transparent",
          border: "none",
          opacity: 0,
          cursor: "crosshair",
        }}
      />
    </div>
  );
};

export default GroupNode;
