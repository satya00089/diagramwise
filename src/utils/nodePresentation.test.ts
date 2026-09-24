import { describe, expect, it } from "vitest";
import { getNodeDisplayLabel } from "./nodePresentation";

describe("getNodeDisplayLabel", () => {
  it("prefers the explicit semantic label for MCP nodes", () => {
    expect(
      getNodeDisplayLabel({
        source: "diagramwise-mcp",
        label: "API Service",
        componentName: "Custom Component",
      }),
    ).toBe("API Service");
  });

  it("keeps the incumbent componentName precedence for existing diagrams", () => {
    expect(
      getNodeDisplayLabel({ label: "Stored label", componentName: "Component name" }),
    ).toBe("Component name");
  });

  it("falls back to a stable component identifier", () => {
    expect(getNodeDisplayLabel({ source: "diagramwise-mcp", componentId: "redis" })).toBe(
      "redis",
    );
  });
});
