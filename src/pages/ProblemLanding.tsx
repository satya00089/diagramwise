import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  MdAccessTime,
  MdArrowBack,
  MdArrowForward,
  MdCheckCircleOutline,
  MdPlayArrow,
  MdSignalCellularAlt,
} from "react-icons/md";
import { AuthModal } from "../components/AuthModal";
import ProblemGuideContent, {
  ProblemGuideNavigation,
} from "../components/problem-guide/ProblemGuideContent";
import Seo from "../components/SEO";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import { getProblemGuide } from "../data/problemGuides";
import type { ProblemGuide } from "../types/problemGuide";
import { useAuth } from "../hooks/useAuth";
import { getApiBaseUrl } from "../services/api";
import type { SystemDesignProblem } from "../types/systemDesign";
import { featuredProblems, getFeaturedProblem } from "../utils/problemSlug";
import { lazyWithRetry } from "../utils/lazyWithRetry";

const PublicArchitectureCanvas = lazyWithRetry(
  () => import("../components/public-design/PublicArchitectureCanvas"),
  "public-architecture-canvas",
);

type PublicProblem = Partial<SystemDesignProblem> & {
  title: string;
  description: string;
  difficulty: string;
  category: string;
  estimated_time: string;
  tags: string[];
  slug?: string;
};

const SITE_URL = "https://diagramwise.com";

const readableTag = (tag: string) =>
  tag
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildQuestions = (problem: PublicProblem): string[] => {
  const terms = new Set(problem.tags.map((tag) => tag.toLowerCase()));
  const questions = [
    "What belongs on the synchronous request path, and what can happen asynchronously?",
    "Where does the source of truth live, and how will the data model support the main access patterns?",
    "How does the design behave when one dependency becomes slow or unavailable?",
  ];

  if ([...terms].some((term) => /real-time|websocket|messaging/.test(term))) {
    questions.push(
      "How will clients reconnect, recover missed events, and preserve message ordering?",
    );
  }
  if ([...terms].some((term) => /cache|caching|cdn/.test(term))) {
    questions.push(
      "What is cached, how is it invalidated, and how are hot keys handled?",
    );
  }
  if (
    [...terms].some((term) => /ai|ml|rag|embedding|recommendation/.test(term))
  ) {
    questions.push(
      "How are offline data preparation, online inference, evaluation, and model rollback separated?",
    );
  }
  if ([...terms].some((term) => /payment|transaction|compliance/.test(term))) {
    questions.push(
      "Where are idempotency, auditability, reconciliation, and failure recovery enforced?",
    );
  }
  if ([...terms].some((term) => /distributed|scalability|storage/.test(term))) {
    questions.push(
      "Which partitioning strategy avoids hotspots while keeping reads and writes predictable?",
    );
  }

  return [...new Set(questions)].slice(0, 5);
};

const SkeletonBlock: React.FC<{ className: string }> = ({ className }) => (
  <span
    className={`block animate-pulse rounded-lg bg-[var(--bg-hover)] ${className}`}
    aria-hidden="true"
  />
);

const ProblemLandingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-[var(--bg)] text-theme" aria-busy="true">
    <output className="sr-only">Loading the design brief</output>
    <header className="border-b border-white/20 bg-[var(--brand)] text-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-7 w-7 rounded bg-white/20" />
          <span className="h-4 w-32 rounded bg-white/20" />
        </div>
        <div className="flex items-center gap-2 sm:gap-4" aria-hidden="true">
          <span className="hidden h-3 w-20 rounded bg-white/20 sm:block" />
          <span className="hidden h-3 w-24 rounded bg-white/20 md:block" />
          <span className="h-8 w-8 rounded-full bg-white/20" />
        </div>
      </div>
    </header>

    <main aria-hidden="true">
      <section className="border-b border-theme/10 bg-[var(--surface)]">
        <div className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 2xl:px-10">
          <SkeletonBlock className="h-4 w-36" />
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="min-w-0">
              <div className="mb-5 flex gap-2">
                <SkeletonBlock className="h-7 w-28 rounded-full" />
                <SkeletonBlock className="h-7 w-20 rounded-full" />
              </div>
              <SkeletonBlock className="h-12 w-full max-w-3xl sm:h-16" />
              <SkeletonBlock className="mt-6 h-5 w-full max-w-3xl" />
              <SkeletonBlock className="mt-3 h-5 w-4/5 max-w-2xl" />
            </div>
            <aside className="rounded-2xl bg-[var(--bg)] p-6 shadow-[0_12px_32px_rgba(17,24,39,0.10)]">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="mt-5 h-4 w-full" />
              <SkeletonBlock className="mt-7 h-12 w-full rounded-xl" />
              <SkeletonBlock className="mx-auto mt-4 h-3 w-4/5" />
              <SkeletonBlock className="mx-auto mt-2 h-3 w-3/5" />
            </aside>
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-12 sm:px-6 lg:px-8 lg:py-16 2xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-10">
            <section>
              <SkeletonBlock className="h-8 w-48" />
              <SkeletonBlock className="mt-5 h-5 w-full max-w-3xl" />
              <SkeletonBlock className="mt-3 h-5 w-11/12 max-w-3xl" />
              <SkeletonBlock className="mt-3 h-5 w-3/4 max-w-2xl" />
            </section>
            <section>
              <SkeletonBlock className="h-8 w-56" />
              <SkeletonBlock className="mt-5 h-5 w-full max-w-3xl" />
              <SkeletonBlock className="mt-3 h-5 w-10/12 max-w-3xl" />
            </section>
          </div>
          <aside className="hidden space-y-3 lg:block">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </aside>
        </div>
      </div>
    </main>

    <span className="sr-only">Loading the design brief…</span>
  </div>
);

const ProblemLanding: React.FC = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const featured = getFeaturedProblem(slug) as PublicProblem | undefined;
  const [problem, setProblem] = useState<PublicProblem | undefined>(featured);
  const [guide, setGuide] = useState<ProblemGuide | null>(null);
  const [loading, setLoading] = useState(!featured);
  const [missing, setMissing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, login, signup, googleLogin } = useAuth();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [slug]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const apiUrl = getApiBaseUrl(
      import.meta.env.VITE_API_URL,
      import.meta.env.VITE_ASSESSMENT_API_URL,
    );

    const loadProblem = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/v1/problem/slug/${encodeURIComponent(slug)}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Problem catalog unavailable");
        const detail = (await response.json()) as SystemDesignProblem;

        if (active) setProblem({ ...featured, ...detail, slug });
      } catch {
        if (active && !featured) setMissing(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProblem();
    return () => {
      active = false;
      controller.abort();
    };
  }, [featured, slug]);

  useEffect(() => {
    let active = true;
    setGuide(null);

    void getProblemGuide(slug).then((nextGuide) => {
      if (active) setGuide(nextGuide);
    });

    return () => {
      active = false;
    };
  }, [slug]);

  const related = useMemo(() => {
    if (!problem) return [];
    const tags = new Set(problem.tags);
    const seenTitles = new Set<string>();
    return featuredProblems
      .filter((entry) => entry.slug !== slug)
      .map((entry) => ({
        ...entry,
        score:
          (entry.category === problem.category ? 2 : 0) +
          entry.tags.filter((tag) => tags.has(tag)).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter((entry) => {
        const titleKey = entry.title.trim().toLowerCase();
        if (seenTitles.has(titleKey)) return false;
        seenTitles.add(titleKey);
        return true;
      })
      .slice(0, 4);
  }, [problem, slug]);

  if (missing) return <Navigate to="/" replace />;

  if (!problem || loading) {
    return <ProblemLandingSkeleton />;
  }

  const canonical = `${SITE_URL}/problems/${slug}/`;
  const concepts = problem.tags.map(readableTag);
  const questions = buildQuestions(problem);
  const requirements = problem.requirements?.filter(Boolean) || [];
  const constraints = problem.constraints?.filter(Boolean) || [];
  const architecture = guide?.architecture ?? null;
  const pageDescription = `${problem.description} Work through the requirements, architecture trade-offs, and an interactive design review.`;

  const startProblem = () => {
    if (!problem.id) {
      navigate(`/problems/?q=${encodeURIComponent(problem.title)}`);
      return;
    }
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    navigate(`/playground/${problem.id}`);
  };

  return (
    <>
      <Seo
        title={`${problem.title} — System Design Interview Practice | Diagramwise`}
        description={pageDescription}
        keywords={`${problem.title}, system design interview question, ${problem.tags.join(", ")}`}
        image="https://diagramwise.com/og/problems.png"
        imageAlt={`${problem.title} practice challenge`}
        url={canonical}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: problem.title,
          description: pageDescription,
          url: canonical,
          educationalLevel: problem.difficulty,
          timeRequired: problem.estimated_time,
          teaches: concepts,
          provider: {
            "@type": "Organization",
            name: "Diagramwise",
            url: `${SITE_URL}/`,
          },
        }}
      />

      <div className="problem-detail-page min-h-screen bg-[var(--bg)] text-theme">
        <ProductHeader actions={<ThemeSwitcher />} />

        <main>
          <section className="problem-detail-hero border-b border-theme/10 bg-[var(--surface)]">
            <div className="w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 2xl:px-10">
              <Link
                to="/problems/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] hover:underline"
              >
                <MdArrowBack aria-hidden="true" /> All practice problems
              </Link>
              <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <div className="min-w-0">
                  <div className="mb-5 flex flex-wrap gap-2 text-sm font-semibold">
                    <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-[var(--brand)]">
                      {problem.category}
                    </span>
                    <span className="rounded-full bg-[var(--bg-hover)] px-3 py-1">
                      {problem.difficulty}
                    </span>
                  </div>
                  <h1 className="problem-detail-title max-w-4xl text-balance text-4xl font-normal leading-tight tracking-[-0.03em] sm:text-6xl">
                    {problem.title}
                  </h1>
                  <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">
                    {problem.description}
                  </p>
                </div>

                <aside className="problem-detail-summary rounded-2xl p-6">
                  <dl className="space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="flex items-center gap-2 text-muted">
                        <MdSignalCellularAlt /> Difficulty
                      </dt>
                      <dd className="font-semibold">{problem.difficulty}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="flex items-center gap-2 text-muted">
                        <MdAccessTime /> Practice time
                      </dt>
                      <dd className="font-semibold tabular-nums">
                        {problem.estimated_time}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={startProblem}
                    className="problem-primary-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    <MdPlayArrow className="text-xl" aria-hidden="true" /> Start
                    designing
                  </button>
                  <p className="mt-3 text-center text-xs leading-5 text-muted">
                    Read the brief first. Sign in only when you are ready to
                    save and review your design.
                  </p>
                </aside>
              </div>
            </div>
          </section>

          <div className="w-full px-4 py-12 sm:px-6 lg:px-8 lg:py-16 2xl:px-10">
            {guide && (
              <div className="mb-10 lg:hidden">
                <ProblemGuideNavigation compact />
              </div>
            )}

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 space-y-14">
                {guide ? (
                  <ProblemGuideContent
                    guide={guide}
                    onPractice={startProblem}
                    problemSlug={slug}
                  />
                ) : (
                  <>
                    {requirements.length > 0 && (
                      <section aria-labelledby="requirements-heading">
                        <h2
                          id="requirements-heading"
                          className="text-2xl font-bold tracking-[-0.02em]"
                        >
                          Requirements
                        </h2>
                        <ul className="mt-5 space-y-3">
                          {requirements.map((requirement) => (
                            <li
                              key={requirement}
                              className="flex gap-3 leading-7 text-muted"
                            >
                              <MdCheckCircleOutline
                                className="mt-1 shrink-0 text-xl text-[var(--brand)]"
                                aria-hidden="true"
                              />
                              <span>{requirement}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section aria-labelledby="concepts-heading">
                      <h2
                        id="concepts-heading"
                        className="text-2xl font-bold tracking-[-0.02em]"
                      >
                        Concepts this challenge tests
                      </h2>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {concepts.map((concept) => (
                          <span
                            key={concept}
                            className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-semibold"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </section>

                    {constraints.length > 0 && (
                      <section aria-labelledby="constraints-heading">
                        <h2
                          id="constraints-heading"
                          className="text-2xl font-bold tracking-[-0.02em]"
                        >
                          Constraints
                        </h2>
                        <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-muted">
                          {constraints.map((constraint) => (
                            <li key={constraint}>{constraint}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section aria-labelledby="questions-heading">
                      <h2
                        id="questions-heading"
                        className="text-2xl font-bold tracking-[-0.02em]"
                      >
                        Questions your architecture should answer
                      </h2>
                      <ol className="mt-5 space-y-4">
                        {questions.map((question, index) => (
                          <li
                            key={question}
                            className="grid grid-cols-[2rem_1fr] gap-3 leading-7 text-muted"
                          >
                            <span className="font-semibold tabular-nums text-[var(--brand)]">
                              {index + 1}.
                            </span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ol>
                    </section>

                    {architecture && (
                      <section aria-labelledby="high-level-design-heading">
                        <h2
                          id="high-level-design-heading"
                          className="text-2xl font-bold tracking-[-0.02em]"
                        >
                          High-level design
                        </h2>
                        <p className="mt-4 max-w-3xl leading-7 text-muted">
                          Explore the reference architecture, then use the same
                          components to explain your own design choices.
                        </p>
                        <div className="mt-6">
                          <Suspense
                            fallback={
                              <div className="grid min-h-96 place-items-center rounded-2xl bg-[var(--surface)] text-muted">
                                Loading reference architecture…
                              </div>
                            }
                          >
                            <PublicArchitectureCanvas
                              architecture={architecture}
                              onPractice={startProblem}
                            />
                          </Suspense>
                        </div>
                      </section>
                    )}

                    <section aria-labelledby="review-heading">
                      <h2
                        id="review-heading"
                        className="text-2xl font-bold tracking-[-0.02em]"
                      >
                        What the review looks for
                      </h2>
                      <p className="mt-4 max-w-3xl leading-7 text-muted">
                        Diagramwise reviews the reasoning behind your
                        components and connections—not just whether the right
                        boxes appear. Make assumptions explicit and label the
                        important data flows.
                      </p>
                      <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                        {[
                          "Requirements alignment",
                          "Scalability and bottlenecks",
                          "Reliability and failure recovery",
                          "Data design and trade-offs",
                        ].map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-3 font-semibold"
                          >
                            <MdCheckCircleOutline
                              className="text-xl text-[var(--brand)]"
                              aria-hidden="true"
                            />{" "}
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </>
                )}

                <section className="problem-bottom-cta px-6 py-8 sm:px-8">
                  <h2 className="text-2xl font-bold">
                    Turn the brief into an architecture
                  </h2>
                  <p className="mt-3 max-w-2xl leading-7 text-muted">
                    Place the core components, connect the critical paths,
                    record your assumptions, and request a structured review
                    when the design is ready.
                  </p>
                  <button
                    type="button"
                    onClick={startProblem}
                    className="problem-secondary-cta mt-6 inline-flex items-center gap-2 px-5 py-3 font-semibold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Start this challenge <MdArrowForward aria-hidden="true" />
                  </button>
                </section>
              </div>

              <aside className="lg:sticky lg:top-8 lg:self-start">
                {guide && (
                  <div className="hidden lg:block">
                    <ProblemGuideNavigation />
                  </div>
                )}
                <section
                  aria-labelledby="related-heading"
                  className={guide ? "mt-10" : undefined}
                >
                  <h2 id="related-heading" className="text-lg font-bold">
                    Related practice
                  </h2>
                  <div className="mt-4 divide-y divide-theme/10 border-y border-theme/10">
                    {related.map((entry) => (
                      <Link
                        key={entry.slug}
                        to={`/problems/${entry.slug}/`}
                        className="group block py-4"
                      >
                        <span className="font-semibold leading-6 group-hover:text-[var(--brand)]">
                          {entry.title}
                        </span>
                        <span className="mt-1 block text-sm text-muted">
                          {entry.difficulty} · {entry.estimated_time}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    to="/system-design-interview/"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] hover:underline"
                  >
                    Read the interview guide{" "}
                    <MdArrowForward aria-hidden="true" />
                  </Link>
                </section>
              </aside>
            </div>
          </div>
        </main>

        <footer className="border-t border-theme/10 px-4 py-8 text-center text-sm text-muted">
          Diagramwise — system design practice built around your reasoning.
        </footer>
      </div>

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
    </>
  );
};

export default ProblemLanding;
