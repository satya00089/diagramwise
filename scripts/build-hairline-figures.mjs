import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const skillRoot = "C:/Users/satya/.codex/skills/hairline-create";
const sourceRoot = join(here, "hairline-figures");
const outputRoot = join(appRoot, "public", "path-figures");
const embedRoot = join(outputRoot, "embed");
const names = ["workbench", "switchback", "inspection-stack", "drafting-board"];

await mkdir(outputRoot, { recursive: true });
await mkdir(embedRoot, { recursive: true });
const css = `<style id="diagrammatic-figure-overrides">:root{--ground:transparent;--hairline-plate:#111111;--hairline-hi:#f1f3f7;--hairline-edge:#a8a9af;--hairline-mid:#747780;--hairline-lo:#50545d}body{min-height:0;padding:0;display:block;background:transparent;overflow:hidden}main{max-width:none;height:100%}.plate{border:0;border-radius:0;overflow:visible}#stage{width:100%;aspect-ratio:400 / 320}.tag,.controls,#means,#rules,#error{display:none!important}</style>`;
for (const name of names) {
  const source = join(sourceRoot, `${name}.js`);
  const rawOut = join(outputRoot, `${name}.html`);
  await execFileAsync("node", [join(skillRoot, "build.mjs"), source, rawOut], { cwd: appRoot });
  const html = await readFile(rawOut, "utf8");
  await writeFile(join(embedRoot, `${name}.html`), html.replace("</head>", `${css}</head>`), "utf8");
}
