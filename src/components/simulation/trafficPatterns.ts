import {
  DEFAULT_TRAFFIC_PERIOD_S,
  DIURNAL_PEAK,
  DIURNAL_TROUGH,
  SPIKE_PEAK,
  SPIKE_QUIET_FRACTION,
  SPIKE_TROUGH,
  type TrafficPattern,
} from "@diagramwise/simulation-core";
import { formatSimulationNumber } from "./presentation";

/* The run's day starts in the small hours, so the cosine's peak at mid-cycle
   lands in the afternoon. Must match the shape in simulation-core/traffic. */
const DAY_START_HOUR = 3;

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
const times = (multiplier: number) => `${formatSimulationNumber(multiplier)}×`;
const seconds = (value: number) => `${formatSimulationNumber(value)} s`;

export const TRAFFIC_OPTIONS: ReadonlyArray<{
  value: TrafficPattern;
  label: string;
}> = [
  { value: "steady", label: "Steady" },
  { value: "ramp", label: "Ramp up" },
  { value: "spike", label: "Burst" },
  { value: "diurnal", label: "Daily cycle" },
];

export function trafficPatternLabel(pattern: TrafficPattern): string {
  return (
    TRAFFIC_OPTIONS.find((option) => option.value === pattern)?.label ??
    TRAFFIC_OPTIONS[0].label
  );
}

/** One sentence on what the pattern does to the rate, and what it tests. */
export function trafficPatternSummary(
  pattern: TrafficPattern,
  periodS = DEFAULT_TRAFFIC_PERIOD_S,
): string {
  switch (pattern) {
    case "ramp":
      return `Climbs from zero to your rate over ${seconds(periodS)}, then holds. Shows the point where the design starts to struggle.`;
    case "spike": {
      const quietS = periodS * SPIKE_QUIET_FRACTION;
      return `${percent(SPIKE_TROUGH)} of your rate for ${seconds(quietS)}, then ${times(SPIKE_PEAK)} for ${seconds(periodS - quietS)}, repeating. Tests queues and timeouts.`;
    }
    case "diurnal":
      return `One simulated day every ${seconds(periodS)}: ${percent(DIURNAL_TROUGH)} of your rate overnight, ${times(DIURNAL_PEAK)} at the afternoon peak. A design sized for the average falls behind at the peak.`;
    default:
      return "Your rate, held constant. The baseline to compare the other patterns against.";
  }
}

function partOfDay(hour: number): string {
  if (hour < 6) return "overnight";
  if (hour < 12) return "morning climb";
  if (hour < 18) return "peak hours";
  return "evening fall";
}

/** Where the pattern is right now, for a running or paused simulation. */
export function trafficPatternPhase(
  pattern: TrafficPattern,
  timeS: number,
  periodS = DEFAULT_TRAFFIC_PERIOD_S,
): string {
  const intoCycle = timeS % periodS;
  switch (pattern) {
    case "ramp":
      return timeS >= periodS
        ? "Holding at your rate"
        : `Ramping · ${percent(timeS / periodS)} of your rate`;
    case "spike": {
      const burstStart = periodS * SPIKE_QUIET_FRACTION;
      return intoCycle >= burstStart
        ? `Burst now · ${times(SPIKE_PEAK)}`
        : `Next burst in ${seconds(Math.ceil(burstStart - intoCycle))}`;
    }
    case "diurnal": {
      const hour = (DAY_START_HOUR + (intoCycle / periodS) * 24) % 24;
      const clock = `${String(Math.floor(hour)).padStart(2, "0")}:${String(
        Math.floor((hour % 1) * 60),
      ).padStart(2, "0")}`;
      return `Simulated ${clock} · ${partOfDay(hour)}`;
    }
    default:
      return "Steady rate";
  }
}
