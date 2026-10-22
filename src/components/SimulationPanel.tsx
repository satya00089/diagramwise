import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import {
  MdCheckCircle,
  MdInfoOutline,
  MdPause,
  MdPlayArrow,
  MdRefresh,
  MdStop,
  MdWarningAmber,
} from "react-icons/md";
import type {
  DesignReasoningContext,
  SystemDesignProblem,
  SystemDesignSolution,
} from "../types/systemDesign";
import type {
  SimulationInput,
  SimulationProfileCapacities,
  SimulationResult,
} from "../types/simulation";
import { prepareSimulation } from "../services/simulation";
import {
  buildProvidedReasoningContext,
  buildSystemDesignSolution,
} from "../utils/designReviewContext";
import { runCapacitySimulation } from "../utils/simulationEngine";

type SimulationPanelProps = {
  nodes: Node[];
  edges: Edge[];
  problem: SystemDesignProblem | null;
};

type RunState = "idle" | "running" | "paused" | "complete";

const INITIAL_CAPACITIES: SimulationProfileCapacities = {
  ingress: 5000,
  compute: 1500,
  cache: 10000,
  database: 600,
};

const formatRate = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

const readRouteText = (solution: SystemDesignSolution, ids: string[]) => {
  const byId = new Map(solution.components.map((component) => [component.id, component.label]));
  return ids.map((id) => byId.get(id) ?? id).join(" → ");
};

const SliderField: React.FC<{
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  help?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  help,
  disabled = false,
  onChange,
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-theme">
        {label}
      </label>
      <output
        htmlFor={id}
        className="shrink-0 text-sm font-semibold tabular-nums text-theme"
      >
        {formatRate(value)} {suffix}
      </output>
    </div>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-2 w-full cursor-pointer accent-[var(--product-accent)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2"
    />
    <div className="flex justify-between text-xs text-muted" aria-hidden="true">
      <span>{formatRate(min)}</span>
      <span>{formatRate(max)}</span>
    </div>
    {help && <p className="text-xs leading-5 text-muted">{help}</p>}
  </div>
);

function buildCapacityPath(
  points: SimulationResult["timeline"],
  key: "offeredRequestsPerSecond" | "servedRequestsPerSecond" | "backlog",
  width: number,
  height: number,
  maxValue: number,
) {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - (point[key] / Math.max(maxValue, 1)) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({ nodes, edges, problem }) => {
  const { setCenter } = useReactFlow();
  const reasoningContext = useMemo<DesignReasoningContext>(
    () => buildProvidedReasoningContext(problem, nodes, edges),
    [problem, nodes, edges],
  );
  const solution = useMemo(
    () => buildSystemDesignSolution(nodes, edges, reasoningContext),
    [nodes, edges, reasoningContext],
  );
  const graphFingerprint = useMemo(() => {
    const components = solution.components
      .filter((component) => (component.type as string) !== "group")
      .map(({ id, type, label, properties }) => ({
        id,
        type,
        label,
        properties,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const connections = solution.connections
      .map(({ id, source, target, type, label, description }) => ({
        id,
        source,
        target,
        type,
        label,
        description,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({
      components,
      connections,
      problem: problem
        ? {
            id: problem.id,
            title: problem.title,
            requirementRevision: problem.requirementSpec?.revision,
            description: problem.description,
          }
        : null,
    });
  }, [solution, problem]);

  const [preparation, setPreparation] = useState<
    Awaited<ReturnType<typeof prepareSimulation>> | null
  >(null);
  const [preparing, setPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparedFor, setPreparedFor] = useState<string | null>(null);
  const preparationController = useRef<AbortController | null>(null);
  const [requestRate, setRequestRate] = useState(1000);
  const [readSharePercent, setReadSharePercent] = useState(95);
  const [cacheHitPercent, setCacheHitPercent] = useState(90);
  const [profileCapacities, setProfileCapacities] =
    useState<SimulationProfileCapacities>(INITIAL_CAPACITIES);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isPreparedForCurrentGraph =
    preparation?.status === "ready" && preparedFor === graphFingerprint;
  const hasReadCache = Boolean(
    preparation?.routes
      .find((route) => route.operation === "read")
      ?.node_ids.some(
        (nodeId) =>
          preparation.component_roles.find((item) => item.node_id === nodeId)
            ?.role === "cache",
      ),
  );

  useEffect(() => {
    if (preparedFor && preparedFor !== graphFingerprint) {
      preparationController.current?.abort();
      setPreparation(null);
      setPreparedFor(null);
      setPreparationError(null);
      setResult(null);
      setRunState("idle");
      setElapsedSeconds(0);
    }
  }, [graphFingerprint, preparedFor]);

  useEffect(() => {
    if (runState !== "running" || !result) return;
    if (elapsedSeconds >= result.durationSeconds) {
      setRunState("complete");
      return;
    }
    const timer = window.setTimeout(
      () => setElapsedSeconds((current) => Math.min(current + 1, result.durationSeconds)),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [elapsedSeconds, result, runState]);

  useEffect(
    () => () => preparationController.current?.abort(),
    [],
  );

  const handlePrepare = useCallback(async () => {
    preparationController.current?.abort();
    const controller = new AbortController();
    preparationController.current = controller;
    setPreparation(null);
    setPreparing(true);
    setPreparationError(null);
    setResult(null);
    setRunState("idle");
    try {
      const prepared = await prepareSimulation(solution, problem, controller.signal);
      if (controller.signal.aborted) return;
      setPreparation(prepared);
      setPreparedFor(graphFingerprint);
      if (prepared.status !== "ready") {
        setPreparationError(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPreparationError(
          error instanceof Error
            ? error.message
            : "AI could not prepare this diagram. No simulation metrics were produced.",
        );
        setPreparedFor(null);
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  }, [graphFingerprint, problem, solution]);

  const currentInput: SimulationInput = {
    requestRate,
    readSharePercent,
    cacheHitPercent: hasReadCache ? cacheHitPercent : 0,
    durationSeconds: 30,
    profileCapacities,
  };

  const updateInput = <K extends keyof SimulationInput>(
    key: K,
    value: SimulationInput[K],
  ) => {
    if (key === "profileCapacities") {
      setProfileCapacities(value as SimulationProfileCapacities);
    } else if (key === "requestRate") {
      setRequestRate(value as number);
    } else if (key === "readSharePercent") {
      setReadSharePercent(value as number);
    } else if (key === "cacheHitPercent") {
      setCacheHitPercent(value as number);
    }
    setResult(null);
    setRunState("idle");
    setElapsedSeconds(0);
  };

  const handleRun = () => {
    if (!preparation || !isPreparedForCurrentGraph) return;
    try {
      const nextResult = runCapacitySimulation(solution, preparation, currentInput);
      setResult(nextResult);
      setElapsedSeconds(0);
      setRunState("running");
      setPreparationError(null);
    } catch (error) {
      setPreparationError(
        error instanceof Error ? error.message : "This workload could not be simulated.",
      );
    }
  };

  const handleFocusBottleneck = () => {
    const component = solution.components.find(
      (item) => item.id === result?.bottleneckNodeId,
    );
    if (!component) return;
    setCenter(component.position.x + 110, component.position.y + 55, {
      zoom: 1.1,
      duration: 350,
    });
  };

  const visibleTimeline = result?.timeline.slice(0, elapsedSeconds) ?? [];
  const chartMax = Math.max(
    requestRate,
    result?.bottleneckCapacityPerSecond ?? 0,
    1,
  );
  const backlogMax = Math.max(result?.projectedBacklog ?? 0, 1);
  const offeredPath = buildCapacityPath(visibleTimeline, "offeredRequestsPerSecond", 300, 86, chartMax);
  const servedPath = buildCapacityPath(visibleTimeline, "servedRequestsPerSecond", 300, 86, chartMax);
  const backlogPath = buildCapacityPath(visibleTimeline, "backlog", 300, 86, backlogMax);
  const bottleneck = result?.nodeMetrics.find(
    (metric) => metric.nodeId === result.bottleneckNodeId,
  );

  return (
    <section className="flex min-w-0 flex-col gap-4 text-theme" aria-labelledby="simulation-panel-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="simulation-panel-title" className="font-serif text-xl text-theme">
            Simulate this design
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Explore how its request paths behave under a workload you choose.
          </p>
        </div>
        {runState === "running" && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--product-accent)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--product-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Live · {String(elapsedSeconds).padStart(2, "0")}s
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs leading-5 text-muted">
        <MdInfoOutline className="mt-0.5 h-4 w-4 shrink-0 text-[var(--product-accent)]" aria-hidden="true" />
        <p>
          Educational estimate. AI checks the diagram paths; editable profiles estimate
          capacity. This does not measure a deployed system.
        </p>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold text-theme">Add components to begin</h3>
          <p className="mt-1 text-sm leading-5 text-muted">
            Draw a request path from a client through application logic to a database,
            then ask AI to prepare it for this model.
          </p>
        </div>
      ) : (
        <>
          {!preparation && (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-5 text-muted">
                AI will map the read and write paths and flag connections this model
                cannot explain. It will not set component capacities.
              </p>
              <button
                type="button"
                onClick={handlePrepare}
                disabled={preparing}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--product-accent)] px-4 py-2 text-sm font-semibold text-[var(--product-accent-contrast)] transition-colors hover:bg-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
              >
                {preparing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <MdRefresh className="h-4 w-4" aria-hidden="true" />
                )}
                {preparing ? "Checking paths…" : "Prepare with AI"}
              </button>
            </div>
          )}

          {preparation && (
            <div className="flex flex-col gap-3">
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-5 ${preparation.status === "ready" && preparedFor === graphFingerprint ? "border-emerald-700/30 bg-emerald-700/5" : "border-amber-700/35 bg-amber-700/5"}`}
              >
                {preparation.status === "ready" && preparedFor === graphFingerprint ? (
                  <MdCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                ) : (
                  <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
                )}
                <div>
                  <p className="font-semibold text-theme">
                    {preparation.status === "ready" && preparedFor === graphFingerprint
                      ? "Paths prepared"
                      : preparation.status === "blocked"
                        ? "This design is not ready to simulate"
                        : "Review the uncertain paths"}
                  </p>
                  <p className="mt-0.5 text-muted">{preparation.summary}</p>
                </div>
              </div>

              {(preparation.blockers.length > 0 || preparation.unresolved.length > 0) && (
                <ul className="flex flex-col gap-2 text-sm leading-5 text-theme">
                  {[...preparation.blockers, ...preparation.unresolved].map((item, index) => (
                    <li key={`${index}-${item}`} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--product-accent)]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
                <h3 className="text-sm font-semibold text-theme">Prepared paths</h3>
                {preparation.routes.map((route) => (
                  <div key={route.operation} className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {route.operation}
                    </p>
                    <p className="mt-0.5 break-words text-sm leading-5 text-theme">
                      {route.node_ids.length
                        ? readRouteText(solution, route.node_ids)
                        : "No supported route found"}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePrepare}
                disabled={preparing}
                className="self-start rounded px-1 py-1 text-sm font-medium text-[var(--product-accent)] underline underline-offset-4 hover:text-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
              >
                {preparing ? "Checking paths…" : "Check paths again"}
              </button>
            </div>
          )}

          {isPreparedForCurrentGraph && preparation && (
            <div className="flex flex-col gap-5 border-t border-[var(--border)] pt-4">
              <div>
                <h3 className="text-base font-semibold text-theme">Workload</h3>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  Change the incoming rate to find where the prepared paths exceed their profiles.
                </p>
              </div>

              <SliderField
                id="simulation-request-rate"
                label="Incoming traffic"
                value={requestRate}
                min={100}
                max={5000}
                step={50}
                suffix="req/s"
                onChange={(value) => updateInput("requestRate", value)}
              />

              <SliderField
                id="simulation-read-share"
                label={`Reads · ${readSharePercent}%`}
                value={readSharePercent}
                min={0}
                max={100}
                suffix="%"
                help={`Writes · ${100 - readSharePercent}%`}
                onChange={(value) => updateInput("readSharePercent", value)}
              />

              {hasReadCache && (
                <SliderField
                  id="simulation-cache-hit-rate"
                  label="Read cache hit assumption"
                  value={cacheHitPercent}
                  min={0}
                  max={100}
                  suffix="%"
                  help="Applied only because the prepared read route passes through a cache."
                  onChange={(value) => updateInput("cacheHitPercent", value)}
                />
              )}

              <details className="group rounded-lg border border-[var(--border)] px-3 py-2.5">
                <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]">
                  Component profiles · educational assumptions
                </summary>
                <div className="mt-3 flex flex-col gap-4">
                  <SliderField
                    id="simulation-database-capacity"
                    label="Database capacity per node"
                    value={profileCapacities.database}
                    min={100}
                    max={3000}
                    step={50}
                    suffix="ops/s"
                    help="Assumes one equal-cost data operation per read or write."
                    onChange={(value) =>
                      updateInput("profileCapacities", {
                        ...profileCapacities,
                        database: value,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                    <span>Ingress · assumed</span>
                    <span className="text-right tabular-nums">{formatRate(profileCapacities.ingress)} req/s</span>
                    <span>Compute · assumed</span>
                    <span className="text-right tabular-nums">{formatRate(profileCapacities.compute)} req/s per node</span>
                    {hasReadCache && (
                      <>
                        <span>Cache · assumed</span>
                        <span className="text-right tabular-nums">{formatRate(profileCapacities.cache)} ops/s</span>
                      </>
                    )}
                  </div>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                {runState === "running" ? (
                  <button
                    type="button"
                    onClick={() => setRunState("paused")}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
                  >
                    <MdPause className="h-4 w-4" aria-hidden="true" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={
                      runState === "paused" && result
                        ? () => setRunState("running")
                        : handleRun
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-[var(--product-accent)] px-3 py-2 text-sm font-semibold text-[var(--product-accent-contrast)] hover:bg-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2"
                  >
                    <MdPlayArrow className="h-4 w-4" aria-hidden="true" />
                    {runState === "paused"
                      ? "Resume"
                      : runState === "complete"
                        ? "Run again"
                        : "Run simulation"}
                  </button>
                )}
                {(result || runState === "paused" || runState === "running") && (
                  <button
                    type="button"
                    onClick={() => {
                      setRunState("idle");
                      setElapsedSeconds(0);
                      setResult(null);
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
                  >
                    <MdStop className="h-4 w-4" aria-hidden="true" /> Stop
                  </button>
                )}
                {runState === "complete" && (
                  <span className="text-xs font-medium text-muted">Run complete · {elapsedSeconds}s</span>
                )}
              </div>

              {result && (
                <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4" aria-live="polite">
                  {bottleneck ? (
                    <div className="rounded-lg border border-[var(--product-accent)]/40 bg-[var(--product-accent)]/5 p-3">
                      <p className="flex items-center gap-2 font-serif text-lg text-[var(--product-accent)]">
                        <MdWarningAmber className="h-5 w-5" aria-hidden="true" />
                        {bottleneck.label} is the bottleneck
                      </p>
                      <p className="mt-1 text-sm leading-5 text-theme">
                        Demand is {formatRate(result.bottleneckDemandPerSecond)} {bottleneck.unit} against
                        an assumed capacity of {formatRate(result.bottleneckCapacityPerSecond)} {bottleneck.unit}.
                      </p>
                      {result.backlogGrowthPerSecond > 0 && (
                        <p className="mt-1 text-sm font-medium text-theme">
                          Backlog grows by about {formatRate(result.backlogGrowthPerSecond)} operations each second.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleFocusBottleneck}
                        className="mt-2 rounded px-1 py-1 text-sm font-semibold text-[var(--product-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
                      >
                        View on canvas
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-700/30 bg-emerald-700/5 p-3 text-sm leading-5 text-theme">
                      <MdCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                      <span>No component exceeds its configured educational capacity at this load.</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-theme">Run timeline</h3>
                      <span className="text-xs tabular-nums text-muted">
                        {elapsedSeconds}s / {result.durationSeconds}s
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 300 110"
                      className="h-auto w-full overflow-visible"
                      role="img"
                      aria-label={`Run timeline. Offered ${formatRate(requestRate)} requests per second, served ${formatRate(result.maxSustainableRequestsPerSecond)} per second, backlog ${formatRate((result.backlogGrowthPerSecond * elapsedSeconds))} operations.`}
                    >
                      <line x1="0" y1="86" x2="300" y2="86" stroke="var(--border)" strokeWidth="1" />
                      <line x1="0" y1="43" x2="300" y2="43" stroke="var(--border)" strokeWidth="1" opacity="0.55" />
                      <path d={offeredPath} fill="none" stroke="var(--product-accent)" strokeWidth="2.5" />
                      <path d={servedPath} fill="none" stroke="var(--text)" strokeWidth="2" />
                      {result.backlogGrowthPerSecond > 0 && (
                        <path d={backlogPath} fill="none" stroke="#d9879e" strokeWidth="2" strokeDasharray="4 3" />
                      )}
                      <text x="0" y="103" fill="var(--muted)" fontSize="10">0s</text>
                      <text x="270" y="103" fill="var(--muted)" fontSize="10">{result.durationSeconds}s</text>
                    </svg>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--product-accent)]" aria-hidden="true" />Offered · {formatRate(requestRate)} req/s</span>
                      <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-theme" aria-hidden="true" />Capacity · {formatRate(result.maxSustainableRequestsPerSecond)} req/s</span>
                      {result.backlogGrowthPerSecond > 0 && (
                        <span className="col-span-2 inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#d9879e]" aria-hidden="true" />Backlog · {formatRate(result.backlogGrowthPerSecond * elapsedSeconds)} ops · separate scale</span>
                      )}
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
                    <dt className="text-muted">Total requests in run</dt>
                    <dd className="text-right font-medium tabular-nums text-theme">{formatRate(result.totalRequests)}</dd>
                    <dt className="text-muted">Estimated sustainable rate</dt>
                    <dd className="text-right font-medium tabular-nums text-theme">{formatRate(result.maxSustainableRequestsPerSecond)} req/s</dd>
                    <dt className="text-muted">Backlog after run</dt>
                    <dd className="text-right font-medium tabular-nums text-theme">{formatRate(result.backlogGrowthPerSecond * elapsedSeconds)} ops</dd>
                  </dl>

                  {preparation.assumptions.length > 0 && (
                    <details className="rounded-lg border border-[var(--border)] px-3 py-2.5">
                      <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]">
                        AI preparation assumptions
                      </summary>
                      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-xs leading-5 text-muted">
                        {preparation.assumptions.map((assumption, index) => (
                          <li key={`${index}-${assumption}`}>{assumption}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {preparationError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-700/35 bg-red-700/5 p-3 text-sm leading-5 text-theme">
              <MdWarningAmber className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
              <div>
                <p>{preparationError}</p>
                {!preparing && !preparation && (
                  <button
                    type="button"
                    onClick={handlePrepare}
                    className="mt-1 rounded px-1 py-1 font-semibold text-[var(--product-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
                  >
                    Retry preparation
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default SimulationPanel;
