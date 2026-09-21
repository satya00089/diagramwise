import React from "react";
import ReactDOM from "react-dom";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  MdSettings,
  MdDelete,
  MdOutlineVerticalAlignTop,
  MdOutlineVerticalAlignBottom,
} from "react-icons/md";
import { IoDuplicateOutline } from "react-icons/io5";
import { FiUnlock } from "react-icons/fi";
import DOMPurify from "dompurify";

export type ERNodeData = {
  label: string;
  icon?: string;
  componentName?: string;
  purpose?: string;
  description?: string;
  attributes?: string;
  primaryKey?: string;
  foreignKeys?: string;
  cardinality?: string;
  nodeType?:
    | "entity"
    | "weak-entity"
    | "er-note"
    | "er-view"
    | "er-trigger"
    | "er-use-case"
    | "uml-use-case"
    | "uml-note";
  [key: string]: string | number | boolean | undefined;
};

type Props = {
  id: string;
  data: ERNodeData;
  onCopy?: (id: string, data: ERNodeData) => void;
  isInGroup?: boolean;
};

const ERNode: React.FC<Props> = React.memo(
  ({ id, data, onCopy, isInGroup }) => {
    const [contextMenu, setContextMenu] = React.useState<{
      visible: boolean;
      x: number;
      y: number;
    }>({ visible: false, x: 0, y: 0 });

    const displayLabel = data.componentName || data.label;
    const nodeType = data.nodeType || "entity";

    const isEmptyValue = (val: unknown): boolean => {
      if (val === undefined || val === null || val === "") return true;
      if (typeof val === "string") {
        const stripped = val.replaceAll(/<[^>]*>/g, "").trim();
        return stripped === "";
      }
      return false;
    };

    const purpose = data.purpose ?? data.description;
    const hasDescription = !isEmptyValue(purpose);

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

    const handleCopy = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCopy?.(id, data);
      },
      [id, data, onCopy],
    );

    const handleDetach = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        globalThis.dispatchEvent(
          new CustomEvent("diagram:node-detach", { detail: { id } }),
        );
      },
      [id],
    );

    const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
      });
    }, []);

    const closeContextMenu = React.useCallback(() => {
      setContextMenu({ visible: false, x: 0, y: 0 });
    }, []);

    React.useEffect(() => {
      if (contextMenu.visible) {
        const handleClick = (e: MouseEvent) => {
          const menu = document.querySelector("[data-context-menu]");
          if (menu && !menu.contains(e.target as Node)) {
            closeContextMenu();
          }
        };
        document.addEventListener("click", handleClick);
        document.addEventListener("contextmenu", handleClick);
        return () => {
          document.removeEventListener("click", handleClick);
          document.removeEventListener("contextmenu", handleClick);
        };
      }
    }, [contextMenu.visible, closeContextMenu]);

    // Parse attributes if they exist
    const attributesList = data.attributes
      ? data.attributes.split("\n").filter((attr) => attr.trim())
      : [];

    // Determine styling based on node type
    const getNodeStyle = () => {
      switch (nodeType) {
        case "weak-entity":
          return {
            border: "3px double var(--theme-color, #333)",
            borderRadius: "0.5rem",
            minWidth: "200px",
            maxWidth: "400px",
            height: "auto",
          };
        case "er-note":
          return {
            borderRadius: "0.25rem",
            minWidth: "180px",
            maxWidth: "400px",
            height: "auto",
            backgroundColor: "var(--note-bg, #fef3c7)",
            borderLeft: "4px solid var(--warning, #f59e0b)",
          };
        case "er-trigger":
          return {
            borderRadius: "0.5rem",
            minWidth: "200px",
            maxWidth: "400px",
            height: "auto",
            backgroundColor: "var(--accent-bg, #fef3e7)",
            borderLeft: "4px solid var(--accent, #f59e0b)",
          };
        case "er-view":
          return {
            borderRadius: "0.5rem",
            minWidth: "200px",
            maxWidth: "400px",
            height: "auto",
            borderStyle: "dashed",
            borderWidth: "2px",
          };
        case "uml-use-case":
        case "er-use-case":
          return {
            borderRadius: "0.25rem",
            minWidth: "180px",
            maxWidth: "400px",
            height: "auto",
            backgroundColor: "var(--note-bg, #fef3c7)",
            borderLeft: "4px solid var(--brand, #6366f1)",
          };
        case "uml-note":
          return {
            borderRadius: "0.25rem",
            minWidth: "160px",
            maxWidth: "450px",
            height: "auto",
            backgroundColor: "var(--note-bg, #fef3c7)",
            borderLeft: "4px solid var(--warning, #f59e0b)",
          };
        default:
          return {
            borderRadius: "0.5rem",
            minWidth: "200px",
            maxWidth: "400px",
            height: "auto",
          };
      }
    };

    // Special node type checks
    const isNote =
      nodeType === "er-note" ||
      nodeType === "uml-note" ||
      nodeType === "uml-use-case" ||
      nodeType === "er-use-case";
    const isTrigger = nodeType === "er-trigger";
    const isUMLNode = ["uml-use-case", "uml-note", "er-use-case"].includes(
      nodeType || "",
    );

    const nodeStyle = {
      ...getNodeStyle(),
      ...(data.backgroundColor
        ? { backgroundColor: data.backgroundColor as string }
        : {}),
      ...(data.borderColor
        ? { borderColor: data.borderColor as string }
        : {}),
      // Default dark text for light-bg note/trigger nodes; user textColor always wins
      ...((isNote || isTrigger) && !data.textColor ? { color: "#374151" } : {}),
      ...(data.textColor ? { color: data.textColor as string } : {}),
    };

    return (
      <>
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          whileHover={{ y: -1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={`bg-surface border-2 border-theme text-sm shadow-sm cursor-grab relative ${nodeType === "entity" || nodeType === "weak-entity" ? "overflow-y-auto er-node-scroll" : "overflow-hidden"} ${isNote ? "bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100" : ""} ${isTrigger ? "bg-orange-50 dark:bg-orange-900/20 text-gray-900 dark:text-gray-100" : "text-theme"}`}
          style={nodeStyle}
          onContextMenu={handleContextMenu}
        >
          {/* Handles for connections */}
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

          {/* Entity Header */}
          {!isNote && !isTrigger && (
            <div
              className="bg-[var(--brand)] text-[var(--bg)] px-3 py-2 font-semibold text-center flex items-center justify-center gap-2"
              style={{
                ...(data.backgroundColor
                  ? {
                      backgroundColor:
                        (data.borderColor as string) ||
                        (data.backgroundColor as string),
                    }
                  : {
                      backgroundColor:
                        (data.borderColor as string) || "var(--brand)",
                    }),
                ...(data.textColor
                  ? { color: data.textColor as string }
                  : { color: "var(--bg)" }),
              }}
            >
              {data.icon && <span className="text-lg">{data.icon}</span>}
              <span>{displayLabel}</span>
            </div>
          )}

          {/* Note content */}
          {isNote && (
            <div className="px-3 py-2">
              {displayLabel && (
                <div className="flex items-center gap-2">
                  {data.icon && <span className="text-lg">{data.icon}</span>}
                  <span className="font-bold text-xl">{displayLabel}</span>
                </div>
              )}
              {displayLabel && hasDescription && (
                <hr className="border-gray-400 my-1" />
              )}
              {hasDescription && (
                <div
                  className="text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:ml-1 [&_p]:mb-1"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(purpose!),
                  }}
                />
              )}
            </div>
          )}

          {/* Trigger content */}
          {isTrigger && (
            <div className="px-3 py-2">
              {displayLabel && (
                <div className="flex items-center gap-2">
                  {data.icon && <span className="text-lg">{data.icon}</span>}
                  <span className="font-bold text-xl">{displayLabel}</span>
                </div>
              )}
              {displayLabel && hasDescription && (
                <hr className="border-gray-400 my-1" />
              )}
              <div className="text-xs space-y-1 mt-2">
                {data.timing && data.event && (
                  <div className="font-mono text-[11px] opacity-80">
                    {data.timing} {data.event}
                  </div>
                )}
                {data.targetTable && (
                  <div>
                    ON <span className="font-semibold">{data.targetTable}</span>
                  </div>
                )}
                {data.level && (
                  <div className="text-[10px] opacity-70">
                    FOR EACH {data.level}
                  </div>
                )}
                {hasDescription && (
                  <div
                    className="mt-1 pt-1 border-t border-gray-300 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:ml-1 [&_p]:mb-1"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(purpose!),
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* UML Node content */}
          {isUMLNode && !isNote && (
            <div className="px-4 py-3">
              <div className="flex flex-col items-center gap-2">
                {data.icon && <span className="text-3xl">{data.icon}</span>}
                <span className="font-bold text-xl text-center">
                  {displayLabel}
                </span>
                {hasDescription && (
                  <div
                    className="text-xs text-muted mt-1 text-left [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:ml-1 [&_p]:mb-1"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(purpose!),
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Attributes Section - only for entity types */}
          {(nodeType === "entity" || nodeType === "weak-entity") &&
            attributesList.length > 0 && (
              <div className="px-3 py-2 border-t border-theme/20">
                <div className="space-y-1 text-xs">
                  {attributesList.map((attr) => {
                    const isPrimaryKey =
                      data.primaryKey && attr.includes(data.primaryKey);
                    const isForeignKey = data?.foreignKeys
                      ?.split("\n")
                      .some((fk) => attr.includes(fk));

                    return (
                      <div
                        key={attr}
                        className={`font-mono ${
                          isPrimaryKey
                            ? "font-bold text-yellow-600 dark:text-yellow-400"
                            : isForeignKey
                              ? "text-blue-600 dark:text-blue-400"
                              : ""
                        }`}
                      >
                        {attr.trim().startsWith("+") ? (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            🔑 {attr.trim().substring(1).trim()}
                          </span>
                        ) : (
                          attr.trim()
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </motion.div>

        {/* Context Menu Portal */}
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
                  onToggle(e);
                  closeContextMenu();
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
                    new CustomEvent("diagram:node-to-front", {
                      detail: { id },
                    }),
                  );
                  closeContextMenu();
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
                  closeContextMenu();
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
                    handleDetach(e);
                    closeContextMenu();
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
                  handleCopy(e);
                  closeContextMenu();
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
                  onDelete(e);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm text-red-600"
              >
                <MdDelete className="w-4 h-4" />
                Delete
              </button>
            </motion.div>,
            document.body,
          )}
      </>
    );
  },
);

ERNode.displayName = "ERNode";

export default ERNode;
