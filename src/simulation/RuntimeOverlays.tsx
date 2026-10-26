import type { SimulationTone } from "../components/simulation/types";
import { SimulationEdgeOverlay, SimulationNodeBadge } from "../components/simulation";
import { useSimulationSession } from "./store";

export function SimulationNodeRuntimeBadge({ nodeId }: { nodeId: string }) {
  const stats = useSimulationSession(s => s.snapshot?.nodes[nodeId]);
  const status = useSimulationSession(s => s.status);
  const kind = useSimulationSession(s => s.compilation?.profiles[nodeId]?.kind);
  const label = useSimulationSession(s => s.document?.nodes.find(node => node.id === nodeId)?.data?.label);
  const diagnostic = useSimulationSession(s => s.compilation?.diagnostics.find(item => item.nodeId === nodeId && (item.code === "queue-without-consumer" || item.code === "unreachable-component")));
  const faulted = useSimulationSession(s => s.snapshot?.activeFailures.some(f => f.nodeId === nodeId) ?? false);
  if (!stats || status === "stale" || status === "invalid") return null;
  return <SimulationNodeBadge stats={stats} kind={kind} label={typeof label === "string" ? label : nodeId} diagnostic={diagnostic} running={status === "running"} faulted={faulted}
    onInspect={() => {
      useSimulationSession.setState({ selectedNodeId: nodeId });
      globalThis.dispatchEvent(new CustomEvent("diagram:simulation-inspect", { detail: { nodeId } }));
    }} />;
}

export function SimulationEdgeRuntimeOverlay({ id, source, target, path, x, y }: { id: string; source: string; target: string; path: string; x: number; y: number }) {
  const rate = useSimulationSession(s => s.snapshot?.edgeFlow[id]);
  const state = useSimulationSession(s => s.snapshot?.edgeState[id]);
  const sourceStats = useSimulationSession(s => s.snapshot?.nodes[source]);
  const sourceKind = useSimulationSession(s => s.compilation?.profiles[source]?.kind);
  const sourceEdgeIndex = useSimulationSession(s => s.compilation?.topology?.edges.filter(edge => edge.from === source).findIndex(edge => edge.id === id) ?? -1);
  const stats = useSimulationSession(s => s.snapshot?.nodes[target]);
  const diagnostics = useSimulationSession(s => s.compilation?.diagnostics ?? []);
  const status = useSimulationSession(s => s.status);
  if (rate === undefined || status === "stale" || status === "invalid") return null;
  const failed = state === "cut" || (stats?.errorRate ?? 0) > 0 || (stats?.timeoutRate ?? 0) > 0;
  const bufferKinds = ["queue", "streambroker", "retryqueue", "writebehind"];
  const backlog = sourceKind === "streambroker"
    ? sourceStats?.consumerLagByGroup?.[sourceEdgeIndex] ?? 0
    : sourceStats?.queued ?? 0;
  const queueHasNoConsumer = sourceKind === "queue" && diagnostics.some(item => item.code === "queue-without-consumer" && item.nodeId === source);
  const affectedByQueue = diagnostics.some(item => item.code === "unreachable-component" && item.edgeId === id && item.severity === "warning");
  const backlogPressure = bufferKinds.includes(sourceKind ?? "") && backlog > 0;
  const pressure = ((stats?.queued ?? 0) > 0 && (stats?.utilization ?? 0) >= 0.8) || backlogPressure || queueHasNoConsumer || affectedByQueue;
  const tone: SimulationTone = failed ? "danger" : pressure ? "warning" : rate > 0 ? "healthy" : "neutral";
  const pressureLabel = queueHasNoConsumer || affectedByQueue ? "No active consumer" : backlogPressure ? (sourceKind === "streambroker" ? "Consumer lag" : "Buffered backlog") : "Waiting downstream";
  return <SimulationEdgeOverlay id={id} path={path} rate={rate} state={state} running={status === "running"}
    tone={tone} failureLabel={state === "cut" ? "Connection cut" : failed ? "Downstream failures" : pressure ? pressureLabel : undefined}
    labelX={x} labelY={y + 20} showLabel />;
}
