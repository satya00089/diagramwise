import type { SystemDesignSolution } from "../types/systemDesign";
import type {
  SimulationInput,
  SimulationOperation,
  SimulationPreparation,
  SimulationResult,
  SimulationRole,
} from "../types/simulation";

const DEFAULT_DURATION_SECONDS = 30;

function capacityForRole(
  role: SimulationRole,
  capacities: SimulationInput["profileCapacities"],
): number | null {
  if (role === "client" || role === "other" || role === "queue") return null;
  return capacities[role];
}

export function runCapacitySimulation(
  solution: SystemDesignSolution,
  preparation: SimulationPreparation,
  input: SimulationInput,
): SimulationResult {
  if (preparation.status !== "ready") {
    throw new Error("Prepare and validate the architecture before running it.");
  }
  if (!Number.isFinite(input.requestRate) || input.requestRate <= 0) {
    throw new Error("Incoming traffic must be greater than zero requests per second.");
  }
  if (
    input.readSharePercent < 0 ||
    input.readSharePercent > 100 ||
    input.cacheHitPercent < 0 ||
    input.cacheHitPercent > 100
  ) {
    throw new Error("Workload percentages must be between 0 and 100.");
  }
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds < 1 ||
    Object.values(input.profileCapacities).some(
      (capacity) => !Number.isFinite(capacity) || capacity <= 0,
    )
  ) {
    throw new Error("Simulation profiles and duration must be positive numbers.");
  }

  const rolesByNode = new Map(
    preparation.component_roles.map(({ node_id, role }) => [node_id, role]),
  );
  const componentsById = new Map(
    solution.components.map((component) => [component.id, component]),
  );
  const routesByOperation = new Map(
    preparation.routes.map((route) => [route.operation, route]),
  );
  const operationRates: Record<SimulationOperation, number> = {
    read: input.requestRate * (input.readSharePercent / 100),
    write: input.requestRate * ((100 - input.readSharePercent) / 100),
  };
  const demandByNode = new Map<string, number>();

  for (const operation of ["read", "write"] as const) {
    const rate = operationRates[operation];
    if (rate === 0) continue;
    const route = routesByOperation.get(operation);
    if (!route?.node_ids.length) {
      throw new Error(`The prepared design has no supported ${operation} route.`);
    }

    let cacheSeen = false;
    for (const nodeId of route.node_ids) {
      const role = rolesByNode.get(nodeId);
      if (!role) {
        throw new Error("The prepared route references an unclassified component.");
      }
      let demand = rate;
      if (role === "client") continue;
      if (operation === "read" && role === "cache") cacheSeen = true;
      if (operation === "read" && role === "database" && cacheSeen) {
        demand *= 1 - input.cacheHitPercent / 100;
      }
      demandByNode.set(nodeId, (demandByNode.get(nodeId) ?? 0) + demand);
    }
  }

  const metrics = Array.from(demandByNode, ([nodeId, demandPerSecond]) => {
    const role = rolesByNode.get(nodeId)!;
    const capacityPerSecond = capacityForRole(
      role,
      input.profileCapacities,
    );
    if (capacityPerSecond == null) {
      throw new Error(
        "The prepared route contains a component without a supported capacity profile.",
      );
    }
    const component = componentsById.get(nodeId);
    if (!component) {
      throw new Error("The prepared route references a missing component.");
    }
    return {
      nodeId,
      label: component.label,
      role,
      demandPerSecond,
      capacityPerSecond,
      utilization: demandPerSecond / capacityPerSecond,
      unit:
        role === "database" || role === "cache"
          ? ("ops/s" as const)
          : ("requests/s" as const),
    };
  });

  const limitingMetric = metrics.reduce<typeof metrics[number] | null>(
    (limiting, metric) =>
      !limiting || metric.utilization > limiting.utilization
        ? metric
        : limiting,
    null,
  );
  const scale = Math.min(1, 1 / (limitingMetric?.utilization ?? 1));
  const maxSustainableRequestsPerSecond = input.requestRate * scale;
  const backlogGrowthPerSecond = limitingMetric
    ? Math.max(
        0,
        limitingMetric.demandPerSecond - limitingMetric.capacityPerSecond,
      )
    : 0;
  const durationSeconds = Math.max(
    1,
    Math.min(DEFAULT_DURATION_SECONDS, Math.round(input.durationSeconds)),
  );
  const timeline = Array.from({ length: durationSeconds }, (_, index) => {
    const second = index + 1;
    return {
      second,
      offeredRequestsPerSecond: input.requestRate,
      servedRequestsPerSecond: maxSustainableRequestsPerSecond,
      backlog: backlogGrowthPerSecond * second,
    };
  });

  return {
    durationSeconds,
    totalRequests: input.requestRate * durationSeconds,
    maxSustainableRequestsPerSecond,
    bottleneckNodeId:
      limitingMetric && limitingMetric.utilization > 1
        ? limitingMetric.nodeId
        : null,
    bottleneckDemandPerSecond: limitingMetric?.demandPerSecond ?? 0,
    bottleneckCapacityPerSecond: limitingMetric?.capacityPerSecond ?? 0,
    backlogGrowthPerSecond,
    projectedBacklog: backlogGrowthPerSecond * durationSeconds,
    nodeMetrics: metrics.sort((a, b) => b.utilization - a.utilization),
    timeline,
  };
}
