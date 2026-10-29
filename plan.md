# Simulator investigation and implementation handoff

> **Current priority — 2026-10-27:** Follow [Repair challenge: product and implementation plan](docs/research/repair-challenge-production-plan-2026-10-27.md) for the “Try a repair challenge” redesign. It records the current develop baseline, confirmed source findings, isolated workspace design, delivery milestones, and production release gates. The document below retains the earlier document-management simulator investigation and its separate browser evidence.

Updated: 2026-10-25. Intended reader: local Codex with the **Computer Use** browser plugin.

## Task and current status

Reproduce the document-management guided walkthrough in the running product, investigate why four downstream nodes show **Idle**, and fix the verified causes. The user explicitly requested real UI testing rather than conclusions based only on screenshots or engine tests. They authorized local testing and a disposable account if needed, and allowed implementation once the diagnosis is supported.

**Start with the browser reproduction below.** The local Computer Use reproduction confirmed the queue behavior and idle downstream nodes before implementation. A successful retry now verifies the missing-consumer warnings, the controlled Stream broker change, lag, local save/replay/reset, and desktop themes in the rendered product. Evidence and remaining gaps are recorded in [document-management-simulator-browser-reproduction-2026-10-25.md](docs/research/document-management-simulator-browser-reproduction-2026-10-25.md).

- Frontend repository: `diagramwise` (package name `diagrammatic`).
- Backend repository: sibling `diagramwise-api`.
- Branch used in both: `feat/architecture-simulator`. Preserve this explicitly requested feature-branch workflow and unrelated edits; inspect current Git state before working.
- Reviewed frontend commit: `5169367e48a32ca6f781ce60523c5408aa9c5568`.
- Backend baseline: `bd3774f40801603a55bcc06a110b4569662533d9`.
- Local frontend fixes and focused verification are recorded below. The authoritative API walkthrough was not changed or published; these changes are not deployed.
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

| Experiment                                                       | Result                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unchanged served walkthrough                                     | Broker backlog 3,044 / 3,147 / 3,178 across the three seeds; database, object storage, search, and response cache receive zero traffic. No compiler warnings/errors.                                                                          |
| Change only broker's explicit simulation kind to `streambroker`  | All four destinations receive traffic. Lag remains 1,131–1,258 under default assumptions, associated with the slower object-storage consumer. This restores delivery but does not establish adequate capacity or correct operation semantics. |
| Keep queue; add a `worker`; route broker → worker → destinations | All four destinations receive traffic; queue backlog is zero at observation. Worker arrivals are 62.2–76.7/sec, but the queue-to-worker edge reports **zero flow** in every seed.                                                             |
| Disconnect database and explicitly select gateway as entrypoint  | No compiler diagnostic identifies the unreachable database.                                                                                                                                                                                   |
| Separate cache → database graph with 100% cache hits             | Database is correctly idle. Zero traffic alone is not proof of a problem.                                                                                                                                                                     |

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

### Local Computer Use reproduction and implementation status

- The real anonymous UI flow applied all 21 component/connection actions in the served 41-step walkthrough and produced the 11-node/10-connection graph. The simulation ran through the UI at 100 requests/sec, steady traffic, and 1× speed; it reproduced the growing queue and four idle destinations. The behavior selector showed **Message queue**.
- The successful retry confirmed the warnings on the queue and all four destinations. The existing signed-in design was only simulated and inspected. A separate anonymous canvas was rebuilt through all 21 actions for the model experiment.
- Added behavior-aware compiler warnings for reachable work queues without pull consumers and information/warnings for executable nodes unreachable from traffic. Direct queue-to-sink edges no longer imply delivery. Control edges do not create traffic reachability, and statically reachable cache-to-database paths remain valid when cache hits suppress observed database traffic.
- Queue consumers now retain link identity, transfer flow is counted once per pulled message, parallel links are round-robin accounted, reverse-drawn consumer edges stay out of normal request routing, and partitioned consumers stop pulling. UI labels distinguish queue acknowledgements/publications from background delivery and show queue backlog or broker consumer lag as pressure.
- The local 41-step Kafka candidate explicitly selects `streambroker` and maps its documented 24 partitions into simulation config. It routes to all four downstream destinations for seeds 1, 42, and 1337 in the local engine. It remains a local candidate: the running API still serves DynamoDB version 1.0.
- In the anonymous browser canvas, changing only the queue model to Stream broker (default four partitions) restored traffic to all four destinations. Lag was about 1.3k messages at 49 simulated seconds. Newly saved local history replayed successfully, reset removed old readings, and light/dark desktop themes were inspected. A [sanitized screenshot](docs/research/evidence/simulation-2026-10-25/streambroker-browser.jpg) is now saved.
- The browser exposed duplicate accessible Inspect names and setup notes obscuring the selected controls. Badges now use component names, setup notes are collapsed after the selected controls, and attention entries use component labels. The guide header/progress now follow navigation order rather than stale persisted lesson numbers.
- Focused Vitest coverage (compiler, engine, walkthrough) and TypeScript build checks pass. See [the reproduction record](docs/research/document-management-simulator-browser-reproduction-2026-10-25.md) for the browser baseline and remaining limits.
- Final source checks after the browser-found UI fixes: TypeScript and diff checks passed. The regression run passed 220 tests and timed out in the all-presets goodput test at its default five-second budget; that test passed when rerun alone with a 30-second budget. No assertion or simulation behavior was changed to pass it.

Still unverified: browser worker variant, disconnected-node case, cache-hit negative control, legacy/cloud replay, authentication, full keyboard/mobile/reduced-motion checks, and delay semantics on queue-pull links. User browser input interrupted the viewport-size probe, so no narrow-width result is claimed. Authentication sequencing, snapshot batching, cache invalidation, and the exact persistence/indexing semantics described by lesson prose are not implemented by this slice. The shared DynamoDB walkthrough has not been changed.

## Step 1 — Start the real services and reproduce through Computer Use

- [x] Read repository setup instructions and inspect current branches/dependencies. Use the user's existing local environment configuration without printing secrets. No test records or account were created.
- [x] Start/use the API and frontend locally and confirm browser traffic reaches the configured API. The route returned the live DynamoDB-backed walkthrough.
- [x] Check `/health`, the problem endpoint, and the walkthrough endpoint. Health and both API endpoints returned HTTP 200; served guide version 1.0 has 41 steps.
- [x] Open `http://localhost:5173/playground/6901ef1b9420d83630aca871` through Computer Use without changing authentication or creating a saved diagram.
- [x] Open the guided walkthrough and apply all 21 component/connection actions with the real controls.
- [x] Capture and compare the completed topology, broker behavior, and connections: 11 nodes, 10 edges, broker model Message queue.
- [x] Start simulation from the UI at 100 requests/sec, steady traffic, 1× playback and observe the queue growth at about 34 and 80 simulated seconds.
- [x] Inspect the system summary, broker backlog, four idle destination badges, their connecting edges, and the broker's behavior model.
- [x] Save a sanitized reproduction record and post-fix browser screenshot under `docs/research`. The before-change screenshot was not exported.

If the browser result differs from the engine result, investigate the UI-created graph, component overrides, guide application, worker protocol, stale snapshots, and display mapping before editing behavior.

## Step 2 — Controlled browser experiments

Use copies or resettable test designs. Keep the unchanged baseline.

- [x] In an anonymous copy of the original graph, explicitly change the broker to **Stream broker**, restart, and observe all four destinations. The browser used default four partitions and showed about 1.3k consumer lag after 49 simulated seconds; the local 24-partition candidate is engine-verified separately.
- [ ] In a separate browser copy, use a work queue with an explicit background worker and downstream connections. The queue/worker transfer and edge accounting are covered by engine tests; the visual variant remains unverified.
- [ ] Disconnect a destination and record whether the product explains why it is idle. The compiler behavior is covered in source tests; the UI experiment remains unverified.
- [ ] Test a cache with 100% hits before a database. The compiler test preserves this as a legitimate statically reachable path; the browser negative control remains unverified.
- [x] Record remaining differences between the guide's prose and simulated operations. Authentication ordering, snapshots/batching, cache invalidation, and exact search/persistence semantics remain unsupported or unverified.

## Step 3 — Implement the verified corrections in this order

### A. Align the served walkthrough and executable model

- [x] Preserve the original queue graph in the document walkthrough regression and assert the missing-consumer cause.
- [x] Use explicit stream-broker semantics in the local Kafka event-broadcast candidate; no global `message-broker` mapping changed.
- [x] Map and compile the supported 24-partition setting explicitly. Retention hours and other prose-only operations are not mapped to unsupported config.
- [ ] Correct the authoritative walkthrough source and its publishing/versioning path. Only the local candidate is updated; the live DynamoDB source was not changed or published.
- [ ] Preserve replay compatibility for existing saved runs and existing canvases; save/replay UI and migration behavior were not retested.
- [x] Record unsupported auth ordering, batching, cache invalidation, persistence, and indexing semantics instead of inferring them from labels.

### B. Explain invalid paths before and during execution

- [x] Detect reachable queues without compatible consumers and executable nodes unreachable from the selected traffic source.
- [x] Base reachability on behavior capabilities, pull consumers, fan-out source behavior, and control/annotation edges.
- [x] Use warning severity for blocked queue paths and informational severity for otherwise disconnected optional nodes; cache-hit paths remain statically reachable.
- [x] Add stable diagnostic codes, affected nodes, a causal first edge where present, and actionable message text. Full causal-path highlighting remains unimplemented.
- [x] Keep the selected behavior model and model assumptions visible in the existing inspector.

### C. Fix accounting and metric meaning

- [x] Preserve queue-consumer edge identity and count actual transfers once. Tests cover both drawing orientations, duplicate links, multiple consumers, and partitioned consumers. Queue-pull latency/delay behavior remains unverified.
- [x] Distinguish queue acknowledgements and broker publications from background delivery; show buffered messages and consumer lag separately from caller responses.
- [x] Verify pause, model-change stale state, restart, reset, and replay of a newly saved local run in the browser. Legacy/cloud replay and arbitrary topology edits remain unverified.

### D. Show the cause on the canvas

- [x] Show a no-consumer/backlog condition on the queue and a “No delivery from …” explanation on affected downstream components.
- [ ] Selecting an explanation does not yet highlight the whole causal path; the inspector and node selection remain available.
- [x] Base queue and broker pressure on buffered messages/consumer lag. Preserve text, icons, wrapping, and the existing reduced-motion rule; rendered verification remains open.
- [x] Keep unrelated disconnected components neutral and cache-hit paths undiagnosed based on zero counters alone.
- [x] Reuse the product's existing behavior selector and shared simulation controls; keep details in the inspector.

## Code map

Paths below are relative to the frontend unless marked API. Search symbols rather than relying on old line numbers.

| Area                         | Files / symbols                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| UI guided-step construction  | `src/pages/SystemDesignPlayground.tsx`: `handleApplyStep`                                                                                   |
| Guided graph application     | `src/utils/guidedWalkthrough.ts`: `applyGuidedStep`                                                                                         |
| Current fixture candidates   | `src/test-fixtures/document-walkthrough.json`; `src/test-fixtures/walkthroughs/6901ef1b9420d83630aca871.json`                               |
| Catalog mapping and compiler | `packages/simulation-core/src/catalog.ts`; `compiler.ts`: `compileGraph`                                                                    |
| Queue/worker behavior        | `packages/simulation-core/src/behaviour.ts`; `engine.ts`: `ackAndBuffer`, `pumpWorker`, `takeFromSources`                                   |
| Stream broker and gateway    | `packages/simulation-core/src/behaviour-messaging.ts`                                                                                       |
| Defaults and runtime         | `packages/simulation-core/src/presets.ts`; `runtime.ts`: `createSimulation`                                                                 |
| Worker and session           | `src/simulation/simulation.worker.ts`; `SimulationHost.tsx`; `store.ts`                                                                     |
| Canvas and inspector         | `src/simulation/RuntimeOverlays.tsx`; `src/components/simulation/presentation.ts`: `nodeSimulationSignal`; `SimulationInspector.tsx`        |
| Served walkthrough           | API: `app/routers/walkthroughs.py`; `app/services/dynamodb_service.py`: `get_walkthrough_by_problem_id`; `app/models/walkthrough_models.py` |
| Cloud replay contract        | API: `app/routers/event_simulation.py`; trace its models/validation if simulation schema or versions change                                 |

## Step 4 — Verification and completion criteria

Tests and real simulation runs are authorized by the user's request. Add regressions for the actual defects and use Computer Use for the product journey.

- [x] The original graph's regression explains the absent consumer and names the same upstream queue as the cause of its four inactive destinations.
- [x] The explicit Stream broker browser variant delivers to all four destinations and reports consumer lag separately from publications. The local candidate's 24 partitions are verified through engine tests; the browser model-only experiment used default four partitions.
- [ ] Pull-edge flow reconciles with actual transfers, including reverse/parallel links; partition faults are covered. Pull-link delay behavior remains unverified.
- [x] Queue acknowledgements and broker publications are labeled separately from background backlog/lag, so caller completion does not stand alone as delivery evidence.
- [ ] Finish browser checks for disconnected paths, cache hits, zero load, slow consumers, full queues, multiple paths, and scheduled/standby work. Existing static/engine checks cover only a subset.
- [x] The local corrected guide candidate is exercised after 44 simulated seconds at seeds 1, 42, and 1337, using a persisted repository fixture.
- [x] Repeat the guided UI journey after changes: all 21 actions, start, inspect, change model, restart, pause, reset, local save, and replay. No API replay contract changed; legacy/cloud replay remains unverified.
- [ ] Check keyboard interaction, narrow layouts, light/dark themes, reduced motion, stale-state handling, and supported graph/workload limits in the rendered product.
- [x] Update this plan with actual browser findings, code changes, test results, and remaining limitations. Report blocked checks as blocked.
- [ ] Obtain the repository-required independent review before any commit. Keep delivery scoped to the user's feature branch and preserve unrelated work.

Completion means the actual product explains and correctly executes this scenario. A green path, passing core test, or model-only change is not sufficient evidence of production readiness.
