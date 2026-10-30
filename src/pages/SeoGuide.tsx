import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MdArrowForward, MdCheckCircleOutline } from "react-icons/md";
import Seo from "../components/SEO";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import { featuredProblems } from "../utils/problemSlug";
import NotFound from "./NotFound";
import seoCopy from "../data/seoCopy.json";
import "./SeoGuide.css";

const SITE_URL = "https://diagramwise.com";

const guides = {
  "system-design-interview": {
    title: "System Design Interview Guide",
    seoTitle:
      "System Design Interview Guide & Practice Questions | Diagramwise",
    description:
      "Prepare for system design interviews by turning ambiguous prompts into requirements, estimates, architecture decisions, and defensible trade-offs.",
    intro:
      "A strong system design interview is a structured conversation. The diagram matters, but the interviewer is evaluating how you clarify the problem, choose boundaries, find bottlenecks, and revise decisions as constraints change.",
    steps: [
      [
        "Clarify the problem",
        "Identify users, core use cases, non-goals, and the quality attributes that matter most.",
      ],
      [
        "Estimate the shape",
        "Use rough traffic, storage, throughput, and latency estimates to expose decisions that need evidence.",
      ],
      [
        "Draw the critical path",
        "Start with the simplest end-to-end flow before expanding storage, caching, queues, and failure handling.",
      ],
      [
        "Defend the trade-offs",
        "Explain why each major component exists, what it costs, and what would make you replace it.",
      ],
      [
        "Test failure and scale",
        "Walk through overload, partial failure, recovery, consistency, and operational visibility.",
      ],
    ],
    problemSlugs: [
      "url-shortener-like-bit-ly",
      "design-an-api-rate-limiter",
      "notification-system",
      "distributed-cache",
      "video-streaming-platform",
      "ride-sharing-system",
    ],
    nextHref: "/system-design-practice/",
    nextLabel: "Build a repeatable practice routine",
  },
  "system-design-practice": {
    title: "System Design Practice",
    seoTitle:
      "System Design Practice Online with Architecture Feedback | Diagramwise",
    description:
      "Practice system design online with realistic prompts, an interactive architecture canvas, explicit trade-offs, and structured review.",
    intro:
      "System design improves through deliberate repetitions, not by memorizing finished diagrams. A useful session forces you to state assumptions, build an architecture, and inspect how it responds to load, failure, and changing requirements.",
    steps: [
      [
        "Choose one narrow prompt",
        "Match the difficulty to the skill you want to isolate instead of attempting the largest possible system.",
      ],
      [
        "Time-box clarification",
        "Write the functional requirements, scale assumptions, and success criteria before placing components.",
      ],
      [
        "Build and annotate",
        "Label important flows and record why each component or boundary exists.",
      ],
      [
        "Review without rewriting history",
        "Capture weaknesses before changing the diagram so each iteration teaches a specific lesson.",
      ],
      [
        "Repeat the weak dimension",
        "Choose the next challenge around the bottleneck you missed: caching, consistency, queues, storage, reliability, or operations.",
      ],
    ],
    problemSlugs: [
      "job-scheduler",
      "pastebin-system-design",
      "google-calendar-system-design",
      "design-a-hotel-booking-system",
      "web-crawler",
      "payment-system",
    ],
    nextHref: "/problems/",
    nextLabel: "Browse all practice problems",
  },
  "ai-system-design-interview": {
    title: "AI System Design Interview",
    seoTitle: "AI System Design Interview Questions & Practice | Diagramwise",
    description:
      "Practice AI and ML system design across data pipelines, retrieval, inference, evaluation, monitoring, latency, reliability, and cost trade-offs.",
    intro:
      "AI system design adds probabilistic behavior and a changing data-model boundary to familiar distributed-systems concerns. Strong answers connect the offline and online paths, define evaluation, and plan for fallback, monitoring, and safe iteration.",
    steps: [
      [
        "Define product behavior",
        "State what the model must produce, who consumes it, and how quality will be measured.",
      ],
      [
        "Separate offline and online paths",
        "Show ingestion, labeling, training or indexing, deployment, inference, and feedback as distinct flows.",
      ],
      [
        "Budget latency, quality, and cost",
        "Explain where caching, batching, smaller models, retrieval, or asynchronous work changes the trade-off.",
      ],
      [
        "Design evaluation and observability",
        "Track data quality, relevance or model quality, drift, failures, and user-impacting regressions.",
      ],
      [
        "Plan degradation and rollback",
        "Describe what happens when a model, index, feature pipeline, or provider is unavailable.",
      ],
    ],
    problemSlugs: [
      "design-a-conversational-ai-platform-with-rag",
      "semantic-search-engine",
      "recommendation-engine",
      "real-time-recommendation-system",
      "observability-platform",
      "video-transcoding-pipeline",
    ],
    nextHref: "/learning-paths/",
    nextLabel: "Study the underlying foundations",
  },
  "kubernetes-architecture": {
    title: "Kubernetes Architecture Guide",
    seoTitle:
      "Kubernetes Architecture Guide: Components, Diagrams & Practice | Diagramwise",
    seoKeywords:
      "kubernetes architecture, kubernetes architecture diagram, kubernetes system design, kubernetes components, kubernetes cluster architecture",
    description:
      "Learn how Kubernetes control-plane, workload, networking, storage, and observability components fit together, then practice explaining the trade-offs in an architecture diagram.",
    intro:
      "A useful Kubernetes diagram makes the ownership boundaries clear. Start with the request path into a Service and workload, then show how the control plane, storage, networking, and operations concerns support it. The point is not to place every Kubernetes resource; it is to explain what keeps the application available and manageable.",
    steps: [
      [
        "Start with the workload boundary",
        "Choose the workload type that matches the job: a Deployment for stateless services, a StatefulSet for stable identities and storage, or a Job for finite work.",
      ],
      [
        "Make traffic explicit",
        "Show how an Ingress reaches a Service and how that Service selects healthy Pods. Call out where TLS, routing, service discovery, and network policy apply.",
      ],
      [
        "Separate control from data paths",
        "Explain how the API server, scheduler, controllers, and etcd reconcile desired state while application requests continue through the data path.",
      ],
      [
        "Plan state and configuration",
        "Use PersistentVolumeClaims for durable workload storage, ConfigMaps for non-secret configuration, and Secrets for credentials. State the backup and recovery boundary.",
      ],
      [
        "Design for operations",
        "Include readiness, resource limits, autoscaling, logs, metrics, alerts, and a rollout strategy so the diagram describes how the system behaves under change and failure.",
      ],
    ],
    problemSlugs: [
      "design-a-container-based-microservices-architecture",
      "build-a-multi-cloud-kubernetes-orchestration-platform",
      "design-a-secure-multi-cloud-kubernetes-architecture",
    ],
    nextHref: "/problems/",
    nextLabel: "Practice a Kubernetes architecture",
  },
} as const;

interface GuideSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  paragraphs_after?: string[];
}

interface GuideCopy {
  answerQuestion: string;
  answer: string;
  faqs: { q: string; a: string }[];
  sections?: GuideSection[];
}

// Shared with prerender.js so the static HTML and the live page match.
const guideCopy = seoCopy as Record<string, GuideCopy>;

const generalFaq = [
  [
    "How should I start a system design problem?",
    "Clarify the users, primary use cases, non-goals, scale assumptions, and quality attributes before choosing components.",
  ],
  [
    "What makes system design practice effective?",
    "Build the architecture yourself, state the reasoning, review specific weaknesses, and repeat challenges that exercise those weak areas.",
  ],
] as const;

const SeoGuide: React.FC = () => {
  const { pathname } = useLocation();
  const guide = pathname.split("/").find(Boolean) || "";
  const data = guides[guide as keyof typeof guides];
  if (!data) return <NotFound />;

  const keywords =
    "seoKeywords" in data
      ? data.seoKeywords
      : `${data.title}, system design questions, architecture interview practice, distributed systems`;

  const selectedProblems = data.problemSlugs
    .map((slug) => featuredProblems.find((problem) => problem.slug === slug))
    .filter((problem): problem is (typeof featuredProblems)[number] =>
      Boolean(problem),
    );
  const canonical = `${SITE_URL}/${guide}/`;
  const copy = guideCopy[`/${guide}`];
  const faq: readonly (readonly [string, string])[] = copy
    ? copy.faqs.map(({ q, a }) => [q, a] as const)
    : generalFaq;
  const organization = { "@id": `${SITE_URL}/#organization` };

  return (
    <>
      <Seo
        title={data.seoTitle}
        description={data.description}
        keywords={keywords}
        image="https://diagramwise.com/og/problems.png"
        imageAlt={`${data.title} on Diagramwise`}
        url={canonical}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: data.title,
              description: data.description,
              url: canonical,
              image: "https://diagramwise.com/og/problems.png",
              inLanguage: "en",
              mainEntityOfPage: canonical,
              author: { "@id": "https://next-zen.dev/#organization" },
              publisher: organization,
            },
            {
              "@type": "HowTo",
              name: copy?.answerQuestion ?? data.title,
              description: data.description,
              step: data.steps.map(([name, text], index) => ({
                "@type": "HowToStep",
                position: index + 1,
                name,
                text,
              })),
            },
            {
              "@type": "FAQPage",
              mainEntity: faq.map(([question, answer]) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: { "@type": "Answer", text: answer },
              })),
            },
          ],
        }}
      />
      <div className="seo-guide-page min-h-screen">
        <ProductHeader actions={<ThemeSwitcher />} />

        <main className="seo-guide-main">
          <section className="seo-guide-hero">
            <div className="seo-guide-container seo-guide-hero__inner">
              <div className="seo-guide-hero__copy">
                <h1>{data.title}</h1>
                <p className="seo-guide-hero__intro">{data.intro}</p>
                <div className="seo-guide-hero__actions">
                  <Link
                    to="/problems/"
                    className="seo-guide-button seo-guide-button--primary"
                  >
                    Choose a practice problem{" "}
                    <MdArrowForward aria-hidden="true" />
                  </Link>
                  <span className="seo-guide-hero__note">
                    Read the method, then test it under pressure.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className="seo-guide-container seo-guide-content">
            {copy && (
              <section
                aria-labelledby="answer-heading"
                className="seo-guide-section seo-guide-method"
                id="quick-answer"
              >
                <div className="seo-guide-section__intro">
                  <h2 id="answer-heading">{copy.answerQuestion}</h2>
                </div>
                <p className="seo-guide-answer">{copy.answer}</p>
              </section>
            )}
            <section
              aria-labelledby="method-heading"
              className="seo-guide-section seo-guide-method"
            >
              <div className="seo-guide-section__intro">
                <h2 id="method-heading">A method you can repeat</h2>
                <p>
                  Use the same sequence until it becomes a calm interview habit.
                </p>
              </div>
              <ol className="seo-guide-steps">
                {data.steps.map(([title, description], index) => (
                  <li key={title} className="seo-guide-step">
                    <span className="seo-guide-step__number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {copy?.sections?.map((section) => (
              <section
                key={section.heading}
                className="seo-guide-section seo-guide-method"
              >
                <div className="seo-guide-section__intro">
                  <h2>{section.heading}</h2>
                </div>
                <div className="seo-guide-prose">
                  {section.paragraphs?.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  )}
                  {section.table && (
                    <div className="seo-guide-table">
                      <table>
                        <thead>
                          <tr>
                            {section.table.headers.map((cell, cellIndex) => (
                              <th key={cellIndex}>{cell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row) => (
                            <tr key={row.join("|")}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {section.paragraphs_after?.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </div>
              </section>
            ))}
            <section
              aria-labelledby="practice-heading"
              className="seo-guide-section seo-guide-practice"
            >
              <div className="seo-guide-section__heading">
                <div>
                  <h2 id="practice-heading">Put the method into practice</h2>
                  <p>
                    These challenges exercise different parts of the method
                    without showing you a finished solution first.
                  </p>
                </div>
                <Link to="/problems/" className="seo-guide-text-link">
                  View all problems
                </Link>
              </div>
              <div className="seo-guide-problems">
                {selectedProblems.map((problem) => (
                  <Link
                    key={problem.slug}
                    to={`/problems/${problem.slug}/`}
                    className="seo-guide-problem"
                  >
                    <div>
                      <h3>{problem.title}</h3>
                      <p>
                        {problem.difficulty} · {problem.estimated_time}
                      </p>
                    </div>
                    <MdArrowForward aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="faq-heading"
              className="seo-guide-section seo-guide-faq"
            >
              <div className="seo-guide-section__intro">
                <h2 id="faq-heading">Frequently asked questions</h2>
                <p>Keep these principles close when a prompt gets ambiguous.</p>
              </div>
              <div className="seo-guide-faq__list">
                {faq.map(([question, answer], index) => (
                  <details key={question} open={index === 0}>
                    <summary>
                      <MdCheckCircleOutline aria-hidden="true" />
                      <span>{question}</span>
                    </summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="seo-guide-cta">
              <div>
                <h2>Continue with a concrete next step</h2>
                <p>Move from reading to a problem, a diagram, and a review.</p>
              </div>
              <Link
                to={data.nextHref}
                className="seo-guide-button seo-guide-button--inverse"
              >
                {data.nextLabel}
                <MdArrowForward aria-hidden="true" />
              </Link>
            </section>
          </div>
        </main>
        <footer className="seo-guide-footer">
          Diagramwise — design architectures, explain decisions, and improve the
          result. <Link to="/about/">About</Link>
        </footer>
      </div>
    </>
  );
};

export default SeoGuide;
