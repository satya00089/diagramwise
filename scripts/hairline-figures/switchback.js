/**
 * Switchback: four landings make a small stepped learning route. The pointer
 * selects a landing; it rises with its marker while nearby landings stagger.
 */
const {
  Cam, clamp, facing, fit, mk, open, pointer, poly, prism, proj, rrect,
  ringAt, rings, seg, solid, put, tdone, tset, tval, tween, register, disposer, place,
} = HL;

const N = 4, W = 28, H = 22, GAP = 15, BASE = 4, RISE = 10;
const route = [
  [0, 36], [34, 36], [34, 8], [68, 8],
];

function landingPose(P, item, lift, lean) {
  const [x0, y0] = route[item.i];
  const s = Math.sin(lean * Math.PI / 180), c = Math.cos(lean * Math.PI / 180);
  const Q = (u, v, z = 0) => P(x0 + u, y0 + v * c, z + v * s + lift);
  return { Q, outer: rrect(0, 0, W, H, 4, 5), inner: rrect(2.3, 2.3, W - 2.3, H - 2.3, 2, 5) };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[-8, -8, 0], [104, 58, 0], [104, -8, 0], [-8, 58, 0], [0, 0, BASE + RISE + 17]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const [outer, inner] = rings(-8, 1, 104, 48, 5, 2.4);
  const plinth = solid(g);
  put(plinth, prism(P, front, outer, inner, 0, BASE));
  mk("path", { d: open(ringAt(P, inner, BASE + 0.2)), class: "nf lo" }, g);
  const items = route.map((_, i) => ({ i, lift: tween(i * 2), lean: tween(-3), active: false }));
  const markers = [];
  route.forEach(([x, y], i) => {
    const link = i === 0 ? null : route[i - 1];
    if (link) mk("path", { d: seg(P(link[0] + W, link[1] + H / 2, BASE + 1), P(x, y + H / 2, BASE + 1)), class: "nf lo" }, g);
    const item = items[i], grp = mk("g", {}, g);
    item.grp = grp;
    item.back = mk("path", { class: "lo" }, grp);
    item.face = mk("path", { class: "sil" }, grp);
    item.edge = mk("path", { class: "nf lo" }, grp);
    item.marker = mk("circle", { r: 2.8, class: "dot" }, grp);
    markers.push(item.marker);
  });
  const token = mk("circle", { r: 3.4, class: "dot m" }, g);

  const draw = (item, now) => {
    const lift = tval(item.lift, now), lean = tval(item.lean, now);
    const { Q, outer, inner } = landingPose(P, item, lift, lean);
    const shape = prism(P, front, outer, inner, 0, 5);
    item.face.setAttribute("d", shape.sil);
    item.face.classList.toggle("hi", item.active);
    item.edge.setAttribute("d", shape.crease);
    place(item.marker, Q(W / 2, H / 2, 5.5));
    return !tdone(item.lift, now) || !tdone(item.lean, now);
  };
  const B = register(stage, (_dt, now) => {
    let moving = false;
    items.forEach((item) => { if (draw(item, now)) moving = true; });
    const chosen = items.find((item) => item.active) || items[0];
    const a = chosen.i, [x, y] = route[a];
    place(token, P(x + W / 2, y + H / 2, tval(chosen.lift, now) + 9));
    return moving;
  });
  bag.add(B.unregister);

  let active = -1;
  const hit = ([x, y]) => {
    const q = HL.unproj(C, x, y, 0);
    let best = -1, dist = Infinity;
    route.forEach(([rx, ry], i) => {
      const d = Math.hypot(q[0] - (rx + W / 2), q[1] - (ry + H / 2));
      if (d < dist && d < 25) { best = i; dist = d; }
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
      tset(item.lift, i * 2 + (i === active ? RISE : 0), now, d * 65);
      tset(item.lean, i === active ? -13 : -3, now, d * 65);
    });
    read.textContent = active < 0 ? "rest" : `step ${active + 1}`;
    B.wake();
  };
  bag.add(pointer(stage, { move: (p) => select(hit(p)), leave: () => select(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "switchback",
  means: "A stepped learning route lifts the landing under the pointer and carries a marker forward.",
  rules: [1, 2, 4, 8],
  range: [35, 55, 82],
  mount,
});
