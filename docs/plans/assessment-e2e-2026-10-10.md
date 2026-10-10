# Assessment learner-flow E2E — 10 October 2026

**Outcome: NOT a clean release pass.** Four revised walkthrough candidates produced a real AI score of 97/100; Price Alert produced no accepted AI review on its first attempt or one explicit user-style retry. Pre-assessment autosave and mobile layout also failed.

This is fresh local browser evidence, not the earlier service smoke results or deployed production confirmation. No product fix, deployment, AWS content update, commit, or push was performed.

## Environment and scope

- Fresh Vite production bundle in `output/playwright/e2e-dist`, served on loopback port 5181; actual React playground and walkthrough buttons.
- Actual FastAPI problem, walkthrough, interview, assessment, and attempt routes on loopback port 8010.
- Existing Azure-configured AI provider; accepted responses identify model `gpt-5.4-mini`, rubric `2.0`, requirements revision `requirements-v2-preserved`.
- Isolated synthetic learner/authentication and an in-memory DynamoDB-shaped adapter. The real attempt service executes snapshot, history, last-AI, and assessment-count logic. Real DynamoDB persistence, authorization, concurrency, and failure behavior were **not** tested.
- Draft requirements and five revised walkthrough candidates are local test fixtures, not human approval or published content. Full provider palette metadata, Yjs collaboration, Langfuse ingestion, production CDN/cache behavior, and all 145 catalog problems were **not** covered.
- AWS resource operations are guarded; no AWS/user-production writes. Browser requests outside the two local origins are blocked, including analytics.

## Guide-to-review results

Every listed design was built by clicking real **Apply to Canvas**, **Draw Connection**, and **Use this design decision** controls. No prebuilt canvas or helper-built graph was injected. Optional interview questions were skipped, so answers did not supply missing design evidence.

| Revised candidate | Lessons / applied actions | Nodes / edges | Real result |
| --- | --- | --- | --- |
| Document Management | 41 / 28 | 11 / 10 | 97/100, Strong alignment |
| Job Scheduler | 46 / 27 | 12 / 14 | 97/100, Strong alignment |
| Price Alert | 47 / 42 | 21 / 21 | Unavailable; explicit retry also unavailable |
| Parts Compatibility | 22 / 16 | 8 / 8 | 97/100, Strong alignment |
| LLM Serving | 25 / 21 | 10 / 7 | 97/100, Strong alignment |

The LLM guide has four applied decisions embedded in decision/scale lessons; they count as actions despite not having `update_component` as their step type. The initial test assertion incorrectly expected 17 and was corrected to 21, without changing product code.

Captured requests preserve component IDs, all candidate-supplied properties (including accepted updates), connection endpoints, semantic connection types and descriptions, and typed requirements revision. Legacy `description` is compared using the product's `purpose` migration where applicable. Saved canvases retain all 134 applied action IDs across the five candidates.

## Passed behaviors

- Document problem and playground render functional/non-functional requirements separately.
- Advancing a lesson without applying it leaves the action count at zero.
- All five candidates' explicit actions can be applied through the UI.
- Document review supports all eight typed core requirements with submitted evidence. All accepted AI reviews cover their typed core scope.
- Clicking a Document requirement's evidence button focuses the named PostgreSQL component on the canvas; screenshot retained.
- After explicit assessment saves, all five canvases, applied-action counts, and scored/unscored review states restore on fresh navigation. Document also passed a direct reload.
- Simulated provider outage uses the actual fallback path: interview questions return 502, default optional questions remain usable, and assessment returns unscored structure checks.
- Outage UI shows no new 70/100 or 0/100 score. The earlier 97/100 is explicitly labeled **Previous AI review**, not a current review.
- Document outage history stores a null score and `scoreAvailable=false`, retains the prior AI review, and leaves AI assessment count at 1. Reload preserves this distinction.
- Price Alert's real failures also remain unscored, including after restore; AI assessment count stays 0.

## Release issues found

### P1 — Pre-assessment progress can be lost on reload

Applied Document lessons 1–16, then left the canvas idle well beyond the three-second debounce. No POST `/api/v1/attempts` reached the API. Reload restored an empty canvas and zero applied actions.

The autosave effect schedules a three-second timeout but depends on `elapsedTime`; the foreground timer increments every second and effect cleanup clears the pending timeout. Until an explicit assessment saves the attempt, this can starve autosave. Relevant source: `src/pages/SystemDesignPlayground.tsx`, autosave timeout around line 1431, dependency around line 1442, timer around line 1466.

Retest after a fix: apply one component, wait for a successful actual save response, reload before any assessment, and verify component properties and applied evidence. Add a regression with the one-second timer active.

### P1 — Price Alert cannot produce an accepted review in this run

Both real assessment requests fell back despite outage injection being **off**. The server reported `AI assessment unavailable error_type=ValueError`; the bounded output-validation/repair path did not recover. First attempt took about 32.1 seconds; explicit retry about 31.0 seconds. Neither is a low score or a pass.

The exact rejected field is not recorded by the current sanitized logger, so this test does not establish whether the underlying reason is schema, grounding, or verdict consistency. Capture the rejection reason and model response in an isolated replay before changing the contract. Keep fail-closed validation and honest fallback behavior; do not lower validation merely to turn this test green.

### P2 — Mobile review is clipped

At 390×844 with default panels open, the inspector starts at x=224 and is 320px wide, ending at x=544. Text and actions extend beyond the viewport; the document's measured scroll width is still 390 because overflow is clipped. A “no horizontal scroll” check alone would falsely pass.

Relevant layout: `src/components/InspectorPanel.tsx` fixed 320px initial width and `shrink-0` wrapper. Retest score, coverage, evidence buttons, fallback text, and retry at narrow widths, using bounding rectangles and screenshots.

## Harness and navigation caveats

Initial development-server cold dependency optimization caused Vite 504/HMR import errors. A new production bundle loaded correctly; the initial logs are preserved and not counted as a production app failure.

A fast Parts public-page click before catalog hydration took the static fallback's search route. This encountered `/all-problems`, which the isolated harness does not fully implement (500). Parts was subsequently tested by its exact problem ID. Its **public-page-to-playground navigation is not a verified pass**; recheck that race with complete catalog storage. The 500 is a harness limitation, not evidence of a deployed catalog outage.

Stale refs, incorrectly expected fallback headings, the LLM action-count assertion, and an unexpected unsaved-page reload caused test-driver retries. These were not relabeled as AI/product passes. A fresh successful LLM submission and saved-state restore were subsequently observed.

Marked deprecation warnings recur with the timer, and Tiptap emitted a duplicate underline-extension warning. They did not crash the successful flows and are separate cleanup items.

## Evidence and rerun

- API requests, responses, history, saved canvases, and HTTP events: sibling API `data/e2e-20261010-01/session.json`.
- Screenshots: `output/playwright/e2e-document-ai-review.png`, `e2e-document-evidence-focus.png`, `e2e-document-outage.png`, `e2e-document-mobile-outage.png`, `e2e-job-scheduler-review.png`, `e2e-price-alert-unavailable.png`, `e2e-price-alert-retry.png`, `e2e-parts-compatibility-review.png`, `e2e-llm-serving-review.png`, and `e2e-llm-serving-restored.png`.
- Browser logs/snapshots: `.playwright-cli`, named session `assessment-e2e`.
- Test-only local app: sibling API `scripts/e2e_assessment_app.py`. Use a **new** child run directory and explicit `E2E_LIVE_PROVIDER=1`; this calls a real paid provider. Synthetic auth is confined to the harness and is not a production login mechanism.
- Offline verification from the API checkout: `./scripts/verify_e2e_evidence.ps1`. Its final result intentionally fails because Price Alert has no accepted AI review; submission/saving semantics and outage-history assertions pass. Separate autosave/mobile failures are described above, not hidden by the evidence verifier.

This sample does not establish statistical reliability, human-rated accuracy, or production readiness. Fix and retest the three release issues, complete human content approval and negative/alternative design evaluation, then verify the deployed flow.
