import { afterEach, describe, expect, it, vi } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  computeAutoArrange,
  type AutoArrangeAlgorithm,
  type LayoutPlacement,
} from "./autoArrangeGraph";
import {
  applyArrangePlacements,
  arrangeCanvas,
  getArrangeDimensions,
  getArrangeRevision,
  routeArrangedEdges,
  toLayoutGraph,
} from "./autoArrange";

const node = (id: string, type = "custom", parentId?: string): Node => ({
  id,
  type,
  parentId,
  position: { x: 20, y: 30 },
  measured: { width: 200, height: 100 },
  data: { label: id },
});
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});
const algorithms: AutoArrangeAlgorithm[] = [
  "layered",
  "pipeline",
  "snowflake",
  "compact",
];

function expectNoSiblingOverlap(placements: LayoutPlacement[]) {
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    expect([a.x, a.y, a.width, a.height].every(Number.isFinite)).toBe(true);
    for (const b of placements.slice(i + 1)) {
      if (a.parentId !== b.parentId) continue;
      const overlap =
        a.x < b.x + b.width - 0.01 &&
        a.x + a.width > b.x + 0.01 &&
        a.y < b.y + b.height - 0.01 &&
        a.y + a.height > b.y + 0.01;
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
}

describe.each(algorithms)("%s arrangement", (algorithm) => {
  it("supports mixed renderers, cycles, disconnected nodes and unequal dimensions deterministically", () => {
    const nodes = [
      node("generic"),
      node("aws"),
      node("kubernetes"),
      node("uml", "tableNode"),
      node("entity", "tableNode"),
      node("document", "dataModelNode"),
      node("note", "erNode"),
      node("shape", "freeform"),
    ];
    nodes[3].measured = { width: 510, height: 750 };
    nodes[4].measured = { width: 440, height: 120 };
    const edges = [
      edge("generic", "aws"),
      edge("aws", "kubernetes"),
      edge("kubernetes", "generic"),
      edge("generic", "uml"),
      edge("uml", "entity"),
      edge("entity", "document"),
      edge("entity", "entity"),
      edge("missing", "entity"),
    ];
    const snapshot = JSON.stringify({ nodes, edges });
    const graph = toLayoutGraph(nodes, edges);
    const result = computeAutoArrange(graph, { algorithm, direction: "LR" });
    expect(result).toHaveLength(nodes.length);
    expectNoSiblingOverlap(result);
    expect(
      computeAutoArrange(
        {
          nodes: [...graph.nodes].reverse(),
          edges: [...graph.edges].reverse(),
        },
        { algorithm, direction: "LR" },
      ),
    ).toEqual(result);
    expect(JSON.stringify({ nodes, edges })).toBe(snapshot);
    const arranged = applyArrangePlacements(nodes, result);
    arranged.forEach((placed, i) => expect(placed.data).toBe(nodes[i].data));
  });

  it("keeps nested memberships and grows groups around children", () => {
    const nodes = [
      node("vpc", "group"),
      node("cluster", "group", "vpc"),
      node("pod", "custom", "cluster"),
      node("service", "custom", "cluster"),
      node("db", "tableNode", "vpc"),
      node("client"),
    ];
    nodes[2].measured = { width: 620, height: 380 };
    const result = computeAutoArrange(
      toLayoutGraph(nodes, [
        edge("client", "pod"),
        edge("pod", "service"),
        edge("service", "db"),
      ]),
      { algorithm, direction: "LR" },
    );
    expectNoSiblingOverlap(result);
    for (const child of result.filter((item) => item.parentId)) {
      const parent = result.find((item) => item.id === child.parentId)!;
      expect(child.x).toBeGreaterThanOrEqual(40);
      expect(child.y).toBeGreaterThanOrEqual(60);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.width - 39);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.height - 39);
    }
    expect(
      applyArrangePlacements(nodes, result).map((item) => item.parentId),
    ).toEqual(nodes.map((item) => item.parentId));
  });

  it("handles empty, single-node and 120-node diagrams", () => {
    expect(
      computeAutoArrange(
        { nodes: [], edges: [] },
        { algorithm, direction: "LR" },
      ),
    ).toEqual([]);
    const nodes = Array.from({ length: 120 }, (_, i) => node(`n${i}`));
    const edges = nodes.slice(1).map((item) => edge("n0", item.id));
    expectNoSiblingOverlap(
      computeAutoArrange(toLayoutGraph(nodes, edges), {
        algorithm,
        direction: "TB",
      }),
    );
    expect(
      computeAutoArrange(toLayoutGraph(nodes.slice(0, 1), []), {
        algorithm,
        direction: "LR",
      })[0],
    ).toMatchObject({ x: 0, y: 0 });
  });
});

it("pipeline aligns parallel stages and places cycles together in both directions", () => {
  const nodes = [node("a"), node("b"), node("c"), node("d")];
  const graph = toLayoutGraph(nodes, [
    edge("a", "b"),
    edge("a", "c"),
    edge("b", "d"),
    edge("c", "d"),
    edge("c", "b"),
    edge("b", "c"),
  ]);
  for (const direction of ["LR", "TB"] as const) {
    const positions = new Map(
      computeAutoArrange(graph, { algorithm: "pipeline", direction }).map(
        (item) => [item.id, item],
      ),
    );
    const axis = direction === "LR" ? "x" : "y";
    expect(positions.get("a")![axis]).toBeLessThan(positions.get("b")![axis]);
    expect(positions.get("b")![axis]).toBe(positions.get("c")![axis]);
    expect(positions.get("c")![axis]).toBeLessThan(positions.get("d")![axis]);
  }
});

it("snowflake puts the highest-degree node at the center of its neighbors", () => {
  const nodes = [node("hub"), node("a"), node("b"), node("c"), node("d")];
  const result = computeAutoArrange(
    toLayoutGraph(
      nodes,
      nodes.slice(1).map((item) => edge("hub", item.id)),
    ),
    { algorithm: "snowflake", direction: "LR" },
  );
  const hub = result.find((item) => item.id === "hub")!;
  const leaves = result.filter((item) => item.id !== "hub");
  expect(
    leaves.reduce((sum, item) => sum + item.x, 0) / leaves.length,
  ).toBeCloseTo(hub.x);
  expect(
    leaves.reduce((sum, item) => sum + item.y, 0) / leaves.length,
  ).toBeCloseTo(hub.y);
});

it("rejects malformed hierarchy and incomplete results before modifying nodes", () => {
  const invalid = [node("a", "group", "b"), node("b", "group", "a")];
  expect(() =>
    computeAutoArrange(toLayoutGraph(invalid, []), {
      algorithm: "compact",
      direction: "LR",
    }),
  ).toThrow("contain itself");
  expect(() => applyArrangePlacements([node("a")], [])).toThrow("incomplete");
});

it("prefers measurements and estimates expanded and collapsed tables", () => {
  const table: Node = {
    ...node("uml", "tableNode"),
    measured: undefined,
    data: {
      attributes: JSON.stringify(Array.from({ length: 20 }, () => ({}))),
    },
  };
  expect(getArrangeDimensions(table).height).toBeGreaterThan(700);
  expect(
    getArrangeDimensions({
      ...table,
      data: { ...table.data, isCollapsed: true },
    }).height,
  ).toBe(56);
  expect(
    getArrangeDimensions({
      ...table,
      width: 500,
      measured: { width: 650, height: 190 },
    }),
  ).toEqual({ width: 650, height: 190 });
});

it("detects stale edits but ignores measurement and selection updates", () => {
  const first = node("a");
  expect(getArrangeRevision([first], [])).toBe(
    getArrangeRevision(
      [{ ...first, selected: true, measured: { width: 800 } }],
      [],
    ),
  );
  expect(getArrangeRevision([first], [])).not.toBe(
    getArrangeRevision([{ ...first, position: { x: 90, y: 30 } }], []),
  );
  expect(getArrangeRevision([first], [])).not.toBe(
    getArrangeRevision([{ ...first, data: { label: "Edited" } }], []),
  );
});

it("routes ordinary handles by absolute position while preserving field ports and semantics", () => {
  const nodes = [
    node("group", "group"),
    node("a", "custom", "group"),
    { ...node("b"), position: { x: 40, y: 700 } },
  ];
  const original: Edge = {
    ...edge("a", "b"),
    sourceHandle: "right",
    targetHandle: "left",
    data: { purpose: "Calls", bidirectional: true },
    markerEnd: "uml-marker",
    label: "Calls",
  };
  const routed = routeArrangedEdges(nodes, [original])[0];
  expect(routed).toMatchObject({
    source: "a",
    target: "b",
    sourceHandle: "bottom",
    targetHandle: "top",
    markerEnd: "uml-marker",
    label: "Calls",
  });
  expect(routed.data).toBe(original.data);
  const fieldEdge = {
    ...original,
    sourceHandle: "field:id:right",
    targetHandle: "field:ref:left",
  };
  expect(routeArrangedEdges(nodes, [fieldEdge])[0]).toBe(fieldEdge);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("terminates cancelled workers without applying a result", async () => {
  const terminate = vi.fn();
  vi.stubGlobal(
    "Worker",
    class {
      postMessage() {}
      terminate = terminate;
    },
  );
  const controller = new AbortController();
  const result = arrangeCanvas(
    [node("a")],
    [],
    { algorithm: "compact", direction: "LR" },
    controller.signal,
  );
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(terminate).toHaveBeenCalledOnce();
});
