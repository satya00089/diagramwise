import type { SystemDesignSolution } from "../types/systemDesign";
import type {
  SimulationInput,
  SimulationNodeMetric,
  SimulationOperation,
  SimulationPreparation,
  SimulationResult,
  SimulationRole,
} from "../types/simulation";

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
    !Number.isFinite(input.redirectSharePercent) ||
    input.redirectSharePercent < 0 ||
    input.redirectSharePercent > 100 ||
    !Number.isFinite(input.cacheHitPercent) ||
    input.cacheHitPercent < 0 ||
    input.cacheHitPercent > 100
  ) {
    throw new Error("Workload percentages must be between 0 and 100.");
  }
  if (
    Object.values(input.profileCapacities).some(
      (capacity) => !Number.isFinite(capacity) || capacity <= 0,
    )
  ) {
    throw new Error("Simulation profile capacities must be positive numbers.");
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
  if (
    preparation.routes.length !== 2 ||
    routesByOperation.size !== 2 ||
    !routesByOperation.has("redirect") ||
    !routesByOperation.has("create-link")
  ) {
    throw new Error("The prepared design must include both supported operation paths.");
  }
  const operationRates: Record<SimulationOperation, number> = {
    redirect: input.requestRate * (input.redirectSharePercent / 100),
    "create-link": input.requestRate * ((100 - input.redirectSharePercent) / 100),
  };
  const demandByNode = new Map<
    string,
    { redirect: number; createLink: number }
  >();
  let redirectCacheNodeId: string | null = null;

  for (const operation of ["redirect", "create-link"] as const) {
    const rate = operationRates[operation];
    const route = routesByOperation.get(operation);
    if (!route?.node_ids.length) {
      throw new Error(`The prepared design has no supported ${operation} route.`);
    }
    if (rate === 0) continue;

    let cacheSeen = false;
    for (const nodeId of route.node_ids) {
      const role = rolesByNode.get(nodeId);
      if (!role) {
        throw new Error("The prepared route references an unclassified component.");
      }
      if (!componentsById.has(nodeId)) {
        throw new Error("The prepared route references a missing component.");
      }
      if (role === "client") continue;

      let demand = rate;
      if (operation === "redirect" && role === "cache") {
        cacheSeen = true;
        redirectCacheNodeId = nodeId;
      }
      if (operation === "redirect" && role === "database" && cacheSeen) {
        demand *= 1 - input.cacheHitPercent / 100;
      }

      const nodeDemand = demandByNode.get(nodeId) ?? {
        redirect: 0,
        createLink: 0,
      };
      if (operation === "redirect") nodeDemand.redirect += demand;
      else nodeDemand.createLink += demand;
      demandByNode.set(nodeId, nodeDemand);
    }
  }

  const metrics: SimulationNodeMetric[] = Array.from(
    demandByNode,
    ([nodeId, demand]) => {
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
      const demandPerSecond = demand.redirect + demand.createLink;
      return {
        nodeId,
        label: component.label,
        role,
        redirectDemandPerSecond: demand.redirect,
        createLinkDemandPerSecond: demand.createLink,
        demandPerSecond,
        capacityPerSecond,
        utilization: demandPerSecond / capacityPerSecond,
        unit:
          role === "database" || role === "cache"
            ? ("ops/s" as const)
            : ("requests/s" as const),
      };
    },
  );

  const limitingMetric = metrics.reduce<SimulationNodeMetric | null>(
    (limiting, metric) =>
      !limiting || metric.utilization > limiting.utilization
        ? metric
        : limiting,
    null,
  );
  if (!limitingMetric || limitingMetric.utilization <= 0) {
    throw new Error("The prepared routes do not contain a modeled service component.");
  }

  const redirectsPerSecond = operationRates.redirect;
  const cacheHitRate = redirectCacheNodeId
    ? input.cacheHitPercent / 100
    : 0;
  const databaseRedirectReadsPerSecond = metrics
    .filter((metric) => metric.role === "database")
    .reduce((sum, metric) => sum + metric.redirectDemandPerSecond, 0);
  const databaseLinkWritesPerSecond = metrics
    .filter((metric) => metric.role === "database")
    .reduce((sum, metric) => sum + metric.createLinkDemandPerSecond, 0);

  return {
    modelVersion: input.modelVersion,
    requestRate: input.requestRate,
    redirectsPerSecond,
    linkCreationsPerSecond: operationRates["create-link"],
    cacheHitsPerSecond: redirectsPerSecond * cacheHitRate,
    cacheMissesPerSecond: redirectsPerSecond * (1 - cacheHitRate),
    databaseRedirectReadsPerSecond,
    databaseLinkWritesPerSecond,
    estimatedCapacityAtMixRequestsPerSecond:
      input.requestRate / limitingMetric.utilization,
    bottleneckNodeId:
      limitingMetric.utilization > 1 ? limitingMetric.nodeId : null,
    bottleneckDemandPerSecond: limitingMetric.demandPerSecond,
    bottleneckCapacityPerSecond: limitingMetric.capacityPerSecond,
    nodeMetrics: metrics.sort((a, b) => b.utilization - a.utilization),
  };
}
