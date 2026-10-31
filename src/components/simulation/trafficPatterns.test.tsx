import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryPoint } from "@diagramwise/simulation-core";
import { TrafficChart } from "./TrafficChart";
import { trafficPatternPhase, trafficPatternSummary } from "./trafficPatterns";

describe("traffic pattern text", () => {
  it("states each pattern's numbers from the engine's own shape", () => {
    expect(trafficPatternSummary("spike")).toContain(
      "10% of your rate for 54 s",
    );
    expect(trafficPatternSummary("spike")).toContain("4× for 6 s");
    expect(trafficPatternSummary("diurnal")).toContain(
      "2× at the afternoon peak",
    );
    expect(trafficPatternSummary("ramp")).toContain("over 60 s");
  });

  it("counts down to the next burst and names the burst while it lands", () => {
    expect(trafficPatternPhase("spike", 10)).toBe("Next burst in 44 s");
    expect(trafficPatternPhase("spike", 55)).toBe("Burst now · 4×");
    expect(trafficPatternPhase("spike", 70)).toBe("Next burst in 44 s");
  });

  it("reports ramp progress, then the hold", () => {
    expect(trafficPatternPhase("ramp", 15)).toBe("Ramping · 25% of your rate");
    expect(trafficPatternPhase("ramp", 61)).toBe("Holding at your rate");
  });

  it("puts the daily peak in the afternoon", () => {
    expect(trafficPatternPhase("diurnal", 0)).toBe(
      "Simulated 03:00 · overnight",
    );
    expect(trafficPatternPhase("diurnal", 30)).toBe(
      "Simulated 15:00 · peak hours",
    );
  });
});

describe("TrafficChart", () => {
  const point = (
    t: number,
    offered: number,
    goodput: number,
  ): HistoryPoint => ({
    t,
    offered,
    goodput,
    errorRate: offered > 0 ? 1 - goodput / offered : 0,
    p50: 10,
    p95: 20,
    p99: 30,
  });

  it("previews the plan before a run, with no live series", () => {
    const html = renderToStaticMarkup(
      <TrafficChart history={[]} pattern="spike" rps={100} timeMs={0} />,
    );
    expect(html).toContain("sim-traffic-chart__plan");
    expect(html).not.toContain("sim-traffic-chart__sent");
    expect(html).toContain("Planned peak 400 requests per second");
  });

  it("draws sent, completed and the gap between them once running", () => {
    const history = [
      point(1000, 100, 100),
      point(2000, 400, 190),
      point(3000, 400, 180),
    ];
    const html = renderToStaticMarkup(
      <TrafficChart
        history={history}
        pattern="steady"
        rps={400}
        timeMs={3000}
      />,
    );
    expect(html).toContain("sim-traffic-chart__sent");
    expect(html).toContain("sim-traffic-chart__completed");
    expect(html).toContain("sim-traffic-chart__gap");
    expect(html).toContain("Sent 400 per second, completed 180 per second");
  });
});
