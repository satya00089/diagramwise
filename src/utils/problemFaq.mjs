// Builds the answer-first copy and FAQs for a problem page. Shared by
// prerender.js (static HTML) and ProblemLanding.tsx (live page) so both show
// identical text. Everything is derived from the problem and guide data.

// Linear-time replacement for /[chars]+$/ (which can backtrack).
const trimEndChars = (text, chars) => {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end -= 1;
  return text.slice(0, end);
};

const clip = (text = "", max = 220) => {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > 80) return cut.slice(0, sentence + 1);
  return `${trimEndChars(cut.slice(0, cut.lastIndexOf(" ")), " \t\n,:;-")}…`;
};

const sentenceList = (items, max = 4) =>
  items
    .filter(Boolean)
    .slice(0, max)
    .map((item) => trimEndChars(clip(item, 140), ". \t\n"))
    .join("; ");

const readable = (tag) => String(tag).replaceAll("-", " ");

export function buildProblemFaq(problem, guide) {
  const title = problem.title;
  const meta = [
    problem.difficulty ? `${problem.difficulty} difficulty` : "",
    problem.estimated_time ? `about ${problem.estimated_time}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const answer = `${clip(problem.description, 240)}${
    meta ? ` It is a practice challenge with ${meta}.` : ""
  }`;

  const faqs = [];
  const functional = guide?.requirements?.functional?.length
    ? guide.requirements.functional
    : problem.requirements || [];
  if (functional.length) {
    faqs.push({
      q: `What are the key requirements for "${title}"?`,
      a: `Key requirements include: ${sentenceList(functional)}.`,
    });
  }
  const scale = guide?.requirements?.scaleAssumptions || [];
  if (scale.length) {
    faqs.push({
      q: `What scale should I assume for "${title}"?`,
      a: `Plan for: ${sentenceList(scale, 3)}.`,
    });
  }
  const tradeoffs = guide?.tradeoffs || [];
  if (tradeoffs.length) {
    faqs.push({
      q: `What are the main trade-offs in "${title}"?`,
      a: tradeoffs
        .slice(0, 3)
        .map(
          (item) =>
            `${item.title}: ${trimEndChars(clip(item.recommendation, 160), ". \t\n")}.`,
        )
        .join(" "),
    });
  }
  const entities = guide?.entities || [];
  if (entities.length) {
    faqs.push({
      q: `What are the core entities in "${title}"?`,
      a: `The core entities are ${entities
        .slice(0, 6)
        .map((entity) => entity.name)
        .join(", ")}.`,
    });
  }
  const mistakes = guide?.commonMistakes || [];
  if (mistakes.length) {
    faqs.push({
      q: `What are common mistakes when designing "${title}"?`,
      a: `${sentenceList(mistakes, 3)}.`,
    });
  }
  const tags = problem.tags || [];
  if (tags.length) {
    faqs.push({
      q: `Which concepts does "${title}" test?`,
      a: `This challenge exercises ${tags
        .slice(0, 8)
        .map(readable)
        .join(", ")}.`,
    });
  }

  return {
    answerQuestion: `What does the "${title}" problem ask you to design?`,
    answer,
    faqs: faqs.length >= 2 ? faqs.slice(0, 5) : [],
  };
}
