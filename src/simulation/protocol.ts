import type {
  SimSnapshot,
  Topology,
  TrafficPattern,
  FailureKind,
  FailureOpts,
} from "@diagramwise/simulation-core";

export type RunCommand =
  | {
      type: "workload";
      rps: number;
      pattern?: TrafficPattern;
      clientIds?: string[];
    }
  | { type: "replicas"; nodeId: string; instances: number }
  | { type: "fault"; nodeId: string; kind: FailureKind; opts?: FailureOpts }
  | { type: "clearFault"; nodeId: string };
export type RecordedCommand = { atMs: number; command: RunCommand };
export type WorkerRequest =
  | {
      type: "start";
      runId: string;
      topology: Topology;
      seed: number;
      speed: number;
      replay?: RecordedCommand[];
    }
  | { type: "pause" | "resume"; runId: string }
  | { type: "speed"; runId: string; speed: number }
  | { type: "command"; runId: string; command: RunCommand };
export type WorkerResponse =
  | {
      type: "snapshot";
      runId: string;
      sequence: number;
      snapshot: SimSnapshot;
      commands: RecordedCommand[];
      achievedSpeed: number;
      status: "running" | "paused" | "resource-limited";
    }
  | { type: "error"; runId: string; message: string };

export type SimulationScope = {
  designId: string;
  canvasId: string;
  exerciseId: string | null;
};
export type EventRunArtifact = {
  contractVersion: "2";
  engineVersion: "event-v1" | "event-v2";
  profileVersion: "profiles-v1";
  scope: SimulationScope;
  graphFingerprint: string;
  topology: Topology;
  workload: { rps: number; pattern: TrafficPattern; seed: number };
  commands: RecordedCommand[];
  result?: {
    timeMs: number;
    offeredRps: number;
    goodputRps: number;
    errorRate: number;
    p50: number;
    p95: number;
    p99: number;
    totalRequests: number;
    totalFailed: number;
    status: "complete" | "incomplete";
  };
};
