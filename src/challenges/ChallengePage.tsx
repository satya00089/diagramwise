import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { SimSnapshot, Topology, TrafficPattern } from '@diagramwise/simulation-core';
import { scenarioResourceUnits } from '@diagramwise/simulation-core/scenario';
import type { ScenarioResult } from '@diagramwise/simulation-core/scenario';
import { useAuth } from '../hooks/useAuth';
import { useModalDialog } from '../hooks/useModalDialog';
import { SimulationToolbar } from '../components/simulation/SimulationToolbar';
import type { SimulationStatus } from '../components/simulation/types';
import { nodeSimulationSignal } from '../components/simulation/presentation';
import type { WorkerResponse } from '../simulation/protocol';
import { fields, initialDraft, repair, scenario, validateDraft } from './model';
import type { Draft, RepairField } from './model';
import { readDraft, writeDraft } from './storage';
import './challenge.css';

function ConfirmRestart({ cancel, confirm, importing = false }: { cancel: () => void; confirm: () => void; importing?: boolean }) {
  const ref = useModalDialog();
  return <dialog ref={ref} className="app-modal challenge-dialog" onCancel={cancel} onClose={cancel} aria-labelledby="restart-title">
    <h2 id="restart-title">{importing ? 'Load this exported repair?' : 'Start this challenge over?'}</h2><p>{importing ? 'Your current repair settings will be replaced by the imported draft.' : 'Your repair settings and hints will return to the original challenge.'}</p>
    <div className="challenge-actions"><button autoFocus className="sim-button" onClick={cancel}>Keep my repair</button><button className="sim-button sim-button--primary" onClick={confirm}>{importing ? 'Load draft' : 'Start over'}</button></div>
  </dialog>;
}

function NumberSetting({ value, field, commit }: { value: number; field: typeof fields[number]; commit: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState(false);
  useEffect(() => { setText(String(value)); setError(false); }, [value]);
  function apply() {
    const next = Number(text);
    if (!text.trim() || !Number.isInteger(next) || next < field.min || next > field.max) {
      setText(String(value)); setError(true); return;
    }
    setError(false); if (next !== value) commit(next);
  }
  return <label className="challenge-field">{field.label}<input type="number" min={field.min} max={field.max} step={1} value={text} onChange={e => setText(e.target.value)} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-invalid={error} />
    {error && <small role="status">Use a whole number from {field.min} to {field.max}. Your previous value was kept.</small>}
  </label>;
}

function Workspace({ owner }: { owner: string }) {
  const key = `${owner}:${scenario.id}:${scenario.revision}`;
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState('Loading your draft…');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [selected, setSelected] = useState('database');
  const [history, setHistory] = useState<Topology[]>([]);
  const [future, setFuture] = useState<Topology[]>([]);
  const [restart, setRestart] = useState(false);
  const [imported, setImported] = useState<Draft | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [rps, setRps] = useState(scenario.workload.rps);
  const [pattern, setPattern] = useState<TrafficPattern>('steady');
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [changed, setChanged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const preview = useRef<Worker | null>(null);
  const evaluator = useRef<Worker | null>(null);
  const runId = useRef('');
  const evaluationId = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revision = useRef(0);
  const saveGeneration = useRef(0);
  const storedRaw = useRef<unknown>(null);
  const writes = useRef(Promise.resolve());
  const storageBlocked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void readDraft(key).then(row => {
      if (!active) return;
      if (row) { revision.current = row.revision; storedRaw.current = row.draft; setDraft(validateDraft(row.draft)); }
      setReady(true);
    }).catch(error => {
      if (!active) return;
      storageBlocked.current = true; setStorageError(String(error)); setSaved('Changes are not saved'); setReady(true);
    });
    return () => { active = false; mounted.current = false; runId.current = ''; evaluationId.current = ''; preview.current?.terminate(); evaluator.current?.terminate(); clearTimeout(timer.current); };
  }, [key]);

  useEffect(() => {
    if (!ready || storageBlocked.current) return;
    setSaved('Saving on this device…');
    const captured = draft;
    const generation = ++saveGeneration.current;
    writes.current = writes.current.then(async () => {
      if (storageBlocked.current) return;
      try {
        revision.current = await writeDraft(key, captured, revision.current);
        if (mounted.current && generation === saveGeneration.current) setSaved('Saved on this device');
      } catch (error) {
        storageBlocked.current = true;
        if (mounted.current) { setStorageError(String(error)); setSaved('Changes are not saved'); }
      }
    });
  }, [draft, key, ready]);

  function cancelCheck() {
    evaluationId.current = ''; evaluator.current?.terminate(); evaluator.current = null;
    clearTimeout(timer.current); setProgress(null);
  }
  function resetPreview() {
    runId.current = ''; preview.current?.terminate(); preview.current = null; setSnapshot(null); setStatus('idle');
  }
  function changeTopology(topology: Topology) {
    cancelCheck(); resetPreview(); setChanged(true); setMessage(null);
    setDraft(current => ({ ...current, topology }));
  }
  function edit(nodeId: string, field: RepairField, value: number) {
    const next = repair(draft.topology, nodeId, field, value);
    setHistory(items => [...items.slice(-49), draft.topology]); setFuture([]); changeTopology(next);
  }
  function startPreview() {
    if (progress) { setMessage('Finish or cancel the check before running another preview.'); return; }
    if (status === 'paused' && preview.current) { preview.current.postMessage({ type: 'resume', runId: runId.current }); setStatus('running'); return; }
    resetPreview(); setMessage(null);
    try {
      const id = crypto.randomUUID(); runId.current = id;
      const worker = new Worker(new URL('../simulation/simulation.worker.ts', import.meta.url), { type: 'module' }); preview.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (runId.current !== id) return;
        if (event.data.type === 'error') { setMessage(event.data.message); setStatus('error'); worker.terminate(); preview.current = null; }
        else { setSnapshot(event.data.snapshot); setStatus(event.data.status); }
      };
      worker.onerror = () => { if (runId.current === id) { resetPreview(); setMessage('Simulation could not run. Retry when ready.'); } };
      const topology = structuredClone(draft.topology);
      for (const node of topology.nodes) if (node.kind === 'client') Object.assign(node.config, { rps, traffic: pattern });
      worker.postMessage({ type: 'start', runId: id, topology, seed: 1, speed }); setStatus('running');
    } catch { resetPreview(); setMessage('Simulation is unavailable in this browser. Your draft is safe.'); }
  }
  function pausePreview() {
    if (preview.current && status === 'running') { preview.current.postMessage({ type: 'pause', runId: runId.current }); setStatus('paused'); }
  }
  function workload(rate: number, traffic = pattern) {
    setRps(rate); setPattern(traffic);
    preview.current?.postMessage({ type: 'command', runId: runId.current, command: { type: 'workload', rps: rate, pattern: traffic } });
  }
  function check() {
    cancelCheck(); pausePreview(); setResult(null); setChanged(false); setMessage(null);
    const id = crypto.randomUUID(); evaluationId.current = id;
    try {
      const worker = new Worker(new URL('./evaluate.worker.ts', import.meta.url), { type: 'module' }); evaluator.current = worker;
      setProgress('Preparing the required workload…');
      const fail = (text: string) => { if (evaluationId.current === id) { cancelCheck(); setMessage(text); } };
      timer.current = setTimeout(() => fail('Check incomplete: processing took too long. Retry; this is not a failed repair.'), 30000);
      worker.onerror = () => fail('Check incomplete: the worker stopped. Retry your check.');
      worker.onmessage = event => {
        if (evaluationId.current !== id || event.data.id !== id) return;
        if (event.data.progress) { setProgress(event.data.progress); return; }
        cancelCheck();
        if (event.data.error) setMessage(event.data.error); else setResult(event.data.result);
      };
      worker.postMessage({ id, topology: structuredClone(draft.topology) });
    } catch { cancelCheck(); setMessage('Check incomplete: evaluation could not start. Your draft is safe.'); }
  }
  function exportDraft(value: unknown = draft) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'diagramwise-repair-draft.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const node = draft.topology.nodes.find(item => item.id === selected)!;
  const units = scenarioResourceUnits(draft.topology);
  const nodes = draft.topology.nodes.map(item => {
    const stats = snapshot?.nodes[item.id];
    const signal = nodeSimulationSignal(stats, item.kind);
    return { id: item.id, position: { x: item.x, y: item.y }, type: item.kind === 'client' ? 'input' : item.kind === 'db' ? 'output' : 'default',
      sourcePosition: 'right' as import('@xyflow/react').Position, targetPosition: 'left' as import('@xyflow/react').Position,
      selected: selected === item.id,
      className: `challenge-node challenge-node--${signal.tone}`,
      data: { label: <><strong>{item.label}</strong><span>{signal.label}</span>{stats && <small>{stats.arrivalRate.toFixed(1)} in/s · {stats.queued} waiting</small>}</> } };
  });
  const edges = draft.topology.edges.map(edge => {
    const flow = snapshot?.edgeFlow[edge.id] ?? 0;
    const target = snapshot?.nodes[edge.to];
    const pressure = (target?.queued ?? 0) > 0;
    return { id: edge.id, source: edge.from, target: edge.to, label: snapshot ? `${flow.toFixed(1)}/s${pressure ? ' · waiting downstream' : ''}` : undefined,
      style: { stroke: pressure ? 'var(--brand, #e99ba9)' : 'var(--text-muted, #888)', strokeWidth: 2 } };
  });
  return <main className="challenge-page">
    <header className="challenge-header"><div><Link to="/problems">Diagramwise / Practice</Link><h1>{scenario.name}</h1><p>Observe the queue. Repair the capacity. Check your reasoning.</p></div><div className="challenge-actions"><span role="status">{saved}</span><button className="sim-button" onClick={() => exportDraft()}>Export draft</button><button className="sim-button" disabled={!ready} onClick={() => importInput.current?.click()}>Import draft</button><button className="sim-button" disabled={!ready} onClick={() => setRestart(true)}>Start over</button></div></header>
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      try { if (file.size > 1024 * 1024) throw new Error('Drafts must be smaller than 1 MiB.'); setImported(validateDraft(JSON.parse(await file.text()))); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'This draft could not be imported.'); }
    }} />
    <p className="challenge-source-note">This is a separate practice workspace. If you opened it from a design, your original canvas remains in its tab.</p>
    {storageError && <p className="challenge-notice" role="status">{storageError} <button className="sim-button" onClick={() => exportDraft()}>Export current draft</button>{storedRaw.current != null && <button className="sim-button" onClick={() => exportDraft(storedRaw.current)}>Export previous saved draft</button>}</p>}
    {message && <p className="challenge-notice" role="status">{message}</p>}
    {!ready ? <p role="status">Loading challenge…</p> : <>
      <div className="challenge-goals" aria-label="Required goals"><span>Required traffic <strong>150 / sec</strong></span><span>Successful <strong>≥ 99%</strong></span><span>p95 <strong>≤ 200 ms</strong></span><span>p99 <strong>≤ 350 ms</strong></span><span className={units > 24 ? 'sim-text-danger' : ''}>Capacity budget <strong>{units} / 24</strong></span></div>
      <div className="challenge-layout"><section className="challenge-canvas" aria-label="Challenge architecture">
        <SimulationToolbar status={status} rps={rps} pattern={pattern} speed={speed} snapshot={snapshot} timeMs={snapshot?.system.timeMs ?? 0} onStart={startPreview} onPause={pausePreview} onReset={resetPreview} onRpsChange={value => workload(value)} onPatternChange={value => workload(rps, value)} onSpeedChange={value => { setSpeed(value); preview.current?.postMessage({ type: 'speed', runId: runId.current, speed: value }); }} />
        {rps !== 150 || pattern !== 'steady' ? <p>Exploration traffic. Checking always uses 150/sec steady. <button className="sim-text-button" onClick={() => workload(150, 'steady')}>Restore required traffic</button></p> : null}
        <div className="challenge-flow"><ReactFlow nodes={nodes} edges={edges} nodesDraggable={false} nodesConnectable={false} deleteKeyCode={null} onNodeClick={(_, item) => setSelected(item.id)} fitView minZoom={0.3}><Background /><Controls showInteractive={false} /></ReactFlow></div>
      </section><aside className="challenge-panel">
        <section><h2>Your task</h2><p>Every request must finish a database read. Keep the required path and meet all four targets within 24 simultaneous work slots.</p><p className="text-muted">Slots × instances count toward the budget. More waiting space does not increase how much work can finish.</p></section>
        <section><h2>{node.label}</h2><div className="challenge-actions">{draft.topology.nodes.map(item => <button className="sim-button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
          {node.kind === 'client' ? <p>Checking fixes traffic at 150 requests/sec. Use the toolbar to explore other loads.</p> : <>{fields.map(field => <NumberSetting key={`${node.id}-${field.key}`} value={node.config[field.key] ?? 1} field={field} commit={value => edit(node.id, field.key, value)} />)}<p className="text-muted">Service time, behavior, and connections are fixed for this exercise. Editing starts a fresh simulation.</p></>}
          <div className="challenge-actions"><button className="sim-button" disabled={!history.length} onClick={() => { setFuture(items => [...items, draft.topology]); changeTopology(history[history.length - 1]); setHistory(items => items.slice(0, -1)); }}>Undo repair</button><button className="sim-button" disabled={!future.length} onClick={() => { setHistory(items => [...items, draft.topology]); changeTopology(future[future.length - 1]); setFuture(items => items.slice(0, -1)); }}>Redo</button></div>
        </section>
        <section><h2>Check your repair</h2><p>Three fixed runs, each with 10s warmup and 60s measurement. Local checks require completed API and database work.</p><button className="sim-button sim-button--primary" disabled={!!progress} onClick={check}>Check repair</button>{progress && <p role="status">{progress} <button className="sim-button" onClick={cancelCheck}>Cancel check</button></p>}
          {result && <div role="status"><h3>{changed ? 'Changed since last check' : result.status === 'pass' ? 'Repair passed all three runs' : result.status === 'fail' ? 'Some goals still need work' : result.status === 'invalid' ? 'Review your repair settings' : 'Check incomplete'}</h3>{changed ? <p>Check again to evaluate the current repair.</p> : <><p>Capacity used: {result.resourceUnits} / 24. Checked on this device.</p>{result.issues.map(issue => <p key={issue}>{issue}</p>)}<table><thead><tr><th>Goal</th><th>Observed / required</th><th>Status</th></tr></thead><tbody>{result.goals.map(goal => <tr key={goal.metric}><th>{{ completionFraction: 'Successful', p95: 'p95 latency', p99: 'p99 latency', sampleCount: 'Completed samples' }[goal.metric]}</th><td>{goal.actual === null ? 'No samples' : goal.metric === 'completionFraction' ? `${(goal.actual * 100).toFixed(3)}%` : goal.actual.toFixed(2)} / {goal.metric === 'completionFraction' ? '99%' : `${goal.threshold}${goal.metric.startsWith('p') ? ' ms' : ''}`}</td><td>{goal.met ? 'Met' : 'Not met'}</td></tr>)}</tbody></table>{result.status === 'pass' && <p>{scenario.lesson}</p>}</>}</div>}
        </section>
        <section><h2>Need a hint?</h2><ol>{scenario.hints.slice(0, draft.hints).map(hint => <li key={hint}>{hint}</li>)}</ol><button className="sim-button" disabled={draft.hints >= scenario.hints.length} onClick={() => setDraft(current => ({ ...current, hints: current.hints + 1 }))}>Reveal next hint</button></section>
      </aside></div>
    </>}
    <footer>Educational capacity model. Results are not provider benchmarks. Reset simulation keeps your repair settings.</footer>
    {restart && <ConfirmRestart cancel={() => setRestart(false)} confirm={() => { cancelCheck(); resetPreview(); setDraft(initialDraft()); setHistory([]); setFuture([]); setResult(null); setChanged(false); workload(150, 'steady'); setRestart(false); }} />}
    {imported && <ConfirmRestart importing cancel={() => setImported(null)} confirm={() => { cancelCheck(); resetPreview(); setDraft(imported); setHistory([]); setFuture([]); setResult(null); setChanged(false); setImported(null); }} />}
  </main>;
}

export default function ChallengePage() {
  const { id } = useParams();
  const { user, isLoading } = useAuth();
  if (isLoading) return <p role="status">Loading…</p>;
  if (id !== scenario.id) return <main className="challenge-page"><h1>Challenge not found</h1><Link to="/problems">Back to practice</Link></main>;
  const owner = user ? `account:${user.id}` : 'anonymous';
  return <Workspace key={owner} owner={owner} />;
}
