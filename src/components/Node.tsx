import React from "react";
import ReactDOM from "react-dom";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  MdHub,
  MdDelete,
  MdOutlineVerticalAlignTop,
  MdOutlineVerticalAlignBottom,
  MdTune,
} from "react-icons/md";
import { IoDuplicateOutline } from "react-icons/io5";
import { FiUnlock } from "react-icons/fi";
import { BiDotsVertical } from "react-icons/bi";
import { COMPONENTS } from "../config/components";
import NodePropertyDisplay from "./NodePropertyDisplay";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import SpriteIcon from "./SpriteIcon";
import { loadSpriteManifest } from "../store/slices/spritesSlice";
import { shouldUseDirectIcon } from "../utils/iconRendering";

/** Extract provider slug from a component ID like "aws-cognito" → "aws" */
function providerFromId(id: string): string | null {
  const prefix = id.split("-")[0].toLowerCase();
  return ["aws", "azure", "gcp", "kubernetes"].includes(prefix) ? prefix : null;
}

const CONTEXT_MENU_WIDTH = 208;
const CONTEXT_MENU_GUTTER = 12;

export type NodeData = {
  label: string;
  componentId?: string;
  icon?: React.ComponentType;
  iconUrl?: string;
  subtitle?: string;
  componentName?: string;
  _customProperties?: CustomProperty[];
  [key: string]:
    | string
    | number
    | boolean
    | React.ComponentType
    | CustomProperty[]
    | undefined; // Allow for additional dynamic properties
};

import type { PropertyValue } from "../types/canvas";

export interface CustomProperty {
  id: string;
  key: string;
  label: string;
  type: string;
  value: PropertyValue;
}

type Props = {
  id: string;
  data: NodeData;
  onCopy?: (id: string, data: NodeData) => void;
  isInGroup?: boolean;
  disableProviderSprites?: boolean;
};

const Node: React.FC<Props> = React.memo(({ id, data, onCopy, isInGroup, disableProviderSprites = false }) => {
  const dispatch = useAppDispatch();
  const spriteIcons = useAppSelector((state) => state.sprites.allIcons);
  const componentId =
    typeof data.componentId === "string" ? data.componentId : undefined;
  const sprite =
    !disableProviderSprites && componentId
      ? spriteIcons[componentId]
      : undefined;
  const provider = componentId ? providerFromId(componentId) : null;
  // Select only this node's provider status to avoid re-renders from other providers loading.
  const spriteStatus = useAppSelector((state) =>
    provider ? state.sprites.providerStatus[provider] : undefined,
  );
  const useDirectIcon = shouldUseDirectIcon(componentId) && !!data.iconUrl;
  // For known sprite providers (aws/azure/gcp/kubernetes): NEVER fire iconUrl <img>.
  // Show nothing while loading (status undefined or 'loading'), sprite once ready.
  // Only fall back to iconUrl if sprite load definitively failed (status 'error'),
  // or if this is a non-cloud component with no sprite provider at all.
  const showIconUrl =
    disableProviderSprites ||
    useDirectIcon ||
    (!sprite && !!data.iconUrl && (!provider || spriteStatus === "error"));

  // Self-load sprite manifest for this node's provider if not already loaded.
  // condition in the thunk handles deduplication (won't re-fetch if loading/ready).
  React.useEffect(() => {
    if (disableProviderSprites || !componentId) return;
    const p = providerFromId(componentId);
    if (!p) return;
    dispatch(loadSpriteManifest(p));
  }, [componentId, disableProviderSprites, dispatch]);

  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [showProperties, setShowProperties] = React.useState(false);
  const [subtitleTooltip, setSubtitleTooltip] = React.useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);
  const nodeRef = React.useRef<HTMLFieldSetElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusToTrigger = React.useRef(false);

  // Use componentName if available, otherwise fall back to label
  const displayLabel = data.componentName || data.label;
  const defaultMermaidSubtitle = componentId
    ? COMPONENTS.find((component) => component.id === componentId)?.description
    : "Microservice";
  const displaySubtitle =
    data.extensionSource === "mermaid" &&
    data.subtitle === "Imported from Mermaid"
      ? defaultMermaidSubtitle
      : data.subtitle;
  const iconComponent =
    data.icon ?? (data.extensionSource === "mermaid" ? MdHub : undefined);

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

  const getContextMenuPosition = React.useCallback(
    (x: number, y: number) => {
      const menuHeight = isInGroup ? 304 : 264;
      const maxX = Math.max(
        CONTEXT_MENU_GUTTER,
        window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_GUTTER,
      );
      const maxY = Math.max(
        CONTEXT_MENU_GUTTER,
        window.innerHeight - menuHeight - CONTEXT_MENU_GUTTER,
      );

      return {
        x: Math.min(Math.max(x, CONTEXT_MENU_GUTTER), maxX),
        y: Math.min(Math.max(y, CONTEXT_MENU_GUTTER), maxY),
      };
    },
    [isInGroup],
  );

  const openContextMenu = React.useCallback(
    (x: number, y: number, restoreFocus: boolean) => {
      const position = getContextMenuPosition(x, y);
      returnFocusToTrigger.current = restoreFocus;
      setContextMenu({ visible: true, ...position });
    },
    [getContextMenuPosition],
  );

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY, false);
    },
    [openContextMenu],
  );

  const closeContextMenu = React.useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    if (returnFocusToTrigger.current) {
      returnFocusToTrigger.current = false;
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
  }, []);

  const handleMenuButtonClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (contextMenu.visible) {
        closeContextMenu();
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const nodeRect = nodeRef.current?.getBoundingClientRect();
      const rightSideX = nodeRect
        ? nodeRect.right + CONTEXT_MENU_GUTTER
        : rect.right - CONTEXT_MENU_WIDTH;
      const leftSideX = nodeRect
        ? nodeRect.left - CONTEXT_MENU_WIDTH - CONTEXT_MENU_GUTTER
        : rect.right - CONTEXT_MENU_WIDTH;
      const hasRoomOnRight =
        rightSideX + CONTEXT_MENU_WIDTH + CONTEXT_MENU_GUTTER <=
        window.innerWidth;
      const hasRoomOnLeft = leftSideX >= CONTEXT_MENU_GUTTER;
      let menuX = rect.right - CONTEXT_MENU_WIDTH;
      if (hasRoomOnRight) {
        menuX = rightSideX;
      } else if (hasRoomOnLeft) {
        menuX = leftSideX;
      }
      openContextMenu(
        menuX,
        rect.top,
        true,
      );
    },
    [closeContextMenu, contextMenu.visible, openContextMenu],
  );

  const showNodeActions =
    isHovered || isFocused || contextMenu.visible || showProperties;

  const toggleProperties = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProperties((prev) => !prev);
    closeContextMenu();
  }, [closeContextMenu]);

  // Close menu on outside click
  React.useEffect(() => {
    if (contextMenu.visible) {
      const handleClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  React.useEffect(() => {
    if (!contextMenu.visible) return;

    const frame = window.requestAnimationFrame(() => {
      firstMenuItemRef.current?.focus();
    });
    const closeOnViewportChange = () => closeContextMenu();
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [contextMenu.visible, closeContextMenu]);

  const handleContextMenuKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const menuItems = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]',
        ),
      );
      const activeIndex = menuItems.indexOf(
        document.activeElement as HTMLButtonElement,
      );

      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        closeContextMenu();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          (activeIndex + direction + menuItems.length) % menuItems.length;
        menuItems[nextIndex]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        menuItems[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        menuItems.at(-1)?.focus();
      }
    },
    [closeContextMenu],
  );

  let nodeIcon: React.ReactNode;
  if (showIconUrl) {
    nodeIcon = (
      <div className="flex-shrink-0 flex items-center justify-center">
        <img
          src={data.iconUrl}
          alt={displayLabel}
          className="w-full h-full object-contain"
          style={{ maxWidth: "10rem", maxHeight: "10rem" }}
        />
      </div>
    );
  } else if (sprite) {
    nodeIcon = (
      <div className="flex-shrink-0 flex items-center justify-center">
        <SpriteIcon sprite={sprite} displaySize={64} alt={displayLabel} />
      </div>
    );
  } else {
    const iconColor =
      typeof data.textColor === "string" && data.textColor.trim()
        ? data.textColor
        : undefined;
    nodeIcon = (
      <div
        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl relative overflow-hidden"
        style={
          data.borderColor
            ? {
                background: `linear-gradient(135deg, ${data.borderColor as string}30, ${data.borderColor as string}10)`,
              }
            : {
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--brand) 20%, transparent), color-mix(in srgb, var(--brand) 5%, transparent))",
              }
        }
      >
        <div
          className="absolute inset-0 rounded-full"
          style={
            data.borderColor
              ? {
                  background: `linear-gradient(135deg, transparent, ${data.borderColor as string}18)`,
                }
              : {
                  background:
                    "linear-gradient(135deg, transparent, color-mix(in srgb, var(--brand) 10%, transparent))",
                }
          }
        />
        <div
          className="relative z-10"
          style={iconColor ? { color: iconColor } : undefined}
        >
          {iconComponent
            ? React.createElement(
                iconComponent as React.ComponentType<{ size?: number }>,
                { size: 24 },
              )
            : "●"}
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.fieldset
        ref={nodeRef}
        initial={{ y: 0, opacity: 1 }}
        whileHover={{ y: -1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="min-w-[200px] w-full max-w-[15vw] bg-surface border border-theme rounded-lg text-theme text-sm shadow-sm cursor-grab relative p-3"
        style={{
          ...(data.backgroundColor
            ? { backgroundColor: data.backgroundColor as string }
            : {}),
          ...(data.borderColor
            ? {
                borderLeftColor: data.borderColor as string,
                borderLeftWidth: "3px",
              }
            : {}),
          ...(data.textColor ? { color: data.textColor as string } : {}),
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <legend className="sr-only">{displayLabel}</legend>

        {/* Node actions stay quiet until the node is hovered, focused, or active. */}
        <motion.div
          className="node-action-toolbar absolute top-2 right-2 z-10 flex items-center gap-1 rounded-xl border border-theme bg-surface p-1 shadow-lg backdrop-blur-md"
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{
            opacity: showNodeActions ? 1 : 0,
            y: showNodeActions ? 0 : -4,
            scale: showNodeActions ? 1 : 0.96,
          }}
          transition={{ duration: 0.15 }}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget as globalThis.Node | null;
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
              setIsFocused(false);
            }
          }}
          style={{ pointerEvents: showNodeActions ? "auto" : "none" }}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={toggleProperties}
            aria-label={showProperties ? "Hide node properties" : "Show node properties"}
            aria-expanded={showProperties}
            aria-controls={`node-properties-${id}`}
            data-tooltip={showProperties ? "Hide properties" : "Show properties"}
            className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${showProperties ? "bg-[var(--bg-hover)]" : ""}`}
            style={{ color: showProperties ? "var(--brand)" : "var(--text)" }}
          >
            <MdTune className="h-4 w-4" aria-hidden="true" />
          </motion.button>

          <motion.button
            type="button"
            ref={menuTriggerRef}
            whileTap={{ scale: 0.94 }}
            onClick={handleMenuButtonClick}
            onKeyDown={(event) => {
              if (event.key === "Escape" && contextMenu.visible) {
                event.preventDefault();
                closeContextMenu();
              }
            }}
            aria-label="More node actions"
            aria-haspopup="menu"
            aria-expanded={contextMenu.visible}
            aria-controls={`node-actions-${id}`}
            data-tooltip="More actions"
            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            style={{ color: "var(--text)" }}
          >
            <BiDotsVertical className="h-4 w-4" aria-hidden="true" />
          </motion.button>
        </motion.div>

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
          id="top-left"
          type="source"
          position={Position.Top}
          isConnectable={true}
          style={{
            left: "25%",
            width: "8px",
            height: "8px",
            background: "transparent",
            border: "none",
            opacity: 0,
            cursor: "crosshair",
          }}
        />

        <Handle
          id="top-right"
          type="source"
          position={Position.Top}
          isConnectable={true}
          style={{
            left: "75%",
            width: "8px",
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

        {/* Named side handles let architecture diagrams route edges to a
            deliberate vertical anchor while preserving the default handles. */}
        <Handle
          id="right-top"
          type="source"
          position={Position.Right}
          isConnectable={true}
          style={{
            top: "25%",
            width: "8px",
            height: "8px",
            background: "transparent",
            border: "none",
            opacity: 0,
            cursor: "crosshair",
          }}
        />

        <Handle
          id="right-bottom"
          type="source"
          position={Position.Right}
          isConnectable={true}
          style={{
            top: "75%",
            width: "8px",
            height: "8px",
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
          id="bottom-left"
          type="source"
          position={Position.Bottom}
          isConnectable={true}
          style={{
            left: "25%",
            width: "8px",
            height: "8px",
            background: "transparent",
            border: "none",
            opacity: 0,
            cursor: "crosshair",
          }}
        />

        <Handle
          id="bottom-right"
          type="source"
          position={Position.Bottom}
          isConnectable={true}
          style={{
            left: "75%",
            width: "8px",
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

        <Handle
          id="left-top"
          type="source"
          position={Position.Left}
          isConnectable={true}
          style={{
            top: "25%",
            width: "8px",
            height: "8px",
            background: "transparent",
            border: "none",
            opacity: 0,
            cursor: "crosshair",
          }}
        />

        <Handle
          id="left-bottom"
          type="source"
          position={Position.Left}
          isConnectable={true}
          style={{
            top: "75%",
            width: "8px",
            height: "8px",
            background: "transparent",
            border: "none",
            opacity: 0,
            cursor: "crosshair",
          }}
        />

        {/* Main content */}
        <div className="flex flex-col items-center justify-center gap-2 min-w-0 w-full py-2">
          {nodeIcon}

          <div className="min-w-0 w-full text-center">
            <div className="truncate font-medium text-sm">{displayLabel}</div>
            {displaySubtitle && (
              <div
                className="text-xs opacity-70 truncate"
                aria-label={displaySubtitle}
                onMouseEnter={(event) => {
                  if (
                    event.currentTarget.scrollWidth <=
                    event.currentTarget.clientWidth
                  ) {
                    setSubtitleTooltip(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setSubtitleTooltip({
                    text: displaySubtitle,
                    left: rect.left + rect.width / 2,
                    top: rect.bottom + 8,
                  });
                }}
                onMouseLeave={() => setSubtitleTooltip(null)}
              >
                {displaySubtitle}
              </div>
            )}
          </div>
        </div>

        {/* Properties Section - Toggleable */}
        {showProperties && (
          <motion.div
            id={`node-properties-${id}`}
            role="region"
            aria-label={`${displayLabel} properties`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-3 border-t border-theme/10 nowheel"
          >
            <div className="text-xs space-y-2">
              {/* Display all node properties except system ones */}
              {(() => {
                const excludeKeys = new Set([
                  "label",
                  "icon",
                  "iconUrl",
                  "subtitle",
                  "componentId",
                  "componentName",
                  "_customProperties",
                  "backgroundColor",
                  "borderColor",
                  "textColor",
                ]);
                const isEmptyValue = (val: unknown): boolean => {
                  if (val === undefined || val === null || val === "")
                    return true;
                  if (typeof val === "string") {
                    const stripped = val
                      .split("<")
                      .map((part) => part.slice(part.indexOf(">") + 1))
                      .join("")
                      .trim();
                    return stripped === "";
                  }
                  return false;
                };
                const properties = Object.entries(data).filter(
                  ([key, val]) => !excludeKeys.has(key) && !isEmptyValue(val),
                );

                if (
                  properties.length === 0 &&
                  (!data._customProperties ||
                    !Array.isArray(data._customProperties) ||
                    data._customProperties.length === 0)
                ) {
                  return (
                    <div className="opacity-60 text-center py-2">
                      No properties
                    </div>
                  );
                }

                return (
                  <>
                    {properties.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold opacity-60 uppercase tracking-wide">
                          Standard Properties
                        </div>
                        {properties.map(([key, value]) => (
                          <NodePropertyDisplay
                            key={key}
                            propertyKey={key}
                            value={value}
                          />
                        ))}
                      </div>
                    )}

                    {/* Display custom properties last */}
                    {data._customProperties &&
                      Array.isArray(data._customProperties) &&
                      data._customProperties.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold opacity-60 uppercase tracking-wide">
                            Custom Properties
                          </div>
                          {data._customProperties.map(
                            (customProp: CustomProperty) => (
                              <NodePropertyDisplay
                                key={customProp.id}
                                propertyKey={customProp.label || customProp.key}
                                value={customProp.value}
                              />
                            ),
                          )}
                        </div>
                      )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </motion.fieldset>

      {/* Sublabel tooltip portal: React Flow clips pseudo-elements inside the canvas. */}
      {subtitleTooltip &&
        ReactDOM.createPortal(
          <div
            role="tooltip"
            className="app-tooltip pointer-events-none z-[100000] -translate-x-1/2"
            style={{
              left: subtitleTooltip.left,
              top: subtitleTooltip.top,
            }}
          >
            {subtitleTooltip.text}
            <span className="app-tooltip__arrow" aria-hidden="true" />
          </div>,
          document.body,
        )}

      {/* Context Menu Portal */}
      {contextMenu.visible &&
        ReactDOM.createPortal(
          <motion.div
            ref={menuRef}
            data-context-menu
            id={`node-actions-${id}`}
            role="menu"
            aria-label={`${displayLabel} actions`}
            onKeyDown={handleContextMenuKeyDown}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="node-context-menu fixed z-[10000] w-[208px] rounded-xl border border-theme bg-[var(--surface)] py-1 shadow-xl pointer-events-auto"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              ref={firstMenuItemRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(e);
                closeContextMenu();
              }}
              role="menuitem"
              className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
            >
              <MdTune className="h-4 w-4" aria-hidden="true" />
              Open properties
            </button>
            <hr className="my-1 border-0 border-t border-theme/60" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                globalThis.dispatchEvent(
                  new CustomEvent("diagram:node-to-front", { detail: { id } }),
                );
                closeContextMenu();
              }}
              role="menuitem"
              className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
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
              role="menuitem"
              className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
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
                role="menuitem"
                className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm text-orange-500 transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
              >
                <FiUnlock className="w-4 h-4" />
                Detach from Group
              </button>
            )}
            <hr className="my-1 border-0 border-t border-theme/60" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(e);
                closeContextMenu();
              }}
              role="menuitem"
              className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
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
              role="menuitem"
              className="node-context-menu-item flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)] focus-visible:outline-none"
            >
              <MdDelete className="w-4 h-4" />
              Delete
            </button>
          </motion.div>,
          document.body,
        )}
    </>
  );
});

Node.displayName = "Node";

export default Node;
