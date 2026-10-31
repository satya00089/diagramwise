import {
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  DEFAULT_TRAFFIC_PERIOD_S,
  trafficMultiplier,
  type HistoryPoint,
  type TrafficPattern,
} from "@diagramwise/simulation-core";
import {
  formatSimulationNumber,
  formatSimulationPercent,
} from "./presentation";

const WIDTH = 240;
const HEIGHT = 46;
const PAD_Y = 4;
/** Seconds of simulated time across the chart. */
const WINDOW_S = 60;
/** Seconds of the plan shown ahead of "now", so a coming burst is visible. */
const LOOKAHEAD_S = 20;
const PLAN_SAMPLES = 240;

export type TrafficChartProps = Readonly<{
  history: readonly HistoryPoint[];
  pattern: TrafficPattern;
  rps: number;
  timeMs: number;
  /** Simulated ms at which the current pattern began its cycle. */
  patternStartMs?: number;
  periodS?: number;
}>;

type Hover =
  | { kind: "live"; x: number; point: HistoryPoint }
  | { kind: "plan"; x: number; t: number; rate: number };

function LegendItem({
  series,
  children,
}: Readonly<{
  series: "plan" | "sent" | "completed" | "gap";
  children: ReactNode;
}>) {
  return (
    <span className="sim-traffic-chart__legend-item">
      <span
        className={`sim-traffic-chart__swatch sim-traffic-chart__swatch--${series}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </span>
  );
}

/** A rate in a fixed-width cell, so digits changing never move what follows. */
function LegendValue({ value }: Readonly<{ value: number | undefined }>) {
  return (
    <>
      <strong className="sim-traffic-chart__value">
        {/* Whole numbers from 10/s up: a decimal on a rate that size is noise
            and costs width in a legend this small. */}
        {value === undefined
          ? "—"
          : formatSimulationNumber(value >= 10 ? Math.round(value) : value)}
      </strong>
      {"/s"}
    </>
  );
}

/** Centred on the crosshair, but anchored inward near an edge so it is not clipped. */
function tooltipPosition(fraction: number): CSSProperties {
  const left = `${fraction * 100}%`;
  if (fraction < 0.3) return { left, transform: "none" };
  if (fraction > 0.7) return { left, transform: "translateX(-100%)" };
  return { left };
}

function linePath(points: ReadonlyArray<readonly [number, number]>): string {
  return points
    .map(
      ([px, py], index) =>
        `${index ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`,
    )
    .join(" ");
}

/**
 * The traffic a run is offered, drawn against the pattern's plan.
 *
 * The dashed line is the rate the pattern asks for, drawn ahead of "now" so
 * a reader sees a burst coming before it lands. The solid lines are what the
 * clients actually sent and what the system completed; the shaded gap between
 * them is work that failed or is still waiting.
 */
export function TrafficChart({
  history,
  pattern,
  rps,
  timeMs,
  patternStartMs = 0,
  periodS = DEFAULT_TRAFFIC_PERIOD_S,
}: TrafficChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const nowS = timeMs / 1000;
  const start = Math.max(0, nowS - (WINDOW_S - LOOKAHEAD_S));
  const cycleStartS = patternStartMs / 1000;
  const planAt = (t: number) =>
    rps * trafficMultiplier(pattern, t - cycleStartS, periodS);
  // The plan starts where the current pattern did: before a mid-run change
  // the solid line shows what the previous pattern actually sent.
  const planFrom = Math.max(start, cycleStartS);
  const plan = Array.from({ length: PLAN_SAMPLES + 1 }, (_, index) => {
    const t = planFrom + (index / PLAN_SAMPLES) * (start + WINDOW_S - planFrom);
    return [t, planAt(t)] as const;
  });
  const live = history.filter(
    (point) => point.t / 1000 >= start && point.t / 1000 <= nowS,
  );
  const peak = Math.max(
    1,
    ...plan.map(([, rate]) => rate),
    ...live.map((point) => point.offered),
  );
  const x = (t: number) => ((t - start) / WINDOW_S) * WIDTH;
  // Headroom above the peak, so a flat plan does not sit on the top edge.
  const top = peak * 1.2;
  const y = (rate: number) =>
    HEIGHT - PAD_Y - (Math.max(0, rate) / top) * (HEIGHT - 2 * PAD_Y);

  const sent = live.map(
    (point) => [x(point.t / 1000), y(point.offered)] as const,
  );
  const completed = live.map(
    (point) =>
      [x(point.t / 1000), y(Math.min(point.goodput, point.offered))] as const,
  );
  const gap =
    live.length > 1
      ? `${linePath(sent)} ${completed
          .slice()
          .reverse()
          .map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`)
          .join(" ")} Z`
      : "";
  const latest = live.at(-1);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    const t = start + (px / WIDTH) * WINDOW_S;
    if (t <= nowS && live.length) {
      let point = live[0];
      for (const candidate of live) {
        if (Math.abs(candidate.t / 1000 - t) < Math.abs(point.t / 1000 - t))
          point = candidate;
      }
      setHover({ kind: "live", x: x(point.t / 1000), point });
      return;
    }
    setHover({ kind: "plan", x: px, t, rate: planAt(t) });
  };

  const readout = latest
    ? `Sent ${formatSimulationNumber(latest.offered)} per second, completed ${formatSimulationNumber(latest.goodput)} per second.`
    : `Planned peak ${formatSimulationNumber(peak)} requests per second.`;

  return (
    <figure
      className="sim-traffic-chart"
      aria-label={`Traffic over time. ${readout}`}
    >
      <div className="sim-traffic-chart__plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <line
            className="sim-traffic-chart__baseline"
            x1={0}
            x2={WIDTH}
            y1={HEIGHT - PAD_Y}
            y2={HEIGHT - PAD_Y}
          />
          {gap && <path className="sim-traffic-chart__gap" d={gap} />}
          <path
            className="sim-traffic-chart__plan"
            d={linePath(plan.map(([t, rate]) => [x(t), y(rate)]))}
          />
          {sent.length > 1 && (
            <path className="sim-traffic-chart__sent" d={linePath(sent)} />
          )}
          {completed.length > 1 && (
            <path
              className="sim-traffic-chart__completed"
              d={linePath(completed)}
            />
          )}
          {timeMs > 0 && (
            <line
              className="sim-traffic-chart__now"
              x1={x(nowS)}
              x2={x(nowS)}
              y1={0}
              y2={HEIGHT}
            />
          )}
          {hover && (
            <line
              className="sim-traffic-chart__crosshair"
              x1={hover.x}
              x2={hover.x}
              y1={0}
              y2={HEIGHT}
            />
          )}
        </svg>
        {hover && (
          <output
            className="sim-traffic-chart__tooltip"
            style={tooltipPosition(hover.x / WIDTH)}
          >
            {hover.kind === "live" ? (
              <>
                <strong>
                  {formatSimulationNumber(hover.point.t / 1000)} s
                </strong>{" "}
                · sent {formatSimulationNumber(hover.point.offered)}/s ·
                completed {formatSimulationNumber(hover.point.goodput)}/s ·{" "}
                {formatSimulationPercent(hover.point.errorRate)} failed
              </>
            ) : (
              <>
                <strong>{formatSimulationNumber(hover.t)} s</strong> · planned{" "}
                {formatSimulationNumber(hover.rate)}/s
              </>
            )}
          </output>
        )}
      </div>
      <figcaption className="sim-traffic-chart__legend">
        {/* Always the same four items, so the legend never reflows as values
            change or when the first snapshot arrives. */}
        <LegendItem series="plan">Planned</LegendItem>
        <LegendItem series="gap">Failed or waiting</LegendItem>
        <LegendItem series="sent">
          Sent <LegendValue value={latest?.offered} />
        </LegendItem>
        <LegendItem series="completed">
          Completed <LegendValue value={latest?.goodput} />
        </LegendItem>
      </figcaption>
    </figure>
  );
}
