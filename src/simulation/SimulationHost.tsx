import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Panel, useReactFlow } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { NodeKind } from "@diagramwise/simulation-core";
import { databaseBottleneckScenario } from "@diagramwise/simulation-core/scenarios";
import type { ScenarioResult } from "@diagramwise/simulation-core/scenario";
import { SimulationToolbar, SimulationInspector } from "../components/simulation";
import { simulationSession, useSimulationSession } from "./session";
import type { EventRunArtifact } from "./protocol";
import { deleteCloudRun, deleteLocalRun, downloadRun, listCloudRuns, listLocalRuns, parseEventRun, saveCloudRun, saveLocalRun } from "./history";
import type { SavedEventRun } from "./history";
import type { SystemDesignProblem } from "../types/systemDesign";

const LegacySimulationPanel = lazy(() => import("../components/SimulationPanel"));

export function SimulationCanvasControls({ onInspect, onDemo }: { onInspect: () => void; onDemo: () => void }) {
  const s = useSimulationSession();
  if (!s.visible) return null;
  const hasBackgroundDelivery = Object.values(s.compilation?.profiles ?? {}).some(profile =>
    profile.kind === "queue" || profile.kind === "streambroker" || profile.kind === "retryqueue" || profile.kind === "writebehind");
  return <Panel position="top-center" style={{ width: "min(900px, calc(100% - 24px))", marginTop: 12, pointerEvents: "auto" }}>
    <SimulationToolbar status={s.status} rps={s.rps} pattern={s.pattern} speed={s.speed} snapshot={s.snapshot}
      timeMs={s.snapshot?.system.timeMs ?? 0} achievedSpeed={s.achievedSpeed} diagnostics={s.compilation?.diagnostics}
      hasBackgroundDelivery={hasBackgroundDelivery}
      onStart={() => simulationSession.start()} onPause={() => simulationSession.pause()} onReset={() => simulationSession.reset()}
      onRpsChange={rps => simulationSession.setWorkload(rps)} onPatternChange={pattern => simulationSession.setWorkload(s.rps, pattern)}
      onSpeedChange={speed => simulationSession.setSpeed(speed)} onInspect={onInspect} onDemo={onDemo} />
    {s.compilation?.virtualSourceId && <p className="sim-virtual-source">Traffic source: {s.rps} requests/sec → {s.compilation.topology?.nodes.find(n => n.id === s.compilation?.topology?.edges.find(e => e.from === s.compilation?.virtualSourceId)?.to)?.label ?? "entrypoint"}</p>}
  </Panel>;
}

type DetailsProps = {
  nodes: Node[]; edges: Edge[]; problem?: SystemDesignProblem | null; signedIn: boolean; selectedNodeId?: string | null;
  onModelChange: (nodeId: string, kind: NodeKind) => void;
  onEntrypoint: (nodeId: string) => void;
  onDemo: () => void;
};

export function SimulationDetails({ nodes, edges, problem, signedIn, selectedNodeId, onModelChange, onEntrypoint, onDemo }: DetailsProps) {
  const s = useSimulationSession();
  const { fitView } = useReactFlow();
  const [localRuns, setLocalRuns] = useState<SavedEventRun[]>([]);
  const [cloudRuns, setCloudRuns] = useState<SavedEventRun[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [evaluation, setEvaluation] = useState<ScenarioResult | null>(null);
  const [checking, setChecking] = useState(false);
  const evaluator = useRef<Worker | null>(null);
  const evaluationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  // The regular inspector remains the source of truth when the user selects
  // another canvas component; simulation badges can still focus a component.
  const nodeId = selectedNodeId ?? s.selectedNodeId;
  const node = nodes.find(n => n.id === nodeId);
  const modeled = s.compilation?.topology?.nodes.find(n => n.id === nodeId);
  const profile = nodeId ? s.compilation?.profiles[nodeId] : undefined;
  const hasBackgroundDelivery = Object.values(s.compilation?.profiles ?? {}).some(item =>
    item.kind === "queue" || item.kind === "streambroker" || item.kind === "retryqueue" || item.kind === "writebehind");
  const scopeKey = JSON.stringify(s.scope);
  const challengeActive = Boolean(s.compilation?.topology) &&
    databaseBottleneckScenario.initialTopology.nodes.every((baseline) => {
      const candidate = s.compilation?.topology?.nodes.find(node => node.id === baseline.id);
      return candidate?.kind === baseline.kind;
    }) &&
    databaseBottleneckScenario.initialTopology.edges.every((baseline) =>
      s.compilation?.topology?.edges.some(edge =>
        edge.id === baseline.id && edge.from === baseline.from && edge.to === baseline.to,
      ),
    );

  useEffect(() => {
    let active = true;
    const scope = useSimulationSession.getState().scope;
    if (scope) void listLocalRuns(scope).then(runs => { if (active) setLocalRuns(runs); }).catch(() => { if (active) setLocalRuns([]); });
    setCloudRuns([]); setEvaluation(null); setChecking(false); setMessage(null);
    evaluator.current?.terminate(); clearTimeout(evaluationTimer.current);
    return () => { active = false; evaluator.current?.terminate(); clearTimeout(evaluationTimer.current); };
  }, [scopeKey]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setMessage(null);
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not complete this action."); }
    finally { setBusy(false); }
  }
  function focus(id: string) {
    simulationSession.selectNode(id);
    const item = nodes.find(n => n.id === id);
    if (item) void fitView({ nodes: [item], padding: 0.6, duration: 200 });
  }
  function artifact() {
    const value = simulationSession.artifact();
    if (!value) throw new Error("Start a simulation before saving a run.");
    return value;
  }
  function checkSolution() {
    const topology = s.compilation?.topology;
    if (!topology) { setMessage("Resolve the model issues before checking your solution."); return; }
    simulationSession.pause();
    evaluator.current?.terminate();
    setChecking(true); setEvaluation(null); setMessage(null);
    const evaluationWorker = new Worker(new URL("./evaluation.worker.ts", import.meta.url), { type: "module" });
    evaluator.current = evaluationWorker;
    evaluationTimer.current = setTimeout(() => {
      evaluationWorker.terminate(); setChecking(false); setMessage("Evaluation exceeded its processing budget. The result is incomplete; reduce the design size and try again.");
    }, 30000);
    evaluationWorker.onerror = () => { clearTimeout(evaluationTimer.current); evaluationWorker.terminate(); setChecking(false); setMessage("The evaluation worker stopped. Your design is unchanged."); };
    evaluationWorker.onmessage = event => {
      clearTimeout(evaluationTimer.current); evaluationWorker.terminate(); setChecking(false);
      if (event.data.error) setMessage(event.data.error); else setEvaluation(event.data.result as ScenarioResult);
    };
    // Apply deliberate replica adjustments to the submitted design; the evaluator fixes load itself.
    const submitted = structuredClone(topology);
    for (const entry of s.commands) if (entry.command.type === "replicas") {
      const command = entry.command;
      const item = submitted.nodes.find(n => n.id === command.nodeId); if (item) item.config.instances = command.instances;
    }
    evaluationWorker.postMessage({ topology: submitted });
  }
  async function importFile(file: File) {
    if (file.size > 240 * 1024) throw new Error("Run files must be smaller than 240 KiB.");
    const value = parseEventRun(JSON.parse(await file.text()));
    if (!s.scope) throw new Error("Open a canvas before importing history.");
    const saved = await saveLocalRun({ ...value, scope: s.scope });
    setLocalRuns(current => [saved, ...current]); setMessage("Run imported. Replay is available when its design matches this canvas.");
  }
  function historyList(rows: SavedEventRun[], cloud: boolean) {
    return rows.map(row => <li key={row.runId} className="sim-history-row">
      <span>{new Date(row.createdAt).toLocaleString()}<small>{Math.round(row.snapshot.workload.rps)} requests/sec · seed {row.snapshot.workload.seed}</small></span>
      <div className="sim-actions">
        <button type="button" className="sim-text-button" disabled={busy || row.snapshot.graphFingerprint !== s.compilation?.fingerprint} title="Replay requires the same canvas design" onClick={() => void action(async () => { simulationSession.replay(parseEventRun(row.snapshot)); })}>Replay</button>
        <button type="button" className="sim-text-button" onClick={() => downloadRun(row.snapshot)}>Export</button>
        <button type="button" className="sim-text-button" disabled={busy} onClick={() => void action(async () => {
          if (cloud) { await deleteCloudRun(row.runId); setCloudRuns(rows => rows.filter(r => r.runId !== row.runId)); }
          else { await deleteLocalRun(row.runId); setLocalRuns(rows => rows.filter(r => r.runId !== row.runId)); }
        })}>Delete</button>
      </div>
    </li>);
  }

  return <SimulationInspector status={s.status} snapshot={s.snapshot} diagnostics={s.compilation?.diagnostics} hasBackgroundDelivery={hasBackgroundDelivery}
    modeledNodes={s.compilation?.topology?.nodes} virtualSourceId={s.compilation?.virtualSourceId}
    selectedNode={node ? { id: node.id, label: String(node.data.label ?? node.id), kind: profile?.kind, config: modeled?.config, assumption: profile?.assumption, classification: profile?.classification } : undefined}
    onSelectModel={onModelChange} onReplicasChange={(id, instances) => simulationSession.command({ type: "replicas", nodeId: id, instances })}
    onFault={(id, kind) => simulationSession.command({ type: "fault", nodeId: id, kind, opts: kind === "slow" ? { factor: 5 } : kind === "errors" ? { rate: 0.25 } : undefined })}
    onClearFault={id => simulationSession.command({ type: "clearFault", nodeId: id })}
    onSelectNode={focus} onFocusDiagnostic={diagnostic => { if (diagnostic.nodeId) focus(diagnostic.nodeId); else if (diagnostic.edgeId) { const edge = edges.find(e => e.id === diagnostic.edgeId); if (edge) focus(edge.target); } }}>
    {node && <button className="sim-text-button" type="button" onClick={() => onEntrypoint(node.id)}>Use {String(node.data.label ?? node.id)} as traffic entrypoint</button>}
    {s.error && <p role="alert" className="sim-notice">{s.error}</p>}
    <section className="sim-section">
      <h3>Repair challenge</h3>
      {challengeActive ? <>
        <p>{databaseBottleneckScenario.brief}</p>
        <p>Checking uses fixed traffic and three seeds, with a 10-second warmup and 60-second measurement.</p>
        <button className="sim-button" type="button" disabled={checking} onClick={checkSolution}>{checking ? "Checking solution…" : "Check solution"}</button>
        {checking && <button className="sim-text-button" type="button" onClick={() => { evaluator.current?.terminate(); clearTimeout(evaluationTimer.current); setChecking(false); }}>Cancel</button>}
        {evaluation && <div role="status"><strong>{evaluation.status === "pass" ? "Solution passed" : `Solution ${evaluation.status}`}</strong><p>{evaluation.status === "pass" ? databaseBottleneckScenario.lesson : "Check the required workload, dependency path, latency, and resource budget."}</p><details><summary>Evaluation evidence</summary><pre className="sim-evidence">{JSON.stringify(evaluation, null, 2)}</pre></details></div>}
        <details><summary>Hints</summary><ol>{databaseBottleneckScenario.hints.map(hint => <li key={hint}>{hint}</li>)}</ol></details>
      </> : <><p>Find and repair a database bottleneck, then check your solution against a fixed workload.</p><button className="sim-button" type="button" onClick={onDemo}>Open repair demo</button></>}
    </section>
    <section className="sim-section">
      <h3>Saved runs</h3><p>Local history works without an account. Runs preserve the model, seed, and your changes.</p>
      <div className="sim-actions">
        <button className="sim-button" type="button" disabled={busy || !s.snapshot} onClick={() => void action(async () => { const row = await saveLocalRun(artifact()); setLocalRuns(rows => [row, ...rows]); setMessage("Run saved on this device."); })}>Save locally</button>
        <button className="sim-button" type="button" disabled={!s.snapshot} onClick={() => { try { downloadRun(artifact()); } catch (error) { setMessage(String(error)); } }}>Export</button>
        <button className="sim-text-button" type="button" onClick={() => fileInput.current?.click()}>Import run</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void action(() => importFile(file)); }} />
      </div>
      <ul className="sim-history">{historyList(localRuns, false)}</ul>
      {signedIn && <details><summary>Cloud history</summary>
        <div className="sim-actions"><button className="sim-button" type="button" disabled={busy || !s.snapshot} onClick={() => void action(async () => { const row = await saveCloudRun(artifact()); setCloudRuns(rows => [row, ...rows]); setMessage("Run saved to your account."); })}>Save to account</button>
          <button className="sim-text-button" type="button" disabled={busy} onClick={() => void action(async () => { if (s.scope) setCloudRuns(await listCloudRuns(s.scope)); })}>Load cloud history</button></div>
        <ul className="sim-history">{historyList(cloudRuns, true)}</ul>
      </details>}
      {message && <p role="status" className="sim-notice">{message}</p>}
    </section>
    {problem?.id !== "free" && <details onToggle={event => setShowLegacy(event.currentTarget.open)}><summary>Capacity estimate — legacy model</summary>
      {showLegacy && <Suspense fallback={<p className="sim-muted">Loading legacy capacity history…</p>}><LegacySimulationPanel nodes={nodes} edges={edges} problem={problem ?? null} /></Suspense>}
    </details>}
  </SimulationInspector>;
}

export type { EventRunArtifact };
