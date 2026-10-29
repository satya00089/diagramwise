import React from "react";
import { Link } from "react-router-dom";
import { MdArrowForward, MdCheckCircleOutline } from "react-icons/md";
import Seo from "../components/SEO";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ProductHeader from "../components/ProductHeader";
import { useFeedback } from "../contexts/FeedbackContext";
import seoCopy from "../data/seoCopy.json";
import "./SeoGuide.css";

const SITE_URL = "https://diagramwise.com";
const copy = seoCopy["/about"];

const links = [
  {
    title: "Satya Subudhi on GitHub",
    description: "Creator and maintainer of Diagramwise.",
    href: "https://github.com/satya00089",
  },
  {
    title: "Diagramwise source code",
    description: "The project repository, issues, and releases.",
    href: "https://github.com/satya00089/diagrammatic",
  },
  {
    title: "Portfolio",
    description: "Other projects and background from the author.",
    href: "https://satya00089.github.io/portfolio/",
  },
];

const About: React.FC = () => {
  const { openFeedback } = useFeedback();

  return (
    <>
      <Seo
        title="About Diagramwise and Its Creator | Diagramwise"
        description="Diagramwise is a system design practice tool created and maintained by Satya Subudhi. Learn what it does, who builds it, and where to find the source code."
        url={`${SITE_URL}/about/`}
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "AboutPage",
              "@id": `${SITE_URL}/about/`,
              url: `${SITE_URL}/about/`,
              name: "About Diagramwise",
              mainEntity: { "@id": `${SITE_URL}/about/#person` },
            },
            {
              "@type": "FAQPage",
              mainEntity: copy.faqs.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
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
                <h1>About Diagramwise</h1>
                <p className="seo-guide-hero__intro">
                  Diagramwise is a system design practice tool: build an
                  architecture visually, explain your decisions, and get
                  structured feedback on scalability, reliability, and data
                  design.
                </p>
                <div className="seo-guide-hero__actions">
                  <Link
                    to="/problems/"
                    className="seo-guide-button seo-guide-button--primary"
                  >
                    Choose a practice problem{" "}
                    <MdArrowForward aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className="seo-guide-container seo-guide-content">
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

            <section
              aria-labelledby="links-heading"
              className="seo-guide-section seo-guide-method"
            >
              <div className="seo-guide-section__intro">
                <h2 id="links-heading">Find the creator and the project</h2>
                <p>Source code, background, and a direct line to feedback.</p>
              </div>
              <div className="seo-guide-problems seo-guide-about-links">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="seo-guide-problem"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <h3>{link.title}</h3>
                      <p>{link.description}</p>
                    </div>
                    <MdArrowForward aria-hidden="true" />
                  </a>
                ))}
                <button
                  type="button"
                  className="seo-guide-problem"
                  onClick={() => openFeedback()}
                >
                  <div>
                    <h3>Send feedback</h3>
                    <p>Report a problem or ask a question.</p>
                  </div>
                  <MdArrowForward aria-hidden="true" />
                </button>
              </div>
            </section>

            <section
              aria-labelledby="faq-heading"
              className="seo-guide-section seo-guide-faq"
            >
              <div className="seo-guide-section__intro">
                <h2 id="faq-heading">Frequently asked questions</h2>
              </div>
              <div className="seo-guide-faq__list">
                {copy.faqs.map(({ q, a }, index) => (
                  <details key={q} open={index === 0}>
                    <summary>
                      <MdCheckCircleOutline aria-hidden="true" />
                      <span>{q}</span>
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </main>
        <footer className="seo-guide-footer">
          Diagramwise — design architectures, explain decisions, and improve the
          result.
        </footer>
      </div>
    </>
  );
};

export default About;
