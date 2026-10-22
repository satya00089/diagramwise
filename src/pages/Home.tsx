import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ThemeSwitcher from "../components/ThemeSwitcher";
import AccountMenu from "../components/AccountMenu";
import UserAvatar from "../components/UserAvatar";
import RollingNavLabel from "../components/RollingNavLabel";
import { useTheme } from "../hooks/useTheme";
import SEO from "../components/SEO";
import { useAuth } from "../hooks/useAuth";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTour } from "../hooks/useTour";
import useAnalytics from "../hooks/useAnalytics";
import { MdHelpOutline } from "react-icons/md";
import { apiService } from "../services/api";
import type { SavedDiagram, SavedDiagramSummary } from "../types/auth";
import { useRoughAnnotation } from "../hooks/useRoughAnnotation";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { VscAzureDevops, VscAzure } from "react-icons/vsc";
import { SiGooglecloud } from "react-icons/si";
import { FaAws } from "react-icons/fa6";
import { FaServer, FaBolt, FaNetworkWired, FaCloud } from "react-icons/fa";
import {
  HiAcademicCap,
  HiPencilSquare,
  HiCube,
  HiCloud,
  HiArrowsRightLeft,
  HiAdjustmentsHorizontal,
  HiSparkles,
  HiArrowUpTray,
  HiDocumentText,
  HiUserGroup,
  HiBriefcase,
} from "react-icons/hi2";

const AuthModal = lazyWithRetry(
  () =>
    import("../components/AuthModal").then((module) => ({
      default: module.AuthModal,
    })),
  "auth-modal",
);

const HERO_MESSAGE = "Get them reviewed.";

const HERO_ICONS: {
  id: string;
  Icon: React.ComponentType<{ size?: number }>;
  top: number;
  left: number;
  size: number;
  depth: number;
  animDur: string;
  animDelay: string;
}[] = [
  {
    id: "aws",
    Icon: FaAws,
    top: 8,
    left: 74,
    size: 48,
    depth: 28,
    animDur: "22s",
    animDelay: "0s",
  },
  {
    id: "azure",
    Icon: VscAzure,
    top: 55,
    left: 18,
    size: 48,
    depth: 16,
    animDur: "30s",
    animDelay: "4s",
  },
  {
    id: "gcp",
    Icon: SiGooglecloud,
    top: 58,
    left: 80,
    size: 48,
    depth: 22,
    animDur: "26s",
    animDelay: "2s",
  },
  {
    id: "ec2",
    Icon: FaServer,
    top: 8,
    left: 21,
    size: 48,
    depth: 32,
    animDur: "20s",
    animDelay: "6s",
  },
  {
    id: "elb",
    Icon: FaNetworkWired,
    top: 42,
    left: 4,
    size: 48,
    depth: 18,
    animDur: "28s",
    animDelay: "8s",
  },
  {
    id: "lambda",
    Icon: FaBolt,
    top: 84,
    left: 8,
    size: 42,
    depth: 24,
    animDur: "24s",
    animDelay: "3s",
  },
  {
    id: "devops",
    Icon: VscAzureDevops,
    top: 86,
    left: 68,
    size: 42,
    depth: 14,
    animDur: "32s",
    animDelay: "5s",
  },
  {
    id: "amplify",
    Icon: FaCloud,
    top: 83,
    left: 88,
    size: 42,
    depth: 30,
    animDur: "18s",
    animDelay: "7s",
  },
];

const FEATURE_DELAYS = ["delay-0", "delay-100", "delay-200", "delay-300"];
const CAPABILITY_DELAYS = [
  "delay-0",
  "delay-[50ms]",
  "delay-[100ms]",
  "delay-[150ms]",
  "delay-[200ms]",
  "delay-[250ms]",
];

const getDelayClass = (delays: string[], index: number) =>
  delays[index] ?? delays.at(-1);

const getRandomUnit = () => {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] / 2 ** 32;
};

const pluralize = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

const PermissionIcon: React.FC<{ permission: SavedDiagram["permission"] }> = ({
  permission,
}) => {
  if (permission === "edit") {
    return (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    );
  }

  return (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  );
};

const PermissionBadge: React.FC<{
  permission: SavedDiagram["permission"];
}> = ({ permission }) => {
  const isEditable = permission === "edit";
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all duration-300 ${
        isEditable
          ? "bg-emerald-600 text-white hover:shadow-sm"
          : "bg-slate-500 text-white hover:shadow-sm"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <PermissionIcon permission={permission} />
      </svg>
      <span>{isEditable ? "Can Edit" : "View Only"}</span>
    </div>
  );
};

const Home: React.FC = () => {
  const location = useLocation();
  const isBackupLanding = location.pathname.startsWith("/landing-backup");
  useTheme();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, login, signup, googleLogin } =
    useAuth();
  const { trackEvent, trackPageView } = useAnalytics({ isEnabled: true });
  const { markPageVisited } = useOnboarding();
  const { startTour } = useTour("home");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagramSummary[]>([]);
  const [loadingDiagrams, setLoadingDiagrams] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLSpanElement>(null);
  const learningLoopTitleRef = useRef<HTMLHeadingElement>(null);
  const architectureLabelRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePxRef = useRef({ x: -9999, y: -9999 });

  const roughAnnotationTargets = useMemo(
    () => [
      {
        ref: heroTitleRef,
        config: {
          type: "underline" as const,
          color: "#67e8f9",
          strokeWidth: 3,
          padding: 3,
          iterations: 2,
          animationDuration: 700,
        },
      },
      {
        ref: learningLoopTitleRef,
        config: {
          type: "highlight" as const,
          color: "#fde68a",
          padding: 2,
          iterations: 1,
          animationDuration: 850,
        },
      },
      {
        ref: architectureLabelRef,
        config: {
          type: "bracket" as const,
          brackets: "left" as const,
          color: "#6366f1",
          strokeWidth: 2,
          padding: 6,
          iterations: 2,
          animationDuration: 650,
        },
      },
    ],
    [],
  );

  useRoughAnnotation(roughAnnotationTargets);

  const handleNavigate = (route: string, requiresAuth = true) => {
    trackEvent("homepage_cta_clicked", {
      cta: route === "/problems" ? "start_design_challenge" : route,
      destination: route,
    });
    if (requiresAuth && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    navigate(route);
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Keep onboarding discoverable through the Tour control without replacing
  // the hero during the page's initial loading and LCP measurement window.
  useEffect(() => {
    const schedule = window.setTimeout(() => {
      markPageVisited("home");
      try {
        trackPageView();
      } catch {
        // Analytics is best-effort and must never affect page readiness.
      }
    }, 5000);

    return () => window.clearTimeout(schedule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load user's diagrams when authenticated
  useEffect(() => {
    const loadDiagrams = async () => {
      if (!isAuthenticated) {
        setSavedDiagrams([]);
        return;
      }

      setLoadingDiagrams(true);
      try {
        const diagrams = await apiService.getUserDiagrams();
        setSavedDiagrams(diagrams);
      } catch (error) {
        console.error("Failed to load diagrams:", error);
      } finally {
        setLoadingDiagrams(false);
      }
    };

    void loadDiagrams();
  }, [isAuthenticated]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      mousePxRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      mousePxRef.current = { x: -9999, y: -9999 };
    };
    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", onLeave);
    return () => {
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const N = window.matchMedia("(max-width: 768px)").matches ? 30 : 44;
    const LINK_DIST = 135;
    type P = { x: number; y: number; vx: number; vy: number };
    let particles: P[] = [];
    let W = 0;
    let H = 0;
    let rafId = 0;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      if (W === 0 || H === 0) return;
      canvas.width = W;
      canvas.height = H;
    };

    const updateParticle = (p: P, mx: number, my: number) => {
      const dx = p.x - mx;
      const dy = p.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 14400 && d2 > 0) {
        const d = Math.sqrt(d2);
        const f = ((120 - d) / 120) * 0.07;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
      p.vx *= 0.987;
      p.vy *= 0.987;
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > 1.4) {
        p.vx = (p.vx / spd) * 1.4;
        p.vy = (p.vy / spd) * 1.4;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx);
      } else if (p.x > W) {
        p.x = W;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy);
      } else if (p.y > H) {
        p.y = H;
        p.vy = -Math.abs(p.vy);
      }
    };

    const drawLinks = () => {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DIST) {
            ctx.globalAlpha = (1 - dist / LINK_DIST) * 0.2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const drawParticles = () => {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.35;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let isPageVisible = document.visibilityState === "visible";

    let lastFrameTime = 0;
    const frame = (timestamp: number) => {
      if (!isPageVisible) return;
      if (timestamp - lastFrameTime < 1000 / 30) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastFrameTime = timestamp;
      if (W === 0 || H === 0) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mousePxRef.current;
      particles.forEach((particle) => updateParticle(particle, mx, my));
      drawLinks();
      drawParticles();
      rafId = requestAnimationFrame(frame);
    };

    resize();
    particles = Array.from({ length: N }, () => ({
      x: getRandomUnit() * W,
      y: getRandomUnit() * H,
      vx: (getRandomUnit() - 0.5) * 0.55,
      vy: (getRandomUnit() - 0.5) * 0.55,
    }));
    rafId = requestAnimationFrame(frame);

    const onResize = () => resize();
    const onVisibilityChange = () => {
      isPageVisible = document.visibilityState === "visible";
      if (isPageVisible) rafId = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal-visible");
        }),
      { threshold: 0.1 },
    );
    document
      .querySelectorAll("[data-reveal-group], [data-reveal]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleOpenDiagram = (diagramId: string) => {
    handleNavigate(`/playground/free?diagramId=${diagramId}`);
  };

  const features = [
    {
      icon: <HiAcademicCap className="w-8 h-8" />,
      title: "Follow a learning path",
      description:
        "Build system design fundamentals step by step with structured modules and hands-on lessons.",
      action: "Browse learning paths",
      route: "/learning-paths/",
      requiresAuth: false,
    },
    {
      icon: <HiDocumentText className="w-8 h-8" />,
      title: "Practice system design",
      description:
        "Choose a realistic architecture prompt with requirements, constraints, and a workspace for your answer.",
      action: "Choose a challenge",
      route: "/problems",
      requiresAuth: false,
    },
    {
      icon: <HiSparkles className="w-8 h-8" />,
      title: "Review your architecture",
      description:
        "Get feedback on scalability, reliability, data design, performance, security, and trade-offs.",
      action: "See how review works",
      route: "/problems",
      requiresAuth: false,
    },
    {
      icon: <HiPencilSquare className="w-8 h-8" />,
      title: "Start from a blank canvas",
      description:
        "Sketch freely when you already know what you want to explore. Save and share when you are ready.",
      action: "Open Canvas",
      route: "/playground/free",
      requiresAuth: true,
    },
  ];

  const capabilities = [
    {
      icon: <HiCube className="w-6 h-6" />,
      title: "Architecture components",
      description:
        "Start with generic architecture building blocks, then filter into cloud, ER, UML, or provider-specific components.",
    },
    {
      icon: <HiCloud className="w-6 h-6" />,
      title: "Cloud Providers",
      description:
        "AWS, Azure, and GCP components for accurate cloud architecture diagrams.",
    },
    {
      icon: <HiArrowsRightLeft className="w-6 h-6" />,
      title: "Smart Connections",
      description:
        "Draw labeled edges to show data flow, dependencies, and relationships.",
    },
    {
      icon: <HiAdjustmentsHorizontal className="w-6 h-6" />,
      title: "Custom Properties",
      description:
        "Attach notes, metadata, and custom fields to any component.",
    },
    {
      icon: <HiSparkles className="w-6 h-6" />,
      title: "Structured AI assessment",
      description:
        "See what is strong, what is risky, and what to improve next — with interview follow-up questions tailored to your design.",
    },
    {
      icon: <HiArrowUpTray className="w-6 h-6" />,
      title: "Export & Share",
      description: "Export as an image or share a live link with teammates.",
    },
  ];

  const useCases = [
    {
      icon: <HiAcademicCap className="w-6 h-6" />,
      iconColor: "text-blue-500",
      bg: "bg-blue-500/10",
      title: "Students",
      description:
        "Learn system design concepts through hands-on practice with real-world problems.",
      action: "Start practicing",
    },
    {
      icon: <HiBriefcase className="w-6 h-6" />,
      iconColor: "text-purple-500",
      bg: "bg-purple-500/10",
      title: "Professionals",
      description:
        "Plan and document architecture for your projects with a shareable visual canvas.",
      action: "Start designing",
    },
    {
      icon: <HiUserGroup className="w-6 h-6" />,
      iconColor: "text-orange-500",
      bg: "bg-orange-500/10",
      title: "Educators",
      description:
        "Create custom problems and assignments for students to tackle independently.",
      action: "Create a problem",
    },
  ];

  const landingCardClass =
    "relative overflow-hidden rounded-[1.5rem] border border-theme/10 elevated-card-bg shadow-[0_18px_50px_rgba(0,0,0,0.12)]";

  return (
    <>
      <SEO
        title="Diagramwise — Design architectures. Get them reviewed."
        description="Practice system design by building architectures visually, explaining your assumptions, and getting structured feedback on scalability, reliability, data design, and trade-offs."
        keywords="system design, architecture diagram, system design interview, software architecture, distributed systems, scalable architecture, system design tool, architecture playground, cloud architecture, microservices design, ER diagram, entity relationship diagram, UML diagram, class diagram, database design"
        image="https://diagramwise.com/og/home.png"
        imageAlt="Diagramwise homepage preview"
        url={
          isBackupLanding
            ? "https://diagramwise.com/landing-backup/"
            : "https://diagramwise.com/"
        }
        noIndex={isBackupLanding}
      />
      <div className="home-page min-h-screen bg-[var(--bg)] text-theme relative grid-pattern-overlay">
        {/* Header */}
        <header
          className={`landing-header fixed left-0 right-0 z-50 transition-all duration-300 ${
            isScrolled
              ? "shadow-lg backdrop-blur-md bg-[var(--brand)]/90"
              : "bg-[var(--brand)]"
          }`}
          style={{ top: "var(--announcement-h, 0px)" }}
        >
          {/* Scroll progress bar */}
          <div
            className="absolute bottom-0 left-0 h-[2px] bg-white/40 pointer-events-none transition-none"
            style={{ width: `${scrollProgress}%` }}
            aria-hidden="true"
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                type="button"
                onClick={() => handleNavigate("/", false)}
                className="flex items-center space-x-3 group cursor-pointer"
              >
                <img
                  src="/logo-64.png"
                  alt="Logo"
                  className="h-7 transition-transform group-hover:scale-110 duration-300"
                />
                <span className="text-lg font-bold text-white tracking-wide leading-none">
                  Diagramwise
                </span>
              </button>
              <nav
                aria-label="Primary navigation"
                className="flex items-center gap-2 lg:gap-4"
              >
                <button
                  type="button"
                  onClick={() => handleNavigate("/problems", false)}
                  className="landing-header-link hidden md:block px-4 py-2 text-sm font-medium text-white hover:text-white/80 transition-colors cursor-pointer"
                >
                  <RollingNavLabel>Problems</RollingNavLabel>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("/learning-paths/", false)}
                  className="landing-header-link hidden lg:block px-4 py-2 text-sm font-medium text-white hover:text-white/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand)]"
                >
                  <RollingNavLabel>Learning Paths</RollingNavLabel>
                </button>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/diagrams")}
                    className="landing-header-link hidden md:block px-4 py-2 text-sm font-medium text-white hover:text-white/80 transition-colors cursor-pointer"
                  >
                    <RollingNavLabel>My Designs</RollingNavLabel>
                  </button>
                )}

                {/* Tour trigger */}
                <button
                  type="button"
                  onClick={startTour}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                >
                  <MdHelpOutline className="h-4 w-4" />
                  <span className="hidden sm:inline">Tour</span>
                </button>

                <ThemeSwitcher />

                {/* Authentication UI */}
                {isAuthenticated ? (
                  <AccountMenu variant="inverse" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 text-sm font-medium bg-white/20 text-white rounded-md hover:bg-white/30 transition-colors"
                  >
                    Sign In
                  </button>
                )}
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-16">
          {/* Hero Background Card */}
          <div
            ref={heroRef}
            className="relative overflow-hidden bg-[var(--brand)] flex flex-col min-h-[calc(100vh-4rem)]"
          >
            {/* Aurora gradient layer */}
            <div
              className="hero-aurora absolute inset-0 pointer-events-none"
              aria-hidden="true"
            />
            {/* Particle network canvas */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
            {/* Animated decorative graph */}
            <div className="absolute inset-0 pointer-events-none">
              {/* SVG connection lines */}
              {/* Parallax floating nodes */}
              {HERO_ICONS.map((ic) => (
                <div
                  key={ic.id}
                  className="absolute"
                  style={{
                    top: `${ic.top}%`,
                    left: `${ic.left}%`,
                  }}
                >
                  <div
                    className="w-14 h-14 sm:w-20 sm:h-20 text-white/10"
                    style={{
                      animation: `hero-float ${ic.animDur} ease-in-out infinite`,
                      animationDelay: ic.animDelay,
                    }}
                  >
                    <ic.Icon size={ic.size} />
                  </div>
                </div>
              ))}
            </div>

            {/* Grid overlay for design aesthetic */}
            <div className="absolute inset-0 opacity-[0.03] hero-grid-overlay" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col items-center justify-center py-12 sm:py-16 w-full">
              <div
                className={`relative z-10 text-center transition-all duration-1000 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
              >
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-[1.05] tracking-[-0.03em] text-white max-w-4xl">
                  Design <span ref={heroTitleRef}>architectures.</span>
                </h1>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-[1.05] tracking-[-0.03em] text-white max-w-4xl">
                  <span
                    className="text-white/80 inline-block min-h-[1.05em]"
                    aria-label={HERO_MESSAGE}
                  >
                    {HERO_MESSAGE}
                  </span>
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-white/75 max-w-2xl mx-auto mb-8 leading-relaxed">
                  Build a real architecture, explain the decisions behind it,
                  and see where it breaks before the interviewer does. Practice
                  scalability, reliability, data design, and trade-offs with
                  feedback grounded in your diagram.
                </p>
                <div
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                  data-tour="hero-cta"
                >
                  <button
                    type="button"
                    data-tour="nav-problems"
                    onClick={() => handleNavigate("/problems", false)}
                    className="px-7 py-3.5 bg-white text-[var(--brand)] text-base font-semibold rounded-lg hover:shadow-lg cursor-pointer btn-shimmer"
                  >
                    Start a design challenge →
                  </button>
                  <button
                    type="button"
                    data-tour="nav-studio"
                    onClick={() => handleNavigate("/playground/free")}
                    className="px-7 py-3.5 bg-white/10 border border-white/25 text-white/85 text-base font-medium rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  >
                    Open blank canvas
                  </button>
                </div>

                <p className="mt-5 text-xs text-white/65 max-w-xl mx-auto">
                  Try the workflow before signing in. Create an account when you
                  want to save, sync, or share your work.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate("/learning-paths/", false)}
                  className="mt-3 inline-flex items-center justify-center text-sm font-medium text-white/85 underline decoration-white/35 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--brand)]"
                >
                  New to system design? Browse learning paths →
                </button>
              </div>
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-40 pointer-events-none scroll-cue">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* The product loop: a concrete preview of what happens after the click. */}
        <section className="landing-deferred-section relative px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="mb-10">
              <p className="landing-accent-copy mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
                The learning loop
              </p>
              <span
                ref={learningLoopTitleRef}
                className="text-3xl font-bold tracking-[-0.03em] text-black sm:text-4xl"
              >
                Don&apos;t just draw the boxes. Defend the decisions.
              </span>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
                Diagramwise turns an interview prompt into a design you can
                inspect, explain, and improve.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
              <div className="rounded-2xl border border-theme/10 bg-[var(--surface)] p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
                <div className="mb-5 flex items-center justify-between">
                  <span
                    ref={architectureLabelRef}
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-muted"
                  >
                    Problem
                  </span>
                  <span className="rounded-full bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-medium text-[var(--brand)]">
                    Medium
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-theme">
                  Design a video-sharing platform
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Support millions of uploads and global playback while keeping
                  video processing asynchronous.
                </p>
                <div className="mt-6 space-y-2 text-xs text-muted">
                  <div className="flex justify-between border-b border-theme/10 pb-2">
                    <span>Scale</span>
                    <span className="font-medium text-theme">10M DAU</span>
                  </div>
                  <div className="flex justify-between border-b border-theme/10 pb-2">
                    <span>Latency</span>
                    <span className="font-medium text-theme">
                      p95 &lt; 200ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Availability</span>
                    <span className="font-medium text-theme">99.99%</span>
                  </div>
                </div>
              </div>

              <div
                className="hidden items-center justify-center text-2xl text-[var(--brand)] lg:flex"
                aria-hidden="true"
              >
                →
              </div>

              <div className="rounded-2xl border border-theme/10 bg-[var(--surface)] p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    Your architecture
                  </span>
                  <span className="text-xs text-muted">5 components</span>
                </div>
                <div className="h-40 overflow-hidden rounded-xl bg-[var(--bg)] p-2">
                  <svg
                    className="h-full w-full"
                    viewBox="0 0 600 280"
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label="Video upload architecture"
                    aria-describedby="architecture-preview-description"
                  >
                    <desc id="architecture-preview-description">
                      API Gateway routes uploads to an Upload Service, which
                      stores video objects and sends processing work through a
                      queue to a metadata database.
                    </desc>
                    <defs>
                      <marker
                        id="architecture-arrow"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path
                          d="M 0 0 L 8 4 L 0 8 Z"
                          fill="var(--brand)"
                          opacity="0.72"
                        />
                      </marker>
                    </defs>

                    <g
                      fill="none"
                      stroke="var(--brand)"
                      strokeOpacity="0.52"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd="url(#architecture-arrow)"
                    >
                      <path d="M 140 136 H 175 Q 190 136 190 121 V 82 Q 190 66 206 66 H 220" />
                      <path d="M 370 66 H 440" />
                      <path d="M 295 92 V 190" />
                      <path d="M 355 216 H 430" />
                    </g>
                    <circle
                      cx="295"
                      cy="122"
                      r="4"
                      fill="var(--brand)"
                      opacity="0.72"
                    />

                    <g>
                      <rect
                        x="20"
                        y="110"
                        width="120"
                        height="52"
                        rx="12"
                        fill="rgba(14,165,233,0.12)"
                        stroke="rgba(14,165,233,0.72)"
                        strokeWidth="1.5"
                      />
                      <text
                        x="80"
                        y="141"
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize="15"
                        fontWeight="600"
                      >
                        API Gateway
                      </text>
                    </g>
                    <g>
                      <rect
                        x="220"
                        y="40"
                        width="150"
                        height="52"
                        rx="12"
                        fill="rgba(139,92,246,0.12)"
                        stroke="rgba(139,92,246,0.72)"
                        strokeWidth="1.5"
                      />
                      <text
                        x="295"
                        y="71"
                        textAnchor="middle"
                        fill="#a78bfa"
                        fontSize="15"
                        fontWeight="600"
                      >
                        Upload Service
                      </text>
                    </g>
                    <g>
                      <rect
                        x="235"
                        y="190"
                        width="120"
                        height="52"
                        rx="12"
                        fill="rgba(245,158,11,0.12)"
                        stroke="rgba(245,158,11,0.72)"
                        strokeWidth="1.5"
                      />
                      <text
                        x="295"
                        y="221"
                        textAnchor="middle"
                        fill="#fbbf24"
                        fontSize="15"
                        fontWeight="600"
                      >
                        Queue
                      </text>
                    </g>
                    <g>
                      <rect
                        x="440"
                        y="40"
                        width="140"
                        height="52"
                        rx="12"
                        fill="rgba(16,185,129,0.12)"
                        stroke="rgba(16,185,129,0.72)"
                        strokeWidth="1.5"
                      />
                      <text
                        x="510"
                        y="71"
                        textAnchor="middle"
                        fill="#34d399"
                        fontSize="15"
                        fontWeight="600"
                      >
                        Object Storage
                      </text>
                    </g>
                    <g>
                      <rect
                        x="430"
                        y="190"
                        width="150"
                        height="52"
                        rx="12"
                        fill="rgba(244,63,94,0.12)"
                        stroke="rgba(244,63,94,0.72)"
                        strokeWidth="1.5"
                      />
                      <text
                        x="505"
                        y="221"
                        textAnchor="middle"
                        fill="#fb7185"
                        fontSize="15"
                        fontWeight="600"
                      >
                        Metadata DB
                      </text>
                    </g>
                  </svg>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Add components, label data flow, and write down the
                  assumptions behind each choice.
                </p>
              </div>

              <div
                className="hidden items-center justify-center text-2xl text-[var(--brand)] lg:flex"
                aria-hidden="true"
              >
                →
              </div>

              <div
                className="rounded-2xl border border-[var(--brand)]/20 bg-[var(--surface)] p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)]"
                style={{
                  background:
                    "color-mix(in srgb, var(--brand) 8%, var(--surface))",
                }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    Architecture review
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                    Needs work
                  </span>
                </div>
                <p className="text-sm font-semibold text-theme">
                  Strong asynchronous boundary. Reliability needs attention.
                </p>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex gap-2">
                    <span className="text-emerald-500">✓</span>
                    <span className="text-muted">
                      <strong className="text-theme">Good:</strong> object
                      storage and a queue keep uploads off the request path.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-500">!</span>
                    <span className="text-muted">
                      <strong className="text-theme">Important:</strong> the
                      queue is a single point of failure.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-rose-500">!</span>
                    <span className="text-muted">
                      <strong className="text-theme">Missing:</strong> rate
                      limiting and cache-failure behavior.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate("/problems", false)}
                  className="mt-6 text-sm font-semibold text-[var(--brand)] hover:underline"
                >
                  Try a challenge →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* My Diagrams Section - Only shown when authenticated */}
        {isAuthenticated && (
          <section className="landing-deferred-section py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-7xl mx-auto relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="landing-accent-copy text-2xl text-[var(--brand)] font-bold mb-1">
                    My Designs
                  </h2>
                  <p className="text-muted">
                    Your saved diagrams and shared workspaces
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {savedDiagrams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleNavigate("/diagrams")}
                      className="px-5 py-2.5 text-sm font-medium text-theme hover:text-[var(--brand)] transition-colors"
                    >
                      View All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNavigate("/playground/free")}
                    className="px-3 py-2 bg-[var(--brand)] text-white font-semibold rounded-lg hover:brightness-95 transition-all flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    New Design
                  </button>
                </div>
              </div>

              {(() => {
                if (loadingDiagrams) {
                  return (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)]"></div>
                    </div>
                  );
                }

                if (savedDiagrams.length === 0) {
                  return (
                    <div className="text-center py-12 rounded-xl border border-theme/10 p-8 elevated-card-bg">
                      <div className="flex justify-center mb-4 text-[var(--brand)]/40">
                        <HiPencilSquare className="w-14 h-14" />
                      </div>
                      <h3 className="text-xl font-semibold text-theme mb-2">
                        No designs yet
                      </h3>
                      <p className="text-muted mb-6">
                        Create your first design — it only takes a minute.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/playground/free")}
                        className="px-6 py-3 bg-[var(--brand)] text-white font-semibold rounded-lg hover:brightness-95 transition-all"
                      >
                        Create Your First Design
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedDiagrams.slice(0, 6).map((diagram) => (
                      <button
                        type="button"
                        key={diagram.id}
                        onClick={() => handleOpenDiagram(diagram.id)}
                        className="group rounded-xl border border-theme/8 p-5 text-left hover:shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer elevated-card-bg"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-theme group-hover:text-[var(--brand)] transition-colors mb-1 line-clamp-1">
                              {diagram.title}
                            </h3>

                            {/* Owner Info & Permission Badges */}
                            {!diagram.isOwner && (
                              <div className="mb-2 flex items-center gap-2 flex-wrap">
                                {/* Owner Info Badge */}
                                <div className="group/owner relative rounded-lg bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1.5 border border-purple-200/60 dark:border-purple-700/40 transition-all duration-300 inline-flex items-center gap-2">
                                  <div className="relative flex items-center gap-1.5">
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                      <UserAvatar
                                        userId={diagram.owner.id}
                                        picture={diagram.owner.pictureUrl}
                                        avatarKey={diagram.owner.avatarKey}
                                        size={20}
                                        alt={diagram.owner.name}
                                        className="w-5 h-5 rounded-full object-cover ring-1 ring-purple-300 dark:ring-purple-600"
                                      />
                                      {/* Online indicator */}
                                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900" />
                                    </div>

                                    {/* Owner Name */}
                                    <div className="flex items-center gap-1">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                        aria-hidden="true"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                        />
                                      </svg>
                                      <span className="text-xs font-bold text-purple-800 dark:text-purple-300">
                                        {diagram.owner.name}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <PermissionBadge
                                  permission={diagram.permission}
                                />
                              </div>
                            )}

                            {diagram.description && (
                              <p className="text-sm text-muted line-clamp-2">
                                {diagram.description}
                              </p>
                            )}
                          </div>
                          <div className="ml-2 text-muted/30">
                            <HiCube className="w-7 h-7" />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted mb-4">
                          <span className="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                              />
                            </svg>
                            {pluralize(diagram.nodeCount, "node")}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                              />
                            </svg>
                            {pluralize(diagram.edgeCount, "connection")}
                          </span>
                        </div>

                        <div className="text-xs text-muted">
                          Updated{" "}
                          {new Date(diagram.updatedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* Feature Cards */}
        <section className="landing-deferred-section py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <h2
              className="landing-accent-copy text-2xl md:text-3xl text-[var(--brand)] font-bold tracking-tight text-center mb-3"
              data-reveal
            >
              Choose Your Path
            </h2>
            <p className="text-muted text-center mb-12 max-w-xl mx-auto leading-relaxed">
              Choose the route that matches how you want to build your system
              design skills.
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8"
              data-reveal-group
            >
              {features.map((feature, index) => {
                const delay = getDelayClass(FEATURE_DELAYS, index);
                return (
                  <button
                    type="button"
                    key={feature.title}
                    className={`group ${landingCardClass} p-5 sm:p-7 text-left cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)] ${delay}`}
                    onClick={() =>
                      handleNavigate(feature.route, feature.requiresAuth)
                    }
                    aria-label={`${feature.action}: ${feature.title}`}
                  >
                    <div className="mb-5 text-[var(--brand)]">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-theme group-hover:text-[var(--brand)] transition-colors duration-200">
                      {feature.title}
                    </h3>
                    <p className="text-muted mb-5 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                    <div className="inline-flex items-center gap-1 text-[var(--brand)] font-medium text-sm">
                      {feature.action}{" "}
                      <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 ml-0.5">
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="landing-deferred-section py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <h2
              className="landing-accent-copy text-2xl md:text-3xl text-[var(--brand)] font-bold tracking-tight text-center mb-3"
              data-reveal
            >
              Powerful Features
            </h2>
            <p className="text-muted text-center mb-12 max-w-xl mx-auto leading-relaxed">
              Everything you need to design, document, and share system
              architectures
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
              data-reveal-group
            >
              {capabilities.map((capability, capIndex) => {
                const delay = getDelayClass(CAPABILITY_DELAYS, capIndex);
                return (
                  <div
                    key={capability.title}
                    className={`group ${landingCardClass} p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${delay}`}
                  >
                    <div className="mb-3 text-[var(--brand)]">
                      {capability.icon}
                    </div>
                    <h3 className="text-base font-semibold mb-1.5 text-theme">
                      {capability.title}
                    </h3>
                    <p className="text-muted text-sm leading-relaxed">
                      {capability.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="landing-deferred-section py-12 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <h2
              className="landing-accent-copy text-2xl md:text-3xl text-[var(--brand)] font-bold tracking-tight text-center mb-10"
              data-reveal
            >
              Built for learners and builders
            </h2>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10"
              data-reveal-group
            >
              {useCases.map((useCase) => (
                <div
                  key={useCase.title}
                  className="group text-center p-6 rounded-[1.5rem] border border-theme/10 elevated-card-bg shadow-[0_18px_50px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="relative inline-block mb-6">
                    <div
                      className={`relative w-14 h-14 mx-auto ${useCase.bg} ${useCase.iconColor} rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}
                    >
                      {useCase.icon}
                    </div>
                  </div>
                  <h3 className="text-base font-semibold mb-2 text-theme">
                    {useCase.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    {useCase.description}
                  </p>
                  <div className="inline-flex items-center gap-1.5 text-sm text-[var(--brand)] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {useCase.action} →
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="landing-deferred-section py-14 sm:py-24 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto relative" data-reveal>
            <div className="absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_20%_20%,rgba(0,214,255,0.18),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(4,217,160,0.14),transparent_30%),radial-gradient(circle_at_55%_45%,rgba(255,255,255,0.08),transparent_34%)] blur-2xl opacity-90 pointer-events-none" />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#031018] px-6 py-12 sm:px-12 sm:py-14 shadow-[0_26px_100px_rgba(0,0,0,0.62)]">
              <div className="absolute inset-0 cta-grid-overlay opacity-[0.12]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(1,6,10,0.35),rgba(2,54,68,0.62)_50%,rgba(0,0,0,0.28))]" />
              <div className="absolute -left-16 top-10 h-52 w-52 rounded-full bg-cyan-400/12 blur-3xl" />
              <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:items-center">
                <div className="max-w-2xl text-left">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                    Let&apos;s build from here
                  </h2>
                  <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/82">
                    Practice system design, map architectures, and turn ideas
                    into diagrams with a focused workspace that keeps the core
                    workflow simple.
                  </p>
                </div>

                <div className="lg:justify-self-end w-full max-w-xl">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavigate("/playground/free")}
                      className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded border px-8 font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
                    >
                      Browse Problems{" "}
                      <span aria-hidden="true" className="text-xl leading-none">
                        →
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/playground/free")}
                      className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded bg-white px-8 font-semibold text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-xl cursor-pointer"
                    >
                      Open Design Studio{" "}
                      <span aria-hidden="true" className="text-xl leading-none">
                        →
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-deferred-section py-12 px-4 sm:px-6 lg:px-8 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center space-x-3">
                <img src="./logo-64.png" alt="Logo" className="h-8" />
                <span className="font-semibold text-theme">Diagramwise</span>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                <nav aria-label="Footer" className="flex items-center gap-1">
                  <a
                    href="/privacy.html"
                    className="inline-flex min-h-9 items-center rounded px-2 text-sm text-muted transition-colors hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
                  >
                    Privacy
                  </a>
                  <a
                    href="/terms.html"
                    className="inline-flex min-h-9 items-center rounded px-2 text-sm text-muted transition-colors hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
                  >
                    Terms
                  </a>
                  <a
                    href="/support.html"
                    className="inline-flex min-h-9 items-center rounded px-2 text-sm text-muted transition-colors hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
                  >
                    Support
                  </a>
                </nav>
                <p className="text-muted text-sm">
                  © 2026 Diagramwise. Built with{" "}
                  <span className="inline-block animate-pulse">❤️</span> for
                  system designers
                </p>
              </div>
            </div>
          </div>
        </footer>

        <style>{`
        @property --au1x { syntax: '<percentage>'; initial-value: 20%; inherits: false; }
        @property --au1y { syntax: '<percentage>'; initial-value: 30%; inherits: false; }
        @property --au2x { syntax: '<percentage>'; initial-value: 76%; inherits: false; }
        @property --au2y { syntax: '<percentage>'; initial-value: 62%; inherits: false; }
        @property --au3x { syntax: '<percentage>'; initial-value: 48%; inherits: false; }
        @property --au3y { syntax: '<percentage>'; initial-value: 82%; inherits: false; }
        .hero-aurora {
          --au1x: 20%; --au1y: 30%;
          --au2x: 76%; --au2y: 62%;
          --au3x: 48%; --au3y: 82%;
          background:
            radial-gradient(ellipse 55% 42% at var(--au1x) var(--au1y), rgba(255,255,255,0.10) 0%, transparent 65%),
            radial-gradient(ellipse 48% 36% at var(--au2x) var(--au2y), rgba(255,255,255,0.07) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at var(--au3x) var(--au3y), rgba(255,255,255,0.05) 0%, transparent 65%);
          animation: au1 22s ease-in-out infinite alternate, au2 30s ease-in-out infinite alternate, au3 38s ease-in-out infinite alternate;
        }
        .landing-deferred-section {
          content-visibility: auto;
          contain-intrinsic-size: auto 700px;
        }
        @keyframes au1 { from { --au1x: 20%; --au1y: 30%; } to { --au1x: 34%; --au1y: 17%; } }
        @keyframes au2 { from { --au2x: 76%; --au2y: 62%; } to { --au2x: 63%; --au2y: 76%; } }
        @keyframes au3 { from { --au3x: 48%; --au3y: 82%; } to { --au3x: 38%; --au3y: 54%; } }
        @media (prefers-reduced-motion: reduce) {
          .hero-aurora { animation: none; }
        }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(3deg); }
          66%       { transform: translateY(-6px) rotate(-2deg); }
        }
        @keyframes shimmer-sweep {
          0%       { left: -100%; }
          60%, 100% { left: 150%; }
        }
        .btn-shimmer {
          position: relative;
          overflow: hidden;
        }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          animation: shimmer-sweep 3s ease-in-out infinite;
        }
        .cta-grid-overlay {
          background-image:
            linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 45%, transparent 100%);
        }
        /* Scroll-driven staggered card reveals */
        [data-reveal-group] > * {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.55s ease, transform 0.55s ease;
        }
        [data-reveal-group] > *:nth-child(1) { transition-delay:   0ms; }
        [data-reveal-group] > *:nth-child(2) { transition-delay: 110ms; }
        [data-reveal-group] > *:nth-child(3) { transition-delay: 220ms; }
        [data-reveal-group] > *:nth-child(4) { transition-delay: 330ms; }
        [data-reveal-group] > *:nth-child(5) { transition-delay: 440ms; }
        [data-reveal-group] > *:nth-child(6) { transition-delay: 550ms; }
        [data-reveal-group].reveal-visible > * {
          opacity: 1;
          transform: translateY(0);
        }
        /* Section heading reveals */
        [data-reveal] {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        [data-reveal].reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

        {/* Auth Modal */}
        {showAuthModal && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
              onLogin={async (email, password) => {
                await login({ email, password });
              }}
              onSignup={async (email, password, name) => {
                await signup({ email, password, name });
              }}
              onGoogleLogin={async (credential) => {
                await googleLogin(credential);
              }}
            />
          </Suspense>
        )}
      </div>
    </>
  );
};

export default Home;
