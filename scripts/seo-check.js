#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, "..");
const siteUrl = "https://diagramwise.com";
const failed = [];

function read(relativePath) {
  return fs.readFileSync(path.join(projectDir, relativePath), "utf-8");
}

function check(description, condition, detail = "") {
  if (!condition) {
    failed.push(detail ? `${description}: ${detail}` : description);
  }
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function canonicalFor(route) {
  return route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;
}

const indexHtml = read("index.html");
const robots = read(path.join("public", "robots.txt"));
const sitemap = read(path.join("public", "sitemap.xml"));
const prerender = read("prerender.js");
const learningPaths = JSON.parse(
  read(path.join("public", "learning-paths", "learning-paths.json")),
);
const featuredProblems = JSON.parse(
  read(path.join("src", "data", "featuredProblems.json")),
);
const guideRoutes = [
  "/system-design-interview/",
  "/system-design-practice/",
  "/ai-system-design-interview/",
  "/kubernetes-architecture/",
];
const expectedRoutes = [
  "/",
  "/problems/",
  "/learning-paths/",
  ...guideRoutes,
  ...featuredProblems.map((problem) => `/problems/${problem.slug}/`),
  ...learningPaths.map(
    (learningPath) => `/learning-paths/${learningPath.slug}/`,
  ),
];
const expectedCanonicals = expectedRoutes.map(canonicalFor);
const sourceSitemapLocations = sitemapLocations(sitemap);

check(
  "Homepage has a descriptive title",
  /<title>[^<]{20,}<\/title>/i.test(indexHtml),
);
check(
  "Homepage has a meta description",
  /<meta\s+name="description"[\s\S]*?content="[^"]{70,}"[\s\S]*?\/>/i.test(
    indexHtml,
  ),
);
check(
  "Homepage has a self-referencing canonical",
  indexHtml.includes(`<link rel="canonical" href="${siteUrl}/" />`),
);
check(
  "Homepage exposes WebSite structured data",
  /"@type":\s*"WebSite"/.test(indexHtml),
);
check(
  "Homepage exposes WebApplication structured data",
  /"@type":\s*"WebApplication"/.test(indexHtml),
);
check(
  "Static route markers exist",
  indexHtml.includes("<!-- static-route:start -->") &&
    indexHtml.includes("<!-- static-route:end -->"),
);
check(
  "Static route fallback has a visible H1",
  /<div id="root">[\s\S]*?<h1>[^<]+<\/h1>/i.test(indexHtml),
);
check(
  "Static navigation uses crawlable links",
  indexHtml.includes('href="/problems/"') &&
    indexHtml.includes('href="/learning-paths/"'),
);
check(
  "Learning paths have a build-time data marker",
  indexHtml.includes(
    '<script id="learning-paths-data" type="application/json">',
  ),
);
check(
  "Search-only hidden content was removed",
  !indexHtml.includes('id="seo-content"'),
);
check(
  "Off-screen SEO positioning was removed",
  !/left:\s*-9999/i.test(indexHtml),
);
check(
  "Global inaccurate breadcrumb data was removed",
  !indexHtml.includes("BreadcrumbList"),
);

const sitemapLines = robots.match(/^Sitemap:/gm) || [];
check(
  "robots.txt declares one sitemap",
  sitemapLines.length === 1,
  `found ${sitemapLines.length}`,
);
check(
  "robots.txt allows public JSON rendering data",
  !/Disallow:\s*\/\*\.json\$/i.test(robots),
);
check("robots.txt does not advertise fragment routes", !robots.includes("/#/"));
check(
  "robots.txt avoids unsupported crawl-delay directives",
  !/^Crawl-delay:/im.test(robots),
);

check(
  "Sitemap contains no fragment URLs",
  sourceSitemapLocations.every((url) => !url.includes("#")),
);
check(
  "Sitemap contains no private utility routes",
  sourceSitemapLocations.every(
    (url) => !/\/(diagrams|create-problem|verify-email|playground)\//.test(url),
  ),
);
check(
  "Sitemap uses trailing-slash canonicals",
  sourceSitemapLocations.every((url) => url.endsWith("/")),
);
check(
  "Source sitemap contains the core discovery routes",
  ["/", "/problems/", "/learning-paths/"].every((route) =>
    sourceSitemapLocations.includes(canonicalFor(route)),
  ),
);

check(
  "Prerender escapes content from data files",
  prerender.includes("function escapeHtml"),
);
check(
  "Prerender replaces visible static markers",
  prerender.includes("static-route:start") &&
    prerender.includes("renderStaticRoute"),
);
check(
  "Prerender writes route-level structured data",
  prerender.includes('id="route-structured-data"'),
);
check(
  "Prerender creates a static 404 response document",
  prerender.includes('path.join(distDir, "404.html")'),
);
check(
  "Prerender generates the deployment sitemap",
  prerender.includes("function writeSitemap"),
);

const distDir = path.join(projectDir, "dist");
if (fs.existsSync(distDir)) {
  for (const route of expectedRoutes) {
    const relativePath =
      route === "/"
        ? "index.html"
        : path.join(...route.split("/").filter(Boolean), "index.html");
    const builtPath = path.join(distDir, relativePath);
    const label = route === "/" ? "homepage" : route;

    check(`Built ${label} exists`, fs.existsSync(builtPath), builtPath);
    if (!fs.existsSync(builtPath)) continue;

    const builtHtml = fs.readFileSync(builtPath, "utf-8");
    check(
      `Built ${label} has visible route content`,
      /<div id="root">[\s\S]*?class="static-route-shell"[\s\S]*?<h1>[^<]+<\/h1>/i.test(
        builtHtml,
      ),
    );
    check(
      `Built ${label} has a self canonical`,
      builtHtml.includes(
        `<link rel="canonical" href="${canonicalFor(route)}" />`,
      ),
    );
    check(
      `Built ${label} has route structured data`,
      builtHtml.includes('id="route-structured-data"'),
    );
    check(
      `Built ${label} has no hidden SEO block`,
      !builtHtml.includes('id="seo-content"') &&
        !/left:\s*-9999/i.test(builtHtml),
    );
  }

  const learningIndex = fs.readFileSync(
    path.join(distDir, "learning-paths", "index.html"),
    "utf-8",
  );

  const embeddedLearningPaths = learningIndex.match(
    /<script\s+id="learning-paths-data"\s+type="application\/json">([\s\S]*?)<\/script>/i,
  );
  let embeddedPathCatalog = [];
  if (embeddedLearningPaths) {
    try {
      embeddedPathCatalog = JSON.parse(embeddedLearningPaths[1]);
    } catch {
      embeddedPathCatalog = [];
    }
  }
  check(
    "Built learning-path index embeds the path catalog",
    Array.isArray(embeddedPathCatalog) &&
      embeddedPathCatalog.length === learningPaths.length &&
      learningPaths.every((learningPath) =>
        embeddedPathCatalog.some(
          (embeddedPath) => embeddedPath?.slug === learningPath.slug,
        ),
      ),
  );

  const problemIndex = fs.readFileSync(
    path.join(distDir, "problems", "index.html"),
    "utf-8",
  );
  check(
    "Built problem index links every featured challenge",
    featuredProblems.every((problem) =>
      problemIndex.includes(`href="/problems/${problem.slug}/"`),
    ),
  );

  for (const problem of featuredProblems) {
    const problemHtml = fs.readFileSync(
      path.join(distDir, "problems", problem.slug, "index.html"),
      "utf-8",
    );
    check(
      `Built ${problem.slug} exposes learning-resource data`,
      problemHtml.includes('"@type":"LearningResource"'),
    );
    check(
      `Built ${problem.slug} exposes prerendered guide content`,
      ["guide-prompt", "guide-requirements", "guide-data-flow"].every(
        (sectionId) => problemHtml.includes(`id="${sectionId}"`),
      ),
    );
    check(
      `Built ${problem.slug} exposes related problem links`,
      problemHtml.includes('id="related-problems"'),
    );
  }

  for (const route of guideRoutes) {
    const guideHtml = fs.readFileSync(
      path.join(distDir, ...route.split("/").filter(Boolean), "index.html"),
      "utf-8",
    );
    check(
      `Built ${route} exposes article data`,
      guideHtml.includes('"@type":"Article"'),
    );
    check(
      `Built ${route} links concrete practice problems`,
      /href="\/problems\/[^"/]+\/"/.test(guideHtml),
    );
  }
  check(
    "Built learning-path index links every path",
    learningPaths.every((learningPath) =>
      learningIndex.includes(`href="/learning-paths/${learningPath.slug}/"`),
    ),
  );
  for (const learningPath of learningPaths) {
    const learningPathHtml = fs.readFileSync(
      path.join(
        distDir,
        "learning-paths",
        learningPath.slug,
        "index.html",
      ),
      "utf-8",
    );
    check(
      `Built ${learningPath.slug} exposes related problem links`,
      learningPathHtml.includes('id="related-problems"'),
    );
  }

  const notFoundPath = path.join(distDir, "404.html");
  check("Built 404.html exists", fs.existsSync(notFoundPath));
  if (fs.existsSync(notFoundPath)) {
    const notFoundHtml = fs.readFileSync(notFoundPath, "utf-8");
    check(
      "Built 404 is noindex",
      /<meta name="robots" content="noindex, follow"\s*\/>/.test(notFoundHtml),
    );
  }

  const builtSitemapPath = path.join(distDir, "sitemap.xml");
  check("Built sitemap exists", fs.existsSync(builtSitemapPath));
  if (fs.existsSync(builtSitemapPath)) {
    const builtLocations = sitemapLocations(
      fs.readFileSync(builtSitemapPath, "utf-8"),
    );
    check(
      "Built sitemap contains every versioned public route",
      expectedCanonicals.every((url) => builtLocations.includes(url)) &&
        builtLocations.every((url) => !url.includes("#")),
    );
  }
}

for (const description of failed) console.error(`FAIL  ${description}`);

process.exit(failed.length ? 1 : 0);
