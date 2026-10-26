# Simulation diagnostics and trustworthy traffic visualization

## Goal

Users should be able to understand why a component or connection is inactive from the canvas. The simulator should identify known wiring/model problems, distinguish expected inactivity from stalled delivery, and show the evidence behind its explanation. Users supply intent; the product handles deterministic investigation and engineers own telemetry/model defects.

This is a review and implementation plan, not a shipped fix.

## Live-service follow-up — 2026-10-25

The user requested a frontend/backend reproduction of the actual document-management walkthrough before implementing the plan. Started the unchanged frontend at `http://localhost:5173` and API at `http://localhost:8000`. The API connected to the configured DynamoDB; `/health` returned `healthy`. No account was created and no walkthrough or saved diagram was written to DynamoDB.

Fetched through the running API:

- `GET /api/v1/problem/6901ef1b9420d83630aca871` — HTTP 200, title **Create a Document Management System like Wikipedia, Notion or Google Docs**.
- `GET /api/v1/problem/6901ef1b9420d83630aca871/walkthrough` — HTTP 200, version `1.0`, **41 steps**. The previously tested repository candidate has 28 steps, so it is not the same guide document.
- Frontend HTML — HTTP 200. This verifies serving, not React rendering or interaction.

Applied the live API response through `applyGuidedStep`, yielding 11 nodes and 10 connections. Its executable fingerprint exactly matches the earlier candidate: `62660df37fba993d338f1e3b2751fd85`. The text/step-count difference does not change the compiled simulation in these two documents. Reviewed the UI's `handleApplyStep` node constructor: it preserves the model-relevant component ID and properties; this is source inspection, not a browser test of that callback.

Repeated all five earlier variants using the live response across seeds 1, 42, and 1337. The results reproduce the earlier table. An additional seed-1 run advanced in 100 ms increments with a 4,000-event budget, reaching 44.1 seconds without resource limiting:

| Observation | Live-data result |
| --- | --- |
| Broker model | `queue`, despite the Kafka label and guide's independent-consumer explanation |
| Broker buffered messages | 3,044 |
| Database, object storage, search, response-cache arrivals | Zero for all four |
| Compiler warnings/errors | None |
| Actual presentation helper output | Broker: “3,044 waiting”; all four destinations: “Idle” |
| Request failure display | Current failure rate 0; run-wide failed requests 46 |

The original broker step has `componentType: message-broker`, 24 partitions in ordinary component properties, and no explicit simulation behavior. It connects directly to the four destinations. There is no explicit worker. Thus the missing-consumer mismatch is confirmed in served content, not just the bundled candidate. A local model-only intervention to `streambroker` restores traffic to all four destinations across the three seeds, but still has consumer lag under its defaults. This establishes the cause of missing delivery; it does not validate the full intended document-editing workload.

### Reproduction boundary

Browser-control and cloud-browser tools are unavailable in this session. Requested that the user connect Browser. **No actual canvas click-through, React rendering, worker-message transport, screenshot capture, account flow, or save/replay UI was tested.** The supplied screenshot is consistent with these observations; its exact saved canvas has not been retrieved. Temporary reproduction scripts and detailed counters are at `/tmp/inspect-simulation-idle-live.ts`, `/tmp/document-live-evidence.ts`, and `/tmp/document-live-evidence.json`.

### Revised implementation order and decision

Keep the diagnostic design, but do not treat phases 1–4 alone as a fix for this walkthrough. Start with a focused slice combining the confirmed problems from phases 1, 2, and 5:

1. Preserve this served graph as the regression case; complete the browser baseline when Browser is available.
2. Give this Kafka walkthrough explicit stream semantics and validated settings, or explicit consumer stages if the content lesson requires them. Align the served-content publishing path as well as repository fixtures. A fixture-only edit will not change the live API response. Do not remap every generic message broker based on its label.
3. Detect queues without compatible consumers before execution and explain their downstream inactivity. The current “waiting for a service slot” message is unsuitable when there is no consumer.
4. Repair queue-to-worker flow accounting, and then add the broader causal canvas explanations.
5. Keep auth dependency order, indexing versus reads, snapshot batching, and cache invalidation explicit in the model or visibly identified as unsupported assumptions. Nonzero traffic alone is not proof that these operations were simulated.
6. Re-run the exact UI journey against the corrected served walkthrough, then exercise the broader release gates below.

No application behavior was changed during this follow-up. The immediate cause is established; full UI verification remains blocked, so the broad implementation and production-readiness claim remain deferred.

## Investigation and evidence

Reviewed frontend commit 5169367e. Used the repository's document collaboration walkthrough (`src/test-fixtures/document-walkthrough.json`), applied through `applyGuidedStep`, compiled through `compileGraph`, and executed with `createSimulation`. This is the engine used by the browser worker; no account or backend was needed. This did not exercise browser rendering, authentication, or the user's actual saved diagram. The fixture closely matches the screenshot's labels and connections, but the screenshot alone cannot prove that its saved properties are identical.

Ran five variants at 100 requested requests/sec for 44.1 simulated seconds with seeds 1, 42, and 1337 (15 runs). Seed 1 also ran to 60 seconds during initial investigation. Rates below are rolling measurements, not the configured source rate.

| Variant | Observed result |
| --- | --- |
| Original walkthrough | Queue backlog 3,044 / 3,147 / 3,178. Database, object storage, search, and response cache all receive zero traffic. No compiler errors. |
| Broker explicitly assigned `streambroker` | All four destinations receive traffic. Backlog remains 1,131–1,258 because the object-storage consumer group is slower under default assumptions. Changing the model restores delivery but does not establish adequate capacity. |
| Generic queue with an explicit worker feeding destinations | Queue backlog is zero at the observation time. All four destinations receive traffic. Worker receives 62.2–76.7 messages/sec, yet the queue-to-worker edge reports zero flow in every run. |
| Database disconnected, with gateway explicitly selected as entrypoint | Compilation still has no errors and no diagnostic explaining that the database is unreachable. |
| Cache with 100% hits in front of a database | Database receives zero traffic legitimately. A blanket warning for every idle node would be incorrect. |

### Confirmed mechanisms

1. **Model mismatch in the walkthrough:** `catalog.ts` assigns `message-broker` to `queue`, even when the displayed name says Kafka. The queue engine acknowledges and buffers messages, and only nodes with `pullsFromQueues` drain them. The walkthrough connects the broker directly to databases, storage, cache, and search. Edge labels such as “Document Writer Consumer” do not create an executable consumer.
2. **Missing compiler diagnostics:** the compiler validates endpoints and cycles, but does not flag a queue with no effective consumers or perform complete source-to-component executable reachability analysis.
3. **Confirmed edge telemetry defect:** `pumpWorker` / `takeFromSources` transfer messages and increment worker arrivals without recording traversal of the queue-consumer edge. A working connection therefore looks inactive.
4. **Insufficient idle explanation:** `nodeSimulationSignal` sees local counters and produces only “Idle” when arrival and completion rates are zero. It has no upstream path evidence.
5. **Misleading completion scope:** queue acknowledgements count as successful caller completions. A healthy request completion rate and zero current request failures can coexist with no persistence or indexing. The UI does not make that distinction clear enough. A zero rolling failure rate also does not mean the run never had a failure.
6. **Routing intent mismatch:** the gateway model picks one outgoing destination. The screenshot's Auth Check and REST/WebSocket paths are therefore alternatives in the executable model, even though the guide describes authentication before every request. Connection labels and prose do not define dependency sequencing.
7. **Unrepresented operations:** an invalidation arrow into a read-through cache is not modeled as cache invalidation, and ordinary diagram properties such as Kafka partitions are not automatically translated into simulation config. The UI must explain the model actually used.
8. **Buffer pressure visualization gap:** edge pressure currently requires downstream utilization >= 80%. Queue and broker utilization is reported as zero by design, so growing buffered work may not cause the expected pressure color on the path.

## What the user should see

For the original fixture:

- Broker badge: “No active consumer · 3,044 buffered”.
- Storage badges: “No delivery from Operation Event Bus”.
- Clicking an affected node highlights the causal path and opens an explanation: “This broker is using a work-queue model. Its outgoing destinations do not consume from that model.”
- Available actions: “Inspect broker model”, “Add consumer”, and “Use stream broker” when appropriate. Model/topology changes must be explicit, undoable, and restart the run.
- Summary: “Requests acknowledged; background delivery stalled.” Request failures and delivery failures remain separate metrics.

For expected inactivity: “Served by upstream cache”, “Waiting for scheduled work”, or “Standby route”. For unresolved causes: “No traffic observed yet”, with time window and last arrival; never invent a specific diagnosis from zero alone.

## Implementation phases

### 1. Repair execution and telemetry contracts

Owner: simulator engineering.

- Record queue-consumer transfers against the actual connection, preserving edge identity through pull-source registration. Define how reverse-drawn consumer links and duplicate links are handled; count each actual transfer once.
- Audit pull-path link semantics as well as counters: partition faults, delay, routing direction, and queue wait timestamps must not be bypassed by a separate dispatch path.
- Define metric meanings per behavior: accepted, acknowledged, delivered, completed, failed, buffered, dropped, and consumer lag. Preserve independent request and background-delivery aggregates.
- Ensure pause, replay, reset, topology changes, and resource limits cannot leave stale explanations attached to current metrics.
- Verify default queue and stream-broker profiles against intended catalog semantics. Do not remap every generic message broker to Kafka just to make this example move.

Acceptance: flowing queue-consumer edges report nonzero traffic; all actual transfers reconcile with destination arrivals; stalled delivery cannot be presented as overall system success.

### 2. Validate executable paths before starting

Owner: compiler/catalog engineering, with product input on severity.

- Add graph diagnostics for no eligible consumers, unreachable executable nodes, invalid dependency targets, and excluded/documentation edges.
- Analyze effective execution paths using behavior capabilities, not visual adjacency alone. Account for pull consumers, control edges, asynchronous fan-out, and sources.
- Classify hard incompatibilities as errors; disconnected optional components and unexercised paths as warnings/information. Let valid portions remain explorable where results can be accurately scoped.
- Expose model provenance: assigned catalog profile, explicit override, defaults, and which authored properties are actually consumed. Show relevant assumptions before presenting confident results.
- Give persisted/template components explicit behavior metadata where semantics are known. Keep existing saved graphs compatible through versioned mappings and migration previews.

Acceptance: the supplied original walkthrough identifies its missing consumers before execution. Disconnected nodes are explained without classifying all idle nodes as broken.

### 3. Add deterministic runtime explanations

Owner: core and worker engineering.

- Introduce a framework-independent diagnostic structure with stable code, severity, affected nodes/edges, causal path, evidence window, observed values, confidence/evidence status, and suggested actions.
- Track bounded evidence: cumulative arrivals, last arrival time, queue growth/drain rates, consumer availability, routing decisions, cache hits/misses, active faults, and delivery outcomes.
- Diagnose in order: invalid/excluded graph semantics; unreachable source path; known upstream blocking; intentionally bypassed/cached/scheduled work; transient empty window; unknown/no evidence.
- Support multiple causes without claiming that one path explains all incoming dependencies. Use a short grace period and hysteresis to prevent status flickering.
- Recompute static path analysis only on semantic graph changes. Update bounded runtime diagnostics at existing snapshot cadence; do not retain one record per request.

Acceptance: a reason includes evidence and is distinguishable from a hypothesis; normal cache hits do not create error badges; overload identifies the upstream obstruction rather than blaming the idle destination.

### 4. Explain problems on the canvas

Owner: frontend/product design.

- Replace undifferentiated idle badges with concise reason labels and accessible icons. Retain plain inactivity when evidence is insufficient.
- Highlight the causal path when a user selects a diagnosis. Use amber for pressure or setup attention, red for observed failures, neutral for expected inactivity, and a distinct excluded/control-path treatment.
- Make buffer pressure depend on backlog, drain rate, and lag rather than CPU-style utilization.
- Inspector answers: What is happening? Why? What evidence supports it? What can I change? Include an explicit “Model limitation” explanation where operations are unsupported.
- Separate request success from background delivery and distinguish rolling from run-wide metrics. Keep detailed evidence in the inspector, with the important condition visible on the canvas.
- Maintain the product's shared controls, keyboard access, reduced motion, and narrow-canvas behavior.

Acceptance: a user can click any of the four inactive destinations and locate the common broker cause without reading engine documentation.

### 5. Align templates, routing, and future repair challenges

Owner: content/catalog and simulator engineering.

- Update the collaboration walkthrough with explicit consumer stages or an explicit stream-broker model; choose based on the lesson's intended architecture. Consumer groups and snapshot batching must have declared behavior or be identified as assumptions.
- Represent auth dependencies separately from alternative gateway routes. Add operation/workload classes for document reads, edits, searches, and invalidation incrementally; avoid guessing these from labels.
- Clearly mark unsupported operations such as cache invalidation until a corresponding behavior exists.
- Reuse diagnostic codes/evidence in repair challenges. Keep hints separate from authoritative scoring, and prevent acknowledgements alone from satisfying persistence/delivery objectives.
- Version the changes and require a fresh run when behavior/profile semantics change; never reinterpret an old replay silently.

Acceptance: the tutorial's executable model agrees with its prose, and challenge scoring requires the intended work to complete.

### 6. Validate the complete experience before release

- Keep the original fixture as a regression case and run multiple deterministic seeds.
- Cover direct queue-to-storage, queue-to-worker, stream groups, disconnected/reversed edges, cache hits and misses, zero load, slow consumers, full queues, crash/partition recovery, scheduled/standby paths, and unsupported models.
- Assert causal reasons and accounting invariants, not merely screenshots or nonzero animation.
- Browser exercise with a local disposable design: start, inspect each idle node, follow the causal path, apply an explicit fix, restart, observe delivery and backlog, then save/replay. Exercise light/dark themes, keyboard navigation, narrow canvases, and Chromium/Firefox.
- If account-only history needs validation, use a dedicated test account and environment; the local simulation path itself needs no dummy account.
- Check performance at supported graph/workload limits and verify simulator processing limits are never diagnosed as architecture bottlenecks.

Release gate: the original screenshot scenario is explained automatically; the corrected designs show truthful edge flow and delivery metrics; legitimate inactivity remains neutral; reproducible UI and engine checks pass. Phases 1–4 are required before calling this diagnostic experience production ready. Template and operation semantics must be truthful for any examples shipped with it.

## Responsibility boundary

The simulator owns detection, causal evidence, and actionable explanations. The user chooses intended architecture and operations where ambiguous. Engineers investigate proven accounting defects and unsupported semantics. No user should need to infer a hidden worker requirement from a generic Idle badge.
