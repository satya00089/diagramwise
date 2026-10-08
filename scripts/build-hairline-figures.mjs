import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const sourceRoot = join(here, "hairline-figures");
const outputRoot = join(appRoot, "public", "path-figures");
const embedRoot = join(outputRoot, "embed");
const names = ["workbench", "switchback", "inspection-stack", "drafting-board"];

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
for (const name of names) {
  const rawOut = join(outputRoot, `${name}.html`);
  const figure = `/* ${license.replace(/\s+/g, " ")} */\n${geometry}\n${await read(`${name}.js`)}\n`;
  // Preserve the skill's fixed bench; the production host is a separate template.
  await writeFile(rawOut, inject(bench, figure), "utf8");
  await writeFile(
    join(embedRoot, `${name}.html`),
    inject(embed, figure),
    "utf8",
  );
}
