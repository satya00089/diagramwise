import type { CSSProperties, ReactNode } from "react";
import type { IconType } from "react-icons";
import "./navIcons.css";

/**
 * Tab icon with motion, driven by the parent's hover/focus/selected state.
 * The parent button needs the class `nav-trigger`.
 *
 *   <NavIcon icon={MdSettings} motion="spin" />   generic motion on a react-icon
 *   <NavIcon name="simulate" />                   hand-built story icon
 *
 * To add a story icon: add its shapes to STORY below, tagging them with the
 * effect classes from navIcons.css (nx-draw, nx-bar, nx-flip, nx-slide, ...).
 * Shapes using `nx-draw` need pathLength={1}.
 */

type Motion = "lift" | "pop" | "tilt" | "spin";

type Story = Readonly<{ className?: string; shapes: ReactNode }>;

const dx = (px: number) => ({ "--dx": `${px}px` }) as CSSProperties;

const STORY = {
  // Client -> two services; dots flow along the connections, nodes pulse.
  simulate: {
    className: "nx-slow",
    shapes: (
      <>
        <path className="nx-dotted" d="M9.6 12 H12 V6 H14.4" />
        <path className="nx-dotted" d="M9.6 12 H12 V18 H14.4" />
        <rect className="nx-box nx-ping" x="2.5" y="9" width="6" height="6" rx="1.2" />
        <rect className="nx-box nx-ping nx-d1" x="15.5" y="3" width="6" height="6" rx="1.2" />
        <rect className="nx-box nx-ping nx-d2" x="15.5" y="15" width="6" height="6" rx="1.2" />
      </>
    ),
  },
  // Page whose text lines write themselves in, one after another.
  details: {
    shapes: (
      <>
        <path d="M6.5 3 H14 L19 8 V19.5 A1.5 1.5 0 0 1 17.5 21 H6.5 A1.5 1.5 0 0 1 5 19.5 V4.5 A1.5 1.5 0 0 1 6.5 3 Z" />
        <path d="M14 3 V8 H19" />
        <path className="nx-draw" pathLength={1} d="M8.5 12 H15.5" />
        <path className="nx-draw nx-s1" pathLength={1} d="M8.5 15 H15.5" />
        <path className="nx-draw nx-s2" pathLength={1} d="M8.5 18 H12.5" />
      </>
    ),
  },
  // Bars that rise in, left to right.
  assessment: {
    shapes: (
      <>
        <path d="M3.5 21 H20.5" />
        <path className="nx-bar" d="M7 18 V13" />
        <path className="nx-bar nx-s1" d="M12 18 V6" />
        <path className="nx-bar nx-s2" d="M17 18 V10" />
      </>
    ),
  },
  // Open book; the right page turns.
  guide: {
    shapes: (
      <>
        <path d="M12 6.5 C10 5 7 4.5 3.5 5 V18.5 C7 18 10 18.5 12 20 C14 18.5 17 18 20.5 18.5 V5 C17 4.5 14 5 12 6.5 Z" />
        <path d="M12 6.5 V20" />
        <path d="M6.5 9.5 H9.5 M6.5 12.5 H9.5" />
        <g className="nx-flip">
          <path d="M14.5 9.5 H17.5 M14.5 12.5 H17.5" />
        </g>
      </>
    ),
  },
  // Three sliders whose handles move to new positions and back.
  properties: {
    shapes: (
      <>
        <path d="M4 6 H20 M4 12 H20 M4 18 H20" />
        <circle className="nx-slide" style={dx(8)} cx="8" cy="6" r="2" />
        <circle className="nx-slide nx-s1" style={dx(-9)} cx="16" cy="12" r="2" />
        <circle className="nx-slide nx-s2" style={dx(5)} cx="10" cy="18" r="2" />
      </>
    ),
  },
  // State-driven: pass state="sun" | "moon". Sun shrinks away, moon draws in.
  theme: {
    shapes: (
      <>
        <circle className="nx-outline nx-sun" cx="12" cy="12" r="4" />
        <path
          className="nx-sun nx-rays"
          d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M5.3 18.7 L7 17 M17 7 L18.7 5.3"
        />
        <path
          className="nx-moon"
          pathLength={1}
          d="M20.5 13.2 A8.5 8.5 0 1 1 10.8 3.5 6.6 6.6 0 0 0 20.5 13.2 Z"
        />
      </>
    ),
  },
  // Globe: the meridian turns like a spinning globe, a ring ripples outward.
  publish: {
    shapes: (
      <>
        <path d="M12 3 A9 9 0 1 1 12 21 A9 9 0 1 1 12 3 Z" />
        <path d="M3 12 H21" />
        <g className="nx-flip">
          <path d="M12 3 C8.2 7.2 8.2 16.8 12 21 C15.8 16.8 15.8 7.2 12 3" />
        </g>
        <circle className="nx-outline nx-ring" cx="12" cy="12" r="9" />
      </>
    ),
  },
  // Two jigsaw pieces: the left one pulls back, pushes into the socket and
  // clicks, with sparks at the join.
  extensions: {
    shapes: (
      <>
        <path
          className="nx-plug"
          d="M3 7 H11 V10.3 A2 2 0 1 1 11 13.7 V17 H3 Z"
        />
        <path d="M21 7 H13.2 V10.3 A2 2 0 1 1 13.2 13.7 V17 H21 Z" />
        <path
          className="nx-spark"
          d="M12.1 3.6 V5.2 M9.8 4.4 L10.7 5.7 M14.4 4.4 L13.5 5.7"
        />
      </>
    ),
  },
  // Question mark that writes itself, then the dot pops.
  tour: {
    shapes: (
      <>
        <path d="M12 3 A9 9 0 1 1 12 21 A9 9 0 1 1 12 3 Z" />
        <path
          className="nx-draw"
          pathLength={1}
          d="M9.4 9.6 A2.6 2.6 0 1 1 12 12.2 V13.6"
        />
        <circle className="nx-box nx-ping nx-d2" cx="12" cy="16.6" r="1.1" />
      </>
    ),
  },
} satisfies Record<string, Story>;

export type StoryIconName = keyof typeof STORY;

export type NavIconProps = Readonly<
  | {
      name: StoryIconName;
      size?: number;
      /** Drives state-based icons such as theme ("sun" | "moon"). */
      state?: string;
      icon?: never;
      motion?: never;
    }
  | { icon: IconType; motion?: Motion; size?: number; name?: never; state?: never }
>;

export function NavIcon({
  name,
  icon: Icon,
  motion = "pop",
  size = 16,
  state,
}: NavIconProps) {
  if (name) {
    const story: Story = STORY[name];
    return (
      <svg
        data-state={state}
        className={`nx-glyph ${story.className ?? ""}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {story.shapes}
      </svg>
    );
  }
  return Icon ? (
    <Icon
      className={`nav-icon nav-motion-${motion}`}
      size={size}
      aria-hidden="true"
    />
  ) : null;
}

export default NavIcon;
