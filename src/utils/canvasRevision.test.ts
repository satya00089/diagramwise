import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  getCanvasNodesRevision,
  getCanvasEdgesRevision,
} from "./canvasRevision";

describe("canvas revisions used by history and collaboration", () => {
  const node: Node = {
    id: "cluster",
    type: "group",
    position: { x: 0, y: 0 },
    data: {},
    style: { width: 400, height: 300 },
  };
  const edge: Edge = {
    id: "link",
    source: "a",
    target: "b",
    sourceHandle: "right",
    targetHandle: "left",
    data: { label: "Calls" },
  };

  it("recognizes group resizing and membership changes even when positions stay unchanged", () => {
    expect(getCanvasNodesRevision([node])).not.toBe(
      getCanvasNodesRevision([{ ...node, style: { width: 900, height: 700 } }]),
    );
    expect(getCanvasNodesRevision([node])).not.toBe(
      getCanvasNodesRevision([{ ...node, parentId: "vpc" }]),
    );
  });

  it("recognizes rerouted handles without requiring different endpoints", () => {
    expect(getCanvasEdgesRevision([edge])).not.toBe(
      getCanvasEdgesRevision([
        { ...edge, sourceHandle: "bottom", targetHandle: "top" },
      ]),
    );
    expect(getCanvasEdgesRevision([edge])).not.toBe(
      getCanvasEdgesRevision([{ ...edge, data: { label: "Returns" } }]),
    );
  });

  it("ignores renderer-only state to avoid extra history entries and synchronization loops", () => {
    expect(getCanvasNodesRevision([node])).toBe(
      getCanvasNodesRevision([
        {
          ...node,
          measured: { width: 400, height: 300 },
          selected: true,
          dragging: false,
        },
      ]),
    );
    expect(getCanvasEdgesRevision([edge])).toBe(
      getCanvasEdgesRevision([{ ...edge, selected: true }]),
    );
  });
});
