import type { NodeKind, NodeStats } from "@diagramwise/simulation-core";
import type { SimulationTone } from "./types";

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});
const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatSimulationNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 10000
    ? compactFormatter.format(value)
    : numberFormatter.format(value);
}

export function formatSimulationPercent(value: number): string {
  return Number.isFinite(value) ? `${numberFormatter.format(value * 100)}%` : "—";
}

export function formatSimulationLatency(value: number, sampleCount?: number): string {
  if (!Number.isFinite(value) || value < 0 || sampleCount === 0) return "Collecting samples";
  return value >= 1000
    ? `${numberFormatter.format(value / 1000)} s`
    : `${numberFormatter.format(value)} ms`;
}

export function nodeSimulationSignal(
  stats: NodeStats | undefined,
  kind?: NodeKind,
  faulted = false,
): { tone: SimulationTone; label: string; explanation: string } {
  if (faulted) {
    return { tone: "danger", label: "Fault active", explanation: "A temporary fault is active on this component. Clear the fault to observe recovery." };
  }
  if (!stats) {
    return { tone: "neutral", label: "Waiting for traffic", explanation: "Start the simulation to observe this component." };
  }
  if (stats.breakerState === "open") {
    return { tone: "danger", label: "Circuit open", explanation: "The circuit breaker is refusing calls while its downstream dependency recovers." };
  }
  if (stats.failingOver) {
    return { tone: "danger", label: "Failover in progress", explanation: "Requests are affected while this region switches to a healthy destination." };
  }
  if ((stats.throttledRate ?? 0) > 0) {
    return { tone: "danger", label: "Rate limited", explanation: "The configured rate limiter is rejecting part of the incoming workload." };
  }
  if (stats.shedRate > 0) {
    return { tone: "danger", label: "Queue full · dropping requests", explanation: "Requests are being rejected because available service slots and the configured waiting queue are full." };
  }
  if (stats.timeoutRate > 0) {
    return { tone: "danger", label: "Timeouts observed", explanation: "Calls exceeded their deadline. Inspect this component and its downstream path to locate the wait." };
  }
  if (stats.errorRate > 0) {
    return { tone: "danger", label: "Requests failing", explanation: "This component is reporting failed requests. A failure may originate here or propagate from a dependency." };
  }
  if (stats.queued > 0) {
    return { tone: "warning", label: `${formatSimulationNumber(stats.queued)} waiting`, explanation: "Work is waiting for a service slot. Watch whether the queue drains when traffic falls." };
  }
  if ((stats.instancesPending ?? 0) > 0 || stats.scalePhase === "warming") {
    return { tone: "warning", label: "Instances warming up", explanation: "Additional instances have been requested and are not yet serving traffic." };
  }
  if (stats.utilization >= 0.85 && kind !== "client") {
    return { tone: "warning", label: "Limited spare capacity", explanation: "Most available service slots are occupied. This indicates pressure; it does not by itself mean requests are failing." };
  }
  if (stats.arrivalRate > 0 || stats.throughput > 0) {
    return { tone: "healthy", label: "Traffic flowing", explanation: "Traffic is flowing with no observed failures in the current window." };
  }
  return { tone: "neutral", label: "Idle", explanation: "This component is not receiving traffic in the current window." };
}

export const SIMULATION_MODEL_LABELS: Record<NodeKind, string> = {
  client: "Traffic source",
  lb: "Load balancer",
  service: "Service / application server",
  cache: "Cache",
  db: "Database",
  queue: "Message queue",
  worker: "Background worker",
  autoscaler: "Autoscaler",
  region: "Region failover",
  cdn: "CDN / edge cache",
  ratelimiter: "Rate limiter",
  breaker: "Circuit breaker",
  replica: "Database replica set",
  shard: "Sharded database",
  objectstore: "Object storage",
  searchindex: "Search index",
  timeseriesdb: "Time-series database",
  graphdb: "Graph database",
  coldstorage: "Cold storage",
  vectordb: "Vector database",
  streambroker: "Stream broker",
  pubsub: "Publish / subscribe",
  websocket: "WebSocket service",
  apigateway: "API gateway",
  sidecar: "Sidecar proxy",
  lambda: "Serverless function",
  cron: "Scheduled job",
  bulkhead: "Connection pool / bulkhead",
  retryqueue: "Retry queue",
  transcoder: "Media processing",
  edgecompute: "Edge compute",
  writebehind: "Write-behind cache",
  loadshedder: "Load shedder",
};
