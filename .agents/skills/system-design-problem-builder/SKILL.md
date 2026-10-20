---
name: system-design-problem-builder
description: "Build or extend reusable system-design problem pages in this app, including typed guide content, public reference architectures, route and SEO integration, and validation for new problem slugs."
---

# System Design Problem Builder

Use this skill when the user asks to add a new system-design problem, expand a problem page, add a reference architecture, or repeat the URL Shortener-style guide experience for another problem in the Diagrammatic app.

## Outcome

Deliver a new problem through the existing generic experience at `/problems/<slug>/`. The page should have editorial guide content, a public architecture canvas when appropriate, working navigation and SEO metadata, and no problem-specific duplicate page component unless the existing data model cannot express a real requirement.

## Workflow

1. Inspect the incumbent implementation before editing. Locate the problem catalog, guide types/data, `ProblemLanding`, `ProblemGuideContent`, `PublicArchitectureCanvas`, route handling, `prerender.js`, `public/sitemap.xml`, and `scripts/seo-check.js`. Preserve unrelated working-tree changes.

2. Decide the source of truth using the app's existing pattern:
   - Use the existing catalog/API/DB loader for discoverable problem metadata when one exists.
   - Keep editorial guide sections in the typed guide data source already used by the app unless the project has an established CMS or DB model for them. Store each substantial problem guide as statically imported JSON under `src/data/public/problemGuides/`; keep `src/data/problemGuides.ts` limited to typed imports, slug lookup, and compatibility exports so prerendering/SEO remain synchronous and Sonar does not compare every guide's repeated schema in one source file. Do not put these files in the root `public/` directory, which would require runtime fetches.
   - Do not create a second catalog or fetch the same problem from a new ad-hoc endpoint.

3. Add the problem metadata with a stable lowercase slug, title, description, difficulty, domain/category, estimated time, tags, and any fields required by the existing problem list and prerenderer.

4. Add the guide content through the generic guide model. Cover the sections the product exposes:
   - Requirements: functional, non-functional, scale assumptions, and derived traffic/storage numbers.
   - Key entities: fields, relationships, and access-pattern notes.
   - API / interface: representative contracts plus validation, authorization, and consistency behavior.
   - Data flow: numbered synchronous and asynchronous steps.
   - High-level design: a reference architecture with layers, components, and labeled connections.
   - Deep dives: the decisions most likely to be challenged in an interview.
   - Tradeoffs, follow-ups, and rubric: alternatives, probing questions, and observable evaluation criteria.

   Content must distinguish supplied facts from assumptions. Keep claims internally consistent: traffic, storage, cache behavior, durability, and latency targets should support the architecture shown.

   Add a restrained Rough Notation teaching layer for problems where the guide has clear decision-driving content. Reuse `src/hooks/useRoughAnnotation.ts` and the generic `ProblemGuideContent` rather than creating a problem-specific page. For each problem, annotate at most five high-value cues:
   - The interview prompt or its central constraint.
   - One strong-answer signal.
   - One scale or latency metric that changes the design.
   - The critical path or durable boundary in the numbered data flow.
   - The asynchronous/background boundary that must stay off the user-facing path.

   Choose targets from the problem's own wording; do not copy labels from another problem. Gate annotations by the problem slug so ordinary problems and unrelated guide pages remain unchanged. Keep annotated text in normal accessible DOM, attach refs to padded inline/block wrappers, and keep the marks separate from serialized diagrams and exports. Use theme-aware colors: dark themes need a deep enough highlight for white text, light themes need a pale highlight for dark text. Preserve the visible text color, add real CSS padding when the mark needs breathing room, and use `prefers-reduced-motion` to disable animation without hiding the explanatory content.

5. Add the public architecture as data, not a one-off renderer. Reuse the existing component definitions and `GuideArchitecture`/connection types. Give every component a stable id, readable label, useful description, and position. Use the current canvas layout conventions; keep the main request path readable from left to right, put asynchronous paths below it, and keep sufficient horizontal separation for routed links. Use the established handle direction (`right` to `left`) when the canvas expects it. Every connection should have a meaningful label/type and a short explanation.

   Treat architecture legibility as a reusable layout concern, not as a guide-specific text-editing problem:
   - Use the shared `CustomEdge`/`edgeLabelLayout` behavior for connection labels. It measures the usable path run, merges collinear path pieces, wraps long labels at word boundaries, breaks long tokens safely, and tries collision-free offsets. Do not shorten or ellipsize meaningful architecture labels to hide a geometry problem.
   - Before changing a guide, inspect component positions, measured node sizes, connection paths, and handles. A label must have a clear corridor between nodes; a fixed character-count or fixed-width rule is not enough because fonts, zoom, node sizes, and stepped paths vary.
   - For components with effectively equal `x` positions, route vertically: the upper component uses `bottom` and the lower component uses `top`; reverse the pair when the source is below the target. If another component occupies the same column between them, route around that column with matching `left` or `right` handles. For effectively equal `y` positions, route left-to-right with `right` to `left` and right-to-left with `left` to `right`; if another component occupies the row between them, use a matching `top` or `bottom` handle pair for a clear detour. Explicit `sourceHandle`/`targetHandle` properties remain the override for intentional exceptions.
   - If a long label still has no clear path run, reflow that guide's architecture into readable tiers or add a narrowly scoped label-position/max-width override. If the label is readable but ambiguous among nearby branches, use `labelPosition: "source"` or `"target"` with a small `labelOffset` to anchor it toward the relevant endpoint. The renderer supports `source`, `center`, or `target` placement and clamps offsets to `0..0.95` with a `0.18` default; treat any concrete value as geometry-specific evidence, not a value to copy across guides. Keep the full semantic label and preserve the generic renderer for other guides.
   - When multiple guides show the same symptom, fix them one guide at a time from rendered evidence: first confirm the shared renderer handles the case, then adjust only the affected guide's positions/handles and visually recheck it at desktop and narrow widths. Preserve unrelated guide data.
   - Use a corrected guide such as `identify-the-k-most-shared-articles-in-various-time-windows` as a topology example: widen the main flow, move side/operations components into distinct tiers, use a valid corner handle only where a particular edge needs a deliberate exit, and add label placement metadata only when that edge's label is still ambiguous. Do not copy its numeric offsets or handles to every guide.

6. Keep the full-screen/long-scroll reading experience intact. Do not move all content into a modal or replace the generic disclosure sections with problem-specific JSX. Add a new UI component only when the data model genuinely cannot represent the requirement, and make that component reusable.

7. Integrate route and SEO behavior. Use the app's trailing-slash canonical convention and the public production domain in canonical URLs and sitemaps; never add a `localhost` URL to `sitemap.xml`. Confirm the problem is included in the build-generated sitemap and, when the checked-in source sitemap is authoritative for this project, add the canonical problem URL there too.

8. Validate proportionally:
   - Run targeted formatting and ESLint on changed source files.
   - For architecture-label or handle changes, run the focused edge-layout and routing tests (for example `npm run test -- --run src/utils/edgeLabelLayout.test.ts src/utils/adaptiveEdgeRouting.test.ts`) and verify no meaningful label text is clipped or hidden behind a node.
   - Run `npm run build` so TypeScript, Vite, prerendering, and post-build SEO checks execute.
   - Run `npm run seo:check` explicitly when changing routes, metadata, or sitemap data.
   - Run the Impeccable detector on changed frontend files when UI code changes.
   - If a local browser is available, inspect the new route at desktop scale and verify the architecture canvas, section anchors, hover/focus states, and mobile/scroll behavior.
   - For every guide whose architecture data changed, capture a rendered desktop and narrow-viewport pass. Check long labels, equal-column/equal-row connections, stepped paths, node overlap, and whether the intended reading order remains clear; source/build success alone is not visual verification.
   - Verify Rough Notation is visible on the intended route, absent from unrelated routes, readable in both light and dark themes, and does not clip the first or last characters of annotated text.

## Sonar and CI findings

When a PR check reports Sonar findings while adding a problem, fix the reported code rather than suppressing the rule. Prefer extracting small status/formatting helpers, rendering subcomponents with clear early returns, and removing unused collections or duplicated expressions. Keep behavior unchanged and rerun the local build, lint, and SEO checks. Do not commit, push, rerun remote checks, or change CI configuration unless the user explicitly asks.

For guide-data duplication findings, do not flatten or remove editorial content merely to satisfy the metric. Serialize each guide object to `src/data/public/problemGuides/<problem>.json`, import it statically in the catalog adapter, cast or validate it to `ProblemGuide`, derive the architecture export from the guide, and verify that the generic lookup still returns the same slugs and architecture objects.

## Handoff

Report the new slug and route, the data files/components changed, the source of truth used for metadata/content, and the validation results. Call out any assumptions in scale numbers or architecture choices. If the request is only for content planning, stop before editing code; if it asks to implement, complete the workflow above.
