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

const patterns = new Set<TrafficPattern>([
  "steady",
  "ramp",
  "spike",
  "diurnal",
]);
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
const compareStrings = (left: string, right: string) =>
  left.localeCompare(right);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function getComponentId(data: Record<string, unknown>): string {
  if (typeof data.componentId === "string") return data.componentId;
  if (typeof data.architectureType === "string") return data.architectureType;
  return "";
}

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
      for (let i = 0; i < text.length; i++) {
        const codePoint = text.codePointAt(i)!;
        if (codePoint > 0xffff) {
          const highSurrogate = ((codePoint - 0x10000) >> 10) + 0xd800;
          const lowSurrogate = ((codePoint - 0x10000) & 0x3ff) + 0xdc00;
          hash = Math.imul(hash ^ highSurrogate, 16777619);
          hash = Math.imul(hash ^ lowSurrogate, 16777619);
          i++;
        } else {
          hash = Math.imul(hash ^ codePoint, 16777619);
        }
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    })
    .join("");
}

function validConfigValue(key: string, value: unknown): boolean {
  if (key === "traffic") return patterns.has(value as TrafficPattern);
  if (key === "bulkheadMode") return value === "wait" || value === "reject";
  if (
    typeof value !== "number" ||
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
    (key === "trafficPeriodS" && value < 0.1)
  ) {
    return false;
  }
  return true;
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
    if (
      !Object.hasOwn(defaults, key) &&
      key !== "traffic" &&
      key !== "trafficPeriodS"
    ) {
      diagnostics.push({
        severity: "error",
        code: "unknown-config",
        nodeId,
        action: "configure-model",
        message: `The ${kind} model does not support the setting “${key}”.`,
      });
      continue;
    }
    if (!validConfigValue(key, value))
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

interface GraphCompilation {
  diagnostics: SimulationDiagnostic[];
  profiles: Record<string, CatalogProfile>;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  modeled: Map<string, SimNode>;
  structural: Set<string>;
  explicitEntries: Set<string>;
  edges: SimEdge[];
  connectedUnknown: Set<string>;
}

function nodeProfile(
  node: CanvasSimulationNode,
  componentId: string,
  settings: Record<string, unknown>,
  diagnostics: SimulationDiagnostic[],
): CatalogProfile {
  let profile = resolveCatalogProfile(componentId);
  if (settings.kind !== undefined) {
    if (isNodeKind(settings.kind)) {
      return {
        componentId,
        kind: settings.kind,
        classification: "generic",
        assumption: `Explicit ${settings.kind} model chosen for this component; its settings are educational assumptions.`,
      };
    }
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
  return profile;
}

function compileNode(
  node: CanvasSimulationNode,
  graph: GraphCompilation,
): void {
  if (!node.id || node.id.length > 200 || graph.nodeIds.has(node.id)) {
    graph.diagnostics.push({
      severity: "error",
      code: "invalid-node-id",
      nodeId: node.id,
      message:
        "Components need unique, non-empty identifiers of at most 200 characters.",
    });
    return;
  }
  graph.nodeIds.add(node.id);
  const data = record(node.data);
  const settings = record(data.simulation);
  const componentId = getComponentId(data);
  const profile = nodeProfile(node, componentId, settings, graph.diagnostics);
  graph.profiles[node.id] = profile;
  if (profile.classification === "structural") {
    graph.structural.add(node.id);
    return;
  }
  if (!profile.kind) return;
  if (settings.entrypoint === true) graph.explicitEntries.add(node.id);
  graph.modeled.set(node.id, {
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
      graph.diagnostics,
    ),
  });
  if (profile.classification === "generic") {
    graph.diagnostics.push({
      severity: "info",
      code: "generic-profile",
      nodeId: node.id,
      message: profile.assumption,
    });
  }
}

function compileNodes(
  nodes: readonly CanvasSimulationNode[],
  graph: GraphCompilation,
): void {
  for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    compileNode(node, graph);
  }
}

function compileEdge(
  edge: CanvasSimulationEdge,
  graph: GraphCompilation,
): void {
  if (!edge.id || edge.id.length > 200 || graph.edgeIds.has(edge.id)) {
    graph.diagnostics.push({
      severity: "error",
      code: "invalid-edge-id",
      edgeId: edge.id,
      message:
        "Connections need unique, non-empty identifiers of at most 200 characters.",
    });
    return;
  }
  graph.edgeIds.add(edge.id);
  const settings = record(record(edge.data).simulation);
  if (settings.mode === "annotation") return;
  if (!graph.nodeIds.has(edge.source) || !graph.nodeIds.has(edge.target)) {
    graph.diagnostics.push({
      severity: "error",
      code: "missing-endpoint",
      edgeId: edge.id,
      action: "fix-connection",
      message: "Reconnect or remove this connection: an endpoint is missing.",
    });
    return;
  }
  if (graph.structural.has(edge.source) || graph.structural.has(edge.target)) {
    graph.diagnostics.push({
      severity: "info",
      code: "documentation-connection",
      edgeId: edge.id,
      message:
        "This connection touches a documentation symbol and carries no simulated requests.",
    });
    return;
  }
  const source = graph.modeled.get(edge.source);
  const target = graph.modeled.get(edge.target);
  if (!source || !target) {
    if (!source) graph.connectedUnknown.add(edge.source);
    if (!target) graph.connectedUnknown.add(edge.target);
    return;
  }
  const mode =
    settings.mode ?? (source.kind === "autoscaler" ? "control" : "request");
  if (mode !== "request" && mode !== "async" && mode !== "control") {
    graph.diagnostics.push({
      severity: "error",
      code: "unknown-connection-mode",
      edgeId: edge.id,
      action: "fix-connection",
      message:
        "Choose request, async, control, or annotation for this connection.",
    });
    return;
  }
  diagnoseEdgeMode(mode, source, target, edge.id, graph.diagnostics);
  const validSettings = getValidEdgeSettings(settings);
  if (!validSettings) {
    graph.diagnostics.push({
      severity: "error",
      code: "invalid-link-settings",
      edgeId: edge.id,
      action: "fix-connection",
      message:
        "Connection weight must be positive, and delay must be between 0 and 60,000 ms.",
    });
    return;
  }
  graph.edges.push({
    id: edge.id,
    from: edge.source,
    to: edge.target,
    weight: validSettings.weight,
    latencyMs: validSettings.latencyMs,
    ...(mode === "control" ? { control: true } : {}),
  });
}

function diagnoseEdgeMode(
  mode: string,
  source: SimNode,
  target: SimNode,
  edgeId: string,
  diagnostics: SimulationDiagnostic[],
): void {
  if (
    mode === "async" &&
    !bufferedKinds.has(source.kind) &&
    !bufferedKinds.has(target.kind)
  ) {
    diagnostics.push({
      severity: "error",
      code: "async-needs-buffer",
      edgeId,
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
      edgeId,
      action: "fix-connection",
      message:
        "A control connection must link an autoscaler to a scalable component.",
    });
  }
  if (target.kind === "client" || target.kind === "autoscaler") {
    diagnostics.push({
      severity: "error",
      code: "invalid-request-target",
      edgeId,
      action: "fix-connection",
      message:
        "Traffic sources and autoscalers cannot receive application requests. Mark response/documentation arrows as annotations.",
    });
  }
}

function getValidEdgeSettings(
  settings: Record<string, unknown>,
): { weight: number; latencyMs: number } | undefined {
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
    return undefined;
  }
  return { weight, latencyMs };
}

function compileEdges(
  edges: readonly CanvasSimulationEdge[],
  graph: GraphCompilation,
): void {
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    compileEdge(edge, graph);
  }
}

function diagnoseUnmodeledNodes(graph: GraphCompilation): void {
  for (const id of graph.nodeIds) {
    if (graph.modeled.has(id) || graph.structural.has(id)) continue;
    const connected = graph.connectedUnknown.has(id);
    graph.diagnostics.push({
      severity: connected ? "error" : "warning",
      code: "unmodeled-component",
      nodeId: id,
      action: "choose-model",
      message: connected
        ? "Choose a behavior model for this component before simulating this request path."
        : "This unconnected component has no behavior model and is excluded from the run.",
    });
  }
}

interface TrafficResolution {
  source: CompiledTrafficSource;
  virtualSourceId?: string;
  clientsReceivingTraffic: SimNode[];
}

function resolveTrafficSource(
  graph: GraphCompilation,
  options: CompileOptions,
  rate: number,
  traffic: TrafficPattern,
): TrafficResolution {
  if (options.entryNodeId) graph.explicitEntries.add(options.entryNodeId);
  const sources = [...graph.modeled.values()].filter(
    (node) => node.kind === "client" || node.kind === "cron",
  );
  const physicalClients = sources.filter((node) => node.kind === "client");
  const scheduledSources = sources.filter((node) => node.kind === "cron");
  let source: CompiledTrafficSource = {
    mode: "none",
    options: [],
    requiresSelection: false,
  };
  let virtualSourceId: string | undefined;
  if (physicalClients.length > 0) {
    source = resolveClientSource(physicalClients, graph);
  } else if (scheduledSources.length > 0) {
    source = {
      mode: "scheduled",
      options: trafficSourceOptions(scheduledSources),
      requiresSelection: false,
    };
  } else if (sources.length === 0 && graph.modeled.size > 0) {
    const ingress = resolveIngressSource(graph, rate, traffic);
    source = ingress.source;
    virtualSourceId = ingress.virtualSourceId;
  }
  const clients = [...graph.modeled.values()].filter(
    (node) => node.kind === "client",
  );
  diagnoseScheduledSource(clients, sources, graph.diagnostics);
  const clientsReceivingTraffic = selectReceivingClients(clients, source);
  assignClientTraffic(clients, clientsReceivingTraffic, rate, traffic);
  diagnoseEmptySystem(graph);
  return { source, virtualSourceId, clientsReceivingTraffic };
}

function resolveClientSource(
  clients: SimNode[],
  graph: GraphCompilation,
): CompiledTrafficSource {
  const selectedClients = clients.filter((node) =>
    graph.explicitEntries.has(node.id),
  );
  const requiresSelection = selectedClients.length > 1;
  if (requiresSelection) {
    graph.diagnostics.push({
      severity: "error",
      code: "ambiguous-entrypoint",
      action: "choose-entrypoint",
      message:
        "Choose one traffic client, or distribute the request rate across all clients.",
    });
  }
  return {
    mode: "clients",
    options: trafficSourceOptions(clients),
    ...(selectedClients.length === 1
      ? { selectedNodeId: selectedClients[0].id }
      : {}),
    requiresSelection,
  };
}

function resolveIngressSource(
  graph: GraphCompilation,
  rate: number,
  traffic: TrafficPattern,
): { source: CompiledTrafficSource; virtualSourceId?: string } {
  const inbound = new Set(
    graph.edges.filter((edge) => !edge.control).map((edge) => edge.to),
  );
  const candidates = [...graph.modeled.values()].filter(
    (node) => node.kind !== "autoscaler" && !inbound.has(node.id),
  );
  const options = [...graph.modeled.values()].filter(
    (node) => node.kind !== "autoscaler",
  );
  const selectedEntries = [...graph.explicitEntries]
    .map((id) => graph.modeled.get(id))
    .filter((node): node is SimNode => !!node && node.kind !== "autoscaler");
  const entries = graph.explicitEntries.size > 0 ? selectedEntries : candidates;
  const entry =
    entries.length === 1 &&
    (graph.explicitEntries.size === 0 || graph.explicitEntries.size === 1)
      ? entries[0]
      : undefined;
  const source: CompiledTrafficSource = {
    mode: "ingress",
    options: trafficSourceOptions(options),
    ...(graph.explicitEntries.size === 1 && selectedEntries[0]
      ? { selectedNodeId: selectedEntries[0].id }
      : {}),
    ...(graph.explicitEntries.size === 0 && entry
      ? { inferredNodeId: entry.id }
      : {}),
    requiresSelection: !entry,
  };
  if (entry) {
    const virtualSourceId = addVirtualSource(graph, entry, rate, traffic);
    return { source, virtualSourceId };
  }
  if (graph.modeled.size > 0) diagnoseAmbiguousIngress(graph, candidates);
  return { source };
}

function addVirtualSource(
  graph: GraphCompilation,
  entry: SimNode,
  rate: number,
  traffic: TrafficPattern,
): string {
  let virtualSourceId = "__simulation_source__";
  while (graph.nodeIds.has(virtualSourceId)) virtualSourceId += "_";
  const sourceEdgeId = `${virtualSourceId}:entry`;
  if (graph.edgeIds.has(sourceEdgeId))
    graph.diagnostics.push({
      severity: "error",
      code: "reserved-source-id",
      edgeId: sourceEdgeId,
      message:
        "Rename this connection so the virtual traffic source can be added.",
    });
  graph.modeled.set(virtualSourceId, {
    id: virtualSourceId,
    kind: "client",
    label: "Traffic source",
    x: entry.x - 220,
    y: entry.y,
    config: { ...defaultConfig("client"), rps: rate, traffic },
  });
  graph.edges.push({
    id: sourceEdgeId,
    from: virtualSourceId,
    to: entry.id,
    weight: 1,
  });
  graph.diagnostics.push({
    severity: "info",
    code: "virtual-source",
    nodeId: entry.id,
    message: `Traffic enters at ${entry.label}. No client node was required.`,
  });
  return virtualSourceId;
}

function diagnoseAmbiguousIngress(
  graph: GraphCompilation,
  candidates: SimNode[],
): void {
  graph.diagnostics.push({
    severity: "error",
    code: "ambiguous-entrypoint",
    action: "choose-entrypoint",
    message:
      "Choose a component as the traffic entrypoint, or add a client and connect it to the system.",
  });
  for (const node of candidates)
    graph.diagnostics.push({
      severity: "info",
      code: "entrypoint-candidate",
      nodeId: node.id,
      action: "choose-entrypoint",
      message: `Use ${node.label} as the traffic entrypoint.`,
    });
}

function diagnoseScheduledSource(
  clients: SimNode[],
  sources: SimNode[],
  diagnostics: SimulationDiagnostic[],
): void {
  if (clients.length > 0 || !sources.some((node) => node.kind === "cron"))
    return;
  diagnostics.push({
    severity: "error",
    code: "scheduled-source-needs-client",
    action: "choose-entrypoint",
    message:
      "Scheduled jobs use their own interval. Add a client connected to the request path to use this simulator’s request-rate controls alongside scheduled jobs.",
  });
}

function selectReceivingClients(
  clients: SimNode[],
  source: CompiledTrafficSource,
): SimNode[] {
  if (source.mode !== "clients" || !source.selectedNodeId) return clients;
  const selected = clients.filter(
    (client) => client.id === source.selectedNodeId,
  );
  return selected.length > 0 ? selected : clients;
}

function assignClientTraffic(
  clients: SimNode[],
  receiving: SimNode[],
  rate: number,
  traffic: TrafficPattern,
): void {
  const receivingIds = new Set(receiving.map((client) => client.id));
  for (const client of clients) {
    Object.assign(client.config, {
      rps: receivingIds.has(client.id) ? rate / receiving.length : 0,
      traffic,
    });
  }
}

function diagnoseEmptySystem(graph: GraphCompilation): void {
  if (graph.modeled.size > 0) return;
  graph.diagnostics.push({
    severity: "error",
    code: "empty-system",
    message:
      "Add executable components, or try the repair example to start a simulation.",
  });
}

type SemanticLink = { to: string; edgeId: string };
interface ReachabilityData {
  semanticOutgoing: Map<string, SemanticLink[]>;
  potentialOutgoing: Map<string, SemanticLink[]>;
  queueConsumers: Map<string, Set<string>>;
  roots: SimNode[];
  reachable: Set<string>;
  blockedQueues: SimNode[];
}

function addLink(
  map: Map<string, SemanticLink[]>,
  from: string,
  to: string,
  edgeId: string,
): void {
  map.set(from, [...(map.get(from) ?? []), { to, edgeId }]);
}

function collectReachabilityData(graph: GraphCompilation): ReachabilityData {
  const semanticOutgoing = new Map<string, SemanticLink[]>();
  const potentialOutgoing = new Map<string, SemanticLink[]>();
  const queueConsumers = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.control) continue;
    const from = graph.modeled.get(edge.from);
    const to = graph.modeled.get(edge.to);
    if (!from || !to) continue;
    const fromBehaviour = behaviourFor(from.kind);
    const toBehaviour = behaviourFor(to.kind);
    const queueId = linkedQueueId(from, to, fromBehaviour, toBehaviour);
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
  const roots = [...graph.modeled.values()].filter(
    (node) => node.kind === "client" || node.kind === "cron",
  );
  const reachable = findReachable(roots, semanticOutgoing);
  const blockedQueues = [...graph.modeled.values()]
    .filter(
      (node) =>
        behaviourFor(node.kind).buffersForConsumers &&
        reachable.has(node.id) &&
        !queueConsumers.get(node.id)?.size,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    semanticOutgoing,
    potentialOutgoing,
    queueConsumers,
    roots,
    reachable,
    blockedQueues,
  };
}

function linkedQueueId(
  from: SimNode,
  to: SimNode,
  fromBehaviour: ReturnType<typeof behaviourFor>,
  toBehaviour: ReturnType<typeof behaviourFor>,
): string | undefined {
  if (fromBehaviour.buffersForConsumers && toBehaviour.pullsFromQueues)
    return from.id;
  if (fromBehaviour.pullsFromQueues && toBehaviour.buffersForConsumers)
    return to.id;
  return undefined;
}

function findReachable(
  roots: SimNode[],
  outgoing: Map<string, SemanticLink[]>,
): Set<string> {
  const reachable = new Set(roots.map((node) => node.id));
  const pending = [...reachable];
  while (pending.length > 0) {
    const current = pending.shift()!;
    for (const link of outgoing.get(current) ?? []) {
      if (reachable.has(link.to)) continue;
      reachable.add(link.to);
      pending.push(link.to);
    }
  }
  return reachable;
}

function blockedQueueCause(
  targetId: string,
  blockedQueues: SimNode[],
  potentialOutgoing: Map<string, SemanticLink[]>,
): { queue: SimNode; edgeId?: string } | undefined {
  for (const queue of blockedQueues) {
    const seen = new Set<string>([queue.id]);
    const queueLinks = (potentialOutgoing.get(queue.id) ?? []).map((link) => ({
      ...link,
      firstEdgeId: link.edgeId,
    }));
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

function diagnoseBlockedQueues(
  queues: SimNode[],
  diagnostics: SimulationDiagnostic[],
): void {
  for (const queue of queues)
    diagnostics.push({
      severity: "warning",
      code: "queue-without-consumer",
      nodeId: queue.id,
      action: "fix-connection",
      message: `No active consumer is connected to ${queue.label}. A work queue buffers messages until a compatible background worker pulls them.`,
    });
}

function diagnoseUnreachableNodes(
  graph: GraphCompilation,
  data: ReachabilityData,
): void {
  if (data.roots.length === 0) return;
  for (const node of [...graph.modeled.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (
      data.reachable.has(node.id) ||
      node.kind === "client" ||
      node.kind === "cron" ||
      node.kind === "autoscaler"
    )
      continue;
    const cause = blockedQueueCause(
      node.id,
      data.blockedQueues,
      data.potentialOutgoing,
    );
    graph.diagnostics.push({
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

function buildRoutingOutgoing(
  edges: SimEdge[],
  semanticOutgoing: Map<string, SemanticLink[]>,
): Map<string, SimEdge[]> {
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
  return outgoing;
}

function diagnoseRequestCycles(
  graph: GraphCompilation,
  outgoing: Map<string, SimEdge[]>,
): void {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of outgoing.get(id) ?? []) {
      if (visiting.has(edge.to))
        graph.diagnostics.push({
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
  };
  for (const id of graph.modeled.keys()) visit(id);
}

function diagnoseDisconnectedSources(
  clients: SimNode[],
  outgoing: Map<string, SimEdge[]>,
  diagnostics: SimulationDiagnostic[],
): void {
  for (const client of clients)
    if (!outgoing.get(client.id)?.length)
      diagnostics.push({
        severity: "error",
        code: "disconnected-source",
        nodeId: client.id,
        action: "fix-connection",
        message: "Connect this traffic source to the system before starting.",
      });
}

function diagnoseGraphPaths(
  graph: GraphCompilation,
  clientsReceivingTraffic: SimNode[],
): void {
  const data = collectReachabilityData(graph);
  diagnoseBlockedQueues(data.blockedQueues, graph.diagnostics);
  diagnoseUnreachableNodes(graph, data);
  const outgoing = buildRoutingOutgoing(graph.edges, data.semanticOutgoing);
  diagnoseRequestCycles(graph, outgoing);
  diagnoseDisconnectedSources(
    clientsReceivingTraffic,
    outgoing,
    graph.diagnostics,
  );
}

/** Compile explicit diagram semantics. Presentation-only changes leave the fingerprint unchanged. */
export function compileGraph(
  document: SimulationDocument,
  options: CompileOptions = {},
): CompiledSimulation {
  const graph: GraphCompilation = {
    diagnostics: [],
    profiles: Object.create(null),
    nodeIds: new Set<string>(),
    edgeIds: new Set<string>(),
    modeled: new Map<string, SimNode>(),
    structural: new Set<string>(),
    explicitEntries: new Set<string>(),
    edges: [],
    connectedUnknown: new Set<string>(),
  };
  const rate = options.requestRate ?? 100;
  const traffic = options.traffic ?? "steady";
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100_000 ||
    !patterns.has(traffic)
  ) {
    graph.diagnostics.push({
      severity: "error",
      code: "invalid-workload",
      message:
        "Choose a traffic pattern and a request rate between 0 and 100,000 requests/sec.",
    });
  }

  // Reordering React Flow arrays must not change seeded routing order.
  compileNodes(document.nodes, graph);
  compileEdges(document.edges, graph);
  diagnoseUnmodeledNodes(graph);

  const { diagnostics, profiles, nodeIds, modeled, structural, edges } = graph;
  if (graph.modeled.size > 100 || graph.edges.length > 200)
    graph.diagnostics.push({
      severity: "error",
      code: "graph-limit",
      message:
        "This release supports up to 100 executable components and 200 executable connections per run.",
    });
  const resolvedTraffic = resolveTrafficSource(graph, options, rate, traffic);
  const {
    source: trafficSource,
    virtualSourceId,
    clientsReceivingTraffic,
  } = resolvedTraffic;

  diagnoseGraphPaths(graph, clientsReceivingTraffic);

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
