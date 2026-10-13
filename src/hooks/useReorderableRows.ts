import { useCallback, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  DragEvent,
  DragEventHandler,
  KeyboardEvent,
} from "react";
import { type ReorderPosition } from "../utils/reorder";

type IdentifiedItem = { id: string };

type DropTarget = {
  id: string;
  position: ReorderPosition;
};

type ReorderHandleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "data-tooltip": string;
  "data-tooltip-placement": "left";
};

type RowHandlers = {
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  style: CSSProperties | undefined;
};

export const useReorderableRows = <T extends IdentifiedItem, G>(
  items: T[],
  getGroup: (item: T) => G,
  onReorder: (
    sourceId: string,
    targetId: string,
    position: ReorderPosition,
  ) => void,
) => {
  const activeId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const getHandleProps = useCallback(
    (id: string, label: string): ReorderHandleProps => ({
      type: "button",
      draggable: true,
      className:
        "nodrag nopan flex h-6 w-5 flex-shrink-0 !cursor-grab touch-none items-center justify-center rounded text-muted/70 hover:bg-[var(--bg-hover)] hover:text-theme active:!cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
      "aria-label": `Reorder ${label}`,
      "aria-keyshortcuts": "ArrowUp ArrowDown",
      "data-tooltip":
        "Drag to reorder field. Use the up and down arrow keys to move it.",
      "data-tooltip-placement": "left",
      onClick: (event) => event.stopPropagation(),
      onDragStart: (event) => {
        event.stopPropagation();
        activeId.current = id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: (event) => {
        event.stopPropagation();
        activeId.current = null;
        setDropTarget(null);
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        event.stopPropagation();

        const item = items.find((candidate) => candidate.id === id);
        if (!item) return;
        const siblings = items.filter(
          (candidate) => getGroup(candidate) === getGroup(item),
        );
        const index = siblings.findIndex((candidate) => candidate.id === id);
        const target = siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
        if (!target) return;

        onReorder(id, target.id, event.key === "ArrowUp" ? "before" : "after");
      },
    }),
    [getGroup, items, onReorder],
  );

  const getRowProps = useCallback(
    (id: string): RowHandlers => ({
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        const sourceId = activeId.current;
        if (!sourceId || sourceId === id) return;
        const source = items.find((item) => item.id === sourceId);
        const target = items.find((item) => item.id === id);
        if (!source || !target || getGroup(source) !== getGroup(target)) return;

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        const position =
          event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
        setDropTarget({ id, position });
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        const sourceId = activeId.current;
        const source = items.find((item) => item.id === sourceId);
        const target = items.find((item) => item.id === id);
        if (
          !sourceId ||
          sourceId === id ||
          !source ||
          !target ||
          getGroup(source) !== getGroup(target)
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const position =
          dropTarget?.id === id
            ? dropTarget.position
            : event.clientY <
                event.currentTarget.getBoundingClientRect().top +
                  event.currentTarget.getBoundingClientRect().height / 2
              ? "before"
              : "after";
        onReorder(sourceId, id, position);
        activeId.current = null;
        setDropTarget(null);
      },
      style:
        dropTarget?.id === id
          ? {
              boxShadow:
                dropTarget.position === "before"
                  ? "inset 0 2px 0 var(--brand)"
                  : "inset 0 -2px 0 var(--brand)",
            }
          : undefined,
    }),
    [dropTarget, getGroup, items, onReorder],
  );

  return { getHandleProps, getRowProps };
};
