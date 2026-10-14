import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdAccountTree,
  MdClose,
  MdGridView,
  MdHub,
  MdViewColumn,
} from "react-icons/md";
import type { AutoArrangeOptions } from "../utils/autoArrange";
import "./AutoArrangeChooser.css";

const choices = [
  {
    algorithm: "layered",
    label: "Left-right",
    description:
      "Follow connections across the canvas. Best for architectures and dependency chains.",
    icon: MdAccountTree,
  },
  {
    algorithm: "pipeline",
    label: "Pipeline",
    description:
      "Align connected stages in columns, with parallel nodes stacked together.",
    icon: MdViewColumn,
  },
  {
    algorithm: "snowflake",
    label: "Snowflake",
    description:
      "Place the most connected nodes at the center, with related nodes around them.",
    icon: MdHub,
  },
  {
    algorithm: "compact",
    label: "Compact",
    description:
      "Pack nodes into a compact area. Useful for overviews and diagrams with few connections.",
    icon: MdGridView,
  },
] as const;

type Props = {
  anchor: HTMLButtonElement;
  onClose: () => void;
  onArrange: (options: AutoArrangeOptions) => void;
};

export default function AutoArrangeChooser({
  anchor,
  onClose,
  onArrange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [direction, setDirection] = useState<"LR" | "TB">("LR");
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const reposition = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(368, window.innerWidth - 24);
      dialog.style.width = `${width}px`;
      dialog.style.left = `${Math.max(12, Math.min(rect.right + 12, window.innerWidth - width - 12))}px`;
      dialog.style.top = `${Math.max(12, Math.min(rect.bottom - dialog.offsetHeight, window.innerHeight - dialog.offsetHeight - 12))}px`;
    };
    if (window.innerWidth < 640) dialog.showModal();
    else dialog.show();
    reposition();
    dialog.querySelector<HTMLButtonElement>("[data-arrange-option]")?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !dialog.contains(event.target as Node) &&
        !anchor.contains(event.target as Node)
      )
        onClose();
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      dialog.close();
      anchor.focus();
    };
  }, [anchor, onClose]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="auto-arrange-chooser nodrag nopan nowheel"
      aria-labelledby="auto-arrange-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (
          event.target instanceof HTMLSelectElement ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const options = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "[data-arrange-option]",
          ),
        );
        const index = options.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          let next =
            event.key === "ArrowDown"
              ? (index + 1) % options.length
              : (index - 1 + options.length) % options.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = options.length - 1;
          options[next]?.focus();
        }
        if (/^[1-4]$/.test(event.key)) {
          event.preventDefault();
          options[Number(event.key) - 1]?.click();
        }
      }}
    >
      <header className="auto-arrange-heading">
        <h2 id="auto-arrange-title">Choose auto arrange algorithm</h2>
        <button type="button" aria-label="Close auto arrange" onClick={onClose}>
          <MdClose aria-hidden="true" />
        </button>
      </header>
      <div className="auto-arrange-options">
        {choices.map(({ algorithm, label, description, icon: Icon }, index) => (
          <button
            key={algorithm}
            type="button"
            data-arrange-option
            aria-keyshortcuts={String(index + 1)}
            onClick={() => {
              onArrange({ algorithm, direction });
              onClose();
            }}
          >
            <Icon className="auto-arrange-icon" aria-hidden="true" />
            <span>
              <span className="auto-arrange-label">
                {algorithm === "layered" && direction === "TB"
                  ? "Top-bottom"
                  : label}
              </span>
              <span className="auto-arrange-description">
                {algorithm === "pipeline" && direction === "TB"
                  ? "Align connected stages in rows, with parallel nodes side by side."
                  : description}
              </span>
            </span>
            <kbd aria-hidden="true">{index + 1}</kbd>
          </button>
        ))}
      </div>
      <footer className="auto-arrange-footer">
        <label htmlFor="auto-arrange-direction">Layered direction</label>
        <select
          id="auto-arrange-direction"
          value={direction}
          onChange={(event) => setDirection(event.target.value as "LR" | "TB")}
        >
          <option value="LR">Left to right</option>
          <option value="TB">Top to bottom</option>
        </select>
        <p>
          Direction applies to the first two layouts. Arranges the whole
          diagram, including groups.
        </p>
      </footer>
    </dialog>,
    document.body,
  );
}
