/**
 * Builds visible, route-specific HTML for public acquisition pages.
 * The React application replaces this static snapshot after it loads.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");
const siteUrl = "https://diagramwise.com";
const staticStart = "<!-- static-route:start -->";
const staticEnd = "<!-- static-route:end -->";

const routes = {
  "/": {
    title: "Diagramwise — Design architectures. Get them reviewed.",
    heading: "Design architectures. Get them reviewed.",
    description:
      "Practice system design by building architectures visually, explaining assumptions, and getting structured feedback on scalability, reliability, data design, and trade-offs.",
    keywords:
      "system design, architecture diagram, system design interview, distributed systems, system design practice",
    image: `${siteUrl}/og/home.png`,
    imageAlt: "Diagramwise homepage preview",
    sectionTitle: "Build the reasoning behind the diagram",
    actions: [
      { label: "Choose a challenge", href: "/problems/" },
      { label: "Follow a learning path", href: "/learning-paths/" },
    ],
    items: [
      {
        title: "Practice realistic systems",
        description: "Work from requirements, constraints, and scale targets.",
      },
      {
        title: "Explain your decisions",
        description:
          "Capture assumptions, connections, and architectural trade-offs.",
      },
      {
        title: "Review the architecture",
        description: "See strengths, risks, and practical improvements.",
      },
      {
        title: "Learn step by step",
        description:
          "Study system design foundations through structured paths.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: true,
  },
  "/landing-3d": {
    title: "Diagramwise — Design systems. Understand every decision.",
    heading: "Design systems. Understand every decision.",
    description:
      "Practice system design on a visual canvas. Build an architecture, explain your trade-offs, review your assumptions, and improve your next iteration.",
    keywords:
      "system design, system design practice, architecture diagram, software architecture, distributed systems, architecture trade-offs, system design interview",
    image: `${siteUrl}/og/home.png`,
    imageAlt: "Diagramwise system design walkthrough preview",
    sectionTitle: "Build, review, and improve your architecture",
    actions: [
      { label: "Start designing", href: "/problems/" },
      { label: "Explore learning paths", href: "/learning-paths/" },
    ],
    items: [
      {
        title: "Make the request path visible",
        description:
          "Start with a clear architecture and show how each component connects.",
      },
      {
        title: "Explain the trade-offs",
        description:
          "Review assumptions around scale, reliability, latency, and data design.",
      },
      {
        title: "Improve the next iteration",
        description:
          "Turn structured feedback into a stronger design you can defend.",
      },
    ],
    lastmod: "2026-09-09",
    indexable: true,
  },
  "/problems": {
    title: "System Design & AI/ML Practice Problems | Diagramwise",
    heading: "System Design & AI/ML Problems",
    description:
      "Practice infrastructure, application, AI/ML, and MLOps architecture problems with clear requirements, interactive diagrams, and feedback on the decisions behind your design.",
    keywords:
      "system design problems, AI ML architecture, MLOps, distributed systems, system design interview practice",
    image: `${siteUrl}/og/problems.png`,
    imageAlt: "Diagramwise practice problems preview",
    sectionTitle: "Choose the architecture skills you want to test",
    actions: [
      { label: "Open the design studio", href: "/playground/free/" },
      { label: "Build fundamentals first", href: "/learning-paths/" },
    ],
    items: [
      {
        title: "Distributed systems",
        description: "Scaling, reliability, consistency, and failure handling.",
      },
      {
        title: "Infrastructure",
        description: "Caching, queues, search, storage, and observability.",
      },
      {
        title: "Applications",
        description: "Real product scenarios with concrete requirements.",
      },
      {
        title: "AI & ML systems",
        description: "Inference, retrieval, MLOps, and model operations.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: true,
  },
  "/learning-paths": {
    title: "Learning Paths | Diagramwise",
    heading: "Learning Paths",
    description:
      "Follow curated sequences of modules and lessons that teach system design from first principles to advanced patterns.",
    keywords:
      "system design learning path, system design tutorial, system architecture learning",
    image: `${siteUrl}/og/learning-paths.png`,
    imageAlt: "Diagramwise learning paths preview",
    sectionTitle: "Browse system design paths",
    actions: [{ label: "Practice a challenge", href: "/problems/" }],
    items: [],
    lastmod: "2026-08-23",
    indexable: true,
  },
  "/system-design-interview": {
    title: "System Design Interview Guide & Practice Questions | Diagramwise",
    heading: "System Design Interview Guide",
    description:
      "Prepare for system design interviews by turning ambiguous prompts into requirements, estimates, architecture decisions, and defensible trade-offs.",
    keywords:
      "system design interview, system design interview questions, architecture interview practice",
    image: `${siteUrl}/og/problems.png`,
    imageAlt: "System design interview practice on Diagramwise",
    sectionTitle: "A repeatable interview method",
    actions: [{ label: "Choose a practice problem", href: "/problems/" }],
    items: [
      {
        title: "Clarify the problem",
        description:
          "Identify users, core use cases, non-goals, and quality attributes.",
      },
      {
        title: "Estimate the system",
        description:
          "Use rough traffic, storage, throughput, and latency estimates.",
      },
      {
        title: "Draw the critical path",
        description: "Start with the simplest end-to-end flow.",
      },
      {
        title: "Defend the trade-offs",
        description:
          "Explain why each major component exists and what it costs.",
      },
      {
        title: "Test failure and scale",
        description:
          "Walk through overload, partial failure, recovery, and consistency.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: true,
    kind: "article",
  },
  "/system-design-practice": {
    title:
      "System Design Practice Online with Architecture Feedback | Diagramwise",
    heading: "System Design Practice",
    description:
      "Practice system design online with realistic prompts, an interactive architecture canvas, explicit trade-offs, and structured review.",
    keywords:
      "system design practice, system design practice online, architecture practice",
    image: `${siteUrl}/og/problems.png`,
    imageAlt: "Online system design practice on Diagramwise",
    sectionTitle: "A deliberate practice loop",
    actions: [{ label: "Browse practice problems", href: "/problems/" }],
    items: [
      {
        title: "Choose one narrow prompt",
        description: "Match the challenge to the skill you want to isolate.",
      },
      {
        title: "Time-box clarification",
        description:
          "Write requirements, assumptions, and success criteria first.",
      },
      {
        title: "Build and annotate",
        description: "Label flows and record why every major component exists.",
      },
      {
        title: "Review the architecture",
        description: "Capture weaknesses before changing the diagram.",
      },
      {
        title: "Repeat the weak dimension",
        description:
          "Choose the next problem around the bottleneck you missed.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: true,
    kind: "article",
  },
  "/ai-system-design-interview": {
    title: "AI System Design Interview Questions & Practice | Diagramwise",
    heading: "AI System Design Interview",
    description:
      "Practice AI and ML system design across data pipelines, retrieval, inference, evaluation, monitoring, latency, reliability, and cost trade-offs.",
    keywords:
      "AI system design interview, ML system design, RAG system design, LLM interview questions",
    image: `${siteUrl}/og/problems.png`,
    imageAlt: "AI system design interview practice on Diagramwise",
    sectionTitle: "Connect the offline and online paths",
    actions: [
      { label: "Browse AI and ML problems", href: "/problems/" },
      { label: "Study the foundations", href: "/learning-paths/" },
    ],
    items: [
      {
        title: "Define product behavior",
        description:
          "State what the model produces and how quality is measured.",
      },
      {
        title: "Separate offline and online",
        description:
          "Show ingestion, preparation, deployment, inference, and feedback.",
      },
      {
        title: "Budget latency, quality, and cost",
        description: "Make the serving trade-offs explicit.",
      },
      {
        title: "Design evaluation and observability",
        description: "Track data quality, drift, failures, and user impact.",
      },
      {
        title: "Plan degradation and rollback",
        description:
          "Explain how the product behaves when an AI dependency fails.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: true,
    kind: "article",
  },
  "/kubernetes-architecture": {
    title:
      "Kubernetes Architecture Guide: Components, Diagrams & Practice | Diagramwise",
    heading: "Kubernetes Architecture Guide",
    description:
      "Learn how Kubernetes control-plane, workload, networking, storage, and observability components fit together, then practice explaining the trade-offs in an architecture diagram.",
    keywords:
      "kubernetes architecture, kubernetes architecture diagram, kubernetes system design, kubernetes components, kubernetes cluster architecture",
    image: `${siteUrl}/og/problems.png`,
    imageAlt: "Kubernetes architecture practice on Diagramwise",
    sectionTitle: "Build a Kubernetes architecture you can explain",
    actions: [{ label: "Browse practice problems", href: "/problems/" }],
    items: [
      {
        title: "Start with the workload boundary",
        description:
          "Use Deployments, StatefulSets, or Jobs according to how the workload runs and stores state.",
      },
      {
        title: "Make traffic explicit",
        description:
          "Trace Ingress, Service, and Pod routing, including the policy boundaries that protect it.",
      },
      {
        title: "Separate control from data paths",
        description:
          "Show how the API server, scheduler, controllers, and etcd reconcile declared state.",
      },
      {
        title: "Plan state and configuration",
        description:
          "Use persistent storage, configuration, and secrets with an explicit recovery boundary.",
      },
      {
        title: "Design for operations",
        description:
          "Include readiness, scaling, observability, and a safe rollout strategy.",
      },
    ],
    lastmod: "2026-08-30",
    indexable: true,
    kind: "article",
  },
  "/playground/free": {
    title: "Design Studio | Diagramwise",
    heading: "Design Studio",
    description:
      "Create an architecture diagram from scratch with generic, cloud, UML, and entity-relationship components.",
    keywords: "architecture diagram tool, system design canvas, cloud diagram",
    image: `${siteUrl}/og/playground.png`,
    imageAlt: "Diagramwise design studio preview",
    sectionTitle: "Start with the building blocks you need",
    actions: [
      { label: "Choose a guided challenge", href: "/problems/" },
      { label: "Learn system design", href: "/learning-paths/" },
    ],
    items: [
      {
        title: "Architecture components",
        description: "Services, data stores, queues, caches, and networks.",
      },
      {
        title: "Cloud providers",
        description: "AWS, Azure, and GCP components in one canvas.",
      },
      {
        title: "Document decisions",
        description: "Add labels, descriptions, properties, and data flows.",
      },
      {
        title: "Export and share",
        description: "Save a design or export it in common formats.",
      },
    ],
    lastmod: "2026-08-23",
    indexable: false,
  },
};

const legacyLandingRoute = routes["/"];
routes["/"] = { ...routes["/landing-3d"], lastmod: "2026-09-10" };
routes["/landing-3d"] = {
  ...routes["/landing-3d"],
  indexable: false,
};
routes["/landing-backup"] = {
  ...legacyLandingRoute,
  indexable: false,
};

const notFoundRoute = {
  title: "Page Not Found | Diagramwise",
  heading: "This page could not be found",
  description:
    "The Diagramwise page you requested does not exist or may have moved.",
  keywords: "",
  image: `${siteUrl}/og/home.png`,
  imageAlt: "Diagramwise",
  sectionTitle: "Continue exploring Diagramwise",
  actions: [
    { label: "Browse practice problems", href: "/problems/" },
    { label: "Go to the homepage", href: "/" },
  ],
  items: [
    {
      title: "Learning paths",
      description: "Build system design knowledge from first principles.",
      href: "/learning-paths/",
    },
    {
      title: "Design studio",
      description: "Open a blank architecture canvas.",
      href: "/playground/free/",
    },
  ],
  indexable: false,
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function canonicalUrl(route) {
  return route === "/" || route === "/landing-3d"
    ? `${siteUrl}/`
    : `${siteUrl}${route}/`;
}

function itemMarkup(item) {
  const title = item.href
    ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>`
    : `<strong>${escapeHtml(item.title)}</strong>`;

  return `<li>${title}<span>${escapeHtml(item.description)}</span></li>`;
}

function guideListMarkup(items, className = "static-route-list") {
  return `<ul class="${className}">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function guideSectionMarkup(id, title, content) {
  return `<section class="static-route-section static-route-guide-section" id="${id}">
    <h2>${escapeHtml(title)}</h2>
    ${content}
  </section>`;
}

function renderGuideContent(guide) {
  if (!guide) return "";

  const requirements = [
    ...(guide.requirements?.functional || []),
    ...(guide.requirements?.nonFunctional || []),
    ...(guide.requirements?.scaleAssumptions || []),
  ];
  const metrics = (guide.requirements?.metrics || []).map(
    (metric) => `${metric.label}: ${metric.value} — ${metric.description}`,
  );
  const entities = (guide.entities || [])
    .map(
      (entity) =>
        `<li><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(
          entity.fields.join(", "),
        )}</span><p>${escapeHtml(entity.notes)}</p></li>`,
    )
    .join("");
  const dataFlow = (guide.dataFlow || [])
    .map(
      (step, index) =>
        `<li><strong>${index + 1}. ${escapeHtml(
          step.title,
        )}</strong><span>${escapeHtml(step.description)}</span></li>`,
    )
    .join("");
  const deepDives = (guide.deepDives || [])
    .map(
      (dive) =>
        `<li><strong>${escapeHtml(dive.title)}</strong><span>${escapeHtml(
          dive.points.join(" "),
        )}</span></li>`,
    )
    .join("");
  const tradeoffs = (guide.tradeoffs || [])
    .map(
      (tradeoff) =>
        `<li><strong>${escapeHtml(tradeoff.title)}</strong><span>${escapeHtml(
          tradeoff.recommendation,
        )} ${escapeHtml(tradeoff.caution)}</span></li>`,
    )
    .join("");

  return `<div class="static-route-guide" aria-label="System design guide">
    ${guideSectionMarkup(
      "guide-prompt",
      "Interview prompt",
      `<p>${escapeHtml(guide.prompt?.brief || "")}</p>${guideListMarkup(
        guide.prompt?.successSignals || [],
      )}`,
    )}
    ${guideSectionMarkup(
      "guide-requirements",
      "Requirements and scale assumptions",
      `${guideListMarkup(requirements)}${guideListMarkup(metrics)}`,
    )}
    ${guideSectionMarkup(
      "guide-entities",
      "Key entities",
      `<ul class="static-route-list">${entities}</ul>`,
    )}
    ${guideSectionMarkup(
      "guide-data-flow",
      "Data flow",
      `<ol class="static-route-list">${dataFlow}</ol>`,
    )}
    ${guideSectionMarkup(
      "guide-deep-dives",
      "Deep dives and trade-offs",
      `<ul class="static-route-list">${deepDives}${tradeoffs}</ul>`,
    )}
  </div>`;
}

function renderStaticRoute(data) {
  const actions = data.actions
    .map(
      (action) =>
        `<a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`,
    )
    .join("");
  const items = data.items.map(itemMarkup).join("");

  return `
    <div class="static-route-shell">
      <header class="static-route-header">
        <a class="static-route-brand" href="/">
          <img src="/logo-64.png" alt="" width="28" height="28">
          <span>Diagramwise</span>
        </a>
        <nav class="static-route-nav" aria-label="Main navigation">
          <a href="/problems/">Practice problems</a>
          <a href="/learning-paths/">Learning paths</a>
        </nav>
      </header>
      <main class="static-route-main">
        <section class="static-route-hero">
          <h1>${escapeHtml(data.heading)}</h1>
          <p>${escapeHtml(data.description)}</p>
          <div class="static-route-actions">${actions}</div>
        </section>
        <section class="static-route-section" id="route-content">
          <h2>${escapeHtml(data.sectionTitle)}</h2>
          <ul class="static-route-list">${items}</ul>
        </section>
        ${renderGuideContent(data.guide)}
      </main>
      <footer class="static-route-footer">
        Diagramwise — system design practice and architecture review.
      </footer>
    </div>`;
}

function breadcrumbsFor(route, title) {
  if (route === "/") return [];

  const crumbs = [{ name: "Home", item: `${siteUrl}/` }];
  if (route.startsWith("/learning-paths")) {
    crumbs.push({ name: "Learning Paths", item: `${siteUrl}/learning-paths/` });
  } else if (route === "/problems") {
    crumbs.push({ name: "Practice Problems", item: canonicalUrl(route) });
  } else if (route.startsWith("/problems/")) {
    crumbs.push({ name: "Practice Problems", item: `${siteUrl}/problems/` });
  } else {
    crumbs.push({
      name: title.replace(" | Diagramwise", ""),
      item: canonicalUrl(route),
    });
  }

  if (route.startsWith("/learning-paths/") && route !== "/learning-paths") {
    crumbs.push({
      name: title.replace(" | Diagramwise", ""),
      item: canonicalUrl(route),
    });
  }

  if (route.startsWith("/problems/") && route !== "/problems") {
    crumbs.push({
      name: title.replace(" | Diagramwise", ""),
      item: canonicalUrl(route),
    });
  }

  return crumbs;
}

function routeStructuredData(route, data) {
  const graph = [
    {
      "@type": "WebPage",
      "@id": canonicalUrl(route),
      url: canonicalUrl(route),
      name: data.title,
      description: data.description,
      isPartOf: {
        "@type": "WebSite",
        url: `${siteUrl}/`,
        name: "Diagramwise",
      },
      mainEntityOfPage: canonicalUrl(route),
    },
  ];
  const crumbs = breadcrumbsFor(route, data.title);

  if (crumbs.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.item,
      })),
    });
  }

  if (data.kind === "learning-resource") {
    graph.push({
      "@type": "LearningResource",
      name: data.heading,
      description: data.description,
      url: canonicalUrl(route),
      educationalLevel: data.problem?.difficulty,
      teaches: Array.isArray(data.problem?.tags) ? data.problem.tags : [],
      timeRequired: data.problem?.estimated_time,
      dateModified: data.lastmod,
      provider: {
        "@type": "Organization",
        name: "Diagramwise",
        url: `${siteUrl}/`,
      },
    });
  } else if (data.kind === "article") {
    graph.push({
      "@type": "Article",
      headline: data.heading,
      description: data.description,
      url: canonicalUrl(route),
      publisher: {
        "@type": "Organization",
        name: "Diagramwise",
        url: `${siteUrl}/`,
      },
    });
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replaceAll("<", String.raw`\u003c`);
}

function replaceMeta(html, attribute, name, content) {
  const pattern = new RegExp(
    String.raw`<meta\s+${attribute}="${name}"[\s\S]*?\/?>`,
    "i",
  );
  return html.replace(
    pattern,
    `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`,
  );
}

function renderHtml(baseHtml, route, data) {
  const canonical = canonicalUrl(route);
  const robots = data.indexable
    ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    : "noindex, follow";
  let html = baseHtml;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(data.title)}</title>`,
  );
  html = replaceMeta(html, "name", "title", data.title);
  html = replaceMeta(html, "name", "description", data.description);
  html = replaceMeta(html, "name", "keywords", data.keywords);
  html = replaceMeta(html, "name", "robots", robots);
  html = replaceMeta(html, "property", "og:title", data.title);
  html = replaceMeta(html, "property", "og:description", data.description);
  html = replaceMeta(html, "property", "og:image", data.image);
  html = replaceMeta(html, "property", "og:image:alt", data.imageAlt);
  html = replaceMeta(html, "property", "og:url", canonical);
  html = replaceMeta(html, "name", "twitter:title", data.title);
  html = replaceMeta(html, "name", "twitter:description", data.description);
  html = replaceMeta(html, "name", "twitter:image", data.image);
  html = replaceMeta(html, "name", "twitter:image:alt", data.imageAlt);
  html = replaceMeta(html, "name", "twitter:url", canonical);
  html = html.replace(
    /<link\s+rel="canonical"[\s\S]*?\/>/i,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = html.replace(
    new RegExp(String.raw`${staticStart}[\s\S]*?${staticEnd}`),
    `${staticStart}${renderStaticRoute(data)}${staticEnd}`,
  );
  if (route === "/learning-paths" && Array.isArray(data.initialData)) {
    const embeddedData = JSON.stringify(data.initialData).replaceAll(
      "<",
      String.raw`\u003c`,
    );
    html = html.replace(
      /(<script\s+id="learning-paths-data"\s+type="application\/json">)[\s\S]*?(<\/script>)/i,
      `$1${embeddedData}$2`,
    );
  }
  html = html.replace(
    "</head>",
    `    <script id="route-structured-data" type="application/ld+json">${routeStructuredData(route, data)}</script>\n  </head>`,
  );

  return html;
}

function loadLearningPaths() {
  const learningPathFile = path.join(
    distDir,
    "learning-paths",
    "learning-paths.json",
  );
  if (!fs.existsSync(learningPathFile)) return [];

  const parsed = JSON.parse(fs.readFileSync(learningPathFile, "utf-8"));
  return Array.isArray(parsed) ? parsed : [];
}

function loadFeaturedProblems() {
  const featuredPath = path.join(
    __dirname,
    "src",
    "data",
    "featuredProblems.json",
  );
  if (!fs.existsSync(featuredPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(featuredPath, "utf-8"));
  return Array.isArray(parsed) ? parsed : [];
}

function fallbackProblemSlug(title = "") {
  return title
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll("’", "")
    .replaceAll("'", "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}

function loadGuideAliases(source, relativePath, imports, aliases, guides) {
    const objectStart = source.indexOf(
      relativePath.includes("materialized")
        ? "materializedProblemGuides ="
        : "PROBLEM_GUIDES:",
    );
    const objectSource = objectStart >= 0 ? source.slice(objectStart) : source;
    for (const match of objectSource.matchAll(/"([^"]+)"\s*:\s*(\w+)/g)) {
      const importedName = aliases.get(match[2]) || match[2];
      const fileName = imports.get(importedName);
      if (!fileName) continue;
      const guidePath = path.join(
        __dirname,
        "src",
        "data",
        "public",
        "problemGuides",
        fileName,
      );
      if (fs.existsSync(guidePath)) {
        guides.set(match[1], JSON.parse(fs.readFileSync(guidePath, "utf-8")));
      }
    }
}

function loadGuideCatalog() {
  const files = [
    "src/data/problemGuides.ts",
    "src/data/materializedProblemGuides.ts",
  ];
  const imports = new Map();
  const aliases = new Map();
  const guides = new Map();

  const guideDirectory = path.join(
    __dirname,
    "src",
    "data",
    "public",
    "problemGuides",
  );
  for (const file of fs.readdirSync(guideDirectory)) {
    if (!file.endsWith(".json")) continue;
    guides.set(
      path.basename(file, ".json"),
      JSON.parse(fs.readFileSync(path.join(guideDirectory, file), "utf-8")),
    );
  }

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
    for (const match of source.matchAll(
      /import\s+(\w+)\s+from\s+"\.\/public\/problemGuides\/([^"]+)"/g,
    ))
      imports.set(match[1], match[2]);
    for (const match of source.matchAll(
      /const\s+(\w+)\s*=\s*(\w+)\s+as\s+ProblemGuide/g,
    ))
      aliases.set(match[1], match[2]);

    loadGuideAliases(source, relativePath, imports, aliases, guides);
  }
  return guides;
}

function problemSeoTitle(title) {
  const suffix = " | System Design Guide";
  const available = 60 - suffix.length;
  const candidate = title.trim().slice(0, available);
  const shortened =
    candidate.length < title.trim().length
      ? candidate.slice(0, candidate.lastIndexOf(" "))
      : candidate;
  return `${shortened}${suffix}`;
}

async function loadLiveProblems() {
  const apiUrl =
    process.env.VITE_API_URL || process.env.VITE_ASSESSMENT_API_URL;
  if (!apiUrl || /localhost|127\.0\.0\.1/.test(apiUrl)) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/v1/all-problems`,
      {
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`catalog returned ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Using the versioned problem catalog: ${error.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function mergeProblemCatalogs(featured, live) {
  const featuredByTitle = new Map(
    featured.map((problem) => [problem.title, problem]),
  );
  const merged = live.length
    ? [
        ...live.map((problem) => ({
          ...featuredByTitle.get(problem.title),
          ...problem,
        })),
        ...featured,
      ]
    : [...featured];

  const normalized = merged
    .filter((problem) => problem?.title && problem?.description)
    .map((problem) => ({
      ...problem,
      slug:
        problem.slug ||
        featuredByTitle.get(problem.title)?.slug ||
        fallbackProblemSlug(problem.title),
      tags: Array.isArray(problem.tags) ? problem.tags : [],
      requirements: Array.isArray(problem.requirements)
        ? problem.requirements
        : [],
      constraints: Array.isArray(problem.constraints)
        ? problem.constraints
        : [],
    }));

  return [
    ...new Map(normalized.map((problem) => [problem.slug, problem])).values(),
  ];
}

function addProblemRoutes(problems, guideCatalog) {
  routes["/problems"].items = problems.map((problem) => ({
    title: problem.title,
    description: `${problem.difficulty || "All levels"} · ${problem.estimated_time || "Self-paced"}`,
    href: `/problems/${problem.slug}/`,
  }));

  for (const problem of problems) {
    const requirements = problem.requirements
      .slice(0, 8)
      .map((requirement) => ({
        title: requirement,
        description: "Requirement",
      }));
    const concepts = problem.tags.slice(0, 8).map((tag) => ({
      title: tag.replaceAll("-", " "),
      description: "Concept to explore",
    }));
    const route = `/problems/${problem.slug}`;

    routes[route] = {
      title: `${problem.title} — System Design Interview Practice | Diagramwise`,
      heading: `${problem.title} — System Design Interview Practice`,
      description: `${problem.description} Work through the requirements, architecture trade-offs, and an interactive design review.`,
      keywords: `${problem.title}, system design interview question, ${problem.tags.join(", ")}`,
      image: `${siteUrl}/og/problems.png`,
      imageAlt: `${problem.title} practice challenge`,
      sectionTitle: requirements.length
        ? "Requirements and concepts to consider"
        : "Concepts and architecture decisions to consider",
      actions: [
        {
          label: "Open this challenge",
          href: `/problems/?q=${encodeURIComponent(problem.title)}`,
        },
        {
          label: "Read the interview guide",
          href: "/system-design-interview/",
        },
      ],
      items: [...requirements, ...concepts],
      lastmod: "2026-08-23",
      indexable: true,
      kind: "learning-resource",
      problem,
      guide: guideCatalog.get(problem.slug),
    };
    routes[route].title = problemSeoTitle(problem.title);
  }
}

function addLearningPathRoutes(learningPaths) {
  routes["/learning-paths"].initialData = learningPaths.map((learningPath) => ({
    id: learningPath.id,
    slug: learningPath.slug,
    title: learningPath.title,
    summary: learningPath.summary,
    difficulty: learningPath.difficulty,
    tags: Array.isArray(learningPath.tags) ? learningPath.tags : [],
    modules: Array.isArray(learningPath.modules)
      ? learningPath.modules.map((module) => ({
          id: module.id,
          title: module.title,
          order: module.order,
          lessons: Array.isArray(module.lessons)
            ? module.lessons.map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
              }))
            : [],
        }))
      : [],
  }));

  routes["/learning-paths"].items = learningPaths.map((learningPath) => {
    const modules = Array.isArray(learningPath.modules)
      ? learningPath.modules
      : [];
    const lessonCount = modules.reduce(
      (total, module) =>
        total + (Array.isArray(module.lessons) ? module.lessons.length : 0),
      0,
    );

    return {
      title: learningPath.title || learningPath.slug,
      description: `${learningPath.difficulty || "All levels"} · ${modules.length} modules · ${lessonCount} lessons`,
      href: `/learning-paths/${learningPath.slug}/`,
    };
  });

  for (const learningPath of learningPaths) {
    if (!learningPath?.slug) continue;

    const modules = Array.isArray(learningPath.modules)
      ? learningPath.modules
      : [];
    const route = `/learning-paths/${learningPath.slug}`;
    routes[route] = {
      title: `${learningPath.title || learningPath.slug} | Diagramwise`,
      heading: learningPath.title || learningPath.slug,
      description:
        learningPath.summary ||
        `Learn ${learningPath.title || learningPath.slug} through structured modules and exercises.`,
      keywords: Array.isArray(learningPath.tags)
        ? learningPath.tags.join(", ")
        : "system design learning path",
      image: `${siteUrl}/og/learning-path.png`,
      imageAlt: `${learningPath.title || learningPath.slug} learning path preview`,
      sectionTitle: "Modules in this learning path",
      actions: [
        { label: "Browse all learning paths", href: "/learning-paths/" },
        { label: "Practice a challenge", href: "/problems/" },
      ],
      items: modules.map((module) => ({
        title: module.title || "Untitled module",
        description: `${Array.isArray(module.lessons) ? module.lessons.length : 0} lessons`,
      })),
      lastmod: "2026-08-23",
      indexable: true,
    };
  }
}

function outputPathFor(route) {
  if (route === "/") return indexPath;
  const routeDir = path.join(distDir, ...route.split("/").filter(Boolean));
  fs.mkdirSync(routeDir, { recursive: true });
  return path.join(routeDir, "index.html");
}

function writeSitemap() {
  const urls = Object.entries(routes)
    .filter(([, data]) => data.indexable)
    .map(
      ([route, data]) => `  <url>
    <loc>${canonicalUrl(route)}</loc>
    <lastmod>${data.lastmod}</lastmod>
  </url>`,
    )
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf-8");
}

if (!fs.existsSync(indexPath)) {
  console.error('Dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

const learningPaths = loadLearningPaths();
addLearningPathRoutes(learningPaths);
const featuredProblems = loadFeaturedProblems();
const liveProblems = await loadLiveProblems();
const publicProblems = mergeProblemCatalogs(featuredProblems, liveProblems);
addProblemRoutes(publicProblems, loadGuideCatalog());
const baseHtml = fs.readFileSync(indexPath, "utf-8");

for (const [route, data] of Object.entries(routes)) {
  const outputPath = outputPathFor(route);
  fs.writeFileSync(outputPath, renderHtml(baseHtml, route, data), "utf-8");
}

fs.writeFileSync(
  path.join(distDir, "404.html"),
  renderHtml(baseHtml, "/404", notFoundRoute),
  "utf-8",
);

// GitHub Pages serves nested application routes as static files. Keep the
// authenticated entry points available for OAuth/signup links while React
// takes over the route and renders the interactive experience.
for (const route of ["/auth", "/auth/callback", "/verify-email"]) {
  fs.copyFileSync(indexPath, outputPathFor(route));
}

writeSitemap();
