import type { SimulationTone } from "../components/simulation/types";
import {
  SimulationEdgeOverlay,
  SimulationNodeBadge,
} from "../components/simulation";
import { useSimulationSession } from "./store";
import type { NodeBadgeAppearance } from "../components/simulation/nodeBadgeAppearance";

export function SimulationNodeRuntimeBadge({
  nodeId,
  appearance,
}: Readonly<{
  nodeId: string;
  appearance?: NodeBadgeAppearance;
}>) {
  const stats = useSimulationSession((s) => s.snapshot?.nodes[nodeId]);
  const status = useSimulationSession((s) => s.status);
  const kind = useSimulationSession(
    (s) => s.compilation?.profiles[nodeId]?.kind,
  );
  const label = useSimulationSession(
    (s) => s.document?.nodes.find((node) => node.id === nodeId)?.data?.label,
  );
  const diagnostic = useSimulationSession((s) =>
    s.compilation?.diagnostics.find(
      (item) =>
        item.nodeId === nodeId &&
        (item.code === "queue-without-consumer" ||
          item.code === "unreachable-component"),
    ),
  );
  const faulted = useSimulationSession(
    (s) => s.snapshot?.activeFailures.some((f) => f.nodeId === nodeId) ?? false,
  );
  if (!stats || status === "stale" || status === "invalid") return null;
  return (
    <SimulationNodeBadge
      stats={stats}
      kind={kind}
      label={typeof label === "string" ? label : nodeId}
      diagnostic={diagnostic}
      running={status === "running"}
      faulted={faulted}
      appearance={appearance}
      onInspect={() => {
        useSimulationSession.setState({ selectedNodeId: nodeId });
        globalThis.dispatchEvent(
          new CustomEvent("diagram:simulation-inspect", { detail: { nodeId } }),
        );
      }}
    />
  );
}

export function SimulationEdgeRuntimeOverlay({
  id,
  source,
  target,
  path,
  x,
  y,
}: Readonly<{
  id: string;
  source: string;
  target: string;
  path: string;
  x: number;
  y: number;
}>) {
  const rate = useSimulationSession((s) => s.snapshot?.edgeFlow[id]);
  const state = useSimulationSession((s) => s.snapshot?.edgeState[id]);
  const sourceStats = useSimulationSession((s) => s.snapshot?.nodes[source]);
  const sourceKind = useSimulationSession(
    (s) => s.compilation?.profiles[source]?.kind,
  );
  const sourceEdgeIndex = useSimulationSession(
    (s) =>
      s.compilation?.topology?.edges
        .filter((edge) => edge.from === source)
        .findIndex((edge) => edge.id === id) ?? -1,
  );
  const stats = useSimulationSession((s) => s.snapshot?.nodes[target]);
  const diagnostics = useSimulationSession(
    (s) => s.compilation?.diagnostics ?? [],
  );
  const status = useSimulationSession((s) => s.status);
  if (rate === undefined || status === "stale" || status === "invalid")
    return null;
  const presentation = getEdgePresentation({
    id,
    source,
    sourceKind,
    sourceStats,
    sourceEdgeIndex,
    targetStats: stats,
    diagnostics,
    state,
    rate,
  });
  return (
    <SimulationEdgeOverlay
      id={id}
      path={path}
      rate={rate}
      state={state}
      running={status === "running"}
      tone={presentation.tone}
      failureLabel={presentation.failureLabel}
      labelX={x}
      labelY={y}
      showLabel
    />
  );
}

const BUFFER_KINDS = new Set([
  "queue",
  "streambroker",
  "retryqueue",
  "writebehind",
]);

function getEdgePresentation({
  id,
  source,
  sourceKind,
  sourceStats,
  sourceEdgeIndex,
  targetStats,
  diagnostics,
  state,
  rate,
}: {
  id: string;
  source: string;
  sourceKind?: string;
  sourceStats?: {
    queued?: number;
    consumerLagByGroup?: number[];
  };
  sourceEdgeIndex: number;
  targetStats?: {
    errorRate?: number;
    timeoutRate?: number;
    queued?: number;
    utilization?: number;
  };
  diagnostics: Array<{
    code: string;
    nodeId?: string;
    edgeId?: string;
    severity?: string;
  }>;
  state?: string;
  rate: number;
}): { tone: SimulationTone; failureLabel?: string } {
  const failed =
    state === "cut" ||
    (targetStats?.errorRate ?? 0) > 0 ||
    (targetStats?.timeoutRate ?? 0) > 0;
  const backlog =
    sourceKind === "streambroker"
      ? (sourceStats?.consumerLagByGroup?.[sourceEdgeIndex] ?? 0)
      : (sourceStats?.queued ?? 0);
  const queueHasNoConsumer =
    sourceKind === "queue" &&
    diagnostics.some(
      (item) =>
        item.code === "queue-without-consumer" && item.nodeId === source,
    );
  const affectedByQueue = diagnostics.some(
    (item) =>
      item.code === "unreachable-component" &&
      item.edgeId === id &&
      item.severity === "warning",
  );
  const backlogPressure = BUFFER_KINDS.has(sourceKind ?? "") && backlog > 0;
  const pressure =
    ((targetStats?.queued ?? 0) > 0 &&
      (targetStats?.utilization ?? 0) >= 0.8) ||
    backlogPressure ||
    queueHasNoConsumer ||
    affectedByQueue;
  let tone: SimulationTone = "neutral";
  if (failed) tone = "danger";
  else if (pressure) tone = "warning";
  else if (rate > 0) tone = "healthy";

  let failureLabel: string | undefined;
  if (state === "cut") failureLabel = "Connection cut";
  else if (failed) failureLabel = "Downstream failures";
  else if (queueHasNoConsumer || affectedByQueue)
    failureLabel = "No active consumer";
  else if (backlogPressure)
    failureLabel =
      sourceKind === "streambroker" ? "Consumer lag" : "Buffered backlog";
  else if (pressure) failureLabel = "Waiting downstream";
  return { tone, failureLabel };
}
