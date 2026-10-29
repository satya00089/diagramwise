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

type TrafficSourceChoice = { value: string; label: string };

function sourceCanBeSelected(
  trafficSource: CompiledTrafficSource | undefined,
): boolean {
  if (!trafficSource) return false;
  if (trafficSource.mode !== "ingress" && trafficSource.mode !== "clients")
    return false;
  return trafficSource.options.length > 1 || trafficSource.requiresSelection;
}

function getSourceSelectionValue(
  trafficSource: CompiledTrafficSource | undefined,
): string {
  if (!trafficSource) return "";
  if (trafficSource.mode === "ingress") {
    if (trafficSource.requiresSelection) return "";
    if (trafficSource.selectedNodeId)
      return `${SOURCE_NODE_PREFIX}${trafficSource.selectedNodeId}`;
    return AUTO_SOURCE_VALUE;
  }
  if (trafficSource.mode === "clients") {
    if (trafficSource.requiresSelection) return "";
    if (trafficSource.selectedNodeId)
      return `${SOURCE_NODE_PREFIX}${trafficSource.selectedNodeId}`;
    return ALL_CLIENTS_VALUE;
  }
  return "";
}

function getSourceChoices(
  trafficSource: CompiledTrafficSource | undefined,
): TrafficSourceChoice[] {
  if (!trafficSource) return [];
  const choices: TrafficSourceChoice[] = [];
  if (trafficSource.mode === "ingress") {
    const inferredLabel = trafficSource.options.find(
      (option) => option.id === trafficSource.inferredNodeId,
    )?.label;
    choices.push({
      value: AUTO_SOURCE_VALUE,
      label: inferredLabel ? `Automatic · ${inferredLabel}` : "Automatic",
    });
  }
  if (trafficSource.mode === "clients")
    choices.push({
      value: ALL_CLIENTS_VALUE,
      label: "All clients (even split)",
    });
  if (trafficSource.mode === "ingress" || trafficSource.mode === "clients") {
    choices.push(
      ...trafficSource.options.map((option) => ({
        value: `${SOURCE_NODE_PREFIX}${option.id}`,
        label: option.label,
      })),
    );
  }
  return makeUniqueSourceChoices(choices);
}

function getSourceLabel(
  trafficSource: CompiledTrafficSource | undefined,
): string | undefined {
  if (!trafficSource) return undefined;
  const selectedNodeId =
    trafficSource.selectedNodeId ??
    (trafficSource.mode === "ingress" ? trafficSource.inferredNodeId : null);
  if (selectedNodeId) {
    return trafficSource.options.find((option) => option.id === selectedNodeId)
      ?.label;
  }
  if (trafficSource.mode === "clients" && trafficSource.options.length > 1)
    return "All clients";
  return trafficSource.options[0]?.label;
}

function getSourceReadout(
  trafficSource: CompiledTrafficSource,
  sourceLabel: string | undefined,
): string {
  if (trafficSource.mode === "scheduled") {
    return `Scheduled · ${trafficSource.options
      .map((option) => option.label)
      .join(", ")}`;
  }
  return sourceLabel ?? "Choose a source";
}

function getChoiceNodeId(value: string): string | null | undefined {
  if (value === AUTO_SOURCE_VALUE || value === ALL_CLIENTS_VALUE) return null;
  if (value.startsWith(SOURCE_NODE_PREFIX))
    return value.slice(SOURCE_NODE_PREFIX.length);
  return undefined;
}

function makeUniqueSourceChoices(
  choices: readonly TrafficSourceChoice[],
): TrafficSourceChoice[] {
  const labelCounts = new Map<string, number>();
  for (const choice of choices) {
    labelCounts.set(choice.label, (labelCounts.get(choice.label) ?? 0) + 1);
  }
  const usedLabels = new Set<string>();
  return choices.map((choice) => {
    let label =
      (labelCounts.get(choice.label) ?? 0) > 1 &&
      choice.value.startsWith(SOURCE_NODE_PREFIX)
        ? `${choice.label} (${choice.value.slice(SOURCE_NODE_PREFIX.length)})`
        : choice.label;
    let suffix = 2;
    while (usedLabels.has(label)) label = `${choice.label} (${suffix++})`;
    usedLabels.add(label);
    return { ...choice, label };
  });
}

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
  if (status === "stale") return "Restart";
  if (status === "paused") return "Resume";
  return "Start";
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
  const canSelectSource = sourceCanBeSelected(trafficSource);
  const sourceSelectionValue = getSourceSelectionValue(trafficSource);
  const sourceChoices = getSourceChoices(trafficSource);
  const selectedSourceChoice = sourceChoices.find(
    (choice) => choice.value === sourceSelectionValue,
  );
  const sourceLabel = getSourceLabel(trafficSource);
  // One possible source: keep the same dropdown control, but disabled, so the
  // toolbar reads the same whether or not there is a choice to make.
  const fixedSourceLabel = sourceLabel ?? trafficSource?.options[0]?.label ?? "";
  const showFixedSource =
    !canSelectSource &&
    (trafficSource?.mode === "ingress" || trafficSource?.mode === "clients") &&
    fixedSourceLabel !== "";

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
            data-tooltip={
              status === "stale"
                ? "Restart with your latest design changes"
                : undefined
            }
            data-tooltip-placement="bottom"
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
        <output
          className={`sim-toolbar__state sim-toolbar__state--${status}`}
          aria-label={SIMULATION_STATUS_LABELS[status]}
          data-tooltip={SIMULATION_STATUS_LABELS[status]}
          data-tooltip-placement="bottom"
        >
          <span className="sim-status-dot" aria-hidden="true" />
          <span className="sim-toolbar__state-label">
            {SIMULATION_STATUS_LABELS[status]}
          </span>
        </output>
        {trafficSource && trafficSource.mode !== "none" && (
          <div className="sim-toolbar__source">
            <MdAccountTree aria-hidden="true" size={15} />
            <span className="sim-toolbar__source-label">Traffic source</span>
            {canSelectSource && onTrafficSourceChange ? (
              <div
                className="sim-toolbar__source-dropdown"
                data-tooltip="Choose where simulated requests enter the diagram"
                data-tooltip-placement="bottom"
              >
                <SelectDropdown
                  id={`${id}-source`}
                  value={selectedSourceChoice?.label ?? "Choose a source"}
                  options={sourceChoices.map((choice) => choice.label)}
                  aria-label="Traffic entrypoint"
                  className="sim-toolbar__select-trigger sim-toolbar__select-trigger--source"
                  onChange={(label) => {
                    const choice = sourceChoices.find(
                      (option) => option.label === label,
                    );
                    if (!choice) return;
                    const nodeId = getChoiceNodeId(choice.value);
                    if (nodeId !== undefined) onTrafficSourceChange(nodeId);
                  }}
                />
              </div>
            ) : showFixedSource ? (
              <div
                className="sim-toolbar__source-dropdown"
                data-tooltip="This design has one traffic source, so there is nothing to choose"
                data-tooltip-placement="bottom"
              >
                <SelectDropdown
                  id={`${id}-source`}
                  value={fixedSourceLabel}
                  options={[fixedSourceLabel]}
                  aria-label="Traffic entrypoint (only one available)"
                  className="sim-toolbar__select-trigger sim-toolbar__select-trigger--source"
                  disabled
                  onChange={() => undefined}
                />
              </div>
            ) : (
              <span className="sim-toolbar__source-value">
                {getSourceReadout(trafficSource, sourceLabel)}
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
