import type { RequirementCoverage, RequirementSpec } from "./requirements";

export interface SystemDesignProblem {
  id: string;
  slug?: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Very Hard";
  category: string;
  domain: string;
  estimated_time: string;
  requirements: string[];
  requirementSpec?: RequirementSpec;
  constraints: string[];
  hints: string[];
  sampleSolution?: SystemDesignSolution;
  tags: string[];
  has_guided_walkthrough?: boolean;
}

export interface SystemDesignSolution {
  components: SystemComponent[];
  connections: SystemConnection[];
  explanation: string;
  keyPoints: string[];
  reasoningContext?: DesignReasoningContext;
}

/**
 * System-generated context for the design as a whole. This is intentionally
 * separate from node properties so the reviewer can distinguish problem and
 * canvas facts from implementation details.
 */
export interface DesignReasoningContext {
  requirements?: string;
  scaleAssumptions?: string;
  expectedTraffic?: string;
  readWriteRatio?: string;
  latencyGoals?: string;
  availabilityTarget?: string;
  consistencyRequirements?: string;
  technologyChoices?: string;
  tradeoffs?: string;
  unresolvedRisks?: string;
}

export const EMPTY_REASONING_CONTEXT: DesignReasoningContext = {
  requirements: "",
  scaleAssumptions: "",
  expectedTraffic: "",
  readWriteRatio: "",
  latencyGoals: "",
  availabilityTarget: "",
  consistencyRequirements: "",
  technologyChoices: "",
  tradeoffs: "",
  unresolvedRisks: "",
};

export interface InterviewExchange {
  id: string;
  question: string;
  answer: string;
  critique: string;
  strengths: string[];
  gaps: string[];
  nextQuestion?: string;
  createdAt: string;
  skipped?: boolean;
}

export interface InterviewSession {
  exchanges: InterviewExchange[];
  currentQuestionIndex: number;
}

export interface InterviewResponse {
  critique: string;
  strengths: string[];
  gaps: string[];
  nextQuestion?: string;
}

export interface SystemComponent {
  id: string;
  type: ComponentType;
  label: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  description?: string;
}

export interface SystemConnection {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  label?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

export type ComponentType =
  | "client"
  | "load-balancer"
  | "web-server"
  | "application-server"
  | "database"
  | "cache"
  | "queue"
  | "cdn"
  | "api-gateway"
  | "microservice"
  | "message-broker"
  | "search-engine"
  | "file-storage"
  | "notification-service"
  | "monitoring"
  | "analytics"
  | "external-api";

export type ConnectionType =
  | "http"
  | "tcp"
  | "websocket"
  | "message-queue"
  | "database-connection"
  | "api-call"
  | "data-flow"
  | "event-stream";

export interface ValidationResult {
  isValid: boolean;
  score: number;
  feedback: ValidationFeedback[];
  summary?: string;
  findings?: ReviewFinding[];
  suggestions: string[];
  missingComponents: string[];
  architectureStrengths: string[];
  improvements: string[];
  scores?: ScoreBreakdown;
  detailedAnalysis?: Record<string, string>;
  interviewQuestions?: string[];
  missingDescriptions?: string[];
  unclearConnections?: string[];
  processingTimeMs?: number;
  source?: "ai" | "rule_based";
  assessmentId?: string;
  traceId?: string;
  /** Legacy numeric score is a compatibility placeholder when this is false. */
  scoreAvailable?: boolean;
  verdict?:
    | "strong_alignment"
    | "needs_revision"
    | "more_context_needed"
    | "unavailable";
  rubricVersion?: string;
  requirementRevision?: string;
  modelVersion?: string;
  inputFingerprint?: string;
  requirementCoverage?: RequirementCoverage[];
  structuralChecks?: Array<{
    title: string;
    status: string;
    explanation: string;
  }>;
}

export type ReviewFindingSeverity =
  | "critical"
  | "important"
  | "improvement"
  | "positive";

export interface ReviewFinding {
  title: string;
  explanation: string;
  recommendation?: string;
  severity: ReviewFindingSeverity;
  evidence_ids?: string[];
  requirement_ids?: string[];
  kind?: "defect" | "clarification" | "extension" | "strength";
  criterion?: string | null;
  scored_gap?: boolean;
}

export interface AssessmentHistoryEntry {
  id: string;
  score: number | null;
  findingCount: number;
  createdAt: string;
  source?: "ai" | "rule_based";
  addressedFindingIds: string[];
  scoreAvailable?: boolean;
  rubricVersion?: string;
  requirementRevision?: string;
  modelVersion?: string;
  inputFingerprint?: string;
}

export const getReviewFindingId = (finding: ReviewFinding): string =>
  `${finding.severity}:${finding.title.trim().toLowerCase()}`;

export interface ScoreBreakdown {
  scalability: number;
  reliability: number;
  security: number;
  maintainability: number;
  performance?: number;
  cost_efficiency?: number;
  observability?: number;
  deliverability?: number;
  requirements_alignment?: number;
  constraint_compliance?: number;
  component_justification?: number;
  connection_clarity?: number;
}

export interface ValidationFeedback {
  type: "error" | "warning" | "success" | "info";
  message: string;
  component?: string;
  category:
    | "scalability"
    | "reliability"
    | "performance"
    | "security"
    | "cost"
    | "maintainability"
    | "observability"
    | "deliverability"
    | "requirements"
    | "constraints"
    | "component_description"
    | "connection_reasoning";
  priority?: number;
}

export interface ComponentTemplate {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
  defaultProperties: Record<string, unknown>;
  category: "frontend" | "backend" | "database" | "infrastructure" | "external";
  color: string;
}

// ─── Guided Walkthrough Types ────────────────────────────────────────────────

export type GuidedStepType =
  | "explanation"
  | "add_component"
  | "add_connection"
  | "decision_point"
  | "scale_trigger"
  | "update_component";

export interface GuidedComponentStep {
  /** Stable node ID — prefixed with "guided_" when placed on the canvas */
  nodeId: string;
  componentType: string;
  label: string;
  /** Short description shown as the node subtitle on the canvas */
  description?: string;
  position: { x: number; y: number };
  iconUrl?: string;
  properties: Record<string, string | number | boolean>;
  data?: Record<string, unknown>;
  /** One-liner explaining why this specific component was chosen */
  highlightReason: string;
}

export interface GuidedConnectionStep {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  connectionType: ConnectionType;
  label: string;
  description: string;
}

export interface GuidedDecisionAlternative {
  option: string;
  tradeoff: string;
}

export interface GuidedDecisionPoint {
  question: string;
  chosen: string;
  chosenReason: string;
  alternatives: GuidedDecisionAlternative[];
}

export interface GuidedScaleTrigger {
  metric: string;
  action: string;
  impact: string;
  /** Optional component to add when this trigger fires */
  component?: GuidedComponentStep;
}

export interface GuidedStep {
  id: string;
  stepNumber: number;
  phase: string;
  title: string;
  type: GuidedStepType;
  /** Main teaching content — supports Markdown */
  content: string;
  component?: GuidedComponentStep;
  connection?: GuidedConnectionStep;
  decision?: GuidedDecisionPoint;
  scaleTrigger?: GuidedScaleTrigger;
  requirementIds?: string[];
  /** Applied only after the learner explicitly accepts this design change. */
  componentUpdate?: { nodeId: string; properties: Record<string, unknown> };
}

export interface GuidedWalkthroughPhase {
  name: string;
  stepRange: [number, number];
  description: string;
}

export interface GuidedWalkthrough {
  problem_id: string;
  version: string;
  totalSteps: number;
  phases: GuidedWalkthroughPhase[];
  steps: GuidedStep[];
  requirementRevision?: string;
}
