import dagre from "dagre";

export type AutoArrangeAlgorithm =
  | "layered"
  | "pipeline"
  | "snowflake"
  | "compact";
export type AutoArrangeOptions = {
  algorithm: AutoArrangeAlgorithm;
  direction: "LR" | "TB";
};
export type LayoutBox = {
  id: string;
  width: number;
  height: number;
  parentId?: string;
  container: boolean;
};
export type LayoutLink = { source: string; target: string };
export type LayoutGraph = { nodes: LayoutBox[]; edges: LayoutLink[] };
export type LayoutPlacement = LayoutBox & { x: number; y: number };

const GAP = 80;
const LAYER_GAP = 140;
const compareIds = (a: string, b: string) => (a < b ? -1 : Number(a > b));
const sortBoxes = (boxes: LayoutBox[]) =>
  [...boxes].sort((a, b) => compareIds(a.id, b.id));

const bounds = (boxes: LayoutPlacement[]) => ({
  width: Math.max(0, ...boxes.map((box) => box.x + box.width)),
  height: Math.max(0, ...boxes.map((box) => box.y + box.height)),
});

function makeGraph(nodes: LayoutBox[], edges: LayoutLink[]) {
  const graph = new dagre.graphlib.Graph();
  nodes.forEach((node) =>
    graph.setNode(node.id, { width: node.width, height: node.height }),
  );
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target, {}));
  return graph;
}

function layered(
  nodes: LayoutBox[],
  edges: LayoutLink[],
  direction: "LR" | "TB",
) {
  const graph = makeGraph(nodes, edges);
  graph.setGraph({ rankdir: direction, nodesep: GAP, ranksep: LAYER_GAP });
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      x: position.x - node.width / 2,
      y: position.y - node.height / 2,
    };
  });
}

function findCycles(graph: dagre.graphlib.Graph): string[][] {
  // @types/dagre 0.7 spells this export "tarjam"; graphlib exports "tarjan".
  const graphAlgorithms = dagre.graphlib.alg as typeof dagre.graphlib.alg & {
    tarjan: (input: dagre.graphlib.Graph) => string[][];
  };
  return graphAlgorithms
    .tarjan(graph)
    .map((ids) => ids.sort(compareIds))
    .sort((a, b) => compareIds(a[0], b[0]));
}

function indexCycles(cycles: string[][]): Map<string, number> {
  return new Map(
    cycles.flatMap((ids, index) => ids.map((id) => [id, index] as const)),
  );
}

function assignPipelineStages(
  cycles: string[][],
  cycleFor: Map<string, number>,
  edges: LayoutLink[],
): number[] {
  const successors = cycles.map(() => new Set<number>());
  const indegree = cycles.map(() => 0);
  for (const edge of edges) {
    const source = cycleFor.get(edge.source)!;
    const target = cycleFor.get(edge.target)!;
    if (source !== target && !successors[source].has(target)) {
      successors[source].add(target);
      indegree[target]++;
    }
  }
  const stages = cycles.map(() => 0);
  const ready = indegree.flatMap((degree, index) =>
    degree === 0 ? [index] : [],
  );
  for (const source of ready) {
    for (const target of successors[source]) {
      stages[target] = Math.max(stages[target], stages[source] + 1);
      indegree[target]--;
      if (indegree[target] === 0) ready.push(target);
    }
  }
  return stages;
}

function placePipelineStages(
  nodes: LayoutBox[],
  cycleFor: Map<string, number>,
  stages: number[],
  direction: "LR" | "TB",
): LayoutPlacement[] {
  const columns = new Map<number, LayoutBox[]>();
  for (const node of nodes) {
    const stage = stages[cycleFor.get(node.id)!];
    columns.set(stage, [...(columns.get(stage) ?? []), node]);
  }
  let primary = 0;
  const result: LayoutPlacement[] = [];
  for (const [, column] of [...columns].sort(([a], [b]) => a - b)) {
    let secondary = 0;
    let size = 0;
    for (const node of column) {
      result.push({
        ...node,
        x: direction === "LR" ? primary : secondary,
        y: direction === "LR" ? secondary : primary,
      });
      secondary += (direction === "LR" ? node.height : node.width) + GAP;
      size = Math.max(size, direction === "LR" ? node.width : node.height);
    }
    primary += size + LAYER_GAP;
  }
  return result;
}

/** Collapse cycles before assigning stages; every cycle occupies one stage. */
function pipeline(
  nodes: LayoutBox[],
  edges: LayoutLink[],
  direction: "LR" | "TB",
) {
  const cycles = findCycles(makeGraph(nodes, edges));
  const cycleFor = indexCycles(cycles);
  const stages = assignPipelineStages(cycles, cycleFor, edges);
  return placePipelineStages(nodes, cycleFor, stages, direction);
}

/** Dimension-aware shelf packing, shared by compact and disconnected sections. */
function pack(nodes: LayoutBox[]): LayoutPlacement[] {
  const area = nodes.reduce(
    (sum, node) => sum + (node.width + GAP) * (node.height + GAP),
    0,
  );
  const targetWidth = Math.max(
    Math.sqrt(area * 1.4),
    ...nodes.map((node) => node.width),
  );
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return nodes.map((node) => {
    if (x > 0 && x + node.width > targetWidth) {
      x = 0;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    const placed = { ...node, x, y };
    x += node.width + GAP;
    rowHeight = Math.max(rowHeight, node.height);
    return placed;
  });
}

function adjacency(nodes: LayoutBox[], edges: LayoutLink[]) {
  const neighbors = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const { source, target } of edges) {
    if (source === target) continue;
    neighbors.get(source)!.add(target);
    neighbors.get(target)!.add(source);
  }
  return neighbors;
}

function connectedOrder(nodes: LayoutBox[], edges: LayoutLink[]) {
  const neighbors = adjacency(nodes, edges);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const ordered: LayoutBox[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const queue = [node.id];
    for (const id of queue) {
      ordered.push(byId.get(id)!);
      for (const next of [...neighbors.get(id)!].sort(compareIds)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return ordered;
}

function snowflake(nodes: LayoutBox[], edges: LayoutLink[]) {
  const neighbors = adjacency(nodes, edges);
  const root = [...nodes].sort(
    (a, b) =>
      neighbors.get(b.id)!.size - neighbors.get(a.id)!.size ||
      compareIds(a.id, b.id),
  )[0];
  const depths = new Map([[root.id, 0]]);
  const queue = [root.id];
  for (const id of queue) {
    for (const next of [...neighbors.get(id)!].sort(compareIds)) {
      if (!depths.has(next)) {
        depths.set(next, depths.get(id)! + 1);
        queue.push(next);
      }
    }
  }
  const rings = new Map<number, LayoutBox[]>();
  nodes.forEach((node) => {
    const depth = depths.get(node.id)!;
    rings.set(depth, [...(rings.get(depth) ?? []), node]);
  });
  const result: LayoutPlacement[] = [
    { ...root, x: -root.width / 2, y: -root.height / 2 },
  ];
  let previousRadius = 0;
  let previousHalfDiagonal = Math.hypot(root.width, root.height) / 2;
  for (const [depth, ring] of [...rings].sort(([a], [b]) => a - b)) {
    if (depth === 0) continue;
    // Bounding circles guarantee clearance for differently sized rectangles.
    const halfDiagonal = Math.max(
      ...ring.map((node) => Math.hypot(node.width, node.height) / 2),
    );
    const circumRadius =
      ring.length > 1
        ? (2 * halfDiagonal + GAP) / (2 * Math.sin(Math.PI / ring.length))
        : 0;
    const radius = Math.max(
      previousRadius + previousHalfDiagonal + halfDiagonal + GAP,
      circumRadius,
    );
    ring.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / ring.length;
      result.push({
        ...node,
        x: radius * Math.cos(angle) - node.width / 2,
        y: radius * Math.sin(angle) - node.height / 2,
      });
    });
    previousRadius = radius;
    previousHalfDiagonal = halfDiagonal;
  }
  const minX = Math.min(...result.map((node) => node.x));
  const minY = Math.min(...result.map((node) => node.y));
  return result.map((node) => ({
    ...node,
    x: node.x - minX,
    y: node.y - minY,
  }));
}

function layoutLevel(
  nodes: LayoutBox[],
  edges: LayoutLink[],
  options: AutoArrangeOptions,
): LayoutPlacement[] {
  if (nodes.length === 0) return [];
  if (options.algorithm === "compact")
    return pack(connectedOrder(nodes, edges));
  // Layout each connected section independently, then pack their bounding boxes.
  const graph = makeGraph(nodes, edges);
  const components = dagre.graphlib.alg
    .components(graph)
    .map((ids) => ids.sort(compareIds))
    .sort((a, b) => compareIds(a[0], b[0]));
  const sections = components.map((ids) => {
    const members = new Set(ids);
    const sectionNodes = nodes.filter((node) => members.has(node.id));
    const sectionEdges = edges.filter(
      (edge) => members.has(edge.source) && members.has(edge.target),
    );
    if (options.algorithm === "snowflake")
      return snowflake(sectionNodes, sectionEdges);
    return options.algorithm === "pipeline"
      ? pipeline(sectionNodes, sectionEdges, options.direction)
      : layered(sectionNodes, sectionEdges, options.direction);
  });
  const packed = pack(
    sections.map((section, index) => ({
      id: String(index),
      ...bounds(section),
      container: false,
    })),
  );
  return sections.flatMap((section, index) =>
    section.map((node) => ({
      ...node,
      x: node.x + packed[index].x,
      y: node.y + packed[index].y,
    })),
  );
}

/** Geometry-only graph computation; safe to run in a worker without React data. */
export function computeAutoArrange(
  graph: LayoutGraph,
  options: AutoArrangeOptions,
): LayoutPlacement[] {
  const nodes = sortBoxes(graph.nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length)
    throw new Error("Duplicate node IDs prevent arrangement.");
  const children = new Map<string | undefined, LayoutBox[]>();
  for (const node of nodes) {
    if (
      ![node.width, node.height].every(
        (size) => Number.isFinite(size) && size > 0,
      )
    )
      throw new Error("Invalid node dimensions.");
    const ancestors = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (ancestors.has(parent))
        throw new Error("A group cannot contain itself.");
      ancestors.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor?.container)
        throw new Error("A node's parent group could not be found.");
      parent = ancestor.parentId;
    }
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  const links = graph.edges
    .filter((edge) => byId.has(edge.source) && byId.has(edge.target))
    .sort(
      (a, b) =>
        compareIds(a.source, b.source) || compareIds(a.target, b.target),
    );
  const placements = new Map<string, LayoutPlacement>();
  const arrange = (parentId?: string): LayoutPlacement[] => {
    const siblings = (children.get(parentId) ?? []).map((node) => {
      if (!node.container || !children.has(node.id)) return node;
      const placed = arrange(node.id);
      const size = bounds(placed);
      placed.forEach((child) =>
        placements.set(child.id, {
          ...child,
          x: child.x + 40,
          y: child.y + 60,
        }),
      );
      return {
        ...node,
        width: Math.max(node.width, size.width + 80),
        height: Math.max(node.height, size.height + 100),
      };
    });
    const siblingIds = new Set(siblings.map((node) => node.id));
    const representative = (id: string): string | undefined => {
      let node = byId.get(id);
      while (node && !siblingIds.has(node.id))
        node = node.parentId ? byId.get(node.parentId) : undefined;
      return node?.id;
    };
    const unique = new Map<string, LayoutLink>();
    for (const link of links) {
      const source = representative(link.source);
      const target = representative(link.target);
      if (source && target && source !== target)
        unique.set(JSON.stringify([source, target]), { source, target });
    }
    return layoutLevel(siblings, [...unique.values()], options);
  };
  arrange().forEach((node) => placements.set(node.id, node));
  return nodes.map((node) => placements.get(node.id)!);
}
