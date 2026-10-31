import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiArrowUpRight,
  HiBars2,
  HiCheck,
  HiMoon,
  HiPause,
  HiPlay,
  HiSun,
  HiXMark,
} from "react-icons/hi2";
import { Button } from "../components/ui/button";
import RollingNavLabel from "../components/RollingNavLabel";
import FeatureArt from "../components/landing3d/FeatureArt";
import ArchitectureDiagram, {
  type DesignPhase,
} from "../components/landing3d/ArchitectureDiagram";
import Seo from "../components/SEO";
import { AuthModal } from "../components/AuthModal";
import AccountMenu from "../components/AccountMenu";
import AiConnectionGuideDialog from "../components/AiConnectionGuideDialog";
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

export default function Landing3D() {
  const [phase, setPhase] = useState<DesignPhase>(0);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAiConnectionGuide, setShowAiConnectionGuide] = useState(false);
  const { isAuthenticated, login, signup, googleLogin } = useAuth();
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
          color: landingTheme === "light" ? "#9c344e" : "#f0a1b1",
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

  return (
    <div className="systema-page" data-theme={landingTheme}>
      <div
        ref={patternRef}
        className="systema-pattern-layer"
        aria-hidden="true"
      />
      <Seo
        title="Diagramwise — System design. Understand every decision."
        description="Practice system design on a visual canvas. Build an architecture, simulate live traffic, explain your trade-offs, review your assumptions, and connect ChatGPT, Claude, or Gemini through the Diagramwise MCP server."
        keywords="system design, system design practice, architecture diagram, software architecture, distributed systems, architecture trade-offs, system design interview, architecture simulator, traffic simulation, MCP server, Diagramwise MCP"
        image="https://diagramwise.com/og/home.png"
        imageAlt="Diagramwise system design walkthrough preview"
        url="https://diagramwise.com/"
      />
      <a href="#systema-main" className="systema-skip">
        Skip to content
      </a>
      <header className="systema-header systema-container">
        <Brand />
        <nav
          aria-label="Main navigation"
          className={`systema-desktop-nav${isAuthenticated ? " systema-desktop-nav--authenticated" : ""}`}
        >
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
          <button
            type="button"
            className="systema-nav-connect"
            aria-label="AI connections"
            aria-haspopup="dialog"
            aria-controls="ai-connection-guide-dialog"
            onClick={() => setShowAiConnectionGuide(true)}
          >
            <RollingNavLabel>AI connections</RollingNavLabel>
          </button>
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
              <AccountMenu variant="landing" />
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
            <button
              type="button"
              className="systema-mobile-nav-connect"
              aria-haspopup="dialog"
              aria-controls="ai-connection-guide-dialog"
              onClick={() => {
                setMenuOpen(false);
                setShowAiConnectionGuide(true);
              }}
            >
              AI connections
            </button>
            {isAuthenticated ? (
              <AccountMenu variant="landing" />
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
                <span ref={heroDecisionRef} className="systema-accent-text">
                  every decision.
                </span>
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
              <button
                type="button"
                className="systema-text-link systema-text-button"
                aria-haspopup="dialog"
                aria-controls="ai-connection-guide-dialog"
                onClick={() => setShowAiConnectionGuide(true)}
              >
                Connect an AI assistant <HiArrowRight aria-hidden="true" />
              </button>
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
              <div>
                <h3>
                  Practice system design <HiArrowUpRight />
                </h3>
                <p>
                  Choose a realistic prompt—from AI/ML systems to core
                  infrastructure—with clear requirements, constraints, and a
                  workspace for your answer.
                </p>
              </div>
            </Link>
            <Link to="/learning-paths/" className="systema-feature">
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
            <Link to="/problems/" className="systema-feature">
              <div>
                <h3>
                  Get a guided walkthrough <HiArrowUpRight />
                </h3>
                <p>
                  Follow step-by-step guidance on supported problems and learn
                  the reasoning behind each design decision.
                </p>
              </div>
            </Link>
            <Link to="/playground/free" className="systema-feature">
              <div>
                <h3>
                  Start from a blank canvas <HiArrowUpRight />
                </h3>
                <p>
                  Sketch freely. Once your design is saved and you’re signed in,
                  invite teammates to collaborate in real time and share a live
                  link.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section
          id="features"
          className="systema-product-features systema-container"
          aria-labelledby="systema-product-features-title"
        >
          <div className="systema-product-features-heading">
            <span>FEATURES</span>
            <h2 id="systema-product-features-title">
              More support when
              <br />
              <span>you need it.</span>
            </h2>
            <p>
              Learn the fundamentals, get help on a tough design, review your
              decisions, and bring your team into the work.
            </p>
          </div>
          <div className="systema-product-feature-list">
            <article className="systema-product-feature">
              <div className="systema-product-feature-copy">
                <span>01 / GUIDED PRACTICE</span>
                <h3>Step-by-step walkthroughs for supported problems.</h3>
                <p>
                  When you get stuck, follow structured prompts that explain the
                  reasoning behind each design decision while leaving room for
                  you to think it through.
                </p>
                <Link className="systema-text-link" to="/problems/">
                  Find a problem with a walkthrough <HiArrowUpRight />
                </Link>
              </div>
              <div className="systema-product-feature-visual">
                <FeatureArt type="review" />
              </div>
            </article>
            <article className="systema-product-feature systema-product-feature--reverse">
              <div className="systema-product-feature-copy">
                <span>02 / LEARNING PATHS</span>
                <h3>Build your system design skills in sequence.</h3>
                <p>
                  Follow curated modules and hands-on lessons that take you from
                  core concepts to applying them in realistic design problems.
                </p>
                <Link className="systema-text-link" to="/learning-paths/">
                  Browse learning paths <HiArrowUpRight />
                </Link>
              </div>
              <div className="systema-product-feature-visual">
                <FeatureArt type="reason" />
              </div>
            </article>
            <article className="systema-product-feature">
              <div className="systema-product-feature-copy">
                <span>03 / DESIGN REVIEW</span>
                <h3>Turn an architecture into clear next steps.</h3>
                <p>
                  Get structured AI feedback on requirement coverage,
                  scalability, reliability, data design, and trade-offs so you
                  can see what to strengthen next.
                </p>
                <Link className="systema-text-link" to="/playground/free">
                  Try a design review <HiArrowUpRight />
                </Link>
              </div>
              <div className="systema-product-feature-visual">
                <FeatureArt type="assessment" />
              </div>
            </article>
            <article className="systema-product-feature systema-product-feature--reverse">
              <div className="systema-product-feature-copy">
                <span>04 / TEAMWORK</span>
                <h3>Design together on a shared canvas.</h3>
                <p>
                  Save a design and sign in to invite teammates to collaborate
                  in real time. Export the architecture or share a live link
                  when you are ready.
                </p>
                <Link className="systema-text-link" to="/playground/free">
                  Open Design Studio <HiArrowUpRight />
                </Link>
              </div>
              <div className="systema-product-feature-visual">
                <FeatureArt type="share" />
              </div>
            </article>
          </div>
        </section>

        <section
          className="systema-toolkit systema-container"
          aria-labelledby="systema-toolkit-title"
        >
          <div className="systema-toolkit-heading">
            <span>DIAGRAM TOOLS</span>
            <h2 id="systema-toolkit-title">
              Make each diagram
              <br />
              <span>clearer to reason about.</span>
            </h2>
          </div>
          <div className="systema-toolkit-grid">
            <article>
              <span className="systema-toolkit-index">01</span>
              <FeatureArt type="library" variant="toolkit" />
              <h3>Architecture library</h3>
              <p>
                Start with generic building blocks or use accurate AWS, Azure,
                and GCP components across cloud, ER, and UML diagrams.
              </p>
            </article>
            <article>
              <span className="systema-toolkit-index">02</span>
              <FeatureArt type="annotate" variant="toolkit" />
              <h3>Connected, annotated diagrams</h3>
              <p>
                Draw labeled data flows and attach notes, metadata, and custom
                fields to explain every important decision.
              </p>
            </article>
          </div>
        </section>

        <section
          id="simulator-and-mcp"
          className="systema-value systema-simulate systema-container"
          aria-labelledby="systema-simulate-title"
        >
          <div className="systema-value-heading">
            <span>SIMULATOR &amp; MCP</span>
            <h2 id="systema-simulate-title">
              Test the design.
              <br />
              <span>Bring your AI.</span>
            </h2>
          </div>
          <div className="systema-value-grid systema-value-grid--two">
            <article>
              <span className="systema-value-index">01</span>
              <h3>Architecture simulator</h3>
              <p>
                Run live traffic through your design. Set the load up to 100,000
                requests per second, pick a steady, ramp-up, burst, or
                daily-cycle pattern, and watch each component’s throughput, busy
                level, and failures change in real time. Slow a component down
                or make it return errors to see where the design breaks.
              </p>
              <Link
                className="systema-text-link systema-value-link"
                to="/playground/free"
              >
                Open Design Studio and select Simulate{" "}
                <HiArrowUpRight aria-hidden="true" />
              </Link>
            </article>
            <article>
              <span className="systema-value-index">02</span>
              <h3>Diagramwise MCP server</h3>
              <p>
                Connect ChatGPT, Claude, or Gemini to the Diagramwise MCP server
                at <code>https://mcp.diagramwise.com/mcp</code>. Describe the
                architecture you want and your assistant creates and saves it to
                your Diagramwise account, ready to refine on the canvas.
              </p>
              <button
                type="button"
                className="systema-text-link systema-text-button systema-value-link"
                aria-haspopup="dialog"
                aria-controls="ai-connection-guide-dialog"
                onClick={() => setShowAiConnectionGuide(true)}
              >
                Set up the MCP connection <HiArrowRight aria-hidden="true" />
              </button>
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
          onLogin={(email, password) => login({ email, password })}
          onSignup={(email, password, name) =>
            signup({ email, password, name })
          }
          onGoogleLogin={googleLogin}
        />
      )}
      {showAiConnectionGuide && (
        <AiConnectionGuideDialog
          onClose={() => setShowAiConnectionGuide(false)}
        />
      )}
      <footer className="systema-footer systema-container">
        <Brand />
        <p>Design. Explain. Improve.</p>
        <nav className="systema-footer-links" aria-label="Footer">
          <a href="/about/">About</a>
          <a href="https://next-zen.dev/">Next Zen</a>
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
