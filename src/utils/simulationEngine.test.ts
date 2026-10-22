import { describe, expect, it } from "vitest";
import type { SystemDesignSolution } from "../types/systemDesign";
import type { SimulationPreparation } from "../types/simulation";
import { runCapacitySimulation } from "./simulationEngine";

const solution: SystemDesignSolution = {
  components: [
    { id: "client", type: "client", label: "Clients", position: { x: 0, y: 0 }, properties: {} },
    { id: "gateway", type: "api-gateway", label: "API Gateway", position: { x: 0, y: 0 }, properties: {} },
    { id: "app", type: "microservice", label: "Application service", position: { x: 0, y: 0 }, properties: {} },
    { id: "cache", type: "cache", label: "Redis", position: { x: 0, y: 0 }, properties: {} },
    { id: "db", type: "database", label: "PostgreSQL", position: { x: 0, y: 0 }, properties: {} },
  ],
  connections: [],
  explanation: "",
  keyPoints: [],
};

const roles: SimulationPreparation["component_roles"] = [
  { node_id: "client", role: "client", evidence: "Client" },
  { node_id: "gateway", role: "ingress", evidence: "API gateway" },
  { node_id: "app", role: "compute", evidence: "Application service" },
  { node_id: "cache", role: "cache", evidence: "Redis" },
  { node_id: "db", role: "database", evidence: "PostgreSQL" },
];

const preparation = (
  readNodeIds: string[],
  writeNodeIds: string[],
): SimulationPreparation => ({
  status: "ready",
  component_roles: roles,
  connection_checks: [],
  routes: [
    {
      operation: "read",
      node_ids: readNodeIds,
      edge_ids: [],
      explanation: "Read route",
    },
    {
      operation: "write",
      node_ids: writeNodeIds,
      edge_ids: [],
      explanation: "Write route",
    },
  ],
  assumptions: [],
  unresolved: [],
  summary: "Prepared",
  blockers: [],
});

const input = {
  requestRate: 1000,
  readSharePercent: 95,
  cacheHitPercent: 0,
  durationSeconds: 30,
  profileCapacities: {
    ingress: 5000,
    compute: 1500,
    cache: 10000,
    database: 600,
  },
};

describe("runCapacitySimulation", () => {
  it("accounts for read and write demand and exposes a growing database backlog", () => {
    const result = runCapacitySimulation(
      solution,
      preparation(
        ["client", "gateway", "app", "db"],
        ["client", "gateway", "app", "db"],
      ),
      input,
    );

    const database = result.nodeMetrics.find((metric) => metric.nodeId === "db");
    expect(database?.demandPerSecond).toBe(1000);
    expect(database?.capacityPerSecond).toBe(600);
    expect(result.bottleneckNodeId).toBe("db");
    expect(result.maxSustainableRequestsPerSecond).toBe(600);
    expect(result.backlogGrowthPerSecond).toBe(400);
    expect(result.projectedBacklog).toBe(12_000);
    expect(result.timeline).toHaveLength(30);
  });

  it("reduces database reads only when the prepared read path includes a cache", () => {
    const result = runCapacitySimulation(
      solution,
      preparation(
        ["client", "gateway", "app", "cache", "db"],
        ["client", "gateway", "app", "db"],
      ),
      { ...input, cacheHitPercent: 90 },
    );

    const cache = result.nodeMetrics.find((metric) => metric.nodeId === "cache");
    const database = result.nodeMetrics.find((metric) => metric.nodeId === "db");
    expect(cache?.demandPerSecond).toBe(950);
    expect(database?.demandPerSecond).toBe(145);
    expect(result.bottleneckNodeId).toBeNull();
    expect(result.projectedBacklog).toBe(0);
  });

  it("does not produce metrics for a blocked preparation", () => {
    expect(() =>
      runCapacitySimulation(
        solution,
        { ...preparation([], []), status: "blocked" },
        input,
      ),
    ).toThrow("Prepare and validate the architecture");
  });
});
