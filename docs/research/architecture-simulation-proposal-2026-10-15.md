# Architecture simulation for Diagramwise

Created: 15 October 2026. Updated: 23 October 2026. Status: first bounded implementation slice in progress on `feat/architecture-simulator`; not deployed. The current code provides educational capacity analysis, not a time-dependent production simulator. This review uses the inspected local product/code and primary-source research. It does not establish customer demand or production performance.

**Implementation authorization:** On 23 October 2026, the user explicitly asked to start implementation following this plan. Keep the work bounded by the supported URL-shortener model and its evidence. This authorization does not establish customer demand, production performance, or deployment readiness.

## Recommendation

The leading proposal is **guided architecture experiments on the learner's own design**, inside the existing practice canvas. Start from a question such as “What changes when redirect traffic increases?” and expose the relevant request path, assumptions, and before/after evidence. Begin with the URL-shortener exercise and a limited set of supported behaviors. A general **Simulate load** experience remains a candidate expansion after the models and learning value are validated.

This fits Diagramwise's stated purpose: helping engineers design, explain, review, and improve systems. It adds an experiment between drawing and assessment: predict a bottleneck, run a workload, inspect the cause, change one decision, and replay. That is a meaningful extension of the learning loop described in [README.md](../../README.md).

The product promise should be: **Explore how your design behaves under explicit workload and capacity assumptions.** Numerical outputs are results of an educational model. They are not measurements of a deployed application, cloud-instance benchmarks, or proof that the architecture is production-ready.

Treat this as a bounded product experiment, not a commitment to simulate the entire component catalog. The most important launch prerequisite is a coherent, versioned exercise and workload, rather than completion of every possible assessment enhancement.

## Alternatives and improvements to evaluate

The original simulator is one option. These comparisons are product judgments based on the current learning loop, not established learner outcomes, measured costs, or delivery estimates. Combine useful capabilities into the existing canvas rather than introducing a separate product mode for every idea.

| Option                                   | Learner experience                                                                                                                      | Relative effort and limitation                                                                                                           | Recommendation                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Guided what-if experiments**           | Choose a specific change: more redirect traffic, a different read/write mix, or a cache/replica change; compare under fixed assumptions | Medium to high; numerical results still require validated behavior models and explicit routes                                            | Leading product direction; keeps the user's architecture central and gives every result a question to answer   |
| **Request-path walkthrough**             | Select “create link” or “redirect” and follow the relevant nodes, dependencies, and branches                                            | Lower than numerical simulation, but AI-inferred execution meaning still requires review; cannot establish performance                   | Foundation and potentially useful first slice; addresses ambiguous connections before numerical results appear |
| **Curated bottleneck-repair challenges** | Start with a reviewed, editable architecture and improve it for a stated workload/resource constraint                                   | Medium; bounded graphs reduce interpretation uncertainty, but fixed recipes can undermine learning                                       | Useful pilot and optional practice entry point; reuse the same models as user-design experiments               |
| **Capacity reasoning attached to nodes** | See how users become requests and how those requests create cache/database work                                                         | Lower than time-dependent simulation; counts and capacity estimates cannot produce reliable timeout rates                                | Supporting capability within the canvas; avoid a separate large worksheet                                      |
| **Open-ended live simulator**            | Adjust arbitrary graphs and many parameters while observing dynamic behavior                                                            | Highest effort and broadest correctness burden                                                                                           | Later option, contingent on evidence from the bounded experience                                               |
| **AI-only what-if discussion**           | Ask what might happen under a changed workload and receive an explanation                                                               | Easier to connect to the existing reviewer; retains AI latency/variability and provides no independently calculated performance evidence | Useful qualitative discussion; do not present generated numbers as simulated measurements                      |

The strongest improvement is to make each experiment answer a learning question. A suitable loop is: optionally predict, run a supported experiment, inspect the cause, change one thing, replay, and explain. Keep predictions optional so this does not become another mandatory assessment interview.

For example, a URL-shortener experiment can ask whether a read replica helps after the workload becomes write-heavy. Include a counterexample where it does not solve the limiting capacity. Also include a low-load case where the simple architecture already meets its target. Success means satisfying the declared scenario with justified choices, not adding infrastructure until every node is green.

Curated challenges are a way to validate prepared behavior models quickly. They must not silently replace the original objective of experimenting with the learner's own architecture. Use the same scenario definitions, engine, and result semantics in both entry points; allow multiple valid improvements rather than comparison against a single canonical diagram.

### Proposed sequence if implementation is later requested

1. Establish operation paths and workload assumptions, with AI-assisted interpretation where necessary. Show what is declared, inferred, and unresolved.
2. Define a few reviewed experiments and editable reference cases. Start with traffic/work accounting and explicit capacity estimates; keep timeout percentages and latency distributions out until a time-dependent engine supports them.
3. Apply the same experiments to compatible learner-created designs, preserving baseline comparisons and highlighting unsupported behavior. Steps 1–3 can form one narrow pilot rather than three separate launches.
4. Add queues, bursts, timeouts, and recovery when they enable a demonstrated learning need. Extend component behavior and workload coverage only through additional validation.

Compare the guided approach with the original open-ended traffic-slider concept in observed learner sessions. Assess whether learners can explain the cause, transfer the lesson to an unfamiliar workload, reach a useful result without excessive configuration, and distinguish assumptions from measurements. Request-path inspection alone may be the better first deliverable if it resolves meaningful confusion; it should not be described as a performance simulator.

No alternative is an approved implementation scope yet. The first product decision is which learning outcome to validate, followed by the smallest behavior model that can support it credibly.

## Value and costs

| Potential benefit                          | Corresponding risk                                                    | Product response                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Immediate feedback while designing         | Moving particles can look meaningful without a sound model            | Make each bottleneck inspectable through workload, route, demand, and capacity |
| Learn why a cache or replica helps         | Learners memorize “add Redis” regardless of workload                  | Include scenarios where neither helps and simple architectures succeed         |
| Stronger design → experiment → revise loop | Another mode adds friction before the learner understands the problem | Optional action in the same canvas; one compact initial scenario               |
| Reproducible evidence for AI discussion    | An AI explanation may contradict or exaggerate the run                | Deterministic engine owns numbers; explanations reference run evidence         |
| Repeatable before/after comparison         | Users accidentally compare different traffic or defaults              | Freeze workload, model version, seed, and assumptions across comparison        |
| More concrete capacity reasoning           | Arbitrary defaults acquire false authority                            | Editable, versioned educational profiles with input provenance                 |
| Potential engagement and retention benefit | Implementation and content upkeep may exceed actual learning value    | Validate learning transfer and revision behavior before catalog expansion      |

These are product hypotheses, not measured conversion or retention claims. Simulation adds a continuing responsibility to maintain model semantics, fixtures, exercise profiles, and understandable explanations.

## What the current implementation provides

The first implementation slice now includes:

- A same-canvas capacity panel, currently enabled only for the URL-shortener exercise, with editable request rate, redirect share, cache-hit assumption, and per-role capacity profiles.
- AI-assisted route preparation for separate redirect and create-link paths, with backend validation of node/edge references and bounded cache/database semantics. Learners must confirm the displayed paths before analysis; they can correct a mismatch by editing the canvas and preparing again.
- A deterministic analytical capacity calculation in a browser worker. It reports operation demand, cache hits/misses, database reads/writes, component utilization, and the estimated capacity at the selected operation mix.
- An in-session baseline comparison that records the diagram fingerprint, exercise revision, scenario/model versions, input values, and whether each value is an educational default or a learner override.

The calculation is intentionally capacity-only. It does not model queue growth, latency, timeouts, rejected requests, bursts, recovery, or persistence of historical runs. These remain later work; the UI must not imply that its simple rate arithmetic is a time-dependent simulation.

The codebase also has useful seams:

- [System design types](../../src/types/systemDesign.ts) preserve component and connection IDs, semantic component classes, property bags, reasoning context, findings, and assessment history.
- [Requirement types](../../src/types/requirements.ts) carry exercise revision and core/extension scope. Requirements themselves and reasoning fields such as traffic and read/write ratio are still prose, not executable workload parameters.
- [SystemDesignPlayground](../../src/pages/SystemDesignPlayground.tsx) already hosts editing and assessment. Reuse its canvas and selected-component inspector.
- [Design review normalization](../../src/utils/designReviewContext.ts) preserves semantic IDs and removes presentation fields; share that boundary rather than the narrower final AI payload in [assessor.ts](../../src/utils/assessor.ts). The companion [API attempt models](https://github.com/satya00089/diagramwise-api/blob/feat/architecture-simulator/app/models/attempt_models.py) provide the existing persistence boundary for future saved run summaries.
- [URL-shortener guide](../../src/data/public/problemGuides/url-shortener-like-bit-ly.json) already distinguishes link creation from redirects, read-heavy traffic, hot links, and latency goals. Use its teaching structure, but resolve the authoritative exercise revision instead of silently copying its example numbers into every attempt.
- [Assessment implementation status](../../docs/plans/problem-requirements-and-assessment-trust-implementation.md) documents local versioned requirements and review trust work. Its release status is explicitly qualified; this proposal does not claim those changes are deployed.

The remaining foundation is richer executable behavior. An arrow cannot reliably tell us whether traffic is load balanced, broadcast, sequential, asynchronous, or conditional. The current model therefore supports only a narrow directed path with one database per operation and at most one cache on the redirect path; it does not infer replica routing or fan-out. A generic database icon does not determine query cost or throughput. Existing inspector defaults are also not guaranteed to be materialized in saved node properties; resolve all effective simulation inputs centrally.

Specific catalog fields also need interpretation: the gateway's rate-limit setting is an admission policy, not measured processing capacity; a database replication-factor default does not prove query-serving read replicas. Do not convert those fields directly into extra capacity. [Current component definitions](../../src/config/components.ts)

Reuse the current semantic graph boundaries, but add a small typed simulation contract rather than running calculations directly over rendering props. There is no reason to put MCP or an LLM in the calculation loop.

## Define the workload before deriving traffic

“One million active users” needs an activity window and behavior assumptions. Daily active users, concurrent users, sessions per second, API requests per second, and database operations per second are different quantities.

For example, **assuming** one million daily active users and 20 API requests per user per day:

```text
average RPS = 1,000,000 × 20 / 86,400 ≈ 231
peak RPS    = 231 × assumed peak multiplier of 5 ≈ 1,157
```

Both 20 and 5 are illustrative assumptions. They must be visible and editable, not inferred facts. Prefer request-rate controls for the simulation, with an optional users-to-traffic calculator. Where the approved exercise already supplies request rates, use those directly; do not multiply in another activity or peak factor accidentally. Preserve legitimate learner alternatives separately from fixed exercise targets.

Record:

- Operation names and mix: initially `redirect` and `create-link`.
- Arrival profile: steady, then a defined peak/ramp; duration and warm-up where relevant.
- Requests per second; optional DAU derivation and its inputs.
- Operations performed downstream by each request, including any multiple queries.
- Latency/deadline target and request completion semantics.
- Whether freshness-sensitive reads are eligible for a replica.

Missing numeric configuration may use scenario defaults. Missing route meaning cannot always be safely defaulted: show a candidate path for confirmation or explain which ambiguity prevents that path from running.

## A simple example of the teaching value

For a separate, illustrative 1,000-RPS run, assume 95% redirects, 5% creates, one database read per redirect, one write per create, and no other database work:

| Model input/output          | Without a cache | Cache on the redirect path, assumed 90% hit rate |
| --------------------------- | --------------: | -----------------------------------------------: |
| Redirect requests/s         |             950 |                                              950 |
| Create requests/s           |              50 |                                               50 |
| Database reads/s            |             950 |                                               95 |
| Database writes/s           |              50 |                                               50 |
| Total database operations/s |           1,000 |                                              145 |

This is request accounting, not a performance benchmark. Reads and writes may have different costs; a real model must retain those classes instead of treating every operation as equally expensive. Cache fill work, cache capacity, invalidation, and additional queries require their own stated assumptions.

Under these assumptions, a cache reduces database reads; it does not remove writes. Whether the database was overloaded in the first place depends on its configured capacity and service demand. A disconnected cache changes nothing. Cache-aside semantics require a backing-store read on a miss and a defined response path. [AWS caching patterns](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html)

A read replica only helps eligible reads that the application routes to it. It does not expand primary write capacity, and asynchronous replication introduces freshness considerations. For newly created links, immediate redirects may need primary routing or another explicit read-after-write strategy. [Amazon RDS read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)

The useful finding is conditional: “Redirect misses drive this database beyond its configured read capacity; under the assumed hit rate, caching reduces that demand.” Avoid categorical findings such as “Redis is missing, so the architecture fails.”

## Simulation candidate: bounded URL-shortener pilot

**Exercise:** URL shortener. **Operations:** redirects and link creation. **Topology:** supported directed request paths with explicit cache branches and replica routing; no unrestricted cyclic graphs or arbitrary fan-out.

Supported roles:

- Client/traffic source.
- API gateway and load balancer as distinct optional roles; neither is mandatory for every valid design.
- Stateless application service, with instance count and an explicit parallelism model.
- Cache, with a stated hit-rate assumption and miss route.
- Database primary and read replica, with distinct read/write service demand and routing eligibility.

A replica can first model load distribution while clearly stating that replication lag and stale-value correctness are not simulated. In that version, disallow its use for operations requiring immediate freshness unless a supported primary-read path exists. Do not suggest replica use satisfies a consistency requirement merely because load improves.

Inputs should be progressively disclosed: traffic and operation mix first; effective component profiles, capacity, cache hit rate, queues, and timeout policy on inspection. Use one capacity model per profile. For example, service-time distributions and concurrent slots may determine capacity; do not also allow a contradictory independent throughput number.

Results for the numerical simulation candidate below. A capacity-only experiment should show demand and configured capacity, and omit queue, latency, and failure metrics until its model supports them:

- Offered requests/s and successful completions within the deadline.
- Queue occupancy and capacity pressure at the limiting component.
- Modeled latency distribution when enough simulated samples exist, with sample count and run window.
- Rejections, timeouts, and still-in-flight requests as distinct outcomes.
- Cache hits/misses and database read/write demand.
- Before/after comparison, with added instances/components visible as the resource tradeoff.

Do not initially add production deployment, real network load generation, provider-specific sizing guarantees, live cloud prices, global failover, autoscaling, arbitrary retry policies, message-broker services, or full cache-key/TTL dynamics. Internal waiting queues are necessary for overload modeling even when message-broker components are outside pilot scope.

## Proposed experiment flow

1. Build the architecture as today, then choose a relevant experiment. **Simulate load** is one possible action label, subject to the selected scope.
2. Review a prefilled scenario: workload, operation mix, routes, and visible default profiles. Resolve material ambiguities.
3. Optionally predict the bottleneck. Keep this lightweight rather than adding a mandatory interview.
4. Run the baseline. Select a highlighted component to see what reaches it and why it is limiting the modeled workload.
5. Increase request rate or run the defined peak scenario. Distinguish a changed workload experiment from a changed architecture experiment.
6. Change one design decision and replay the saved workload. Preserve the baseline and identify the changed inputs.
7. Explain the result, optionally asking the existing AI assessment to discuss the evidence and remaining tradeoffs.

Animation can support comprehension, but request particles must be a visual sample. Their count and rendering speed must not determine the simulation. Keep charts and text accessible without color or animation, and keep the editor responsive.

## Engine and integration plan

### Clarification: preserve AI's role in interpreting the current canvas

The existing drawing experience lets learners connect components freely. Current `buildSystemDesignSolution` retains connection labels and purpose text and defaults missing connection types to `api-call`. The assessment prompt asks AI to judge endpoint, protocol, direction, and purpose compatibility; the assessor's deterministic integrity checks cover IDs and endpoint existence. Those checks do not constitute an executable interpretation of the architecture.

Therefore introduce a **Prepare simulation** module before execution. For ambiguous diagrams, use the existing provider-neutral LLM interface to propose a structured mapping from the exact saved graph into the engine's supported behaviors: operation routes, routing conditions, behavior/profile identifiers, unresolved assumptions, unsupported elements, and evidence-linked connection issues. Explicit supported configurations can map directly without an AI call. A general assessment score or prose verdict is not sufficient input to the engine.

AI must select from an approved behavior vocabulary and reviewed default profiles, preserve original node/edge IDs, and distinguish declared configuration from inferred meaning. It must not invent capacities as measured facts, silently insert an application between gateway and Redis, or generate arbitrary executable code. Validate the proposed mapping against the graph and the engine's contracts. Known incompatibilities can block a run; unsupported or unresolved behavior should say why preparation cannot complete, rather than asserting that the architecture is impossible. AI suspicion alone is not proof of incompatibility. Present material inferred routes and assumptions for learner correction before freezing the prepared model.

This preserves the simple drawing experience, but adds a possible AI wait on first preparation or after semantic changes. Save the prepared interpretation with its graph/configuration fingerprint, assumptions, preparation/model versions, and supported scope. Changing request rate within that scope can rerun the deterministic engine immediately; changes to topology, operation semantics, or relevant configuration invalidate the affected preparation. Failed preparation retains the design and produces no fabricated simulation metrics.

AI-assisted interpretation reduces manual mapping work; it does not remove the need to implement and validate supported simulation behaviors or establish correctness for every catalog component. This is a proposal, not existing shipped behavior.

Use a pure, versioned simulation module with a small input/output contract, running in a browser Web Worker initially. The browser can calculate locally without an AI request for every adjustment. Persist compact runs through the existing attempt workflow when save/compare becomes part of the pilot; server-side validation and trusted recomputation are necessary before any future grading or leaderboard use.

```text
Saved semantic diagram + approved exercise revision + learner overrides
    → AI-assisted interpretation when needed, restricted to supported behaviors
    → resolve profiles and show assumption provenance
    → compile and validate operation-specific routes
    → deterministic simulation in a worker
    → metrics + evidence linked to node/edge/requirement IDs
    → canvas inspection + baseline comparison + optional AI explanation
```

Keep four boundaries explicit:

1. **Graph adapter:** maps catalog identities into supported behavior roles while preserving original node/edge IDs. Unknown components in an active path are unsupported, not unlimited-capacity pass-throughs. Unrelated diagram annotations can be excluded visibly.
2. **Scenario/profile resolver:** produces complete typed inputs and provenance (`user`, `exercise`, `educational-default`). Defaults resolve once and become part of the run snapshot.
3. **Simulation engine:** maintains operation identity, event ordering, resource slots, finite waiting queues, completion/deadline outcomes, and conditional routing. It has no React, AI-provider, or cloud-vendor dependency.
4. **Results/explanation adapter:** renders aggregate observations and bounded causal traces. Optional AI explanations must cite run evidence and preserve assumptions and limitations.

Start with a small analytical demand calculation to test routing and conservation. Before presenting dynamic failure percentages or timeouts, implement an actual bounded time/event model. Do not convert “80% utilization” into an arbitrary error percentage. Queueing, deadlines, admission policy, and service behavior determine outcomes. [AWS load shedding](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)

For repeatability, freeze input hash, diagram revision, requirement revision, scenario/profile versions, engine version, seed, duration, and warm-up. The same snapshot and seed must replay identically. Changing diagram positions must not change the result. A live slider can launch a new run; historical comparison must preserve exactly which run it compares.

Set explicit limits for nodes, simulated requests, events, elapsed computation, and retained traces. Stop with an incomplete/limit-reached state when exceeded; never present truncated execution as a complete successful run. Cancel obsolete runs when the learner changes inputs. Define how timed-out in-flight work is treated, so an operation cannot both time out and count as a successful user response.

Simulation remains separate from the architecture-review score. It covers modeled performance behavior; security, correctness, durability, operational complexity, and unmodeled requirements still need reasoning and review. A short successful run cannot establish an annual availability target.

## Current implementation boundary

The implementation requested on 23 October is in progress on `feat/architecture-simulator`. This first slice is a URL-shortener **capacity analysis**, not the time-dependent simulator described by the later stages:

- The API prepares one redirect route and one create-link route from the supplied graph. The learner reviews the proposed paths before calculating.
- The browser worker applies a typed, versioned analytical model. Each uncached redirect contributes one database read; each link creation contributes one database write; database operations have equal assumed cost; capacity scales linearly with offered load.
- The learner can change the operation mix, redirect cache-hit assumption, and role-level educational capacity profiles. Inputs identify defaults separately from learner overrides.
- Results show path demand, configured capacity, utilization, the limiting component, and database/cache operation counts. The in-session baseline records the graph, exercise revision, interpreted routes, component roles, and input provenance.
- The panel is enabled only for the URL-shortener exercise. No run is persisted, and the numbers are not production measurements.

Breakscale source was inspected directly. Its current MIT-licensed engine is a browser-side discrete-event runtime with a heap scheduler, seeded random generator, component behavior registry, pooled requests, queues, retries, and runtime metrics. Those behaviors are coupled to Breakscale's own node and runtime types. Reusing pieces for this analytical calculation would add an adapter without improving its stated arithmetic, so the current slice uses a small local engine. Revisit selective reuse only if Diagramwise implements event timing, queues, retries, or request traces, and then compare each behavior against Diagramwise's own fixtures. The full Breakscale app would duplicate a canvas and product flow Diagramwise already owns. [Breakscale repository](https://github.com/xevrion/breakscale)

The current implementation does not model branches, replicas, queues, bursts, latency, deadlines, failures, or autoscaling. Run persistence, historical replay, learner evaluation, and expansion beyond this exercise remain pending. The tests and build checks still need a clean review before this slice can be marked complete.

Diagramwise's opportunity is the connected learning experience: the learner's existing exercise, saved design, declared assumptions, experiment, explanation, and revision. We have not established that simulation itself is a unique market feature.

## Future delivery sequence and decision gates

Implementation has been explicitly requested for the first bounded slice. Stage 1 is in progress; the remaining stages are gated on correctness and learning evidence. This work does not establish that the model is validated for production use.

| Stage                       | Deliverable                                                                                                                                        | Exit condition                                                                                      | Status                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Model spike              | Versioned URL-shortener workload, typed route/profile contract, hand-calculated fixtures; compare a minimal engine with selective Breakscale reuse | Reviewers can explain every output from stated inputs; all supported paths have unambiguous meaning | In progress: contract and engine comparison are implemented; fixture verification and review are pending |
| 2. Private functional pilot | Deterministic engine, same-canvas inspection, traffic control, defaults provenance, baseline comparison                                            | Conservation, routing, overload, replay, and browser responsiveness checks pass                     | Partial: panel, worker, assumptions, and session baseline exist; event behavior and pilot checks remain  |
| 3. Learning pilot           | Observed sessions with roughly 8–12 target learners and 2–3 experienced reviewers                                                                  | Learners can explain the cause and transfer it to a new workload; major misconceptions are absent   | Pending                                                                                                  |
| 4. Controlled expansion     | One additional workload chosen to test a new concept                                                                                               | First pilot has clear learning value and manageable content/model maintenance                       | Pending                                                                                                  |

The later event-based model and learner pilot remain substantial engineering and content work. For the current slice, the main remaining checks are verifying the hand-calculated cases, confirming API contract compatibility, and reviewing the end-to-end experience.

Proposed pilot targets, to agree before testing rather than treating as industry benchmarks:

- At least 75% of participants can identify and explain the limiting component without an AI hint.
- Most transfer the reasoning to an unseen case, including a write-heavy or low-hit-rate case where a cache/replica does not solve the problem.
- At least 90% can distinguish assumed simulation outcomes from production measurements. For a small cohort, report the actual counts as well as percentages.
- Experienced reviewers identify no major misleading causal behavior in the supported scenarios.
- Track first useful run, revision after a run, successful replay, and later return to practice. Repeat usage is a hypothesis to measure, not an assumed benefit.

Pause expansion if learners merely chase green components, numerical certainty exceeds model fidelity, configuration blocks their first useful run, or workload changes get confused with architecture improvements. Improve the model/interaction before adding more component types.

## Correctness and review fixtures

The first suite should test meaningful causal claims:

- Traffic conservation: offered requests reconcile with successful, rejected, timed-out, and in-flight outcomes; downstream operations are counted separately.
- Zero traffic and a low-load valid design remain healthy; Redis is not mandatory.
- A disconnected cache or unused replica changes no serving behavior.
- Cache hit rates of 0% and 100% route the correct reads; writes retain their intended path.
- A missing cache backing-store route is invalid rather than successful.
- A read replica receives only eligible reads; adding it does not increase write capacity.
- More application instances cannot cure a database bottleneck without a modeled change to database demand or capacity.
- A sustained overload fills queues or triggers the configured policy; a bounded spike followed by low load allows the expected recovery.
- Fixing one bottleneck may reveal another; an unsupported active-path node or ambiguous branch blocks only what cannot be meaningfully simulated.
- Identical snapshots replay identically; layout edits have no effect; different model/scenario versions are visibly identified.
- Percentiles come from defined samples, successful latency is not mixed with fast rejection latency, and budget exhaustion produces an incomplete run.

Use expert-reviewed expected results and small hand-computable cases before visual polish. Any synthetic benchmark used for engine testing must be labeled as synthetic. Real capacity calibration, if later introduced, needs workload-specific measurements and versioned provenance.
