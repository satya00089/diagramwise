import { describe, expect, it } from "vitest";
import {
  LATENCY_MAX_MS,
  LATENCY_MIN_MS,
  LatencyHistogram,
  RollingLatencyHistogram,
} from "./histogram";

function expectWithinBucket(actual: number, expected: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected * (1 - 1e-12));
  expect(actual).toBeLessThanOrEqual(expected * 1.01 * (1 + 1e-12));
}

describe("LatencyHistogram", () => {
  it("is empty until a finite observation arrives and resets completely", () => {
    const histogram = new LatencyHistogram();
    expect(histogram.quantile(0.99)).toBe(0);
    for (const ms of [NaN, Infinity, -Infinity]) histogram.record(ms);
    expect(histogram.count).toBe(0);
    histogram.record(42);
    expect(histogram.count).toBe(1);
    histogram.reset();
    expect(histogram.count).toBe(0);
    expect(histogram.quantile(0.5)).toBe(0);
  });

  it("keeps every observation and estimates percentiles within 1%", () => {
    const histogram = new LatencyHistogram();
    for (let ms = 1; ms <= 10_000; ms += 1) histogram.record(ms);
    expect(histogram.count).toBe(10_000);
    expectWithinBucket(histogram.quantile(0.5), 5_000);
    expectWithinBucket(histogram.quantile(0.95), 9_500);
    expectWithinBucket(histogram.quantile(0.99), 9_900);
  });

  it("preserves zero and bounds finite observations to the declared range", () => {
    const histogram = new LatencyHistogram();
    histogram.record(-1);
    histogram.record(0);
    histogram.record(LATENCY_MIN_MS / 10);
    histogram.record(LATENCY_MAX_MS * 10);
    expect(histogram.count).toBe(4);
    expect(histogram.quantile(0.5)).toBe(0);
    expect(histogram.quantile(0.75)).toBe(LATENCY_MIN_MS);
    expect(histogram.quantile(1)).toBe(LATENCY_MAX_MS);
  });

  it("retains accuracy over the full representable scale", () => {
    for (const sample of [
      0.001, 0.00101, 0.1, 1, 17, 100, 10_000, 500_000, 3_600_000,
    ]) {
      const histogram = new LatencyHistogram();
      histogram.record(sample);
      expectWithinBucket(histogram.quantile(0.99), sample);
    }
  });
});

describe("RollingLatencyHistogram", () => {
  it("reports sample adequacy and expires whole 500ms buckets", () => {
    const histogram = new RollingLatencyHistogram();
    const output = new Float64Array(3);
    histogram.percentiles(0, output);
    expect([...output]).toEqual([0, 0, 0]);
    expect(histogram.sampleCount(0)).toBe(0);
    histogram.add(0, 10);
    histogram.add(499, 20);
    histogram.add(500, 30);
    expect(histogram.sampleCount(4_999)).toBe(3);
    expect(histogram.sampleCount(5_000)).toBe(1);
    expect(histogram.sampleCount(5_500)).toBe(0);
    histogram.percentiles(5_500, output);
    expect([...output]).toEqual([0, 0, 0]);
  });

  it("includes all observations at high load instead of strided samples", () => {
    const histogram = new RollingLatencyHistogram();
    const output = new Float64Array(3);
    for (let i = 0; i < 100_000; i += 1)
      histogram.add(100, i < 98_000 ? 10 : 1_000);
    histogram.percentiles(100, output);
    expect(histogram.sampleCount(100)).toBe(100_000);
    expectWithinBucket(output[0], 10);
    expectWithinBucket(output[1], 10);
    expectWithinBucket(output[2], 1_000);
  });

  it("is independent of snapshot polling including future reads", () => {
    const a = new RollingLatencyHistogram();
    const b = new RollingLatencyHistogram();
    const output = new Float64Array(3);
    for (let now = 0; now <= 12_000; now += 100) {
      a.add(now, now + 1);
      b.add(now, now + 1);
      a.percentiles(now, output);
      a.percentiles(now + 60_000, output);
      a.sampleCount(now + 60_000);
    }
    const other = new Float64Array(3);
    a.percentiles(12_000, output);
    b.percentiles(12_000, other);
    expect([...output]).toEqual([...other]);
    expect(a.sampleCount(12_000)).toBe(b.sampleCount(12_000));
  });

  it("resets all time state and rejects observations from past epochs", () => {
    const histogram = new RollingLatencyHistogram();
    histogram.add(5_000, 100);
    expect(() => histogram.add(0, 1)).toThrow(RangeError);
    histogram.reset();
    expect(histogram.sampleCount(5_000)).toBe(0);
    histogram.add(0, 1);
    expect(histogram.sampleCount(0)).toBe(1);
  });
});
