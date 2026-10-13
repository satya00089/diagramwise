import React, { useEffect, useRef, useState } from "react";
import { ControlButton } from "@xyflow/react";
import {
  MdClose,
  MdHistory,
  MdRedo,
  MdSwapHoriz,
  MdSwapVert,
  MdUndo,
} from "react-icons/md";
import { FcFlowChart } from "react-icons/fc";

type MenuName = "canvas" | "layout";

type CanvasActionControlsProps = {
  canUndo: boolean;
  canRedo: boolean;
  clearDisabled: boolean;
  layoutDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearCanvas: () => void;
  onHorizontalLayout: () => void;
  onVerticalLayout: () => void;
};

const CanvasActionControls: React.FC<CanvasActionControlsProps> = ({
  canUndo,
  canRedo,
  clearDisabled,
  layoutDisabled,
  onUndo,
  onRedo,
  onClearCanvas,
  onHorizontalLayout,
  onVerticalLayout,
}) => {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [hoveredMenu, setHoveredMenu] = useState<MenuName | null>(null);
  const [focusedMenu, setFocusedMenu] = useState<MenuName | null>(null);
  const [clickedMenu, setClickedMenu] = useState<MenuName | null>(null);

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

  const renderMenu = (
    name: MenuName,
    label: string,
    icon: React.ReactNode,
    options: React.ReactNode,
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
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute left-full bottom-0 z-[1000] ml-2 min-w-[176px] flex-col overflow-hidden rounded-md border border-theme bg-[var(--surface)] p-1 text-theme shadow-lg ${isOpen ? "flex" : "hidden"}`}
        >
          {options}
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
        <MdHistory aria-hidden="true" />,
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
      {renderMenu(
        "layout",
        "Auto layout",
        <FcFlowChart aria-hidden="true" />,
        <>
          {renderMenuItem(
            "Horizontal layout",
            <MdSwapHoriz aria-hidden="true" />,
            onHorizontalLayout,
            layoutDisabled,
          )}
          {renderMenuItem(
            "Vertical layout",
            <MdSwapVert aria-hidden="true" />,
            onVerticalLayout,
            layoutDisabled,
          )}
        </>,
      )}
    </div>
  );
};

export default CanvasActionControls;
