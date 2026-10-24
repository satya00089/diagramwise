import { useId, type CSSProperties } from "react";
import type { SimSnapshot, TrafficPattern } from "@diagramwise/simulation-core";
import { MdPause, MdPlayArrow, MdRefresh, MdTune, MdWarningAmber } from "react-icons/md";
import SelectDropdown from "../shared/SelectDropdown";
import type { SimulationDiagnostic, SimulationStatus } from "./types";
import { SIMULATION_STATUS_LABELS } from "./types";
import { formatSimulationNumber, formatSimulationPercent } from "./presentation";
import "./simulation.css";

const TRAFFIC_OPTIONS: Readonly<Record<TrafficPattern, string>> = {
  steady: "Steady",
  ramp: "Ramp up",
  spike: "Burst",
  diurnal: "Daily cycle",
};
const PLAYBACK_OPTIONS: Readonly<Record<number, string>> = {
  0.5: "0.5×",
  1: "1×",
  2: "2×",
  5: "5×",
};

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
  const rateProgress = `${Math.min(100, Math.max(0, rps / 1000))}%`;

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
          <input id={`${id}-rps`} className="sim-input sim-toolbar__number" type="number" min={0} max={100000} step={1} value={rps}
            onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) onRpsChange(Math.max(0, Math.min(100000, value))); }} />
          <input className="sim-toolbar__slider" type="range" min={0} max={100000} step={1} value={rps} aria-label="Adjust incoming requests per second"
            style={{ "--sim-rate-progress": rateProgress } as CSSProperties}
            onChange={(event) => onRpsChange(Number(event.currentTarget.value))} />
        </div>
        <div className="sim-toolbar__select">
          <span>Traffic</span>
          <SelectDropdown
            id={`${id}-traffic`}
            value={TRAFFIC_OPTIONS[pattern]}
            options={Object.values(TRAFFIC_OPTIONS)}
            aria-label="Traffic pattern"
            className="sim-toolbar__select-trigger sim-toolbar__select-trigger--traffic"
            onChange={(label) => {
              const entry = (Object.entries(TRAFFIC_OPTIONS) as [TrafficPattern, string][]).find(([, value]) => value === label);
              if (entry) onPatternChange(entry[0]);
            }}
          />
        </div>
        <div className="sim-toolbar__select">
          <span>Playback</span>
          <SelectDropdown
            id={`${id}-playback`}
            value={PLAYBACK_OPTIONS[speed] ?? `${speed}×`}
            options={Object.values(PLAYBACK_OPTIONS)}
            aria-label="Playback speed"
            className="sim-toolbar__select-trigger sim-toolbar__select-trigger--playback"
            onChange={(label) => {
              const entry = Object.entries(PLAYBACK_OPTIONS).find(([, value]) => value === label);
              if (entry) onSpeedChange(Number(entry[0]));
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
