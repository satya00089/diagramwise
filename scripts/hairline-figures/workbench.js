/**
 * Workbench: a compact design bench with three different system modules.
 * The pointer selects a module; it lifts from its hinge and opens just enough
 * to expose the part being reasoned about.
 */
const {
  Cam, clamp, facing, fit, mk, open, pointer, poly, prism, proj, rrect,
  ringAt, rings, seg, solid, put, tdone, tset, tval, tween, register, disposer,
} = HL;

const W = 34, H = 30, GAP = 7, Z = 5, REST = -2, OPEN = -22, LIFT = 7;
const modules = [
  { name: "ingest", kind: "stack" },
  { name: "route", kind: "relay" },
  { name: "store", kind: "reservoir" },
];

function modulePose(P, item, angle, lift) {
  const x0 = item.i * (W + GAP), y0 = 4;
  const s = Math.sin(angle * Math.PI / 180), c = Math.cos(angle * Math.PI / 180);
  const Q = (u, v, z = 0) => P(x0 + u, y0 + v * c, z + v * s + lift);
  const outer = rrect(0, 0, W, H, 4, 5);
  const inner = rrect(2.5, 2.5, W - 2.5, H - 2.5, 2.2, 5);
  return { Q, outer, inner };
}

function detail(P, item, g, angle, lift, active) {
  const { Q } = modulePose(P, item, angle, lift);
  const line = (a, b, cls = "nf lo") => mk("path", { d: seg(Q(...a), Q(...b)), class: cls }, g);
  const x = W / 2;
  if (item.kind === "stack") {
    line([x - 9, 7, 7], [x + 9, 7, 7], active ? "nf hi" : "nf lo");
    line([x - 7, 12, 7], [x + 7, 12, 7]);
    line([x - 5, 17, 7], [x + 5, 17, 7]);
    line([x - 9, 22, 7], [x + 9, 22, 7], active ? "nf hi" : "nf lo");
  } else if (item.kind === "relay") {
    const ring = rrect(7, 8, W - 7, H - 8, 5, 5);
    mk("path", { d: open(ringAt(Q, ring, 7)), class: active ? "nf hi" : "nf lo" }, g);
    line([x, 8, 7], [x, H - 8, 7], active ? "nf hi" : "nf lo");
    line([x - 7, H / 2, 7], [x + 7, H / 2, 7]);
  } else {
    const ring = rrect(8, 8, W - 8, H - 8, 7, 5);
    mk("path", { d: open(ringAt(Q, ring, 7)), class: active ? "nf hi" : "nf lo" }, g);
    line([x - 6, 10, 7], [x + 6, 10, 7]);
    line([x - 6, H - 10, 7], [x + 6, H - 10, 7]);
  }
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.75);
  const total = modules.length * W + (modules.length - 1) * GAP;
  fit(C, [[-8, -8, 0], [total + 8, H + 12, 0], [total + 8, -8, 0], [-8, H + 12, 0], [0, 0, Z + LIFT + 18]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const [base, inset] = rings(-7, -3, total + 7, H + 7, 5, 2.6);
  const bench = solid(g);
  put(bench, prism(P, front, base, inset, 0, Z));
  mk("path", { d: open(ringAt(P, inset, Z + 0.2)), class: "nf lo" }, g);

  const parts = modules.map((item, i) => ({ ...item, i, angle: tween(REST), lift: tween(0) }));
  for (const item of parts) {
    const grp = mk("g", {}, g);
    item.grp = grp;
    item.back = mk("path", { class: "lo" }, grp);
    item.face = mk("path", { class: "sil" }, grp);
    item.crease = mk("path", { class: "nf lo" }, grp);
    detail(P, item, grp, REST, 0, false);
  }

  const draw = (item, now) => {
    const a = tval(item.angle, now), lift = tval(item.lift, now);
    const { Q, outer, inner } = modulePose(P, item, a, lift);
    const shape = prism(P, front, outer, inner, 0, 6);
    item.face.setAttribute("d", shape.sil);
    item.face.classList.toggle("hi", item.active);
    item.crease.setAttribute("d", shape.crease);
    const oldDetails = item.grp.querySelectorAll("path.detail");
    oldDetails.forEach((node) => node.remove());
    // Details are redrawn after the face so the module reads as one connected part.
    const detailGroup = mk("g", { class: "detail" }, item.grp);
    detail(P, item, detailGroup, a, lift, item.active);
    return !tdone(item.angle, now) || !tdone(item.lift, now);
  };

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const item of parts) if (draw(item, now)) moving = true;
    return moving;
  });
  bag.add(B.unregister);

  let active = -1;
  const hit = ([x, y]) => {
    const q = HL.unproj(C, x, y, 0);
    return clamp(Math.floor(q[0] / (W + GAP)), 0, parts.length - 1);
  };
  const select = (next) => {
    if (next === active) return;
    const now = performance.now();
    active = next;
    parts.forEach((item, i) => {
      item.active = i === active;
      const open = i === active;
      tset(item.angle, open ? OPEN : REST, now, Math.abs(i - active) * 55);
      tset(item.lift, open ? LIFT : 0, now, Math.abs(i - active) * 55);
    });
    read.textContent = active < 0 ? "rest" : modules[active].name;
    B.wake();
  };
  bag.add(pointer(stage, { move: (p) => select(hit(p)), leave: () => select(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "workbench",
  means: "Three connected system modules open from a shared design workbench under the pointer.",
  rules: [1, 2, 4, 9],
  range: [35, 65, 105],
  mount,
});
