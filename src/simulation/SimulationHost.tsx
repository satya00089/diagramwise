import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { NodeKind } from "@diagramwise/simulation-core";
import {
  SimulationToolbar,
  SimulationInspector,
} from "../components/simulation";
import { simulationSession, useSimulationSession } from "./session";
import type { EventRunArtifact } from "./protocol";
import {
  deleteCloudRun,
  deleteLocalRun,
  downloadRun,
  listCloudRuns,
  listLocalRuns,
  parseEventRun,
  saveCloudRun,
  saveLocalRun,
} from "./history";
import type { SavedEventRun } from "./history";
import type { SystemDesignProblem } from "../types/systemDesign";

const LegacySimulationPanel = lazy(
  () => import("../components/SimulationPanel"),
);

export function SimulationCanvasControls({
  onInspect,
  onSourceChange,
  onDemo,
}: Readonly<{
  onInspect: () => void;
  onSourceChange: (nodeId: string | null) => void;
  onDemo?: () => void;
}>) {
  const s = useSimulationSession();
  if (!s.visible) return null;
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
      position="top-center"
      style={{
        width: "min(900px, calc(100% - 24px))",
        marginTop: 12,
        pointerEvents: "auto",
      }}
    >
      <SimulationToolbar
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
    </Panel>
  );
}

type DetailsProps = {
  nodes: Node[];
  edges: Edge[];
  problem?: SystemDesignProblem | null;
  signedIn: boolean;
  selectedNodeId?: string | null;
  onModelChange: (nodeId: string, kind: NodeKind) => void;
  onEntrypoint: (nodeId: string) => void;
  onDemo?: () => void;
};

export function SimulationDetails({
  nodes,
  edges,
  problem,
  signedIn,
  selectedNodeId,
  onModelChange,
  onEntrypoint,
  onDemo,
}: Readonly<DetailsProps>) {
  const s = useSimulationSession();
  const { fitView } = useReactFlow();
  const [localRuns, setLocalRuns] = useState<SavedEventRun[]>([]);
  const [cloudRuns, setCloudRuns] = useState<SavedEventRun[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
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
    setCloudRuns([]);
    setMessage(null);
    return () => {
      active = false;
    };
  }, [scopeKey]);

  async function action(work: () => Promise<void>) {
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
  function historyList(rows: SavedEventRun[], cloud: boolean) {
    return rows.map((row) => (
      <li key={row.runId} className="sim-history-row">
        <span>
          {new Date(row.createdAt).toLocaleString()}
          <small>
            {Math.round(row.snapshot.workload.rps)} requests/sec · seed{" "}
            {row.snapshot.workload.seed}
          </small>
        </span>
        <div className="sim-actions">
          <button
            type="button"
            className="sim-text-button"
            disabled={
              busy ||
              row.snapshot.graphFingerprint !== s.compilation?.fingerprint
            }
            title="Replay requires the same canvas design"
            onClick={() =>
              void action(async () => {
                simulationSession.replay(parseEventRun(row.snapshot));
              })
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
            onClick={() =>
              void action(async () => {
                if (cloud) {
                  await deleteCloudRun(row.runId);
                  setCloudRuns((rows) =>
                    rows.filter((r) => r.runId !== row.runId),
                  );
                } else {
                  await deleteLocalRun(row.runId);
                  setLocalRuns((rows) =>
                    rows.filter((r) => r.runId !== row.runId),
                  );
                }
              })
            }
          >
            Delete
          </button>
        </div>
      </li>
    ));
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
          opts:
            kind === "slow"
              ? { factor: 5 }
              : kind === "errors"
                ? { rate: 0.25 }
                : undefined,
        })
      }
      onClearFault={(id) =>
        simulationSession.command({ type: "clearFault", nodeId: id })
      }
      onSelectNode={focus}
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
        <h3>Saved runs</h3>
        <p>
          Local history works without an account. Runs preserve the model, seed,
          and your changes.
        </p>
        <div className="sim-actions">
          <button
            className="sim-button"
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
            Save locally
          </button>
          <button
            className="sim-button"
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
            Export
          </button>
          <button
            className="sim-text-button"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            Import run
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
        <ul className="sim-history">{historyList(localRuns, false)}</ul>
        {signedIn && (
          <details>
            <summary>Cloud history</summary>
            <div className="sim-actions">
              <button
                className="sim-button"
                type="button"
                disabled={busy || !s.snapshot}
                onClick={() =>
                  void action(async () => {
                    const row = await saveCloudRun(artifact());
                    setCloudRuns((rows) => [row, ...rows]);
                    setMessage("Run saved to your account.");
                  })
                }
              >
                Save to account
              </button>
              <button
                className="sim-text-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    if (s.scope) setCloudRuns(await listCloudRuns(s.scope));
                  })
                }
              >
                Load cloud history
              </button>
            </div>
            <ul className="sim-history">{historyList(cloudRuns, true)}</ul>
          </details>
        )}
        {message && (
          <p role="status" className="sim-notice">
            {message}
          </p>
        )}
      </section>
      {problem?.id !== "free" && (
        <details onToggle={(event) => setShowLegacy(event.currentTarget.open)}>
          <summary>Capacity estimate — legacy model</summary>
          {showLegacy && (
            <Suspense
              fallback={
                <p className="sim-muted">Loading legacy capacity history…</p>
              }
            >
              <LegacySimulationPanel
                nodes={nodes}
                edges={edges}
                problem={problem ?? null}
              />
            </Suspense>
          )}
        </details>
      )}
    </SimulationInspector>
  );
}

export type { EventRunArtifact };
