# Requirements and assessment trust: implementation status

Verified locally on 10 October 2026. This is a development handoff, not a production-release approval.

## Outcome

The revised public reference candidates for all five existing guided walkthroughs scored **96–98 in five live AI runs each**, against their unchanged legacy exercise briefs. No score was raised, clamped, or replaced by a reference-comparison grade. A deliberately broken permission path in the document fixture was identified in every negative run and scored lower.

The release gate is **not complete**: these are authored development candidates, not human-approved ground truth. The five-negative/two-architectural-alternative dataset, held-out evaluation, reviewed catalog content, deployed-reader checks, static projection, cache rollout and historical regrading still have work remaining.

## Implemented locally

- Additive `requirementSpec`: functional/non-functional entries, stable IDs, core/extension scope, assumptions, schema version and content revision. Original arrays, IDs and slugs remain available.
- Shared requirements display on problem pages, public guide pages and the inspector. Approved runtime problem scope takes precedence over conflicting guide requirements/metrics. Unclassified legacy lists keep their original wording and labels.
- The existing local custom-problem form can create typed scope and assumptions without introducing a new server-side CRUD workflow.
- Provided review context recognizes targets in the exercise instead of always claiming that scale, latency and availability are unspecified. Accepted component decisions remain in the review input; presentation metadata is excluded.
- Walkthrough application retains semantic catalog identities, connection protocols and explicit property/decision updates. Apply/save/reload tests exercise the same helper as the playground. Merely reading a step does not implement a control; applied actions and viewed steps have separate progress.
- Approved catalog scope is resolved by the backend for assessment **and interview** requests. A mismatched current revision produces a visible conflict; an unavailable catalog does not cause silent grading against client-edited scope.
- One fixed, versioned, server-weighted 12-dimension rubric. Output must contain all dimensions and valid scores/references. Material deductions require a grounded defect, applicable criterion, core requirement and actionable recommendation. There is one bounded repair inside the overall AI deadline.
- One AI score with a qualified verdict, requirement-level coverage, evidence selection and focused next actions. Critical findings cannot produce an unqualified Pass. Optional improvements and clarifications are separate from core defects.
- Deterministic reference structure checks run only after an AI failure. They are unscored, do not assert architectural correctness and require compatible brief revisions. Unsupported/unavailable output is not a fabricated zero-score success.
- Outages retain the previous successful AI review separately from the latest failed check. History is bounded, unscored checks do not produce improvement deltas, and incompatible rubric/model/requirement revisions are not compared.
- Attempt snapshots use approved server content. Ordinary autosave does not silently upgrade a legacy attempt. Older reviews display their pinned requirement wording when available and explicitly disclose that a new review uses the current brief.
- Fallback results do not qualify as newly AI-reviewed public submissions or leaderboard scores. Existing public records remain readable.
- Public-only export/audit, reviewed conditional migration/rollback, reproducible candidate construction, fixture preparation and evaluation tooling. Draft labels/specifications cannot authorize production writes or become an approved Langfuse dataset automatically.
- Fixed a rich-text editor lifecycle failure discovered in the actual create-problem browser flow; the existing Tiptap editor is retained.

## Walkthrough fixes

Document management now records object storage rather than EFS, document-owner routing rather than client-IP affinity, the WebSocket protocol, durable operation acknowledgement/replay, fenced owner handoff, version-manifest/outbox recovery, document lifecycle/folders, authorization/revocation/search filtering and explicitly accepted hardening steps.

The first broader live check also exposed real omissions in the other guides. The price-alert candidate now records percentage-drop criteria/baselines and fluctuation/deduplication behavior. The scheduler records priority-aware dispatch and persisted, jittered, capped retry backoff with fenced state transitions, timer recovery and DLQ delivery. Its retry lesson is an explicit apply action. These are exercise capabilities, not scoring hints.

The source version-1.0 AWS fixtures are unchanged. Current generated guide versions are `2.0-candidate`, except scheduler `2.1-candidate`. The previous scheduler candidate is archived locally; its partial-coverage findings remain in the recorded results.

## Live development results

Provider: the existing Azure OpenAI `gpt-5.4-mini` deployment. Rubric: `2.0`. Inputs contain public reference data only, not private attempts. Expected scores/reference answers are not provided to the scorer.

| Candidate | Five scores | Verdicts | Output repair |
| --- | --- | --- | --- |
| Document management | 97, 97, 97, 98, 97 | All Strong alignment | None |
| Scheduler 2.1 | 97, 97, 97, 97, 97 | All Strong alignment | None |
| Price alerts | 97, 97, 97, 97, 97 | All Strong alignment | None |
| Compatibility assessment | 97, 97, 97, 97, 97 | All Strong alignment | None |
| LLM gateway | 96, 97, 98, 97, 97 | All Strong alignment | None |
| Document permission bypass | 94, 88, 93, 93, 91 | All Needs revision | Two runs used the bounded repair |

All 25 positive outputs reported supported coverage for the supplied core legacy anchors. Each negative output reported partial permission coverage and grounded permission defects. This small development set is **not** a claim of 95% real-world assessment accuracy.

Raw reports under `diagrammatic-api/data/assessment-reference-candidates/`:

- `6901ef1b9420d83630aca871-repeat-v3.json`
- `scheduler-2.1-repeat-v4.json`
- `6901ef1b9420d83630aca86c-repeat-v3.json`
- `6901ef1b9420d83630aca87e-repeat-v3.json`
- `ai_001-repeat-v3.json`
- `document-negative-permissions-v2.json`

Each report retains every result, provider output, validation error, input, model configuration and frozen hashes. They explicitly say `notReleaseAcceptance: true` and `humanLabelsReviewed: false`.

Earlier results are retained, including the initial 92 pilot, strict-schema/legacy-coverage failures, the scheduler's missing-backoff deductions, a negative output that remained unavailable, and the entire DNS-failed `*-repeat-v2.json` batch. The later batch followed verified DNS recovery; no failed output was replaced. The scheduler's new version followed a concrete content correction, not an unchanged-input retry for a better score.

The reported live assessment runs share prompt-file hash `51b6ad71a32ca40de94b7dfc0ca3c28f753b294e79b7bc5b1d36baaf055b115a`. After those runs, only the **interview** prompt functions in that module gained authoritative typed scope/constraint context; the assessment prompt and scoring behavior were not changed. New release experiments must freeze their own current hashes.

## Local validation

- 215 focused API tests passed, including approved scope, interview routes, malformed output/repair, history, model compatibility, LLM adapters, migration/rollback and walkthrough contracts.
- 50 frontend tests passed: all-five walkthrough apply/save/reload, requirement rendering, verdict/fallback/history behavior, persisted deduction metadata and installed-editor lifecycle.
- TypeScript and focused ESLint passed. Existing catalog/guide validators passed for 146 unique static entries/guides.
- Production build, prerender and SEO checks passed. Existing large-chunk and Pydantic deprecation warnings remain; this work does not claim a repository-wide cleanup.
- Desktop (1440 px) and mobile (390 px) create-problem form were rendered and inspected. Synthetic critical/fallback states use the real inspector: critical scores show Needs revision, keyboard evidence selection works, and fallback shows no new architecture score while identifying the earlier AI review.
- The inspector preview is explicitly synthetic and is not a production route or a live architecture screenshot. Existing local analytics/duplicate-extension warnings and a harness-only hot-reload root warning were observed; no zero-console-error claim is made.

Preview artifacts are under `diagrammatic/output/playwright/`: `requirements-desktop.png`, `requirements-mobile.png`, `review-critical-desktop.png`, and `review-unavailable-mobile.png`.

Repeat checks from each checkout:

```powershell
# diagrammatic-api: use a NEW, unused basetemp path (pytest clears it)
.\.venv\Scripts\python.exe -m pytest tests/test_assessment_trust.py tests/test_assessment.py tests/test_assessment_history_trust.py tests/test_requirement_migration.py tests/test_assessment_evaluation.py tests/test_walkthrough_contract.py tests/test_interview_requirements.py tests/test_problem_models.py tests/test_dynamodb_serialization.py tests/test_llm_adapters.py -q -p no:cacheprovider --basetemp=data/test-tmp-next-verification

# diagrammatic
npx vitest run src/utils/guidedWalkthrough.test.ts src/components/ProblemRequirements.test.tsx src/components/shared/tiptapLifecycle.test.tsx src/utils/assessor.test.ts
npm run build
```

## Catalog and release gates

The read-only AWS snapshot contains 145 public problem rows and five walkthroughs. The additive draft preserves every original requirement/constraint sentence. No draft has been marked reviewed or approved. Current evaluation bundle: `diagrammatic-api/docs/requirements-assessment-evaluation-bundle-v4.json`; safe-operation instructions: `diagrammatic-api/docs/requirements-tooling.md`.

Before production rollout:

1. Review the two pilot briefs and all 145 classification proposals. Resolve the URL-shortener's conflicting expiry/traffic/availability scope and the static-only `job-scheduler` alias. Do not silently change these exercises.
2. Human-review the five revised walkthroughs and their requirement mappings, the five intended negative cases and two genuine architectural alternatives. Generated ID/layout variants are not architectural-alternative ground truth. Run the frozen full dataset and a separate held-out set; keep schema failures and latency in the result.
3. Finish historical-spec retention/retrieval and explicit upgrade/regrade workflow. Original per-attempt snapshots are retained, but the assessment API currently serves only the current approved revision and rejects unavailable older revisions. A visible warning is not an archived-revision grading endpoint.
4. Generate/check static requirements from the approved runtime revision, then deploy backward-compatible readers. Verify old/new/custom/free-form and historical attempts in the deployed environment.
5. Review a matching targeted catalog/static/walkthrough cache version and feature-flagged rollout. The migration tooling guards approved problem attributes and writes a reversible journal; it does not deploy readers, produce the final static projection or clear caches for an operator.
6. Apply only sealed/reviewed manifests conditionally, read back, verify both pilot experiences and rollback paths. Confirm intended Langfuse trace/dataset ingestion and existing privacy masking; no dataset was uploaded in this implementation.

No AWS records, user attempts, production caches, deployments or Git remotes were mutated during this work. No commit or push was made. Pre-existing `.gitignore`, Landing3D and environment changes were preserved.
