import { describe, expect, it } from "vitest";
import { parseExtensionSource } from "./extensionImport";
import { splitSqlDefinitions, scanMermaidLine } from "./sourceScanning";
import { getPathPoints } from "./edgeLabelLayout";

describe("source scanning", () => {
  it("keeps nested SQL expressions and quoted commas in their definitions", () => {
    const definitions = [
      "id UUID PRIMARY KEY",
      "amount DECIMAL(10, 2)",
      "description TEXT DEFAULT 'it''s red, green'",
      '"display,name" TEXT',
      "[external,id] INT",
      "created_at TIMESTAMP DEFAULT fn(nested(1, 2), 3)",
    ];
    expect(splitSqlDefinitions(definitions.join(","))).toEqual(definitions);
  });

  it("imports SQL columns containing nested defaults", () => {
    const result = parseExtensionSource(
      "database-schema",
      `CREATE TABLE orders (
      id UUID PRIMARY KEY,
      amount DECIMAL(10, 2),
      description TEXT DEFAULT 'red, green',
      created_at TIMESTAMP DEFAULT fn(nested(1, 2), 3)
    );`,
    );
    expect(result.nodes[0].data.attributes).toHaveLength(4);
    expect(result.warnings).toEqual([]);
  });

  it("imports Mermaid shapes, labels, and connections without reading labels as nodes", () => {
    const result = parseExtensionSource(
      "mermaid",
      `flowchart LR
      client[Web Client] --> api[API Gateway]
      api -->|requests| service(Order Service)
      service --> db[(Orders DB)]
      db --> cache((Hot links))
      cache -.-> choice{Cache hit?}`,
    );
    expect(result.nodes).toHaveLength(6);
    expect(result.edges).toHaveLength(5);
    expect(result.edges[1].label).toBe("requests");
    expect(
      result.nodes.find((node) => node.data.extensionSourceKey === "client")
        ?.data.label,
    ).toBe("Web Client");
    expect(
      result.nodes.find((node) => node.data.extensionSourceKey === "api")?.data
        .componentId,
    ).toBe("api-gateway");
  });

  it("handles long malformed declarations without repeatedly scanning their suffixes", () => {
    const line = `a[${"unclosed[".repeat(20000)}`;
    expect(scanMermaidLine(line).declarations).toEqual([]);
    expect(() =>
      parseExtensionSource("mermaid", `flowchart LR\n${"a".repeat(100000)}`),
    ).toThrow("No Mermaid nodes");
  });

  it("reads signed, fractional, and quadratic SVG endpoints", () => {
    expect(
      getPathPoints("M-.5,-12.25 L10-5 Q 20 0 30.5 10 C40 20 50 20 60 10"),
    ).toEqual([
      { x: -0.5, y: -12.25 },
      { x: 10, y: -5 },
      { x: 30.5, y: 10 },
    ]);
  });

  it("ignores incomplete SVG commands and non-finite coordinates", () => {
    expect(getPathPoints(`M${"9".repeat(100000)} L10 Q1 2`)).toEqual([]);
  });
});
