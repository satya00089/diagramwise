import { describe, expect, it } from "vitest";

import { getEdgeLabelLayout } from "./edgeLabelLayout";

const baseOptions = {
  centerX: 60,
  centerY: 0,
  sourceX: 0,
  sourceY: 0,
  targetX: 120,
  targetY: 0,
  labelShift: 0,
  edgePath: "M 0,0L 120,0",
  label: "Upload or playback request",
};

describe("getEdgeLabelLayout", () => {
  it("keeps a routed label on the path when another label blocks its midpoint", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0,0 L 300,0 L 300,100",
      centerX: 150,
      centerY: 0,
      targetX: 300,
      targetY: 100,
      textWidth: 80,
      occupiedLabels: [{ center: { x: 150, y: 0 }, width: 100, height: 18 }],
    });

    expect(layout.center.y === 0 || layout.center.x === 300).toBe(true);
    expect(layout.center).not.toEqual({ x: 150, y: 0 });
  });
  it("keeps source-shifted labels on a curved path", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0 0 C 0 100 100 100 100 0",
      centerX: 50,
      centerY: 75,
      targetX: 100,
      labelShift: -0.5,
      textWidth: 80,
    });

    expect(layout.center.x).toBeLessThan(50);
    expect(layout.center.y).toBeGreaterThan(40);
  });
  it("follows a quadratic path when shifting a bidirectional edge label", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0 0 Q 50 100 100 0",
      centerX: 50,
      centerY: 50,
      targetX: 100,
      labelShift: -0.5,
      textWidth: 80,
    });

    expect(layout.center.x).toBeLessThan(50);
    expect(layout.center.y).toBeGreaterThan(25);
  });
  it("wraps long labels to the usable path width", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      textWidth: 220,
      nodes: [
        {
          id: "source",
          position: { x: -160, y: -40 },
          width: 160,
          height: 80,
        },
        {
          id: "target",
          position: { x: 120, y: -40 },
          width: 160,
          height: 80,
        },
      ],
    });

    expect(layout.width).toBe(100);
    expect(layout.lineCount).toBeGreaterThan(1);
    expect(layout.height).toBeGreaterThan(18);
  });

  it("merges collinear path pieces before sizing the label", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0 0L 20 0L 90 0L 90 0L 160 0L 180 0",
      centerX: 90,
      targetX: 180,
      label: "Readable label",
      textWidth: 140,
    });

    expect(layout.width).toBe(156);
    expect(layout.lineCount).toBe(1);
  });

  it("moves a label off the path when another node occupies its center", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0,0L 300,0",
      centerX: 150,
      targetX: 300,
      textWidth: 90,
      nodes: [
        {
          id: "source",
          position: { x: -120, y: -40 },
          width: 120,
          height: 80,
        },
        {
          id: "target",
          position: { x: 300, y: -40 },
          width: 120,
          height: 80,
        },
        {
          id: "obstacle",
          position: { x: 130, y: -10 },
          width: 40,
          height: 20,
        },
      ],
    });

    expect(Math.abs(layout.center.y)).toBeGreaterThan(0);
  });

  it("moves a label when an earlier edge already occupies the preferred area", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0,0L 300,0",
      centerX: 150,
      targetX: 300,
      textWidth: 90,
      occupiedLabels: [{ center: { x: 150, y: 0 }, width: 100, height: 18 }],
    });

    expect(Math.abs(layout.center.y)).toBeGreaterThan(0);
  });

  it("separates tall labels when all nearby candidates are blocked", () => {
    const occupied = { center: { x: 60, y: 0 }, width: 100, height: 130 };
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      label: "A long label describing a path with many wrapped words",
      textWidth: 750,
      occupiedLabels: [occupied],
      nodes: [
        {
          id: "source",
          position: { x: -200, y: -100 },
          width: 200,
          height: 200,
        },
        {
          id: "target",
          position: { x: 120, y: -100 },
          width: 200,
          height: 200,
        },
      ],
    });
    const verticallySeparated =
      Math.abs(layout.center.y - occupied.center.y) >=
      (layout.height + occupied.height) / 2;
    const horizontallySeparated =
      Math.abs(layout.center.x - occupied.center.x) >=
      (layout.width + occupied.width) / 2;
    expect(verticallySeparated || horizontallySeparated).toBe(true);
    expect(layout.pathAnchor).toEqual({ x: 60, y: 0 });
  });

  it("uses the rendered height of wrapped words for collision checks", () => {
    const occupied = { center: { x: 60, y: 0 }, width: 100, height: 48 };
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      label: "Document Writer Consumer",
      textWidth: 130,
      occupiedLabels: [occupied],
      measureHeight: () => 48,
    });
    expect(layout.height).toBe(48);
    expect(Math.abs(layout.center.y)).toBeGreaterThanOrEqual(48);
  });

  it("respects an explicit maximum width", () => {
    const layout = getEdgeLabelLayout({
      ...baseOptions,
      edgePath: "M 0,0L 300,0",
      centerX: 150,
      targetX: 300,
      textWidth: 180,
      labelMaxWidth: 100,
    });

    expect(layout.width).toBe(100);
    expect(layout.lineCount).toBeGreaterThan(1);
  });
});
