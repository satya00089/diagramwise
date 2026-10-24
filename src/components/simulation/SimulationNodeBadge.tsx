import { memo } from "react";
import type { NodeKind, NodeStats } from "@diagramwise/simulation-core";
import { MdArrowForward, MdCheckCircleOutline, MdErrorOutline, MdPauseCircleOutline, MdWarningAmber } from "react-icons/md";
import { formatSimulationNumber, formatSimulationPercent, nodeSimulationSignal } from "./presentation";
import "./simulation.css";

export type SimulationNodeBadgeProps = {
  stats?: NodeStats;
  kind?: NodeKind;
  running: boolean;
  faulted?: boolean;
  label?: string;
  onInspect?: () => void;
};

export const SimulationNodeBadge = memo(function SimulationNodeBadge({stats, kind, running, faulted, label, onInspect}: SimulationNodeBadgeProps) {
  const signal = nodeSimulationSignal(stats, kind, faulted);
  const Icon = signal.tone === "danger" ? MdErrorOutline : signal.tone === "warning" ? MdWarningAmber : signal.tone === "healthy" ? MdCheckCircleOutline : MdPauseCircleOutline;
  return (
    <div className={`sim-node-badge sim-tone-${signal.tone} nodrag nopan`} aria-label={`${label ?? "Component"} simulation: ${signal.label}`}>
      <div className="sim-node-badge__status"><Icon aria-hidden="true" size={13} /><span>{signal.label}</span>{!running && <span className="sim-node-badge__paused">Paused</span>}</div>
      {stats && <>
        <div className="sim-node-badge__metrics">
          <span title="Incoming requests per second">{formatSimulationNumber(stats.arrivalRate)} in/s</span>
          <MdArrowForward aria-hidden="true" />
          <span title="Completed requests per second">{formatSimulationNumber(stats.throughput)} done/s</span>
        </div>
        <div className="sim-node-badge__pressure">
          <span>{kind === "queue" || kind === "streambroker" || kind === "retryqueue" ? `${formatSimulationNumber(stats.queued)} queued` : `${formatSimulationPercent(stats.utilization)} busy`}</span>
          {stats.instances !== undefined && <span>{stats.instances} {stats.instances === 1 ? "instance" : "instances"}</span>}
          {(stats.throttledRate ?? 0) > 0 && <span>{formatSimulationNumber(stats.throttledRate ?? 0)}/s refused</span>}
        </div>
        <div className="sim-node-badge__meter" aria-hidden="true"><span style={{width: `${Math.min(100, Math.max(0, (kind === "queue" ? stats.queued / Math.max(1, stats.queueLimit) : stats.utilization) * 100))}%`}} /></div>
      </>}
      {onInspect && <button type="button" className="sim-node-badge__inspect" onClick={onInspect} aria-label={`Inspect simulation for ${label ?? "component"}`}>Inspect</button>}
    </div>
  );
});
