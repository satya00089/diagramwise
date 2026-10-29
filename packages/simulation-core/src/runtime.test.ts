import { describe, expect, it } from "vitest";
import { compileGraph } from "./compiler";
import { createSimulation } from "./runtime";

describe("createSimulation", () => {
  it("preserves selected traffic clients when workload rates change", () => {
    const document = {
      nodes: [
        { id: "client-a", data: { simulation: { kind: "client" } } },
        { id: "client-b", data: { simulation: { kind: "client" } } },
        { id: "api-a", data: { simulation: { kind: "service" } } },
        { id: "api-b", data: { simulation: { kind: "service" } } },
      ],
      edges: [
        { id: "a-api", source: "client-a", target: "api-a" },
        { id: "b-api", source: "client-b", target: "api-b" },
      ],
    };
    const compilation = compileGraph(document);
    if (!compilation.topology)
      throw new Error("Expected a valid compiled topology.");

    const distributedRuntime = createSimulation(compilation.topology);

    distributedRuntime.applyCommand({ type: "workload", rps: 1 });
    distributedRuntime.advanceTo(60_001);
    expect(
      distributedRuntime.snapshot().nodes["api-a"].totalCompleted,
    ).toBeGreaterThan(0);
    expect(
      distributedRuntime.snapshot().nodes["api-b"].totalCompleted,
    ).toBeGreaterThan(0);

    const selectedCompilation = compileGraph(
      {
        ...document,
        nodes: document.nodes.map((node) =>
          node.id === "client-b"
            ? {
                ...node,
                data: {
                  ...node.data,
                  simulation: { ...node.data.simulation, entrypoint: true },
                },
              }
            : node,
        ),
      },
      { requestRate: 1 },
    );
    if (!selectedCompilation.topology)
      throw new Error("Expected a valid selected-client topology.");
    const selectedRuntime = createSimulation(selectedCompilation.topology);
    selectedRuntime.applyCommand({
      type: "workload",
      rps: 1,
      clientIds: ["client-b"],
    });
    selectedRuntime.advanceTo(60_001);
    expect(selectedRuntime.snapshot().nodes["api-a"].totalCompleted).toBe(0);
    expect(
      selectedRuntime.snapshot().nodes["api-b"].totalCompleted,
    ).toBeGreaterThan(0);
  });

  it("rejects workload commands with invalid traffic client identifiers", () => {
    const compilation = compileGraph({
      nodes: [
        { id: "client", data: { simulation: { kind: "client" } } },
        { id: "api", data: { simulation: { kind: "service" } } },
      ],
      edges: [{ id: "client-api", source: "client", target: "api" }],
    });
    if (!compilation.topology)
      throw new Error("Expected a valid compiled topology.");

    const runtime = createSimulation(compilation.topology);
    expect(() =>
      runtime.applyCommand({
        type: "workload",
        rps: 100,
        clientIds: ["missing"],
      }),
    ).toThrow("unique traffic sources");
  });
});
