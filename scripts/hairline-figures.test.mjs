import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Script, runInNewContext } from "node:vm";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = "scripts/hairline-figures/";
const names = ["workbench", "switchback", "inspection-stack", "drafting-board"];
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const files = names.flatMap(name => [`public/path-figures/${name}.html`, `public/path-figures/embed/${name}.html`]);

test("generated pages are reproducible and each contains the approved shared camera", () => {
  const before = files.map(read);
  execFileSync(process.execPath, ["scripts/build-hairline-figures.mjs"], { cwd: root });
  assert.deepEqual(files.map(read), before);
  for (const html of before) {
    assert.match(html, /Cam\(45, 0\.5, 1\.6\)/);
    assert.match(html, /Copyright \(c\) 2026 Lucas Marques/);
    assert.doesNotMatch(html, /\/\*(?:FIGURE|KERNEL)\*\//);
    for (const [, js] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Script(js);
  }
});

test("the vendored kernel retains its published content hash", () => {
  const kernel = read(`${source}vendor/kernel.js`).trimEnd();
  const cut = kernel.indexOf("\n");
  const expected = /sha256:([a-f0-9]{64})/.exec(kernel)[1];
  assert.equal(createHash("sha256").update(kernel.slice(cut + 1) + "\n").digest("hex"), expected);
});

test("the embed only accepts bounded input from its same-origin parent and cleans up", () => {
  const template = read(`${source}embed.html`);
  const host = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const calls = [], listeners = new Map(), parent = {};
  const stage = {dataset:{}, querySelector:()=>({})};
  const scene = {move:x=>calls.push(["move",x]), reset:()=>calls.push(["reset"]), destroy:()=>calls.push(["destroy"])};
  const context = {
    URLSearchParams, location:{origin:"https://diagramwise.com", search:"?theme=light"}, parent,
    document:{documentElement:{dataset:{}}, getElementById:()=>stage}, HL:{inject:()=>{}},
    addEventListener:(name,handler)=>listeners.set(name,handler),
    removeEventListener:(name)=>listeners.delete(name),
  };
  runInNewContext(host,context);
  context.hairline({name:"test",range:[25,45,65],mount:()=>scene});
  const receive = listeners.get("message");
  const send = (data, overrides={}) => receive({source:parent,origin:context.location.origin,data:{type:"diagramwise:figure",...data},...overrides});
  send({active:true,x:200},{source:{}});
  send({active:true,x:200},{origin:"https://example.com"});
  send({active:true,x:NaN}); send({active:"yes",x:200});
  assert.deepEqual(calls,[]);
  send({active:true,x:900}); send({active:true,x:-10}); send({active:false,x:200});
  assert.deepEqual(calls,[["move",400],["move",0],["reset"]]);
  assert.equal(context.document.documentElement.dataset.theme,"light");
  listeners.get("pagehide")();
  assert.equal(listeners.has("message"),false);
  assert.deepEqual(calls.at(-1),["destroy"]);
});
