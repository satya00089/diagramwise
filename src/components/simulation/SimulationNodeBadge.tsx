import { memo, useLayoutEffect, useRef, useState } from "react";
import type { NodeKind, NodeStats } from "@diagramwise/simulation-core";
import {
  MdArrowForward,
  MdCheckCircleOutline,
  MdErrorOutline,
  MdPauseCircleOutline,
  MdWarningAmber,
} from "react-icons/md";
import {
  formatSimulationNumber,
  formatSimulationPercent,
  nodeSimulationSignal,
} from "./presentation";
import {
  getElementContrastForeground,
  getNodeBadgeAppearance,
  type NodeBadgeAppearance,
} from "./nodeBadgeAppearance";
import "./simulation.css";

export type SimulationNodeBadgeProps = Readonly<{
  stats?: NodeStats;
  kind?: NodeKind;
  diagnostic?: Readonly<{
    code: string;
    message: string;
    severity?: "error" | "warning" | "info";
  }>;
  running: boolean;
  faulted?: boolean;
  label?: string;
  onInspect?: () => void;
  appearance?: NodeBadgeAppearance;
}>;

function getSignalIcon(tone: string) {
  if (tone === "danger") return MdErrorOutline;
  if (tone === "warning") return MdWarningAmber;
  if (tone === "healthy") return MdCheckCircleOutline;
  return MdPauseCircleOutline;
}

function getThroughputLabel(kind: NodeKind | undefined): string {
  if (kind === "queue") return "acked/s";
  if (kind === "streambroker") return "published/s";
  return "done/s";
}

function getBacklogLabel(kind: NodeKind | undefined): string {
  if (kind === "streambroker") return "lag";
  if (kind === "queue") return "buffered";
  return "queued";
}

function getThroughputDescription(kind: NodeKind | undefined): string {
  if (kind === "queue")
    return "Caller acknowledgements per second; downstream work is tracked separately";
  if (kind === "streambroker")
    return "Messages published per second; consumer delivery is tracked by lag";
  return "Completed requests per second";
}

function getPressureDescription(
  backlogKind: boolean,
  queued: number,
  backlogLabel: string,
  utilization: number,
): string {
  if (backlogKind) return `${formatSimulationNumber(queued)} ${backlogLabel}`;
  return `${formatSimulationPercent(utilization)} busy`;
}

function getMeterPercent(
  backlogKind: boolean,
  queued: number,
  queueLimit: number,
  utilization: number,
): number {
  const pressure = backlogKind ? queued / Math.max(1, queueLimit) : utilization;
  return Math.min(100, Math.max(0, pressure * 100));
}

export const SimulationNodeBadge = memo(function SimulationNodeBadge({
  stats,
  kind,
  diagnostic,
  running,
  faulted,
  label,
  onInspect,
  appearance,
}: SimulationNodeBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [calculatedForeground, setCalculatedForeground] = useState<string>();
  const customBackground = appearance?.backgroundColor?.trim();
  const customText = appearance?.textColor?.trim();
  useLayoutEffect(() => {
    if (!customBackground || customText || !badgeRef.current) return;
    const update = () => {
      if (badgeRef.current)
        setCalculatedForeground(getElementContrastForeground(badgeRef.current));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, [customBackground, customText]);
  const signal = nodeSimulationSignal(stats, kind, faulted, diagnostic);
  const Icon = getSignalIcon(signal.tone);
  const backlogKind =
    kind === "queue" ||
    kind === "streambroker" ||
    kind === "retryqueue" ||
    kind === "writebehind";
  const throughputLabel = getThroughputLabel(kind);
  const backlogLabel = getBacklogLabel(kind);
  const { style, customForeground } = getNodeBadgeAppearance(
    appearance ?? {},
    customBackground && !customText ? calculatedForeground : undefined,
  );
  return (
    <div
      ref={badgeRef}
      className={`sim-node-badge sim-tone-${signal.tone} nodrag nopan`}
      style={style}
      data-custom-foreground={customForeground || undefined}
      aria-label={`${label ?? "Component"} simulation: ${signal.label}`}
    >
      <div className="sim-node-badge__status">
        <Icon aria-hidden="true" size={13} />
        <span>{signal.label}</span>
        {!running && <span className="sim-node-badge__paused">Paused</span>}
      </div>
      {stats && (
        <>
          <div className="sim-node-badge__metrics">
            <span title="Incoming requests per second">
              {formatSimulationNumber(stats.arrivalRate)} in/s
            </span>
            <MdArrowForward aria-hidden="true" />
            <span title={getThroughputDescription(kind)}>
              {formatSimulationNumber(stats.throughput)} {throughputLabel}
            </span>
          </div>
          <div className="sim-node-badge__pressure">
            <span>
              {getPressureDescription(
                backlogKind,
                stats.queued,
                backlogLabel,
                stats.utilization,
              )}
            </span>
            {stats.instances !== undefined && (
              <span>
                {stats.instances}{" "}
                {stats.instances === 1 ? "instance" : "instances"}
              </span>
            )}
            {(stats.throttledRate ?? 0) > 0 && (
              <span>
                {formatSimulationNumber(stats.throttledRate ?? 0)}/s refused
              </span>
            )}
          </div>
          <div className="sim-node-badge__meter" aria-hidden="true">
            <span
              style={{
                width: `${getMeterPercent(
                  backlogKind,
                  stats.queued,
                  stats.queueLimit,
                  stats.utilization,
                )}%`,
              }}
            />
          </div>
        </>
      )}
      {onInspect && (
        <button
          type="button"
          className="sim-node-badge__inspect"
          onClick={onInspect}
          aria-label={`Inspect simulation for ${label ?? "component"}`}
        >
          Inspect
        </button>
      )}
    </div>
  );
});
