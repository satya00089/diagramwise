import { useId } from "react";
import type { SimSnapshot, TrafficPattern } from "@diagramwise/simulation-core";
import { MdPause, MdPlayArrow, MdRefresh, MdTune, MdWarningAmber } from "react-icons/md";
import type { SimulationDiagnostic, SimulationStatus } from "./types";
import { SIMULATION_STATUS_LABELS } from "./types";
import { formatSimulationNumber, formatSimulationPercent } from "./presentation";
import "./simulation.css";

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
          <label htmlFor={`${id}-rps`}>Requests/sec</label>
          <input id={`${id}-rps`} className="sim-input sim-toolbar__number" type="number" min={0} max={100000} step={1} value={rps}
            onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) onRpsChange(Math.max(0, Math.min(100000, value))); }} />
          <input className="sim-toolbar__slider" type="range" min={0} max={5000} step={10} value={Math.min(5000, rps)} aria-label="Adjust incoming requests per second"
            onChange={(event) => onRpsChange(Number(event.currentTarget.value))} />
        </div>
        <label className="sim-toolbar__select">
          <span>Traffic</span>
          <select className="sim-input" value={pattern} onChange={(event) => onPatternChange(event.currentTarget.value as TrafficPattern)}>
            <option value="steady">Steady</option><option value="ramp">Ramp up</option><option value="spike">Burst</option><option value="diurnal">Daily cycle</option>
          </select>
        </label>
        <label className="sim-toolbar__select">
          <span>Playback</span>
          <select className="sim-input" value={speed} onChange={(event) => onSpeedChange(Number(event.currentTarget.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option>
          </select>
        </label>
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
