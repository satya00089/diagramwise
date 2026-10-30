#!/usr/bin/env node
// Tells Bing and other IndexNow search engines which pages changed.
// Run it AFTER the site is deployed (the key file must already be live):
//   npm run indexnow

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "diagramwise.com";
const key = "267e1a51fb1142bf9b06dd23f530df11";

const sitemapPath = path.join(projectDir, "dist", "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  console.error("dist/sitemap.xml not found. Run `npm run build` first.");
  process.exit(1);
}

const urlList = [...fs.readFileSync(sitemapPath, "utf-8").matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1].trim())
  .filter((url) => new URL(url).host === host);

const response = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  }),
});

console.log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${response.status}`);
if (!response.ok) process.exit(1);
