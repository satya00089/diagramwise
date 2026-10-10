# Assessment E2E follow-up fixes — 2026-10-10

These are local changes and local tests, not a deployed-production acceptance
report. The original E2E report and its failed Price Alert runs are preserved.
No AWS data, walkthrough publication, deployment, or Langfuse dataset was changed.

## Autosave

Reproduced using the original production bundle: applying one document guide
component and waiting beyond the three-second debounce produced zero attempt
writes; reloading removed the component.

Replaced the render-driven save effect with a content-keyed debounce and a latest
callback. Clock ticks no longer restart the debounce, but the save reads current
elapsed time. Autosaves are serialized, with pending edits saved after an in-flight
request completes. Disabling/unmounting cancels pending work. Deleting the last
component of an already-saved problem attempt can now persist the empty canvas.

The fixed browser restored a single applied component, then a complete document
walkthrough, before any assessment: 11 components, 10 connections, 28/28 applied
design actions. Every walkthrough property/update and connection matched the
saved attempt; there were zero metadata mismatches. Evidence is in the sibling
API's `data/e2e-fixes-20261010-01/session.json` and
`data/e2e-fixes-20261010-02/session.json`.

## Assessment output reliability

The preserved Price Alert smoke diagnostic shows an unexplained deduction on the
first generation and misplaced arrays within `detailed_analysis` on the repair.
The later E2E Price Alert failures recorded only `ValueError`, not raw responses;
their precise validation causes cannot be retroactively confirmed.

Assessment generation and its single bounded repair now request the same strict
JSON Schema. It requires all twelve integer scores, coverage, findings, the eight
analysis strings, and separate top-level arrays. Coverage and findings are ordered
before grades. Interview tasks retain their existing JSON-object format. The
schema is stable across submissions and does not encode reference solutions,
expected scores, or user-specific evidence IDs.

The prompt now explicitly aligns its strong-alignment rule with the validator:
no unresolved defect **or clarification**. Deductions must be chosen from grounded
findings rather than justified after choosing a grade. Safe fixed validation
reason codes distinguish malformed output, ungrounded deductions, coverage,
references, and verdict inconsistencies without logging learner/provider content.

Semantic evidence validation, weighted server-side scoring, the shared deadline,
one repair, and the honest unscored fallback remain unchanged. Optional work and
clarifications do not justify deductions. No score inflation or agent framework
was introduced. The fallback reference comparison still runs only after AI failure.

This follows [OpenAI's structured-output contract](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).
Provider acceptance and real Price Alert score reliability still need a live
retest. The attempted replay was blocked by safety review because it would send
a recorded architecture payload to the configured external provider. An explicit
approval request is pending. No live provider replay was performed in this turn.
The diagnostic helper is `diagrammatic-api/scripts/replay_assessment_diagnostic.py`.

## Mobile inspector

The original 390×844 browser reproduction placed the 320px inspector at x=224,
ending at x=544 outside the viewport. The canvas container hid the clipped part.

Narrow screens now use mutually exclusive palette/inspector drawers over the
canvas. Both features remain available, with separate 44px toggle targets and
expanded-state accessibility attributes. Inspector width is capped to leave space
for both controls. The redundant imperative width override was removed. The
toolbar wraps rather than pushing assessment controls off-screen. Completing a
review opens the mobile inspector, including when its tab was already selected.

At 390px, the inspector begins at x=96 with an approximately 294px width, and
document scroll width remains 390px. Both toggle targets are 44×44px with an 8px
gap. A restoration/context save may occur shortly after reload; idle-write checks
must let that pending debounce settle rather than count it as a clock-driven write.

The test-only response recorder initially attempted to JSON-decode the plain
CORS preflight response. Fixed it to capture POST assessments only. The corrected
preflight returns HTTP 200 and the exact allowed local origin. A subsequent real
router/service browser assessment with the local outage adapter returns HTTP 200,
`source=rule_based`, `score_available=false`, and `verdict=unavailable`. Its saved
history has one unscored entry and the AI assessment count stays zero. All 11
components and 10 connections remain saved. The corrected API evidence is in
`diagrammatic-api/data/e2e-fixes-20261010-03/session.json`.

The earlier run-02 client fetch failure and its initial screenshots are retained;
they are harness-error evidence, not a provider-outage acceptance result.
Browser geometry assertions wait for the existing 300ms width transition before
checking collapsed panels. Sampling a transitioning width is not an open-state
failure; expanded-state attributes provide the immediate state.

Final browser confirmation passed at both 360×844 and 390×844: the 360px inspector
is 264px wide at x=96; at 390px it is approximately 294px wide. Opening the palette
collapses the inspector to 24px, and opening the inspector collapses the palette to
24px. Once restoration settles, a 7.5-second idle window causes no repeated saves
despite the running timer. Reload retains all 11 components and the unscored review.

Confirmed visual evidence:

- [Desktop structure-check result](D:/satya/ngExp/diagrammatic/diagrammatic/output/playwright/e2e-fixes-desktop-confirmed.png)
- [Mobile structure-check result](D:/satya/ngExp/diagrammatic/diagrammatic/output/playwright/e2e-fixes-mobile-confirmed.png)

## Offline verification

- API assessment, trust, history, provider, walkthrough, evaluation, and interview
  suites: **197 passed**. Four existing Pydantic deprecation warnings remain.
- Frontend `vitest run src`: **112 passed** across 19 suites.
- Node-runner hairline figure tests: **3 passed** separately. Running unrestricted
  Vitest also discovers that Node test file and reports a runner mismatch; its
  tests themselves pass. No unrelated test-runner configuration was changed.
- Focused autosave cases cover ticking metadata, debounced edits, in-flight
  writes, cancellation, and disposal. Inspector tests cover bounded widths and
  controlled mobile open/closed states. Contract tests cover strict output on
  generation and repair, prompt/verdict consistency, safe diagnostic codes, and
  retention of grounded lower scores and honest rejection behavior.
- Type checking, touched-file ESLint, production Vite build, and diff checks were
  run. The existing large-chunk build warning remains.

The browser harness uses synthetic authentication and an in-memory adapter with
the real attempt-service logic. Real AWS persistence/concurrency, real login,
deployment, and live AI acceptance are not established by these results.
