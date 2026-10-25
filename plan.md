# Simulator investigation and implementation handoff

Updated: 2026-10-25. Intended reader: local Codex with the **Computer Use** browser plugin.

## Task and current status

Reproduce the document-management guided walkthrough in the running product, investigate why four downstream nodes show **Idle**, and fix the verified causes. The user explicitly requested real UI testing rather than conclusions based only on screenshots or engine tests. They authorized local testing and a disposable account if needed, and allowed implementation once the diagnosis is supported.

**Start with the browser reproduction below.** Read and follow the locally available Computer Use plugin instructions. The cloud session could start both services and test live API data, but had no browser-control tool. Local Codex should complete that missing work, revise the diagnosis if evidence differs, and continue with implementation and verification.

- Frontend repository: `diagramwise` (package name `diagrammatic`).
- Backend repository: sibling `diagramwise-api`.
- Branch used in both: `feat/architecture-simulator`. Preserve this explicitly requested feature-branch workflow and unrelated edits; inspect current Git state before working.
- Reviewed frontend commit: `5169367e48a32ca6f781ce60523c5408aa9c5568`.
- Backend baseline: `bd3774f40801603a55bcc06a110b4569662533d9`.
- No application fix was made during this investigation. This document and the research plan are handoff documentation, not evidence of a shipped fix.
- Read each repository's `AGENTS.md`. Both require an independent review before every commit. This handoff does not require publishing or merging a release.

The more extensive design is in [simulation-diagnostics-plan-2026-10-25.md](docs/research/simulation-diagnostics-plan-2026-10-25.md). This file is self-contained for the immediate reproduction and fix; do not depend on cloud-session `/tmp` files or running processes being available locally.

## Confirmed evidence

### Actual served problem and walkthrough

- Problem ID: `6901ef1b9420d83630aca871`.
- Title: **Create a Document Management System like Wikipedia, Notion or Google Docs**.
- UI route: `/playground/6901ef1b9420d83630aca871`.
- Problem API: `GET /api/v1/problem/6901ef1b9420d83630aca871`.
- Walkthrough API: `GET /api/v1/problem/6901ef1b9420d83630aca871/walkthrough`.
- The running API connected to configured DynamoDB. Health was `healthy`; both endpoints returned HTTP 200.
- Served walkthrough version `1.0` has **41 steps**. The bundled `src/test-fixtures/document-walkthrough.json` candidate has **28 steps**. Do not substitute that candidate for the UI's API response without checking the difference.
- Applying the served steps through `applyGuidedStep` produced **11 nodes and 10 connections**. Its compiled executable fingerprint matched the candidate: `62660df37fba993d338f1e3b2751fd85` at the reviewed commit.
- No account or saved diagram was created, and no remote walkthrough was changed during the cloud investigation.

### Deterministic engine reproduction using the live response

Ran at 100 requested requests/sec, 44.1 simulated seconds, seeds 1, 42, and 1337. A separate seed-1 check used 100 ms advancement slices and a 4,000-event budget without hitting resource limits. These are engine and presentation-helper checks, **not browser runs**.

| Experiment | Result |
| --- | --- |
| Unchanged served walkthrough | Broker backlog 3,044 / 3,147 / 3,178 across the three seeds; database, object storage, search, and response cache receive zero traffic. No compiler warnings/errors. |
| Change only broker's explicit simulation kind to `streambroker` | All four destinations receive traffic. Lag remains 1,131–1,258 under default assumptions, associated with the slower object-storage consumer. This restores delivery but does not establish adequate capacity or correct operation semantics. |
| Keep queue; add a `worker`; route broker → worker → destinations | All four destinations receive traffic; queue backlog is zero at observation. Worker arrivals are 62.2–76.7/sec, but the queue-to-worker edge reports **zero flow** in every seed. |
| Disconnect database and explicitly select gateway as entrypoint | No compiler diagnostic identifies the unreachable database. |
| Separate cache → database graph with 100% cache hits | Database is correctly idle. Zero traffic alone is not proof of a problem. |

In the seed-1 original run, the presentation helper returns **“3,044 waiting”** for the broker and **“Idle”** for all four destinations. The rolling request failure rate is zero although the run has 46 failed requests in total. Rolling rates need not match a screenshot captured at a slightly different instant.

### Root cause and additional findings

1. **Walkthrough/model mismatch.** “Operation Event Bus (Kafka)” has `componentType: message-broker`. The catalog maps that ID to `queue`. A queue acknowledges and buffers messages until a compatible worker pulls them. The walkthrough connects it directly to four storage/cache/search destinations; none pulls from a queue. “Document Writer Consumer” is an edge label, not an executable worker. This explains the missing downstream delivery in the served graph.
2. **Missing compiler explanation.** The graph is accepted without warning about the absent consumers. Visual connectivity does not establish executable connectivity.
3. **Confirmed queue-consumer edge accounting defect.** The working worker variant transfers messages without incrementing its connecting edge's flow counter. The node can be active while the path looks inactive. Audit delay and partition-fault handling on this pull path too; those additional semantics are not yet proven correct or defective.
4. **Insufficient canvas diagnosis.** Idle badges inspect local counters and do not explain an upstream obstruction. The queue's generic “waiting for a service slot” explanation is misleading when there is no consumer at all.
5. **Acknowledgement versus delivery.** Queue producer acknowledgements can yield healthy request-completion metrics while persistence/indexing never happens. The UI does not clearly separate these outcomes.
6. **Authentication sequencing mismatch.** The gateway chooses one outgoing destination, so Auth Check and the load-balancer route are alternatives in the compiled model. The guide describes authentication before requests. That dependency is not represented by the labels.
7. **Configuration and operation mismatch.** The guide specifies 24 Kafka partitions in ordinary component properties, but simulation uses explicit simulation configuration/defaults. Cache-invalidation labels do not execute invalidation. Search/index writes and snapshot batching need explicit semantics or a visible limitation. Simply making all paths animate is insufficient.
8. **Backlog color gap.** Edge pressure currently depends on destination utilization >= 80%. Queue/broker utilization is zero by design, so buffered-work pressure is not reliably represented by that condition.

### What remains unverified

The cloud session did **not** test React rendering, actual guided-step clicks, browser-worker communication, toolbar interactions, canvas colors, screenshots, authentication, or save/replay UI. The user's exact saved diagram was not retrieved. The screenshot is consistent with the live-data engine results, but is not proof of identical saved settings. Complete these checks locally before claiming end-to-end reproduction or a production-ready fix.

## Step 1 — Start the real services and reproduce through Computer Use

- [ ] Read repository setup instructions and inspect current branches/dependencies. Use the user's existing local environment configuration without printing secrets. Determine which database it points to before creating test records.
- [ ] Start the API using the local Python environment: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `diagramwise-api`. Supply the project's required configuration through the normal local setup. For local HTTP authentication, use the existing supported `AUTH_COOKIE_SECURE=false` setting if needed, with appropriate localhost CORS/trusted-host settings.
- [ ] Start the frontend from `diagramwise`: `VITE_API_URL=http://localhost:8000 VITE_ASSESSMENT_API_URL=http://localhost:8000 npm run dev -- --host 127.0.0.1`. Adapt shell syntax and ports to the local machine. Confirm the browser actually calls this API.
- [ ] Check `/health`, the problem endpoint, and the walkthrough endpoint. Record the served version and step count. If unavailable, diagnose startup/data access; report any fixture substitution explicitly rather than calling it the live reproduction.
- [ ] Open `http://localhost:5173/playground/6901ef1b9420d83630aca871` through Computer Use. Use a new disposable attempt/design. Preserve the user's existing work. Use a disposable account only if the actual workflow requires one; don't bypass authentication.
- [ ] Open the guided walkthrough and apply all component/connection steps with the real controls. Record skipped or failed steps and browser errors. Do not seed the canvas through a store or script as a substitute for this baseline.
- [ ] Capture the completed topology, broker properties, and connections. Compare it with the 11-node/10-edge live-data baseline. Investigate differences instead of assuming the baseline is current.
- [ ] Start simulation from the UI at 100 requests/sec, steady traffic, default seed 1 where configurable. Record playback speed. Observe around 44–60 **simulated** seconds. Pause for inspection if available; exact rolling rates may differ by observation time.
- [ ] Capture the system summary, broker backlog, four idle node badges, and connecting edges. Inspect each node through the UI and record the explanation it provides. Confirm the behavior assigned to the broker.
- [ ] Save before-change screenshots and a sanitized reproduction record in the repository's chosen evidence location. Record commits, guide version, configuration, steps, simulated time, errors, and observed results. Keep credentials, cookies, and personal account information out of artifacts.

If the browser result differs from the engine result, investigate the UI-created graph, component overrides, guide application, worker protocol, stale snapshots, and display mapping before editing behavior.

## Step 2 — Controlled browser experiments

Use copies or resettable test designs. Keep the unchanged baseline.

- [ ] In the original graph, explicitly change the broker's simulation behavior to **Stream broker** through the inspector, restart, and observe all four destinations. Record lag as well as traffic. Confirm the UI uses the same intended configuration as the engine experiment.
- [ ] In a separate copy, use a work queue with an explicit background worker and downstream connections. Verify node arrivals against edge activity; reproduce the zero-flow defect visually if it still exists.
- [ ] Disconnect a destination and record whether the product explains why it is idle.
- [ ] Test a cache with 100% hits before a database. Preserve this legitimate inactivity as a negative control for future diagnostics.
- [ ] Record remaining differences between the guide's prose and simulated operations. Do not mark persistence, indexing, or invalidation correct merely because requests arrive at those nodes.

## Step 3 — Implement the verified corrections in this order

### A. Align the served walkthrough and executable model

- Preserve the original broken graph as a regression fixture.
- Use explicit stream-broker semantics for this Kafka event-broadcast lesson, unless browser/content review establishes that explicit worker stages better represent its intended architecture. Record the chosen semantics and assumptions.
- Map supported settings deliberately and validate them; do not infer behavior from display labels or globally change every generic `message-broker` into Kafka.
- Correct the authoritative walkthrough source and its publishing/versioning path. Updating only a repository test fixture will **not** change the current DynamoDB-backed API response. Prepare a reviewable content update and validate it locally before any shared-data publication.
- Preserve replay compatibility. Old saved runs must retain their original model/version; existing canvases need an explicit, understandable migration or model choice.
- Model auth dependencies and relevant operations correctly, or clearly identify unsupported semantics. Do not invent cache invalidation, document writes, indexing, or batching from prose.

### B. Explain invalid paths before and during execution

- Detect queues without compatible consumers and executable nodes unreachable from the selected traffic source.
- Base reachability on behavior capabilities, including pull consumers, asynchronous fan-out, and control/annotation edges.
- Use appropriate error/warning/information severity; optional disconnected nodes and legitimate cache bypasses should not become blanket errors.
- Give stable diagnostic codes, affected node/edge IDs, a causal path, evidence, and actionable suggestions. Keep this framework independent so repair challenges can reuse it.
- Show the actual assigned model, relevant defaults, and unsupported settings in the inspector.

### C. Fix accounting and metric meaning

- Preserve edge identity when registering queue consumers and count actual transfers once. Cover reverse-drawn consumer links, duplicate links, multiple consumers, delay, and partition faults.
- Separate request acknowledgement/completion from background delivery, backlog, and failures. Label rolling measurements and run totals clearly.
- Ensure pause/reset/replay/topology changes cannot retain stale metrics or explanations.

### D. Show the cause on the canvas

- For this case, target concise messages such as **“No active consumer · 3,044 buffered”** on the broker and **“No delivery from Operation Event Bus”** on downstream nodes.
- Selecting the explanation should highlight the causal path and expose the model/consumer action in the inspector.
- Base buffered-work pressure on backlog/drain/lag rather than CPU-style utilization alone. Preserve accessible icons/text alongside colors and reduced-motion behavior.
- Keep expected inactivity neutral. Use **“No traffic observed yet”** when evidence is insufficient; don't claim a cause from zero counters alone.
- Use the product's shared dropdowns and controls. Keep detailed evidence in the inspector while making the important condition visible on the canvas.

## Code map

Paths below are relative to the frontend unless marked API. Search symbols rather than relying on old line numbers.

| Area | Files / symbols |
| --- | --- |
| UI guided-step construction | `src/pages/SystemDesignPlayground.tsx`: `handleApplyStep` |
| Guided graph application | `src/utils/guidedWalkthrough.ts`: `applyGuidedStep` |
| Current fixture candidates | `src/test-fixtures/document-walkthrough.json`; `src/test-fixtures/walkthroughs/6901ef1b9420d83630aca871.json` |
| Catalog mapping and compiler | `packages/simulation-core/src/catalog.ts`; `compiler.ts`: `compileGraph` |
| Queue/worker behavior | `packages/simulation-core/src/behaviour.ts`; `engine.ts`: `ackAndBuffer`, `pumpWorker`, `takeFromSources` |
| Stream broker and gateway | `packages/simulation-core/src/behaviour-messaging.ts` |
| Defaults and runtime | `packages/simulation-core/src/presets.ts`; `runtime.ts`: `createSimulation` |
| Worker and session | `src/simulation/simulation.worker.ts`; `SimulationHost.tsx`; `store.ts` |
| Canvas and inspector | `src/simulation/RuntimeOverlays.tsx`; `src/components/simulation/presentation.ts`: `nodeSimulationSignal`; `SimulationInspector.tsx` |
| Served walkthrough | API: `app/routers/walkthroughs.py`; `app/services/dynamodb_service.py`: `get_walkthrough_by_problem_id`; `app/models/walkthrough_models.py` |
| Cloud replay contract | API: `app/routers/event_simulation.py`; trace its models/validation if simulation schema or versions change |

## Step 4 — Verification and completion criteria

Tests and real simulation runs are authorized by the user's request. Add regressions for the actual defects and use Computer Use for the product journey.

- [ ] Original graph produces a clear missing-consumer explanation and identifies the common upstream cause for the four inactive destinations.
- [ ] Corrected walkthrough agrees with its documented model, produces downstream delivery, and reports remaining capacity limits truthfully.
- [ ] Active queue-consumer edges report flow that reconciles with actual transfers; fault/delay behavior remains correct.
- [ ] Acknowledged requests cannot make stalled background delivery appear wholly successful.
- [ ] Disconnected paths, cache hits, zero load, slow consumers, full queues, multiple paths, scheduled/standby work, and unsupported operations are handled accurately.
- [ ] Deterministic scenarios cover seeds 1, 42, and 1337. Persist reproducible fixtures rather than depending on mutable live data for unit tests.
- [ ] Repeat the full guided UI journey after changes: start, inspect, change model/settings, pause/resume, reset, and rerun. Test save/replay separately if available, including API validation when its contract changes.
- [ ] Check keyboard interaction, narrow layouts, light/dark themes, reduced motion, stale-state handling, and supported graph/workload limits. Simulator resource limits must not be described as architecture bottlenecks.
- [ ] Update this plan with actual browser findings, before/after evidence, changes made, commands/results, and remaining limitations. Report blocked checks as blocked.
- [ ] Obtain the repository-required independent review before any commit. Keep delivery scoped to the user's feature branch and preserve unrelated work.

Completion means the actual product explains and correctly executes this scenario. A green path, passing core test, or model-only change is not sufficient evidence of production readiness.
