import type { SimSnapshot, TrafficPattern } from "@diagramwise/simulation-core";
import { TrafficChart } from "./TrafficChart";
import {
  trafficPatternLabel,
  trafficPatternPhase,
  trafficPatternSummary,
} from "./trafficPatterns";
import "./simulation.css";

export type TrafficPanelProps = Readonly<{
  snapshot: SimSnapshot | null;
  rps: number;
  pattern: TrafficPattern;
}>;

/**
 * The run's traffic: where the pattern is now, its plan against what was
 * sent and completed, and what the pattern is for. Hosted beside the canvas
 * rather than in the toolbar, so the controls stay compact while it grows.
 */
export function TrafficPanel({ snapshot, rps, pattern }: TrafficPanelProps) {
  const timeMs = snapshot?.system.timeMs ?? 0;
  const patternStartMs = snapshot?.system.trafficStartMs ?? 0;
  return (
    <div className="sim-traffic-panel">
      <p className="sim-traffic-panel__now">
        <strong>{trafficPatternLabel(pattern)}</strong>
        {snapshot &&
          ` · ${trafficPatternPhase(pattern, Math.max(0, timeMs - patternStartMs) / 1000)}`}
      </p>
      <TrafficChart
        history={snapshot?.history ?? []}
        pattern={pattern}
        rps={rps}
        timeMs={timeMs}
        patternStartMs={patternStartMs}
      />
      {/* Clamped to two lines to fit the inset; the title holds the rest. */}
      <p
        className="sim-traffic-panel__summary"
        title={trafficPatternSummary(pattern)}
      >
        {trafficPatternSummary(pattern)}
      </p>
    </div>
  );
}
