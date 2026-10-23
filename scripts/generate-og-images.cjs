#!/usr/bin/env node
/**
 * Generates OG images (PNG) for social sharing, written to public/og/.
 * PNG is what og:image / twitter:image must point to — most crawlers
 * (Facebook, LinkedIn, Slack, X, iMessage, Discord) do not render SVG previews.
 * Each image is built as an SVG string in-memory, then rasterized — nothing
 * else references the SVG, so it's never written to disk.
 * Run: node scripts/generate-og-images.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const outDir = path.join(__dirname, "..", "public", "og");
const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 84;
const TEXT_COL_WIDTH = 580; // keep clear of the illustration column starting at x=660

const LOGO_B64 = fs
  .readFileSync(path.join(__dirname, "..", "public", "logo.png"))
  .toString("base64");
const LOGO_DATA_URI = `data:image/png;base64,${LOGO_B64}`;

const PAGES = [
  {
    name: "home",
    title: ["Build better", "system design", "playgrounds."],
    subtitle: "Design, validate, and share production-ready ideas.",
    badges: ["1k+ components", "AI review", "Learning paths"],
    colorA: "#0891b2",
    colorB: "#14b8a6",
    bg: ["#f7fdfc", "#e6f7f4"],
    file: "diagram.json",
    card: ["Design canvas", "Drag & drop components"],
  },
  {
    name: "playground",
    title: ["Design in the", "playground."],
    subtitle:
      "Compose components, routes, and constraints in a live workspace.",
    badges: ["Drag", "Connect", "Export"],
    colorA: "#0ea5a8",
    colorB: "#2563eb",
    bg: ["#f7fdfd", "#eaf3ff"],
    file: "canvas.json",
    card: ["Live canvas", "Real-time editing"],
  },
  {
    name: "problems",
    title: ["Practice system", "design problems."],
    subtitle: "Curated challenges for system design trade-offs.",
    badges: ["140+ problems"],
    colorA: "#0ea5a8",
    colorB: "#06b6d4",
    bg: ["#f7fdfd", "#e6f9fb"],
    file: "rubric.yaml",
    card: ["Practice set", "140+ challenges"],
  },
  {
    name: "diagrams",
    title: ["My design", "workspace."],
    subtitle: "Organize, revisit, and share your saved diagrams.",
    badges: ["Saved", "Shared", "Archived"],
    colorA: "#2563eb",
    colorB: "#14b8a6",
    bg: ["#f7fbff", "#eaf2ff"],
    file: "designs.json",
    card: ["My diagrams", "Saved & organized"],
  },
  {
    name: "create-problem",
    title: ["Create better", "practice", "problems."],
    subtitle: "Define constraints, hints, and grading criteria.",
    badges: ["Prompts", "Rubrics", "Constraints"],
    colorA: "#c026d3",
    colorB: "#f97316",
    bg: ["#fdf7ff", "#fff1e8"],
    file: "problem.yaml",
    card: ["Problem builder", "Custom rubrics"],
  },
  {
    name: "learning-path",
    title: ["Learning path", "for focused", "progress."],
    subtitle: "A step-by-step route with lessons and checkpoints.",
    badges: ["Guided", "Lessons", "Progress"],
    colorA: "#0ea5a8",
    colorB: "#0ea5e9",
    bg: ["#f7fdfd", "#e9f6fd"],
    file: "path.json",
    card: ["Learning path", "Guided lessons"],
  },
  {
    name: "learning-paths",
    title: ["Learning paths", "for system", "design."],
    subtitle: "Structured routes from first principles to mastery.",
    badges: ["Focused", "Guided", "Progress"],
    colorA: "#0ea5a8",
    colorB: "#22c55e",
    bg: ["#f7fdfa", "#eafcf1"],
    file: "paths.json",
    card: ["Learning paths", "Structured routes"],
  },
  {
    name: "shared-canvas",
    title: ["Shared canvas.", "Public diagrams."],
    subtitle: "A shareable canvas with public, collaborative access.",
    badges: ["Public", "Shared", "Collaborative"],
    colorA: "#0ea5a8",
    colorB: "#8b5cf6",
    bg: ["#f7fdfd", "#f1edff"],
    file: "share.json",
    card: ["Public canvas", "Shareable link"],
  },
];

function esc(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function fitFontSize(measure, text, startSize, minSize, maxWidth) {
  let size = startSize;
  while (size > minSize) {
    const w = await measure(text, size);
    if (w <= maxWidth) return size;
    size -= 2;
  }
  return minSize;
}

// Right-column illustration: a tiny system diagram (design canvas) feeding
// into an export card — echoes "design it, then ship production-ready output".
function buildIllustration(page, measurements) {
  const { colorA, colorB, file, card } = page;
  const cx = 918; // center x of the top node / branch point
  const nodeY = 150;
  const nodeSize = 84;
  const branchY = nodeY + nodeSize; // 234
  const iconY = 300;
  const iconSize = 78;
  const iconCenterXs = [cx - 158, cx, cx + 158];
  const iconXs = iconCenterXs.map((x) => x - iconSize / 2);
  const thirdColor = "#f59e0b";
  const iconColors = [colorA, colorB, thirdColor];

  const branchLines = iconCenterXs
    .map(
      (x) =>
        `<path d="M${cx} ${branchY}L${x} ${iconY}" fill="none" stroke="${colorA}" stroke-opacity="0.4" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>`,
    )
    .join("\n    ");

  const icons = [
    // cube
    `<path d="M0 -16l14 8v16l-14 8-14-8v-16z" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round"/><path d="M-14 -8l14 8 14-8M0 0v16" stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linejoin="round"/>`,
    // database
    `<ellipse cx="0" cy="-12" rx="15" ry="7" fill="none" stroke="#ffffff" stroke-width="2.6"/><path d="M-15 -12v18q0 7 15 7t15-7v-18" fill="none" stroke="#ffffff" stroke-width="2.6"/><path d="M-15 -3q0 7 15 7t15-7" fill="none" stroke="#ffffff" stroke-width="2.6"/>`,
    // network / share
    `<circle cx="-13" cy="12" r="6" fill="none" stroke="#ffffff" stroke-width="2.6"/><circle cx="13" cy="12" r="6" fill="none" stroke="#ffffff" stroke-width="2.6"/><circle cx="0" cy="-14" r="6" fill="none" stroke="#ffffff" stroke-width="2.6"/><path d="M-8 8L-4 -9M8 8L4 -9" stroke="#ffffff" stroke-width="2.4"/>`,
  ];

  const iconBoxes = iconXs
    .map(
      (x, i) => `
    <rect x="${x}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="18" fill="${iconColors[i]}"/>
    <g transform="translate(${x + iconSize / 2} ${iconY + iconSize / 2})">${icons[i]}</g>`,
    )
    .join("");

  const exportY = iconY + iconSize + 26; // 404
  const exportX = 700;
  const exportW = 410;
  const exportH = 136;
  const codeLines = [
    { t: '"nodes"', v: "12," },
    { t: '"edges"', v: "18," },
    { t: '"status"', v: '"ready"' },
  ];
  const codeMarkup = codeLines
    .map(
      (l, i) =>
        `<text x="${exportX + 22}" y="${exportY + 62 + i * 24}" font-family="Menlo, Consolas, monospace" font-size="14" fill="#94a3b8">${esc(l.t)}<tspan fill="#e2e8f0">: </tspan><tspan fill="${colorB}">${esc(l.v)}</tspan></text>`,
    )
    .join("\n    ");

  const cardW = measurements.cardWidth;
  const cardH = 64;
  const cardX = exportX;
  const cardY = nodeY - 4;

  return `
  <!-- diagram illustration -->
  <rect x="${cx - nodeSize / 2}" y="${nodeY}" width="${nodeSize}" height="${nodeSize}" rx="20" fill="url(#accent)"/>
  <g stroke="#ffffff" stroke-width="4" stroke-linecap="round">
    <path d="M${cx - 20} ${nodeY + 30}h40"/>
    <path d="M${cx - 20} ${nodeY + 42}h40"/>
    <path d="M${cx - 20} ${nodeY + 54}h24"/>
  </g>
  ${branchLines}
  <circle cx="${cx}" cy="${branchY}" r="4.5" fill="${colorA}"/>
  ${iconBoxes}

  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="16" fill="#ffffff" stroke="#d9e4e7" stroke-width="1.5"/>
  <g transform="translate(${cardX + 18} ${cardY + 34})">
    <rect x="0" y="-11" width="22" height="22" rx="6" fill="${colorA}" fill-opacity="0.15"/>
    <path d="M5 0h12M5 -5h12M5 5h8" stroke="${colorA}" stroke-width="2" stroke-linecap="round"/>
    <text x="30" y="-1" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#0b1220">${esc(card[0])}</text>
    <text x="30" y="16" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="500" fill="#64748b">${esc(card[1])}</text>
  </g>

  <rect x="${exportX}" y="${exportY}" width="${exportW}" height="${exportH}" rx="18" fill="#0b1220"/>
  <text x="${exportX + 22}" y="${exportY + 32}" font-family="Menlo, Consolas, monospace" font-size="13" font-weight="700" fill="${colorB}">${esc(file)}</text>
  ${codeMarkup}
  <circle cx="${exportX + exportW - 28}" cy="${exportY + 28}" r="15" fill="${colorB}"/>
  <path d="M${exportX + exportW - 35} ${exportY + 28}l5 5 9 -11" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function buildSvg(page, layout) {
  const { title, subtitle, badges, colorA, colorB, bg } = page;
  const { titleSize, subtitleSize, badgeWidths, cardWidth } = layout;
  const titleLineHeight = titleSize * 1.1;
  const titleStartY = 210;

  const titleLines = title
    .map((line, i) => {
      const y = titleStartY + i * titleLineHeight;
      const fill = i === title.length - 1 ? colorA : "#0b1220";
      return `<text x="${MARGIN}" y="${y}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${titleSize}" font-weight="800">${esc(line)}</text>`;
    })
    .join("\n  ");

  const subtitleY = titleStartY + (title.length - 1) * titleLineHeight + 52;

  let badgeX = MARGIN;
  const badgeY = subtitleY + 44;
  const badgeGap = 14;
  const badgeMarkup = badges
    .map((b, i) => {
      const w = badgeWidths[i];
      const rect = `<rect x="${badgeX}" y="${badgeY}" width="${w}" height="42" rx="21" fill="rgba(11,18,32,0.04)" stroke="${colorA}" stroke-opacity="0.35"/>`;
      const text = `<text x="${badgeX + w / 2}" y="${badgeY + 27}" text-anchor="middle" fill="#0b1220" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="600">${esc(b)}</text>`;
      badgeX += w + badgeGap;
      return rect + "\n  " + text;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Diagramwise ${esc(page.name)} OG image</title>
  <desc id="desc">${esc(title.join(" "))}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg[0]}"/>
      <stop offset="100%" stop-color="${bg[1]}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colorA}"/>
      <stop offset="100%" stop-color="${colorB}"/>
    </linearGradient>
    <radialGradient id="blob" cx="30%" cy="30%" r="75%">
      <stop offset="0%" stop-color="${colorB}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${colorB}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="300" fill="url(#blob)"/>

  <g transform="translate(${MARGIN} 68)">
    <image href="${LOGO_DATA_URI}" x="0" y="0" width="44" height="44"/>
    <text x="56" y="30" fill="#0b1220" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">Diagramwise</text>
  </g>

  ${titleLines}
  <text x="${MARGIN}" y="${subtitleY}" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="${subtitleSize}" font-weight="500">${esc(subtitle)}</text>

  ${badgeMarkup}

  ${buildIllustration(page, { cardWidth })}

  <rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="url(#accent)"/>
</svg>`;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const measurePage = await browser.newPage();
  await measurePage.setContent(
    `<!doctype html><html><head>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
      </head><body><canvas id="c"></canvas></body></html>`,
    { waitUntil: "domcontentloaded" },
  );
  await measurePage.evaluate(() => document.fonts.ready);

  const measure = async (text, size, weight = 500) => {
    return measurePage.evaluate(
      async ({ text, size, weight }) => {
        const font = `${weight} ${size}px Inter`;
        await document.fonts.load(font, text);
        const ctx = document.getElementById("c").getContext("2d");
        ctx.font = font;
        return ctx.measureText(text).width;
      },
      { text, size, weight },
    );
  };

  const renderPage = await browser.newPage();
  await renderPage.setViewport({ width: WIDTH, height: HEIGHT });

  for (const page of PAGES) {
    // Fit title lines to one shared font size (largest that fits every line).
    let titleSize = 68;
    for (const line of page.title) {
      const fitted = await fitFontSize(
        (t, s) => measure(t, s, 800),
        line,
        titleSize,
        36,
        TEXT_COL_WIDTH,
      );
      titleSize = Math.min(titleSize, fitted);
    }

    const subtitleSize = await fitFontSize(
      (t, s) => measure(t, s, 500),
      page.subtitle,
      24,
      16,
      TEXT_COL_WIDTH,
    );

    const badgeWidths = [];
    for (const b of page.badges) {
      const w = await measure(b, 16, 600);
      badgeWidths.push(Math.ceil(w) + 44);
    }

    const cardTextWidths = await Promise.all([
      measure(page.card[0], 14, 700),
      measure(page.card[1], 12, 500),
    ]);
    const cardWidth = Math.max(
      170,
      Math.ceil(Math.max(...cardTextWidths)) + 62,
    );

    const svg = buildSvg(page, {
      titleSize,
      subtitleSize,
      badgeWidths,
      cardWidth,
    });

    await renderPage.setContent(
      `<!doctype html><html><head><meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
        <style>html,body{margin:0;padding:0;width:${WIDTH}px;height:${HEIGHT}px;}</style>
        </head><body>${svg}</body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    await renderPage.evaluate(async () => {
      await document.fonts.load("700 24px Inter");
      await document.fonts.load("800 68px Inter");
      await document.fonts.ready;
    });

    const pngPath = path.join(outDir, `${page.name}.png`);
    await renderPage.screenshot({
      path: pngPath,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
