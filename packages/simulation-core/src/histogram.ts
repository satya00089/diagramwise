/**
 * Deterministic, bounded latency histograms.
 *
 * Nonzero buckets span at most 1% of their lower bound. Quantiles return the
 * bucket's upper bound, so aggregation never understates an in-range sample.
 * Values below one microsecond and above one hour are clamped to those limits.
 * Zero has its own bucket. These are model observations, not real benchmarks.
 */
export const LATENCY_MIN_MS = 0.001;
export const LATENCY_MAX_MS = 3_600_000;
export const LATENCY_BUCKET_RATIO = 1.01;
export const LATENCY_WINDOW_MS = 5_000;
export const LATENCY_TIME_BUCKET_MS = 500;

const LOG_RATIO = Math.log(LATENCY_BUCKET_RATIO);
const POSITIVE_BUCKETS =
  Math.ceil(Math.log(LATENCY_MAX_MS / LATENCY_MIN_MS) / LOG_RATIO) + 1;
const BUCKET_COUNT = POSITIVE_BUCKETS + 1;
const TIME_BUCKET_COUNT = LATENCY_WINDOW_MS / LATENCY_TIME_BUCKET_MS;

/** Only finite durations are observations. Negative finite durations clamp to 0. */
function bucketFor(ms: number): number {
  if (ms <= 0) return 0;
  const bounded = Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms));
  return Math.min(
    BUCKET_COUNT - 1,
    1 + Math.max(0, Math.ceil(Math.log(bounded / LATENCY_MIN_MS) / LOG_RATIO)),
  );
}

function upperBound(bucket: number): number {
  return bucket === 0
    ? 0
    : Math.min(
        LATENCY_MAX_MS,
        LATENCY_MIN_MS * LATENCY_BUCKET_RATIO ** (bucket - 1),
      );
}

function quantileOf(buckets: Float64Array, count: number, p: number): number {
  if (count === 0) return 0;
  const fraction = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
  const rank = Math.max(1, Math.ceil(fraction * count));
  let seen = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    seen += buckets[i];
    if (seen >= rank) return upperBound(i);
  }
  // Only reachable after floating-point integer precision is exhausted.
  return LATENCY_MAX_MS;
}

/** A cumulative histogram for a controlled evaluation cohort. */
export class LatencyHistogram {
  private readonly buckets = new Float64Array(BUCKET_COUNT);
  private observations = 0;

  get count(): number {
    return this.observations;
  }

  record(ms: number): void {
    if (!Number.isFinite(ms)) return;
    this.buckets[bucketFor(ms)] += 1;
    this.observations += 1;
  }

  quantile(p: number): number {
    return quantileOf(this.buckets, this.observations, p);
  }

  reset(): void {
    this.buckets.fill(0);
    this.observations = 0;
  }
}

/**
 * A trailing five-second histogram with 500ms time resolution.
 *
 * The current time bucket and its nine predecessors are retained. The oldest
 * bucket expires as a unit, so the covered interval is between 4.5 and 5s.
 * Snapshot methods only read event data; how often a UI polls cannot affect the
 * next result. Storage remains fixed regardless of traffic volume.
 */
export class RollingLatencyHistogram {
  private readonly buckets = Array.from(
    { length: TIME_BUCKET_COUNT },
    () => new Float64Array(BUCKET_COUNT),
  );
  private readonly epochs = new Float64Array(TIME_BUCKET_COUNT).fill(-1);
  private readonly counts = new Float64Array(TIME_BUCKET_COUNT);
  private readonly scratch = new Float64Array(BUCKET_COUNT);
  private newestEpoch = -1;

  add(nowMs: number, latencyMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isFinite(latencyMs))
      return;
    const epoch = Math.floor(nowMs / LATENCY_TIME_BUCKET_MS);
    if (epoch < this.newestEpoch) {
      throw new RangeError(
        "Latency observations must arrive in simulated-time order.",
      );
    }
    this.newestEpoch = epoch;
    const slot = epoch % TIME_BUCKET_COUNT;
    if (this.epochs[slot] !== epoch) {
      this.buckets[slot].fill(0);
      this.counts[slot] = 0;
      this.epochs[slot] = epoch;
    }
    this.buckets[slot][bucketFor(latencyMs)] += 1;
    this.counts[slot] += 1;
  }

  sampleCount(nowMs: number): number {
    if (!Number.isFinite(nowMs) || nowMs < 0) return 0;
    const current = Math.floor(nowMs / LATENCY_TIME_BUCKET_MS);
    const first = current - TIME_BUCKET_COUNT + 1;
    let count = 0;
    for (let i = 0; i < TIME_BUCKET_COUNT; i += 1) {
      if (this.epochs[i] >= first && this.epochs[i] <= current)
        count += this.counts[i];
    }
    return count;
  }

  percentiles(nowMs: number, out: Float64Array): void {
    if (out.length < 3)
      throw new RangeError("Percentile output needs three entries.");
    this.scratch.fill(0);
    const count = this.sampleCount(nowMs);
    if (count === 0) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      return;
    }
    const current = Math.floor(nowMs / LATENCY_TIME_BUCKET_MS);
    const first = current - TIME_BUCKET_COUNT + 1;
    for (let i = 0; i < TIME_BUCKET_COUNT; i += 1) {
      if (this.epochs[i] < first || this.epochs[i] > current) continue;
      const samples = this.buckets[i];
      for (let j = 0; j < BUCKET_COUNT; j += 1) this.scratch[j] += samples[j];
    }
    out[0] = quantileOf(this.scratch, count, 0.5);
    out[1] = quantileOf(this.scratch, count, 0.95);
    out[2] = quantileOf(this.scratch, count, 0.99);
  }

  reset(): void {
    for (const bucket of this.buckets) bucket.fill(0);
    this.epochs.fill(-1);
    this.counts.fill(0);
    this.scratch.fill(0);
    this.newestEpoch = -1;
  }
}
