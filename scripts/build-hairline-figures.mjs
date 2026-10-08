import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const sourceRoot = join(here, "hairline-figures");
const outputRoot = join(appRoot, "public", "path-figures");
const embedRoot = join(outputRoot, "embed");
const names = ["workbench", "switchback", "inspection-stack", "drafting-board"];
const toolkitNames = [
  "component-rack",
  "annotation-bridge",
  "assessment-sheet",
  "share-frame",
];

await mkdir(outputRoot, { recursive: true });
await mkdir(embedRoot, { recursive: true });
const read = (file) =>
  readFile(join(sourceRoot, file), "utf8").then((text) =>
    text.replace(/\r\n/g, "\n").trimEnd(),
  );
const [kernel, bench, geometry, embed, license] = await Promise.all([
  read("vendor/kernel.js"),
  read("vendor/bench.html"),
  read("geometry.js"),
  read("embed.html"),
  read("vendor/LICENSE"),
]);
const inject = (template, figure) =>
  template
    .replace("/*KERNEL*/", () => `\n${kernel}\n`)
    .replace("/*FIGURE*/", () => `\n${figure.trim()}\n`);
for (const name of [...names, ...toolkitNames]) {
  const rawOut = join(outputRoot, `${name}.html`);
  const shared = toolkitNames.includes(name)
    ? await read("toolkit-geometry.js")
    : geometry;
  const figure = `/* ${license.replace(/\s+/g, " ")} */\n${shared}\n${await read(`${name}.js`)}\n`;
  // Preserve the skill's fixed bench; the production host is a separate template.
  await writeFile(rawOut, inject(bench, figure), "utf8");
  const productionHost = toolkitNames.includes(name)
    ? embed.replace('viewBox="0 0 400 320"', 'viewBox="0 65 400 230"')
    : embed;
  await writeFile(
    join(embedRoot, `${name}.html`),
    inject(productionHost, figure),
    "utf8",
  );
}
