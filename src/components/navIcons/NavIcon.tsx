import type { CSSProperties, ReactNode } from "react";
import type { IconType } from "react-icons";
import "./navIcons.css";

/**
 * Tab icon with motion, driven by the parent's hover/focus/selected state.
 * The parent button needs the class `nav-tab`.
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
  // Client -> two services; the connections run normal -> green -> red.
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
} satisfies Record<string, Story>;

export type NavIconProps = Readonly<
  | { name: keyof typeof STORY; size?: number; icon?: never; motion?: never }
  | { icon: IconType; motion?: Motion; size?: number; name?: never }
>;

export function NavIcon({ name, icon: Icon, motion = "pop", size = 16 }: NavIconProps) {
  if (name) {
    const story: Story = STORY[name];
    return (
      <svg
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
