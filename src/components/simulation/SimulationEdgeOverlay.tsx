import { memo } from "react";
import type { CSSProperties } from "react";
import type { EdgeState } from "@diagramwise/simulation-core";
import type { SimulationTone } from "./types";
import { formatSimulationNumber } from "./presentation";
import "./simulation.css";

export type SimulationEdgeOverlayProps = {
  id: string;
  path: string;
  rate: number;
  running: boolean;
  state?: EdgeState;
  tone?: SimulationTone;
  failureLabel?: string;
  labelX?: number;
  labelY?: number;
  showLabel?: boolean;
};

export const SimulationEdgeOverlay = memo(function SimulationEdgeOverlay({id, path, rate, running, state = "idle", tone, failureLabel, labelX, labelY, showLabel = true}: SimulationEdgeOverlayProps) {
  const effectiveTone = state === "cut" || state === "blocked" ? "danger" : tone ?? (rate > 0 ? "healthy" : "neutral");
  const moving = running && rate > 0 && state !== "cut" && state !== "blocked" && state !== "standby";
  const description = state === "cut" ? "Connection cut" : state === "blocked" ? "Traffic blocked" : state === "standby" ? "Standby connection" : failureLabel ?? (rate > 0 ? `${formatSimulationNumber(rate)} requests per second` : "No traffic");
  const label = state === "cut" ? "× Cut" : state === "blocked" ? "! Blocked" : failureLabel ? `! ${failureLabel}` : `${formatSimulationNumber(rate)}/s`;
  const width = Math.max(48, Math.min(260, label.length * 6.5 + 16));
  const style = {"--sim-flow-duration": `${Math.max(0.35, 1.8 - Math.log10(Math.max(1, rate)) * 0.3)}s`} as CSSProperties;
  return (
    <g className={`sim-edge sim-tone-${effectiveTone}`} data-edge-id={id} data-moving={moving ? "true" : "false"} data-state={state} style={style} pointerEvents="none">
      <title>{description}</title>
      <path className="sim-edge__underlay" d={path} fill="none" />
      <path className="sim-edge__flow" d={path} fill="none" />
      {showLabel && labelX !== undefined && labelY !== undefined && state !== "standby" && (rate > 0 || effectiveTone === "danger") && (
        <g transform={`translate(${labelX},${labelY})`} className="sim-edge__label">
          <rect x={-width / 2} y={-11} width={width} height={22} rx={5} />
          <text textAnchor="middle" dominantBaseline="central">{label}</text>
        </g>
      )}
    </g>
  );
});
