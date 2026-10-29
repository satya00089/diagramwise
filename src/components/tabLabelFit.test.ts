import { describe, expect, it } from "vitest";
import { tabsShowingLabel } from "./tabLabelFit";

const ids = ["details", "simulation", "assessment", "guide", "inspector"];
// 5 icon-only tabs are 5*40 + 4*8 = 232px wide; each label adds its width.
const widths = new Map(ids.map((id) => [id, 70]));

describe("tabsShowingLabel", () => {
  it("shows every label when there is room", () => {
    expect(tabsShowingLabel(ids, "details", widths, 232 + 5 * 70)).toEqual(ids);
    expect(tabsShowingLabel(ids, "details", widths, 1000)).toEqual(ids);
  });

  it("shows only the active label when all do not fit", () => {
    expect(tabsShowingLabel(ids, "guide", widths, 232 + 5 * 70 - 1)).toEqual([
      "guide",
    ]);
    expect(tabsShowingLabel(ids, "guide", widths, 232 + 70)).toEqual(["guide"]);
  });

  it("falls back to icons only when not even one label fits", () => {
    expect(tabsShowingLabel(ids, "guide", widths, 232 + 70 - 1)).toEqual([]);
    expect(tabsShowingLabel(ids, "guide", widths, 232)).toEqual([]);
    expect(tabsShowingLabel(ids, "guide", widths, 100)).toEqual([]);
  });

  it("uses the active tab's own width, not an average", () => {
    const uneven = new Map(widths).set("assessment", 120);
    expect(tabsShowingLabel(ids, "assessment", uneven, 232 + 100)).toEqual([]);
    expect(tabsShowingLabel(ids, "details", uneven, 232 + 100)).toEqual([
      "details",
    ]);
  });

  it("handles a tab set that is missing tabs, such as free design mode", () => {
    const three = ["details", "simulation", "inspector"];
    expect(
      tabsShowingLabel(three, "details", widths, 3 * 40 + 2 * 8 + 3 * 70),
    ).toEqual(three);
  });
});
