export type SimulationRole =
  | "client"
  | "ingress"
  | "compute"
  | "cache"
  | "database"
  | "queue"
  | "other";

export type SimulationOperation = "read" | "write";

export type SimulationPreparation = {
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

export type SimulationProfileCapacities = {
  ingress: number;
  compute: number;
  cache: number;
  database: number;
};

export type SimulationInput = {
  requestRate: number;
  readSharePercent: number;
  cacheHitPercent: number;
  durationSeconds: number;
  profileCapacities: SimulationProfileCapacities;
};

export type SimulationNodeMetric = {
  nodeId: string;
  label: string;
  role: SimulationRole;
  demandPerSecond: number;
  capacityPerSecond: number;
  utilization: number;
  unit: "requests/s" | "ops/s";
};

export type SimulationTimelinePoint = {
  second: number;
  offeredRequestsPerSecond: number;
  servedRequestsPerSecond: number;
  backlog: number;
};

export type SimulationResult = {
  durationSeconds: number;
  totalRequests: number;
  maxSustainableRequestsPerSecond: number;
  bottleneckNodeId: string | null;
  bottleneckDemandPerSecond: number;
  bottleneckCapacityPerSecond: number;
  backlogGrowthPerSecond: number;
  projectedBacklog: number;
  nodeMetrics: SimulationNodeMetric[];
  timeline: SimulationTimelinePoint[];
};
