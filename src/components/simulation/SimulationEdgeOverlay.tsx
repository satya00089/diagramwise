import { memo } from "react";
import type { CSSProperties } from "react";
import type { EdgeState } from "@diagramwise/simulation-core";
import type { SimulationTone } from "./types";
import { formatSimulationNumber } from "./presentation";
import "./simulation.css";

export type SimulationEdgeOverlayProps = Readonly<{
  id: string;
  path: string;
  rate: number;
  running: boolean;
  state?: EdgeState;
  tone?: SimulationTone;
  failureLabel?: string;
  labelX?: number;
  labelY?: number;
  /** Position the badge once its width is known; wins over labelX/labelY. */
  placeLabel?: (width: number) => { x: number; y: number };
  showLabel?: boolean;
}>;

function getEdgeDescription(
  state: EdgeState,
  failureLabel: string | undefined,
  rate: number,
): string {
  if (state === "cut") return "Connection cut";
  if (state === "blocked") return "Traffic blocked";
  if (state === "standby") return "Standby connection";
  if (failureLabel !== undefined) return failureLabel;
  return rate > 0
    ? `${formatSimulationNumber(rate)} requests per second`
    : "No traffic";
}

function getEdgeLabel(
  state: EdgeState,
  failureLabel: string | undefined,
  rate: number,
): string {
  if (state === "cut") return "× Cut";
  if (state === "blocked") return "! Blocked";
  if (failureLabel) return `! ${failureLabel}`;
  return `${formatSimulationNumber(rate)}/s`;
}

function getEffectiveTone(
  state: EdgeState,
  tone: SimulationTone | undefined,
  rate: number,
): SimulationTone {
  if (state === "cut" || state === "blocked") return "danger";
  if (tone) return tone;
  return rate > 0 ? "healthy" : "neutral";
}

export const SimulationEdgeOverlay = memo(function SimulationEdgeOverlay({
  id,
  path,
  rate,
  running,
  state = "idle",
  tone,
  failureLabel,
  labelX,
  labelY,
  placeLabel,
  showLabel = true,
}: SimulationEdgeOverlayProps) {
  const effectiveTone = getEffectiveTone(state, tone, rate);
  const moving =
    running &&
    rate > 0 &&
    state !== "cut" &&
    state !== "blocked" &&
    state !== "standby";
  const description = getEdgeDescription(state, failureLabel, rate);
  const label = getEdgeLabel(state, failureLabel, rate);
  const width = Math.max(48, Math.min(260, label.length * 6.5 + 16));
  let position: { x: number; y: number } | undefined;
  if (placeLabel) position = placeLabel(width);
  else if (labelX !== undefined && labelY !== undefined)
    position = { x: labelX, y: labelY };
  const style = {
    "--sim-flow-duration": `${Math.max(0.35, 1.8 - Math.log10(Math.max(1, rate)) * 0.3)}s`,
  } as CSSProperties;
  return (
    <g
      className={`sim-edge sim-tone-${effectiveTone}`}
      data-edge-id={id}
      data-moving={moving ? "true" : "false"}
      data-state={state}
      style={style}
      pointerEvents="none"
    >
      <title>{description}</title>
      <path className="sim-edge__underlay" d={path} fill="none" />
      <path className="sim-edge__flow" d={path} fill="none" />
      {showLabel &&
        position &&
        state !== "standby" &&
        (rate > 0 ||
          effectiveTone === "danger" ||
          failureLabel !== undefined) && (
          <g
            transform={`translate(${position.x},${position.y})`}
            className="sim-edge__label"
          >
            <rect x={-width / 2} y={-11} width={width} height={22} rx={5} />
            <text textAnchor="middle" dominantBaseline="central">
              {label}
            </text>
          </g>
        )}
    </g>
  );
});
