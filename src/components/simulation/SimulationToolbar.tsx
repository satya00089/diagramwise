import { useEffect, useId, useState, type CSSProperties } from "react";
import type { SimSnapshot, TrafficPattern } from "@diagramwise/simulation-core";
import type { CompiledTrafficSource } from "@diagramwise/simulation-core/compiler";
import {
  MdAccountTree,
  MdPause,
  MdPlayArrow,
  MdRefresh,
  MdTune,
  MdWarningAmber,
} from "react-icons/md";
import SelectDropdown from "../shared/SelectDropdown";
import type { SimulationDiagnostic, SimulationStatus } from "./types";
import { SIMULATION_STATUS_LABELS } from "./types";
import {
  formatSimulationNumber,
  formatSimulationPercent,
} from "./presentation";
import "./simulation.css";

const TRAFFIC_OPTIONS: ReadonlyArray<{ value: TrafficPattern; label: string }> =
  [
    { value: "steady", label: "Steady" },
    { value: "ramp", label: "Ramp up" },
    { value: "spike", label: "Burst" },
    { value: "diurnal", label: "Daily cycle" },
  ];
const TRAFFIC_LABELS = TRAFFIC_OPTIONS.map((option) => option.label);
const PLAYBACK_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 5, label: "5×" },
];
const PLAYBACK_LABELS = PLAYBACK_OPTIONS.map((option) => option.label);
const AUTO_SOURCE_VALUE = "automatic";
const ALL_CLIENTS_VALUE = "all-clients";
const SOURCE_NODE_PREFIX = "node:";

function rateToSlider(rate: number): number {
  const clamped = Math.min(100_000, Math.max(0, rate));
  return clamped <= 1_000
    ? clamped / 2
    : 500 + (Math.log(clamped / 1_000) / Math.log(100)) * 500;
}

function sliderToRate(position: number): number {
  if (position <= 500) return Math.round(position * 2);
  return Math.round(1_000 * 100 ** ((position - 500) / 500));
}

function simulationStartLabel(status: SimulationStatus): string {
  if (status === "stale") return "Restart with changes";
  if (status === "paused") return "Resume";
  return "Start simulation";
}

function simulationNotice(
  status: SimulationStatus,
  errors: readonly SimulationDiagnostic[],
  achievedSpeed: number | undefined,
): string {
  if (status === "resource-limited")
    return "This run reached a simulator limit. Its results are incomplete.";
  if (status === "error")
    return "The simulation stopped. Your design is safe; reset and try again.";
  if (errors.length) return errors[0].message;
  return `Processing at ${formatSimulationNumber(achievedSpeed ?? 0)}×. Simulated events are preserved.`;
}

export type SimulationToolbarProps = Readonly<{
  status: SimulationStatus;
  rps: number;
  pattern: TrafficPattern;
  speed: number;
  timeMs: number;
  snapshot: SimSnapshot | null;
  diagnostics?: readonly SimulationDiagnostic[];
  hasBackgroundDelivery?: boolean;
  achievedSpeed?: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onRpsChange: (value: number) => void;
  onPatternChange: (value: TrafficPattern) => void;
  onSpeedChange: (value: number) => void;
  trafficSource?: CompiledTrafficSource;
  onTrafficSourceChange?: (nodeId: string | null) => void;
  onInspect?: () => void;
  onDemo?: () => void;
}>;

export function SimulationToolbar({
  status,
  rps,
  pattern,
  speed,
  timeMs,
  snapshot,
  diagnostics = [],
  hasBackgroundDelivery = false,
  achievedSpeed,
  onStart,
  onPause,
  onReset,
  onRpsChange,
  onPatternChange,
  onSpeedChange,
  trafficSource,
  onTrafficSourceChange,
  onInspect,
  onDemo,
}: SimulationToolbarProps) {
  const id = useId();
  const running = status === "running";
  const errors = diagnostics.filter((item) => item.severity === "error");
  const startLabel = simulationStartLabel(status);
  const slower =
    running &&
    achievedSpeed !== undefined &&
    timeMs > 2000 &&
    achievedSpeed < speed * 0.75;
  const sliderPosition = rateToSlider(rps);
  const rateProgress = `${sliderPosition / 10}%`;
  const [rateDraft, setRateDraft] = useState(String(rps));
  useEffect(() => setRateDraft(String(rps)), [rps]);
  const sourceCanBeSelected =
    trafficSource?.mode === "ingress" || trafficSource?.mode === "clients"
      ? trafficSource.options.length > 1 || trafficSource.requiresSelection
      : false;
  const sourceSelectionValue =
    trafficSource?.mode === "ingress"
      ? trafficSource.requiresSelection
        ? ""
        : trafficSource.selectedNodeId
          ? `${SOURCE_NODE_PREFIX}${trafficSource.selectedNodeId}`
          : AUTO_SOURCE_VALUE
      : trafficSource?.mode === "clients"
        ? trafficSource.requiresSelection
          ? ""
          : trafficSource.selectedNodeId
            ? `${SOURCE_NODE_PREFIX}${trafficSource.selectedNodeId}`
            : ALL_CLIENTS_VALUE
        : "";
  const sourceLabel = trafficSource?.selectedNodeId
    ? trafficSource.options.find(
        (option) => option.id === trafficSource.selectedNodeId,
      )?.label
    : trafficSource?.mode === "ingress" && trafficSource.inferredNodeId
      ? trafficSource.options.find(
          (option) => option.id === trafficSource.inferredNodeId,
        )?.label
      : trafficSource?.mode === "clients" && trafficSource.options.length > 1
        ? "All clients"
        : trafficSource?.options[0]?.label;

  const commitRateDraft = () => {
    const parsed = Number(rateDraft);
    if (!rateDraft.trim() || !Number.isFinite(parsed)) {
      setRateDraft(String(rps));
      return;
    }
    const next = Math.round(Math.min(100_000, Math.max(0, parsed)));
    setRateDraft(String(next));
    onRpsChange(next);
  };

  return (
    <section
      className="sim-toolbar nodrag nopan"
      aria-label="Simulation controls"
    >
      <div className="sim-toolbar__controls">
        <div className="sim-toolbar__control-group">
          <button
            type="button"
            className="sim-button sim-button--primary sim-toolbar__play"
            onClick={running ? onPause : onStart}
          >
            {running ? (
              <MdPause aria-hidden="true" size={19} />
            ) : (
              <MdPlayArrow aria-hidden="true" size={19} />
            )}
            {running ? "Pause" : startLabel}
          </button>
          <button
            type="button"
            className="sim-button sim-button--icon"
            onClick={onReset}
            aria-label="Reset simulation"
            data-tooltip="Reset simulation"
            data-tooltip-placement="bottom"
          >
            <MdRefresh aria-hidden="true" size={19} />
          </button>
        </div>
        <div className="sim-toolbar__load">
          <label htmlFor={`${id}-rps`}>Requests / sec</label>
          <input
            id={`${id}-rps`}
            className="sim-input sim-toolbar__number"
            type="number"
            min={0}
            max={100000}
            step={1}
            value={rateDraft}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setRateDraft(value);
              if (value === "") return;
              const parsed = Number(value);
              if (Number.isFinite(parsed))
                onRpsChange(Math.max(0, Math.min(100000, Math.round(parsed))));
            }}
            onBlur={commitRateDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRateDraft();
                event.currentTarget.blur();
              }
            }}
          />
          <div className="sim-toolbar__range">
            <input
              className="sim-toolbar__slider"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={sliderPosition}
              aria-label="Adjust incoming requests per second"
              aria-valuetext={`${rps.toLocaleString()} requests per second`}
              style={{ "--sim-rate-progress": rateProgress } as CSSProperties}
              onChange={(event) =>
                onRpsChange(sliderToRate(Number(event.currentTarget.value)))
              }
            />
            <div className="sim-toolbar__range-labels" aria-hidden="true">
              <span style={{ left: "0%" }}>0</span>
              <span style={{ left: "5%" }}>100</span>
              <span style={{ left: "50%" }}>1k</span>
              <span style={{ left: "75%" }}>10k</span>
              <span style={{ left: "100%" }}>100k</span>
            </div>
          </div>
        </div>
        <div className="sim-toolbar__control-group sim-toolbar__control-group--selectors">
          <div className="sim-toolbar__select">
            <span>Traffic</span>
            <SelectDropdown
              id={`${id}-traffic`}
              value={
                TRAFFIC_OPTIONS.find((option) => option.value === pattern)
                  ?.label ?? TRAFFIC_OPTIONS[0].label
              }
              options={TRAFFIC_LABELS}
              aria-label="Traffic pattern"
              className="sim-toolbar__select-trigger sim-toolbar__select-trigger--traffic"
              onChange={(label) => {
                const entry = TRAFFIC_OPTIONS.find(
                  (option) => option.label === label,
                );
                if (entry) onPatternChange(entry.value);
              }}
            />
          </div>
          <div className="sim-toolbar__select">
            <span>Playback</span>
            <SelectDropdown
              id={`${id}-playback`}
              value={
                PLAYBACK_OPTIONS.find((option) => option.value === speed)
                  ?.label ?? `${speed}×`
              }
              options={PLAYBACK_LABELS}
              aria-label="Playback speed"
              className="sim-toolbar__select-trigger sim-toolbar__select-trigger--playback"
              onChange={(label) => {
                const entry = PLAYBACK_OPTIONS.find(
                  (option) => option.label === label,
                );
                if (entry) onSpeedChange(entry.value);
              }}
            />
          </div>
        </div>
        {onInspect && (
          <button
            type="button"
            className="sim-button sim-button--icon"
            onClick={onInspect}
            aria-label="Open simulation details"
            data-tooltip="Simulation details"
            data-tooltip-placement="bottom"
          >
            <MdTune aria-hidden="true" size={19} />
          </button>
        )}
      </div>
      <div className="sim-toolbar__readout">
        <span
          className={`sim-toolbar__state sim-toolbar__state--${status}`}
          role="status"
        >
          <span className="sim-status-dot" aria-hidden="true" />
          {SIMULATION_STATUS_LABELS[status]}
        </span>
        {trafficSource && trafficSource.mode !== "none" && (
          <div className="sim-toolbar__source">
            <MdAccountTree aria-hidden="true" size={15} />
            <span className="sim-toolbar__source-label">Traffic source</span>
            {sourceCanBeSelected && onTrafficSourceChange ? (
              <select
                className="sim-input sim-toolbar__source-select"
                aria-label="Traffic entrypoint"
                data-tooltip="Choose where simulated requests enter the diagram"
                data-tooltip-placement="bottom"
                value={sourceSelectionValue}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (
                    value === AUTO_SOURCE_VALUE ||
                    value === ALL_CLIENTS_VALUE
                  ) {
                    onTrafficSourceChange(null);
                  } else if (value.startsWith(SOURCE_NODE_PREFIX)) {
                    onTrafficSourceChange(
                      value.slice(SOURCE_NODE_PREFIX.length),
                    );
                  }
                }}
              >
                {trafficSource.requiresSelection && (
                  <option value="" disabled>
                    Choose a source
                  </option>
                )}
                {trafficSource.mode === "ingress" && (
                  <option value={AUTO_SOURCE_VALUE}>
                    {trafficSource.inferredNodeId
                      ? `Automatic · ${
                          trafficSource.options.find(
                            (option) =>
                              option.id === trafficSource.inferredNodeId,
                          )?.label ?? "inferred"
                        }`
                      : "Automatic"}
                  </option>
                )}
                {trafficSource.mode === "clients" && (
                  <option value={ALL_CLIENTS_VALUE}>
                    All clients (even split)
                  </option>
                )}
                {trafficSource.options.map((option) => (
                  <option
                    key={option.id}
                    value={`${SOURCE_NODE_PREFIX}${option.id}`}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="sim-toolbar__source-value">
                {trafficSource.mode === "scheduled"
                  ? `Scheduled · ${trafficSource.options
                      .map((option) => option.label)
                      .join(", ")}`
                  : (sourceLabel ?? "Choose a source")}
              </span>
            )}
          </div>
        )}
        {snapshot && (
          <div className="sim-toolbar__metrics">
            <span className="sim-toolbar__metric sim-toolbar__metric--responses">
              <strong>
                {formatSimulationNumber(snapshot.system.goodputRps)}
              </strong>{" "}
              {hasBackgroundDelivery ? "caller responses/s" : "completed/s"}
            </span>
            <span
              className={`sim-toolbar__metric sim-toolbar__metric--failed${
                snapshot.system.errorRate > 0 ? " sim-text-danger" : ""
              }`}
            >
              <strong>
                {formatSimulationPercent(snapshot.system.errorRate)}
              </strong>{" "}
              failed
            </span>
            <span className="sim-toolbar__clock sim-toolbar__metric">
              {formatSimulationNumber(timeMs / 1000)} s simulated
            </span>
          </div>
        )}
        {!snapshot && status === "idle" && (
          <span>Start, increase traffic, and watch the paths.</span>
        )}
        {onDemo && (
          <button type="button" className="sim-text-button" onClick={onDemo}>
            Try a repair challenge
          </button>
        )}
      </div>
      {(errors.length > 0 ||
        status === "resource-limited" ||
        status === "error" ||
        slower) && (
        <div className="sim-toolbar__notice">
          <MdWarningAmber aria-hidden="true" size={16} />
          <span>{simulationNotice(status, errors, achievedSpeed)}</span>
          {onInspect && (
            <button
              type="button"
              className="sim-text-button"
              onClick={onInspect}
            >
              Details
            </button>
          )}
        </div>
      )}
    </section>
  );
}
