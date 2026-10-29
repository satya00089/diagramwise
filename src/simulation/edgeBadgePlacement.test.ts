import { describe, expect, it } from "vitest";
import { placeBadgeNearLabel } from "./edgeBadgePlacement";

const label = { center: { x: 100, y: 100 }, width: 120, height: 30 };

describe("placeBadgeNearLabel", () => {
  it("goes directly below the label when there is room", () => {
    const badge = placeBadgeNearLabel(label, 48, [], []);
    expect(badge.x).toBe(100);
    expect(badge.y).toBe(100 + 15 + 4 + 11);
  });

  it("goes beside the label, touching distance, when below is blocked", () => {
    const below = { center: { x: 100, y: 125 }, width: 60, height: 20 };
    const badge = placeBadgeNearLabel(label, 48, [], [below]);
    expect(badge.y).toBe(100);
    expect(badge.x).toBe(100 + 60 + 4 + 24);
  });

  it("uses the left side when below and right are blocked", () => {
    const node = (x: number, y: number, size: number) => ({
      id: `${x}:${y}`,
      position: { x: x - size / 2, y: y - size / 2 },
      width: size,
      height: size,
    });
    const badge = placeBadgeNearLabel(
      label,
      48,
      [node(100, 130, 40), node(190, 100, 40)],
      [],
    );
    expect(badge.y).toBe(100);
    expect(badge.x).toBe(100 - 60 - 4 - 24);
  });

  it("falls back to below when every spot is blocked", () => {
    const wall = { center: { x: 100, y: 110 }, width: 600, height: 200 };
    const badge = placeBadgeNearLabel(label, 48, [], [wall]);
    expect(badge.x).toBe(100);
    expect(badge.y).toBe(100 + 15 + 4 + 11);
  });
});
