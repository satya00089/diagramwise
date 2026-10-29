import { defaultConfig } from "./presets";
import type {
  NodeConfig,
  NodeKind,
  SimEdge,
  SimNode,
  Topology,
  TrafficPattern,
} from "./types";
import {
  isNodeKind,
  PROFILE_VERSION,
  resolveCatalogProfile,
  type CatalogProfile,
} from "./catalog";
import { behaviourFor } from "./behaviour";

/** A structural adapter input: no React or editor package belongs in the core. */
export interface CanvasSimulationNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}
export interface CanvasSimulationEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown>;
}
export interface SimulationDocument {
  nodes: readonly CanvasSimulationNode[];
  edges: readonly CanvasSimulationEdge[];
}
export interface CompileOptions {
  requestRate?: number;
  traffic?: TrafficPattern;
  entryNodeId?: string;
}
export interface SimulationDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  action?:
    | "choose-model"
    | "choose-entrypoint"
    | "fix-connection"
    | "configure-model";
}
export interface CompiledSimulation {
  topology: Topology | null;
  diagnostics: SimulationDiagnostic[];
  profiles: Record<string, CatalogProfile>;
  fingerprint: string;
  virtualSourceId?: string;
  trafficSource: CompiledTrafficSource;
}
export interface CompiledTrafficSource {
  mode: "ingress" | "clients" | "scheduled" | "none";
  options: Array<{ id: string; label: string; kind: NodeKind }>;
  selectedNodeId?: string;
  inferredNodeId?: string;
  requiresSelection: boolean;
}

const patterns: readonly TrafficPattern[] = [
  "steady",
  "ramp",
  "spike",
  "diurnal",
];
const structuralTypes = new Set([
  "group",
  "erNode",
  "tableNode",
  "dataModelNode",
  "freeform",
]);
const bufferedKinds = new Set<NodeKind>([
  "queue",
  "pubsub",
  "streambroker",
  "retryqueue",
  "writebehind",
]);
const scalableKinds = new Set<NodeKind>([
  "service",
  "worker",
  "db",
  "cache",
  "lb",
  "cdn",
  "shard",
]);
const fractions = new Set([
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
const positiveIntegers = new Set([
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
const zeroIntegers = new Set([
  "queueLimit",
  "retries",
  "activeRegion",
  "acquireQueueMax",
]);
const own = (object: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(object, key);
const compareStrings = (left: string, right: string) =>
  left.localeCompare(right);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Change detection only; this is not a signature or a security boundary. */
function trafficSourceOptions(
  nodes: SimNode[],
): CompiledTrafficSource["options"] {
  const labelCounts = new Map<string, number>();
  for (const node of nodes) {
    const key = node.label.toLocaleLowerCase();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  const duplicateLabels = new Set(
    [...labelCounts].filter(([, count]) => count > 1).map(([label]) => label),
  );
  return nodes.map((node) => ({
    id: node.id,
    label: duplicateLabels.has(node.label.toLocaleLowerCase())
      ? `${node.label} (${node.id})`
      : node.label,
    kind: node.kind,
  }));
}

function fingerprint(value: unknown): string {
  const text = canonical(value);
  return [2166136261, 2246822519, 3266489917, 668265263]
    .map((seed) => {
      let hash = seed;
      for (let i = 0; i < text.length; i++)
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
      return (hash >>> 0).toString(16).padStart(8, "0");
    })
    .join("");
}

function compileConfig(
  kind: NodeKind,
  input: unknown,
  nodeId: string,
  diagnostics: SimulationDiagnostic[],
): NodeConfig {
  const defaults = defaultConfig(kind);
  const result = { ...defaults } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(record(input))) {
    if (!own(defaults, key) && key !== "traffic" && key !== "trafficPeriodS") {
      diagnostics.push({
        severity: "error",
        code: "unknown-config",
        nodeId,
        action: "configure-model",
        message: `The ${kind} model does not support the setting “${key}”.`,
      });
      continue;
    }
    const invalid =
      key === "traffic"
        ? !patterns.includes(value as TrafficPattern)
        : key === "bulkheadMode"
          ? value !== "wait" && value !== "reject"
          : typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > 1_000_000 ||
            (fractions.has(key) && value > 1) ||
            (positiveIntegers.has(key) &&
              (!Number.isInteger(value) || value < 1 || value > 512)) ||
            (zeroIntegers.has(key) && !Number.isInteger(value)) ||
            (key === "retries" && value > 10) ||
            (key === "queueLimit" && value > 50_000) ||
            (key === "serviceCv" && value > 10) ||
            (key === "trafficPeriodS" && value < 0.1);
    if (invalid)
      diagnostics.push({
        severity: "error",
        code: "invalid-config",
        nodeId,
        action: "configure-model",
        message: `Enter a valid ${key} value for the ${kind} model.`,
      });
    else result[key] = value;
  }
  if (
    typeof result.minCapacity === "number" &&
    typeof result.maxCapacity === "number" &&
    result.minCapacity > result.maxCapacity
  ) {
    diagnostics.push({
      severity: "error",
      code: "invalid-scale-range",
      nodeId,
      action: "configure-model",
      message: "Minimum instances cannot exceed maximum instances.",
    });
  }
  return result as unknown as NodeConfig;
}

/** Compile explicit diagram semantics. Presentation-only changes leave the fingerprint unchanged. */
export function compileGraph(
  document: SimulationDocument,
  options: CompileOptions = {},
): CompiledSimulation {
  const diagnostics: SimulationDiagnostic[] = [];
  const profiles: Record<string, CatalogProfile> = Object.create(null);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const modeled = new Map<string, SimNode>();
  const structural = new Set<string>();
  const explicitEntries = new Set<string>();
  const rate = options.requestRate ?? 100;
  const traffic = options.traffic ?? "steady";
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100_000 ||
    !patterns.includes(traffic)
  ) {
    diagnostics.push({
      severity: "error",
      code: "invalid-workload",
      message:
        "Choose a traffic pattern and a request rate between 0 and 100,000 requests/sec.",
    });
  }

  // Reordering React Flow arrays must not change seeded routing order.
  for (const node of [...document.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!node.id || node.id.length > 200 || nodeIds.has(node.id)) {
      diagnostics.push({
        severity: "error",
        code: "invalid-node-id",
        nodeId: node.id,
        message:
          "Components need unique, non-empty identifiers of at most 200 characters.",
      });
      continue;
    }
    nodeIds.add(node.id);
    const data = record(node.data);
    const settings = record(data.simulation);
    const componentId =
      typeof data.componentId === "string"
        ? data.componentId
        : typeof data.architectureType === "string"
          ? data.architectureType
          : "";
    let profile = resolveCatalogProfile(componentId);
    if (settings.kind !== undefined) {
      if (isNodeKind(settings.kind))
        profile = {
          componentId,
          kind: settings.kind,
          classification: "generic",
          assumption: `Explicit ${settings.kind} model chosen for this component; its settings are educational assumptions.`,
        };
      else
        diagnostics.push({
          severity: "error",
          code: "unknown-model",
          nodeId: node.id,
          action: "choose-model",
          message: "Choose a supported behavior model for this component.",
        });
    } else if (structuralTypes.has(node.type ?? "")) {
      profile = {
        componentId,
        classification: "structural",
        assumption:
          "A documentation shape or container; it does not execute requests.",
      };
    }
    profiles[node.id] = profile;
    if (profile.classification === "structural") {
      structural.add(node.id);
      continue;
    }
    if (!profile.kind) continue;
    if (settings.entrypoint === true) explicitEntries.add(node.id);
    modeled.set(node.id, {
      id: node.id,
      kind: profile.kind,
      label:
        typeof data.label === "string"
          ? data.label.slice(0, 200)
          : componentId || profile.kind,
      x: Number.isFinite(node.position?.x) ? node.position!.x : 0,
      y: Number.isFinite(node.position?.y) ? node.position!.y : 0,
      config: compileConfig(
        profile.kind,
        settings.config,
        node.id,
        diagnostics,
      ),
    });
    if (profile.classification === "generic")
      diagnostics.push({
        severity: "info",
        code: "generic-profile",
        nodeId: node.id,
        message: profile.assumption,
      });
  }

  const edges: SimEdge[] = [];
  const connectedUnknown = new Set<string>();
  for (const edge of [...document.edges].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!edge.id || edge.id.length > 200 || edgeIds.has(edge.id)) {
      diagnostics.push({
        severity: "error",
        code: "invalid-edge-id",
        edgeId: edge.id,
        message:
          "Connections need unique, non-empty identifiers of at most 200 characters.",
      });
      continue;
    }
    edgeIds.add(edge.id);
    const settings = record(record(edge.data).simulation);
    if (settings.mode === "annotation") continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      diagnostics.push({
        severity: "error",
        code: "missing-endpoint",
        edgeId: edge.id,
        action: "fix-connection",
        message: "Reconnect or remove this connection: an endpoint is missing.",
      });
      continue;
    }
    if (structural.has(edge.source) || structural.has(edge.target)) {
      diagnostics.push({
        severity: "info",
        code: "documentation-connection",
        edgeId: edge.id,
        message:
          "This connection touches a documentation symbol and carries no simulated requests.",
      });
      continue;
    }
    const source = modeled.get(edge.source);
    const target = modeled.get(edge.target);
    if (!source || !target) {
      if (!source) connectedUnknown.add(edge.source);
      if (!target) connectedUnknown.add(edge.target);
      continue;
    }
    const mode =
      settings.mode ?? (source.kind === "autoscaler" ? "control" : "request");
    if (!["request", "async", "control"].includes(String(mode))) {
      diagnostics.push({
        severity: "error",
        code: "unknown-connection-mode",
        edgeId: edge.id,
        action: "fix-connection",
        message:
          "Choose request, async, control, or annotation for this connection.",
      });
      continue;
    }
    if (
      mode === "async" &&
      !bufferedKinds.has(source.kind) &&
      !bufferedKinds.has(target.kind)
    ) {
      diagnostics.push({
        severity: "error",
        code: "async-needs-buffer",
        edgeId: edge.id,
        action: "fix-connection",
        message:
          "An asynchronous connection needs a queue, broker, or asynchronous delivery model at an endpoint.",
      });
    }
    if (
      mode === "control" &&
      (source.kind !== "autoscaler" || !scalableKinds.has(target.kind))
    ) {
      diagnostics.push({
        severity: "error",
        code: "invalid-control-edge",
        edgeId: edge.id,
        action: "fix-connection",
        message:
          "A control connection must link an autoscaler to a scalable component.",
      });
    }
    if (target.kind === "client" || target.kind === "autoscaler") {
      diagnostics.push({
        severity: "error",
        code: "invalid-request-target",
        edgeId: edge.id,
        action: "fix-connection",
        message:
          "Traffic sources and autoscalers cannot receive application requests. Mark response/documentation arrows as annotations.",
      });
    }
    const weight = settings.weight ?? 1;
    const latencyMs = settings.latencyMs ?? 0;
    if (
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 1_000_000 ||
      typeof latencyMs !== "number" ||
      !Number.isFinite(latencyMs) ||
      latencyMs < 0 ||
      latencyMs > 60_000
    ) {
      diagnostics.push({
        severity: "error",
        code: "invalid-link-settings",
        edgeId: edge.id,
        action: "fix-connection",
        message:
          "Connection weight must be positive, and delay must be between 0 and 60,000 ms.",
      });
      continue;
    }
    edges.push({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      weight,
      latencyMs,
      ...(mode === "control" ? { control: true } : {}),
    });
  }
  for (const id of nodeIds) {
    if (!modeled.has(id) && !structural.has(id))
      diagnostics.push({
        severity: connectedUnknown.has(id) ? "error" : "warning",
        code: "unmodeled-component",
        nodeId: id,
        action: "choose-model",
        message: connectedUnknown.has(id)
          ? "Choose a behavior model for this component before simulating this request path."
          : "This unconnected component has no behavior model and is excluded from the run.",
      });
  }

  if (modeled.size > 100 || edges.length > 200)
    diagnostics.push({
      severity: "error",
      code: "graph-limit",
      message:
        "This release supports up to 100 executable components and 200 executable connections per run.",
    });
  let virtualSourceId: string | undefined;
  const sources = [...modeled.values()].filter(
    (node) => node.kind === "client" || node.kind === "cron",
  );
  if (options.entryNodeId) explicitEntries.add(options.entryNodeId);
  let trafficSource: CompiledTrafficSource = {
    mode: "none",
    options: [],
    requiresSelection: false,
  };
  const physicalClients = sources.filter((node) => node.kind === "client");
  const scheduledSources = sources.filter((node) => node.kind === "cron");
  if (physicalClients.length > 0) {
    const selectedClients = physicalClients.filter((node) =>
      explicitEntries.has(node.id),
    );
    const requiresSelection = selectedClients.length > 1;
    if (requiresSelection) {
      diagnostics.push({
        severity: "error",
        code: "ambiguous-entrypoint",
        action: "choose-entrypoint",
        message:
          "Choose one traffic client, or distribute the request rate across all clients.",
      });
    }
    trafficSource = {
      mode: "clients",
      options: trafficSourceOptions(physicalClients),
      ...(selectedClients.length === 1
        ? { selectedNodeId: selectedClients[0].id }
        : {}),
      requiresSelection,
    };
  } else if (scheduledSources.length > 0) {
    trafficSource = {
      mode: "scheduled",
      options: trafficSourceOptions(scheduledSources),
      requiresSelection: false,
    };
  } else if (sources.length === 0 && modeled.size > 0) {
    const inbound = new Set(
      edges.filter((edge) => !edge.control).map((edge) => edge.to),
    );
    const candidates = [...modeled.values()].filter(
      (node) => node.kind !== "autoscaler" && !inbound.has(node.id),
    );
    const options = [...modeled.values()].filter(
      (node) => node.kind !== "autoscaler",
    );
    const selectedEntries = [...explicitEntries]
      .map((id) => modeled.get(id))
      .filter((node): node is SimNode => !!node && node.kind !== "autoscaler");
    const entries = explicitEntries.size > 0 ? selectedEntries : candidates;
    const entry =
      entries.length === 1 &&
      (explicitEntries.size === 0 || explicitEntries.size === 1)
        ? entries[0]
        : undefined;
    trafficSource = {
      mode: "ingress",
      options: trafficSourceOptions(options),
      ...(explicitEntries.size === 1 && selectedEntries[0]
        ? { selectedNodeId: selectedEntries[0].id }
        : {}),
      ...(explicitEntries.size === 0 && entry
        ? { inferredNodeId: entry.id }
        : {}),
      requiresSelection: !entry,
    };
    if (entry) {
      virtualSourceId = "__simulation_source__";
      while (nodeIds.has(virtualSourceId)) virtualSourceId += "_";
      const sourceEdgeId = `${virtualSourceId}:entry`;
      if (edgeIds.has(sourceEdgeId))
        diagnostics.push({
          severity: "error",
          code: "reserved-source-id",
          edgeId: sourceEdgeId,
          message:
            "Rename this connection so the virtual traffic source can be added.",
        });
      modeled.set(virtualSourceId, {
        id: virtualSourceId,
        kind: "client",
        label: "Traffic source",
        x: entry.x - 220,
        y: entry.y,
        config: { ...defaultConfig("client"), rps: rate, traffic },
      });
      edges.push({
        id: sourceEdgeId,
        from: virtualSourceId,
        to: entry.id,
        weight: 1,
      });
      diagnostics.push({
        severity: "info",
        code: "virtual-source",
        nodeId: entry.id,
        message: `Traffic enters at ${entry.label}. No client node was required.`,
      });
    } else if (modeled.size > 0) {
      diagnostics.push({
        severity: "error",
        code: "ambiguous-entrypoint",
        action: "choose-entrypoint",
        message:
          "Choose a component as the traffic entrypoint, or add a client and connect it to the system.",
      });
      for (const node of candidates)
        diagnostics.push({
          severity: "info",
          code: "entrypoint-candidate",
          nodeId: node.id,
          action: "choose-entrypoint",
          message: `Use ${node.label} as the traffic entrypoint.`,
        });
    }
  }
  const clients = [...modeled.values()].filter(
    (node) => node.kind === "client",
  );
  if (clients.length === 0 && sources.some((node) => node.kind === "cron")) {
    diagnostics.push({
      severity: "error",
      code: "scheduled-source-needs-client",
      action: "choose-entrypoint",
      message:
        "Scheduled jobs use their own interval. Add a client connected to the request path to use this simulator’s request-rate controls alongside scheduled jobs.",
    });
  }
  const activeClients =
    trafficSource.mode === "clients" && trafficSource.selectedNodeId
      ? clients.filter((client) => client.id === trafficSource.selectedNodeId)
      : clients;
  const clientsReceivingTraffic =
    activeClients.length > 0 ? activeClients : clients;
  for (const client of clients) {
    Object.assign(client.config, {
      rps: clientsReceivingTraffic.includes(client)
        ? rate / clientsReceivingTraffic.length
        : 0,
      traffic,
    });
  }
  if (modeled.size === 0)
    diagnostics.push({
      severity: "error",
      code: "empty-system",
      message:
        "Add executable components, or try the repair example to start a simulation.",
    });

  // Reachability follows executable behavior, not just the direction of the
  // drawn arrows. Pull consumers read from a queue in either drawing
  // orientation, while a queue's ordinary outgoing connection cannot push
  // buffered work into a database or service.
  const semanticOutgoing = new Map<
    string,
    Array<{ to: string; edgeId: string }>
  >();
  const potentialOutgoing = new Map<
    string,
    Array<{ to: string; edgeId: string }>
  >();
  const queueConsumers = new Map<string, Set<string>>();
  const addLink = (
    map: Map<string, Array<{ to: string; edgeId: string }>>,
    from: string,
    to: string,
    edgeId: string,
  ) => {
    map.set(from, [...(map.get(from) ?? []), { to, edgeId }]);
  };
  for (const edge of edges) {
    if (edge.control) continue;
    const from = modeled.get(edge.from);
    const to = modeled.get(edge.to);
    if (!from || !to) continue;
    const fromBehaviour = behaviourFor(from.kind);
    const toBehaviour = behaviourFor(to.kind);
    const queueId =
      fromBehaviour.buffersForConsumers && toBehaviour.pullsFromQueues
        ? from.id
        : fromBehaviour.pullsFromQueues && toBehaviour.buffersForConsumers
          ? to.id
          : undefined;
    if (queueId) {
      const consumerId = queueId === from.id ? to.id : from.id;
      const consumers = queueConsumers.get(queueId) ?? new Set<string>();
      consumers.add(consumerId);
      queueConsumers.set(queueId, consumers);
      addLink(semanticOutgoing, queueId, consumerId, edge.id);
      addLink(potentialOutgoing, queueId, consumerId, edge.id);
      continue;
    }
    addLink(potentialOutgoing, edge.from, edge.to, edge.id);
    if (!fromBehaviour.buffersForConsumers)
      addLink(semanticOutgoing, edge.from, edge.to, edge.id);
  }

  const roots = [...modeled.values()].filter(
    (node) => node.kind === "client" || node.kind === "cron",
  );
  const reachable = new Set(roots.map((node) => node.id));
  const pending = [...reachable];
  while (pending.length > 0) {
    const current = pending.shift()!;
    for (const link of semanticOutgoing.get(current) ?? []) {
      if (reachable.has(link.to)) continue;
      reachable.add(link.to);
      pending.push(link.to);
    }
  }

  const blockedQueues = [...modeled.values()]
    .filter(
      (node) =>
        behaviourFor(node.kind).buffersForConsumers &&
        reachable.has(node.id) &&
        !queueConsumers.get(node.id)?.size,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const queue of blockedQueues) {
    diagnostics.push({
      severity: "warning",
      code: "queue-without-consumer",
      nodeId: queue.id,
      action: "fix-connection",
      message: `No active consumer is connected to ${queue.label}. A work queue buffers messages until a compatible background worker pulls them.`,
    });
  }

  function blockedQueueCause(
    targetId: string,
  ): { queue: SimNode; edgeId?: string } | undefined {
    for (const queue of blockedQueues) {
      const seen = new Set<string>([queue.id]);
      const queueLinks = (potentialOutgoing.get(queue.id) ?? []).map(
        (link) => ({ ...link, firstEdgeId: link.edgeId }),
      );
      const queuePath = [...queueLinks];
      while (queuePath.length > 0) {
        const link = queuePath.shift()!;
        if (link.to === targetId) return { queue, edgeId: link.firstEdgeId };
        if (seen.has(link.to)) continue;
        seen.add(link.to);
        for (const next of potentialOutgoing.get(link.to) ?? [])
          queuePath.push({ ...next, firstEdgeId: link.firstEdgeId });
      }
    }
    return undefined;
  }

  if (roots.length > 0) {
    for (const node of [...modeled.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      if (
        reachable.has(node.id) ||
        node.kind === "client" ||
        node.kind === "cron" ||
        node.kind === "autoscaler"
      )
        continue;
      const cause = blockedQueueCause(node.id);
      diagnostics.push({
        severity: cause ? "warning" : "info",
        code: "unreachable-component",
        nodeId: node.id,
        edgeId: cause?.edgeId,
        action: cause ? "fix-connection" : "choose-entrypoint",
        message: cause
          ? `No delivery from ${cause.queue.label}: ${node.label} is not reachable from the traffic source.`
          : `No traffic source reaches ${node.label}. Connect it to the request path or choose it as the entrypoint.`,
      });
    }
  }

  // Reject cycles rather than turning the engine hop limit into a design failure.
  const outgoing = new Map<string, SimEdge[]>();
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  for (const [from, links] of semanticOutgoing) {
    outgoing.set(
      from,
      links.flatMap((link) => {
        const edge = edgeById.get(link.edgeId);
        return edge ? [{ ...edge, from, to: link.to }] : [];
      }),
    );
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string): void {
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of outgoing.get(id) ?? []) {
      if (visiting.has(edge.to))
        diagnostics.push({
          severity: "error",
          code: "request-cycle",
          nodeId: edge.to,
          edgeId: edge.id,
          action: "fix-connection",
          message:
            "This request path loops. Mark response/documentation links as annotations or remove the cycle.",
        });
      else visit(edge.to);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of modeled.keys()) visit(id);
  for (const client of clientsReceivingTraffic)
    if (!outgoing.get(client.id)?.length)
      diagnostics.push({
        severity: "error",
        code: "disconnected-source",
        nodeId: client.id,
        action: "fix-connection",
        message: "Connect this traffic source to the system before starting.",
      });

  const nodes = [...modeled.values()].sort((a, b) => a.id.localeCompare(b.id));
  const semantic = {
    profileVersion: PROFILE_VERSION,
    nodes: nodes.map(({ id, kind, config }) => ({ id, kind, config })),
    edges: [...edges].sort((a, b) => a.id.localeCompare(b.id)),
    unsupported: [...nodeIds]
      .filter((id) => !modeled.has(id) && !structural.has(id))
      .sort(compareStrings),
    errors: diagnostics
      .filter((item) => item.severity === "error")
      .map(({ code, nodeId, edgeId }) => ({ code, nodeId, edgeId })),
  };
  return {
    topology: diagnostics.some((item) => item.severity === "error")
      ? null
      : { nodes, edges },
    diagnostics,
    profiles,
    fingerprint: fingerprint(semantic),
    trafficSource,
    ...(virtualSourceId ? { virtualSourceId } : {}),
  };
}
