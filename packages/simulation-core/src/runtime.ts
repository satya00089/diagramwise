import { Engine, type AdvanceResult, type SimulationObserver } from "./engine";
import type {
  FailureKind,
  FailureOpts,
  SimSnapshot,
  Topology,
  TrafficPattern,
} from "./types";
import { isNodeKind } from "./catalog";
import { defaultConfig } from "./presets";

export const ENGINE_VERSION = "event-v2" as const;
export const PROFILE_VERSION = "profiles-v1" as const;

export type SimulationCommand =
  | {
      type: "workload";
      rps: number;
      pattern?: TrafficPattern;
      clientIds?: string[];
    }
  | { type: "replicas"; nodeId: string; instances: number }
  | {
      type: "fault";
      nodeId: string;
      kind: FailureKind | "error";
      opts?: FailureOpts;
    }
  | { type: "clearFault"; nodeId: string };

export interface RecordedSimulationCommand {
  atMs: number;
  command: SimulationCommand;
}

export interface SimulationRuntime {
  readonly engine: Engine;
  readonly topology: Topology;
  advanceTo(targetMs: number, eventBudget?: number): AdvanceResult;
  snapshot(): SimSnapshot;
  applyCommand(command: SimulationCommand, effectiveSimTime?: number): void;
  setObserver(observer: SimulationObserver | null): void;
}

function cloneTopology(input: Topology): Topology {
  return {
    nodes: input.nodes.map((node) => ({ ...node, config: { ...node.config } })),
    edges: input.edges.map((edge) => ({ ...edge })),
    ...(input.annotations
      ? { annotations: structuredClone(input.annotations) }
      : {}),
  };
}

function assertFinite(
  value: number,
  label: string,
  min: number,
  max: number,
  integer = false,
): void {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new RangeError(
      `${label} must be ${integer ? "an integer " : ""}between ${min} and ${max}.`,
    );
  }
}

const REQUIRED_CONFIG_FIELDS = [
  "capacity",
  "serviceMs",
  "serviceCv",
  "queueLimit",
  "hitRate",
  "errorRate",
  "timeoutMs",
  "retries",
  "rps",
] as const;
const FRACTION_FIELDS = new Set([
  "hitRate",
  "errorRate",
  "targetUtil",
  "scaleStepPct",
  "errorThreshold",
  "readFraction",
  "hotKeyFraction",
  "rangeQueryFraction",
  "recallTarget",
  "authFailRate",
  "edgeShare",
  "lowPriorityShare",
  "priorityReserve",
]);
const POSITIVE_INTEGER_FIELDS = new Set([
  "capacity",
  "instances",
  "replicaCount",
  "shardCount",
  "shardCapacity",
  "partitions",
  "regions",
  "halfOpenProbes",
  "maxConcurrency",
  "bulkheadMax",
  "renditions",
  "batchSize",
  "traversalDepth",
  "minCapacity",
  "maxCapacity",
  "outlierAfter",
]);
const ZERO_INTEGER_FIELDS = new Set([
  "queueLimit",
  "retries",
  "activeRegion",
  "acquireQueueMax",
]);

const TRAFFIC_PATTERNS = new Set(["steady", "ramp", "spike", "diurnal"]);

function assertReplayNodeIdentity(
  node: Topology["nodes"][number],
  nodeIds: Set<string>,
): void {
  if (
    !node ||
    typeof node.id !== "string" ||
    node.id.length < 1 ||
    node.id.length > 200 ||
    nodeIds.has(node.id)
  )
    throw new TypeError(
      "Replay component identifiers must be unique strings of at most 200 characters.",
    );
}

function assertReplayNodeModel(node: Topology["nodes"][number]): void {
  if (
    !isNodeKind(node.kind) ||
    typeof node.label !== "string" ||
    node.label.length > 240 ||
    !Number.isFinite(node.x) ||
    !Number.isFinite(node.y) ||
    Math.abs(node.x) > 1_000_000 ||
    Math.abs(node.y) > 1_000_000
  ) {
    throw new TypeError(`Replay component “${node.id}” has an invalid model.`);
  }
}

function assertReplayNodeConfig(node: Topology["nodes"][number]): void {
  if (
    !node.config ||
    typeof node.config !== "object" ||
    Array.isArray(node.config)
  )
    throw new TypeError(`Replay component “${node.id}” has invalid settings.`);

  const config = node.config as unknown as Record<string, unknown>;
  const allowed = new Set([
    ...Object.keys(defaultConfig(node.kind)),
    "traffic",
    "trafficPeriodS",
    "bulkheadMode",
  ]);
  for (const required of REQUIRED_CONFIG_FIELDS)
    if (!(required in config))
      throw new TypeError(
        `Replay component “${node.id}” is missing ${required}.`,
      );
  for (const [key, value] of Object.entries(config)) {
    if (!allowed.has(key))
      throw new TypeError(
        `Replay component “${node.id}” has an unknown setting.`,
      );
    if (key === "traffic") {
      if (!TRAFFIC_PATTERNS.has(value as string))
        throw new TypeError(
          `Replay component “${node.id}” has an invalid traffic pattern.`,
        );
      continue;
    }
    if (key === "bulkheadMode") {
      if (value !== "wait" && value !== "reject")
        throw new TypeError(
          `Replay component “${node.id}” has an invalid bulkhead mode.`,
        );
      continue;
    }
    if (!isValidReplayConfigValue(key, value)) {
      throw new TypeError(
        `Replay component “${node.id}” has an invalid ${key} setting.`,
      );
    }
  }
  if (
    typeof config.minCapacity === "number" &&
    typeof config.maxCapacity === "number" &&
    config.minCapacity > config.maxCapacity
  )
    throw new TypeError(
      `Replay component “${node.id}” has an invalid scaling range.`,
    );
}

function isValidReplayConfigValue(key: string, value: unknown): boolean {
  return !(
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000 ||
    (FRACTION_FIELDS.has(key) && value > 1) ||
    (POSITIVE_INTEGER_FIELDS.has(key) &&
      (!Number.isInteger(value) || value < 1 || value > 512)) ||
    (ZERO_INTEGER_FIELDS.has(key) && !Number.isInteger(value)) ||
    (key === "retries" && value > 10) ||
    (key === "queueLimit" && value > 50_000) ||
    (key === "serviceCv" && value > 10) ||
    (key === "trafficPeriodS" && value < 0.1)
  );
}

function assertReplayEdge(
  edge: Topology["edges"][number],
  edgeIds: Set<string>,
  nodeIds: Set<string>,
): void {
  if (
    !edge ||
    typeof edge.id !== "string" ||
    edge.id.length < 1 ||
    edge.id.length > 200 ||
    edgeIds.has(edge.id) ||
    !nodeIds.has(edge.from) ||
    !nodeIds.has(edge.to) ||
    !Number.isFinite(edge.weight) ||
    edge.weight <= 0 ||
    edge.weight > 1_000_000 ||
    (edge.control !== undefined && typeof edge.control !== "boolean") ||
    (edge.latencyMs !== undefined &&
      (!Number.isFinite(edge.latencyMs) ||
        edge.latencyMs < 0 ||
        edge.latencyMs > 60_000))
  ) {
    throw new TypeError(
      "Replay connections must have unique identifiers, valid endpoints, and positive weights.",
    );
  }
}

/**
 * Protect worker entry points and imported replay files from malformed data.
 * The compiler produces this shape; this is a second boundary for data that
 * did not come from the compiler, such as a local JSON import.
 */
export function assertReplayTopology(
  input: unknown,
): asserts input is Topology {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("A replay needs a topology.");
  const topology = input as Partial<Topology>;
  if (
    !Array.isArray(topology.nodes) ||
    !Array.isArray(topology.edges) ||
    topology.nodes.length < 1 ||
    topology.nodes.length > 101 ||
    topology.edges.length > 201
  ) {
    throw new RangeError(
      "A replay supports one to 101 components and up to 201 connections.",
    );
  }
  const nodeIds = new Set<string>();
  for (const node of topology.nodes) {
    assertReplayNodeIdentity(node, nodeIds);
    assertReplayNodeModel(node);
    assertReplayNodeConfig(node);
    nodeIds.add(node.id);
  }
  if (!topology.nodes.some((node) => node.kind === "client"))
    throw new TypeError("A replay needs a traffic source.");
  const edgeIds = new Set<string>();
  for (const edge of topology.edges) {
    assertReplayEdge(edge, edgeIds, nodeIds);
    edgeIds.add(edge.id);
  }
}

export function createSimulation(input: Topology, seed = 1): SimulationRuntime {
  assertFinite(seed, "Seed", 0, 4_294_967_295, true);
  assertReplayTopology(input);
  const topology = cloneTopology(input);
  const engine = new Engine(topology, seed);
  return {
    engine,
    topology,
    advanceTo(targetMs, eventBudget = 20_000) {
      return engine.advanceTo(targetMs, eventBudget);
    },
    snapshot() {
      return engine.snapshot();
    },
    setObserver(observer) {
      engine.setObserver(observer);
    },
    applyCommand(command, effectiveSimTime = engine.now) {
      if (
        !Number.isFinite(effectiveSimTime) ||
        effectiveSimTime !== engine.now
      ) {
        throw new RangeError(
          "Commands must be applied at the current simulated time.",
        );
      }
      switch (command.type) {
        case "workload": {
          applyWorkloadCommand(engine, topology, command);
          return;
        }
        case "replicas":
          assertFinite(command.instances, "Instances", 1, 512, true);
          engine.updateNodeConfig(command.nodeId, {
            instances: command.instances,
          });
          return;
        case "fault":
          engine.injectFailure(
            command.nodeId,
            command.kind === "error" ? "errors" : command.kind,
            command.opts,
          );
          return;
        case "clearFault":
          engine.clearFailure(command.nodeId);
          return;
      }
    },
  };
}

function applyWorkloadCommand(
  engine: Engine,
  topology: Topology,
  command: Extract<SimulationCommand, { type: "workload" }>,
): void {
  assertFinite(command.rps, "Requests per second", 0, 100_000);
  if (command.pattern !== undefined && !TRAFFIC_PATTERNS.has(command.pattern)) {
    throw new RangeError("Unknown traffic pattern.");
  }
  const clients = topology.nodes.filter((node) => node.kind === "client");
  if (clients.length === 0)
    throw new Error("A workload needs a traffic source.");
  const clientIds = command.clientIds ?? clients.map((node) => node.id);
  if (!isValidClientSelection(clientIds, clients)) {
    throw new TypeError(
      "Workload client identifiers must refer to unique traffic sources.",
    );
  }
  const activeClientIds = new Set(clientIds);
  for (const node of clients) {
    engine.updateNodeConfig(node.id, {
      rps: activeClientIds.has(node.id)
        ? command.rps / activeClientIds.size
        : 0,
      ...(command.pattern ? { traffic: command.pattern } : {}),
    });
  }
}

function isValidClientSelection(
  clientIds: string[],
  clients: Topology["nodes"],
): boolean {
  return (
    Array.isArray(clientIds) &&
    clientIds.length > 0 &&
    clientIds.length <= clients.length &&
    new Set(clientIds).size === clientIds.length &&
    clientIds.every((id) => clients.some((node) => node.id === id))
  );
}
