# Document management simulator reproduction

Date: 2026-10-25
Frontend branch: `feat/architecture-simulator`
Problem: `6901ef1b9420d83630aca871`
Route: `http://localhost:5173/playground/6901ef1b9420d83630aca871`

## Browser baseline

- The route loaded the API-served walkthrough, version `1.0`, with 41 steps. The visible guided controls were used to apply all 21 component and connection actions; no graph was injected through application state or a script.
- The resulting canvas had 11 nodes and 10 connections: API Gateway, Load Balancer, Collaboration Server, Operation Event Bus (Kafka), PostgreSQL, S3 Object Store, Redis session cache, Elasticsearch, Auth Service, Redis response cache, and Monitoring.
- Simulation was started through the UI at 100 requests/sec, steady traffic, and 1× playback. The broker inspector showed **Message queue** behavior.
- At about 34 simulated seconds the broker showed roughly 2.4k buffered messages (the reading rose to about 2.7k shortly afterward). PostgreSQL, S3, Elasticsearch, and the response cache showed no traffic; their broker connections also showed no flow.
- At about 80 simulated seconds the queue reached its 5,000-message limit. The four destinations remained idle. One pause showed about 90 offered requests/sec, 25.6 completed/sec, 72.3% failed, and 56.1 ms p95. These are time-sensitive rolling readings, not fixed expectations.
- The guide's displayed sequence has out-of-order `stepNumber` values in later steps. Applying steps through the product controls still produced the expected 11-node/10-connection topology.

No account, saved diagram, or shared walkthrough was changed. The initial browser view and observations were available in the Computer Use session, but no screenshot was exported as a repository file.

## Fix verification after the baseline

- Compiler regressions now preserve the queue version of this graph and assert a missing-consumer warning plus downstream “No delivery from …” diagnoses.
- The local 41-step candidate explicitly selects the existing Stream broker model with 24 partitions. Applying it through the same guided-step helper retains that simulation configuration. It remains a local review candidate; the API continues to serve the existing DynamoDB walkthrough.
- The candidate's compiled simulation delivered traffic to PostgreSQL, S3, Elasticsearch, and the response cache after 44 simulated seconds for seeds 1, 42, and 1337.
- Pull-link regressions cover forward and reverse drawings, parallel links, multiple consumers, transfer-to-edge-flow reconciliation, and partitioned workers retaining buffered messages.

## Successful browser retry

Earlier attempts stopped when Computer Use could not determine Chrome's URL during navigation. A later retry reached the loaded route and verified the fixes in the rendered product.

- The existing signed-in design was inspected without changing its model or topology. At about 32.9 simulated seconds its queue showed 2,279 buffered messages, the four destinations showed “No delivery observed,” and all four blocked connections displayed “No active consumer.” The inspector labeled the queue's output **Acknowledged** and its pending work **Buffered**.
- A new anonymous Incognito canvas was built through all 41 guide steps and all 21 component/connection actions. Only this disposable canvas was used for model changes.
- Changing only the broker's Behavior selector from **Message queue** to **Stream broker** marked the previous readings stale and removed the old overlays until restart. The browser experiment used the model's default four partitions; the local candidate's explicit 24-partition config remains covered by the three-seed engine test.
- After restart at 100 requests/sec, steady traffic, and 1× playback, all four direct destinations received traffic. At about 49 simulated seconds the broker showed roughly 1.3k messages of consumer lag. The slower object-store path remained behind, so restored delivery did not imply adequate consumer capacity. Caller failures were still visible separately.
- Local saving reported “Run saved on this device.” The saved run's Replay action started a new simulation. Reset then returned to “Ready to simulate” and removed the previous node readings. This exercised a newly saved local run, not legacy engine-version compatibility or cloud replay.
- Light and dark desktop surfaces were inspected. The native Behavior selector was operated by keyboard. The full keyboard and reduced-motion audit remains outstanding.

## Additional corrections found in the browser

- Every simulation badge previously exposed the same “Inspect simulation for component” name. Badges now use the actual component label; the accessibility tree confirmed distinct names for all ten executable nodes.
- All setup notes appeared ahead of the selected component's metrics and model, pushing the behavior selector far below the fold. Setup notes are now a collapsed disclosure after the selected controls (expanded when compilation is invalid). The rendered inspector confirmed the new order.
- Attention entries now show component labels and omit the synthetic source. Stale/invalid snapshots do not supply current metrics to the inspector.
- The served guide's inserted steps retained old stored numbers, so the header/progress disagreed with navigation. The UI now displays navigation order and resolves phases by their explicit names, preserving stored step IDs and numbers.

The browser received user input during the viewport-size probe, so further automation stopped to avoid competing with it. No mobile-width result is claimed. The queue/worker browser variant, disconnected-node and 100%-cache-hit browser controls, legacy replay, full keyboard/reduced-motion checks, causal-path highlighting, and queue-pull delay semantics remain outstanding.

The current anonymous graph showing downstream delivery was saved as [browser evidence](evidence/simulation-2026-10-25/streambroker-browser.jpg). No shared guide or saved user design was changed.

## Final source checks

- `npx tsc -b --pretty false` completed successfully after the UI corrections.
- `git diff --check` passed.
- The focused compiler, engine, and walkthrough suite passed 220 tests; its all-presets goodput test exceeded the default five-second timeout under the current load. Rerunning only that test with `--testTimeout=30000` passed without any source or assertion change. The earlier run of the same 221-test suite had passed within the default budget.
