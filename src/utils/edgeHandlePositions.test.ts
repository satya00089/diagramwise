import { describe, expect, it } from "vitest";
import { Position, type Node } from "@xyflow/react";
import {
  getFallbackHandlePositions,
  getMeasuredHandleAnchor,
} from "./edgeHandlePositions";

describe("edge label handle sides", () => {
  it("uses node handle sides when estimating the visible path", () => {
    const source: Node = {
      id: "a",
      position: { x: 0, y: 0 },
      sourcePosition: Position.Right,
      data: {},
    };
    const target: Node = {
      id: "b",
      position: { x: 400, y: 150 },
      targetPosition: Position.Top,
      data: {},
    };
    expect(getFallbackHandlePositions(source, target)).toEqual({
      sourcePosition: Position.Right,
      targetPosition: Position.Top,
    });
  });

  it("uses the relative position when no side is specified", () => {
    const source: Node = { id: "a", position: { x: 200, y: 0 }, data: {} };
    const target: Node = { id: "b", position: { x: 0, y: 0 }, data: {} };
    expect(getFallbackHandlePositions(source, target)).toEqual({
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    });
  });
});

describe("measured edge handles", () => {
  const node = {
    id: "a",
    position: { x: 0, y: 0 },
    data: {},
    internals: {
      positionAbsolute: { x: 100, y: 200 },
      handleBounds: {
        source: [
          {
            id: "top",
            x: 40,
            y: -5,
            width: 10,
            height: 10,
            position: Position.Top,
          },
        ],
        target: [
          {
            id: "left",
            x: -4,
            y: 30,
            width: 8,
            height: 12,
            position: Position.Left,
          },
        ],
      },
    },
  };

  it("uses the first measured source handle when no handle is specified", () => {
    expect(getMeasuredHandleAnchor(node, null, "source")).toEqual({
      x: 145,
      y: 195,
      position: Position.Top,
    });
  });

  it("resolves named source handles on the target in loose mode", () => {
    expect(getMeasuredHandleAnchor(node, "top", "target")).toEqual({
      x: 145,
      y: 195,
      position: Position.Top,
    });
    expect(getMeasuredHandleAnchor(node, null, "target")).toEqual({
      x: 96,
      y: 236,
      position: Position.Left,
    });
  });
});
