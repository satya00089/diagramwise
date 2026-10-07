import { useState, type PointerEvent } from "react";

type FigureType = "design" | "reason" | "review" | "canvas";
type Point = readonly [number, number];

const VIEWBOX = "0 0 400 320";

function project(x: number, y: number, z = 0): Point {
  return [200 + (x - y) * 1.08, 202 + (x + y) * 0.42 - z];
}

function points(values: readonly Point[]) {
  return values.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function line(a: Point, b: Point) {
  return `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

function Block({
  x,
  y,
  width,
  depth,
  height,
  className = "figure-plate",
  detail = "none",
  style,
}: Readonly<{
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  className?: string;
  detail?: "none" | "bars" | "slots" | "socket";
  style?: React.CSSProperties;
}>) {
  const p = (dx: number, dy: number, z = 0) => project(x + dx, y + dy, z);
  const top = [p(0, 0, height), p(width, 0, height), p(width, depth, height), p(0, depth, height)];
  const base = [p(0, 0), p(width, 0), p(width, depth), p(0, depth)];
  const detailLines =
    detail === "bars"
      ? [0.32, 0.5, 0.68].map((ratio) => line(p(width * 0.16, depth * ratio, height + 0.4), p(width * 0.78, depth * ratio, height + 0.4)))
      : detail === "slots"
        ? [0.3, 0.52, 0.74].map((ratio) => line(p(width * 0.2, depth * ratio, height + 0.4), p(width * 0.63, depth * ratio, height + 0.4)))
        : [];

  return (
    <g className={className} style={style}>
      <polygon points={points([top[0], top[1], base[1], base[0]])} className="figure-side figure-side-left" />
      <polygon points={points([top[1], top[2], base[2], base[1]])} className="figure-side figure-side-right" />
      <polygon points={points(top)} className="figure-top" />
      <path d={line(top[0], top[1])} className="figure-crease" />
      {detail === "socket" && (
        <ellipse
          cx={p(width * 0.5, depth * 0.5, height + 0.8)[0]}
          cy={p(width * 0.5, depth * 0.5, height + 0.8)[1]}
          rx="7"
          ry="3"
          className="figure-detail"
        />
      )}
      {detailLines.map((d) => (
        <path key={d} d={d} className="figure-detail" />
      ))}
    </g>
  );
}

function Peg({
  x,
  y,
  height,
  active,
}: Readonly<{ x: number; y: number; height: number; active: boolean }>) {
  const base = project(x, y, height);
  const foot = project(x, y, 0);
  return (
    <g className={active ? "figure-part figure-part-active" : "figure-part"}>
      <path d={line(foot, base)} className="figure-edge" />
      <ellipse cx={base[0]} cy={base[1]} rx="7" ry="3.2" className="figure-top" />
      <path d={line([base[0] - 7, base[1]], [base[0] - 7, base[1] + 10])} className="figure-edge" />
      <path d={line([base[0] + 7, base[1]], [base[0] + 7, base[1] + 10])} className="figure-edge" />
      <ellipse cx={base[0]} cy={base[1] + 10} rx="7" ry="3.2" className="figure-side" />
    </g>
  );
}

function Base({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Block x={48} y={46} width={206} depth={142} height={7} className="figure-base" />
      {children}
    </>
  );
}

function useFigurePointer() {
  const [pointer, setPointer] = useState<Point | null>(null);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer([
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ]);
  };

  return {
    pointer,
    handlers: {
      onPointerMove,
      onPointerLeave: () => setPointer(null),
    },
  };
}

function DesignFigure() {
  const { pointer, handlers } = useFigurePointer();
  const modules = [
    { x: 64, y: 64, width: 54, depth: 38, height: 25, detail: "bars" as const },
    { x: 145, y: 56, width: 68, depth: 43, height: 19, detail: "slots" as const },
    { x: 86, y: 128, width: 72, depth: 37, height: 33, detail: "socket" as const },
    { x: 184, y: 122, width: 50, depth: 38, height: 22, detail: "bars" as const },
  ];
  const active = pointer ? Math.min(modules.length - 1, Math.floor(pointer[0] * modules.length)) : 2;

  return (
    <svg {...handlers} viewBox={VIEWBOX} role="img" aria-label="A modular design workbench with a selected component" className="systema-feature-art">
      <Base>
        <path d={line(project(78, 109, 8), project(141, 98, 8))} className="figure-rail" />
        <path d={line(project(142, 98, 8), project(183, 112, 8))} className="figure-rail" />
        {modules.map((module, index) => {
          const distance = Math.abs(index - active);
          const lift = index === active ? 18 : distance === 1 ? 6 : 0;
          return (
            <g
              key={`${module.x}-${module.y}`}
              className={index === active ? "figure-part figure-part-active" : "figure-part"}
              transform={`translate(0 ${-lift})`}
            >
              <Block {...module} />
            </g>
          );
        })}
        <Peg x={157} y={105} height={24} active />
      </Base>
    </svg>
  );
}

function LearningFigure() {
  const { pointer, handlers } = useFigurePointer();
  const steps = [
    { x: 59, y: 139, width: 50, depth: 34, height: 15 },
    { x: 101, y: 108, width: 53, depth: 36, height: 25 },
    { x: 150, y: 78, width: 54, depth: 37, height: 36 },
    { x: 197, y: 48, width: 56, depth: 38, height: 47 },
  ];
  const active = pointer ? Math.min(steps.length - 1, Math.floor(pointer[0] * steps.length)) : 1;

  return (
    <svg {...handlers} viewBox={VIEWBOX} role="img" aria-label="A stepped learning route with a moving study marker" className="systema-feature-art">
      <path d={line(project(75, 156, 23), project(221, 64, 55))} className="figure-route" />
      {steps.map((step, index) => {
        const distance = Math.abs(index - active);
        const lift = index === active ? 15 : distance === 1 ? 5 : 0;
        return (
          <g key={`${step.x}-${step.y}`} transform={`translate(0 ${-lift})`} className={index === active ? "figure-part figure-part-active" : "figure-part"}>
            <Block {...step} detail={index === 1 ? "socket" : "none"} />
            <Peg x={step.x + step.width * 0.52} y={step.y + step.depth * 0.48} height={step.height + 13} active={index === active} />
          </g>
        );
      })}
      <path d={line(project(67, 168, 7), project(230, 66, 7))} className="figure-low" />
    </svg>
  );
}

function ReviewFigure() {
  const { pointer, handlers } = useFigurePointer();
  const layers = [
    { x: 70, y: 75, width: 166, depth: 88, height: 5, detail: "bars" as const },
    { x: 81, y: 69, width: 143, depth: 76, height: 5, detail: "slots" as const },
    { x: 94, y: 63, width: 119, depth: 64, height: 5, detail: "socket" as const },
  ];
  const active = pointer ? Math.min(layers.length - 1, Math.floor(pointer[1] * layers.length)) : 1;

  return (
    <svg {...handlers} viewBox={VIEWBOX} role="img" aria-label="Layered architecture plates opening for inspection" className="systema-feature-art">
      <Block x={55} y={53} width={196} depth={130} height={6} className="figure-base" />
      {layers.map((layer, index) => {
        const distance = Math.abs(index - active);
        const lift = index === active ? 25 : distance === 1 ? 9 : 0;
        const shift = index === active ? (pointer ? (pointer[0] - 0.5) * 18 : 0) : 0;
        return (
          <g
            key={`${layer.x}-${layer.y}`}
            className={index === active ? "figure-part figure-part-active" : "figure-part"}
            transform={`translate(${shift} ${-lift})`}
          >
            <Block {...layer} />
          </g>
        );
      })}
      <path d={line(project(122, 95, 38), project(174, 95, 38))} className="figure-inspection" />
      <path d={line(project(137, 83, 38), project(137, 119, 38))} className="figure-inspection" />
    </svg>
  );
}

function CanvasFigure() {
  const { pointer, handlers } = useFigurePointer();
  const position = pointer ?? [0.38, 0.35];
  const x = 92 + position[0] * 124;
  const y = 76 + position[1] * 66;
  const puck = project(x, y, 17);
  const boardTop = [project(60, 58, 12), project(248, 58, 12), project(248, 178, 12), project(60, 178, 12)];

  return (
    <svg {...handlers} viewBox={VIEWBOX} role="img" aria-label="An empty drafting board ready for a first idea" className="systema-feature-art">
      <Block x={48} y={46} width={212} depth={148} height={8} className="figure-base" />
      <polygon points={points(boardTop)} className="figure-sheet" />
      <path d={line(project(73, 75, 13), project(232, 75, 13))} className="figure-ruler" />
      <path d={line(project(74, 82, 13), project(232, 82, 13))} className="figure-low" />
      {[0, 1, 2].map((index) => {
        const clipX = index === 0 ? 73 : index === 1 ? 153 : 230;
        const clip = project(clipX, 74, 18);
        return <ellipse key={index} cx={clip[0]} cy={clip[1]} rx="7" ry="3" className="figure-clip" />;
      })}
      <path d={line(project(x - 20, y, 13), project(x + 20, y, 13))} className="figure-guide" />
      <path d={line(project(x, y - 20, 13), project(x, y + 20, 13))} className="figure-guide" />
      <g className="figure-cursor" transform={`translate(${puck[0]} ${puck[1]})`}>
        <ellipse cx="0" cy="0" rx="10" ry="4" className="figure-cursor-top" />
        <path d="M -10 0 V 10 M 10 0 V 10" className="figure-edge" />
        <ellipse cx="0" cy="10" rx="10" ry="4" className="figure-side" />
      </g>
    </svg>
  );
}

export default function PathFigure({ type }: Readonly<{ type: FigureType }>) {
  if (type === "design") return <DesignFigure />;
  if (type === "reason") return <LearningFigure />;
  if (type === "review") return <ReviewFigure />;
  return <CanvasFigure />;
}
