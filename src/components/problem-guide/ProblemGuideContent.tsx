import React, {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MdCheckCircleOutline,
  MdExpandMore,
  MdLightbulbOutline,
  MdWarningAmber,
} from "react-icons/md";
import type { ProblemGuide } from "../../types/problemGuide";
import type { RequirementSpec } from "../../types/requirements";
import ProblemRequirements from "../ProblemRequirements";
import { useRoughAnnotation } from "../../hooks/useRoughAnnotation";
import { lazyWithRetry } from "../../utils/lazyWithRetry";

const PublicArchitectureCanvas = lazyWithRetry(
  () => import("../public-design/PublicArchitectureCanvas"),
  "public-architecture-canvas",
);

const problemGuideSections = [
  { id: "requirements", label: "Requirements" },
  { id: "key-entities", label: "Key entities" },
  { id: "api-interface", label: "API / interface" },
  { id: "data-flow", label: "Data flow" },
  { id: "high-level-design", label: "High-level design" },
  { id: "deep-dives", label: "Deep dives" },
  { id: "tradeoffs", label: "Tradeoffs" },
  { id: "follow-ups", label: "Follow-ups" },
  { id: "rubric", label: "Rubric" },
] as const;

interface ProblemGuideNavigationProps {
  compact?: boolean;
}

export const ProblemGuideNavigation: React.FC<ProblemGuideNavigationProps> = ({
  compact = false,
}) => {
  if (compact) {
    return (
      <nav aria-label="Guide sections" className="overflow-x-auto">
        <div className="flex min-w-max gap-2 py-1">
          {problemGuideSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-muted transition hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Guide sections">
      <p className="text-sm font-bold text-theme">On this page</p>
      <ol className="mt-3 space-y-1 border-l border-theme/15 pl-3">
        {problemGuideSections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block rounded-r-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-[var(--surface)] hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

interface SectionHeadingProps {
  id: string;
  title: string;
  description: string;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  id,
  title,
  description,
}) => (
  <header>
    <h2
      id={`${id}-heading`}
      className="text-balance text-2xl font-bold tracking-[-0.02em] sm:text-3xl"
    >
      {title}
    </h2>
    <p className="mt-3 leading-7 text-muted">{description}</p>
  </header>
);

const RequirementList: React.FC<{ title: string; items: string[] }> = ({
  title,
  items,
}) => (
  <div>
    <h3 className="text-lg font-bold">{title}</h3>
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-7 text-muted">
          <MdCheckCircleOutline
            className="mt-1 shrink-0 text-xl text-[var(--brand)]"
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

interface GuideDisclosureProps extends React.PropsWithChildren {
  title: string;
  meta?: string;
  initiallyOpen?: boolean;
}

const GuideDisclosure: React.FC<GuideDisclosureProps> = ({
  title,
  meta,
  initiallyOpen = false,
  children,
}) => (
  <details
    open={initiallyOpen}
    className="group border-b border-theme/10 first:border-t"
  >
    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] [&::-webkit-details-marker]:hidden">
      <span className="text-lg font-bold leading-7 text-theme">{title}</span>
      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
        {meta && <span>{meta}</span>}
        <MdExpandMore
          className="text-xl transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </span>
    </summary>
    <div className="pb-6 pr-8">{children}</div>
  </details>
);

type GuideHighlights = {
  highlightedMetricLabel: string | undefined;
  durableStepTitle: string | undefined;
  asyncStepTitle: string | undefined;
};

const guideHighlights = new Map<string, GuideHighlights>(
  Object.entries({
    "document-management-system": {
      highlightedMetricLabel: "Peak edit rate",
      durableStepTitle: "Accept and fan out an edit",
      asyncStepTitle: "Buffer asynchronous work",
    },
    "url-shortener-like-bit-ly": {
      highlightedMetricLabel: "Redirect traffic",
      durableStepTitle: "Resolve the redirect",
      asyncStepTitle: "Emit click telemetry",
    },
    "design-a-parts-compatibility-feature-for-an-ecommerce-site": {
      highlightedMetricLabel: "Peak lookup rate",
      durableStepTitle: "Revalidate before purchase",
      asyncStepTitle: "Publish catalog changes asynchronously",
    },
    "design-a-price-alert-system": {
      highlightedMetricLabel: "Observation rate",
      durableStepTitle: "Accept a price observation",
      asyncStepTitle: "Deliver asynchronously",
    },
    "design-a-feature-to-show-the-number-of-users-viewing-a-page": {
      highlightedMetricLabel: "Heartbeat rate",
      durableStepTitle: "Join the page",
      asyncStepTitle: "Expire inactive presence",
    },
    "design-facebook-likes-feature-with-live-updates": {
      highlightedMetricLabel: "Peak write rate",
      durableStepTitle: "Commit the user's like state",
      asyncStepTitle: "Broadcast asynchronously",
    },
    "twitter-system-design": {
      highlightedMetricLabel: "Timeline reads",
      durableStepTitle: "Accept the post",
      asyncStepTitle: "Read and refresh asynchronously",
    },
    "top-k-ranking-system": {
      highlightedMetricLabel: "Peak event rate",
      durableStepTitle: "Maintain the Top-K",
      asyncStepTitle: "Serve or rebuild asynchronously",
    },
    "design-a-cost-optimized-architecture-for-batch-processing": {
      highlightedMetricLabel: "Peak runnable tasks",
      durableStepTitle: "Commit the durable state",
      asyncStepTitle: "Reconcile and report asynchronously",
    },
    "instagram-system-design": {
      highlightedMetricLabel: "Media upload rate",
      durableStepTitle: "Commit content metadata",
      asyncStepTitle: "Serve and invalidate asynchronously",
    },
    "pastebin-system-design": {
      highlightedMetricLabel: "Paste create rate",
      durableStepTitle: "Commit immutable content",
      asyncStepTitle: "Invalidate and expire asynchronously",
    },
    "design-a-system-for-sorting-large-data-sets": {
      highlightedMetricLabel: "Input throughput",
      durableStepTitle: "Spill sorted runs",
      asyncStepTitle: "Commit the output manifest",
    },
    "build-a-marketplace-feature-for-facebook": {
      highlightedMetricLabel: "Search throughput",
      durableStepTitle: "Commit the listing",
      asyncStepTitle: "Notify and moderate asynchronously",
    },
  }),
);

interface ProblemGuideContentProps {
  guide: ProblemGuide;
  onPractice?: () => void;
  problemSlug?: string;
  requirementSpec?: RequirementSpec;
  requirements?: string[];
  constraints?: string[];
  problemDescription?: string;
}

const ProblemGuideContent: React.FC<ProblemGuideContentProps> = ({
  guide,
  onPractice,
  problemSlug,
  requirementSpec,
  requirements,
  constraints,
  problemDescription,
}) => {
  const hasApprovedBrief =
    Boolean(requirementSpec) || requirements !== undefined;
  const isAnnotatedProblem = Boolean(problemSlug);
  const { highlightedMetricLabel, durableStepTitle, asyncStepTitle } =
    guideHighlights.get(problemSlug ?? "") ?? {
      highlightedMetricLabel: problemSlug
        ? guide.requirements.metrics[0]?.label
        : "Peak dispatch rate",
      durableStepTitle: problemSlug
        ? guide.dataFlow[1]?.title
        : "Claim due work",
      asyncStepTitle: problemSlug
        ? guide.dataFlow[4]?.title
        : "Enqueue an execution",
    };
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const promptRef = useRef<HTMLSpanElement>(null);
  const successSignalRef = useRef<HTMLSpanElement>(null);
  const peakEditRateRef = useRef<HTMLSpanElement>(null);
  const durableBoundaryRef = useRef<HTMLSpanElement>(null);
  const asyncWorkRef = useRef<HTMLSpanElement>(null);
  const getStepAnnotationRef = (title: string) => {
    if (title === durableStepTitle) return durableBoundaryRef;
    if (title === asyncStepTitle) return asyncWorkRef;
    return undefined;
  };

  useLayoutEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    const observer = new MutationObserver(syncTheme);

    syncTheme();
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const pilotAnnotations = useMemo(
    () => [
      {
        ref: promptRef,
        config: {
          type: "highlight" as const,
          color: isDarkTheme ? "#3730a3" : "#c7d2fe",
          padding: [7, 10] as [number, number],
          multiline: true,
          iterations: 1,
          animationDuration: 800,
        },
      },
      {
        ref: durableBoundaryRef,
        config: {
          type: "circle" as const,
          color: "#f97316",
          strokeWidth: 2,
          padding: 8,
          multiline: true,
          iterations: 2,
          animationDuration: 700,
        },
      },
      {
        ref: successSignalRef,
        config: {
          type: "underline" as const,
          color: isDarkTheme ? "#a5b4fc" : "#6366f1",
          strokeWidth: 2,
          padding: 3,
          multiline: true,
          iterations: 2,
          animationDuration: 650,
        },
      },
      {
        ref: peakEditRateRef,
        config: {
          type: "highlight" as const,
          color: isDarkTheme ? "#3730a3" : "#c7d2fe",
          padding: [5, 8] as [number, number],
          multiline: true,
          iterations: 1,
          animationDuration: 650,
        },
      },
      {
        ref: asyncWorkRef,
        config: {
          type: "bracket" as const,
          brackets: "left" as const,
          color: "#6366f1",
          strokeWidth: 2,
          padding: 6,
          multiline: true,
          iterations: 2,
          animationDuration: 700,
        },
      },
    ],
    [isDarkTheme],
  );

  useRoughAnnotation(pilotAnnotations, isAnnotatedProblem);

  return (
    <article className="space-y-16">
      <aside
        aria-labelledby="interview-prompt-heading"
        className="border-y border-theme/10 py-7"
      >
        <div className="flex items-center gap-3">
          <MdLightbulbOutline
            className="text-2xl text-[var(--brand)]"
            aria-hidden="true"
          />
          <h2 id="interview-prompt-heading" className="text-xl font-bold">
            Interview prompt
          </h2>
        </div>
        <p className="mt-4 text-lg leading-8 text-theme">
          <span
            ref={isAnnotatedProblem ? promptRef : undefined}
            className="relative inline max-w-full px-2 py-1"
          >
            {problemDescription ?? guide.prompt.brief}
          </span>
        </p>
        <details className="group mt-6 border-t border-theme/10">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] [&::-webkit-details-marker]:hidden">
            <span>
              {hasApprovedBrief
                ? "Worked-example discussion points"
                : "What a strong answer should cover"}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              {guide.prompt.successSignals.length} points
              <MdExpandMore
                className="text-xl transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>
          <ul className="grid gap-x-8 gap-y-3 pb-2 sm:grid-cols-2">
            {guide.prompt.successSignals.map((signal, index) => (
              <li
                key={signal}
                className="flex gap-3 text-sm leading-6 text-muted"
              >
                <MdCheckCircleOutline
                  className="mt-0.5 shrink-0 text-lg text-[var(--brand)]"
                  aria-hidden="true"
                />
                <span
                  ref={
                    isAnnotatedProblem && index === 0
                      ? successSignalRef
                      : undefined
                  }
                  className={
                    isAnnotatedProblem && index === 0
                      ? "relative inline-block"
                      : undefined
                  }
                >
                  {signal}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </aside>

      <section
        id="requirements"
        aria-labelledby="requirements-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="requirements"
          title="Requirements"
          description="Start by defining the product boundary and the service qualities the architecture must protect."
        />
        {hasApprovedBrief ? (
          <div className="mt-8 border-y border-theme/10 py-8">
            <ProblemRequirements
              requirementSpec={requirementSpec}
              requirements={requirements}
              constraints={constraints}
            />
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-10 border-y border-theme/10 py-8 md:grid-cols-2">
              <RequirementList
                title="Functional requirements"
                items={guide.requirements.functional}
              />
              <RequirementList
                title="Non-functional requirements"
                items={guide.requirements.nonFunctional}
              />
            </div>

            <div className="mt-9">
              <h3 className="text-lg font-bold">Scale assumptions</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted marker:text-[var(--brand)]">
                {guide.requirements.scaleAssumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>

            <dl className="mt-8 grid border-y border-theme/10 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-theme/10">
              {guide.requirements.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="px-1 py-5 xl:px-5 xl:first:pl-0"
                >
                  <dt className="text-sm font-semibold text-muted">
                    {metric.label}
                  </dt>
                  <dd className="mt-2 text-xl font-bold tabular-nums text-[var(--brand)]">
                    {metric.label === highlightedMetricLabel ? (
                      <span
                        ref={isAnnotatedProblem ? peakEditRateRef : undefined}
                        className="relative inline-block px-1 py-0.5"
                      >
                        {metric.value}
                      </span>
                    ) : (
                      metric.value
                    )}
                  </dd>
                  <dd className="mt-2 text-sm leading-6 text-muted">
                    {metric.description}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section
        id="key-entities"
        aria-labelledby="key-entities-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="key-entities"
          title="Key entities"
          description="Model the core entities around their access patterns, and keep high-volume or asynchronous state separate where it improves the design."
        />
        <div className="mt-7 overflow-x-auto border border-theme/10">
          <table className="min-w-[46rem] w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              System entities, fields, and design notes
            </caption>
            <thead className="bg-[var(--surface)]">
              <tr>
                <th scope="col" className="px-5 py-4 font-bold">
                  Entity
                </th>
                <th scope="col" className="px-5 py-4 font-bold">
                  Fields and relationships
                </th>
                <th scope="col" className="px-5 py-4 font-bold">
                  Design notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {guide.entities.map((entity) => (
                <tr key={entity.name} className="align-top">
                  <th scope="row" className="px-5 py-5 text-base font-bold">
                    {entity.name}
                  </th>
                  <td className="px-5 py-5 leading-6 text-muted">
                    {entity.fields.map((field) => (
                      <code
                        key={field}
                        className="mr-2 inline-block font-mono text-[0.8rem] text-theme"
                      >
                        {field}
                      </code>
                    ))}
                  </td>
                  <td className="px-5 py-5 leading-6 text-muted">
                    {entity.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="api-interface"
        aria-labelledby="api-interface-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="api-interface"
          title="API / interface"
          description="Keep the external contract small, then state the validation, authorization, and consistency behavior behind each endpoint."
        />
        <div className="mt-7 overflow-x-auto border border-theme/10">
          <table className="min-w-[48rem] w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              System API contracts and design notes
            </caption>
            <thead className="bg-[var(--surface)]">
              <tr>
                <th scope="col" className="px-5 py-4 font-bold">
                  Interface
                </th>
                <th scope="col" className="px-5 py-4 font-bold">
                  Request / response
                </th>
                <th scope="col" className="px-5 py-4 font-bold">
                  Contract notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/10">
              {guide.apis.map((api) => (
                <tr key={`${api.method}-${api.path}`} className="align-top">
                  <th scope="row" className="px-5 py-5">
                    <span className="mr-2 inline-flex bg-[var(--brand)]/10 px-2 py-1 text-xs font-bold text-[var(--brand)]">
                      {api.method}
                    </span>
                    <code className="font-mono text-[0.82rem]">{api.path}</code>
                  </th>
                  <td className="px-5 py-5 font-mono text-[0.82rem] leading-6 text-muted">
                    {api.contract}
                  </td>
                  <td className="px-5 py-5 leading-6 text-muted">
                    {api.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="data-flow"
        aria-labelledby="data-flow-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="data-flow"
          title="Data flow"
          description="Trace the user-facing request first, then show exactly where asynchronous processing begins."
        />
        <ol className="mt-8 divide-y divide-theme/10 border-y border-theme/10">
          {guide.dataFlow.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-3 py-6 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-5"
            >
              <span className="text-lg font-bold tabular-nums text-[var(--brand)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-lg font-bold">
                  {
                    <span
                      ref={
                        isAnnotatedProblem
                          ? getStepAnnotationRef(step.title)
                          : undefined
                      }
                      className={
                        step.title === durableStepTitle
                          ? "relative inline-block px-2 py-1"
                          : "relative inline-block"
                      }
                    >
                      {step.title}
                    </span>
                  }
                </h3>
                <p className="mt-2 leading-7 text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="high-level-design"
        aria-labelledby="high-level-design-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="high-level-design"
          title="High-level design"
          description="Follow the primary request path from left to right, then inspect the asynchronous paths below it."
        />
        <div className="mt-7">
          <Suspense
            fallback={
              <div className="grid min-h-96 place-items-center rounded-2xl bg-[var(--surface)] text-muted">
                Loading reference architecture…
              </div>
            }
          >
            <PublicArchitectureCanvas
              architecture={guide.architecture}
              onPractice={onPractice}
            />
          </Suspense>
        </div>
      </section>

      <section
        id="deep-dives"
        aria-labelledby="deep-dives-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="deep-dives"
          title="Deep dives"
          description="These are the areas where an interviewer is most likely to challenge the first-pass architecture."
        />
        <div className="mt-7">
          {guide.deepDives.map((deepDive, index) => (
            <GuideDisclosure
              key={deepDive.title}
              title={deepDive.title}
              meta={`${deepDive.points.length} points`}
              initiallyOpen={index === 0}
            >
              <ul className="mt-4 space-y-3">
                {deepDive.points.map((point) => (
                  <li key={point} className="flex gap-3 leading-7 text-muted">
                    <MdCheckCircleOutline
                      className="mt-1 shrink-0 text-xl text-[var(--brand)]"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </GuideDisclosure>
          ))}
        </div>
      </section>

      <section
        id="tradeoffs"
        aria-labelledby="tradeoffs-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="tradeoffs"
          title="Tradeoffs"
          description="Name the default you would ship, then explain when the alternative becomes the better choice."
        />
        <div className="mt-7 divide-y divide-theme/10 border-y border-theme/10">
          {guide.tradeoffs.map((tradeoff) => (
            <div key={tradeoff.title} className="py-7">
              <h3 className="text-xl font-bold">{tradeoff.title}</h3>
              <dl className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-bold text-[var(--brand)]">
                    Recommended default
                  </dt>
                  <dd className="mt-2 leading-7 text-muted">
                    {tradeoff.recommendation}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-theme">Watch for</dt>
                  <dd className="mt-2 leading-7 text-muted">
                    {tradeoff.caution}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <GuideDisclosure
            title="Common mistakes"
            meta={`${guide.commonMistakes.length} to avoid`}
          >
            <div className="flex items-start gap-3">
              <MdWarningAmber
                className="mt-1 shrink-0 text-xl text-[var(--brand)]"
                aria-hidden="true"
              />
              <ul className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {guide.commonMistakes.map((mistake) => (
                  <li key={mistake} className="leading-7 text-muted">
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          </GuideDisclosure>
        </div>
      </section>

      <section
        id="follow-ups"
        aria-labelledby="follow-ups-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="follow-ups"
          title="Follow-ups"
          description="Practice extending the design without replacing the core architecture every time the interviewer changes one constraint."
        />
        <div className="mt-7">
          {guide.followUps.map((followUp) => (
            <GuideDisclosure key={followUp.question} title={followUp.question}>
              <p className="leading-7 text-muted">{followUp.answer}</p>
            </GuideDisclosure>
          ))}
        </div>
      </section>

      <section
        id="rubric"
        aria-labelledby="rubric-heading"
        className="scroll-mt-24"
      >
        <SectionHeading
          id="rubric"
          title="Rubric"
          description="Use these signals to review whether the answer is coherent, scalable, and grounded in product behavior."
        />
        <dl className="mt-7 divide-y divide-theme/10 border-y border-theme/10">
          {guide.rubric.map((item) => (
            <div
              key={item.criterion}
              className="grid gap-2 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8"
            >
              <dt className="font-bold">{item.criterion}</dt>
              <dd className="leading-7 text-muted">{item.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
};

export default ProblemGuideContent;
