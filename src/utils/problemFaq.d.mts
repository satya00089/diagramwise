interface FaqProblem {
  title: string;
  description?: string;
  difficulty?: string;
  estimated_time?: string;
  requirements?: string[];
  tags?: string[];
}

interface FaqGuide {
  requirements?: { functional?: string[]; scaleAssumptions?: string[] };
  tradeoffs?: { title: string; recommendation: string }[];
  entities?: { name: string }[];
  commonMistakes?: string[];
}

export interface ProblemFaq {
  answerQuestion: string;
  answer: string;
  faqs: { q: string; a: string }[];
}

export function buildProblemFaq(
  problem: FaqProblem,
  guide?: FaqGuide | null,
): ProblemFaq;
