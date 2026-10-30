import { describe, expect, it } from "vitest";
import {
  hasOpenPopup,
  isTooltipSuppressed,
  type TooltipElement,
} from "./tooltipVisibility";

function fakeElement({
  attributes = {},
  openPopup = false,
  throwsOnPopover = false,
  expandedChild = false,
}: {
  attributes?: Record<string, string>;
  openPopup?: boolean;
  throwsOnPopover?: boolean;
  expandedChild?: boolean;
} = {}): TooltipElement {
  return {
    hasAttribute: (name: string) => name in attributes,
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelector: (selector: string) => {
      if (throwsOnPopover && selector.includes(":popover-open"))
        throw new SyntaxError("unsupported selector");
      const matchesExpanded = selector === '[aria-expanded="true"]';
      if (matchesExpanded) return expandedChild ? ({} as Element) : null;
      return openPopup ? ({} as Element) : null;
    },
  };
}

describe("hasOpenPopup", () => {
  it("is false for a closed control", () => {
    expect(hasOpenPopup(fakeElement())).toBe(false);
  });

  it("is true when the element itself is expanded", () => {
    expect(
      hasOpenPopup(fakeElement({ attributes: { "aria-expanded": "true" } })),
    ).toBe(true);
  });

  it("is false when the element is explicitly collapsed", () => {
    expect(
      hasOpenPopup(fakeElement({ attributes: { "aria-expanded": "false" } })),
    ).toBe(false);
  });

  it("is true when a popup is open inside the element", () => {
    expect(hasOpenPopup(fakeElement({ openPopup: true }))).toBe(true);
  });

  it("falls back to the expanded signal when the browser rejects the selector", () => {
    expect(
      hasOpenPopup(fakeElement({ throwsOnPopover: true, expandedChild: true })),
    ).toBe(true);
    expect(hasOpenPopup(fakeElement({ throwsOnPopover: true }))).toBe(false);
  });
});

describe("isTooltipSuppressed", () => {
  it("shows tooltips for ordinary controls", () => {
    expect(isTooltipSuppressed(fakeElement())).toBe(false);
  });

  it("suppresses disabled controls", () => {
    expect(
      isTooltipSuppressed(fakeElement({ attributes: { disabled: "" } })),
    ).toBe(true);
    expect(
      isTooltipSuppressed(
        fakeElement({ attributes: { "aria-disabled": "true" } }),
      ),
    ).toBe(true);
  });

  it("suppresses controls with an open popup", () => {
    expect(isTooltipSuppressed(fakeElement({ openPopup: true }))).toBe(true);
  });
});
