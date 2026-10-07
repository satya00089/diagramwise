import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowDown,
  HiArrowRight,
  HiArrowUpRight,
  HiBars2,
  HiCheck,
  HiChevronDown,
  HiMoon,
  HiPause,
  HiPlay,
  HiSun,
  HiXMark,
} from "react-icons/hi2";
import { Button } from "../components/ui/button";
import RollingNavLabel from "../components/RollingNavLabel";
import ArchitectureDiagram, {
  type DesignPhase,
} from "../components/landing3d/ArchitectureDiagram";
import Seo from "../components/SEO";
import { AuthModal } from "../components/AuthModal";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useRoughAnnotation } from "../hooks/useRoughAnnotation";
import "./Landing3D.css";

/* Systema is the user-selected visual reference; this is an original Diagramwise adaptation.
 * THESIS: Make the reasoning behind a system visible.
 * OWN-WORLD: Warm paper canvas, near-black sans typography, fine architectural lines, compact square controls.
 * STORY: Draw a first draft, question its read path, then introduce a cache with an explicit trade-off.
 * FIRST VIEWPORT: Left headline and action; large right architecture, with the draft/review/improve sequence beneath it.
 * FORM: User-pinned Systema; code-led geometric diagram, no stock video or abstract flower.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */

const phases = ["Design", "Review", "Improve"] as const;
const phaseInsights = [
  "Start with the request path. Make your assumptions visible.",
  "A popular link repeats the same database read. What would you change?",
  "Cache popular links. Now consider expiry, invalidation, and cache misses.",
] as const;
const examplePath = "/problems/url-shortener-like-bit-ly/";
const landingPatternSizes = [
  { size1: 18, size2: 23 },
  { size1: 27, size2: 32 },
  { size1: 21, size2: 27 },
  { size1: 33, size2: 39 },
  { size1: 24, size2: 30 },
] as const;

function Brand() {
  return (
    <Link className="systema-brand" to="/" aria-label="Diagramwise home">
      <img src="/logo-64.png" alt="" aria-hidden="true" />
      <span>Diagramwise</span>
    </Link>
  );
}

function IsoFeatureNode({
  x,
  y,
  accent = false,
}: Readonly<{ x: number; y: number; accent?: boolean }>) {
  return (
    <g
      className={`systema-feature-node${accent ? " systema-feature-node--accent" : ""}`}
      transform={`translate(${x} ${y})`}
    >
      <path
        className="systema-feature-side systema-feature-side--left"
        d="M-15 0 0 8v16l-15-8Z"
      />
      <path
        className="systema-feature-side systema-feature-side--right"
        d="M0 8 15 0v16L0 24Z"
      />
      <path className="systema-feature-face" d="M-15 0 0-8 15 0 0 8Z" />
      <path className="systema-feature-detail" d="m-8 0 8-4 8 4" />
    </g>
  );
}

function IsoFeatureTile({ x, y }: Readonly<{ x: number; y: number }>) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="systema-feature-side systema-feature-side--left"
        d="M0 18v10l40 20V38Z"
      />
      <path
        className="systema-feature-side systema-feature-side--right"
        d="M40 38v10l40-20V18Z"
      />
      <path className="systema-feature-face" d="M0 18 40-2l40 20-40 20Z" />
      <path
        className="systema-feature-detail"
        d="m18 18 22-11 22 11-22 11ZM29 23l11-5 11 5M40 18v11"
      />
    </g>
  );
}

function FeatureArt({
  type,
}: Readonly<{ type: "design" | "reason" | "review" | "canvas" }>) {
  return (
    <svg
      viewBox="0 0 320 150"
      fill="none"
      aria-hidden="true"
      className={`systema-feature-art systema-feature-art--${type}`}
    >
      {type === "design" && (
        <g className="systema-feature-scene">
          <path className="systema-feature-guide" d="M49 91 97 66m82 0 49 25" />
          <rect
            className="systema-feature-panel"
            x="18"
            y="54"
            width="52"
            height="42"
            rx="5"
          />
          <path
            className="systema-feature-detail"
            d="M29 67h29M29 75h22M29 83h29"
          />
          <path className="systema-feature-accent" d="M29 89h14" />
          <IsoFeatureTile x={91} y={53} />
          <IsoFeatureNode x={157} y={50} accent />
          <IsoFeatureNode x={198} y={86} />
          <path
            className="systema-feature-connection"
            d="M171 58 191 78M212 92l17 11"
          />
          <path
            className="systema-feature-database"
            d="M229 102v19c0 7 15 12 25 12s25-5 25-12v-19"
          />
          <ellipse
            className="systema-feature-panel"
            cx="254"
            cy="102"
            rx="25"
            ry="9"
          />
          <path
            className="systema-feature-detail"
            d="M233 105c4 4 13 6 21 6s17-2 21-6"
          />
          <circle className="systema-feature-port" cx="81" cy="73" r="2.5" />
        </g>
      )}
      {type === "reason" && (
        <g className="systema-feature-scene">
          <path
            className="systema-feature-guide"
            d="M38 110 90 85l52 25 52-27"
          />
          <g className="systema-feature-path-step systema-feature-path-step--one">
            <IsoFeatureTile x={24} y={89} />
            <circle className="systema-feature-port" cx="64" cy="105" r="3" />
          </g>
          <g className="systema-feature-path-step systema-feature-path-step--two">
            <IsoFeatureTile x={78} y={63} />
            <path className="systema-feature-accent" d="m103 81 15-7 15 7" />
          </g>
          <g className="systema-feature-path-step systema-feature-path-step--three">
            <IsoFeatureTile x={132} y={89} />
            <path
              className="systema-feature-detail"
              d="m157 107 10-5 10 5-10 5Z"
            />
          </g>
          <g className="systema-feature-path-step systema-feature-path-step--four">
            <IsoFeatureTile x={186} y={62} />
            <path className="systema-feature-detail" d="M211 80h30M211 87h20" />
          </g>
          <path
            className="systema-feature-accent"
            d="m245 104 10-6m-10 6 6 9"
          />
        </g>
      )}
      {type === "review" && (
        <g className="systema-feature-scene">
          <g
            className="systema-feature-review-panel"
            transform="matrix(1 -0.14 0.1 0.99 38 36)"
          >
            <rect
              className="systema-feature-panel systema-feature-panel--deep"
              x="0"
              y="0"
              width="178"
              height="96"
              rx="6"
            />
            <path className="systema-feature-detail" d="M0 22h178" />
            <circle className="systema-feature-port" cx="14" cy="11" r="2" />
            <circle
              className="systema-feature-detail-dot"
              cx="22"
              cy="11"
              r="2"
            />
            <circle
              className="systema-feature-detail-dot"
              cx="30"
              cy="11"
              r="2"
            />
            <path
              className="systema-feature-detail"
              d="M47 11h84M15 39h97M15 51h122"
            />
            <rect
              className="systema-feature-row"
              x="12"
              y="63"
              width="12"
              height="12"
              rx="3"
            />
            <path
              className="systema-feature-check"
              d="m15 69 3 3 5-6M34 69h78"
            />
            <rect
              className="systema-feature-row"
              x="12"
              y="80"
              width="12"
              height="12"
              rx="3"
            />
            <path
              className="systema-feature-check"
              d="m15 86 3 3 5-6M34 86h58"
            />
          </g>
          <g className="systema-feature-review-architecture">
            <IsoFeatureNode x={215} y={80} />
            <IsoFeatureNode x={243} y={105} accent />
            <path
              className="systema-feature-connection"
              d="M227 87 236 100M254 110l10 8"
            />
            <path
              className="systema-feature-database"
              d="M262 117v15c0 5 9 8 15 8s15-3 15-8v-15"
            />
            <ellipse
              className="systema-feature-panel"
              cx="277"
              cy="117"
              rx="15"
              ry="5.5"
            />
          </g>
          <path
            className="systema-feature-accent systema-feature-review-mark"
            d="m220 61 7 7 13-16"
          />
        </g>
      )}
      {type === "canvas" && (
        <g className="systema-feature-scene">
          <rect
            className="systema-feature-canvas-frame"
            x="42"
            y="33"
            width="236"
            height="91"
            rx="6"
          />
          <path className="systema-feature-detail" d="M42 54h236" />
          <circle
            className="systema-feature-detail-dot"
            cx="54"
            cy="44"
            r="2"
          />
          <circle
            className="systema-feature-detail-dot"
            cx="62"
            cy="44"
            r="2"
          />
          <path className="systema-feature-detail" d="M75 44h36" />
          <g className="systema-feature-canvas-nodes">
            <rect
              className="systema-feature-node-card"
              x="67"
              y="73"
              width="49"
              height="30"
              rx="4"
            />
            <path className="systema-feature-detail" d="M77 83h29M77 90h20" />
            <rect
              className="systema-feature-node-card"
              x="138"
              y="73"
              width="49"
              height="30"
              rx="4"
            />
            <path className="systema-feature-detail" d="M148 83h29M148 90h20" />
            <path className="systema-feature-connection" d="M116 88h22" />
          </g>
          <g className="systema-feature-canvas-add">
            <circle
              className="systema-feature-add-button"
              cx="239"
              cy="88"
              r="11"
            />
            <path className="systema-feature-accent" d="M233 88h12M239 82v12" />
          </g>
          <path className="systema-feature-guide" d="M79 116h75m14 0h34" />
        </g>
      )}
    </svg>
  );
}

export default function Landing3D() {
  const [phase, setPhase] = useState<DesignPhase>(0);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, isAuthenticated, login, signup, googleLogin, logout } =
    useAuth();
  const { setTheme, flowColorMode } = useTheme();
  const landingTheme = flowColorMode;
  const storyRef = useRef<HTMLDivElement>(null);
  const heroDecisionRef = useRef<HTMLSpanElement>(null);
  const patternRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pattern = patternRef.current;
    if (!pattern) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let size1 = 24;
    let size2 = 29;
    let animationFrame = 0;
    let patternIndex = 0;

    const updatePattern = (nextSize1: number, nextSize2: number) => {
      size1 = nextSize1;
      size2 = nextSize2;
      pattern.style.setProperty("--systema-pattern-size-1", `${size1}px`);
      pattern.style.setProperty("--systema-pattern-size-2", `${size2}px`);
    };

    updatePattern(size1, size2);
    if (reducedMotion.matches) return;

    const animateToNewPattern = () => {
      const startSize1 = size1;
      const startSize2 = size2;
      const target =
        landingPatternSizes[patternIndex % landingPatternSizes.length];
      patternIndex += 1;
      const startedAt = performance.now();
      const duration = 1200;

      const animate = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        updatePattern(
          startSize1 + (target.size1 - startSize1) * eased,
          startSize2 + (target.size2 - startSize2) * eased,
        );
        if (progress < 1)
          animationFrame = window.requestAnimationFrame(animate);
      };

      animationFrame = window.requestAnimationFrame(animate);
    };

    const interval = window.setInterval(animateToNewPattern, 10000);
    return () => {
      window.clearInterval(interval);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const roughAnnotationTargets = useMemo(
    () => [
      {
        ref: heroDecisionRef,
        config: {
          type: "underline" as const,
          color: landingTheme === "light" ? "#151513" : "#d5d5d2",
          strokeWidth: 1.5,
          padding: 2,
          iterations: 1,
          animationDuration: 650,
        },
      },
    ],
    [landingTheme],
  );

  useRoughAnnotation(roughAnnotationTargets);

  useEffect(() => {
    const sections =
      storyRef.current?.querySelectorAll<HTMLElement>("[data-phase]");
    if (!sections) return;
    const desktop = window.matchMedia("(min-width: 900px)");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setPhase(
              Number(
                (entry.target as HTMLElement).dataset.phase,
              ) as DesignPhase,
            );
        }
      },
      { rootMargin: "-35% 0px -40% 0px" },
    );
    const syncObserver = () => {
      observer.disconnect();
      if (desktop.matches) {
        sections.forEach((section) => observer.observe(section));
      }
    };
    syncObserver();
    desktop.addEventListener("change", syncObserver);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", syncObserver);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("systema-menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (!showUserMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".systema-auth-control")) setShowUserMenu(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [showUserMenu]);

  return (
    <div className="systema-page" data-theme={landingTheme}>
      <div
        ref={patternRef}
        className="systema-pattern-layer"
        aria-hidden="true"
      />
      <Seo
        title="Diagramwise — System design. Understand every decision."
        description="Practice system design on a visual canvas. Build an architecture, explain your trade-offs, review your assumptions, and improve your next iteration."
        keywords="system design, system design practice, architecture diagram, software architecture, distributed systems, architecture trade-offs, system design interview"
        image="https://diagramwise.com/og/home.png"
        imageAlt="Diagramwise system design walkthrough preview"
        url="https://diagramwise.com/"
      />
      <a href="#systema-main" className="systema-skip">
        Skip to content
      </a>
      <header className="systema-header systema-container">
        <Brand />
        <nav aria-label="Main navigation" className="systema-desktop-nav">
          <Link to="/problems/" aria-label="Practice problems">
            <RollingNavLabel>Practice problems</RollingNavLabel>
          </Link>
          <Link to="/playground/free" aria-label="Design Studio">
            <RollingNavLabel>Design Studio</RollingNavLabel>
          </Link>
          <Link to="/learning-paths/" aria-label="Learning paths">
            <RollingNavLabel>Learning paths</RollingNavLabel>
          </Link>
          {isAuthenticated && (
            <Link
              to="/diagrams"
              aria-label="My Designs"
              className="systema-nav-workspace-link"
            >
              <RollingNavLabel>My Designs</RollingNavLabel>
            </Link>
          )}
        </nav>
        <div className="systema-nav-actions">
          <span className="systema-theme-control">
            <button
              type="button"
              className="systema-theme-toggle"
              aria-label={`Switch to ${landingTheme === "light" ? "dark" : "light"} theme`}
              onClick={() =>
                setTheme(landingTheme === "light" ? "dark" : "light")
              }
            >
              {landingTheme === "light" ? <HiMoon /> : <HiSun />}
            </button>
            <span className="systema-theme-tooltip" role="tooltip">
              Switch to {landingTheme === "light" ? "dark" : "light"} theme
            </span>
          </span>
          <div className="systema-auth-control">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className="systema-account-button"
                  aria-label="Open account menu"
                  aria-expanded={showUserMenu}
                  onClick={() => setShowUserMenu((open) => !open)}
                >
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || "User"}
                      className="systema-account-avatar systema-account-avatar-image"
                    />
                  ) : (
                    <span className="systema-account-avatar">
                      {user?.name?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() ||
                        "U"}
                    </span>
                  )}
                  <span className="systema-account-name">
                    {user?.name || user?.email}
                  </span>
                  <HiChevronDown
                    aria-hidden="true"
                    className={`systema-account-chevron ${showUserMenu ? "systema-account-chevron--open" : ""}`}
                  />
                </button>
                {showUserMenu && (
                  <div className="systema-account-menu">
                    <div className="systema-account-menu__identity">
                      <strong>{user?.name || "User"}</strong>
                      <span>{user?.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                className="product-sign-in systema-sign-in"
                onClick={() => setShowAuthModal(true)}
              >
                Sign In
              </button>
            )}
          </div>
          <Button
            asChild
            size="sm"
            className="systema-nav-cta systema-primary-cta"
          >
            <Link to="/problems/">
              Start designing <HiArrowUpRight />
            </Link>
          </Button>
          <Button
            id="systema-menu-toggle"
            variant="ghost"
            size="icon"
            className="systema-menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="systema-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <HiXMark /> : <HiBars2 />}
          </Button>
        </div>
        {menuOpen && (
          <nav
            id="systema-mobile-nav"
            aria-label="Mobile navigation"
            className="systema-mobile-nav"
          >
            <Link onClick={() => setMenuOpen(false)} to="/problems/">
              Practice problems
            </Link>
            <Link onClick={() => setMenuOpen(false)} to="/playground/free">
              Design Studio
            </Link>
            <Link onClick={() => setMenuOpen(false)} to="/learning-paths/">
              Learning paths
            </Link>
            {isAuthenticated && (
              <Link
                onClick={() => setMenuOpen(false)}
                to="/diagrams"
                className="systema-mobile-nav-workspace-link"
              >
                My Designs
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <div className="systema-mobile-nav-account">
                  <span className="systema-account-avatar">
                    {user?.name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </span>
                  <span>{user?.name || user?.email}</span>
                </div>
                <button
                  type="button"
                  className="systema-mobile-nav-sign-in"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="systema-mobile-nav-sign-in"
                onClick={() => {
                  setMenuOpen(false);
                  setShowAuthModal(true);
                }}
              >
                Sign In
              </button>
            )}
            <Link to="/problems/" className="systema-mobile-nav-cta">
              Start designing <HiArrowUpRight />
            </Link>
          </nav>
        )}
      </header>

      <main id="systema-main">
        <div ref={storyRef} className="systema-story systema-container">
          <section
            className="systema-intro systema-story-copy"
            data-phase="0"
            aria-labelledby="systema-title"
          >
            <h1 id="systema-title">
              System design.
              <br />
              <span>
                Understand
                <br />
                <span ref={heroDecisionRef}>every decision.</span>
              </span>
            </h1>
            <p>
              Go beyond connecting boxes. Build an architecture, explain your
              trade-offs, and turn thoughtful feedback into a stronger design.
            </p>
            <div className="systema-hero-actions">
              <Button asChild size="lg" className="systema-primary-cta">
                <Link to="/problems/">
                  Start designing <HiArrowUpRight />
                </Link>
              </Button>
            </div>
            <div className="systema-scroll-note">
              <span className="systema-scroll-line" />A first draft is just the
              beginning.
            </div>
          </section>

          <div className="systema-stage-column">
            <figure className="systema-stage">
              <figcaption className="systema-stage-heading">
                <span>URL shortener</span>
                <span>Illustrative walkthrough</span>
              </figcaption>
              <ArchitectureDiagram phase={phase} paused={paused} />
              <div className="systema-stage-toolbar">
                <fieldset
                  className="systema-phase-controls"
                  aria-label="Architecture walkthrough stage"
                >
                  {phases.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={phase === index}
                      onClick={() => setPhase(index as DesignPhase)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {label}
                    </button>
                  ))}
                </fieldset>
                <button
                  type="button"
                  className="systema-motion-toggle"
                  aria-label={
                    paused
                      ? "Play diagram animation"
                      : "Pause diagram animation"
                  }
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? <HiPlay /> : <HiPause />}
                </button>
              </div>
              <div
                className={`systema-stage-insight phase-${phase}`}
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="systema-insight-dot" />
                <p>{phaseInsights[phase]}</p>
              </div>
            </figure>
          </div>

          <section
            id="how-it-works"
            className="systema-review systema-story-copy"
            data-phase="1"
            aria-labelledby="systema-review-title"
          >
            <h2 id="systema-review-title">
              Good questions.
              <br />
              <span>Better architecture.</span>
            </h2>
            <p>
              A diagram shows what connects. Your reasoning explains why. Review
              the decisions behind your design, from the busiest read path to
              the failure you haven’t planned for.
            </p>
            <div className="systema-review-excerpt">
              <span>Example review question</span>
              <p>“What happens when one short link goes viral?”</p>
              <span>Scalability · Read path</span>
            </div>
            <Link className="systema-text-link" to={examplePath}>
              Explore the URL shortener problem <HiArrowUpRight />
            </Link>
          </section>

          <section
            className="systema-improve systema-story-copy"
            data-phase="2"
            aria-labelledby="systema-improve-title"
          >
            <h2 id="systema-improve-title">
              Think it through.
              <br />
              <span>Make it stronger.</span>
            </h2>
            <p>
              Add a cache to take repeated reads off the database. Explain the
              new trade-offs. Then review again. Every iteration is a chance to
              understand the system more deeply.
            </p>
            <ul className="systema-decisions">
              <li>
                <HiCheck /> Make a design decision
              </li>
              <li>
                <HiCheck /> Explain what you gain and give up
              </li>
              <li>
                <HiCheck /> Revisit it with structured feedback
              </li>
            </ul>
            <Button asChild variant="outline" className="systema-outline-cta">
              <Link to={examplePath}>
                Try this problem <HiArrowUpRight />
              </Link>
            </Button>
          </section>
        </div>

        <section
          id="choose-path"
          className="systema-capabilities systema-container"
          aria-labelledby="systema-capabilities-title"
        >
          <div className="systema-section-heading">
            <h2 id="systema-capabilities-title">
              Choose your path.
              <br />
              <span>Start where you are.</span>
            </h2>
            <p>
              Four ways into the same learning loop:
              <br className="systema-desktop-break" /> design, explain, review,
              improve.
            </p>
          </div>
          <div className="systema-features">
            <Link to="/problems/" className="systema-feature">
              <FeatureArt type="design" />
              <div>
                <h3>
                  Practice system design <HiArrowUpRight />
                </h3>
                <p>
                  Choose a realistic architecture prompt with requirements,
                  constraints, and a workspace for your answer.
                </p>
              </div>
            </Link>
            <Link to="/learning-paths/" className="systema-feature">
              <FeatureArt type="reason" />
              <div>
                <h3>
                  Follow a learning path <HiArrowUpRight />
                </h3>
                <p>
                  Build system design fundamentals step by step with structured
                  modules and hands-on lessons.
                </p>
              </div>
            </Link>
            <a href="#how-it-works" className="systema-feature">
              <FeatureArt type="review" />
              <div>
                <h3>
                  Review your architecture <HiArrowDown />
                </h3>
                <p>
                  Get feedback on scalability, reliability, data design,
                  performance, security, and trade-offs.
                </p>
              </div>
            </a>
            <Link to="/playground/free" className="systema-feature">
              <FeatureArt type="canvas" />
              <div>
                <h3>
                  Start from a blank canvas <HiArrowUpRight />
                </h3>
                <p>
                  Sketch freely when you already know what you want to explore.
                  Save and share when you are ready.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section
          className="systema-toolkit systema-container"
          aria-labelledby="systema-toolkit-title"
        >
          <div className="systema-toolkit-heading">
            <span>THE TOOLKIT</span>
            <h2 id="systema-toolkit-title">
              Powerful features.
              <br />
              <span>Useful when decisions get hard.</span>
            </h2>
          </div>
          <div className="systema-toolkit-grid">
            <article>
              <span className="systema-toolkit-index">01</span>
              <h3>Architecture library</h3>
              <p>
                Start with generic building blocks or use accurate AWS, Azure,
                and GCP components across cloud, ER, and UML diagrams.
              </p>
            </article>
            <article>
              <span className="systema-toolkit-index">02</span>
              <h3>Connected, annotated diagrams</h3>
              <p>
                Draw labeled data flows and attach notes, metadata, and custom
                fields to explain every important decision.
              </p>
            </article>
            <article>
              <span className="systema-toolkit-index">03</span>
              <h3>Structured AI assessment</h3>
              <p>
                See what is strong, what is risky, and what to improve next,
                with interview follow-up questions tailored to your design.
              </p>
            </article>
            <article>
              <span className="systema-toolkit-index">04</span>
              <h3>Export and share</h3>
              <p>
                Export the architecture as an image or share a live link with
                teammates when the conversation moves beyond the canvas.
              </p>
            </article>
          </div>
        </section>

        <section
          className="systema-value systema-container"
          aria-labelledby="systema-value-title"
        >
          <div className="systema-value-heading">
            <span>THE PAYOFF</span>
            <h2 id="systema-value-title">
              Leave with a design
              <br />
              <span>you can explain.</span>
            </h2>
          </div>
          <div className="systema-value-grid">
            <article>
              <span className="systema-value-index">01</span>
              <h3>Practice before signing in</h3>
              <p>Start with a realistic prompt in the free workflow.</p>
            </article>
            <article>
              <span className="systema-value-index">02</span>
              <h3>Get structured AI feedback</h3>
              <p>
                See where scale, reliability, data design, and trade-offs need
                work.
              </p>
            </article>
            <article>
              <span className="systema-value-index">03</span>
              <h3>Save and share when ready</h3>
              <p>
                Keep your architecture, sync progress, and bring it to your
                team.
              </p>
            </article>
          </div>
        </section>

        <section
          className="systema-close systema-container"
          aria-labelledby="systema-close-title"
        >
          <h2 id="systema-close-title">
            Your next good idea
            <br />
            <span>starts on the canvas.</span>
          </h2>
          <div className="systema-close-actions">
            <Button asChild size="lg" className="systema-primary-cta">
              <Link to="/problems/">
                Find your first problem <HiArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="systema-outline-cta"
            >
              <Link to="/playground/free">
                Open Design Studio <HiArrowUpRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={async (email, password) => login({ email, password })}
          onSignup={async (email, password, name) =>
            signup({ email, password, name })
          }
          onGoogleLogin={googleLogin}
        />
      )}
      <footer className="systema-footer systema-container">
        <Brand />
        <p>Design. Explain. Improve.</p>
        <nav className="systema-footer-links" aria-label="Footer">
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/support.html">Support</a>
        </nav>
        <a href="#systema-main">
          Back to top <HiArrowUpRight />
        </a>
      </footer>
    </div>
  );
}
