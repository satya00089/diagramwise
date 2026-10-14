import React, { useCallback, useEffect, useRef, useState } from "react";
import AutoArrangeChooser from "./AutoArrangeChooser";
import type { AutoArrangeOptions } from "../utils/autoArrange";
import { ControlButton } from "@xyflow/react";
import {
  MdCheck,
  MdClose,
  MdAccountTree,
  MdGridOn,
  MdHistory,
  MdLayers,
  MdRedo,
  MdUndo,
} from "react-icons/md";
import {
  CANVAS_KIND_LABELS,
  CANVAS_KINDS,
  type CanvasKind,
  type CanvasSummary,
} from "../types/multiCanvas";
import type { CanvasSaveStatus } from "../utils/canvasWorkspaceController";
import {
  CANVAS_BACKGROUND_OPTIONS,
  type CanvasBackground,
} from "../hooks/useCanvasBackground";

type MenuName = "canvas" | "canvases" | "background";

/** Canvas management shown in the toolbar's Canvases menu. Omit it when multi-canvas is off. */
export type CanvasListMenuProps = {
  canvases: CanvasSummary[];
  activeCanvasId: string | null;
  primaryCanvasId: string | null;
  maxCanvases: number;
  /** False for signed-out users. Visible to everyone, usable only when signed in. */
  signedIn: boolean;
  /** True while an existing design's canvases are being loaded. */
  loading: boolean;
  /** False until the design is saved and has a canvas workspace. */
  ready: boolean;
  saveStatus: CanvasSaveStatus;
  message: string | null;
  onSelect: (canvasId: string) => void;
  onCreate: (name: string, kind: CanvasKind) => void;
  onRename: (canvasId: string, name: string) => void;
  onDuplicate: (canvasId: string) => void;
  onMove: (canvasId: string, direction: -1 | 1) => void;
  onDelete: (canvasId: string) => void;
};

type CanvasActionControlsProps = {
  canUndo: boolean;
  canRedo: boolean;
  clearDisabled: boolean;
  layoutDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearCanvas: () => void;
  onArrange: (options: AutoArrangeOptions) => void;
  arranging: boolean;
  onCancelArrange: () => void;
  canvasList?: CanvasListMenuProps | null;
  background?: CanvasBackground;
  onBackgroundChange?: (background: CanvasBackground) => void;
};

const CanvasActionControls: React.FC<CanvasActionControlsProps> = ({
  canUndo,
  canRedo,
  clearDisabled,
  layoutDisabled,
  onUndo,
  onRedo,
  onClearCanvas,
  onArrange,
  arranging,
  onCancelArrange,
  canvasList,
  background = "dots",
  onBackgroundChange,
}) => {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [hoveredMenu, setHoveredMenu] = useState<MenuName | null>(null);
  const [focusedMenu, setFocusedMenu] = useState<MenuName | null>(null);
  const [clickedMenu, setClickedMenu] = useState<MenuName | null>(null);
  const [arrangeAnchor, setArrangeAnchor] = useState<HTMLButtonElement | null>(
    null,
  );
  const closeArrange = useCallback(() => setArrangeAnchor(null), []);
  const wasArranging = useRef(false);
  useEffect(() => {
    if (
      wasArranging.current &&
      !arranging &&
      document.activeElement === document.body
    ) {
      controlsRef.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="Auto layout"]')
        ?.focus();
    }
    wasArranging.current = arranging;
  }, [arranging]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (controlsRef.current?.contains(event.target as Node)) return;
      setClickedMenu(null);
      setHoveredMenu(null);
      setFocusedMenu(null);

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        controlsRef.current?.contains(activeElement)
      ) {
        activeElement.blur();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setClickedMenu(null);
      setHoveredMenu(null);
      setFocusedMenu(null);

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        controlsRef.current?.contains(activeElement)
      ) {
        activeElement.blur();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const closeMenus = () => {
    setClickedMenu(null);
    setHoveredMenu(null);
    setFocusedMenu(null);
  };

  const renderMenu = (
    name: MenuName,
    label: string,
    icon: React.ReactNode,
    options: React.ReactNode,
    widthClass = "min-w-[176px]",
  ) => {
    const isOpen =
      hoveredMenu === name || focusedMenu === name || clickedMenu === name;
    const menuId = `canvas-action-menu-${name}`;

    return (
      <div
        key={name}
        className="relative nodrag nopan"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHoveredMenu(name);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHoveredMenu(null);
        }}
        onFocusCapture={() => setFocusedMenu(name)}
        onBlurCapture={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setFocusedMenu(null);
          }
        }}
      >
        <ControlButton
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          className="border-t border-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          onClick={(event) => {
            event.stopPropagation();
            const shouldClose = clickedMenu === name;
            setClickedMenu(shouldClose ? null : name);
            if (shouldClose) event.currentTarget.blur();
          }}
        >
          {icon}
        </ControlButton>
        <div
          className={`absolute left-full bottom-0 z-[1000] pl-2 ${isOpen ? "block" : "hidden"}`}
        >
          <div
            id={menuId}
            role="menu"
            aria-label={label}
            className={`flex ${widthClass} flex-col overflow-hidden rounded-md border border-theme bg-[var(--surface)] p-1 text-theme shadow-lg`}
          >
            {options}
          </div>
        </div>
      </div>
    );
  };

  const renderMenuItem = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    disabled = false,
    destructive = false,
  ) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-40 ${destructive ? "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" : "text-theme"}`}
      onClick={(event) => {
        event.stopPropagation();
        action();
        setClickedMenu(null);
        event.currentTarget.blur();
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div ref={controlsRef} className="flex flex-col">
      {renderMenu(
        "canvas",
        "Canvas actions",
        <MdHistory className="h-3 w-3 shrink-0" aria-hidden="true" />,
        <>
          {renderMenuItem(
            "Undo",
            <MdUndo aria-hidden="true" />,
            onUndo,
            !canUndo,
          )}
          {renderMenuItem(
            "Redo",
            <MdRedo aria-hidden="true" />,
            onRedo,
            !canRedo,
          )}
          <div role="separator" className="my-1 border-t border-theme/70" />
          {renderMenuItem(
            "Clear canvas",
            <MdClose aria-hidden="true" />,
            onClearCanvas,
            clearDisabled,
            true,
          )}
        </>,
      )}
      <ControlButton
        type="button"
        aria-label="Auto layout"
        aria-haspopup="dialog"
        aria-expanded={Boolean(arrangeAnchor)}
        disabled={layoutDisabled || arranging}
        onClick={(event) => {
          setClickedMenu(null);
          setHoveredMenu(null);
          setFocusedMenu(null);
          setArrangeAnchor(arrangeAnchor ? null : event.currentTarget);
        }}
      >
        <MdAccountTree className="h-3 w-3" aria-hidden="true" />
      </ControlButton>
      {arrangeAnchor && (
        <AutoArrangeChooser
          anchor={arrangeAnchor}
          onClose={closeArrange}
          onArrange={onArrange}
        />
      )}
      {arranging && (
        <div className="auto-arrange-status" role="status" aria-live="polite">
          Arranging diagram…{" "}
          <button type="button" onClick={onCancelArrange}>
            Cancel
          </button>
        </div>
      )}
      {canvasList &&
        renderMenu(
          "canvases",
          "Canvases",
          <MdLayers className="h-3 w-3 shrink-0" aria-hidden="true" />,
          <CanvasesMenuBody
            {...canvasList}
            onDone={closeMenus}
          />,
          "min-w-[260px]",
        )}
      {onBackgroundChange &&
        renderMenu(
          "background",
          "Background",
          <MdGridOn className="h-3 w-3 shrink-0" aria-hidden="true" />,
          <>
            {CANVAS_BACKGROUND_OPTIONS.map((option) =>
              renderMenuItem(
                option.label,
                option.value === background ? (
                  <MdCheck aria-hidden="true" />
                ) : (
                  <span className="inline-block w-[1em]" aria-hidden="true" />
                ),
                () => onBackgroundChange(option.value),
              ),
            )}
          </>,
        )}
    </div>
  );
};

const SAVE_TEXT: Record<CanvasSaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Out of date",
  error: "Not saved",
};

const rowClass =
  "flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-40";

type CanvasesMenuBodyProps = CanvasListMenuProps & { onDone: () => void };

/**
 * Contents of the toolbar's Canvases menu: switch, create, and manage canvases.
 * Canvas management works on the open canvas, so the menu stays short.
 */
function CanvasesMenuBody({
  canvases,
  activeCanvasId,
  primaryCanvasId,
  maxCanvases,
  signedIn,
  loading,
  ready,
  saveStatus,
  message,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onDone,
}: CanvasesMenuBodyProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CanvasKind>("other");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const notice = message ? (
    <p role="alert" className="px-2.5 pt-1 pb-2 text-xs text-red-600">
      {message}
    </p>
  ) : null;

  if (!signedIn) {
    return <p className="px-2.5 py-2 text-sm text-theme/70">Sign in to use canvases.</p>;
  }
  if (loading) {
    return (
      <>
        <p className="px-2.5 py-2 text-sm text-theme/70">Loading canvases…</p>
        {notice}
      </>
    );
  }
  if (!ready) {
    return (
      <>
        <p className="px-2.5 py-2 text-sm text-theme/70">
          {message ? null : "Save your design to add canvases."}
        </p>
        {notice}
      </>
    );
  }

  const active = canvases.find((canvas) => canvas.id === activeCanvasId) ?? null;
  const activeIndex = active ? canvases.indexOf(active) : -1;
  const atLimit = canvases.length >= maxCanvases;

  const submitCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed || atLimit) return;
    onCreate(trimmed, newKind);
    setAdding(false);
    setNewName("");
    setNewKind("other");
    onDone();
  };

  const submitRename = () => {
    if (!active) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== active.name) onRename(active.id, trimmed);
    setRenaming(false);
    onDone();
  };

  return (
    <>
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-xs text-theme/70">
        <span>
          {canvases.length}/{maxCanvases} canvases
        </span>
        <span aria-live="polite">{SAVE_TEXT[saveStatus]}</span>
      </div>

      {canvases.map((canvas) => {
        const isActive = canvas.id === activeCanvasId;
        return (
          <button
            key={canvas.id}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            className={rowClass}
            onClick={() => {
              onSelect(canvas.id);
              onDone();
            }}
          >
            <span className="inline-flex w-4 justify-center" aria-hidden="true">
              {isActive ? <MdCheck /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{canvas.name}</span>
            {canvas.id === primaryCanvasId && (
              <span className="text-xs text-theme/60">Primary</span>
            )}
            <span className="text-xs text-theme/60">{CANVAS_KIND_LABELS[canvas.kind]}</span>
          </button>
        );
      })}

      <div role="separator" className="my-1 border-t border-theme/70" />

      {adding ? (
        <form
          className="flex flex-col gap-2 px-2.5 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitCreate();
          }}
        >
          <input
            autoFocus
            aria-label="New canvas name"
            value={newName}
            maxLength={60}
            placeholder="Canvas name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setAdding(false);
            }}
            className="rounded border border-theme bg-transparent px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <select
              aria-label="Canvas type"
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as CanvasKind)}
              className="flex-1 rounded border border-theme bg-transparent px-1 py-1 text-sm"
            >
              {CANVAS_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {CANVAS_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-accent px-2 py-1 text-sm text-white">
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 py-1 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          role="menuitem"
          disabled={atLimit}
          className={rowClass}
          onClick={() => setAdding(true)}
        >
          + New canvas
        </button>
      )}

      {active && (
        <>
          <div role="separator" className="my-1 border-t border-theme/70" />
          <p className="px-2.5 pt-1 text-xs text-theme/60">Current: {active.name}</p>
          {renaming ? (
            <input
              autoFocus
              aria-label="Canvas name"
              value={renameValue}
              maxLength={60}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={submitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRename();
                if (event.key === "Escape") setRenaming(false);
              }}
              className="mx-2.5 my-1 rounded border border-theme bg-transparent px-2 py-1 text-sm"
            />
          ) : (
            <button
              type="button"
              role="menuitem"
              className={rowClass}
              onClick={() => {
                setRenameValue(active.name);
                setRenaming(true);
              }}
            >
              Rename
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={atLimit}
            className={rowClass}
            onClick={() => {
              onDuplicate(active.id);
              onDone();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={activeIndex <= 0}
            className={rowClass}
            onClick={() => onMove(active.id, -1)}
          >
            Move left
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={activeIndex < 0 || activeIndex >= canvases.length - 1}
            className={rowClass}
            onClick={() => onMove(active.id, 1)}
          >
            Move right
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={canvases.length <= 1}
            className={`${rowClass} text-red-600 dark:text-red-400`}
            onClick={() => {
              if (window.confirm(`Delete the canvas "${active.name}"?`)) {
                onDelete(active.id);
                onDone();
              }
            }}
          >
            Delete
          </button>
        </>
      )}

      {message && (
        <p role="alert" className="px-2.5 pt-1 pb-2 text-xs text-red-600">
          {message}
        </p>
      )}
    </>
  );
}

export default CanvasActionControls;
