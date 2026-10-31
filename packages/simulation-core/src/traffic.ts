import type { TrafficPattern } from "./types";

/* Traffic pattern shape. Chosen so a spike's MEAN over one cycle stays near
   the baseline: the reader compares the same work arriving unevenly, not more
   of it. 0.9 quiet at 0.1x plus 0.1 loud at 4x averages 0.49x, near enough
   that the comparison is about burstiness rather than volume. */
export const SPIKE_QUIET_FRACTION = 0.9;
export const SPIKE_PEAK = 4;
export const SPIKE_TROUGH = 0.1;

/* A day swings between a quarter of the baseline and twice it. */
export const DIURNAL_TROUGH = 0.25;
export const DIURNAL_PEAK = 2;

/**
 * How far a pattern scales the baseline rate at simulated second `nowS`.
 *
 * The single definition of each shape, shared by the engine, which offers
 * this rate, and the UI, which previews it, so the curve a reader is shown
 * is the curve that arrives. A pure function of time: no state and no RNG.
 */
export function trafficMultiplier(
  pattern: TrafficPattern | undefined,
  nowS: number,
  periodS: number,
): number {
  if (!pattern || pattern === "steady") return 1;
  if (periodS <= 0 || Number.isNaN(periodS)) return 1;

  const phase = (nowS % periodS) / periodS;

  switch (pattern) {
    case "ramp":
      // Climbs over the first cycle and holds. Past one period the reader
      // is watching a system at full load, which is the point of a ramp:
      // it is how you got there that differs, not where you end up.
      return nowS >= periodS ? 1 : phase;
    case "spike":
      // Quiet, then a burst in the last tenth of the cycle. The burst is
      // 4x the baseline and the quiet is a tenth of it, so the MEAN over a
      // cycle stays near the baseline: the reader is comparing the same
      // amount of work arriving unevenly, not simply more work.
      return phase >= SPIKE_QUIET_FRACTION ? SPIKE_PEAK : SPIKE_TROUGH;
    case "diurnal": {
      // A day as a cosine between a quarter of the baseline and twice it.
      // Smooth because real daily traffic has no corners, and offset so a
      // run starts in the small hours rather than mid-peak.
      const swing = (1 - Math.cos(2 * Math.PI * phase)) / 2;
      return DIURNAL_TROUGH + (DIURNAL_PEAK - DIURNAL_TROUGH) * swing;
    }
    default:
      return 1;
  }
}
