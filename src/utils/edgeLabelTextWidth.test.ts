import { afterEach, describe, expect, it, vi } from "vitest";
import { getEdgeLabelFont, measureEdgeLabelHeight, measureEdgeLabelText, subscribeToEdgeLabelFonts } from "./edgeLabelTextWidth";

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

  it("remeasures wrapped text after fonts finish loading", () => {
    const fonts = new EventTarget();
    let height = 34;
    const element = { style: {}, textContent: "", getBoundingClientRect: () => ({ height }), remove: vi.fn() };
    vi.stubGlobal("document", { body: { appendChild: vi.fn() }, fonts, createElement: () => element });
    const onChange = vi.fn();
    const unsubscribe = subscribeToEdgeLabelFonts(onChange);
    onChange.mockClear();

    expect(measureEdgeLabelHeight("Document Writer Consumer", 100, "11px test-font")).toBe(34);
    height = 48;
    expect(measureEdgeLabelHeight("Document Writer Consumer", 100, "11px test-font")).toBe(34);
    fonts.dispatchEvent(new Event("loadingdone"));
    expect(onChange).toHaveBeenCalledOnce();
    expect(measureEdgeLabelHeight("Document Writer Consumer", 100, "11px test-font")).toBe(48);
    unsubscribe();
    height = 62;
    const unsubscribeAfterRemount = subscribeToEdgeLabelFonts(onChange);
    expect(measureEdgeLabelHeight("Document Writer Consumer", 100, "11px test-font")).toBe(62);
    unsubscribeAfterRemount();
  });
});
