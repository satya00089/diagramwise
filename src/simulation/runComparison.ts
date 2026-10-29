import type { EventRunArtifact } from "./protocol";
import {
  formatSimulationLatency,
  formatSimulationNumber,
  formatSimulationPercent,
} from "../components/simulation/presentation";

export type RunDelta = {
  label: string;
  from: string;
  to: string;
  tone: "better" | "worse";
};

export type RunComparison =
  // "load": the traffic differs. "same-design": nothing was changed, so any
  // difference is run-to-run variation, not the effect of a design change.
  | { comparable: false; reason: "load" | "same-design" }
  | { comparable: true; deltas: RunDelta[] };

/** One-line outcome of a run, e.g. "9.8k/s served · 0.2% failed · p95 90 ms". */
export function describeRunOutcome(run: EventRunArtifact): string {
  const { result } = run;
  if (!result) return "No measurements recorded";
  return [
    `${formatSimulationNumber(result.goodputRps)}/s served`,
    `${formatSimulationPercent(result.errorRate)} failed`,
    `p95 ${formatSimulationLatency(result.p95)}`,
  ].join(" · ");
}

// Differences smaller than these are measurement noise, not a real change.
const MIN_FAILURE_CHANGE = 0.005; // half a percentage point
const MIN_RELATIVE_CHANGE = 0.05;

function relativeChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 1;
  return (to - from) / from;
}

/**
 * What changed from `previous` to `current`. Only runs under the same traffic
 * load are compared; otherwise a difference would reflect the load, not the
 * design. Runs of the same design are not compared either: their numbers
 * differ by chance, which would read as an improvement or regression that
 * never happened. Metrics that did not meaningfully change are left out.
 */
export function compareRuns(
  current: EventRunArtifact,
  previous: EventRunArtifact,
): RunComparison {
  const now = current.result;
  const before = previous.result;
  if (!now || !before) return { comparable: false, reason: "load" };
  if (
    current.workload.rps !== previous.workload.rps ||
    current.workload.pattern !== previous.workload.pattern
  )
    return { comparable: false, reason: "load" };
  if (current.graphFingerprint === previous.graphFingerprint)
    return { comparable: false, reason: "same-design" };

  const deltas: RunDelta[] = [];

  if (Math.abs(now.errorRate - before.errorRate) >= MIN_FAILURE_CHANGE)
    deltas.push({
      label: "Failed",
      from: formatSimulationPercent(before.errorRate),
      to: formatSimulationPercent(now.errorRate),
      tone: now.errorRate < before.errorRate ? "better" : "worse",
    });

  const served = relativeChange(before.goodputRps, now.goodputRps);
  if (Math.abs(served) >= MIN_RELATIVE_CHANGE)
    deltas.push({
      label: "Served",
      from: `${formatSimulationNumber(before.goodputRps)}/s`,
      to: `${formatSimulationNumber(now.goodputRps)}/s`,
      tone: served > 0 ? "better" : "worse",
    });

  const p95 = relativeChange(before.p95, now.p95);
  if (Number.isFinite(p95) && Math.abs(p95) >= MIN_RELATIVE_CHANGE)
    deltas.push({
      label: "p95",
      from: formatSimulationLatency(before.p95),
      to: formatSimulationLatency(now.p95),
      tone: p95 < 0 ? "better" : "worse",
    });

  return { comparable: true, deltas };
}
