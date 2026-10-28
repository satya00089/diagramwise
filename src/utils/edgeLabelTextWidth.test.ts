import { afterEach, describe, expect, it, vi } from "vitest";
import { getEdgeLabelFont, measureEdgeLabelText } from "./edgeLabelTextWidth";

afterEach(() => vi.unstubAllGlobals());

describe("edge label text measurement", () => {
  it("uses measured text width and caches repeated estimates", () => {
    const measureText = vi.fn(() => ({ width: 180 }));
    const context = { font: "", measureText };
    vi.stubGlobal("document", {
      body: {},
      createElement: () => ({ getContext: () => context }),
    });
    const getStyle = vi.fn(() => ({ fontFamily: "Test Sans" }));
    vi.stubGlobal("getComputedStyle", getStyle);
    const font = getEdgeLabelFont();

    expect(measureEdgeLabelText("WWWWWW", font)).toBe(180);
    expect(measureEdgeLabelText("WWWWWW", font)).toBe(180);
    expect(measureText).toHaveBeenCalledTimes(1);
    expect(getStyle).toHaveBeenCalledTimes(1);
  });
});
