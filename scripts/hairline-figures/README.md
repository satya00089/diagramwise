# Landing feature figures

The four original Diagramwise scenes match the user-approved animated preview (7 October 2026). `geometry.js` owns the shared fixed camera, shapes and interactions. The four small declarations select the scene. Existing asset names are kept for compatibility.

- Workbench: challenge brief and connected architecture; place the floating service.
- Switchback: four lesson booklets running upper-left to lower-right; open the selected cover.
- Inspection stack: architecture, attached feedback and a moving inspection lens.
- Drafting board: editor palette and empty workspace; place the first component.

All scenes use `Cam(45, 0.5, 1.6)` and identical framing. Motion is input-driven, sleeps offscreen, and respects reduced motion. Literal architecture components and the pointer cursor are intentional user-approved exceptions to the skill's abstract-metaphor guidance.

Run `npm run build:path-figures` from the application root. Commit both source and generated `public/path-figures` pages. No globally installed skill or npm dependency is required to rebuild.

`vendor/kernel.js` and `vendor/bench.html` are the unchanged Hairline skill engine and review host, used under the accompanying MIT license (Lucas Marques, https://github.com/lucasmarkes/hairline). No stock figures are used. The separate `embed.html` hosts the production drawing and accepts same-origin input only from its parent. The parent card retains all navigation and keyboard behavior.

The skill review pages remain available without embedding. The production host follows the landing-page theme and uses the approved preview's line contrast. Regeneration is deterministic; test with `node --test scripts/hairline-figures.test.mjs`.
