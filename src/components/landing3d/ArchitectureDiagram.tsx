import { useId } from "react";

export type DesignPhase = 0 | 1 | 2;

function Server({
  x,
  y,
  label,
  subtitle,
}: Readonly<{
  x: number;
  y: number;
  label: string;
  subtitle: string;
}>) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-49"
        y="-43"
        width="98"
        height="76"
        rx="7"
        className="architecture-node"
      />
      {[-24, -6, 12].map((row) => (
        <g key={row}>
          <rect
            x="-31"
            y={row}
            width="62"
            height="12"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".65"
          />
          <circle cx="21" cy={row + 6} r="1.5" fill="currentColor" />
        </g>
      ))}
      <text y="56" className="architecture-label">
        {label}
      </text>
      <text y="74" className="architecture-detail">
        {subtitle}
      </text>
    </g>
  );
}

function Database({
  x,
  y,
  label,
  cache = false,
}: Readonly<{
  x: number;
  y: number;
  label: string;
  cache?: boolean;
}>) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-32-24V23C-32 44 32 44 32 23V-24"
        className="architecture-node"
      />
      <ellipse cy="-24" rx="32" ry="12" className="architecture-node" />
      <path
        d="M-32-9C-32 11 32 11 32-9M-32 7C-32 27 32 27 32 7"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".45"
      />
      {cache && <path d="M4-14-7 5H2L-3 21 11 0H2Z" fill="currentColor" />}
      <text y="63" className="architecture-label">
        {label}
      </text>
      <text y="81" className="architecture-detail">
        {cache ? "cache-first reads" : "durable storage"}
      </text>
    </g>
  );
}

export default function ArchitectureDiagram({
  phase,
  paused,
}: Readonly<{
  phase: DesignPhase;
  paused: boolean;
}>) {
  const id = useId().replaceAll(":", "");
  const improved = phase === 2;
  const reviewing = phase === 1;
  const phaseTitle = ["first draft", "design review", "cache-first design"][
    phase
  ];
  const phaseCaption = [
    "One request. A system of decisions.",
    "Every redirect reaches the database.",
    "Popular links take the shorter path.",
  ][phase];
  return (
    <svg
      viewBox="0 0 650 540"
      role="img"
      aria-label={`URL shortener architecture: ${phaseTitle}`}
      aria-describedby={`${id}-desc`}
      className={`architecture-diagram phase-${phase}${paused ? " is-paused" : ""}`}
    >
      <desc id={`${id}-desc`}>
        {improved
          ? "A client sends requests through a load balancer to two API instances. A cache serves popular links; cache misses read from the links database."
          : "A client sends requests through a load balancer to two API instances, which both read from the links database. Review highlights repeated reads of popular links."}
      </desc>
      <defs>
        <pattern
          id={`${id}-dots`}
          width="25"
          height="25"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".14" />
        </pattern>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path
            d="M1 1 9 5 1 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
      <rect x="10" y="25" width="630" height="470" fill={`url(#${id}-dots)`} />
      <g className="architecture-boundary">
        <rect x="213" y="58" width="210" height="420" rx="16" />
        <text x="231" y="79">
          APPLICATION
        </text>
      </g>
      <g className="architecture-edges" markerEnd={`url(#${id}-arrow)`}>
        <path d="M104 264H168" />
        <path d="M192 244V163Q192 145 211 145H268" />
        <path d="M192 284V363Q192 381 211 381H268" />
        <path
          className={reviewing ? "architecture-concern" : ""}
          d="M367 145H472Q494 145 494 167V231"
        />
        <path
          className={reviewing ? "architecture-concern" : ""}
          d="M367 381H392Q410 381 410 363V281H461"
        />
      </g>
      <g className="architecture-packets" aria-hidden="true">
        <path d="M104 264H168" />
        <path d="M192 244V163Q192 145 211 145H268" />
        <path d="M192 284V363Q192 381 211 381H268" />
        <path
          className={reviewing ? "architecture-concern" : ""}
          d="M367 145H472Q494 145 494 167V231"
        />
        <path
          className={reviewing ? "architecture-concern" : ""}
          d="M367 381H392Q410 381 410 363V281H461"
        />
      </g>
      <g transform="translate(69 264)">
        <rect
          x="-35"
          y="-27"
          width="70"
          height="50"
          rx="5"
          className="architecture-node"
        />
        <path d="M-20 33H20M0 23V33" fill="none" stroke="currentColor" />
        <path
          d="m-8-9-9 8 9 8m16-16 9 8-9 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <text y="59" className="architecture-label">
          Client
        </text>
      </g>
      <g transform="translate(192 264)">
        <rect
          x="-24"
          y="-24"
          width="48"
          height="48"
          rx="24"
          className="architecture-node"
        />
        <path
          d="M-12 0H3M3 0V-11H11M3 0V11H11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text x="-4" y="62" className="architecture-label">
          Balancer
        </text>
      </g>
      <Server x={317} y={145} label="Redirect API" subtitle="instance A" />
      <Server x={317} y={381} label="Redirect API" subtitle="instance B" />
      <g className={reviewing ? "architecture-concern" : ""}>
        <Database
          x={494}
          y={264}
          label={improved ? "Link cache" : "Links database"}
          cache={improved}
        />
      </g>
      {improved && (
        <g className="architecture-addition">
          <path
            d="M527 264H630V94H614"
            className="architecture-edges"
            markerEnd={`url(#${id}-arrow)`}
          />
          <Database x={581} y={94} label="Database" />
          <text
            x="645"
            y="206"
            className="architecture-edge-label"
            transform="rotate(-90 645 206)"
          >
            cache miss
          </text>
        </g>
      )}
      <text x="380" y="130" className="architecture-edge-label">
        {improved ? "cache lookup" : "read link"}
      </text>
      <g transform="translate(317 264)" className="architecture-center">
        <circle r="32" />
        <circle r="23" />
        <circle r="14" />
        <path d="M-7 0H7M0-7V7" />
      </g>
      <text x="325" y="496" className="architecture-caption">
        {phaseCaption}
      </text>
    </svg>
  );
}
