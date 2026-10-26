import type { NodeConfig, NodeKind } from "@diagramwise/simulation-core";

export type SimulationStatus =
  | "idle"
  | "running"
  | "paused"
  | "stale"
  | "invalid"
  | "completed"
  | "resource-limited"
  | "error";

export type SimulationTone = "neutral" | "healthy" | "warning" | "danger";

/** Kept structural so compiler diagnostics can be passed through unchanged. */
export type SimulationDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  action?: unknown;
};

export type SimulationSelectedNode = {
  id: string;
  label: string;
  kind?: NodeKind;
  config?: Partial<NodeConfig>;
  classification?: string;
  assumption?: string;
};

export const SIMULATION_STATUS_LABELS: Record<SimulationStatus, string> = {
  idle: "Ready to simulate",
  running: "Simulation running",
  paused: "Simulation paused",
  stale: "Design changed — restart to apply",
  invalid: "Check the highlighted connections",
  completed: "Run complete",
  "resource-limited": "Simulation limit reached",
  error: "Simulation stopped",
};
