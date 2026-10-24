import { useEffect, useId, useState, type CSSProperties } from "react";
import type { SimSnapshot, TrafficPattern } from "@diagramwise/simulation-core";
import { MdPause, MdPlayArrow, MdRefresh, MdTune, MdWarningAmber } from "react-icons/md";
import SelectDropdown from "../shared/SelectDropdown";
import type { SimulationDiagnostic, SimulationStatus } from "./types";
import { SIMULATION_STATUS_LABELS } from "./types";
import { formatSimulationNumber, formatSimulationPercent } from "./presentation";
import "./simulation.css";

const TRAFFIC_OPTIONS: ReadonlyArray<{ value: TrafficPattern; label: string }> = [
  { value: "steady", label: "Steady" },
  { value: "ramp", label: "Ramp up" },
  { value: "spike", label: "Burst" },
  { value: "diurnal", label: "Daily cycle" },
];
const TRAFFIC_LABELS = TRAFFIC_OPTIONS.map(option => option.label);
const PLAYBACK_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 5, label: "5×" },
];
const PLAYBACK_LABELS = PLAYBACK_OPTIONS.map(option => option.label);

function rateToSlider(rate: number): number {
  const clamped = Math.min(100_000, Math.max(0, rate));
  return clamped <= 1_000 ? clamped / 2 : 500 + (Math.log(clamped / 1_000) / Math.log(100)) * 500;
}

function sliderToRate(position: number): number {
  if (position <= 500) return Math.round(position * 2);
  return Math.round(1_000 * 100 ** ((position - 500) / 500));
}

export type SimulationToolbarProps = {
  status: SimulationStatus;
  rps: number;
  pattern: TrafficPattern;
  speed: number;
  timeMs: number;
  snapshot: SimSnapshot | null;
  diagnostics?: readonly SimulationDiagnostic[];
  achievedSpeed?: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onRpsChange: (value: number) => void;
  onPatternChange: (value: TrafficPattern) => void;
  onSpeedChange: (value: number) => void;
  onInspect?: () => void;
  onDemo?: () => void;
};

export function SimulationToolbar({
  status, rps, pattern, speed, timeMs, snapshot, diagnostics = [], achievedSpeed,
  onStart, onPause, onReset, onRpsChange, onPatternChange, onSpeedChange, onInspect, onDemo,
}: SimulationToolbarProps) {
  const id = useId();
  const running = status === "running";
  const errors = diagnostics.filter((item) => item.severity === "error");
  const startLabel = status === "stale" ? "Restart with changes" : status === "paused" ? "Resume" : "Start simulation";
  const slower = running && achievedSpeed !== undefined && timeMs > 2000 && achievedSpeed < speed * 0.75;
  const sliderPosition = rateToSlider(rps);
  const rateProgress = `${sliderPosition / 10}%`;
  const [rateDraft, setRateDraft] = useState(String(rps));
  useEffect(() => setRateDraft(String(rps)), [rps]);

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
    <section className="sim-toolbar nodrag nopan" aria-label="Simulation controls">
      <div className="sim-toolbar__controls">
        <button type="button" className="sim-button sim-button--primary sim-toolbar__play" onClick={running ? onPause : onStart}>
          {running ? <MdPause aria-hidden="true" size={19} /> : <MdPlayArrow aria-hidden="true" size={19} />}
          {running ? "Pause" : startLabel}
        </button>
        <button type="button" className="sim-button sim-button--icon" onClick={onReset} aria-label="Reset simulation" title="Reset simulation">
          <MdRefresh aria-hidden="true" size={19} />
        </button>
        <div className="sim-toolbar__load">
          <label htmlFor={`${id}-rps`}>Requests / sec</label>
          <input id={`${id}-rps`} className="sim-input sim-toolbar__number" type="number" min={0} max={100000} step={1} value={rateDraft}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setRateDraft(value);
              if (value === "") return;
              const parsed = Number(value);
              if (Number.isFinite(parsed)) onRpsChange(Math.max(0, Math.min(100000, Math.round(parsed))));
            }}
            onBlur={commitRateDraft}
            onKeyDown={(event) => { if (event.key === "Enter") { commitRateDraft(); event.currentTarget.blur(); } }} />
          <input className="sim-toolbar__slider" type="range" min={0} max={1000} step={1} value={sliderPosition} aria-label="Adjust incoming requests per second"
            style={{ "--sim-rate-progress": rateProgress } as CSSProperties}
            onChange={(event) => onRpsChange(sliderToRate(Number(event.currentTarget.value)))} />
        </div>
        <div className="sim-toolbar__select">
          <span>Traffic</span>
          <SelectDropdown
            id={`${id}-traffic`}
            value={TRAFFIC_OPTIONS.find(option => option.value === pattern)?.label ?? TRAFFIC_OPTIONS[0].label}
            options={TRAFFIC_LABELS}
            aria-label="Traffic pattern"
            className="sim-toolbar__select-trigger sim-toolbar__select-trigger--traffic"
            onChange={(label) => {
              const entry = TRAFFIC_OPTIONS.find(option => option.label === label);
              if (entry) onPatternChange(entry.value);
            }}
          />
        </div>
        <div className="sim-toolbar__select">
          <span>Playback</span>
          <SelectDropdown
            id={`${id}-playback`}
            value={PLAYBACK_OPTIONS.find(option => option.value === speed)?.label ?? `${speed}×`}
            options={PLAYBACK_LABELS}
            aria-label="Playback speed"
            className="sim-toolbar__select-trigger sim-toolbar__select-trigger--playback"
            onChange={(label) => {
              const entry = PLAYBACK_OPTIONS.find(option => option.label === label);
              if (entry) onSpeedChange(entry.value);
            }}
          />
        </div>
        {onInspect && <button type="button" className="sim-button sim-button--icon" onClick={onInspect} aria-label="Open simulation details" title="Simulation details"><MdTune aria-hidden="true" size={19} /></button>}
      </div>
      <div className="sim-toolbar__readout">
        <span className={`sim-toolbar__state sim-toolbar__state--${status}`} role="status"><span className="sim-status-dot" aria-hidden="true" />{SIMULATION_STATUS_LABELS[status]}</span>
        {snapshot && <>
          <span><strong>{formatSimulationNumber(snapshot.system.goodputRps)}</strong> completed/s</span>
          <span className={snapshot.system.errorRate > 0 ? "sim-text-danger" : undefined}><strong>{formatSimulationPercent(snapshot.system.errorRate)}</strong> failed</span>
          <span className="sim-toolbar__clock">{formatSimulationNumber(timeMs / 1000)} s simulated</span>
        </>}
        {!snapshot && status === "idle" && <span>Start, increase traffic, and watch the paths.</span>}
        {onDemo && !running && !snapshot && <button type="button" className="sim-text-button" onClick={onDemo}>Try a repair challenge</button>}
      </div>
      {(errors.length > 0 || status === "resource-limited" || status === "error" || slower) && (
        <div className="sim-toolbar__notice">
          <MdWarningAmber aria-hidden="true" size={16} />
          <span>{status === "resource-limited" ? "This run reached a simulator limit. Its results are incomplete." : status === "error" ? "The simulation stopped. Your design is safe; reset and try again." : errors.length ? errors[0].message : `Processing at ${formatSimulationNumber(achievedSpeed ?? 0)}×. Simulated events are preserved.`}</span>
          {onInspect && <button type="button" className="sim-text-button" onClick={onInspect}>Details</button>}
        </div>
      )}
    </section>
  );
}
