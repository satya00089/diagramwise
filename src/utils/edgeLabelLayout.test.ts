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
      occupiedLabels: [
        { center: { x: 150, y: 0 }, width: 100, height: 18 },
      ],
    });

    expect(Math.abs(layout.center.y)).toBeGreaterThan(0);
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
