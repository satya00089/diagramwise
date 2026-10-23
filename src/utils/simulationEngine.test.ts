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
  connections: [
    { id: "client-gateway", source: "client", target: "gateway", type: "http" },
    { id: "gateway-app", source: "gateway", target: "app", type: "http" },
    { id: "app-cache", source: "app", target: "cache", type: "tcp" },
    { id: "cache-db", source: "cache", target: "db", type: "tcp" },
    { id: "app-db", source: "app", target: "db", type: "tcp" },
  ],
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
  redirectNodeIds: string[],
  createLinkNodeIds: string[],
): SimulationPreparation => ({
  status: "ready",
  contract_version: "1",
  scenario_id: "url-shortener-capacity",
  exercise_id: "url-shortener-exercise",
  requirement_revision: null,
  component_roles: roles,
  connection_checks: solution.connections.map(({ id }) => ({
    edge_id: id,
    status: "supported",
    explanation: "Valid directed connection",
  })),
  routes: [
    {
      operation: "redirect",
      node_ids: redirectNodeIds,
      edge_ids: redirectNodeIds.slice(1).map((nodeId, index) =>
        `${redirectNodeIds[index]}-${nodeId}`,
      ),
      explanation: "Redirect route",
    },
    {
      operation: "create-link",
      node_ids: createLinkNodeIds,
      edge_ids: createLinkNodeIds.slice(1).map((nodeId, index) =>
        `${createLinkNodeIds[index]}-${nodeId}`,
      ),
      explanation: "Create-link route",
    },
  ],
  assumptions: [],
  unresolved: [],
  summary: "Prepared",
  blockers: [],
});

const input = {
  scenarioId: "url-shortener-capacity" as const,
  scenarioVersion: "1" as const,
  modelVersion: "capacity-v1" as const,
  requestRate: 1000,
  redirectSharePercent: 95,
  cacheHitPercent: 0,
  profileCapacities: {
    ingress: 5000,
    compute: 1500,
    cache: 10000,
    database: 600,
  },
  provenance: {
    requestRate: "educational-default" as const,
    redirectSharePercent: "educational-default" as const,
    cacheHitPercent: "educational-default" as const,
    profileCapacities: {
      ingress: "educational-default" as const,
      compute: "educational-default" as const,
      cache: "educational-default" as const,
      database: "educational-default" as const,
    },
  },
};

describe("runCapacitySimulation", () => {
  it("accounts for redirect reads and create-link writes at shared capacity", () => {
    const result = runCapacitySimulation(
      solution,
      preparation(
        ["client", "gateway", "app", "db"],
        ["client", "gateway", "app", "db"],
      ),
      input,
    );

    const database = result.nodeMetrics.find((metric) => metric.nodeId === "db");
    expect(database?.redirectDemandPerSecond).toBe(950);
    expect(database?.createLinkDemandPerSecond).toBe(50);
    expect(database?.capacityPerSecond).toBe(600);
    expect(result.databaseRedirectReadsPerSecond).toBe(950);
    expect(result.databaseLinkWritesPerSecond).toBe(50);
    expect(result.bottleneckNodeId).toBe("db");
    expect(result.estimatedCapacityAtMixRequestsPerSecond).toBe(600);
  });

  it("reduces database reads only when the redirect path includes a cache", () => {
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
    expect(cache?.redirectDemandPerSecond).toBe(950);
    expect(database?.redirectDemandPerSecond).toBe(95);
    expect(database?.createLinkDemandPerSecond).toBe(50);
    expect(result.cacheHitsPerSecond).toBe(855);
    expect(result.cacheMissesPerSecond).toBe(95);
    expect(result.databaseRedirectReadsPerSecond).toBe(95);
    expect(result.bottleneckNodeId).toBeNull();
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
