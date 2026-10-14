import { describe, expect, it } from "vitest";
import { BackgroundVariant } from "@xyflow/react";
import { parseCanvasBackground } from "./useCanvasBackground";

describe("parseCanvasBackground", () => {
  it.each([
    ["dots", BackgroundVariant.Dots],
    ["lines", BackgroundVariant.Lines],
    ["cross", BackgroundVariant.Cross],
    ["none", "none"],
  ])("keeps the stored value %s", (raw, expected) => {
    expect(parseCanvasBackground(raw)).toBe(expected);
  });

  it("falls back to dots for missing or unknown values", () => {
    expect(parseCanvasBackground(null)).toBe(BackgroundVariant.Dots);
    expect(parseCanvasBackground("waves")).toBe(BackgroundVariant.Dots);
  });
});
