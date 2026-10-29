import { useId } from "react";
import type { ReactNode } from "react";
import type {
  FailureKind,
  NodeConfig,
  NodeKind,
  SimNode,
  SimSnapshot,
} from "@diagramwise/simulation-core";
import {
  MdArrowForward,
  MdCheckCircleOutline,
  MdErrorOutline,
  MdWarningAmber,
} from "react-icons/md";
import type {
  SimulationDiagnostic,
  SimulationSelectedNode,
  SimulationStatus,
} from "./types";
import { SIMULATION_STATUS_LABELS } from "./types";
import {
  formatSimulationLatency,
  formatSimulationNumber,
  formatSimulationPercent,
  nodeSimulationSignal,
  SIMULATION_MODEL_LABELS,
} from "./presentation";
import "./simulation.css";

export type SimulationInspectorProps = {
  status: SimulationStatus;
  snapshot: SimSnapshot | null;
  diagnostics?: readonly SimulationDiagnostic[];
  hasBackgroundDelivery?: boolean;
  modeledNodes?: readonly Pick<SimNode, "id" | "label" | "kind">[];
  virtualSourceId?: string;
  selectedNode?: SimulationSelectedNode;
  onSelectModel?: (nodeId: string, kind: NodeKind) => void;
  onReplicasChange?: (nodeId: string, instances: number) => void;
  onConfigChange?: (nodeId: string, patch: Partial<NodeConfig>) => void;
  onFault?: (nodeId: string, kind: FailureKind) => void;
  onClearFault?: (nodeId: string) => void;
  onFocusDiagnostic?: (diagnostic: SimulationDiagnostic) => void;
  onSelectNode?: (nodeId: string) => void;
  children?: ReactNode;
};

const replicaKinds = new Set<NodeKind>([
  "service",
  "worker",
  "db",
  "cache",
  "lb",
  "cdn",
]);
const faultActions: { kind: FailureKind; label: string }[] = [
  { kind: "crash", label: "Crash" },
  { kind: "slow", label: "Slow down" },
  { kind: "errors", label: "Return errors" },
  { kind: "partition", label: "Cut outgoing links" },
];

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="sim-metric">
      <dt>{label}</dt>
      <dd className={danger ? "sim-text-danger" : undefined}>{value}</dd>
    </div>
  );
}

export function SimulationInspector({
  status,
  snapshot,
  diagnostics = [],
  hasBackgroundDelivery = false,
  modeledNodes = [],
  virtualSourceId,
  selectedNode,
  onSelectModel,
  onReplicasChange,
  onConfigChange,
  onFault,
  onClearFault,
  onFocusDiagnostic,
  onSelectNode,
  children,
}: SimulationInspectorProps) {
  const id = useId();
  const currentSnapshot =
    status === "stale" || status === "invalid" ? null : snapshot;
  const selectedStats = selectedNode
    ? currentSnapshot?.nodes[selectedNode.id]
    : undefined;
  const activeFault = selectedNode
    ? currentSnapshot?.activeFailures.find(
        (item) => item.nodeId === selectedNode.id,
      )
    : undefined;
  const selectedDiagnostic = diagnostics.find(
    (item) =>
      item.nodeId === selectedNode?.id &&
      (item.code === "queue-without-consumer" ||
        item.code === "unreachable-component"),
  );
  const signal = nodeSimulationSignal(
    selectedStats,
    selectedNode?.kind,
    Boolean(activeFault),
    selectedDiagnostic,
  );
  const SignalIcon =
    signal.tone === "danger"
      ? MdErrorOutline
      : signal.tone === "warning"
        ? MdWarningAmber
        : MdCheckCircleOutline;
  const sessionEditable = status === "running" || status === "paused";
  const models = new Map(modeledNodes.map((node) => [node.id, node]));
  const attention = Object.entries(currentSnapshot?.nodes ?? {})
    .filter(([nodeId]) => nodeId !== virtualSourceId)
    .map(([nodeId, stats]) => ({
      nodeId,
      label: models.get(nodeId)?.label ?? nodeId,
      stats,
      signal: nodeSimulationSignal(
        stats,
        models.get(nodeId)?.kind,
        currentSnapshot?.activeFailures.some((item) => item.nodeId === nodeId),
        diagnostics.find(
          (item) =>
            item.nodeId === nodeId &&
            (item.code === "queue-without-consumer" ||
              item.code === "unreachable-component"),
        ),
      ),
    }))
    .filter(
      (item) => item.signal.tone === "danger" || item.signal.tone === "warning",
    )
    .sort(
      (a, b) =>
        (b.signal.tone === "danger" ? 1 : 0) -
          (a.signal.tone === "danger" ? 1 : 0) ||
        b.stats.queued - a.stats.queued,
    )
    .slice(0, 6);

  return (
    <section className="sim-inspector" aria-labelledby={`${id}-heading`}>
      <header className="sim-inspector__heading">
        <p className="sim-eyebrow">Simulation</p>
        <h2 id={`${id}-heading`}>
          {selectedNode?.label ?? "Watch your design under load"}
        </h2>
        <p>{SIMULATION_STATUS_LABELS[status]}</p>
      </header>

      {status === "resource-limited" && (
        <p className="sim-callout" role="status">
          This run is incomplete because the simulator reached a processing
          limit. Reduce the workload or simplify the active path, then restart.
        </p>
      )}
      {status === "stale" && (
        <p className="sim-callout">
          The design changed. Use <strong>Restart with changes</strong> to
          collect readings for the updated model.
        </p>
      )}

      {selectedNode ? (
        <>
          <div className={`sim-signal sim-tone-${signal.tone}`}>
            <SignalIcon aria-hidden="true" size={19} />
            <div>
              <strong>{signal.label}</strong>
              <p>{signal.explanation}</p>
            </div>
          </div>
          {selectedStats && (
            <dl
              className="sim-metrics"
              aria-label={`${selectedNode.label} live metrics`}
            >
              <Metric
                label="Incoming"
                value={`${formatSimulationNumber(selectedStats.arrivalRate)}/s`}
              />
              <Metric
                label={
                  selectedNode.kind === "queue"
                    ? "Acknowledged"
                    : selectedNode.kind === "streambroker"
                      ? "Published"
                      : "Completed"
                }
                value={`${formatSimulationNumber(selectedStats.throughput)}/s`}
              />
              <Metric
                label="In service"
                value={formatSimulationNumber(selectedStats.inFlight)}
              />
              <Metric
                label={
                  selectedNode.kind === "queue"
                    ? "Buffered"
                    : selectedNode.kind === "streambroker"
                      ? "Consumer lag"
                      : "Waiting"
                }
                value={formatSimulationNumber(selectedStats.queued)}
              />
              <Metric
                label="Utilization"
                value={formatSimulationPercent(selectedStats.utilization)}
              />
              <Metric
                label="Failed"
                value={formatSimulationPercent(selectedStats.errorRate)}
                danger={selectedStats.errorRate > 0}
              />
              <Metric
                label="p95 latency"
                value={formatSimulationLatency(
                  selectedStats.p95,
                  selectedStats.totalCompleted,
                )}
              />
              <Metric
                label="Timeouts"
                value={`${formatSimulationNumber(selectedStats.timeoutRate)}/s`}
                danger={selectedStats.timeoutRate > 0}
              />
            </dl>
          )}
          {selectedStats &&
            (selectedNode.kind === "queue" ||
              selectedNode.kind === "streambroker") && (
              <p className="sim-muted">
                {selectedNode.kind === "queue"
                  ? "Acknowledgements measure the caller response. Buffered work still needs a background worker to complete persistence or indexing."
                  : "Published counts producer acknowledgements. Consumer lag tracks downstream delivery separately; a publish does not confirm persistence or indexing."}
              </p>
            )}
          <section
            className="sim-inspector__section"
            aria-labelledby={`${id}-model`}
          >
            <h3 id={`${id}-model`}>Component model</h3>
            {onSelectModel ? (
              <label className="sim-field">
                <span>Behavior</span>
                <select
                  className="sim-input"
                  value={selectedNode.kind ?? ""}
                  onChange={(event) => {
                    if (event.currentTarget.value)
                      onSelectModel(
                        selectedNode.id,
                        event.currentTarget.value as NodeKind,
                      );
                  }}
                >
                  <option value="" disabled>
                    Choose how this component behaves
                  </option>
                  {(
                    Object.entries(SIMULATION_MODEL_LABELS) as [
                      NodeKind,
                      string,
                    ][]
                  ).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                {selectedNode.kind
                  ? SIMULATION_MODEL_LABELS[selectedNode.kind]
                  : "Choose a behavior to simulate this component."}
              </p>
            )}
            {selectedNode.assumption && (
              <p className="sim-muted">{selectedNode.assumption}</p>
            )}
            {selectedNode.kind &&
              replicaKinds.has(selectedNode.kind) &&
              onReplicasChange && (
                <label className="sim-field sim-field--inline">
                  <span>Instances</span>
                  <input
                    className="sim-input"
                    type="number"
                    min={1}
                    max={512}
                    step={1}
                    value={
                      selectedStats?.instances ??
                      selectedNode.config?.instances ??
                      1
                    }
                    disabled={!sessionEditable}
                    onChange={(event) => {
                      const value = event.currentTarget.valueAsNumber;
                      if (Number.isInteger(value) && value >= 1 && value <= 512)
                        onReplicasChange(selectedNode.id, value);
                    }}
                  />
                </label>
              )}
            {onConfigChange && selectedNode.kind && (
              <details className="sim-advanced">
                <summary>Advanced assumptions</summary>
                {(
                  [
                    {
                      key: "capacity",
                      label: "Concurrent slots per instance",
                      min: 1,
                      max: 10000,
                      step: 1,
                    },
                    {
                      key: "serviceMs",
                      label: "Mean service time (ms)",
                      min: 0.1,
                      max: 60000,
                      step: 0.1,
                    },
                    {
                      key: "queueLimit",
                      label: "Maximum waiting requests",
                      min: 0,
                      max: 100000,
                      step: 1,
                    },
                    {
                      key: "timeoutMs",
                      label: "Timeout (ms; 0 disables)",
                      min: 0,
                      max: 60000,
                      step: 1,
                    },
                  ] as const
                ).map((field) => (
                  <label
                    className="sim-field"
                    key={`${selectedNode.id}-${field.key}`}
                  >
                    <span>{field.label}</span>
                    <input
                      className="sim-input"
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      defaultValue={selectedNode.config?.[field.key]}
                      onBlur={(event) => {
                        const value = event.currentTarget.valueAsNumber;
                        if (
                          Number.isFinite(value) &&
                          value >= field.min &&
                          value <= field.max &&
                          value !== selectedNode.config?.[field.key]
                        )
                          onConfigChange(selectedNode.id, {
                            [field.key]: value,
                          });
                      }}
                    />
                  </label>
                ))}
                <p className="sim-muted">
                  Changing assumptions requires a fresh run.
                </p>
              </details>
            )}
          </section>
          {onFault && (
            <section
              className="sim-inspector__section"
              aria-labelledby={`${id}-faults`}
            >
              <h3 id={`${id}-faults`}>Try a failure</h3>
              <p className="sim-muted">
                Inject a temporary fault and watch how the system responds.
              </p>
              <div className="sim-fault-actions">
                {faultActions.map((fault) => (
                  <button
                    type="button"
                    className="sim-button"
                    key={fault.kind}
                    disabled={!sessionEditable}
                    aria-pressed={activeFault?.kind === fault.kind}
                    onClick={() => onFault(selectedNode.id, fault.kind)}
                  >
                    {fault.label}
                  </button>
                ))}
              </div>
              {activeFault && onClearFault && (
                <button
                  type="button"
                  className="sim-button sim-button--restore"
                  disabled={!sessionEditable}
                  onClick={() => onClearFault(selectedNode.id)}
                >
                  Clear fault and observe recovery
                </button>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {currentSnapshot ? (
            <dl className="sim-metrics" aria-label="System metrics">
              <Metric
                label="Offered"
                value={`${formatSimulationNumber(currentSnapshot.system.offeredRps)}/s`}
              />
              <Metric
                label={hasBackgroundDelivery ? "Caller responses" : "Completed"}
                value={`${formatSimulationNumber(currentSnapshot.system.goodputRps)}/s`}
              />
              <Metric
                label="Failed"
                value={formatSimulationPercent(
                  currentSnapshot.system.errorRate,
                )}
                danger={currentSnapshot.system.errorRate > 0}
              />
              <Metric
                label="p95 latency"
                value={formatSimulationLatency(
                  currentSnapshot.system.p95,
                  currentSnapshot.system.totalRequests -
                    currentSnapshot.system.totalFailed,
                )}
              />
            </dl>
          ) : (
            <p>
              Start from the canvas toolbar. Increase requests/sec to see where
              queues form and which paths are affected.
            </p>
          )}
          {currentSnapshot && hasBackgroundDelivery && (
            <p className="sim-muted">
              Caller responses finish the foreground request path. Check
              buffered messages, consumer lag, and downstream delivery
              separately.
            </p>
          )}
          {attention.length > 0 && (
            <section className="sim-inspector__section">
              <h3>Components to inspect</h3>
              <ul className="sim-attention">
                {attention.map((item) => (
                  <li key={item.nodeId}>
                    <button
                      type="button"
                      className={`sim-attention__item sim-tone-${item.signal.tone}`}
                      disabled={!onSelectNode}
                      onClick={() => onSelectNode?.(item.nodeId)}
                    >
                      <span>{item.signal.label}</span>
                      <small>{item.label}</small>
                      <MdArrowForward aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="sim-muted">
            Select a component or a highlighted path to inspect its traffic and
            assumptions.
          </p>
        </>
      )}

      {diagnostics.length > 0 && (
        <details
          className="sim-inspector__section sim-advanced sim-setup-notes"
          open={status === "invalid"}
        >
          <summary>Setup notes ({diagnostics.length})</summary>
          <ul className="sim-diagnostics">
            {diagnostics.map((item, index) => (
              <li
                className={`sim-diagnostic sim-diagnostic--${item.severity}`}
                key={`${item.code}-${item.nodeId ?? item.edgeId ?? index}`}
              >
                {item.severity === "error" ? (
                  <MdErrorOutline aria-hidden="true" size={17} />
                ) : item.severity === "info" ? (
                  <MdCheckCircleOutline aria-hidden="true" size={17} />
                ) : (
                  <MdWarningAmber aria-hidden="true" size={17} />
                )}
                <div>
                  <p>{item.message}</p>
                  {onFocusDiagnostic && (item.nodeId || item.edgeId) && (
                    <button
                      type="button"
                      className="sim-text-button"
                      onClick={() => onFocusDiagnostic(item)}
                    >
                      View on canvas <MdArrowForward aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {children}
      <footer className="sim-model-note">
        Numbers describe this educational model and its configured assumptions.
        They are not provider benchmarks.
      </footer>
    </section>
  );
}
