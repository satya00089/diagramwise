/**
 * Inspection stack: three different architecture layers sit on one rail.
 * The pointer pulls a layer outward so its physical seam becomes legible.
 */
const {
  Cam, clamp, facing, fit, mk, open, pointer, poly, prism, proj, rrect,
  ringAt, rings, seg, solid, put, tdone, tset, tval, tween, register, disposer,
} = HL;

const layers = [
  { name: "data", w: 64, h: 23, y: 24, kind: "grid" },
  { name: "service", w: 76, h: 22, y: 12, kind: "ports" },
  { name: "edge", w: 58, h: 21, y: 2, kind: "gate" },
];
const DEPTH = 4, PULL = 18;

function pose(P, item, slide, lift) {
  const x0 = 45 - item.w / 2, y0 = item.y;
  const Q = (u, v, z = 0) => P(x0 + u + slide, y0 + v, z + lift);
  return { Q, outer: rrect(0, 0, item.w, item.h, 4, 5), inner: rrect(2.5, 2.5, item.w - 2.5, item.h - 2.5, 2, 5) };
}

function detail(P, item, g, slide, lift, active) {
  const { Q } = pose(P, item, slide, lift);
  const line = (a, b, cls = "nf lo") => mk("path", { d: seg(Q(...a), Q(...b)), class: cls }, g);
  if (item.kind === "grid") {
    for (let i = 1; i < 5; i++) line([i * item.w / 5, 5, 5], [i * item.w / 5, item.h - 5, 5], active ? "nf hi" : "nf lo");
    line([6, item.h / 2, 5], [item.w - 6, item.h / 2, 5], active ? "nf hi" : "nf lo");
  } else if (item.kind === "ports") {
    for (let i = 0; i < 3; i++) {
      const x = 12 + i * 24;
      mk("path", { d: open(rrect(x, 5, x + 13, item.h - 5, 2, 5).map(([u, v]) => Q(u, v, 5))), class: active && i === 1 ? "nf hi" : "nf lo" }, g);
    }
    line([8, item.h - 4, 12], [item.w - 8, item.h - 4, 12]);
  } else {
    line([8, 6, 7], [item.w - 8, 6, 7], active ? "nf hi" : "nf lo");
    line([item.w / 2, 6, 7], [item.w / 2, item.h - 5, 7], active ? "nf hi" : "nf lo");
    line([8, item.h - 5, 7], [item.w - 8, item.h - 5, 7]);
  }
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[-12, -10, 0], [108, 50, 0], [108, -10, 0], [-12, 50, 0], [0, 0, DEPTH * 3 + PULL + 12]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const [railOuter, railInner] = rings(4, 0, 86, 38, 5, 2.5);
  const rail = solid(g);
  put(rail, prism(P, front, railOuter, railInner, 0, DEPTH));
  mk("path", { d: open(ringAt(P, railInner, DEPTH + 0.1)), class: "nf lo" }, g);
  const items = layers.map((item, i) => ({ ...item, i, slide: tween(0), lift: tween(i * 2), active: false }));
  items.forEach((item) => {
    const grp = mk("g", {}, g);
    item.grp = grp;
    item.back = mk("path", { class: "lo" }, grp);
    item.face = mk("path", { class: "sil" }, grp);
    item.crease = mk("path", { class: "nf lo" }, grp);
  });
  const draw = (item, now) => {
    const slide = tval(item.slide, now), lift = tval(item.lift, now);
    const { Q, outer, inner } = pose(P, item, slide, lift);
    const shape = prism(P, front, outer, inner, 0, 5);
    item.face.setAttribute("d", shape.sil);
    item.face.classList.toggle("hi", item.active);
    item.crease.setAttribute("d", shape.crease);
    item.grp.querySelectorAll("g.detail").forEach((node) => node.remove());
    const details = mk("g", { class: "detail" }, item.grp);
    detail(P, item, details, slide, lift, item.active);
    return !tdone(item.slide, now) || !tdone(item.lift, now);
  };
  const B = register(stage, (_dt, now) => {
    let moving = false;
    items.forEach((item) => { if (draw(item, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  let active = -1;
  const hit = ([x, y]) => {
    const q = HL.unproj(C, x, y, 0);
    let best = -1, dist = Infinity;
    items.forEach((item, i) => {
      const d = Math.abs(q[1] - (item.y + item.h / 2));
      if (d < dist && d < 13) { best = i; dist = d; }
    });
    return best;
  };
  const select = (next) => {
    if (next === active) return;
    active = next;
    const now = performance.now();
    items.forEach((item, i) => {
      item.active = i === active;
      const d = active < 0 ? 0 : Math.abs(i - active);
      tset(item.slide, i === active ? PULL : 0, now, d * 70);
      tset(item.lift, i * 2 + (i === active ? 6 : 0), now, d * 70);
    });
    read.textContent = active < 0 ? "rest" : `${layers[active].name} layer`;
    B.wake();
  };
  bag.add(pointer(stage, { move: (p) => select(hit(p)), leave: () => select(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "inspection-stack",
  means: "Three connected architecture layers slide apart for a closer inspection under the pointer.",
  rules: [1, 2, 4, 8],
  range: [35, 55, 85],
  mount,
});
