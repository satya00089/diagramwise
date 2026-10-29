export type SimulationRole =
  | "client"
  | "ingress"
  | "compute"
  | "cache"
  | "database"
  | "queue"
  | "other";

export type SimulationOperation = "redirect" | "create-link";
export type SimulationInputProvenance = "educational-default" | "user";
export type SimulationCapacityRole =
  | "ingress"
  | "compute"
  | "cache"
  | "database";

export type SimulationPreparation = {
  contract_version: "1";
  scenario_id: "url-shortener-capacity";
  exercise_id: string;
  requirement_revision: string | null;
  status: "ready" | "blocked" | "needs_review";
  component_roles: Array<{
    node_id: string;
    role: SimulationRole;
    evidence: string;
  }>;
  connection_checks: Array<{
    edge_id: string;
    status: "supported" | "incompatible" | "uncertain";
    explanation: string;
  }>;
  routes: Array<{
    operation: SimulationOperation;
    node_ids: string[];
    edge_ids: string[];
    explanation: string;
  }>;
  assumptions: string[];
  unresolved: string[];
  summary: string;
  blockers: string[];
};

export type SimulationProfileCapacities = Record<
  SimulationCapacityRole,
  number
>;
export type SimulationProfileProvenance = Record<
  SimulationCapacityRole,
  SimulationInputProvenance
>;

export type SimulationInput = {
  scenarioId: "url-shortener-capacity";
  scenarioVersion: "1";
  modelVersion: "capacity-v1";
  requestRate: number;
  redirectSharePercent: number;
  cacheHitPercent: number;
  profileCapacities: SimulationProfileCapacities;
  provenance: {
    requestRate: SimulationInputProvenance;
    redirectSharePercent: SimulationInputProvenance;
    cacheHitPercent: SimulationInputProvenance;
    profileCapacities: SimulationProfileProvenance;
  };
};

export type SimulationNodeMetric = {
  nodeId: string;
  label: string;
  role: SimulationRole;
  redirectDemandPerSecond: number;
  createLinkDemandPerSecond: number;
  demandPerSecond: number;
  capacityPerSecond: number;
  utilization: number;
  unit: "requests/s" | "ops/s";
};

export type SimulationResult = {
  modelVersion: SimulationInput["modelVersion"];
  requestRate: number;
  redirectsPerSecond: number;
  linkCreationsPerSecond: number;
  cacheHitsPerSecond: number;
  cacheMissesPerSecond: number;
  databaseRedirectReadsPerSecond: number;
  databaseLinkWritesPerSecond: number;
  estimatedCapacityAtMixRequestsPerSecond: number;
  limitingNodeId: string;
  bottleneckNodeId: string | null;
  bottleneckDemandPerSecond: number;
  bottleneckCapacityPerSecond: number;
  nodeMetrics: SimulationNodeMetric[];
};

export type SimulationPreparedRouteSnapshot = {
  operation: SimulationOperation;
  nodeIds: string[];
  edgeIds: string[];
  nodeLabels: string[];
  explanation: string;
};

export type SimulationRunSnapshot = {
  input: SimulationInput;
  result: SimulationResult;
  graphFingerprint: string;
  preparationFingerprint: string;
  preparedRoutes: SimulationPreparedRouteSnapshot[];
  componentRoles: Array<{
    nodeId: string;
    label: string;
    role: SimulationRole;
  }>;
  exerciseId: string | null;
  requirementRevision: string | null;
};
