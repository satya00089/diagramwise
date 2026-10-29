import { describe, expect, it } from "vitest";
import { edgeBadgePosition } from "./edgeBadgePosition";

describe("simulation edge badge position", () => {
  it.each([14, 42, 70])("clears a %i-pixel label", height => {
    const label = { center: { x: 100, y: 100 }, width: 100, height };
    expect(edgeBadgePosition(label, [], []).y - 11).toBeGreaterThan(label.center.y + height / 2);
  });

  it("places the badge above when a node blocks the area below", () => {
    const label = { center: { x: 100, y: 100 }, width: 100, height: 42 };
    const node = { id: "target", position: { x: 0, y: 125 }, width: 200, height: 100 };
    const badge = edgeBadgePosition(label, [node], []);
    expect(badge.y + 11).toBeLessThan(label.center.y - label.height / 2);
  });
});
