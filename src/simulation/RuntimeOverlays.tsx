import type { SimulationTone } from "../components/simulation/types";
import { SimulationEdgeOverlay, SimulationNodeBadge } from "../components/simulation";
import { useSimulationSession } from "./store";

export function SimulationNodeRuntimeBadge({ nodeId }: { nodeId: string }) {
  const stats = useSimulationSession(s => s.snapshot?.nodes[nodeId]);
  const status = useSimulationSession(s => s.status);
  const kind = useSimulationSession(s => s.compilation?.profiles[nodeId]?.kind);
  const faulted = useSimulationSession(s => s.snapshot?.activeFailures.some(f => f.nodeId === nodeId) ?? false);
  if (!stats || status === "stale" || status === "invalid") return null;
  return <SimulationNodeBadge stats={stats} kind={kind} running={status === "running"} faulted={faulted}
    onInspect={() => {
      useSimulationSession.setState({ selectedNodeId: nodeId });
      globalThis.dispatchEvent(new CustomEvent("diagram:simulation-inspect", { detail: { nodeId } }));
    }} />;
}

export function SimulationEdgeRuntimeOverlay({ id, target, path, x, y }: { id: string; target: string; path: string; x: number; y: number }) {
  const rate = useSimulationSession(s => s.snapshot?.edgeFlow[id]);
  const state = useSimulationSession(s => s.snapshot?.edgeState[id]);
  const stats = useSimulationSession(s => s.snapshot?.nodes[target]);
  const status = useSimulationSession(s => s.status);
  if (rate === undefined || status === "stale" || status === "invalid") return null;
  const failed = state === "cut" || (stats?.errorRate ?? 0) > 0 || (stats?.timeoutRate ?? 0) > 0;
  const pressure = (stats?.queued ?? 0) > 0 && (stats?.utilization ?? 0) >= 0.8;
  const tone: SimulationTone = failed ? "danger" : pressure ? "warning" : rate > 0 ? "healthy" : "neutral";
  return <SimulationEdgeOverlay id={id} path={path} rate={rate} state={state} running={status === "running"}
    tone={tone} failureLabel={state === "cut" ? "Connection cut" : failed ? "Downstream failures" : pressure ? "Waiting downstream" : undefined}
    labelX={x} labelY={y + 20} showLabel />;
}
