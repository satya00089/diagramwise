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
  MdDragIndicator,
  MdMoreHoriz,
  MdRedo,
  MdUndo,
} from "react-icons/md";
import type { CanvasSummary } from "../types/multiCanvas";
import type { CanvasSaveStatus } from "../utils/canvasWorkspaceController";
import {
  CANVAS_BACKGROUND_OPTIONS,
  type CanvasBackground,
} from "../hooks/useCanvasBackground";

type MenuName = "canvas" | "arrange" | "canvases" | "background";

/** Canvas management shown in the toolbar's Canvases menu. */
export type CanvasListMenuProps = {
  canvases: CanvasSummary[];
  activeCanvasId: string | null;
  primaryCanvasId: string | null;
  maxCanvases: number;
  /** False for signed-out users. Visible to everyone, usable only when signed in. */
  signedIn: boolean;
  onSignIn: () => void;
  /** True while an existing design's canvases are being loaded. */
  loading: boolean;
  /** False until the design is saved and has a canvas workspace. */
  ready: boolean;
  emptyStateMessage?: string;
  saveStatus: CanvasSaveStatus;
  message: string | null;
  onSelect: (canvasId: string) => void;
  onCreate: (name: string) => Promise<{ ok: boolean; message?: string }>;
  onRename: (
    canvasId: string,
    name: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  onDuplicate: (canvasId: string) => void;
  onReorder: (orderedIds: string[]) => void;
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
  canvasList: CanvasListMenuProps;
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
    disabled = false,
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
          aria-haspopup={
            name === "canvases" || name === "arrange" ? "dialog" : "menu"
          }
          aria-expanded={isOpen}
          aria-controls={menuId}
          disabled={disabled}
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
            role={
              name === "canvases" || name === "arrange" ? "dialog" : "menu"
            }
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
          <hr className="my-1 border-theme/70" />
          {renderMenuItem(
            "Clear canvas",
            <MdClose aria-hidden="true" />,
            onClearCanvas,
            clearDisabled,
            true,
          )}
        </>,
      )}
      {renderMenu(
        "arrange",
        "Auto layout",
        <MdAccountTree className="h-3 w-3 shrink-0" aria-hidden="true" />,
        <AutoArrangeChooser onArrange={onArrange} onDone={closeMenus} />,
        "min-w-[304px]",
        layoutDisabled || arranging,
      )}
      {arranging && (
        <div className="auto-arrange-status" role="status" aria-live="polite">
          Arranging diagram…{" "}
          <button type="button" onClick={onCancelArrange}>
            Cancel
          </button>
        </div>
      )}
      {renderMenu(
        "canvases",
        "Pages",
        <MdLayers className="h-3 w-3 shrink-0" aria-hidden="true" />,
        <CanvasesMenuBody {...canvasList} onDone={closeMenus} />,
        "min-w-[290px]",
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
  onSignIn,
  loading,
  ready,
  emptyStateMessage,
  saveStatus,
  message,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onReorder,
  onDelete,
  onDone,
}: CanvasesMenuBodyProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const skipRenameBlur = useRef(false);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const notice = message ? (
    <div
      role="alert"
      className="mx-2 my-1 rounded-md bg-[var(--bg-hover)] px-2.5 py-2 text-xs text-theme"
    >
      <p className="mb-1 font-semibold">
        {saveStatus === "conflict"
          ? "Page not saved"
          : "Action needs attention"}
      </p>
      <p>{message}</p>
    </div>
  ) : null;

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2 px-2.5 py-2">
        <p className="text-sm text-theme/70">
          Sign in to create and manage pages.
        </p>
        <button
          type="button"
          role="menuitem"
          className="rounded bg-accent px-2.5 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          onClick={() => {
            onDone();
            onSignIn();
          }}
        >
          Sign in
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <>
        <p className="px-2.5 py-2 text-sm text-theme/70">Loading pages…</p>
        {notice}
      </>
    );
  }
  if (!ready) {
    return (
      <>
        <p className="px-2.5 py-2 text-sm text-theme/70">
          {message
            ? null
            : (emptyStateMessage ?? "Save your design to add pages.")}
        </p>
        {notice}
      </>
    );
  }

  const atLimit = canvases.length >= maxCanvases;

  const submitCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || atLimit || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await onCreate(trimmed);
      if (result.ok) {
        setAdding(false);
        setNewName("");
      } else {
        setCreateError(result.message ?? "Could not create page. Try again.");
      }
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Could not create page. Try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  const submitRename = async (canvas: CanvasSummary) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Enter a page name.");
      return;
    }
    if (trimmed === canvas.name) {
      setEditingId(null);
      return;
    }
    if (renaming) return;
    setRenaming(true);
    try {
      const result = await onRename(canvas.id, trimmed);
      if (result.ok) {
        setEditingId(null);
        setRenameError(null);
      } else {
        setRenameError(result.message ?? "Could not rename page. Try again.");
      }
    } catch (error) {
      setRenameError(
        error instanceof Error
          ? error.message
          : "Could not rename page. Try again.",
      );
    } finally {
      setRenaming(false);
    }
  };

  const reorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ids = canvases.map((canvas) => canvas.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);
    onReorder(ids);
  };

  return (
    <>
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-xs text-theme/70">
        <span>
          Pages · {canvases.length} of {maxCanvases}
        </span>
        <span aria-live="polite">{SAVE_TEXT[saveStatus]}</span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {canvases.map((canvas, index) => {
          const isActive = canvas.id === activeCanvasId;
          return (
            <div
              key={canvas.id}
              className={`group flex flex-wrap items-center gap-1 rounded px-1 py-0.5 ${isActive ? "bg-[var(--bg-hover)]" : ""} ${dropId === canvas.id ? "ring-1 ring-accent" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDropId(canvas.id);
              }}
              onDragLeave={() => setDropId(null)}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId =
                  event.dataTransfer.getData("text/plain") || draggedId;
                if (sourceId) reorder(sourceId, canvas.id);
                setDraggedId(null);
                setDropId(null);
              }}
            >
              <button
                type="button"
                draggable
                aria-label={`Reorder ${canvas.name}. Use Alt+Arrow keys to move it.`}
                className="cursor-grab rounded p-1.5 text-theme/60 hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 active:cursor-grabbing"
                onDragStart={(event) => {
                  setDraggedId(canvas.id);
                  event.dataTransfer.setData("text/plain", canvas.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropId(null);
                }}
                onKeyDown={(event) => {
                  if (
                    !event.altKey ||
                    !["ArrowUp", "ArrowDown"].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  const target =
                    canvases[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (target) reorder(canvas.id, target.id);
                }}
              >
                <MdDragIndicator aria-hidden="true" />
              </button>
              {editingId === canvas.id ? (
                <input
                  autoFocus
                  aria-label={`Rename ${canvas.name}`}
                  value={renameValue}
                  maxLength={60}
                  disabled={renaming}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => {
                    if (skipRenameBlur.current) {
                      skipRenameBlur.current = false;
                      return;
                    }
                    void submitRename(canvas);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      skipRenameBlur.current = true;
                      setEditingId(null);
                      setRenameError(null);
                    }
                  }}
                  className="min-w-0 flex-1 rounded border border-theme bg-transparent px-2 py-1 text-sm text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                />
              ) : (
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-2 text-left text-sm text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  onClick={() => onSelect(canvas.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "F2") return;
                    event.preventDefault();
                    setEditingId(canvas.id);
                    setRenameValue(canvas.name);
                    setRenameError(null);
                  }}
                  onDoubleClick={() => {
                    setEditingId(canvas.id);
                    setRenameValue(canvas.name);
                    setRenameError(null);
                  }}
                >
                  <span
                    className="inline-flex w-4 justify-center"
                    aria-hidden="true"
                  >
                    {isActive ? <MdCheck /> : null}
                  </span>
                  <span className="truncate">{canvas.name}</span>
                </button>
              )}
              {canvas.id === primaryCanvasId && (
                <span className="text-[11px] text-theme/60">Default</span>
              )}
              <button
                type="button"
                aria-label={`More options for ${canvas.name}`}
                aria-expanded={actionsId === canvas.id}
                className="rounded p-1.5 text-theme/70 hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                onClick={() =>
                  setActionsId(actionsId === canvas.id ? null : canvas.id)
                }
              >
                <MdMoreHoriz aria-hidden="true" />
              </button>
              {actionsId === canvas.id && (
                <div className="flex w-full justify-end gap-1 pb-1">
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40"
                    disabled={atLimit}
                    onClick={() => {
                      onDuplicate(canvas.id);
                      setActionsId(null);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40 dark:text-red-400"
                    disabled={canvases.length <= 1}
                    onClick={() => {
                      if (window.confirm(`Delete the page "${canvas.name}"?`))
                        onDelete(canvas.id);
                      setActionsId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              {editingId === canvas.id && renameError && (
                <p role="alert" className="w-full text-xs text-red-600">
                  {renameError}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-2.5 py-1 text-[11px] text-theme/60">
        Drag to reorder · Double-click a name to rename
      </p>

      <hr className="my-1 border-theme/70" />

      {adding ? (
        <form
          className="flex flex-col gap-1 px-2.5 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <input
            autoFocus
            aria-label="New page name"
            value={newName}
            maxLength={60}
            disabled={creating}
            placeholder="Page name · press Enter"
            onChange={(event) => {
              setNewName(event.target.value);
              setCreateError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setAdding(false);
                setCreateError(null);
              }
            }}
            className="rounded border border-theme bg-transparent px-2 py-1.5 text-sm text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          />
          {creating && (
            <span role="status" className="text-xs text-theme/70">
              Creating page…
            </span>
          )}
          {createError && (
            <p role="alert" className="text-xs text-red-600">
              {createError}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          disabled={atLimit}
          className={rowClass}
          onClick={() => {
            setAdding(true);
            setCreateError(null);
          }}
        >
          + New page
        </button>
      )}

      {(!adding || !createError) && notice}
    </>
  );
}

export default CanvasActionControls;
