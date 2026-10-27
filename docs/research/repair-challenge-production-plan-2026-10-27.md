# Repair challenge: product and implementation plan

Date: 2026-10-27. Status: detailed implementation specification, based on source review. No repair-challenge browser run or implementation is claimed here. The contracts and file names below are proposed designs, not existing APIs.

## Outcome

### Implementation checkpoint — 2026-10-27

The working implementation now includes a dedicated `/challenges/:id` route, explicit challenge identity, owner-scoped IndexedDB drafts with revision checks, persisted allowed capacity/instance/queue edits, undo/redo, authored preview defaults, isolated preview/evaluation workers, cancellation and stale-result protection, goals, progressive hints, readable results, restart/import dialogs and draft export/import. The original inferred challenge mode has been removed from the generic simulation inspector. Scenario metadata now uses the actual runtime version; certification tests clone candidates independently of the authored definition.

Entry deliberately opens the isolated route in a **new tab** from an in-app preview dialog. This keeps the source editor mounted with its existing pending saves and does not copy or mutate its canvas. It avoids relying on an unimplemented source-save flush during navigation. Same-tab handoff/checkpoint recovery is still a future integration step; the source note directs users back to the original tab.

Current limits: one resumable local draft per owner/scenario revision; results are session-only and must be checked again after refresh; progress reports per seed rather than within each seed; no ranked/server-certified progress; layout is fixed for the three-node exercise. Storage failures retain the in-memory draft and expose export rather than claiming successful persistence. These are explicit scope differences from the full specification below.

TypeScript, production bundling and the five focused scenario/challenge checks passed during implementation. Independent review identified a resource-limited preview resume issue; pause now applies only to running previews, preserving the required fresh-start behavior after a processing limit. Entry is available in development and opt-in for production with `VITE_REPAIR_CHALLENGES_ENABLED=true`; the direct route remains accessible for draft recovery. Computer Use/browser tooling is unavailable in this cloud session, so the browser, accessibility, slow-device and source-save request-trace release gates remain outstanding. Do not call this checkpoint production-qualified.

Turn “Try a repair challenge” into a complete learning experience: enter a separate practice workspace, understand the problem, observe the failure on the canvas, change allowed settings, check the repair, and understand the result. The user's existing architecture must remain safe throughout. A finished first challenge is the release unit; the architecture should support additional authored challenges and future daily exercises.

The experience should feel like Diagramwise: shared typography, spacing, surfaces, dropdowns, buttons, and dialogs; clear canvas feedback; deliberate motion; concise explanations. Do not use browser `alert`, `confirm`, or `prompt`. Accessible inline status messages and in-app dialogs are appropriate.

## Baseline and scope

Both simulator branches have been fast-forwarded to `origin/develop`: frontend `3ca2613d`, API `c5f44e6`. These updates are local and have not been pushed to the simulator remotes. Recheck repository state and read `AGENTS.md` before implementation. Preserve unrelated work and the user's simulator branch instruction.

The native prompt from the user's screenshot has already been replaced on this baseline by a styled modal. It still confirms replacement of the current canvas. The broader experience remains incomplete.

This review traced the current implementation. The existing browser report in `document-management-simulator-browser-reproduction-2026-10-25.md` covers the document-management simulation, not this repair challenge. Use the local Computer Use plugin to establish a repair-challenge browser baseline before implementing. Read that plugin's instructions and retain before/after evidence.

## Findings that determine the design

| Priority | Source finding | Product consequence and correction |
| --- | --- | --- |
| P0 | `SystemDesignPlayground.loadRepairDemo` calls `setCanvasState` while keeping the current design ID, exercise ID, canvas scope, and ordinary autosave path. | Challenge content can be saved into the user's current architecture/attempt. Undo is not durable protection. Use an isolated challenge document and storage namespace. Confirm the autosave behavior on a disposable signed-in design. |
| P0 | `SimulationDetails.challengeActive` recognizes the sample from node IDs/kinds and required edge endpoints. | An unrelated graph can acquire challenge UI; deleting a required element can make the challenge disappear. Store explicit challenge identity independently of graph validity. |
| P0 | Evaluation state is cleared on scope changes, but not on candidate fingerprint/configuration changes. Worker responses lack a submission revision/token. | A pass can remain visible after a later edit or arrive for an outdated candidate. Bind results to an immutable submission and invalidate them when repair settings change. |
| P1 | Loading only copies `initialTopology` and resets the runtime. The session starts at 100 RPS and may retain previously selected load/pattern. The compiler overwrites client RPS from those controls. The evaluator fixes the scenario at 150 RPS. | The displayed experiment can disagree with the stated task. Explicitly initialize challenge workload and distinguish exploration from evaluation traffic. |
| P1 | Inspector supports `onConfigChange`, but `SimulationDetails` does not supply it. Instance changes are runtime commands, accepted only while running/paused and replayed into the check submission from command history. | Capacity editing is absent from this integration and instance repairs can disappear on reset. Persist allowed edits into the candidate document; runtime reflects that document. |
| P1 | Brief, rules, hints, check action, saved simulation runs, and optional legacy analysis share the generic inspector. | The learner has no persistent task hierarchy or clear progress. Give challenges a dedicated brief/results panel and focused component controls. |
| P1 | Result UI prints `Solution <status>`, generic advice, and raw JSON evidence. Hints are exposed together in one disclosure. | The learner cannot easily tell which goal failed or what changed. Render goal comparisons, targeted evidence, progressive hints, and an explanatory debrief. |
| P1 | Scenario definition/result validation says `event-v1`, while `runScenario` calls the current runtime whose engine version is `event-v2`. | Version metadata does not identify the executing engine truthfully. Centralize versions, revise authored content, and explicitly handle incompatible historical results. |
| P2 | Entry link appears only when there is no snapshot and the run is not running; no dedicated resume/restart/leave lifecycle exists. | Discoverability depends on runtime state and a temporary demo replaces the user's workflow. Provide a persistent navigation entry and explicit challenge lifecycle. |
| P2 | Evaluation has a 30-second timeout, no progress protocol, and advises reducing design size even though topology is fixed. Worker construction/posting is not guarded as a full lifecycle. | Slow or failed execution feels like a learner error. Provide bounded progress, cancel/retry, and an incomplete outcome with accurate recovery text. |

Retain the evaluator's useful foundations: fixed workloads, multiple deterministic seeds, warmup and measurement cohorts, required dependency completion, sample minimums, resource budgets, and separate invalid/incomplete outcomes. Do not replace those with a grade derived from live rolling counters.

## Proposed user journey

1. **Discover.** Keep “Try a repair challenge” as a secondary invitation near simulation, plus a stable Practice entry available after a run starts. The invitation opens a challenge preview with title, one-sentence situation, what the learner will change, and expected difficulty. No destructive canvas replacement.
2. **Enter.** “Start challenge” opens a dedicated route such as `/challenges/repair-database-bottleneck`. Preserve the source route and unsaved source draft under its own identity before navigation. If preservation fails, show an in-app recovery choice and keep the source available. Anonymous entry works without signup.
3. **Understand.** Show “Clear the database queue” with a short scenario, required workload, goals, budget, and editable settings. Explain concurrency units in plain language: simultaneous work slots, summed across instances, rather than monetary cost. Initial budget is 18/24 for the existing API/database configuration.
4. **Observe.** Frame the three-node system on entry. “Run simulation” starts at the authored 150 requests/sec. Show traffic, queued work, failures, and a clickable affected path. Do not reveal the solution or declare a bottleneck without observed evidence. Respect reduced motion.
5. **Repair.** Select a component to see its allowed capacity, instance, and queue controls. Changes persist into the challenge draft, support undo/redo, and update the budget immediately. Fixed assumptions are visibly locked with a brief reason. Retain inspection, panning, zooming, and layout editing.
6. **Check.** “Check repair” snapshots the current candidate and runs a separate deterministic evaluation. Show progress by seed/stage and allow cancellation. The explanation says the check uses the required traffic even if exploration used another load. Draft changes invalidate an old result; they never silently change an in-flight submission.
7. **Learn.** Show each target and actual result: successful completion, p95, p99, dependency completion, and budget. Show the worst required-seed observation and allow per-seed details. Link relevant evidence back to the canvas. Distinguish not-yet-met, invalid edit, and incomplete evaluation.
8. **Finish or continue.** A passing result explains the mechanism and tradeoff, shows changes from baseline, and offers “Keep experimenting”, “Start over”, and “Back to my design”. Save challenge progress locally and offer an explicit copy/export action. No automatic insertion into the source architecture.

Progressive hints move from observing symptoms to calculating capacity to explaining a repair approach. Reveal one hint at a time; record usage for the local session, without a hidden scoring penalty. Restart asks for confirmation in the shared dialog because it resets a draft. Leaving a safely saved draft needs no unnecessary modal.

## Visual and interaction specification

- Desktop: restrained top bar with challenge title, save state, run/pause, reset simulation, and Check repair. Keep a compact goals/budget strip visible; right panel switches between brief, selected component, and results. Avoid stacking every function in the ordinary simulator inspector.
- Distinguish **Reset simulation** (keep repair settings) from **Start over** (restore the original challenge). Explain this in labels and confirmation copy.
- Narrow viewports: canvas plus a collapsible panel with a persistent task/check affordance; keep goals and status reachable without covering the entire diagram. Test at 360 px and at 200% zoom.
- Use the existing shared SelectDropdown and numeric input conventions. Support temporary blank input, validation on commit, keyboard stepping, and error recovery without resetting a partially typed value.
- Display queued work, errors, and causal details with text/icons in addition to color. Amber indicates pressure; red indicates observed failures. Idle remains neutral when expected.
- Results use a readable target/actual/status table. Raw diagnostic JSON may be downloadable under advanced details, never the primary learner-facing result.
- Native HTML `<dialog>` styled with the product's modal classes is suitable. Manage initial focus, Escape, focus restoration, accessible names, background inertness, and keyboard shortcuts. Default focus should favor the safe action for destructive confirmations.
- Use actual state for labels: “Saving on this device”, “Saved on this device”, “Changes not saved”, “Checking 2 of 3 runs”, “Check incomplete”, and “Changed since last check”. Do not imply cloud sync or authoritative rankings.

## Architecture and contracts

### Separate challenge workspace

Introduce `src/challenges/` with a route, challenge session/controller, repository adapter, evaluation client, and presentational components. Reuse the canvas renderer, model compiler, overlays, dialogs, and shared controls. Avoid growing the already large `SystemDesignPlayground.tsx` with a second product lifecycle.

Prefer a focused shared canvas/editor boundary over importing the whole playground with its problem assessment, collaboration, and autosave side effects. The first implementation slice must prove that the extracted boundary preserves the ordinary editor's behavior.

Store explicit `scenarioId`, `scenarioRevision`, engine/profile versions, attempt ID, source navigation context, immutable authored baseline, editable candidate, candidate revision/fingerprint, hint progress, and saved/evaluated status. Use `challenge:<scenarioId>:<attemptId>` scopes for runtime/history. Do not infer mode from canvas IDs or component names.

Use separate state for live preview and evaluation. Challenge edits are document edits; live replica commands must not be the sole source of a repair. Every allowed input routes through one command/validation layer so keyboard shortcuts, node properties, paste/import, undo, and inspector controls cannot bypass constraints. Final submission validation remains authoritative for local checks.

### Session lifecycle

Lifecycle: loading → ready → exploring → checking → passed / goals-unmet / invalid / incomplete. Saving and runtime playback are independent states. Any semantic repair edit makes the previous result stale; presentation-only moves do not. Scenario changes, restart, logout/account switch, navigation, and unmount cancel the evaluator and discard late messages.

A submission contains evaluation ID, attempt ID, scenario/version tuple, candidate fingerprint, immutable topology, and evaluation configuration digest. Every progress/result/error response echoes this identity. Accept results only for the current submitted revision. Terminate superseded workers and clear their timers on every exit path; catch worker construction and posting failures as well as runtime errors.

Allow cancel or edit while checking: edits cancel the check, visibly return to the draft, and require a new explicit check. This avoids freezing the entire editor while preventing ambiguous result attribution. Worker event slices must allow progress/cancellation and preserve deterministic outcomes independent of slice size.

### Evaluation and content

Centralize the active engine/profile version contract instead of maintaining a separate `event-v1` string in scenario code. Re-certify this scenario under the actual engine and bump its authored revision. Old results remain labeled historical; unsupported versions are not silently re-evaluated under new semantics.

Keep the scenario's 150 RPS, 10-second warmup, 60-second measurement, completion deadline, three seeds, required database completion, and 24-unit budget explicit. Verify that baseline fails and at least two genuinely different allowed repairs pass. Distinguish simulator resource limits from architectural failure. Preserve sample sufficiency and no-data handling.

Use an immutable scenario registry with a schema, compatible engine versions, difficulty/learning objectives, allowed edits, hints, goals, and debrief. The UI and worker select the same registry entry by identity; eliminate hardcoded imports of the one sample throughout UI code. Unsupported IDs/revisions get a recovery screen.

The current evaluator supports fixed topology. Keep that capability explicit. Later routing, queue/consumer, cache, and failure-recovery exercises require suitable validators and operation metrics; do not advertise arbitrary repair puzzles until those validators exist. Reuse the simulation diagnostic contract and evidence in future lessons without making a diagnostic alone count as a successful repair.

### Persistence and future API integration

First release: anonymous and signed-in users can complete the curated challenge with isolated IndexedDB drafts and local results. Namespace account data, handle logout/account changes, and require an explicit choice before transferring anonymous drafts. Handle quota/storage-denied cases with visible unsaved state and a versioned export. Retain unsaved source drafts before route transitions and resume the correct source canvas on return.

Record result identity and evaluated candidate together so refresh/resume cannot attach a pass to another graph. Define bounded retention (proposed: latest draft plus last 20 evaluations per attempt) and provide delete/export controls. Keep completion/result writes atomic; use revision checks for multiple-tab conflicts.

Cross-device progress, daily schedules, leaderboards, and certificates are a later release. Before they ship, add owner-scoped attempt APIs, schema/size limits, idempotent writes, and server-side deterministic evaluation against a server-owned scenario. Never trust a client-submitted pass for ranked or rewarded progress. Existing simulation-history endpoints are not automatically a challenge-attempt contract.

## Delivery sequence

| Milestone | Deliverable | Exit criterion |
| --- | --- | --- |
| 0. Baseline and design | Computer Use walkthrough; source autosave probe on disposable designs; compact mockups of brief, selected-node controls, checking, result, and mobile states. | Actual problems and unknowns recorded; source design behavior and candidate/check mismatch reproduced or corrected in this plan. |
| 1. Safe workspace | Dedicated route/session and challenge storage; source handoff/return; remove destructive demo insertion; restart dialog. | Enter, exit, refresh, navigate back, and storage failure cannot replace the source canvas or save into its identity. |
| 2. Truthful candidate and evaluation | Persistent permitted settings, authored workload initialization, constraints, version alignment, worker identities/progress/cancel, stale-result handling. | Baseline and known repairs evaluate consistently; every visible result belongs to the exact current candidate. |
| 3. Complete learning experience | Brief/goals, budget, canvas evidence, shared controls, progressive hints, results/debrief, resume/restart/export. | A new learner can observe, edit, check, understand, and exit without raw JSON or implementation knowledge. |
| 4. Release qualification | Browser matrix, meaningful core/session regressions, accessibility/performance work, content certification, observability, review. | All release gates below pass; unresolved failures block enabling the feature. |

Ship behind a feature flag initially. If the safe workspace is not ready, hide the existing replacement action rather than treating its confirmation dialog as sufficient data protection. The flag must disable entry without discarding saved attempts, and rollback must preserve compatible drafts.

## Verification and release gates

The user wants production readiness; verify behavior through the real UI and use deterministic tests for the underlying invariants. Keep fixtures and scenario definitions immutable in tests: clone the candidate separately. The existing scenario tests mutate the supplied definition along with the candidate in some examples, so strengthen that distinction.

| Area | Required evidence |
| --- | --- |
| Source safety | Disposable anonymous draft, signed-in free design, problem attempt, multiple canvases, collaborative/read-only source, pending/failed autosave. Enter/check/restart/exit/refresh challenge; compare source documents and outbound save targets before/after. No challenge writes target a source design/attempt/collaboration room. |
| Candidate controls | Capacity/instances/queue edits persist across runtime reset and refresh; undo/redo work; budget updates immediately; invalid numeric drafts recover; prohibited edits are prevented or explained without losing the challenge context. |
| Evaluation correctness | Immutable baseline fails; independent bounded repairs pass; forbidden changes, missing dependency, excess budget, low samples, unsupported version, and event exhaustion produce the correct distinct outcomes. All required seeds must meet goals. |
| Stale and concurrent work | Edit during check, edit after pass, restart, navigate, change account, open another attempt/tab, cancel, and worker crash. Late callbacks cannot overwrite newer state; preview commands cannot leak between attempts. |
| UX | Real Computer Use run from entry through failure, hint, repair, check, debrief, and return. Record screenshots and actual results for desktop and narrow layout; no state injection in place of the baseline journey. |
| Accessibility | Keyboard-only completion, dialog focus/Escape/return, screen-reader labels/status, visible focus, 200% zoom, reduced motion, contrast and non-color indicators. Target WCAG 2.2 AA. |
| Browser and failures | Current supported Chromium, Firefox, and WebKit where available; disabled storage, offline after load, API outage, unavailable worker, slow device, reload and browser back. Mark unavailable checks explicitly. |
| Responsiveness | Establish a reproducible reference device/graph and record measurements. Targets: input response p95 under 100 ms, cancellation acknowledged within 500 ms, no repeated >50 ms main-thread tasks caused by evaluator work. Benchmark check duration; keep a bounded timeout and report incomplete without blaming the learner. |
| Trust and operations | Local results labeled accurately; no public rank/reward without server verification. Telemetry contains scenario/version/status/duration/error code, not canvas payloads or personal data. Flag rollout can be disabled while preserving drafts. |

Release requires an independent code review, required repository checks, and browser evidence. Record exact commands, supported versions, screenshots, and remaining limitations in a new repair-challenge verification report. No production-readiness claim follows from a styled modal or a passing engine suite alone.

## Implementation map

- `src/pages/SystemDesignPlayground.tsx`: replace destructive `loadRepairDemo` with safe challenge navigation; preserve source draft lifecycle.
- `src/App.tsx`: dedicated challenge route and recovery states.
- `src/challenges/` (new): session, storage, evaluation client, registry adapter, workspace/brief/results/controls.
- `src/simulation/SimulationHost.tsx`: remove inferred challenge mode and hardcoded evaluator UI; retain reusable simulation/history surfaces.
- `src/simulation/session.ts`, `store.ts`, `protocol.ts`: explicit scope initialization/disposal and isolation between preview sessions.
- `src/simulation/evaluation.worker.ts`: identity/progress/result/cancel protocol and registry-based scenario selection.
- `packages/simulation-core/src/scenario.ts`, `scenarios.ts`, `runtime.ts`: shared version contracts, immutable definitions, evaluator invariants, extensible authored content.
- Shared modal/select/input components and simulation overlays: accessible product-consistent interactions, actionable evidence, no native browser prompts.
- API repository: no new endpoint is required for isolated local practice. Coordinate engine/version compatibility where shared contracts change; implement cloud challenge endpoints only with their own explicit persistence and verification milestone.

## Completion checklist

- [ ] Repair-specific browser baseline and source-save investigation recorded.
- [ ] Isolated workspace, recoverable drafts, safe source return complete.
- [ ] Persistent permitted edits, clear budget, correct workload complete.
- [ ] Versioned deterministic evaluator and stale-result protection complete.
- [ ] Finished brief, canvas explanations, hints, results, and debrief complete.
- [ ] Accessibility, browser/failure matrix, performance targets, and content certification complete.
- [ ] Independent review and staged release gates passed, evidence attached.

The product owns explaining the exercise and its observed outcomes. The learner should spend effort diagnosing the system, not figuring out where the task lives, whether a change was saved, or which design a passing result describes.

## Detailed implementation specification

The following sections turn the milestones into buildable tasks. If browser evidence contradicts a source finding, record the correction before implementing that task. Preserve the safety and result-attribution invariants regardless of UI adjustments.

### 1. Product boundaries and decisions

| Decision | First production release | Later extension |
| --- | --- | --- |
| Challenge catalogue | One fully authored and certified database-capacity challenge, resolved through a registry | Additional queue, caching, routing and resilience exercises with compatible validators |
| Starting behavior | Open a preview; Start creates a separate attempt; Resume opens the existing attempt | Daily selection and discovery catalogue |
| Simulation | Local deterministic preview with authored defaults; explicit Run action | Additional operation classes after engine support is validated |
| Checking | Local deterministic check with clear local-result wording | Server verification for rewards, ranks, public progress or certificates |
| Persistence | Separate local drafts/results; explicit export/import; anonymous access | Authenticated cross-device sync and conflict resolution |
| Source architecture | Retain original identity and content; safe return to its canvas | Explicit “Save a copy as a design” through the existing create flow |
| Collaboration | Source may be collaborative; challenge attempt is private/local | Deliberately designed shared challenge sessions |
| Monetization/competition | No score, reward, timer pressure, or streak inferred from this exercise | Separate product specification and trustworthy server validation |

Do not introduce estimated completion times or difficulty labels without a learning review. The first preview can simply say “Database capacity · guided repair”. No AI service is required to start, simulate, diagnose known conditions, provide authored hints, or evaluate this challenge.

### 2. Screen and state inventory

| Screen/state | Required content | Main action | Recovery/secondary actions |
| --- | --- | --- | --- |
| Entry preview | Challenge name; two-line situation; what may be changed; targets; notice that a separate practice space opens | Start challenge / Resume challenge | Close; start a new attempt when a draft exists |
| Loading | Name and calm loading indicator; avoid rendering a blank editable canvas | None until loaded | Retry when loading fails |
| Ready | Brief, three-node canvas, targets, 18/24 used budget, saved state, 150 RPS | Run simulation | Inspect node; hints; Check repair is still available without requiring a preview run |
| Exploring | Live request rate, simulation clock, affected nodes/paths, budget, selected controls | Pause / Check repair | Reset simulation; restore required traffic |
| Invalid field draft | Inline explanation next to the field; preserve typed value | Correct value | Revert field; Check waits until field drafts are committed or corrected |
| Constraint violation | Specific affected setting/path, reason, allowed action | Fix the issue | Revert last edit; keep current draft for inspection |
| Checking | Stage and seed count; candidate identified; Cancel; progress announcement | Cancel check | Editing cancels check with a clear status message |
| Goals unmet | Required vs observed values, goal statuses, actionable canvas links | Continue repairing | Next hint; inspect evidence; compare baseline |
| Passed | All targets met across required runs; budget; change summary; explanation of the mechanism | Keep experimenting | Return to design; start over; export attempt |
| Changed since check | Previous check identified as historical; current changes visible | Check repair again | View previous result |
| Check incomplete | Explain simulator/worker limit separately from architectural failure | Retry check | Export diagnostics without private source data |
| Save failure | “Changes not saved on this device” with reason where known | Retry save | Export; keep working in memory |
| Missing/retired scenario | Explain whether the ID or stored revision is unavailable | Open supported challenge | Export historical attempt; return to source |

Example preview copy: “An API is receiving 150 requests per second. Requests are queuing before their database reads finish. Adjust capacity within the budget and check whether the system meets its targets.” This names the observed symptom without telling the learner the exact solution.

For goals, use the evaluator's precise comparisons: **at least 99%** successful, **p95 ≤ 200 ms**, **p99 ≤ 350 ms**, **budget ≤ 24**. Update the current “under” wording if thresholds are inclusive. Explain percentile terms through help text: “95% of successful measured requests finish within this time.” Pair latency with completion fraction so dropping requests cannot appear successful.

### 3. Layout and component responsibilities

Proposed components belong under `src/challenges/components/`:

| Component | Responsibility | Must not own |
| --- | --- | --- |
| `ChallengeEntryDialog` | Preview/resume/new-attempt choices using shared modal primitives | Source autosave implementation or evaluator state |
| `ChallengeWorkspace` | Arrange canvas, toolbar and panel; responsive transitions | Hidden independent copies of candidate data |
| `ChallengeToolbar` | Run/pause, reset preview, Check, return, save status | Scoring or topology mutation |
| `ChallengeGoals` | Required targets, budget, source of displayed observations | Mixing live preview measurements with evaluation results |
| `ChallengeBrief` | Situation, rules, allowed changes and explicit assumptions | Hardcoded database scenario import |
| `ChallengeNodeControls` | Render allowed fields from the scenario schema, lock explanations | Writing runtime-only commands that bypass candidate persistence |
| `ChallengeHints` | Progressive hint reveal, links to evidence | Auto-revealing the answer or secretly lowering scores |
| `ChallengeResults` | Goal table, per-seed detail, change summary and debrief | Treating client results as server-certified achievements |
| `ChallengeRecovery` | Save/version/worker problems and user actions | Silent resets or deletion of incompatible drafts |

Desktop target layout: toolbar above the diagram; goals as a compact task strip; 320–380 px inspector panel where space permits. Use existing spacing/type tokens rather than new ad hoc values. Keep the canvas area usable at smaller desktop widths by collapsing the panel, not by shrinking node labels into unreadable text.

On narrow screens, switch the panel into an accessible drawer or full-height sheet with Brief / Component / Results tabs. Opening it moves focus; closing it returns focus to its trigger. Retain a visible Run/Check affordance outside the sheet. Layout changes must not recreate the attempt or restart evaluation.

Visual polish deliverables before integration: actual rendered previews for light/dark, ready/running/checking/passed/failed/save-error, narrow layout, and a long validation message. Review hierarchy and spacing in these previews; screenshots alone do not establish interaction correctness.

### 4. Source-workspace handoff: explicit save algorithm

The existing `useDebouncedSave` schedules writes and disposes its scheduler on unmount; it exposes no explicit flush operation. Navigating away cannot be assumed to finish a pending save. Implement a shared save/checkpoint boundary rather than using a delay before routing.

1. Capture source identity: route, authenticated owner or anonymous installation identity, diagram/attempt ID, active canvas ID, semantic document revision, viewport, and selected panel. Source recovery must include the existing document/context fields needed by its restoration path, not merely node positions.
2. While the source remains mounted, request its save coordinator to flush the captured revision where supported. Snapshot writes must target the captured owner/document/canvas identity, not whichever identity is current when an asynchronous callback returns.
3. If remote save is pending or unavailable, durably checkpoint the source draft through the source workspace's recovery adapter. A successfully committed local checkpoint permits opening a challenge with an honest “Source draft saved on this device” notice.
4. If neither save nor checkpoint succeeds, keep the source mounted and show Retry / Export source draft / Stay here. Do not navigate merely because a timeout elapsed.
5. Create or resume the separate challenge attempt. Only after its identity is established and source preservation succeeds, navigate to the challenge route. Dispose the source runtime and scope-bound listeners using the existing lifecycle.
6. On return, resolve the original route and active canvas. Compare saved revisions and local checkpoints before loading older server content. Offer an explicit recovery/conflict choice if they diverge; never silently replace newer remote work with a local checkpoint.
7. When returning to a collaborative source, reconnect through its ordinary collaboration path. Do not publish the checkpoint wholesale into a live room. If another collaborator changed it, surface recovery options for the source rather than merging challenge state.

Use same-origin validated source routes, not arbitrary redirect URLs supplied by imports/query parameters. A direct challenge URL has no source: its return action goes to Practice. Browser Back must follow the same safe save boundary for challenge drafts. Hard reload/tab closure cannot be guaranteed by a custom dialog: persist drafts promptly and provide recovery. Do not add native `beforeunload` prompts as a replacement for durable state.

### 5. Data model and ownership

Proposed TypeScript contracts (fill field validation and concrete imported types during implementation):

```ts
type ScenarioRef = {
  id: string;
  revision: string;
  engineVersion: string;
  profileVersion: string;
  definitionDigest: string;
};

type OwnerScope =
  | { kind: 'anonymous'; installationId: string }
  | { kind: 'account'; accountId: string };

type ChallengeAttempt = {
  schemaVersion: 1;
  attemptId: string;
  owner: OwnerScope;
  scenario: ScenarioRef;
  createdAt: string;
  updatedAt: string;
  writeRevision: number;
  candidateRevision: number;
  candidate: ChallengeDocument;
  candidateFingerprint: string;
  presentation: ChallengePresentation;
  revealedHintIds: string[];
  latestEvaluationId: string | null;
  sourceContextId: string | null;
};

type EvaluationIdentity = {
  evaluationId: string;
  attemptId: string;
  candidateRevision: number;
  candidateFingerprint: string;
  scenario: ScenarioRef;
  evaluationConfigDigest: string;
};

type EvaluationRecord = {
  schemaVersion: 1;
  identity: EvaluationIdentity;
  candidateSnapshot: ChallengeDocument;
  evaluatedAt: string;
  verification: 'local';
  result: ScenarioResult;
};
```

`ChallengeDocument` represents the semantic candidate that compiles into an executable topology; `ChallengePresentation` stores layout/viewport separately. Define one canonical conversion between editor nodes and this document. Do not persist React components, icons/functions, transient faults, worker handles, timers, raw session cookies, or authentication tokens.

`definitionDigest` covers authored topology, constraints, goals, seeds and evaluation durations. The candidate fingerprint covers all behavior-affecting edits; labels/layout do not determine a grade. Evaluation hashes include the immutable scenario/version tuple. Use a stable canonical representation and collision-resistant digest for stored identity. These identities detect stale state; they do not make local results tamper-proof.

Store a scenario snapshot or retained registry revision sufficient for historical inspection. Do not treat a user-imported definition as trusted catalogue content. Imports reference a known scenario revision; unknown revisions remain exportable/read-only until explicitly supported.

Proposed IndexedDB database: `diagramwise-challenges`, schema 1, with `attempts`, `evaluations`, and `sourceContexts` stores. Use owner/attempt and owner/scenario indexes. Keep full source checkpoints in the source recovery adapter, with opaque references here, so challenge export cannot accidentally include the user's original design.

Saving must resolve only when the transaction commits. Update evaluation record and attempt's latest-result pointer in one transaction. Use compare-and-swap on `writeRevision`; if two tabs diverge, retain both drafts and offer to resume one or duplicate the attempt. BroadcastChannel can announce conflicts but is not a replacement for transaction checks.

Proposed bounds: at most 50 retained attempts per owner, 20 evaluation records per attempt, and a 1 MiB imported/exported attempt bundle. Validate size before parsing and validate all graph/config bounds after parsing. If full, offer export/delete management; never evict a current unsaved draft. Document that “on this device” storage can still be removed by the browser/user. Version migrations must be transactional and preserve export access on failure.

### 6. Authoring contract and reference scenario

Expand the registry entry with stable hint IDs, editable field descriptors, field ranges/steps, locked-field explanations, supported validator kind, UI learning objectives, and a debrief template. Compile the learner-facing rules and validator allowlist from the same definition. Required node/path semantics belong to the definition, not UI heuristics.

For the first exercise:

| Parameter | Authored contract | Learner control |
| --- | --- | --- |
| Required demand | 150 RPS, steady; evaluator supplies it | Preview demand can change, with “Exploration traffic” and Restore required traffic |
| API | 16 slots/instance, one instance, 5 ms mean service | Capacity, instances, queue limit within validator bounds |
| Database | 2 slots/instance, one instance, 40 ms mean service | Capacity, instances, queue limit within validator bounds |
| Route | Clients → API → database; every successful request completes API and database work | Layout only; topology/behavior fixed in this exercise |
| Latency/failure assumptions | Existing authored service variation, errors, retries and timeouts | Read-only explanations |
| Resource budget | Sum of slots × instances for executable service/database components, maximum 24 | Live used/remaining indicator; over-budget draft can be inspected but cannot pass |
| Check | Seeds 1, 42, 1337; warmup 10s; measurement 60s; drain/deadline 5s | Fixed for checking, independent of playback speed |
| Completion | At least 99%; minimum 1,000 successful measured requests per required seed | Target shown explicitly |
| Latency | p95 ≤ 200 ms and p99 ≤ 350 ms on successful measured requests | Target shown explicitly |

For author review, the nominal database capacity starts around 2 / 0.04 = 50 requests/sec while demand is 150. Eight database slots give nominal service capacity around 200/sec and consume the full 24-unit total with the API. Four two-slot instances are another candidate. These calculations explain the intended lesson; only actual evaluator runs certify that a candidate passes. Keep exact solutions out of initial hints.

Content certification must separately freeze the baseline definition and clone candidate graphs. Run baseline, two valid solutions, budget violation, larger queue only, removed database work, and changed service time. Certify displayed copy against actual threshold inclusivity and what latency/cohort metrics measure. Store the certification's scenario/engine/version tuple.

### 7. Commands and state transitions

Every candidate-changing action passes through a single challenge controller:

```text
commitConfigEdit(nodeId, field, value)
  → validate field against scenario and engine bounds
  → create immutable candidate revision and undo entry
  → cancel in-flight check; invalidate current result
  → compile and update budget/diagnostics
  → persist candidate asynchronously with visible save state
  → discard preview metrics and require a fresh run
```

Choose explicit restart after semantic edits for this first release. Do not retain old node metrics next to new capacity values. Temporary preview load/fault experiments never mutate the checked candidate; checking excludes them and tells the learner the required conditions. Changing preview speed does not affect grading.

| Event | Candidate | Preview | Evaluation/result |
| --- | --- | --- | --- |
| Run | Unchanged | Start/restart under current exploration workload | Unchanged |
| Pause/resume | Unchanged | Pause/resume | Unchanged |
| Reset simulation | Unchanged | Clear metrics/faults and stop; keep candidate | Valid result remains applicable |
| Commit allowed repair | New semantic revision | Stop and mark readings stale | Cancel check; previous result becomes historical |
| Move node/pan | Presentation only | Continue | Preserve result applicability |
| Change exploration RPS | Unchanged | Apply preview load | No grade change; show checking still uses 150 RPS |
| Check repair | Immutable snapshot of current committed candidate | Pause live run to reduce resource contention | Start evaluation with a new identity |
| Cancel check | Unchanged | Remain paused; explicit Resume | No pass/fail; cancelled state and previous history preserved |
| Start over | New candidate revision from frozen baseline | Stop/reset | Cancel and archive prior evidence; reset hints after confirmation |
| Return to source | Save challenge revision | Dispose | Cancel active work and retain committed history |
| Logout/account switch | Preserve outgoing owner's draft if possible | Dispose | Cancel and clear in-memory private state before loading another owner |

Undo/redo uses the same semantic invalidation path as any repair edit. Even if an undo restores a previous fingerprint, require a new check initially; historical evidence can be viewed but must not silently become the current pass. Ensure unrelated graph ID collisions never enter challenge mode.

### 8. Worker protocol and scheduling

Replace the current untyped `{ topology }` / `{ result }` exchange with discriminated messages:

```ts
type EvaluationRequest =
  | { type: 'evaluate'; identity: EvaluationIdentity; candidate: ChallengeDocument }
  | { type: 'cancel'; evaluationId: string };

type EvaluationResponse =
  | { type: 'started'; identity: EvaluationIdentity }
  | { type: 'progress'; identity: EvaluationIdentity;
      seedIndex: number; seedCount: number;
      stage: 'warmup' | 'measurement' | 'drain'; simulatedMs: number }
  | { type: 'completed'; identity: EvaluationIdentity; result: ScenarioResult }
  | { type: 'cancelled'; identity: EvaluationIdentity }
  | { type: 'error'; identity: EvaluationIdentity;
      code: 'unsupported-version' | 'invalid-submission' | 'processing-limit' | 'worker-error';
      message: string };
```

The worker resolves the scenario from its trusted registry and validates versions/digests before constructing the engine. Do not accept goals, seeds or constraints supplied as unchecked client-message overrides. Runtime-validate messages, not just TypeScript annotations.

Extract the deterministic loop into a stepper that both the synchronous Node runner and asynchronous worker can drive. This avoids duplicating evaluation logic. Yield between bounded event slices so messages and progress can be handled; throttle progress to roughly 5 updates/sec and announce only meaningful stage transitions to assistive technology. A user cancellation must terminate the worker promptly even if cooperative cancellation cannot run.

Use an absolute processing/event ceiling and a wall-time watchdog as separate safeguards. Preserve existing event bounds initially, benchmark the fixed exercise, and document any adjustment. Wall-time timeout produces incomplete, not architectural failure. Do not advise changing forbidden topology to work around a slow device. Provide Retry, with progressive diagnostics if the same bounded check repeatedly fails.

A controller generation token must protect all callbacks, including worker error, delayed timeout, and persistence completion. Clear old timers before a new worker starts. Ignore unexpected/duplicate messages, and never attach a result whose scenario tuple or candidate identity differs. On completion, validate the result, save it atomically, and show pass only when all required seeds completed and met the authored goals.

### 9. Results and explanation rules

The primary result table has columns Goal / Required / Observed / Status. Show unrounded values for comparisons internally, format them clearly for display, and avoid rounding a failure into a number that appears to pass. Provide additional precision at a boundary.

- Completion: lowest measured completion fraction across required seeds, alongside unsuccessful/pending counts in details.
- p95/p99: worst value across required seeds; no arithmetic average of percentiles.
- Budget: candidate resource units; distinguish validation failure from performance failure.
- Required work: show missing dependency completion explicitly where present. A caller acknowledgement alone cannot prove persistence.
- Sample adequacy: insufficient or empty latency samples display “Not enough completed requests”, not zero latency.
- Incomplete: identify which runs/stages completed and omit any overall pass/fail claim.

Evidence links select actual affected nodes/paths. A goal miss alone is not proof of its root cause; if the evaluator lacks causal evidence, say which target missed and offer an observation/hint instead of inventing a reason. Baseline comparison must use the same scenario version and certified evaluation conditions. Live preview readings are clearly labelled and never placed in the verified-result column.

The debrief describes allowed changes from baseline and the tradeoff: more simultaneous database work reduces queueing but consumes capacity budget; longer queues store more waiting requests. Use authored explanations parameterized by observed edits, without claiming a universally optimal real-world architecture.

### 10. Concrete work packages and dependencies

| ID | Depends on | Implementation task | Reviewable output and acceptance |
| --- | --- | --- | --- |
| RC-01 | None | Record baseline through Computer Use in a disposable canvas; inspect autosave requests and result staleness | Repair-specific evidence report; each finding confirmed, corrected or marked unverified |
| RC-02 | RC-01 | Define scenario/attempt/worker schemas and shared version source | Contract module and migration policy; unsupported versions produce explicit recovery |
| RC-03 | RC-01 | Add source save/checkpoint handoff API | Pending-save, failed-save, anonymous and collaborative handoff cases preserve original document identity/content |
| RC-04 | RC-02 | Implement isolated challenge repository and revision checks | Atomic save/result records, bounded retention, import/export and two-tab conflict behavior |
| RC-05 | RC-02, RC-03, RC-04 | Add challenge route, explicit session and narrow reusable canvas boundary | Entry/resume/return/refresh work; no source design save targets are used by the challenge |
| RC-06 | RC-02, RC-05 | Wire allowed settings and candidate history | Repairs persist; budget/constraints consistent across input paths; reset preview retains repairs |
| RC-07 | RC-02 | Refactor deterministic evaluation into shared stepper and worker client | Fixed results across slice sizes; progress/cancel; error/timer/version handling |
| RC-08 | RC-06, RC-07 | Bind immutable submissions and enforce stale-result rules | Edits, navigation, new attempts and late messages cannot misattribute a pass |
| RC-09 | RC-05, RC-06, RC-08 | Build brief, goals, hints, result table and debrief with shared controls | Complete learner journey at desktop/narrow widths with keyboard support |
| RC-10 | RC-07, RC-09 | Certify content and complete browser/performance/failure checks | Independent evidence for initial failure, valid repairs, error states and source safety |
| RC-11 | RC-10 | Add minimal telemetry, rollout flag and rollback behavior; independent review | Release checklist complete; feature can be disabled without deleting attempts |

Keep each work package reviewable; do not combine an editor-wide refactor with all challenge behavior in one change. Shared editor extraction should be limited to dependencies needed by the challenge. If that boundary cannot be isolated safely, pause the UI integration and resolve that design issue before adding a parallel copy of the entire playground.

### 11. Verification cases with explicit expectations

| ID | Steps | Expected result |
| --- | --- | --- |
| V-01 | Edit a saved source design; immediately enter challenge before debounce; change challenge; return and reload | Original edits retained; challenge never appears in source saves |
| V-02 | Repeat with a document-management attempt and a non-primary canvas | Correct attempt/canvas restored; no new assessment history or unrelated problem progress created |
| V-03 | Simulate source-save and local-checkpoint failure before entry | Remain in source with Retry/Export/Stay options; no silent navigation |
| V-04 | Direct-link to challenge anonymously; start, repair, refresh | Same local attempt restored with correct authored workload and candidate settings |
| V-05 | Increase database capacity, reset simulation, check, reload | Capacity remains changed; result refers to that saved candidate |
| V-06 | Pass a check; reduce capacity; then inspect result | Current status is Changed since last check; old pass only in history |
| V-07 | Edit, restart or navigate while a check runs; deliver its old response | Response ignored; no stale pass, error banner or stuck Checking state |
| V-08 | Create ordinary diagram with `client`, `api`, `database` IDs | It remains an ordinary design; no inferred challenge mode |
| V-09 | Change service time/model or bypass database through any edit/import route | Candidate rejected or constrained with specific feedback; no success through missing required work |
| V-10 | Run fixed baseline and two independently cloned allowed repairs across all seeds | Baseline fails; certified repairs pass; authored definition remains byte-for-byte unchanged |
| V-11 | Change preview RPS/speed/faults, then Check | Evaluator uses required conditions; displayed result says so; no preview state leakage |
| V-12 | Force event limit, timeout, malformed result or worker-construction failure | Incomplete/error with recovery; never Solution failed for infrastructure failure, never stuck busy |
| V-13 | Open same attempt in two tabs and edit both | Detect revision conflict; preserve drafts and offer recovery; no last-write silent loss |
| V-14 | Logout and log in as another account | Previous account's private draft/result is not shown or written under the new owner |
| V-15 | Use keyboard and screen reader through entry, edit, hint, check and restart | Logical focus order, visible focus, announced stages, safe modal focus and restoration |
| V-16 | Disable storage and disconnect network after app loads | Local practice continues in memory; visible unsaved status and export; no fake Saved state |
| V-17 | Import old/oversized/malformed bundle | Size/schema/version errors are actionable; current attempt remains intact |
| V-18 | Return to collaborative source after another member edits it | Reconnect ordinarily; no stale checkpoint replacement or challenge publication |

Use targeted unit tests for immutable scenario rules, worker identity/state transitions, canonicalization and storage conflict handling; integration tests for editor/save boundaries; browser tests for the actual user journey. Re-run ordinary canvas save, undo/redo and simulator workflows after shared extraction. Do not replace the browser journey with injected state.

During implementation, run the repository's current TypeScript/build checks and the focused scenario, simulation/session, challenge and changed-UI suites. Verify exact commands in the checked-out scripts before recording them. API tests are required when API contracts change; this local challenge plan alone does not require backend behavior changes. Record pre-existing check failures separately with evidence.

### 12. Release evidence and operating plan

Create `docs/research/repair-challenge-verification-<date>.md` with frontend/API commits, browser/OS/device, scenario revision, engine/profile versions, screenshots, test results, source-safety request traces with sensitive fields removed, performance measurements, and open limitations. Do not reuse document-management screenshots as repair-challenge proof.

Track only capability-level events: entry opened, attempt started/resumed, hint revealed (ID only), check started/completed/cancelled, save failed, and return completed. Include scenario/revision, result category and duration buckets. Exclude topology payloads, source route identifiers, node labels typed by users, tokens, emails and full candidate exports. Follow existing analytics consent rules; no new mandatory tracking for local practice.

Release in steps: flag off during construction → internal disposable-account verification → limited opt-in availability → general availability after observed errors and release gates are reviewed. Define alert thresholds from measured traffic; treat any confirmed source-document overwrite or misattributed pass as an immediate disable-entry/review trigger. Preserve the route's recovery/export access while disabled.

The release report must explicitly state whether source protection, result freshness, version truthfulness, browser accessibility, slow-device behavior and local-save failure recovery passed. A checked-off visual implementation without those outcomes is not ready for general availability.
