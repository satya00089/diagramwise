import { useEffect, useRef, useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { NodeKind } from "@diagramwise/simulation-core";
import {
  SimulationToolbar,
  SimulationInspector,
} from "../components/simulation";
import { MdDragIndicator } from "react-icons/md";
import { useDraggableIsland } from "../components/simulation/useDraggableIsland";
import { simulationSession, useSimulationSession } from "./session";
import type { EventRunArtifact } from "./protocol";
import {
  deleteLocalRun,
  downloadRun,
  listLocalRuns,
  parseEventRun,
  saveLocalRun,
} from "./history";
import type { SavedEventRun } from "./history";
import { RUN_SAVED_EVENT, RUN_SAVE_FAILED_EVENT } from "./autosave";
import { compareRuns, describeRunOutcome } from "./runComparison";

export function SimulationCanvasControls({
  onInspect,
  onSourceChange,
  onDemo,
}: Readonly<{
  onInspect: () => void;
  onSourceChange: (nodeId: string | null) => void;
  onDemo?: () => void;
}>) {
  const visible = useSimulationSession((state) => state.visible);
  if (!visible) return null;
  return (
    <SimulationIsland
      onInspect={onInspect}
      onSourceChange={onSourceChange}
      onDemo={onDemo}
    />
  );
}

function SimulationIsland({
  onInspect,
  onSourceChange,
  onDemo,
}: Readonly<{
  onInspect: () => void;
  onSourceChange: (nodeId: string | null) => void;
  onDemo?: () => void;
}>) {
  const s = useSimulationSession();
  const layerRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const { enabled, dragging, position, handleProps } = useDraggableIsland(
    layerRef,
    islandRef,
  );
  const hasBackgroundDelivery = Object.values(
    s.compilation?.profiles ?? {},
  ).some(
    (profile) =>
      profile.kind === "queue" ||
      profile.kind === "streambroker" ||
      profile.kind === "retryqueue" ||
      profile.kind === "writebehind",
  );
  return (
    <Panel
      position="top-left"
      style={{
        width: "100%",
        height: "100%",
        margin: 0,
        pointerEvents: "none",
      }}
    >
      <div ref={layerRef} className="sim-island-layer">
        <div
          ref={islandRef}
          className={`sim-island${position ? "" : " sim-island--docked"}${dragging ? " sim-island--dragging" : ""}`}
          style={
            position ? { left: position.left, top: position.top } : undefined
          }
        >
          <SimulationToolbar
            dragHandle={
              enabled ? (
                <button
                  type="button"
                  className="sim-island__grip"
                  aria-label="Move simulation controls"
                  {...handleProps}
                >
                  <MdDragIndicator aria-hidden="true" size={18} />
                </button>
              ) : undefined
            }
            status={s.status}
            rps={s.rps}
            pattern={s.pattern}
            speed={s.speed}
            snapshot={s.snapshot}
            timeMs={s.snapshot?.system.timeMs ?? 0}
            achievedSpeed={s.achievedSpeed}
            diagnostics={s.compilation?.diagnostics}
            hasBackgroundDelivery={hasBackgroundDelivery}
            trafficSource={s.compilation?.trafficSource}
            onStart={() => simulationSession.start()}
            onPause={() => simulationSession.pause()}
            onReset={() => simulationSession.reset()}
            onRpsChange={(rps) => simulationSession.setWorkload(rps)}
            onPatternChange={(pattern) =>
              simulationSession.setWorkload(s.rps, pattern)
            }
            onSpeedChange={(speed) => simulationSession.setSpeed(speed)}
            onTrafficSourceChange={onSourceChange}
            onInspect={onInspect}
            onDemo={onDemo}
          />
        </div>
      </div>
    </Panel>
  );
}

type DetailsProps = Readonly<{
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string | null;
  /** Clear the canvas-level selection when leaving a component's details. */
  onClearSelection?: () => void;
  onModelChange: (nodeId: string, kind: NodeKind) => void;
  onEntrypoint: (nodeId: string) => void;
  onDemo?: () => void;
}>;

export function SimulationDetails({
  nodes,
  edges,
  selectedNodeId,
  onClearSelection,
  onModelChange,
  onEntrypoint,
  onDemo,
}: DetailsProps) {
  const s = useSimulationSession();
  const { fitView } = useReactFlow();
  const [localRuns, setLocalRuns] = useState<SavedEventRun[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The regular inspector remains the source of truth when the user selects
  // another canvas component; simulation badges can still focus a component.
  const nodeId = selectedNodeId ?? s.selectedNodeId;
  const node = nodes.find((n) => n.id === nodeId);
  const modeled = s.compilation?.topology?.nodes.find((n) => n.id === nodeId);
  const profile = nodeId ? s.compilation?.profiles[nodeId] : undefined;
  const hasBackgroundDelivery = Object.values(
    s.compilation?.profiles ?? {},
  ).some(
    (item) =>
      item.kind === "queue" ||
      item.kind === "streambroker" ||
      item.kind === "retryqueue" ||
      item.kind === "writebehind",
  );
  const scopeKey = JSON.stringify(s.scope);
  useEffect(() => {
    let active = true;
    const scope = useSimulationSession.getState().scope;
    if (scope)
      void listLocalRuns(scope)
        .then((runs) => {
          if (active) setLocalRuns(runs);
        })
        .catch(() => {
          if (active) setLocalRuns([]);
        });
    setMessage(null);
    return () => {
      active = false;
    };
  }, [scopeKey]);

  // Runs are saved in the background; show them as soon as they land.
  useEffect(() => {
    const reload = () => {
      const scope = useSimulationSession.getState().scope;
      if (scope)
        void listLocalRuns(scope)
          .then(setLocalRuns)
          .catch(() => undefined);
    };
    const failed = (event: Event) =>
      setMessage((event as CustomEvent<string>).detail);
    globalThis.addEventListener(RUN_SAVED_EVENT, reload);
    globalThis.addEventListener(RUN_SAVE_FAILED_EVENT, failed);
    return () => {
      globalThis.removeEventListener(RUN_SAVED_EVENT, reload);
      globalThis.removeEventListener(RUN_SAVE_FAILED_EVENT, failed);
    };
  }, []);

  async function action(work: () => void | Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  function focus(id: string) {
    simulationSession.selectNode(id);
    const item = nodes.find((n) => n.id === id);
    if (item) void fitView({ nodes: [item], padding: 0.6, duration: 200 });
  }
  function back() {
    simulationSession.selectNode(null);
    onClearSelection?.();
    void fitView({ padding: 0.2, duration: 200 });
  }
  function artifact() {
    const value = simulationSession.artifact();
    if (!value) throw new Error("Start a simulation before saving a run.");
    return value;
  }
  async function importFile(file: File) {
    if (file.size > 240 * 1024)
      throw new Error("Run files must be smaller than 240 KiB.");
    const value = parseEventRun(JSON.parse(await file.text()));
    if (!s.scope) throw new Error("Open a canvas before importing history.");
    const saved = await saveLocalRun({ ...value, scope: s.scope });
    setLocalRuns((current) => [saved, ...current]);
    setMessage(
      "Run imported. Replay is available when its design matches this canvas.",
    );
  }
  async function removeRun(row: SavedEventRun) {
    await deleteLocalRun(row.runId);
    setLocalRuns((rows) => rows.filter((item) => item.runId !== row.runId));
  }
  function faultOptions(kind: string) {
    if (kind === "slow") return { factor: 5 };
    if (kind === "errors") return { rate: 0.25 };
    return undefined;
  }
  function historyList(rows: SavedEventRun[]) {
    // Comparison pairs each run with the next older one, so order by time
    // here rather than relying on the order the rows were loaded in.
    const ordered = [...rows].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return ordered.map((row, index) => {
      const older = ordered[index + 1];
      const comparison = older
        ? compareRuns(row.snapshot, older.snapshot)
        : undefined;
      const designChanged =
        row.snapshot.graphFingerprint !== s.compilation?.fingerprint;
      return (
        <li key={row.runId} className="sim-history-row">
          <div className="sim-history-body">
            <strong>
              {new Date(row.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </strong>
            <small
              title={`Random seed ${row.snapshot.workload.seed} — the same seed replays identically`}
            >
              {Math.round(row.snapshot.workload.rps)} requests/sec ·{" "}
              {row.snapshot.workload.pattern}
            </small>
            <small>{describeRunOutcome(row.snapshot)}</small>
            {comparison?.comparable === false && (
              <small className="sim-muted">
                {comparison.reason === "same-design"
                  ? "Same design as the previous run, so there is nothing to compare."
                  : "Different traffic load, so not compared with the previous run."}
              </small>
            )}
            {comparison?.comparable &&
              (comparison.deltas.length === 0 ? (
                <small className="sim-muted">
                  No meaningful change from the previous run.
                </small>
              ) : (
                <ul
                  className="sim-deltas"
                  aria-label="Change from previous run"
                >
                  {comparison.deltas.map((delta) => (
                    <li
                      key={delta.label}
                      className={`sim-delta sim-delta--${delta.tone}`}
                    >
                      {delta.label} {delta.from} → {delta.to}
                    </li>
                  ))}
                </ul>
              ))}
          </div>
          <div className="sim-actions">
            <button
              type="button"
              className="sim-text-button"
              disabled={busy || designChanged}
              title={
                designChanged
                  ? "The design has changed since this run, so it can't be replayed"
                  : "Replay this run"
              }
              onClick={() =>
                void action(() =>
                  simulationSession.replay(parseEventRun(row.snapshot)),
                )
              }
            >
              Replay
            </button>
            <button
              type="button"
              className="sim-text-button"
              onClick={() => downloadRun(row.snapshot)}
            >
              Export
            </button>
            <button
              type="button"
              className="sim-text-button"
              disabled={busy}
              onClick={() => void action(() => removeRun(row))}
            >
              Delete
            </button>
          </div>
        </li>
      );
    });
  }

  return (
    <SimulationInspector
      status={s.status}
      snapshot={s.snapshot}
      diagnostics={s.compilation?.diagnostics}
      hasBackgroundDelivery={hasBackgroundDelivery}
      modeledNodes={s.compilation?.topology?.nodes}
      virtualSourceId={s.compilation?.virtualSourceId}
      selectedNode={
        node
          ? {
              id: node.id,
              label: String(node.data.label ?? node.id),
              kind: profile?.kind,
              config: modeled?.config,
              assumption: profile?.assumption,
              classification: profile?.classification,
            }
          : undefined
      }
      onSelectModel={onModelChange}
      onReplicasChange={(id, instances) =>
        simulationSession.command({ type: "replicas", nodeId: id, instances })
      }
      onFault={(id, kind) =>
        simulationSession.command({
          type: "fault",
          nodeId: id,
          kind,
          opts: faultOptions(kind),
        })
      }
      onClearFault={(id) =>
        simulationSession.command({ type: "clearFault", nodeId: id })
      }
      onSelectNode={focus}
      onBack={back}
      onFocusDiagnostic={(diagnostic) => {
        if (diagnostic.nodeId) focus(diagnostic.nodeId);
        else if (diagnostic.edgeId) {
          const edge = edges.find((e) => e.id === diagnostic.edgeId);
          if (edge) focus(edge.target);
        }
      }}
    >
      {node && (
        <button
          className="sim-text-button"
          type="button"
          onClick={() => onEntrypoint(node.id)}
        >
          Use {String(node.data.label ?? node.id)} as traffic entrypoint
        </button>
      )}
      {s.error && (
        <p role="alert" className="sim-notice">
          {s.error}
        </p>
      )}
      {onDemo && (
        <section className="sim-section">
          <h3>Practice a repair</h3>
          <p>
            Explore a separate database-capacity challenge. Your current design
            stays here.
          </p>
          <button className="sim-button" type="button" onClick={onDemo}>
            Try a repair challenge
          </button>
        </section>
      )}
      <section className="sim-section">
        <h3>Run history</h3>
        <p>
          Runs are kept automatically when you pause or change your design, so
          you can compare before and after. They stay on this device.
        </p>
        {localRuns.length === 0 && (
          <p className="sim-muted">
            No runs yet. Run the simulation for a few seconds, then pause it.
          </p>
        )}
        <ul className="sim-history">{historyList(localRuns)}</ul>
        <details className="sim-more">
          <summary>More</summary>
          <div className="sim-actions">
            <button
              className="sim-text-button"
              type="button"
              disabled={busy || !s.snapshot}
              onClick={() =>
                void action(async () => {
                  const row = await saveLocalRun(artifact());
                  setLocalRuns((rows) => [row, ...rows]);
                  setMessage("Run saved on this device.");
                })
              }
            >
              Save this run now
            </button>
            <button
              className="sim-text-button"
              type="button"
              disabled={!s.snapshot}
              onClick={() => {
                try {
                  downloadRun(artifact());
                } catch (error) {
                  setMessage(String(error));
                }
              }}
            >
              Export current run
            </button>
            <button
              className="sim-text-button"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              Import run file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void action(() => importFile(file));
              }}
            />
          </div>
        </details>
        {message && (
          <p className="sim-notice">
            <output>{message}</output>
          </p>
        )}
      </section>
    </SimulationInspector>
  );
}

export type { EventRunArtifact };
