# Problem requirements, walkthrough quality, and assessment trust

Status: core API/frontend implementation and development validation completed locally on 10 October 2026. Content candidates and the 145-problem migration remain unapproved and unpublished. No production deployment or AWS data writes have been performed. See [implementation status](problem-requirements-and-assessment-trust-implementation.md) for verified results and remaining release gates.

## 1. Outcome and boundaries

A learner should be able to understand the problem, follow a guide, build the taught design, and receive a review that evaluates that same problem and design. The review must explain what is supported, what is missing, and what to improve next.

Product decisions:

- Keep AI assessment primary, with one architecture-review score.
- Use deterministic reference comparison only when AI review is unavailable. Do not run a second reference-comparison score beside a successful AI review.
- A complete, human-approved official walkthrough should earn more than 95/100 in repeated acceptance runs. This is a quality gate, not a score floor or an official-content exception.
- Do not equate 77/100 with 77% accuracy, requirement completion, or production readiness.
- Preserve problem IDs, public slugs, existing attempts, custom problems, free-form designs, and the existing provider-neutral LLM boundary.
- Do not add LangGraph in the first implementation. The confirmed defects are in content, serialization, context, and review semantics. Reconsider orchestration only if evaluation demonstrates a specific need for branching or additional review stages.

## 2. Evidence verified on 10 October 2026

Read-only AWS CLI inspection in `ap-south-1` found:

- `diagrammatic_problems`: 145 records; all have flat `requirements` and `constraints` lists. None has `functionalRequirements`, `nonFunctionalRequirements`, or `requirementSpec`.
- The problem table uses `id` as its partition key and has `difficulty-index` and `category-index`, both projecting all attributes. No new index is needed just to add requirement fields. DynamoDB key definitions are not a complete application schema.
- `diagrammatic_guided_walkthroughs`: five records, keyed by `problem_id`; each reports version `1.0`. Five problem records have `has_guided_walkthrough = true`.
- The frontend has 146 public-guide JSON files and 146 static catalog slugs. All 145 live slugs appear in the static catalog; `job-scheduler` is static-only. Resolve its intended relationship to the live scheduler problem before treating it as an extra database problem.

Confirmed inconsistencies:

1. The live URL-shortener brief says URLs should not expire, while the public guide supports optional expiration. Live traffic is 100M URLs/day; the guide assumes 100M creates/month and 10B redirects/month. The live availability target is 99.9%; the guide specifies different create/redirect targets.
2. The document walkthrough labels its storage component S3 but sets its storage type to EFS.
3. The document walkthrough says client-IP hashing keeps all editors of a document on one collaboration server. Different editors have different client IPs; document affinity or an explicit document-owner routing mechanism is needed for the stated single-owner OT design.
4. Document walkthrough steps 35–41 teach HA, backups, encryption, Redis topology, gateway protection, CDN, and observability as explanation-only steps. The apply handler handles component and connection additions, not these explanations. The assessment builder does not serialize the walkthrough's teaching text as implemented decisions.
5. Applied connections do not retain the walkthrough's `connectionType`; the assessment builder can consequently default them to `api-call`.
6. Generated reasoning context currently states that scale, traffic, latency, availability, and consistency targets are unspecified without first checking the actual brief for those targets.
7. The AI prompt prints connection endpoints as IDs but does not consistently include matching component IDs in the component list.
8. The backend calculates the overall weighted score, which is a useful boundary to preserve, but currently sets `is_valid` from score >= 50. The UI can therefore say Pass alongside a critical finding.

The initial 70 result was a basic fallback; the later 77 result was an AI review. They are not comparable measurements. These findings show real guide and input issues, but do not establish which issue caused every deduction in the specific 77 review. Reproducing the submitted payload against the versioned brief and rubric remains the first diagnostic task.

## 3. Requirements contract for every problem

Add an optional, typed `requirementSpec` to the existing problem record and API model. Keep the existing arrays for older clients and attempts; do not replace them in one breaking migration.

The initial contract should be small:

- Schema version and content revision.
- Functional requirements: stable ID, plain-language text, and core/extension scope.
- Non-functional requirements: the same fields, with an optional category such as scale, latency, availability, consistency, security, or durability.
- Explicitly labeled reference assumptions. These are not secretly mandatory targets.
- Existing `constraints` for actual restrictions such as technology, budget, residency, or deployment limitations.

Stable requirement IDs let feedback point to a specific requirement. Do not turn this into a general policy language or require editors to fill large verification objects.

Distinguish three things in content and scoring:

1. **Required behavior/quality:** stated by the exercise and evaluated.
2. **Reference assumption:** a worked-example choice, visible and replaceable by a justified learner assumption.
3. **Extension:** optional extra scope, not a hidden deduction for a core solution.

An optional user input, such as an expiration date, is not necessarily an optional system capability. If the exercise requires supporting optional expiration, that capability is core even when individual links do not expire.

Runtime problem records remain authoritative for approved exercise requirements. Keep existing guide JSON as the editorial source for explanations and architectures. Link its requirement section to an approved problem revision and produce/check the static requirement projection from that revision. Do not create a second catalog or leave independent editable requirement copies in four surfaces.

Legacy records must continue to render their original brief. Do not automatically label every old `requirements` entry functional or every `constraints` entry non-functional: the current data mixes both.

### URL-shortener example

Use the user's requested formulation as a proposed new exercise revision:

Functional:

- Create short URLs from destination URLs.
- Support optional custom aliases.
- Support optional expiration times.
- Redirect visitors to the destination URL.

Non-functional:

- Guarantee unique short codes and aliases.
- Keep redirect latency low, with an explicitly agreed target if numeric grading is desired.
- Prioritize availability for redirect reads while preserving correctness during code/alias creation.
- Support a scenario with 1B stored URLs and 100M DAU.

Before publishing that revision, reconcile existing analytics, 100M/day traffic, 99.9% availability, and never-expire requirements. Do not silently discard them or reinterpret DAU as request throughput. Required scope changes need a new content revision; old attempts retain their previous context.

## 4. Pilot: document-management walkthrough

Start with problem `6901ef1b9420d83630aca871` because it is the reported trust failure.

1. Capture an exact versioned brief, walkthrough, applied canvas, interview answers, request, prompt, and result for reproducible comparison. Use synthetic/reference inputs, not a broad export of users' private attempts.
2. Map each core requirement to taught design evidence and walkthrough steps: document lifecycle, real-time editing, versions/rollback, search, folders, sharing/permissions, rich text/markdown, and scale.
3. Fix S3/EFS metadata and document-owner routing. Preserve provider-neutral alternatives where they satisfy the same semantics.
4. Teach and encode reconnect/replay, operation identifiers, acknowledgements, idempotent application, and state recovery appropriate to the selected OT strategy.
5. Define snapshot/version-manifest recovery after partial failures, authorization and revocation behavior, and document deletion/restore propagation where required by the exercise.
6. Turn design-changing explanation steps into explicit, learner-confirmed decisions or property updates. Add reusable update/decision application support only where needed; avoid adding unnecessary components merely to satisfy a checklist.
7. Record the learner's chosen design decision, not just the entire lesson text. Reading a page or pressing Next must not count as implementing encryption or failover.
8. Preserve connection protocols and semantic component identities through step application, save/load, and assessment serialization.
9. Maintain a final canonical fixture built through the actual walkthrough application path. A hand-built ideal diagram does not test the user's experience.

Walkthrough UX should show the purpose of a step, the requirement it supports, the action or decision needed, and what remains. Separate steps viewed from design actions completed. Reapplying steps must be idempotent, and resuming a saved walkthrough must not lose accepted decisions.

## 5. Assessment input and rubric

### Normalize once at the existing boundary

Send the reviewer a coherent architecture representation:

- Component ID, label, original catalog ID, semantic role, and relevant properties.
- Connection ID, endpoint IDs and readable endpoint labels, protocol, and purpose.
- Approved problem ID and requirement revision for catalog exercises.
- Known targets, reference assumptions, learner decisions, and interview answers with their origins distinguished.

Do not rely solely on visual node types such as custom, Layer 7, or EFS to infer architectural roles. Preserve unknown/custom roles without inventing them. Exclude layout/runtime props and bound payload size.

For catalog problems, resolve the approved specification on the backend. Keep a declared-context path for local custom problems and free-form designs; a missing catalog record must not break those workflows. Do not feed canonical reference answers, expected scores, or acceptance labels to the reviewer.

### Scope-aware review

The rubric must evaluate the published core requirements and internally coherent decisions, not an unstated enterprise checklist. Optional advanced recommendations can be useful without lowering the core score merely because the learner did not choose them.

Require findings to distinguish:

- A demonstrated contradiction or missing required capability.
- An unspecified decision requiring clarification.
- A supported design strength.
- An optional improvement beyond the exercise.

Every scored deduction needs an applicable criterion and evidence from the submitted design. Missing annotation is not automatically proof that a control is absent. A diagram can support a latency strategy; it cannot prove a measured latency SLO.

Retain the server-side score aggregation. Make applicable dimensions explicit and versioned; incomplete model output must not silently change the denominator. If a dimension is genuinely not applicable, that must follow the rubric, not be a model shortcut for avoiding a low score. Consolidate explanation-coverage rules and do not suppress real architectural risks with broad description-keyword filtering.

Validate structured output, referenced IDs, score ranges, and verdict/finding consistency. Permit at most one bounded repair attempt for malformed output within an overall deadline. Unrecoverable output is an unavailable/incomplete review, not a fabricated zero or a normal success.

## 6. User experience through the learning loop

### Before designing

Render consistent Functional Requirements, Non-functional Requirements, and Assumptions sections on the problem page and playground. Show true constraints separately when present. Reuse the existing generic page and inspector, rather than creating problem-specific screens.

Show the core scope first and place extensions behind a disclosure. State the reference scenario and whether it is a requirement or an assumption. The create-problem form should use the same vocabulary while retaining its current local-storage behavior; server-side custom-problem CRUD is not part of this change.

### Before assessment

The interview should ask about genuinely unresolved decisions. Do not ask users to restate targets already supplied by Diagramwise. Display the context the reviewer will use, including accepted guide decisions, and let users correct inaccurate assumptions. Skipped questions remain visible as skipped, not answered.

Use factual progress states such as preparing context and reviewing design. Do not display invented percentages. Prevent duplicate submissions and retain the design if a review fails.

### After assessment

Keep one AI architecture-review score, displayed as `/100`. Pair it with a qualified verdict such as Strong alignment, Needs revision, or More context needed. Unresolved critical findings cannot coexist with an unqualified Pass.

The initial result should contain:

1. A short summary grounded in the exercise.
2. Requirement-level statuses: supported by the design, partial, missing, or needs clarification.
3. Up to three prioritized next actions.
4. Strengths and optional improvements.

Selecting a finding should highlight its component or connection when possible. Each action should explain what to change, why it matters, and which requirement it affects. Keep detailed dimensional analysis collapsed. Deduplicate repeated advice across findings, improvements, suggestions, and components-to-add sections.

Mark addressed means the learner believes they made a change. Rename/describe it accordingly and validate resolution on the next assessment. Do not let the checkbox erase evidence or guarantee a higher score.

## 7. Deterministic fallback only

When AI is unavailable, clearly say: **AI review is unavailable. These are walkthrough-structure checks, not an architecture assessment.**

- For an eligible guide, compare semantic roles, required relationships, and observable properties; do not require identical positions, UUIDs, or provider names.
- Report check statuses and missing evidence, not a second architecture score or production-quality Pass.
- If no compatible reference exists, offer retry and report only basic integrity checks that can actually be verified.
- Preserve the last successful AI review and identify it as belonging to an earlier canvas revision if the design has changed.
- Keep fallback entries distinguishable in history. Never show fallback 70 to AI 77 as a +7 architecture improvement.
- Reuse existing public-sharing rules, but do not advertise fallback results as a successfully AI-reviewed design.

Contract validation before an AI call and deterministic regression tests are still appropriate. They are not a second runtime reference grader.

## 8. Evaluation and the greater-than-95 gate

Use the existing Langfuse integration; the repository lockfile currently pins Python SDK `4.15.2`. Keep that baseline for this scoped work unless an experiment capability demonstrably requires an upgrade. Verify current SDK documentation before implementation and preserve privacy masking and server-side credentials.

Start with a small, human-reviewed development dataset:

- Five canonical complete walkthrough outputs, generated through the real apply path.
- Five corresponding variants with one deliberately missing core capability or a real contradiction.
- Two valid alternative designs to detect reference-copying bias.

Expected outputs should describe required coverage, justified finding severity, forbidden unsupported claims, and human-approved score bands. Never pass those expected outputs into the assessment prompt.

Run each complete fixture five times under a frozen problem revision, rubric, prompt, and model configuration. Proposed walkthrough release gate: **every acceptance run scores 96–100, with no unsupported critical findings and no missing core capability**. A failure means investigate the walkthrough, lost context, or rubric; do not clamp, cherry-pick, or repeatedly rerun until a convenient result appears.

Negative fixtures must reliably detect their intended defect and score below their complete counterpart. A version that scores every diagram 98 fails, even if official walkthroughs pass. Test ID renaming, geometry changes, and equivalent component substitutions without changing the design's meaning.

Track schema failures, evidence-reference failures, unsupported findings, severity agreement with human reviewers, score variation, latency, and fallback frequency. Keep a separate held-out fixture set before making broad reliability claims; a small development dataset is not proof of 95% real-world accuracy.

Version experiments and connect learner helpfulness/unfair-deduction reports to existing assessment traces. Confirm actual ingestion in the intended Langfuse project; local configuration alone does not prove monitoring works. Do not upload private design text by default.

References: [Langfuse datasets](https://langfuse.com/docs/evaluation/experiments/datasets) and [experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk).

## 9. Catalog-wide content and safe migration

For all 145 live problems, produce a review matrix with:

- ID and slug; approved content revision.
- Functional/non-functional classification and true constraints.
- Provided targets versus reference assumptions.
- Conflicts among live brief, public guide, walkthrough, and reference architecture.
- Requirement-to-evidence mapping and remaining editorial decisions.

Do not bulk-copy the richer guide requirements into DynamoDB without review: the URL-shortener example proves that this can silently change exercise scope. Do not invent traffic numbers for problems with qualitative targets. Flag unresolved scope choices for editorial review while progressing with the unaffected problems.

Migration sequence:

1. Export the affected public records with their original values; produce an approved dry-run diff and revision manifest.
2. Deploy backward-compatible readers and legacy fallbacks before publishing the new data.
3. Pilot document management and URL shortener, preserving their IDs and slugs.
4. Apply only approved attributes using conditional updates to detect concurrent changes. Never replace whole records or touch users' attempts.
5. Read back every changed record, validate the derived legacy/static projections, and verify guide links and walkthrough flags.
6. Invalidate or version relevant catalog/page caches; the current Redis cache TTL is 24 hours. Invalidate walkthrough session caches when a new version is published.
7. Keep old requirement revisions available for saved attempts. Offer a visible upgrade to the latest brief instead of silently regrading old work against a changed problem.
8. Prepare rollback of the changed attributes and matching static content/cache version. Roll back conditionally so later edits are not overwritten.

No new table or GSI is needed for the additive requirement contract. Historical-spec retention needs a deliberate storage choice; begin with bounded version snapshots and respect DynamoDB item-size limits rather than accumulating unbounded history in a problem item.

## 10. Reviewable implementation slices

| Slice | Deliverable | Acceptance gate |
| --- | --- | --- |
| 1: Reproduce | Versioned document fixture and content/payload audit | Each deduction is classified as real gap, missing context, or unsupported claim |
| 2: Contract | Additive specification, compatibility adapters, two pilot briefs | Old/new/custom/free-form problems load; all consumers show the same scope |
| 3: Walkthrough | Correct document guide, persisted decisions/protocols, canonical apply-path fixture | Reloaded canvas and review payload retain the taught design evidence |
| 4: Reviewer | Grounded context, versioned rubric, strict output validation, honest verdicts | Canonical and negative development fixtures pass without score overrides |
| 5: Learner UI | Consistent requirements, focused review actions, honest fallback/history | Desktop and narrow-width flows work; no duplicate advice or incomparable deltas |
| 6: Five guides | Audit and calibrate the remaining four walkthroughs | All five complete walkthroughs pass the repeated greater-than-95 gate |
| 7: Entire catalog | Reviewed batches covering 145 live problems and reconciled static slugs | No lost requirements, unexplained scope changes, stale guides, or broken links |
| 8: Release | Held-out evaluation, feature-flagged rollout, telemetry and rollback checks | Negative/alternative cases remain useful; deployed behavior matches validation |

Content review and test-fixture preparation can run in parallel with compatibility work. Production migration depends on compatible deployed readers; publishing a walkthrough depends on its actual apply-path fixture passing.

Suggested code seams:

- API: `app/models/problem_models.py`, `app/models/request_models.py`, existing problem router/service/cache, `app/utils/prompts.py`, `app/services/ai_assessor.py`, response/history models.
- Frontend: `src/types/systemDesign.ts`, `src/types/problemGuide.ts`, existing guide loaders/materialized guide data, `ProblemLanding`, `ProblemGuideContent`, `CreateProblem`, `GuidedHelpPanel`, `InspectorPanel`, `AssessmentFindings`, and the playground's shared serialization/application helpers.
- Extract narrow pure helpers for requirement normalization and walkthrough application so the UI and tests exercise the same behavior. Keep provider-specific code behind `LLMPort`.

## 11. Verification and success measures

Required checks:

- API tests for legacy/new models, backend resolution, bounded malformed-output recovery, verdict consistency, and score applicability.
- Frontend tests for step idempotency, semantic/protocol preservation, guide decision save/load, requirement rendering, fallback states, and comparable history deltas.
- Migration tests for dry run, conditional conflicts, preserved unrelated attributes, read-back verification, and rollback.
- Existing catalog/guide validators, TypeScript, targeted lint, production build, prerendering and SEO checks.
- Browser verification on desktop and a narrow viewport, including keyboard/focus behavior, long requirement wrapping, node highlighting, guide resume, reviewer failure/retry, and explicit public-review provenance.
- Deployed smoke test for both pilot problems and a legacy saved attempt. Local tests are not deployed confirmation.

Success means: all approved exercise consumers agree; all five completed official walkthroughs repeatedly earn more than 95 honestly; incomplete designs still expose genuine defects; learners can identify their next action; and AI outages do not masquerade as scored architecture reviews.

After measuring the baseline, set release targets for review helpfulness, disputed unsupported deductions, completion/reassessment rates, p95 latency, and fallback frequency. Do not fabricate current percentages or claim outcome improvements before measuring them.
