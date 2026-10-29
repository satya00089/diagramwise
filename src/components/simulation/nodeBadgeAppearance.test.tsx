import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SimulationNodeBadge } from "./SimulationNodeBadge";
import { getContrastForeground, getNodeBadgeAppearance } from "./nodeBadgeAppearance";

describe("simulation badge appearance", () => {
  it("leaves theme colors in control when the node has no custom colors", () => {
    expect(getNodeBadgeAppearance({ backgroundColor: "", borderColor: " ", textColor: "" }))
      .toEqual({ style: {}, customForeground: false });
  });

  it("applies each node appearance color to the rendered badge", () => {
    const html = renderToStaticMarkup(<SimulationNodeBadge running={false} label="Cache" appearance={{
      backgroundColor: "#ffedd5", borderColor: "#fb923c", textColor: "#7c2d12",
    }} />);
    expect(html).toContain("--sim-badge-background:#ffedd5");
    expect(html).toContain("--sim-badge-border:#fb923c");
    expect(html).toContain("--sim-badge-foreground:#7c2d12");
    expect(html).toContain("data-custom-foreground");
    expect(html).toContain("Waiting for traffic");
  });

  it("chooses a contrasting foreground for custom opaque fills without a text color", () => {
    expect(getNodeBadgeAppearance({ backgroundColor: "#ffedd5" }).style["--sim-badge-foreground"]).toBe("#000000");
    expect(getNodeBadgeAppearance({ backgroundColor: "#112233" }).style["--sim-badge-foreground"]).toBe("#ffffff");
    expect(getNodeBadgeAppearance({ backgroundColor: "rgba(255, 237, 213, 1)" }).style["--sim-badge-foreground"]).toBe("#000000");
  });

  it("keeps separately supplied colors independent", () => {
    expect(getNodeBadgeAppearance({ borderColor: "#f80" })).toEqual({
      style: { "--sim-badge-border": "#f80" }, customForeground: false,
    });
    expect(getNodeBadgeAppearance({ backgroundColor: "#111", textColor: "#abcdef" }).style["--sim-badge-foreground"]).toBe("#abcdef");
  });

  it("chooses contrast against translucent fills and the actual theme beneath them", () => {
    const translucent = "rgba(255, 255, 255, 0.2)";
    expect(getContrastForeground([translucent, translucent, "rgb(15, 15, 15)"])).toBe("#ffffff");
    expect(getContrastForeground([translucent, translucent, "rgb(255, 255, 255)"])).toBe("#000000");
    expect(getContrastForeground(["rgba(255, 255, 255, 0.9)", "rgb(15, 15, 15)"])).toBe("#000000");
    expect(getContrastForeground(["#ffffffe6", "#000000"])).toBe("#000000");
  });
});
