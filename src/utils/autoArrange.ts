import type { Edge, Node } from "@xyflow/react";
export { getCanvasRevision as getArrangeRevision } from "./canvasRevision";
import type {
  AutoArrangeOptions,
  LayoutGraph,
  LayoutPlacement,
} from "./autoArrangeGraph";
export type {
  AutoArrangeAlgorithm,
  AutoArrangeOptions,
} from "./autoArrangeGraph";

const dimension = (...values: unknown[]): number | undefined =>
  values.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0,
  );
function rowCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value !== "string") return 0;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function getArrangeDimensions(node: Node) {
  const table = node.type === "tableNode" || node.type === "dataModelNode";
  const fallbackWidth = table ? 440 : node.type === "group" ? 400 : 240;
  const fallbackHeight = table
    ? node.data.isCollapsed === true
      ? 56
      : 100 +
        36 * Math.max(1, rowCount(node.data.attributes ?? node.data.fields))
    : node.type === "group"
      ? 300
      : 140;
  const shape = node.data.shape as
    | { width?: unknown; height?: unknown }
    | undefined;
  return {
    width:
      dimension(
        node.measured?.width,
        node.width,
        node.style?.width,
        shape?.width,
      ) ?? fallbackWidth,
    height:
      dimension(
        node.measured?.height,
        node.height,
        node.style?.height,
        shape?.height,
      ) ?? fallbackHeight,
  };
}

export function toLayoutGraph(nodes: Node[], edges: Edge[]): LayoutGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      container: node.type === "group",
      ...getArrangeDimensions(node),
    })),
    edges: edges.map(({ source, target }) => ({ source, target })),
  };
}

export function applyArrangePlacements(
  nodes: Node[],
  placements: LayoutPlacement[],
): Node[] {
  const positions = new Map(placements.map((node) => [node.id, node]));
  if (positions.size !== nodes.length)
    throw new Error("Arrangement returned an incomplete diagram.");
  return nodes.map((node) => {
    const placed = positions.get(node.id);
    if (
      !placed ||
      ![placed.x, placed.y, placed.width, placed.height].every(Number.isFinite)
    )
      throw new Error("Arrangement returned invalid positions.");
    return {
      ...node,
      position: { x: placed.x, y: placed.y },
      ...(node.type === "group"
        ? {
            width: placed.width,
            height: placed.height,
            style: {
              ...node.style,
              width: placed.width,
              height: placed.height,
            },
            measured: {
              ...node.measured,
              width: placed.width,
              height: placed.height,
            },
          }
        : {}),
    };
  });
}

/** Reselect ordinary side handles; field and explicitly offset ports retain their identity. */
export function routeArrangedEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const center = (node: Node) => {
    const size = getArrangeDimensions(node);
    let x = node.position.x + size.width / 2;
    let y = node.position.y + size.height / 2;
    let parent = node.parentId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor) break;
      x += ancestor.position.x;
      y += ancestor.position.y;
      parent = ancestor.parentId;
    }
    return { x, y };
  };
  const sideHandles = new Set(["top", "bottom", "left", "right"]);
  return edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (
      !source ||
      !target ||
      source.id === target.id ||
      (edge.sourceHandle && !sideHandles.has(edge.sourceHandle)) ||
      (edge.targetHandle && !sideHandles.has(edge.targetHandle))
    )
      return edge;
    const start = center(source);
    const end = center(target);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return {
      ...edge,
      sourceHandle: horizontal
        ? dx >= 0
          ? "right"
          : "left"
        : dy >= 0
          ? "bottom"
          : "top",
      targetHandle: horizontal
        ? dx >= 0
          ? "left"
          : "right"
        : dy >= 0
          ? "top"
          : "bottom",
    };
  });
}

/** A fresh worker makes cancellation and resource cleanup explicit for each run. */
export function arrangeCanvas(
  nodes: Node[],
  edges: Edge[],
  options: AutoArrangeOptions,
  signal?: AbortSignal,
): Promise<LayoutPlacement[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Arrangement cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(
      new URL("./autoArrange.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () =>
      fail(new DOMException("Arrangement cancelled", "AbortError"));
    const timeout = setTimeout(
      () =>
        fail(
          new Error(
            "Arrangement took too long. Try Compact or a smaller diagram.",
          ),
        ),
      30000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ placements?: LayoutPlacement[]; error?: string }>,
    ) => {
      cleanup();
      if (event.data.placements) resolve(event.data.placements);
      else reject(new Error(event.data.error ?? "Arrangement failed."));
    };
    worker.onerror = () =>
      fail(new Error("The layout worker could not run. Please try again."));
    worker.onmessageerror = () =>
      fail(new Error("The layout result could not be read."));
    try {
      worker.postMessage({ graph: toLayoutGraph(nodes, edges), options });
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Arrangement failed."));
    }
  });
}
