import type {
  SystemDesignSolution,
  SystemDesignProblem,
  ValidationResult,
  ValidationFeedback,
  ReviewFinding,
  DesignReasoningContext,
  InterviewResponse,
  InterviewSession,
} from "../types/systemDesign";
import type {
  RequirementCoverage,
  RequirementSpec,
} from "../types/requirements";

export type AssessmentPayload = {
  components: Array<{
    id: string;
    type: string;
    label: string;
    properties: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
    description?: string;
  }>;
  explanation?: string;
  keyPoints?: string[];
  reasoningContext?: DesignReasoningContext;
  interviewSession?: InterviewSession;
  problem: {
    id?: string;
    requirementSpec?: RequirementSpec;
    requirementRevision?: string;
    title: string;
    description: string;
    requirements?: string;
    constraints?: string;
    difficulty?: string;
    category?: string;
    estimatedTime?: string;
  } | null;
};

// Valid component types accepted by the backend.
const VALID_BACKEND_TYPES = new Set([
  "frontend",
  "backend",
  "database",
  "cache",
  "load-balancer",
  "api-gateway",
  "message-broker",
  "queue",
  "cdn",
  "monitoring",
  "analytics",
  "external-api",
  "storage",
  "security",
  "custom",
]);

export const normalizeComponentType = (type: string): string => {
  const t = type.toLowerCase();
  if (VALID_BACKEND_TYPES.has(t)) return t;
  if (t === "client" || t === "web-server" || t === "web_server")
    return "frontend";
  if (
    t === "application-server" ||
    t === "application_server" ||
    t === "microservice" ||
    t === "service" ||
    t === "server" ||
    t === "notification-service" ||
    t === "search-engine" ||
    t === "backend-server" ||
    t === "scheduler" ||
    t === "search" ||
    t === "configuration-service"
  )
    return "backend";
  if (t === "nosql" || t === "sql" || t === "rdbms" || t === "db")
    return "database";
  if (
    t === "file-storage" ||
    t === "file_storage" ||
    t === "blob" ||
    t === "s3" ||
    t === "object-storage"
  )
    return "storage";
  if (t === "firewall" || t === "waf" || t === "auth" || t === "auth-service")
    return "security";
  if (t === "loadbalancer" || t === "load_balancer") return "load-balancer";
  if (t === "tracing") return "monitoring";
  return "custom";
};

// AI-powered assessor that calls your FastAPI service
export async function assessSolution(
  solution?: SystemDesignSolution | null,
  problem?: SystemDesignProblem | null,
  interviewSession?: InterviewSession,
): Promise<ValidationResult> {
  if (!solution) {
    return {
      isValid: false,
      score: 0,
      scoreAvailable: false,
      verdict: "unavailable",
      summary: "No design was submitted for review.",
      findings: [],
      feedback: [
        {
          type: "error",
          message: "No solution provided.",
          category: "maintainability",
        },
      ],
      suggestions: ["Please add components to your design for assessment."],
      missingComponents: [],
      architectureStrengths: [],
      improvements: [],
    };
  }

  const apiUrl = import.meta.env.VITE_ASSESSMENT_API_URL;

  if (!apiUrl) {
    throw new Error(
      "VITE_ASSESSMENT_API_URL not configured. Please add it to your .env file.",
    );
  }

  try {
    const requestPayload = buildAssessmentPayload(
      solution,
      problem,
      interviewSession,
    );

    const response = await fetch(`${apiUrl}/api/v1/assess`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(
        response.status === 409
          ? "The problem requirements changed. Reload this problem and review the updated brief before assessing again."
          : "The assessment service is temporarily unavailable. Your design is still on the canvas; please retry the AI review.",
      );
    }

    const result = await response.json();

    // Transform FastAPI response to match frontend ValidationResult interface
    const assessment = transformApiResponse(result);
    assessment.inputFingerprint = fingerprintAssessmentPayload(requestPayload);
    return assessment;
  } catch (error) {
    console.error("AI Assessment failed:", error);

    // Return error result instead of fallback
    return {
      isValid: false,
      score: 0,
      scoreAvailable: false,
      verdict: "unavailable",
      summary:
        error instanceof Error
          ? error.message
          : "The assessment service is temporarily unavailable. Please retry the AI review.",
      feedback: [
        {
          type: "error",
          message: `Assessment service unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
          category: "maintainability",
        },
      ],
      suggestions: [
        "Please ensure the assessment service is running and try again.",
      ],
      source: undefined,
      missingComponents: [],
      architectureStrengths: [],
      improvements: [],
    };
  }
}

export function buildAssessmentPayload(
  solution: SystemDesignSolution,
  problem?: SystemDesignProblem | null,
  interviewSession?: InterviewSession,
): AssessmentPayload {
  return {
    // Filter out group/layout nodes that don't represent real architecture components
    components: solution.components
      .filter((comp) => (comp.type as string) !== "group")
      .map((comp, i) => ({
        id: comp.id || `component-${i}`,
        type: normalizeComponentType(
          String(comp.properties?.componentId ?? comp.type),
        ),
        label: comp.label,
        properties: comp.properties || {},
        position: comp.position,
      })),
    connections: (() => {
      // Build set of excluded (group) component IDs so we can drop their connections
      const excludedIds = new Set(
        solution.components
          .filter((c) => (c.type as string) === "group")
          .map((c) => c.id),
      );
      return (solution.connections ?? [])
        .filter(
          (conn) =>
            !excludedIds.has(conn.source) && !excludedIds.has(conn.target),
        )
        .map((conn, i) => ({
          id: conn.id || `connection-${i}`,
          source: conn.source,
          target: conn.target,
          label: conn.label,
          type: conn.type,
          description:
            (conn.properties?.purpose as string | undefined) ||
            conn.description ||
            (conn.properties?.description as string | undefined),
        }));
    })(),
    explanation: solution.explanation,
    keyPoints: solution.keyPoints,
    reasoningContext: solution.reasoningContext,
    interviewSession,
    // Include problem context for better AI assessment
    problem: problem
      ? {
          id: problem.id || undefined,
          requirementSpec: problem.requirementSpec,
          requirementRevision: problem.requirementSpec?.revision,
          title: problem.title,
          description: problem.description,
          requirements: Array.isArray(problem.requirements)
            ? problem.requirements.join(".\n")
            : problem.requirements,
          constraints: Array.isArray(problem.constraints)
            ? problem.constraints.join(".\n")
            : problem.constraints,
          difficulty: problem.difficulty,
          category: problem.category,
          estimatedTime: problem.estimated_time,
        }
      : null,
  };
}

/** Non-security identity of meaningful review input; moving nodes is not a revision. */
export function fingerprintAssessmentPayload(
  payload: AssessmentPayload,
): string {
  const presentation = new Set([
    "position",
    "x",
    "y",
    "width",
    "height",
    "selected",
    "dragging",
    "icon",
    "iconUrl",
    "subtitle",
    "_guidedAppliedSteps",
  ]);
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !presentation.has(key))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  const input = JSON.stringify(
    canonical({
      ...payload,
      components: [...payload.components].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      connections: [...payload.connections].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    }),
  );
  let hash = 2166136261;
  for (const character of input)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `design-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function generateInterviewQuestions(
  solution: SystemDesignSolution,
  problem?: SystemDesignProblem | null,
): Promise<string[]> {
  const apiUrl = import.meta.env.VITE_ASSESSMENT_API_URL;
  if (!apiUrl) {
    throw new Error(
      "VITE_ASSESSMENT_API_URL not configured. Please add it to your .env file.",
    );
  }

  const response = await fetch(`${apiUrl}/api/v1/interview/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      architecture: buildAssessmentPayload(solution, problem),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Interview questions API failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = (await response.json()) as { questions?: unknown };
  if (!Array.isArray(result.questions)) {
    throw new TypeError("Interview questions response was invalid.");
  }

  const questions = result.questions.filter(
    (question): question is string =>
      typeof question === "string" && question.trim().length > 0,
  );
  if (questions.length === 0) {
    throw new Error("Interview questions response was empty.");
  }

  return questions.slice(0, 5);
}

export async function critiqueInterviewAnswer(
  solution: SystemDesignSolution,
  problem: SystemDesignProblem | null | undefined,
  question: string,
  answer: string,
  previousCritique?: string,
): Promise<InterviewResponse> {
  const apiUrl = import.meta.env.VITE_ASSESSMENT_API_URL;
  if (!apiUrl) {
    throw new Error(
      "VITE_ASSESSMENT_API_URL not configured. Please add it to your .env file.",
    );
  }

  const response = await fetch(`${apiUrl}/api/v1/interview/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      architecture: buildAssessmentPayload(solution, problem),
      question,
      answer,
      previousCritique,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Interview API failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = (await response.json()) as {
    critique?: unknown;
    strengths?: unknown;
    gaps?: unknown;
    nextQuestion?: unknown;
  };

  if (typeof result.critique !== "string" || !result.critique.trim()) {
    throw new Error("Interview response did not include a critique.");
  }

  const asStringList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

  return {
    critique: result.critique,
    strengths: asStringList(result.strengths),
    gaps: asStringList(result.gaps),
    nextQuestion:
      typeof result.nextQuestion === "string" ? result.nextQuestion : undefined,
  };
}

// Transform FastAPI response to frontend ValidationResult format
export function transformApiResponse(apiResult: unknown): ValidationResult {
  const result = apiResult as {
    is_valid?: boolean;
    overall_score?: number;
    feedback?: Array<{
      type: string;
      message: string;
      category: string;
      priority?: number;
    }>;
    suggestions?: string[];
    missing_components?: string[];
    strengths?: string[];
    improvements?: string[];
    scores?: import("../types/systemDesign").ScoreBreakdown;
    detailed_analysis?: Record<string, string>;
    interview_questions?: string[];
    summary?: string;
    findings?: Array<{
      title?: unknown;
      explanation?: unknown;
      recommendation?: unknown;
      severity?: unknown;
    }>;
    source?: string;
    missing_descriptions?: string[];
    unclear_connections?: string[];
    processing_time_ms?: number;
    assessment_id?: string;
    trace_id?: string;
    score_available?: boolean;
    verdict?: ValidationResult["verdict"];
    rubric_version?: string;
    requirement_revision?: string;
    model_version?: string;
    requirement_coverage?: RequirementCoverage[];
    structural_checks?: ValidationResult["structuralChecks"];
  };

  const feedback: ValidationFeedback[] = (result.feedback || []).map((fb) => ({
    type: fb.type as ValidationFeedback["type"],
    message: fb.message,
    category: fb.category as ValidationFeedback["category"],
    priority: fb.priority,
  }));

  const validSeverities = new Set<ReviewFinding["severity"]>([
    "critical",
    "important",
    "improvement",
    "positive",
  ]);
  const findings: ReviewFinding[] = (result.findings ?? []).flatMap(
    (finding) => {
      if (
        typeof finding.title !== "string" ||
        typeof finding.explanation !== "string" ||
        typeof finding.severity !== "string" ||
        !validSeverities.has(finding.severity as ReviewFinding["severity"])
      ) {
        return [];
      }
      return [
        {
          title: finding.title,
          explanation: finding.explanation,
          recommendation:
            typeof finding.recommendation === "string"
              ? finding.recommendation
              : undefined,
          severity: finding.severity as ReviewFinding["severity"],
          ...("evidence_ids" in finding
            ? { evidence_ids: (finding as ReviewFinding).evidence_ids }
            : {}),
          ...("requirement_ids" in finding
            ? { requirement_ids: (finding as ReviewFinding).requirement_ids }
            : {}),
          ...("kind" in finding
            ? { kind: (finding as ReviewFinding).kind }
            : {}),
          ...("criterion" in finding
            ? { criterion: (finding as ReviewFinding).criterion }
            : {}),
          ...("scored_gap" in finding
            ? { scored_gap: (finding as ReviewFinding).scored_gap }
            : {}),
        },
      ];
    },
  );

  return {
    isValid: result.is_valid || false,
    score: result.overall_score || 0,
    feedback,
    summary: typeof result.summary === "string" ? result.summary : undefined,
    findings,
    suggestions: result.suggestions || [],
    missingComponents: result.missing_components || [],
    architectureStrengths: result.strengths || [],
    improvements: result.improvements || [],
    scores: result.scores,
    detailedAnalysis: result.detailed_analysis,
    interviewQuestions: result.interview_questions || [],
    missingDescriptions: result.missing_descriptions || [],
    unclearConnections: result.unclear_connections || [],
    processingTimeMs: result.processing_time_ms,
    source: result.source === "rule_based" ? "rule_based" : "ai",
    assessmentId: result.assessment_id,
    traceId: result.trace_id,
    scoreAvailable: result.source === "ai" && result.score_available !== false,
    verdict: result.verdict,
    rubricVersion: result.rubric_version,
    requirementRevision: result.requirement_revision,
    modelVersion: result.model_version,
    requirementCoverage: result.requirement_coverage ?? [],
    structuralChecks: result.structural_checks ?? [],
  };
}

// Utility function to test API connectivity
export async function testAssessmentAPI(): Promise<boolean> {
  const apiUrl = import.meta.env.VITE_ASSESSMENT_API_URL;

  if (!apiUrl) {
    console.warn("VITE_ASSESSMENT_API_URL not configured");
    return false;
  }

  try {
    const response = await fetch(`${apiUrl}/health`);
    return response.ok;
  } catch (error) {
    console.error("Assessment API health check failed:", error);
    return false;
  }
}

// Backward compatibility - default export with problem parameter
export default assessSolution;
