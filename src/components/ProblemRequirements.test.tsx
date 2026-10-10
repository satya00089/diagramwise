import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import ProblemRequirements from "./ProblemRequirements";
import AssessmentFindings from "./AssessmentFindings";
import InspectorPanel from "./InspectorPanel";
import ProblemGuideContent from "./problem-guide/ProblemGuideContent";
import type { RequirementSpec } from "../types/requirements";
import type { ProblemGuide } from "../types/problemGuide";
import type {
  AssessmentHistoryEntry,
  DesignReasoningContext,
  ReviewFinding,
  ValidationResult,
} from "../types/systemDesign";

vi.mock("./ReasoningPanel", () => ({ default: () => null }));
vi.mock("./GuidedHelpPanel", () => ({
  default: ({ appliedGuidedStepIds }: { appliedGuidedStepIds?: string[] }) => (
    <output>{appliedGuidedStepIds?.join(",")}</output>
  ),
}));
vi.mock("../contexts/FeedbackContext", () => ({
  useFeedback: () => ({ openFeedback: vi.fn(), submitFeedback: vi.fn() }),
}));
vi.mock("../hooks/useRoughAnnotation", () => ({ useRoughAnnotation: vi.fn() }));
vi.mock("../utils/lazyWithRetry", () => ({ lazyWithRetry: () => () => null }));

const spec: RequirementSpec = {
  schemaVersion: 1,
  revision: "brief-2",
  functional: [
    { id: "f-create", text: "Create documents", scope: "core" },
    { id: "f-export", text: "Export to PDF", scope: "extension" },
  ],
  nonFunctional: [
    {
      id: "nf-availability",
      text: "Keep document reads available",
      scope: "core",
      category: "availability",
    },
  ],
  assumptions: ["Most documents are read more often than edited"],
};
const review = (
  overrides: Partial<ValidationResult> = {},
): ValidationResult => ({
  isValid: true,
  score: 77,
  source: "ai",
  verdict: "strong_alignment",
  feedback: [],
  suggestions: [],
  missingComponents: [],
  architectureStrengths: [],
  improvements: [],
  ...overrides,
});
const history = (
  id: string,
  overrides: Partial<AssessmentHistoryEntry> = {},
): AssessmentHistoryEntry => ({
  id,
  score: 70,
  findingCount: 1,
  createdAt: "2026-10-10T00:00:00Z",
  source: "ai",
  addressedFindingIds: [],
  rubricVersion: "rubric-1",
  requirementRevision: "brief-2",
  modelVersion: "model-1",
  ...overrides,
});
const reasoning: DesignReasoningContext = {};
const renderInspector = (
  result: ValidationResult,
  entries: AssessmentHistoryEntry[] = [],
  onSelectEvidence?: (id: string) => void,
  options: Partial<ComponentProps<typeof InspectorPanel>> = {},
) =>
  renderToStaticMarkup(
    <InspectorPanel
      problem={{
        id: "test",
        title: "Documents",
        description: "Design documents",
        requirements: ["Legacy"],
        requirementSpec: spec,
        constraints: [],
        hints: [],
        tags: [],
      }}
      activeTab="assessment"
      setActiveTab={vi.fn()}
      inspectedNodeId={null}
      setInspectedNodeId={vi.fn()}
      inspectedEdgeId={null}
      setInspectedEdgeId={vi.fn()}
      propertyElements={null}
      customPropertyElements={null}
      edgePropertyElements={null}
      onAddCustomProperty={vi.fn()}
      handleSave={vi.fn()}
      reasoningContext={reasoning}
      canvasStats={{
        componentCount: 2,
        connectionCount: 1,
        componentTypes: [],
        disconnectedCount: 0,
      }}
      assessmentResult={result}
      assessmentHistory={entries}
      onSelectEvidence={onSelectEvidence}
      onReviewAgain={vi.fn()}
      {...options}
    />,
  );

describe("ProblemRequirements", () => {
  it("shows core functional and quality requirements before a closed extension disclosure", () => {
    const html = renderToStaticMarkup(
      <ProblemRequirements
        requirementSpec={spec}
        constraints={["Use the existing deployment"]}
      />,
    );
    expect(html).toContain("Functional requirements");
    expect(html).toContain("Non-functional requirements");
    expect(html.indexOf("Create documents")).toBeLessThan(
      html.indexOf("<details"),
    );
    expect(html.indexOf("Keep document reads available")).toBeLessThan(
      html.indexOf("<details"),
    );
    expect(html).toContain("Optional extensions");
    expect(html).toContain("Export to PDF");
    expect(html).not.toMatch(/<details[^>]*\bopen/);
    expect(html).toContain("Assumptions");
    expect(html).toContain(spec.assumptions[0]);
    expect(html).toContain("Constraints");
  });

  it("retains mixed legacy lists without guessing functional or quality classification", () => {
    const html = renderToStaticMarkup(
      <ProblemRequirements
        requirements={["Create documents", "100M readers"]}
        constraints={["Never expire documents"]}
      />,
    );
    expect(html).toContain("Requirements");
    expect(html).toContain("100M readers");
    expect(html).toContain("Never expire documents");
    expect(html).not.toContain("Functional requirements");
    expect(html).not.toContain("Non-functional requirements");
    expect(html).not.toContain("Assumptions");
  });

  it("uses the typed specification instead of retaining a conflicting legacy brief", () => {
    const html = renderToStaticMarkup(
      <ProblemRequirements
        requirementSpec={spec}
        requirements={["Conflicting legacy scope"]}
        compact
      />,
    );
    expect(html).toContain("Create documents");
    expect(html).not.toContain("Conflicting legacy scope");
  });

  it("renders empty categories explicitly and escapes user-authored requirement text", () => {
    const html = renderToStaticMarkup(
      <ProblemRequirements
        requirementSpec={{
          ...spec,
          functional: [
            { id: "safe", text: "<script>alert(1)</script>", scope: "core" },
          ],
          nonFunctional: [],
          assumptions: [],
        }}
      />,
    );
    expect(html).toContain("None specified.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("AssessmentFindings", () => {
  const critical: ReviewFinding = {
    severity: "critical",
    kind: "defect",
    title: "Missing writes",
    explanation: "Document edits are lost",
    recommendation: "Persist the edit before acknowledging it",
    requirement_ids: ["f-create"],
    evidence_ids: ["node-writer"],
  };

  it("prioritizes three actions and deduplicates supplemental advice", () => {
    const findings: ReviewFinding[] = Array.from({ length: 4 }, (_, index) => ({
      ...critical,
      severity: index === 3 ? "critical" : "important",
      title: `Action ${index}`,
      recommendation: `Change ${index}`,
    }));
    const html = renderToStaticMarkup(
      <AssessmentFindings
        findings={findings}
        suggestions={["Change 3", " CHANGE 3! "]}
      />,
    );
    const initiallyVisible = html.slice(0, html.indexOf("<details"));
    expect(initiallyVisible.match(/<article/g)).toHaveLength(3);
    expect(initiallyVisible.indexOf("Action 3")).toBeLessThan(
      initiallyVisible.indexOf("Action 0"),
    );
    expect(html.match(/Change 3/g)).toHaveLength(1);
    expect(html).toContain("More observations (1)");
  });

  it("keeps strengths and places optional extensions outside defect actions", () => {
    const html = renderToStaticMarkup(
      <AssessmentFindings
        requirementSpec={spec}
        findings={[
          {
            ...critical,
            title: "Add PDF export",
            kind: "defect",
            requirement_ids: ["f-export"],
          },
          {
            severity: "positive",
            title: "Durable document writes",
            explanation: "Acknowledgements follow the durable write",
          },
        ]}
        strengths={["Durable document writes"]}
      />,
    );
    expect(html).not.toContain("Next actions");
    expect(html).toContain("Strengths");
    expect(html).toContain("Optional improvements (1)");
    expect(html).not.toContain(">Critical<");
    expect(html.match(/Durable document writes/g)).toHaveLength(1);
  });

  it("describes learner changes as unverified and exposes evidence only when selection is available", () => {
    const html = renderToStaticMarkup(
      <AssessmentFindings
        findings={[critical]}
        addressedFindingIds={["critical:missing writes"]}
        onToggleAddressed={vi.fn()}
        onSelectEvidence={vi.fn()}
      />,
    );
    expect(html).toContain("Changed — review again");
    expect(html).toContain("has not been verified");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Show evidence: node-writer");
    const readOnly = renderToStaticMarkup(
      <AssessmentFindings findings={[critical]} />,
    );
    expect(readOnly).not.toContain("Show evidence:");
    expect(readOnly).toContain("Evidence: node-writer");
  });
});

describe("InspectorPanel assessment trust", () => {
  it("bounds the panel to the viewport and exposes its expanded state", () => {
    const html = renderInspector(review());
    expect(html).toContain("max-width:calc(100vw - 3rem)");
    expect(html).toContain("max-md:absolute");
    expect(html).toContain('aria-expanded="true"');
  });
  it("reserves separate touch targets for both mobile drawers", () => {
    const html = renderInspector(review(), [], undefined, { compact: true, compactOpen: true });
    expect(html).toContain("max-width:calc(100vw - 6rem)");
    const collapsed = renderInspector(review(), [], undefined, { compact: true, compactOpen: false });
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain("width:24px");
    expect(collapsed).not.toContain("Architecture review");
  });
  it("shows an AI score once and overrides a positive verdict for a critical core defect", () => {
    const html = renderInspector(
      review({
        findings: [
          {
            title: "Lost edits",
            explanation: "Missing durability",
            severity: "critical",
            kind: "defect",
            requirement_ids: ["f-create"],
          },
        ],
      }),
    );
    expect(html).toContain("77");
    expect(html.match(/\/100/g)).toHaveLength(1);
    expect(html).toContain("Needs revision");
    expect(html).not.toContain("Strong alignment");
    expect(html).not.toContain(">Pass<");
  });

  it("does not treat an optional extension as a critical core defect", () => {
    const html = renderInspector(
      review({
        findings: [
          {
            title: "PDF export",
            explanation: "Optional feature",
            severity: "critical",
            requirement_ids: ["f-export"],
          },
        ],
      }),
    );
    expect(html).toContain("Strong alignment");
    expect(html).not.toContain("Needs revision");
  });

  it.each([
    { source: "rule_based" as const },
    { source: "ai" as const, scoreAvailable: false },
    { source: undefined },
  ])(
    "leaves unavailable or legacy fallback scores unscored: %j",
    (overrides) => {
      const html = renderInspector(review(overrides));
      expect(html).not.toContain("/100");
      expect(html).toContain("AI review unavailable");
      expect(html).toContain("Retry AI review");
      expect(html).not.toContain("How this score works");
    },
  );

  it("renders requirement evidence controls and keeps dimensional detail collapsed", () => {
    const html = renderInspector(
      review({
        requirementCoverage: [
          {
            requirement_id: "f-create",
            status: "supported",
            explanation: "Durable writer supports creation",
            evidence_ids: ["writer"],
          },
        ],
        detailedAnalysis: {
          reliability: "Replicated writes preserve documents",
        },
      }),
      [],
      vi.fn(),
    );
    expect(html).toContain("Create documents");
    expect(html).toContain("Supported by the design");
    expect(html).toContain("Show evidence: writer");
    expect(html).toContain("Detailed analysis");
    expect(html).not.toMatch(/<details[^>]*\bopen/);
  });

  it("labels a previous successful AI result as an earlier review during fallback", () => {
    const html = renderInspector(
      review({ source: "rule_based", score: 0 }),
      [],
      undefined,
      { previousAiAssessment: review({ score: 91 }) },
    );
    expect(html).toContain("Previous AI review: 91/100");
    expect(html).toContain("current design has not been AI-reviewed");
    expect(html).not.toContain("0/100");
    expect(html).toContain("Retry AI review");
  });

  it("labels an older review and resolves its coverage against the pinned brief only", () => {
    const oldSpec: RequirementSpec = {
      ...spec,
      revision: "brief-1",
      functional: [{ id: "old-read", text: "Read original documents", scope: "core" }],
      nonFunctional: [],
    };
    const html = renderInspector(review({
      requirementRevision: "brief-1",
      requirementCoverage: [{ requirement_id: "old-read", status: "supported",
        explanation: "Original read path", evidence_ids: [] }],
    }), [], undefined, { reviewedRequirementSpec: oldSpec });
    expect(html).toContain("This review uses an earlier problem brief");
    expect(html).toContain("a new review will use that current brief");
    expect(html).toContain("Read original documents");
    expect(html).not.toContain("Create documents");
    const withoutSnapshot = renderInspector(review({ requirementRevision: "brief-1" }));
    expect(withoutSnapshot).toContain("This review uses an earlier problem brief");
  });

  it("labels the fallback tab without a numeric badge or a publish-reviewed prompt", () => {
    const html = renderInspector(
      review({ source: "rule_based", score: 0 }),
      [],
      undefined,
      { onShareToWorld: vi.fn() },
    );
    const tabs = html.slice(
      html.indexOf('role="tablist"'),
      html.indexOf('aria-hidden="true"', html.indexOf(">Properties<")),
    );
    expect(tabs).toContain("Structure checks");
    expect(tabs).not.toContain(">0<");
    expect(html).not.toContain("Publish reviewed design");
    const scored = renderInspector(review(), [], undefined, {
      onShareToWorld: vi.fn(),
    });
    expect(scored).toContain("Publish reviewed design");
  });

  it("forwards persisted walkthrough progress and supports boolean step application", () => {
    const html = renderInspector(review(), [], undefined, {
      activeTab: "guide",
      onApplyStep: () => true,
      appliedGuidedStepIds: ["step-1", "step-2"],
    });
    expect(html).toContain("step-1,step-2");
  });

  it.each([
    { score: null },
    { source: "rule_based" as const },
    { scoreAvailable: false },
    { rubricVersion: undefined },
    { requirementRevision: undefined },
    { modelVersion: undefined },
    { rubricVersion: "rubric-2" },
    { requirementRevision: "brief-3" },
    { modelVersion: "model-2" },
  ])(
    "does not compare history with missing or differing provenance: %j",
    (overrides) => {
      const html = renderInspector(review(), [
        history("old", overrides),
        history("new", { score: 77 }),
      ]);
      expect(html).toContain("Not comparable");
      expect(html).not.toContain("+7");
      if (overrides.source === "rule_based")
        expect(html).toContain("Structure check · unscored");
    },
  );

  it("compares only fully versioned AI entries and avoids change claims on identical input", () => {
    const entries = [history("old"), history("new", { score: 77 })];
    expect(renderInspector(review(), entries)).toContain("+7");
    const sameInput = entries.map((entry) => ({
      ...entry,
      inputFingerprint: "same-input",
    }));
    expect(renderInspector(review(), sameInput)).not.toContain("+7");
    expect(renderInspector(review(), sameInput)).toContain("Same input");
  });
});

describe("ProblemGuideContent approved scope", () => {
  const guide: ProblemGuide = {
    prompt: {
      brief: "Conflicting old guide brief",
      successSignals: ["Discuss tradeoffs"],
    },
    requirements: {
      functional: ["Conflicting guide requirement"],
      nonFunctional: ["Guide quality target"],
      scaleAssumptions: ["Old traffic assumption"],
      metrics: [
        {
          label: "Old throughput",
          value: "100M/day",
          description: "Old numeric target",
        },
      ],
    },
    entities: [],
    apis: [],
    dataFlow: [],
    deepDives: [],
    tradeoffs: [],
    commonMistakes: [],
    followUps: [],
    rubric: [],
    architecture: {
      title: "Reference",
      summary: "Example",
      layers: [],
      components: [],
      connections: [],
    },
  };

  it("renders approved scope and hides conflicting guide requirements and numeric assumptions", () => {
    const html = renderToStaticMarkup(
      <ProblemGuideContent
        guide={guide}
        requirementSpec={spec}
        problemDescription="Approved problem description"
      />,
    );
    expect(html).toContain("Approved problem description");
    expect(html).toContain("Create documents");
    expect(html).not.toContain("Conflicting guide requirement");
    expect(html).not.toContain("Old traffic assumption");
    expect(html).not.toContain("100M/day");
  });

  it("renders legacy problem arrays faithfully rather than adopting the guide's classification", () => {
    const html = renderToStaticMarkup(
      <ProblemGuideContent
        guide={guide}
        requirements={["Original mixed requirement"]}
        constraints={["Original restriction"]}
      />,
    );
    expect(html).toContain("Original mixed requirement");
    expect(html).toContain("Original restriction");
    expect(html).not.toContain("Guide quality target");
    expect(html).not.toContain("Functional requirements");
  });
});
