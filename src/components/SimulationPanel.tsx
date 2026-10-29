import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Edge, Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import {
  MdCheckCircle,
  MdInfoOutline,
  MdRefresh,
  MdWarningAmber,
} from "react-icons/md";
import type {
  DesignReasoningContext,
  SystemDesignProblem,
  SystemDesignSolution,
} from "../types/systemDesign";
import type {
  SimulationCapacityRole,
  SimulationInput,
  SimulationInputProvenance,
  SimulationResult,
  SimulationRole,
  SimulationRunSnapshot,
} from "../types/simulation";
import { prepareSimulation } from "../services/simulation";
import {
  buildProvidedReasoningContext,
  buildSystemDesignSolution,
} from "../utils/designReviewContext";
import { runCapacitySimulationInWorker } from "../utils/simulationWorker";
import { apiService } from "../services/api";
import type { SimulationSavedRun } from "../services/api";
import { useAuth } from "../hooks/useAuth";

type SimulationPanelProps = Readonly<{
  nodes: Node[];
  edges: Edge[];
  problem: SystemDesignProblem | null;
}>;

type PreparationResult = NonNullable<
  Awaited<ReturnType<typeof prepareSimulation>>
>;

const INITIAL_INPUT: SimulationInput = {
  scenarioId: "url-shortener-capacity",
  scenarioVersion: "1",
  modelVersion: "capacity-v1",
  requestRate: 1000,
  redirectSharePercent: 95,
  cacheHitPercent: 90,
  profileCapacities: {
    ingress: 5000,
    compute: 1500,
    cache: 10000,
    database: 600,
  },
  provenance: {
    requestRate: "educational-default",
    redirectSharePercent: "educational-default",
    cacheHitPercent: "educational-default",
    profileCapacities: {
      ingress: "educational-default",
      compute: "educational-default",
      cache: "educational-default",
      database: "educational-default",
    },
  },
};

const CAPACITY_ROLES: SimulationCapacityRole[] = [
  "ingress",
  "compute",
  "cache",
  "database",
];

const ROLE_LABELS: Record<SimulationCapacityRole, string> = {
  ingress: "Ingress",
  compute: "Compute",
  cache: "Cache",
  database: "Database",
};

const formatRate = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

function getCapacityUnit(role: SimulationCapacityRole): string {
  if (role === "cache" || role === "database") return "ops/s";
  return "req/s";
}

function getRouteOperationLabel(operation: string): string {
  if (operation === "redirect") return "Redirect";
  if (operation === "create-link") return "Create link";
  return operation;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

const fingerprintValue = (value: unknown): string => {
  const serialized = JSON.stringify(value) ?? "";
  return [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => {
      let hash = seed;
      for (let index = 0; index < serialized.length; index += 1) {
        hash = Math.imul(hash ^ serialized.charCodeAt(index), 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    })
    .join("");
};

const provenanceLabel = (source: SimulationInputProvenance) =>
  source === "user" ? "your override" : "educational default";

const readRouteText = (solution: SystemDesignSolution, ids: string[]) => {
  const byId = new Map(
    solution.components.map((component) => [component.id, component.label]),
  );
  return ids.map((id) => byId.get(id) ?? id).join(" → ");
};

const snapshotPreparedRoutes = (
  solution: SystemDesignSolution,
  preparation: NonNullable<Awaited<ReturnType<typeof prepareSimulation>>>,
) => {
  const labelsById = new Map(
    solution.components.map((component) => [component.id, component.label]),
  );
  return preparation.routes.map((route) => ({
    operation: route.operation,
    nodeIds: [...route.node_ids],
    edgeIds: [...route.edge_ids],
    nodeLabels: route.node_ids.map((id) => labelsById.get(id) ?? id),
    explanation: route.explanation,
  }));
};

const fingerprintPreparation = (
  preparation: NonNullable<Awaited<ReturnType<typeof prepareSimulation>>>,
) =>
  JSON.stringify({
    componentRoles: preparation.component_roles
      .map(({ node_id, role }) => ({ node_id, role }))
      .sort((a, b) => a.node_id.localeCompare(b.node_id)),
    routes: preparation.routes
      .map(({ operation, node_ids, edge_ids }) => ({
        operation,
        node_ids,
        edge_ids,
      }))
      .sort((a, b) => a.operation.localeCompare(b.operation)),
  });

const copyInput = (input: SimulationInput): SimulationInput => ({
  ...input,
  profileCapacities: { ...input.profileCapacities },
  provenance: {
    ...input.provenance,
    profileCapacities: { ...input.provenance.profileCapacities },
  },
});

function snapshotHasRedirectCache(snapshot: SimulationRunSnapshot): boolean {
  const redirectRoute = snapshot.preparedRoutes.find(
    (route) => route.operation === "redirect",
  );
  return Boolean(
    redirectRoute?.nodeIds.some((nodeId) =>
      snapshot.componentRoles.some(
        (component) =>
          component.nodeId === nodeId && component.role === "cache",
      ),
    ),
  );
}

function describeInputChanges(
  baselineRun: SimulationRunSnapshot,
  currentRun: SimulationRunSnapshot,
): string[] {
  const baseline = baselineRun.input;
  const current = currentRun.input;
  const changes: string[] = [];
  if (
    baseline.requestRate !== current.requestRate ||
    baseline.provenance.requestRate !== current.provenance.requestRate
  ) {
    changes.push(
      `Traffic: ${formatRate(baseline.requestRate)} → ${formatRate(current.requestRate)} req/s (${provenanceLabel(baseline.provenance.requestRate)} → ${provenanceLabel(current.provenance.requestRate)})`,
    );
  }
  if (
    baseline.redirectSharePercent !== current.redirectSharePercent ||
    baseline.provenance.redirectSharePercent !==
      current.provenance.redirectSharePercent
  ) {
    changes.push(
      `Redirect share: ${formatRate(baseline.redirectSharePercent)}% → ${formatRate(current.redirectSharePercent)}% (${provenanceLabel(baseline.provenance.redirectSharePercent)} → ${provenanceLabel(current.provenance.redirectSharePercent)})`,
    );
  }
  if (
    (snapshotHasRedirectCache(baselineRun) ||
      snapshotHasRedirectCache(currentRun)) &&
    (baseline.cacheHitPercent !== current.cacheHitPercent ||
      baseline.provenance.cacheHitPercent !==
        current.provenance.cacheHitPercent)
  ) {
    changes.push(
      `Cache hit assumption: ${formatRate(baseline.cacheHitPercent)}% → ${formatRate(current.cacheHitPercent)}% (${provenanceLabel(baseline.provenance.cacheHitPercent)} → ${provenanceLabel(current.provenance.cacheHitPercent)})`,
    );
  }
  for (const role of CAPACITY_ROLES) {
    const before = baseline.profileCapacities[role];
    const after = current.profileCapacities[role];
    const beforeSource = baseline.provenance.profileCapacities[role];
    const afterSource = current.provenance.profileCapacities[role];
    if (before !== after || beforeSource !== afterSource) {
      changes.push(
        `${ROLE_LABELS[role]} capacity: ${formatRate(before)} → ${formatRate(after)} ${getCapacityUnit(role)} (${provenanceLabel(beforeSource)} → ${provenanceLabel(afterSource)})`,
      );
    }
  }
  return changes.length
    ? changes
    : ["Workload and capacity profiles match the baseline."];
}

const SliderField: React.FC<{
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly suffix: string;
  readonly help: string;
  readonly source: string;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
}> = ({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  help,
  source,
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
    <p className="text-xs leading-5 text-muted">
      {help} Source: {source}.
    </p>
  </div>
);

function MetricRow({
  metric,
}: {
  readonly metric: SimulationResult["nodeMetrics"][number];
}) {
  const utilizationPercent = metric.utilization * 100;
  return (
    <tr className="border-t border-[var(--border)] align-top">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-theme">
        <span className="block">{metric.label}</span>
        <span className="text-xs font-normal capitalize text-muted">
          {metric.role}
        </span>
      </th>
      <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-theme">
        {formatRate(metric.demandPerSecond)} {metric.unit}
      </td>
      <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-theme">
        {formatRate(metric.capacityPerSecond)} {metric.unit}
      </td>
      <td className="min-w-24 py-2 text-right text-theme">
        <span className="block tabular-nums">
          {formatRate(utilizationPercent)}%
        </span>
        <span
          className="mt-1 ml-auto block h-1.5 w-20 overflow-hidden rounded-full bg-[var(--border)]"
          aria-hidden="true"
        >
          <span
            className={`block h-full rounded-full ${utilizationPercent > 100 ? "bg-rose-600" : "bg-[var(--product-accent)]"}`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </span>
      </td>
    </tr>
  );
}

function SimulationGate({
  isSupportedExercise,
  nodeCount,
  simulatorEnabled,
  children,
}: {
  readonly isSupportedExercise: boolean;
  readonly nodeCount: number;
  readonly simulatorEnabled: boolean | null;
  readonly children: React.ReactNode;
}) {
  if (!isSupportedExercise) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
        <h3 className="text-sm font-semibold text-theme">
          This model supports the URL-shortener exercise
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted">
          Open “URL Shortener (like bit.ly)” to prepare redirect and create-link
          paths. Other exercises need their own reviewed workload and behavior
          model.
        </p>
      </div>
    );
  }
  if (nodeCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
        <h3 className="text-sm font-semibold text-theme">
          Add components to begin
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted">
          Draw a client path through application logic to a database, then
          prepare the redirect and create-link routes.
        </p>
      </div>
    );
  }
  if (simulatorEnabled === null) {
    return (
      <div
        className="rounded-lg border border-[var(--border)] p-4 text-sm text-muted"
        role="status"
      >
        Checking capacity simulator availability…
      </div>
    );
  }
  if (!simulatorEnabled) {
    return (
      <div
        className="rounded-lg border border-amber-700/35 bg-amber-700/5 p-4"
        role="status"
      >
        <h3 className="text-sm font-semibold text-theme">
          Capacity simulation is temporarily unavailable
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted">
          Your saved run history remains available below. Try again later for
          new path checks and capacity estimates.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function PreparationStatusCard({
  preparation,
  isCurrentGraph,
}: {
  readonly preparation: PreparationResult;
  readonly isCurrentGraph: boolean;
}) {
  const ready = preparation.status === "ready" && isCurrentGraph;
  const Icon = ready ? MdCheckCircle : MdWarningAmber;
  let title = "Review the uncertain paths";
  if (ready) title = "Paths prepared";
  else if (preparation.status === "blocked")
    title = "This design is not ready for this model";

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-5 ${
        ready
          ? "border-emerald-700/30 bg-emerald-700/5"
          : "border-amber-700/35 bg-amber-700/5"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          ready
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-amber-800 dark:text-amber-300"
        }`}
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold text-theme">{title}</p>
        <p className="mt-0.5 text-muted">{preparation.summary}</p>
      </div>
    </div>
  );
}

function RunSaveAction({
  isAuthenticated,
  isAuthLoading,
  savingRun,
  simulatorEnabled,
  onSave,
}: {
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly savingRun: boolean;
  readonly simulatorEnabled: boolean | null;
  readonly onSave: () => void;
}) {
  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={onSave}
        disabled={savingRun || !simulatorEnabled}
        className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] disabled:cursor-wait disabled:opacity-60"
      >
        {savingRun ? "Saving…" : "Save this run"}
      </button>
    );
  }
  if (isAuthLoading) return null;
  return (
    <p className="text-xs text-muted">
      Sign in to save this run to your account.
    </p>
  );
}

function SavedRunsStatus({
  isAuthLoading,
  isAuthenticated,
  loading,
  runCount,
}: {
  readonly isAuthLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly loading: boolean;
  readonly runCount: number;
}) {
  if (isAuthLoading)
    return (
      <p className="text-sm text-muted" role="status">
        Checking account…
      </p>
    );
  if (!isAuthenticated)
    return (
      <p className="text-sm text-muted">
        Sign in to save and view runs on this exercise.
      </p>
    );
  if (loading)
    return (
      <p className="text-sm text-muted" role="status">
        Loading saved runs…
      </p>
    );
  if (runCount === 0)
    return (
      <p className="text-sm text-muted">No saved runs for this exercise yet.</p>
    );
  return null;
}

function getAnalyzeButtonLabel(running: boolean, hasRun: boolean): string {
  if (running) return "Calculating…";
  if (hasRun) return "Recalculate";
  return "Analyze capacity";
}

function getBaselineHeading(hasCurrentRun: boolean): string {
  return hasCurrentRun ? "Baseline comparison" : "Baseline · this session";
}

function getBaselineCacheLabel(snapshot: SimulationRunSnapshot): string {
  if (!snapshotHasRedirectCache(snapshot)) return "no redirect cache";
  return `cache hit assumption ${formatRate(snapshot.input.cacheHitPercent)}%`;
}

function getSnapshotCacheLabel(snapshot: SimulationRunSnapshot): string {
  if (!snapshotHasRedirectCache(snapshot)) return "no redirect cache";
  return `${formatRate(snapshot.input.cacheHitPercent)}% assumed redirect cache hits`;
}

function PreparationSection({
  preparation,
  preparing,
  isCurrentGraph,
  routesReviewed,
  solution,
  onPrepare,
  onReviewChange,
}: {
  readonly preparation: PreparationResult | null;
  readonly preparing: boolean;
  readonly isCurrentGraph: boolean;
  readonly routesReviewed: boolean;
  readonly solution: SystemDesignSolution;
  readonly onPrepare: () => void;
  readonly onReviewChange: (reviewed: boolean) => void;
}) {
  if (!preparation) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-5 text-muted">
          The path checker uses known component types for simple diagrams and
          interprets ambiguous diagrams with AI. It flags unsupported
          connections and does not assign measured capacities.
        </p>
        <button
          type="button"
          onClick={onPrepare}
          disabled={preparing}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--product-accent)] px-4 py-2 text-sm font-semibold text-[var(--product-accent-contrast)] transition-colors hover:bg-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
        >
          {preparing ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <MdRefresh className="h-4 w-4" aria-hidden="true" />
          )}
          {preparing ? "Checking paths…" : "Prepare request paths"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PreparationStatusCard
        preparation={preparation}
        isCurrentGraph={isCurrentGraph}
      />
      {(preparation.blockers.length > 0 ||
        preparation.unresolved.length > 0) && (
        <ul className="flex flex-col gap-2 text-sm leading-5 text-theme">
          {[...preparation.blockers, ...preparation.unresolved].map(
            (item, index) => (
              <li key={`${index}-${item}`} className="flex items-start gap-2">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--product-accent)]"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ),
          )}
        </ul>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
        <h3 className="text-sm font-semibold text-theme">Prepared paths</h3>
        {preparation.routes.map((route) => (
          <div key={route.operation} className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {getRouteOperationLabel(route.operation)}
            </p>
            <p className="mt-0.5 break-words text-sm leading-5 text-theme">
              {route.node_ids.length
                ? readRouteText(solution, route.node_ids)
                : "No supported route found"}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              {route.explanation}
            </p>
          </div>
        ))}
        {preparation.assumptions.length > 0 && (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-muted">
            {preparation.assumptions.map((assumption, index) => (
              <li key={`${index}-${assumption}`}>{assumption}</li>
            ))}
          </ul>
        )}
      </div>
      {isCurrentGraph && (
        <label className="flex items-start gap-2 text-sm leading-5 text-theme">
          <input
            type="checkbox"
            checked={routesReviewed}
            onChange={(event) => onReviewChange(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--product-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2"
          />
          <span>
            These routes match my design. If they do not, I’ll edit the canvas
            and prepare them again.
          </span>
        </label>
      )}
      <button
        type="button"
        onClick={onPrepare}
        disabled={preparing}
        className="self-start rounded px-1 py-1 text-sm font-medium text-[var(--product-accent)] underline underline-offset-4 hover:text-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
      >
        {preparing ? "Checking paths…" : "Prepare paths again"}
      </button>
    </div>
  );
}

function WorkloadInputs({
  input,
  inputSources,
  routeRoles,
  hasRedirectCache,
  running,
  hasRun,
  routesReviewed,
  onScalarInput,
  onProfileCapacity,
  onRun,
  onCancel,
}: {
  readonly input: SimulationInput;
  readonly inputSources: SimulationInput["provenance"];
  readonly routeRoles: ReadonlySet<SimulationRole>;
  readonly hasRedirectCache: boolean;
  readonly running: boolean;
  readonly hasRun: boolean;
  readonly routesReviewed: boolean;
  readonly onScalarInput: (
    key: "requestRate" | "redirectSharePercent" | "cacheHitPercent",
    value: number,
  ) => void;
  readonly onProfileCapacity: (
    role: SimulationCapacityRole,
    value: number,
  ) => void;
  readonly onRun: () => void;
  readonly onCancel: () => void;
}) {
  const capacityFields: readonly {
    role: SimulationCapacityRole;
    id: string;
    label: string;
    min: number;
    max: number;
    step: number;
    suffix: string;
    help: string;
  }[] = [
    {
      role: "ingress",
      id: "simulation-ingress-capacity",
      label: "Ingress capacity per component",
      min: 100,
      max: 20000,
      step: 100,
      suffix: "req/s",
      help: "Assumed request handling capacity.",
    },
    {
      role: "compute",
      id: "simulation-compute-capacity",
      label: "Compute capacity per component",
      min: 100,
      max: 10000,
      step: 100,
      suffix: "req/s",
      help: "Assumed request handling capacity.",
    },
    {
      role: "cache",
      id: "simulation-cache-capacity",
      label: "Cache capacity per component",
      min: 100,
      max: 50000,
      step: 100,
      suffix: "ops/s",
      help: "Assumed operation handling capacity.",
    },
    {
      role: "database",
      id: "simulation-database-capacity",
      label: "Database capacity per component",
      min: 100,
      max: 3000,
      step: 50,
      suffix: "ops/s",
      help: "Assumes redirect reads and link writes have equal cost.",
    },
  ];

  return (
    <>
      <div>
        <h3 className="text-base font-semibold text-theme">
          Workload · URL-shortener capacity v1
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          One request performs one operation. Each uncached redirect does one
          equal-cost database read; each link creation does one equal-cost
          database write. The cache hit assumption applies only to redirects.
        </p>
      </div>
      <div className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-xs leading-5 text-muted">
        <p className="font-semibold text-theme">Try a what-if</p>
        <p className="mt-0.5">
          Analyze a baseline, set it as the comparison, then increase redirect
          traffic or change the cache-hit assumption. Replay to see which
          component gets closer to its configured capacity.
        </p>
      </div>
      <SliderField
        id="simulation-request-rate"
        label="Incoming requests"
        value={input.requestRate}
        min={0}
        max={5000}
        step={50}
        suffix="req/s"
        help="Steady offered rate for this capacity estimate."
        source={provenanceLabel(inputSources.requestRate)}
        onChange={(value) => onScalarInput("requestRate", value)}
      />
      <SliderField
        id="simulation-redirect-share"
        label="Redirect requests"
        value={input.redirectSharePercent}
        min={0}
        max={100}
        suffix="%"
        help={`Link creations: ${100 - input.redirectSharePercent}%.`}
        source={provenanceLabel(inputSources.redirectSharePercent)}
        onChange={(value) => onScalarInput("redirectSharePercent", value)}
      />
      {hasRedirectCache && (
        <SliderField
          id="simulation-cache-hit-rate"
          label="Redirect cache hit assumption"
          value={input.cacheHitPercent}
          min={0}
          max={100}
          suffix="%"
          help="Only redirects on the prepared cache path receive this reduction."
          source={provenanceLabel(inputSources.cacheHitPercent)}
          onChange={(value) => onScalarInput("cacheHitPercent", value)}
        />
      )}
      <details className="group rounded-lg border border-[var(--border)] px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]">
          Component capacity profiles · educational defaults
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {capacityFields
            .filter(({ role }) => routeRoles.has(role))
            .map((field) => (
              <SliderField
                key={field.role}
                id={field.id}
                label={field.label}
                value={input.profileCapacities[field.role]}
                min={field.min}
                max={field.max}
                step={field.step}
                suffix={field.suffix}
                help={field.help}
                source={provenanceLabel(
                  inputSources.profileCapacities[field.role],
                )}
                onChange={(value) => onProfileCapacity(field.role, value)}
              />
            ))}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running || !routesReviewed}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-[var(--product-accent)] px-3 py-2 text-sm font-semibold text-[var(--product-accent-contrast)] hover:bg-[var(--product-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65"
        >
          {getAnalyzeButtonLabel(running, hasRun)}
        </button>
        {running && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );
}

function BaselinePanel({
  baseline,
  currentRun,
  isComparable,
  capacityDelta,
  onClear,
}: {
  readonly baseline: SimulationRunSnapshot;
  readonly currentRun: SimulationRunSnapshot | null;
  readonly isComparable: boolean;
  readonly capacityDelta: number;
  readonly onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-theme">
            {getBaselineHeading(Boolean(currentRun))}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            Baseline: {formatRate(baseline.input.requestRate)} req/s ·{" "}
            {formatRate(baseline.input.redirectSharePercent)}% redirects ·{" "}
            {getBaselineCacheLabel(baseline)} · {baseline.input.modelVersion}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded px-1 py-1 text-xs font-medium text-muted underline underline-offset-4 hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
        >
          Clear
        </button>
      </div>
      {currentRun && isComparable && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <p className="font-medium text-theme">
            Capacity estimate:{" "}
            {formatRate(
              baseline.result.estimatedCapacityAtMixRequestsPerSecond,
            )}{" "}
            →{" "}
            {formatRate(
              currentRun.result.estimatedCapacityAtMixRequestsPerSecond,
            )}{" "}
            req/s
            <span className="ml-1 text-muted">
              ({capacityDelta > 0 ? "+" : ""}
              {formatRate(capacityDelta)} req/s)
            </span>
          </p>
          <p className="text-xs font-medium text-muted">
            {baseline.graphFingerprint === currentRun.graphFingerprint
              ? "Same architecture"
              : "Architecture changed since baseline"}
          </p>
          <p className="text-xs font-medium text-muted">
            {baseline.preparationFingerprint ===
            currentRun.preparationFingerprint
              ? "Prepared routes and component roles match"
              : "Prepared routes or component roles changed since baseline"}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted">
            {describeInputChanges(baseline, currentRun).map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]">
          Show paths used for the baseline
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {baseline.preparedRoutes.map((route) => (
            <li key={route.operation}>
              <span className="font-semibold capitalize text-theme">
                {getRouteOperationLabel(route.operation)}
              </span>
              <span className="mt-0.5 block break-words">
                {route.nodeLabels.join(" → ")}
              </span>
              {route.explanation && (
                <span className="mt-0.5 block">{route.explanation}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold text-theme">
          Baseline component roles
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {baseline.componentRoles.map((component) => (
            <li key={component.nodeId}>
              {component.label}:{" "}
              <span className="capitalize">{component.role}</span>
            </li>
          ))}
        </ul>
      </details>
      {currentRun && !isComparable && (
        <p className="mt-2 text-xs text-muted">
          This baseline uses a different exercise, requirements revision,
          scenario, or model version, so its capacity estimate cannot be
          compared.
        </p>
      )}
      {!currentRun && (
        <p className="mt-2 text-xs leading-5 text-muted">
          This baseline lasts for this editor session. Change the workload or
          design, prepare the paths again if the graph changed, and analyze to
          compare.
        </p>
      )}
    </div>
  );
}

function CurrentRunResults({
  currentRun,
  hasBaseline,
  isAuthenticated,
  isAuthLoading,
  savingRun,
  simulatorEnabled,
  onFocusBottleneck,
  onSetBaseline,
  onSaveRun,
}: {
  readonly currentRun: SimulationRunSnapshot;
  readonly hasBaseline: boolean;
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly savingRun: boolean;
  readonly simulatorEnabled: boolean | null;
  readonly onFocusBottleneck: () => void;
  readonly onSetBaseline: (run: SimulationRunSnapshot) => void;
  readonly onSaveRun: () => void;
}) {
  const limitingMetric = currentRun.result.nodeMetrics.find(
    (metric) => metric.nodeId === currentRun.result.limitingNodeId,
  );
  return (
    <div
      className="flex flex-col gap-4 border-t border-[var(--border)] pt-4"
      aria-live="polite"
    >
      <div className="rounded-lg border border-[var(--product-accent)]/40 bg-[var(--product-accent)]/5 p-3">
        <p className="font-serif text-lg text-[var(--product-accent)]">
          Estimated capacity at this operation mix
        </p>
        <p className="mt-1 text-sm leading-5 text-theme">
          About{" "}
          {formatRate(
            currentRun.result.estimatedCapacityAtMixRequestsPerSecond,
          )}{" "}
          requests/s across the prepared paths, using the selected profiles.
        </p>
        <p className="mt-1 text-sm leading-5 text-theme">
          {limitingMetric?.label} is the limiting modeled component.{" "}
          {currentRun.result.bottleneckNodeId
            ? "Its demand exceeds the assumed capacity at the offered rate"
            : "Its demand is within the assumed capacity at the offered rate"}{" "}
          ({formatRate(currentRun.result.bottleneckDemandPerSecond)} /{" "}
          {formatRate(currentRun.result.bottleneckCapacityPerSecond)}{" "}
          {limitingMetric?.unit}).
        </p>
        <button
          type="button"
          onClick={onFocusBottleneck}
          className="mt-2 rounded px-1 py-1 text-sm font-semibold text-[var(--product-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
        >
          View on canvas
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Redirects</dt>
        <dd className="text-right font-medium tabular-nums text-theme">
          {formatRate(currentRun.result.redirectsPerSecond)} req/s
        </dd>
        <dt className="text-muted">Link creations</dt>
        <dd className="text-right font-medium tabular-nums text-theme">
          {formatRate(currentRun.result.linkCreationsPerSecond)} req/s
        </dd>
        {snapshotHasRedirectCache(currentRun) && (
          <>
            <dt className="text-muted">Cache hits / misses</dt>
            <dd className="text-right font-medium tabular-nums text-theme">
              {formatRate(currentRun.result.cacheHitsPerSecond)} /{" "}
              {formatRate(currentRun.result.cacheMissesPerSecond)} ops/s
            </dd>
          </>
        )}
        <dt className="text-muted">Database redirect reads</dt>
        <dd className="text-right font-medium tabular-nums text-theme">
          {formatRate(currentRun.result.databaseRedirectReadsPerSecond)} ops/s
        </dd>
        <dt className="text-muted">Database link writes</dt>
        <dd className="text-right font-medium tabular-nums text-theme">
          {formatRate(currentRun.result.databaseLinkWritesPerSecond)} ops/s
        </dd>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-xs">
          <caption className="mb-2 text-left text-sm font-semibold text-theme">
            Demand against configured capacity
          </caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="pb-2 pr-3 text-left font-medium">
                Component
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                Demand
              </th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">
                Capacity
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Use
              </th>
            </tr>
          </thead>
          <tbody>
            {currentRun.result.nodeMetrics.map((metric) => (
              <MetricRow key={metric.nodeId} metric={metric} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {currentRun.input.modelVersion} · {currentRun.input.scenarioId} v
          {currentRun.input.scenarioVersion}
          {currentRun.requirementRevision
            ? ` · exercise revision ${currentRun.requirementRevision}`
            : " · no exercise revision"}
        </p>
        <button
          type="button"
          onClick={() => onSetBaseline(currentRun)}
          className="rounded px-1 py-1 text-sm font-semibold text-[var(--product-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
        >
          {hasBaseline
            ? "Set this run as new baseline"
            : "Set current run as baseline"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RunSaveAction
          isAuthenticated={isAuthenticated}
          isAuthLoading={isAuthLoading}
          savingRun={savingRun}
          simulatorEnabled={simulatorEnabled}
          onSave={onSaveRun}
        />
      </div>
    </div>
  );
}

function DetachedRunSnapshot({
  snapshot,
  graphFingerprint,
  onSetBaseline,
  onFocusBottleneck,
}: {
  readonly snapshot: SimulationRunSnapshot;
  readonly graphFingerprint: string;
  readonly onSetBaseline: (run: SimulationRunSnapshot) => void;
  readonly onFocusBottleneck: () => void;
}) {
  const limitingLabel =
    snapshot.result.nodeMetrics.find(
      (metric) => metric.nodeId === snapshot.result.limitingNodeId,
    )?.label ?? snapshot.result.limitingNodeId;
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3"
      aria-live="polite"
    >
      <div>
        <h3 className="text-sm font-semibold text-theme">Run snapshot</h3>
        <p className="mt-1 text-sm leading-5 text-muted">
          Estimated capacity: about{" "}
          {formatRate(snapshot.result.estimatedCapacityAtMixRequestsPerSecond)}{" "}
          requests/s at this workload mix. The limiting modeled component is{" "}
          {limitingLabel}.
        </p>
      </div>
      <p className="text-xs leading-5 text-muted">
        {formatRate(snapshot.input.requestRate)} req/s ·{" "}
        {formatRate(snapshot.input.redirectSharePercent)}% redirects ·{" "}
        {getSnapshotCacheLabel(snapshot)} · {snapshot.input.modelVersion}
      </p>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]">
          Show paths and component results
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {snapshot.preparedRoutes.map((route) => (
            <li key={route.operation}>
              <span className="font-semibold capitalize text-theme">
                {getRouteOperationLabel(route.operation)}
              </span>
              <span className="mt-0.5 block break-words">
                {route.nodeLabels.join(" → ")}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left">
            <thead>
              <tr>
                <th className="pb-1 pr-3 font-medium text-theme">Component</th>
                <th className="pb-1 pr-3 text-right font-medium text-theme">
                  Demand
                </th>
                <th className="pb-1 text-right font-medium text-theme">
                  Capacity
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.result.nodeMetrics.map((metric) => (
                <tr key={metric.nodeId}>
                  <td className="py-1 pr-3">{metric.label}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {formatRate(metric.demandPerSecond)} {metric.unit}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatRate(metric.capacityPerSecond)} {metric.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSetBaseline(snapshot)}
          className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
        >
          Use as comparison baseline
        </button>
        {snapshot.graphFingerprint === graphFingerprint && (
          <button
            type="button"
            onClick={onFocusBottleneck}
            className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
          >
            View on canvas
          </button>
        )}
      </div>
    </div>
  );
}

function SavedRunsSection({
  isAuthLoading,
  isAuthenticated,
  loading,
  savedRuns,
  error,
  deletingRunId,
  onLoad,
  onDelete,
}: {
  readonly isAuthLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly loading: boolean;
  readonly savedRuns: readonly SimulationSavedRun[];
  readonly error: string | null;
  readonly deletingRunId: string | null;
  readonly onLoad: (run: SimulationSavedRun) => void;
  readonly onDelete: (runId: string) => void;
}) {
  return (
    <section
      className="flex flex-col gap-2 border-t border-[var(--border)] pt-4"
      aria-labelledby="simulation-saved-runs-title"
    >
      <div>
        <h3
          id="simulation-saved-runs-title"
          className="text-sm font-semibold text-theme"
        >
          Saved runs
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          Up to 50 runs per account, retained for 90 days.
        </p>
      </div>
      <SavedRunsStatus
        isAuthLoading={isAuthLoading}
        isAuthenticated={isAuthenticated}
        loading={loading}
        runCount={savedRuns.length}
      />
      {!isAuthLoading &&
        isAuthenticated &&
        !loading &&
        savedRuns.length > 0 && (
          <ul className="flex flex-col gap-2">
            {savedRuns.map((run) => (
              <li
                key={run.runId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-theme">
                    About{" "}
                    {formatRate(
                      run.snapshot.result
                        .estimatedCapacityAtMixRequestsPerSecond,
                    )}{" "}
                    requests/s
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(run.createdAt))}{" "}
                    · {formatRate(run.snapshot.input.requestRate)} offered req/s
                    · {run.snapshot.input.modelVersion}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad(run)}
                    className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-theme hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)]"
                  >
                    Load snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(run.runId)}
                    disabled={deletingRunId !== null}
                    className="min-h-9 rounded-md px-2 py-1.5 text-sm font-medium text-muted underline underline-offset-4 hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--product-accent)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {deletingRunId === run.runId ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  nodes,
  edges,
  problem,
}) => {
  const { setCenter } = useReactFlow();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const reasoningContext = useMemo<DesignReasoningContext>(
    () => buildProvidedReasoningContext(problem, nodes, edges),
    [problem, nodes, edges],
  );
  const solution = useMemo(() => {
    const design = buildSystemDesignSolution(nodes, edges, reasoningContext);
    const components = design.components.filter(
      (component) => (component.type as string) !== "group",
    );
    const componentIds = new Set(components.map((component) => component.id));
    return {
      ...design,
      components,
      connections: design.connections.filter(
        (connection) =>
          componentIds.has(connection.source) &&
          componentIds.has(connection.target),
      ),
    };
  }, [nodes, edges, reasoningContext]);
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
      .map(({ id, source, target, type, label, description, properties }) => ({
        id,
        source,
        target,
        type,
        label,
        description,
        properties,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return fingerprintValue({
      components,
      connections,
      problem: problem
        ? {
            id: problem.id,
            title: problem.title,
            requirementRevision: problem.requirementSpec?.revision,
            description: problem.description,
            requirements: problem.requirements,
            constraints: problem.constraints,
          }
        : null,
    });
  }, [solution, problem]);
  const isSupportedExercise = problem?.slug === "url-shortener-like-bit-ly";

  const [preparation, setPreparation] = useState<Awaited<
    ReturnType<typeof prepareSimulation>
  > | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preparedFor, setPreparedFor] = useState<string | null>(null);
  const [routesReviewedFor, setRoutesReviewedFor] = useState<string | null>(
    null,
  );
  const preparationController = useRef<AbortController | null>(null);
  const simulationController = useRef<AbortController | null>(null);
  const [input, setInput] = useState<SimulationInput>(() =>
    copyInput(INITIAL_INPUT),
  );
  const [currentRun, setCurrentRun] = useState<SimulationRunSnapshot | null>(
    null,
  );
  const [baseline, setBaseline] = useState<SimulationRunSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [simulatorEnabled, setSimulatorEnabled] = useState<boolean | null>(
    null,
  );
  const [savedRuns, setSavedRuns] = useState<SimulationSavedRun[]>([]);
  const [loadingSavedRuns, setLoadingSavedRuns] = useState(false);
  const [savingRun, setSavingRun] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [savedRunError, setSavedRunError] = useState<string | null>(null);

  const isPreparedForCurrentGraph =
    preparation?.status === "ready" && preparedFor === graphFingerprint;
  const routeRoles = useMemo(() => {
    if (!preparation) return new Set<SimulationRole>();
    const routeNodeIds = new Set(
      preparation.routes.flatMap((route) => route.node_ids),
    );
    return new Set(
      preparation.component_roles
        .filter(({ node_id }) => routeNodeIds.has(node_id))
        .map(({ role }) => role),
    );
  }, [preparation]);
  const hasRedirectCache = Boolean(
    preparation?.routes
      .find((route) => route.operation === "redirect")
      ?.node_ids.some(
        (nodeId) =>
          preparation.component_roles.find((item) => item.node_id === nodeId)
            ?.role === "cache",
      ),
  );

  useEffect(() => {
    if (preparedFor && preparedFor !== graphFingerprint) {
      preparationController.current?.abort();
      simulationController.current?.abort();
      setPreparation(null);
      setPreparedFor(null);
      setRoutesReviewedFor(null);
      setPreparing(false);
      setCurrentRun(null);
      setRunning(false);
      setErrorMessage(null);
    }
  }, [graphFingerprint, preparedFor]);

  useEffect(() => {
    if (currentRun && currentRun.exerciseId !== (problem?.id ?? null)) {
      setCurrentRun(null);
    }
  }, [currentRun, problem?.id]);

  useEffect(
    () => () => {
      preparationController.current?.abort();
      simulationController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    apiService
      .getSimulationStatus(controller.signal)
      .then((status) => setSimulatorEnabled(status.enabled))
      .catch(() => setSimulatorEnabled(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !problem?.id) {
      setSavedRuns([]);
      setSavedRunError(null);
      return;
    }
    const controller = new AbortController();
    setSavedRuns([]);
    setSavedRunError(null);
    setLoadingSavedRuns(true);
    apiService
      .getSimulationRuns(problem.id, controller.signal)
      .then(setSavedRuns)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSavedRunError(
            getErrorMessage(error, "Saved runs could not be loaded."),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSavedRuns(false);
      });
    return () => controller.abort();
  }, [isAuthenticated, isAuthLoading, problem?.id]);

  const handlePrepare = useCallback(async () => {
    preparationController.current?.abort();
    const controller = new AbortController();
    preparationController.current = controller;
    setPreparation(null);
    setPreparedFor(graphFingerprint);
    setRoutesReviewedFor(null);
    setPreparing(true);
    setErrorMessage(null);
    setCurrentRun(null);
    try {
      const status = await apiService.getSimulationStatus(controller.signal);
      if (!status.enabled) {
        setSimulatorEnabled(false);
        throw new Error(
          "Capacity simulation has been disabled. Try again later.",
        );
      }
      const prepared = await prepareSimulation(
        solution,
        problem,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setPreparation(prepared);
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(
          getErrorMessage(
            error,
            "AI could not prepare this diagram. No capacity analysis was produced.",
          ),
        );
        setPreparedFor(null);
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  }, [graphFingerprint, problem, solution]);

  const updateScalarInput = (
    key: "requestRate" | "redirectSharePercent" | "cacheHitPercent",
    value: number,
  ) => {
    simulationController.current?.abort();
    setRunning(false);
    setCurrentRun(null);
    setInput((previous) => ({
      ...previous,
      [key]: value,
      provenance: { ...previous.provenance, [key]: "user" },
    }));
  };

  const updateProfileCapacity = (
    role: SimulationCapacityRole,
    value: number,
  ) => {
    simulationController.current?.abort();
    setRunning(false);
    setCurrentRun(null);
    setInput((previous) => ({
      ...previous,
      profileCapacities: { ...previous.profileCapacities, [role]: value },
      provenance: {
        ...previous.provenance,
        profileCapacities: {
          ...previous.provenance.profileCapacities,
          [role]: "user",
        },
      },
    }));
  };

  const handleRun = async () => {
    if (
      !preparation ||
      !isPreparedForCurrentGraph ||
      routesReviewedFor !== graphFingerprint ||
      running
    )
      return;
    simulationController.current?.abort();
    const controller = new AbortController();
    simulationController.current = controller;
    const runInput = copyInput(input);
    setRunning(true);
    setCurrentRun(null);
    setErrorMessage(null);
    try {
      const status = await apiService.getSimulationStatus(controller.signal);
      if (!status.enabled) {
        setSimulatorEnabled(false);
        throw new Error(
          "Capacity simulation has been disabled. Try again later.",
        );
      }
      const result = await runCapacitySimulationInWorker(
        solution,
        preparation,
        runInput,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setCurrentRun({
        input: runInput,
        result,
        graphFingerprint,
        preparationFingerprint: fingerprintPreparation(preparation),
        preparedRoutes: snapshotPreparedRoutes(solution, preparation),
        componentRoles: preparation.component_roles.map(
          ({ node_id, role }) => ({
            nodeId: node_id,
            label:
              solution.components.find((component) => component.id === node_id)
                ?.label ?? node_id,
            role,
          }),
        ),
        exerciseId: problem?.id ?? null,
        requirementRevision: problem?.requirementSpec?.revision ?? null,
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(getErrorMessage(error, "Capacity analysis failed."));
      }
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  };

  const handleSaveRun = async () => {
    if (!currentRun || !problem?.id || !isAuthenticated) return;
    setSavingRun(true);
    setSavedRunError(null);
    try {
      const saved = await apiService.saveSimulationRun(
        problem.id,
        problem.requirementSpec?.revision ?? null,
        currentRun,
      );
      setSavedRuns((previous) =>
        [saved, ...previous.filter((run) => run.runId !== saved.runId)].slice(
          0,
          50,
        ),
      );
    } catch (error) {
      setSavedRunError(getErrorMessage(error, "This run could not be saved."));
    } finally {
      setSavingRun(false);
    }
  };

  const handleLoadSavedRun = (run: SimulationSavedRun) => {
    setCurrentRun(run.snapshot);
    setInput(copyInput(run.snapshot.input));
    setPreparation(null);
    setPreparedFor(null);
    setRoutesReviewedFor(null);
    setErrorMessage(null);
    setSavedRunError(null);
  };

  const handleDeleteSavedRun = async (runId: string) => {
    setDeletingRunId(runId);
    setSavedRunError(null);
    try {
      await apiService.deleteSimulationRun(runId);
      setSavedRuns((previous) => previous.filter((run) => run.runId !== runId));
    } catch (error) {
      setSavedRunError(
        getErrorMessage(error, "This saved run could not be deleted."),
      );
    } finally {
      setDeletingRunId(null);
    }
  };

  const handleFocusBottleneck = () => {
    const component = solution.components.find(
      (item) => item.id === currentRun?.result.limitingNodeId,
    );
    if (!component) return;
    setCenter(component.position.x + 110, component.position.y + 55, {
      zoom: 1.1,
      duration: 350,
    });
  };

  const isComparable = Boolean(
    baseline &&
      currentRun &&
      baseline.input.scenarioId === currentRun.input.scenarioId &&
      baseline.input.scenarioVersion === currentRun.input.scenarioVersion &&
      baseline.result.modelVersion === currentRun.result.modelVersion &&
      baseline.exerciseId === currentRun.exerciseId &&
      baseline.requirementRevision === currentRun.requirementRevision,
  );
  const capacityDelta =
    baseline && currentRun
      ? currentRun.result.estimatedCapacityAtMixRequestsPerSecond -
        baseline.result.estimatedCapacityAtMixRequestsPerSecond
      : 0;
  const inputSources = input.provenance;
  const showDetachedRun = Boolean(
    currentRun &&
      (!simulatorEnabled || !isPreparedForCurrentGraph || !preparation),
  );

  return (
    <section
      className="flex min-w-0 flex-col gap-4 text-theme"
      aria-labelledby="simulation-panel-title"
    >
      <div>
        <h2
          id="simulation-panel-title"
          className="font-serif text-xl text-theme"
        >
          Explore a URL-shortener workload
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted">
          Estimate request capacity on the design’s redirect and link-creation
          paths.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs leading-5 text-muted">
        <MdInfoOutline
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--product-accent)]"
          aria-hidden="true"
        />
        <p>
          Capacity analysis only. It does not model queueing, latency, timeouts,
          or production performance. Rates are illustrative assumptions, not
          benchmarks.
        </p>
      </div>

      <SimulationGate
        isSupportedExercise={isSupportedExercise}
        nodeCount={nodes.length}
        simulatorEnabled={simulatorEnabled}
      >
        <PreparationSection
          preparation={preparation}
          preparing={preparing}
          isCurrentGraph={preparedFor === graphFingerprint}
          routesReviewed={routesReviewedFor === graphFingerprint}
          solution={solution}
          onPrepare={handlePrepare}
          onReviewChange={(reviewed) =>
            setRoutesReviewedFor(reviewed ? graphFingerprint : null)
          }
        />

        {isPreparedForCurrentGraph && preparation && (
          <div className="flex flex-col gap-5 border-t border-[var(--border)] pt-4">
            <WorkloadInputs
              input={input}
              inputSources={inputSources}
              routeRoles={routeRoles}
              hasRedirectCache={hasRedirectCache}
              running={running}
              hasRun={Boolean(currentRun)}
              routesReviewed={routesReviewedFor === graphFingerprint}
              onScalarInput={updateScalarInput}
              onProfileCapacity={updateProfileCapacity}
              onRun={handleRun}
              onCancel={() => {
                simulationController.current?.abort();
                setRunning(false);
              }}
            />

            {currentRun && (
              <CurrentRunResults
                currentRun={currentRun}
                hasBaseline={Boolean(baseline)}
                isAuthenticated={isAuthenticated}
                isAuthLoading={isAuthLoading}
                savingRun={savingRun}
                simulatorEnabled={simulatorEnabled}
                onFocusBottleneck={handleFocusBottleneck}
                onSetBaseline={setBaseline}
                onSaveRun={handleSaveRun}
              />
            )}

            {baseline && (
              <BaselinePanel
                baseline={baseline}
                currentRun={currentRun}
                isComparable={isComparable}
                capacityDelta={capacityDelta}
                onClear={() => setBaseline(null)}
              />
            )}

            <p className="text-xs leading-5 text-muted">
              The model assumes equal-cost database operations and linear
              capacity. It does not predict queue length, latency, timeouts, or
              failed requests.
            </p>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-700/35 bg-red-700/5 p-3 text-sm leading-5 text-theme"
          >
            <MdWarningAmber
              className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
              aria-hidden="true"
            />
            <div>
              <p>{errorMessage}</p>
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
      </SimulationGate>

      {showDetachedRun && currentRun && (
        <DetachedRunSnapshot
          snapshot={currentRun}
          graphFingerprint={graphFingerprint}
          onSetBaseline={setBaseline}
          onFocusBottleneck={handleFocusBottleneck}
        />
      )}

      {problem?.id && (
        <SavedRunsSection
          isAuthLoading={isAuthLoading}
          isAuthenticated={isAuthenticated}
          loading={loadingSavedRuns}
          savedRuns={savedRuns}
          error={savedRunError}
          deletingRunId={deletingRunId}
          onLoad={handleLoadSavedRun}
          onDelete={handleDeleteSavedRun}
        />
      )}
    </section>
  );
};

export default SimulationPanel;
