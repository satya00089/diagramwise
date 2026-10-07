/**
 * Drafting board: an empty sheet held by two clips and a parked T-square.
 * The pointer draws the square across the sheet, keeping the canvas blank.
 */
const {
  Cam, clamp, facing, fit, mk, open, pointer, poly, prism, proj, rrect,
  ringAt, rings, seg, solid, put, spring, stepS, register, disposer, place,
} = HL;

const SHEET_W = 82, SHEET_H = 52, BOARD_W = 92, BOARD_H = 62;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[-10, -10, 0], [102, 74, 0], [102, -10, 0], [-10, 74, 0], [0, 0, 19]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const [board, boardInner] = rings(-4, -4, BOARD_W + 4, BOARD_H + 4, 5, 2.4);
  const base = solid(g);
  put(base, prism(P, front, board, boardInner, 0, 7));
  const [sheet, sheetInner] = rings(0, 0, SHEET_W, SHEET_H, 2.4, 1.5);
  const paper = solid(g);
  put(paper, prism(P, front, sheet, sheetInner, 7, 8.5));
  mk("path", { d: open(ringAt(P, sheetInner, 8.55)), class: "nf lo" }, g);
  mk("path", { d: open(rrect(0, 0, SHEET_W, SHEET_H, 2.4, 5).map(([x, y]) => P(x, y, 8.7))), class: "nf lo" }, g);
  // Clips are shallow, physical tabs at the upper corners of the sheet.
  for (const x of [8, SHEET_W - 8]) {
    const clip = rrect(x - 5, -2, x + 5, 5, 1.7, 5);
    mk("path", { d: open(ringAt(P, clip, 12)), class: "nf" }, g);
    mk("path", { d: open(clip.map(([u, v]) => P(u, v, 10))), class: "nf lo" }, g);
  }
  const ruler = mk("g", {}, g);
  const bar = mk("path", { class: "sil" }, ruler);
  const edge = mk("path", { class: "nf hi" }, ruler);
  const notch = mk("path", { class: "nf lo" }, ruler);
  const cursor = mk("circle", { r: 3.2, class: "dot m" }, g);
  const guide = mk("path", { class: "nf lo" }, g);
  const tx = spring(SHEET_W * 0.68), ty = spring(SHEET_H * 0.54);
  let over = null;
  const draw = () => {
    const x = tx.x, y = ty.x;
    const rail = rrect(-4, -2, SHEET_W + 4, 4, 1.6, 5).map(([u, v]) => P(u, y + v, 12));
    bar.setAttribute("d", poly(rail));
    edge.setAttribute("d", seg(P(0, y + 3, 12.2), P(SHEET_W, y + 3, 12.2)));
    notch.setAttribute("d", seg(P(7, y - 1, 12.2), P(7, y + 1, 12.2)) + seg(P(17, y - 1, 12.2), P(17, y + 1, 12.2)) + seg(P(27, y - 1, 12.2), P(27, y + 1, 12.2)));
    place(cursor, P(x, y, 13));
    guide.setAttribute("d", seg(P(x, 6, 10), P(x, SHEET_H - 4, 10)));
  };
  const B = register(stage, (dt) => { const moving = stepS(tx, dt) || stepS(ty, dt); draw(); return moving; });
  bag.add(B.unregister);
  const hit = ([x, y]) => {
    const q = HL.unproj(C, x, y, 8.5);
    return [clamp(q[0], 4, SHEET_W - 4), clamp(q[1], 5, SHEET_H - 5)];
  };
  const move = (p) => {
    over = hit(p);
    tx.t = over[0]; ty.t = over[1];
    read.textContent = `field ${Math.round(over[0] / 10)}·${Math.round(over[1] / 10)}`;
    B.wake();
  };
  const leave = () => { over = null; tx.t = SHEET_W * 0.68; ty.t = SHEET_H * 0.54; read.textContent = "blank"; B.wake(); };
  bag.add(pointer(stage, { move, leave }));
  bag.add(() => svg.replaceChildren());
  return { set: () => {}, destroy: bag.dispose };
}

hairline({
  name: "drafting-board",
  means: "A blank sheet, two clips, and a T-square keep the canvas ready for a first idea.",
  rules: [1, 3, 5, 9],
  range: [35, 55, 80],
  mount,
});
