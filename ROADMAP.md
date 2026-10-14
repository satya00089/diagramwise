# Roadmap

Status as of 2026-10-14. Branch for the multi-canvas work: `feat/multi-canvas-foundation` (frontend and `diagrammatic-api`). Nothing on it is committed yet.

## Multi-canvas workspaces

A design or problem attempt is a **workspace**. Its tabs are **canvases** (up to 10 per workspace). Feature flag: `MULTI_CANVAS`.

### Done

- **Backend**
  - Canvas storage in the existing diagrams table, one item per canvas. Partition: design owner. Sort key: `{designId}#canvas#{canvasId}`. Items are marked `recordType: "canvas"`, and diagram lists skip them. No new table is needed.
  - Deleting a design also deletes its canvas items.
  - Endpoints under `/api/v1/diagrams/{id}/canvases`: list, create, get, save content, rename, reorder, duplicate, delete.
  - Version checks on content saves (a stale save returns 409).
  - Pre-multi-canvas designs appear as one canvas, "Main", whose ID equals the design ID. No data migration is needed.
  - The legacy `PUT /diagrams/{id}` syncs the primary canvas, and saves to the primary canvas mirror back into the diagram.
- **Frontend**
  - Canvas state lives in a controller, separate from React: it tracks versions, saves tabs in order, and refuses to switch away from unsaved edits.
  - All canvas management is in the toolbar's **Canvases** menu: switch, new canvas (with type), rename, duplicate, move left and right, and delete. The menu marks the primary canvas and the one you are on. The old floating switcher is removed.
  - Signed-out users see the Canvases menu with "Sign in to use canvases." Nothing is clickable.
  - Undo history resets on each canvas switch.
  - Each canvas has its own live-collaboration room. The design's first canvas keeps the design's room name.
  - Live collaboration is paused while a design has more than one canvas. Canvases stay usable. The Invite button explains why.
  - Toolbar is two columns. Left: zoom in, zoom out, fit view, lock. Right: Canvas actions, Auto layout, Canvases, Background.
  - Background menu (Dots, Lines, Cross, None). Lines keep a constant on-screen width at any zoom, and use a softer colour in light and dark mode.
- **Tests:** backend service, repository and route tests; frontend controller, room-naming, background, and toolbar-menu tests.

### Next (in rough order)

1. **Two-browser collaboration test** on per-canvas rooms, for a design with one canvas. Then decide when collaboration should resume for multi-canvas designs.
2. **Lift the collaboration pause** for multi-canvas designs once step 1 passes. Live tab-list sync is still missing (see below), so decide whether that is acceptable first. The rule is `collaborationPaused` in `SystemDesignPlayground.tsx`.
3. **Confirm the Canvases menu in each environment.** It shows on Design Studio whenever the flag is on. The flag is on by default in development and off in staging and production. Local override: `localStorage.setItem("feature-flag-multi-canvas", "true")`.
4. **Check the canvas items in the dev database.** Open an existing design after the change and confirm its canvas list loads. Also confirm that deleting a design removes its canvas items. The DynamoDB service changes have no unit tests yet.
5. **Problem mode:**
   - Tabs in problem attempts.
   - "Current canvas / All canvases" selector next to Run Assessment.
   - Assessment history records which canvases were scored.
   - The leaderboard does not mix scores from different scopes.
6. **Publishing:** the publish dialog chooses between the whole workspace (read-only, with tabs) and a single canvas. Public pages render tabs for workspace publications.
7. **MCP:** MCP-created designs become single-canvas workspaces. Decide whether MCP can also write to a named canvas.
8. **Live tab-list sync.** Collaborators currently see a new or deleted tab only after reloading. Needs a workspace-level sync channel.
9. **Per-canvas rooms for the non-Yjs fallback.** The socket fallback still uses one room per design, which is unsafe for multi-canvas. Until fixed, multi-canvas should stay off wherever Yjs is off.
10. **Yjs server review.** Check the room access rules for per-canvas room names before enabling collaboration broadly.
11. **Deleting a tab another user is editing.** Currently the other user gets a save error. Show a clearer message, and decide whether editors may delete tabs at all.
12. **Undo for deleted tabs.** Deletes are soft. Add a restore action and a purge job for old deleted canvases.
13. **Canvas switching shortcut,** for example Ctrl+PageUp and Ctrl+PageDown.
14. **Drag to reorder tabs.** Move left and move right work today.
15. **First-visit hint** pointing to the toolbar's Canvases menu.
16. **Analytics events** for canvas create, switch, delete, and duplicate.
17. **Accessibility review** of the Canvases and Background menus with a screen reader.
18. **Browser end-to-end tests** for the canvas workflow.

## Access

- **Pro gating:** canvases are usable by signed-in users only, controlled by `canUseCanvases` in `SystemDesignPlayground.tsx`. Signed-out users see the Canvases menu, disabled. Replace the check with a plan check when Pro lands.

## Storage limits

- **Compress canvas content before saving** (gzip, stored as binary). Estimated 3–6× smaller for real designs, which keeps a canvas well under DynamoDB's 400 KB item limit.
- **Warn before the limit.** Show a notice near 75% of the item size.
- **Per-canvas product limits,** for example 1,000 nodes and 2,000 connections, with a warning near 80%.
- **Overflow to S3** only if measurements show canvases still exceed the limit after compression.
- **Slim the saved node data** by dropping React Flow runtime fields (`width`, `height`, `selected`, `dragging`, `positionAbsolute`) before saving.

## Decisions still open

- Should background preference be per design or per browser? It is per browser today.
- Should editors (not only owners) be allowed to delete canvases?
- Should dots and cross patterns also use the zoom-corrected sizing? Only lines use it today.

## Known issues outside this work

- Three backend tests fail on `develop` as well: `test_all_current_public_candidates_have_valid_replay_graphs`, and two in `test_recommendations.py`.
- `isFeatureEnabled` is called without an environment in several places, so those flags always use the development defaults. Multi-canvas now passes the build mode. The collaboration flag (`YJS_COLLABORATION`) still does not.
- `create-attempts-table.ps1` at the repository root creates a table named `diagrammatic-attempts` with key `(userId, id)`. The running code uses `diagrammatic_problem_attempts` with key `(userId, problemId)`. Check the deployed table before relying on the script.
