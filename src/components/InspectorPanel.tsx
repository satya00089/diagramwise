import React from "react";
import { Link } from "react-router-dom";
import GuidedHelpPanel from "./GuidedHelpPanel";
import type { ApplyStepPayload } from "./GuidedHelpPanel";
import AssessmentFindings from "./AssessmentFindings";
import ProblemRequirements from "./ProblemRequirements";
import type { RequirementSpec } from "../types/requirements";
import ReasoningPanel from "./ReasoningPanel";
import type { DesignReasoningContext } from "../types/systemDesign";
import {
  PiDotsSixVerticalBold,
  PiCaretDownBold,
  PiCaretLeftBold,
  PiCaretRightBold,
} from "react-icons/pi";
import {
  MdAdd,
  MdAssessment,
  MdAutoAwesome,
  MdCheckCircle,
  MdClose,
  MdContentCopy,
  MdDescription,
  MdDownload,
  MdError,
  MdInfo,
  MdLabel,
  MdLightbulbOutline,
  MdLink,
  MdLockOpen,
  MdMenuBook,
  MdSettings,
  MdTrackChanges,
  MdWarning,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { FiShare2 } from "react-icons/fi";
import { useFeedback } from "../contexts/FeedbackContext";

// ── Assessment tab constants (defined once, not inside render) ──────────────
const DIM_LABELS: Record<string, string> = {
  scalability: "Scalability",
  reliability: "Reliability",
  security: "Security",
  maintainability: "Maintainability",
  performance: "Performance",
  cost_efficiency: "Cost Efficiency",
  observability: "Observability",
  deliverability: "Deliverability",
  requirements_alignment: "Requirements",
  constraint_compliance: "Constraints",
  component_justification: "Components",
  connection_clarity: "Connections",
};

const FEEDBACK_TYPE_ICON: Record<string, IconType> = {
  success: MdCheckCircle,
  warning: MdWarning,
  error: MdError,
  info: MdInfo,
};

const FeedbackIcon: React.FC<{ type: string; className?: string }> = ({
  type,
  className,
}) => {
  const Icon = FEEDBACK_TYPE_ICON[type] ?? MdInfo;
  return <Icon className={className} aria-hidden="true" />;
};

// ────────────────────────────────────────────────────────────────────────────

const AssessmentFeedbackPrompt: React.FC<{
  problemId?: string | null;
  assessmentId?: string;
  traceId?: string;
}> = ({ problemId, assessmentId, traceId }) => {
  const { openFeedback, submitFeedback } = useFeedback();
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState(false);

  const context = {
    ...(problemId ? { problemId } : {}),
    ...(assessmentId ? { assessmentId } : {}),
    ...(traceId ? { traceId } : {}),
  };

  const sendHelpfulSignal = async () => {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setError(false);
    try {
      await submitFeedback({
        source: "assessment",
        category: "assessment",
        helpful: true,
        reasons: [],
        message: "",
        context,
      });
      setState("sent");
    } catch {
      setState("idle");
      setError(true);
    }
  };

  const askForDetails = () => {
    openFeedback({
      source: "assessment",
      category: "assessment",
      helpful: false,
      context,
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
      {state === "sent" ? (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Thanks — your signal helps us improve architecture reviews.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-theme">
            Was this review useful?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void sendHelpfulSignal()}
              disabled={state === "sending"}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-theme transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={askForDetails}
              disabled={state === "sending"}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-theme transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Not quite
            </button>
            {state === "sending" && (
              <span className="text-xs text-muted">Sending…</span>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="mt-2 text-xs text-red-600 dark:text-red-300"
            >
              Could not send that signal. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  );
};

type InspectorPanelProps = {
  compact?: boolean;
  compactOpen?: boolean;
  onCompactOpenChange?: (open: boolean) => void;
  problem: {
    id?: string;
    title: string;
    description: string;
    requirements: string[];
    requirementSpec?: RequirementSpec;
    constraints: string[];
    hints: string[];
    tags: string[];
  } | null;
  activeTab: "details" | "inspector" | "assessment" | "guide";
  setActiveTab: (t: "details" | "inspector" | "assessment" | "guide") => void;
  /** Problem ID used to fetch the guided walkthrough */
  problemId?: string | null;
  /** Called when the user clicks "Apply to Canvas" on a guided step */
  onApplyStep?: (step: ApplyStepPayload) => boolean | void;
  appliedGuidedStepIds?: string[];
  /** Current step index for the guided walkthrough (0-based) */
  guideCurrentStep?: number;
  /** Callback when guided walkthrough step changes */
  onGuideStepChange?: (index: number) => void;
  inspectedNodeId: string | null;
  setInspectedNodeId: (id: string | null) => void;
  inspectedEdgeId: string | null;
  setInspectedEdgeId: (id: string | null) => void;
  propertyElements: React.ReactNode;
  customPropertyElements: React.ReactNode;
  edgePropertyElements: React.ReactNode;
  onAddCustomProperty: () => void;
  handleSave: () => void;
  assessmentResult?: import("../types/systemDesign").ValidationResult | null;
  previousAiAssessment?:
    | import("../types/systemDesign").ValidationResult
    | null;
  /** Server-pinned original brief, used only for a review of that revision. */
  reviewedRequirementSpec?: RequirementSpec;
  assessmentHistory?: import("../types/systemDesign").AssessmentHistoryEntry[];
  addressedFindingIds?: string[];
  onToggleFindingAddressed?: (findingId: string) => void;
  onSelectEvidence?: (evidenceId: string) => void;
  onReviewAgain?: () => void;
  onDetachFromGroup?: () => void;
  isNodeInGroup?: boolean;
  onShareToWorld?: () => void;
  sharedCta?: { to: string; label: string };
  reasoningContext: DesignReasoningContext;
  canvasStats: {
    componentCount: number;
    connectionCount: number;
    componentTypes: string[];
    disconnectedCount: number;
  };
};

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  compact = false,
  compactOpen = false,
  onCompactOpenChange,
  problem,
  activeTab,
  setActiveTab,
  problemId,
  onApplyStep,
  appliedGuidedStepIds,
  guideCurrentStep,
  onGuideStepChange,
  inspectedNodeId,
  setInspectedNodeId,
  inspectedEdgeId,
  setInspectedEdgeId,
  propertyElements,
  customPropertyElements,
  edgePropertyElements,
  onAddCustomProperty,
  handleSave,
  assessmentResult,
  previousAiAssessment,
  reviewedRequirementSpec,
  assessmentHistory = [],
  addressedFindingIds = [],
  onToggleFindingAddressed,
  onSelectEvidence,
  onReviewAgain,
  onDetachFromGroup,
  isNodeInGroup,
  onShareToWorld,
  sharedCta,
  reasoningContext,
  canvasStats,
}) => {
  const [width, setWidth] = React.useState(320); // px
  const minWidth = 260;
  const maxWidth = 640;
  const resizingRef = React.useRef(false);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const [showHints, setShowHints] = React.useState(true);
  const [desktopOpen, setOpen] = React.useState(true);
  const open = compact ? compactOpen : desktopOpen;
  const [showInterviewQuestions, setShowInterviewQuestions] =
    React.useState(false);

  const onMouseMove = React.useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const next = Math.min(
      Math.max(window.innerWidth - e.clientX, minWidth),
      maxWidth,
    );
    setWidth(next);
  }, []);
  const stopResize = React.useCallback(() => {
    resizingRef.current = false;
    document.body.style.userSelect = "";
  }, []);
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.userSelect = "none";
  };
  React.useEffect(() => {
    globalThis.addEventListener("mousemove", onMouseMove);
    globalThis.addEventListener("mouseup", stopResize);
    return () => {
      globalThis.removeEventListener("mousemove", onMouseMove);
      globalThis.removeEventListener("mouseup", stopResize);
    };
  }, [onMouseMove, stopResize]);

  // Auto-collapse panel in free design mode when no node is selected
  const isFreeDesignMode = problem?.id === "free";

  // Auto-collapse when neither node nor edge is selected in free design mode
  React.useEffect(() => {
    if (isFreeDesignMode && !inspectedNodeId && !inspectedEdgeId) {
      setOpen(false);
    }
  }, [isFreeDesignMode, inspectedNodeId, inspectedEdgeId]);

  // Auto-switch to inspector tab and expand when node or edge is selected in free design mode
  React.useEffect(() => {
    if (isFreeDesignMode && (inspectedNodeId || inspectedEdgeId)) {
      setActiveTab("inspector");
      setOpen(true);
    }
  }, [isFreeDesignMode, inspectedNodeId, inspectedEdgeId, setActiveTab]);

  if (!problem) return null;

  const reviewSpec =
    !assessmentResult?.requirementRevision ||
    assessmentResult.requirementRevision === problem.requirementSpec?.revision
      ? problem.requirementSpec
      : assessmentResult.requirementRevision === reviewedRequirementSpec?.revision
        ? reviewedRequirementSpec
        : undefined;
  const reviewUsesOlderBrief = Boolean(
    assessmentResult?.requirementRevision &&
      problem.requirementSpec &&
      assessmentResult.requirementRevision !== problem.requirementSpec.revision,
  );
  const knownRequirements = new Map(
    (reviewSpec
      ? [
          ...(reviewSpec?.functional ?? []),
          ...(reviewSpec?.nonFunctional ?? []),
        ]
      : !problem.requirementSpec
        ? [
            ...problem.requirements
              .join(".\n")
              .split("\n")
              .map((text, index) => ({
                id: `legacy-requirement:${index + 1}`,
                text,
                scope: "core" as const,
              })),
            ...problem.constraints
              .join(".\n")
              .split("\n")
              .map((text, index) => ({
                id: `legacy-constraint:${index + 1}`,
                text,
                scope: "core" as const,
              })),
            {
              id: "problem-brief",
              text: problem.description,
              scope: "core" as const,
            },
          ]
        : []
    ).map((requirement) => [requirement.id, requirement]),
  );
  const isExtensionFinding = (
    finding: import("../types/systemDesign").ReviewFinding,
  ) =>
    finding.kind === "extension" ||
    (Boolean(finding.requirement_ids?.length) &&
      finding.requirement_ids?.every(
        (id) => knownRequirements.get(id)?.scope === "extension",
      ));
  const hasCriticalFinding = assessmentResult?.findings?.some(
    (finding) =>
      finding.severity === "critical" &&
      finding.kind !== "strength" &&
      !isExtensionFinding(finding),
  );
  const showAiScore =
    assessmentResult?.source === "ai" &&
    assessmentResult.scoreAvailable !== false &&
    assessmentResult.verdict !== "unavailable" &&
    Number.isFinite(assessmentResult.score) &&
    assessmentResult.score >= 0 &&
    assessmentResult.score <= 100;
  const verdict = !showAiScore
    ? "unavailable"
    : hasCriticalFinding
      ? "needs_revision"
      : (assessmentResult?.verdict ?? "more_context_needed");
  const verdictLabels = {
    strong_alignment: "Strong alignment",
    needs_revision: "Needs revision",
    more_context_needed: "More context needed",
    unavailable: "AI review unavailable",
  };
  const advice = [
    ...(assessmentResult?.improvements ?? []),
    ...(assessmentResult?.suggestions ?? []),
    ...(assessmentResult?.missingComponents ?? []),
    ...(assessmentResult?.missingDescriptions ?? []),
    ...(assessmentResult?.unclearConnections ?? []),
  ];
  const normalizeAdvice = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const representedAdvice = new Set(
    [
      ...advice,
      ...(assessmentResult?.architectureStrengths ?? []),
      ...(assessmentResult?.findings ?? []).flatMap((finding) => [
        finding.title,
        finding.explanation,
        finding.recommendation ?? "",
      ]),
    ].map(normalizeAdvice),
  );
  const feedback = (assessmentResult?.feedback ?? []).filter((item) => {
    const key = normalizeAdvice(item.message);
    if (!key || representedAdvice.has(key)) return false;
    representedAdvice.add(key);
    return true;
  });
  const detailedAnalysis = Object.entries(
    assessmentResult?.detailedAnalysis ?? {},
  ).filter(([, text]) => {
    const key = normalizeAdvice(text);
    if (!key || representedAdvice.has(key)) return false;
    representedAdvice.add(key);
    return true;
  });
  const coverage = [
    ...new Map(
      (assessmentResult?.requirementCoverage ?? []).map((item) => [
        item.requirement_id,
        item,
      ]),
    ).values(),
  ];
  const coreCoverage = coverage.filter(
    (item) => knownRequirements.get(item.requirement_id)?.scope !== "extension",
  );
  const extensionCoverage = coverage.filter(
    (item) => knownRequirements.get(item.requirement_id)?.scope === "extension",
  );
  const renderCoverage = (items: typeof coverage, optional = false) => (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.requirement_id}
          className="border-t border-theme/10 pt-3 first:border-0 first:pt-0"
        >
          <p className="break-words text-xs font-semibold text-theme">
            {knownRequirements.get(item.requirement_id)?.text ??
              item.requirement_id}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {optional && item.status !== "supported"
              ? "Optional — beyond core scope"
              : {
                  supported: "Supported by the design",
                  partial: "Partially supported",
                  missing: "Missing",
                  needs_clarification: "Needs clarification",
                }[item.status]}
          </p>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted">
            {item.explanation}
          </p>
          {item.evidence_ids?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {[...new Set(item.evidence_ids)].map((evidenceId) =>
                onSelectEvidence ? (
                  <button
                    key={evidenceId}
                    type="button"
                    onClick={() => onSelectEvidence(evidenceId)}
                    className="max-w-full break-words rounded-md border border-theme/15 px-2 py-1 text-xs text-[var(--brand)] hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    Show evidence: {evidenceId}
                  </button>
                ) : (
                  <span
                    key={evidenceId}
                    className="break-words text-xs text-muted"
                  >
                    Evidence: {evidenceId}
                  </span>
                ),
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const copyAssessment = async () => {
    if (!assessmentResult) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(assessmentResult, null, 2),
      );
    } catch {
      // clipboard API unavailable — silently skip
    }
  };

  const downloadAssessment = () => {
    if (!assessmentResult) return;
    const blob = new Blob([JSON.stringify(assessmentResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative z-40 shrink-0 max-md:absolute max-md:inset-y-0 max-md:right-0" data-tour="inspector-panel">
      <button
        type="button"
        onClick={() => compact ? onCompactOpenChange?.(!open) : setOpen(!open)}
        aria-expanded={open}
        aria-label={
          open ? "Collapse inspector panel" : "Expand inspector panel"
        }
        aria-controls="inspector-panel"
        data-tour="inspector-toggle"
        data-tooltip={
          open
            ? "Inspector panel is open — click to close"
            : "Inspector panel is closed — click to expand"
        }
        className="absolute top-5 -left-3 h-6 w-6 max-md:-left-11 max-md:h-11 max-md:w-11 flex items-center justify-center rounded-full border border-theme bg-surface text-theme shadow cursor-pointer hover:bg-[var(--bg-hover)] transition-colors z-50"
      >
        {open ? <PiCaretRightBold size={16} /> : <PiCaretLeftBold size={16} />}
      </button>
      <aside
        ref={panelRef}
        id="inspector-panel"
        className={`bg-surface border-l border-theme flex min-w-0 flex-col h-full shrink-0 relative inspector-resizable transition-[width] duration-300 ease-in-out ${
          open ? "p-4" : "w-6 p-1"
        }`}
        data-width={width}
        style={{
          width: open ? `${width}px` : "24px",
          // Leave room for both 44px drawer toggles without overlapping them.
          maxWidth: compact ? "calc(100vw - 6rem)" : "calc(100vw - 3rem)",
        }}
      >
        {open && (
          <>
            <button
              type="button"
              onMouseDown={onMouseDown}
              aria-label="Resize inspector panel"
              className="absolute left-0 top-0 h-full w-2 -ml-1 cursor-col-resize hidden md:flex items-center justify-center group"
            >
              <span className="w-px h-full bg-transparent group-hover:bg-[var(--brand)]/40 transition-colors" />
              <PiDotsSixVerticalBold
                aria-hidden
                className="absolute py-1 rounded-md bg-[var(--surface)] border border-theme text-[var(--muted)] opacity-90 group-hover:bg-[var(--brand)] group-hover:text-[var(--bg)] shadow-sm pointer-events-none transition-colors"
                size={24}
              />
            </button>

            {/* ── Share-to-World announcement bar — above the tabs ── */}
            {onShareToWorld && showAiScore && (
              <button
                type="button"
                onClick={onShareToWorld}
                className="w-[calc(100%+2rem)] flex items-center justify-center gap-2 -mx-4 -mt-4 px-3.5 py-1.5 mb-4
                    bg-[var(--announcement-bg)] text-[var(--announcement-text)] dark:bg-[var(--announcement-bg)] dark:text-[var(--announcement-text)] cursor-pointer text-sm font-medium
                    hover:opacity-90 active:scale-[.98] transition-all"
              >
                <FiShare2 size={12} className="flex-shrink-0" />
                <span className="font-semibold">Publish reviewed design</span>
              </button>
            )}

            <div
              className="flex flex-wrap items-center justify-start gap-2"
              role="tablist"
              aria-label="Sidebar tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "details"}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${activeTab === "details" ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-theme hover:bg-[var(--bg-hover)]"}`}
                data-tour="problem-brief"
                onClick={() => setActiveTab("details")}
              >
                <MdDescription
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">Details</span>
              </button>

              {!isFreeDesignMode && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "assessment"}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${activeTab === "assessment" ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-theme hover:bg-[var(--bg-hover)]"}`}
                  onClick={() => setActiveTab("assessment")}
                >
                  <MdAssessment
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium">
                    {assessmentResult && !showAiScore
                      ? assessmentResult.source === "rule_based"
                        ? "Structure checks"
                        : "Review unavailable"
                      : "Assessment"}
                  </span>
                </button>
              )}

              {!isFreeDesignMode && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "guide"}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${activeTab === "guide" ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-theme hover:bg-[var(--bg-hover)]"}`}
                  data-tour="guide"
                  onClick={() => setActiveTab("guide")}
                >
                  <MdMenuBook className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">Guide</span>
                </button>
              )}

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "inspector"}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${activeTab === "inspector" ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-theme hover:bg-[var(--bg-hover)]"}`}
                onClick={() => setActiveTab("inspector")}
              >
                <MdSettings className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium">Properties</span>
              </button>
            </div>

            <div
              className="w-full h-px bg-[var(--muted)]/20 mb-4"
              aria-hidden="true"
            />

            {/* Guide tab — manages its own internal scroll */}
            {activeTab === "guide" && (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <GuidedHelpPanel
                  problemId={problemId ?? null}
                  onApplyStep={onApplyStep ?? (() => {})}
                  currentStep={guideCurrentStep}
                  onStepChange={onGuideStepChange}
                  appliedGuidedStepIds={appliedGuidedStepIds}
                />
              </div>
            )}

            {/* scrollable content area under the tabs */}
            {activeTab !== "guide" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto component-palette">
                {activeTab === "details" && (
                  <div>
                    <h3 className="text-lg font-semibold text-theme mb-3">
                      {problem.title}
                    </h3>
                    <p className="text-muted text-sm leading-relaxed mb-4">
                      {problem.description}
                    </p>

                    <ReasoningPanel
                      context={reasoningContext}
                      canvasStats={canvasStats}
                    />

                    {!isFreeDesignMode && (
                      <>
                        <ProblemRequirements
                          requirementSpec={problem.requirementSpec}
                          requirements={problem.requirements}
                          constraints={problem.constraints}
                          compact
                        />

                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={() => setShowHints(!showHints)}
                            className="w-full flex items-center justify-between mb-2 cursor-pointer hover:bg-[var(--bg-hover)] p-2 rounded-md transition-colors"
                            aria-controls="hints-content"
                            aria-expanded={showHints}
                          >
                            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-theme">
                              <MdLightbulbOutline
                                className="h-4 w-4 text-amber-400"
                                aria-hidden="true"
                              />
                              <span>Hints</span>
                            </h4>
                            <PiCaretDownBold
                              size={14}
                              className={`text-muted transition-transform duration-150 ${
                                showHints ? "rotate-0" : "-rotate-90"
                              }`}
                            />
                          </button>
                          {showHints && (
                            <div id="hints-content" className="space-y-2">
                              {problem.hints.length > 0 ? (
                                problem.hints.map((hint) => (
                                  <div
                                    key={hint}
                                    className="rounded-lg bg-yellow-50 p-2 ring-1 ring-inset ring-yellow-400/50 dark:bg-yellow-900/40 dark:ring-yellow-600/60"
                                  >
                                    <div className="text-xs text-yellow-900 dark:text-yellow-100 leading-relaxed">
                                      {hint}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted italic px-2">
                                  No hints available.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-2">
                            <MdLabel
                              className="h-4 w-4 text-muted"
                              aria-hidden="true"
                            />
                            <span>Tags</span>
                          </h4>
                          {problem.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {problem.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-[var(--brand)]/10 text-[var(--brand)] text-xs rounded-full font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted italic">
                              No tags.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "inspector" && (
                  <div>
                    {/* ── EDGE INSPECTOR ── */}
                    {inspectedEdgeId && (
                      <div className="flex flex-col gap-0">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center flex-shrink-0">
                              <MdLink
                                className="h-4 w-4 text-[var(--brand)]"
                                aria-hidden="true"
                              />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-theme leading-tight">
                                Connection
                              </h3>
                              <p
                                className="text-[10px] text-muted font-mono truncate max-w-[140px]"
                                data-tooltip={inspectedEdgeId}
                              >
                                {inspectedEdgeId}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedEdgeId(null);
                              setActiveTab("details");
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-muted hover:text-theme transition-colors cursor-pointer text-base"
                            aria-label="Close connection details"
                            data-tooltip="Close"
                          >
                            <MdClose className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        {edgePropertyElements && (
                          <div>{edgePropertyElements}</div>
                        )}
                      </div>
                    )}

                    {/* ── NODE INSPECTOR ── */}
                    {!inspectedEdgeId && inspectedNodeId && (
                      <div className="flex min-w-0 flex-col gap-4">
                        {/* Header */}
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center flex-shrink-0">
                              <MdSettings
                                className="h-4 w-4 text-[var(--brand)]"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-theme leading-tight">
                                Component Properties
                              </h3>
                              <p
                                className="text-[10px] text-muted font-mono truncate max-w-[140px]"
                                data-tooltip={inspectedNodeId}
                              >
                                {inspectedNodeId}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedNodeId(null);
                              setActiveTab("details");
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-muted hover:text-theme transition-colors cursor-pointer text-base"
                            aria-label="Close component properties"
                            data-tooltip="Close"
                          >
                            <MdClose className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>

                        {/* Standard Properties */}
                        {propertyElements && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-muted uppercase tracking-widest">
                              Properties
                            </span>
                            <div className="min-w-0 space-y-2">
                              {propertyElements}
                            </div>
                          </div>
                        )}

                        {/* Custom Properties Section */}
                        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-theme/30 bg-[var(--surface)] p-3">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="min-w-0 text-[11px] font-semibold text-muted uppercase tracking-widest">
                              Custom Properties
                            </span>
                            <button
                              type="button"
                              onClick={onAddCustomProperty}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand)]/10 rounded-md transition-colors border border-[var(--brand)]/30 hover:border-[var(--brand)] cursor-pointer"
                              data-tooltip="Add custom property"
                            >
                              <MdAdd size={14} />
                              <span>Add</span>
                            </button>
                          </div>
                          <div className="min-w-0 space-y-2">
                            {customPropertyElements ?? (
                              <p className="text-xs text-muted/60 text-center py-2">
                                No custom properties yet
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          {isNodeInGroup && onDetachFromGroup && (
                            <button
                              type="button"
                              className="w-full px-3 py-2.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 transition-all font-medium text-sm cursor-pointer flex items-center justify-center gap-2"
                              onClick={onDetachFromGroup}
                              data-tooltip="Remove this node from its parent group"
                            >
                              <MdLockOpen
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              <span>Detach from Group</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="w-full px-3 py-2.5 rounded-lg bg-[var(--brand)] text-[var(--bg)] transition-all hover:bg-[var(--brand)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] font-medium text-sm cursor-pointer"
                            onClick={handleSave}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}

                    {/* empty state */}
                    {!inspectedNodeId && !inspectedEdgeId && (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--brand)]/8 flex items-center justify-center">
                          <MdAutoAwesome
                            className="h-6 w-6 text-[var(--brand)]"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-theme">
                            Nothing selected
                          </p>
                          <p className="text-xs text-muted mt-1">
                            Click a component or connection to inspect its
                            properties.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "assessment" && (
                  <div>
                    {assessmentResult ? (
                      <div className="space-y-4">
                        <section
                          className="p-4 border rounded-xl bg-[var(--surface)] space-y-3"
                          aria-labelledby="architecture-review-heading"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3
                                id="architecture-review-heading"
                                className="font-semibold text-theme text-base"
                              >
                                {showAiScore
                                  ? "Architecture review"
                                  : "Structure checks"}
                              </h3>
                              <p
                                className={`mt-1 text-xs font-semibold ${verdict === "strong_alignment" ? "text-green-500" : "text-muted"}`}
                              >
                                {verdictLabels[verdict]}
                              </p>
                            </div>
                            {showAiScore && (
                              <p className="text-xl font-bold tabular-nums text-theme">
                                {assessmentResult.score}
                                <span className="text-sm font-medium text-muted">
                                  /100
                                </span>
                              </p>
                            )}
                          </div>
                          {showAiScore ? (
                            <>
                              {assessmentResult.summary && (
                                <p className="break-words text-xs leading-relaxed text-theme">
                                  {assessmentResult.summary}
                                </p>
                              )}
                              <p className="text-xs leading-relaxed text-muted">
                                AI architecture review against the exercise
                                scope. This score is a learning signal, not
                                requirement completion or production readiness.
                              </p>
                            </>
                          ) : (
                            <div
                              className="space-y-2 text-xs leading-relaxed text-muted"
                              role="status"
                            >
                              <p className="text-theme">
                                {assessmentResult.source === "rule_based"
                                  ? "AI review is unavailable. These are walkthrough-structure checks, not an architecture assessment."
                                  : "The AI review is incomplete or unavailable. No architecture score is available."}
                              </p>
                              {assessmentResult.summary && (
                                <p className="break-words text-theme">
                                  {assessmentResult.summary}
                                </p>
                              )}
                              <p>
                                Your design is still available. Retry the AI
                                review to receive an architecture score and
                                requirement-level feedback.
                              </p>
                            </div>
                          )}
                          {(assessmentResult.rubricVersion ||
                            assessmentResult.requirementRevision) && (
                            <p className="break-words text-xs text-muted">
                              {assessmentResult.requirementRevision &&
                                `Requirements: ${assessmentResult.requirementRevision}`}
                              {assessmentResult.rubricVersion &&
                                ` · Rubric: ${assessmentResult.rubricVersion}`}
                            </p>
                          )}
                          {reviewUsesOlderBrief && (
                            <p className="break-words rounded-lg border border-theme/10 px-3 py-2 text-xs leading-relaxed text-muted">
                              This review uses an earlier problem brief. The
                              Details tab shows requirements {problem.requirementSpec?.revision}.
                              Review the updated requirements before assessing
                              again; a new review will use that current brief.
                            </p>
                          )}
                        </section>

                        {!showAiScore &&
                          previousAiAssessment?.source === "ai" &&
                          previousAiAssessment.scoreAvailable !== false &&
                          Number.isFinite(previousAiAssessment.score) &&
                          previousAiAssessment.score >= 0 &&
                          previousAiAssessment.score <= 100 && (
                            <p className="rounded-lg border border-theme/10 px-3 py-2 text-xs leading-relaxed text-muted">
                              Previous AI review: {previousAiAssessment.score}
                              /100. It belongs to an earlier review; current
                              design has not been AI-reviewed.
                            </p>
                          )}

                        {showAiScore &&
                          coreCoverage.length + extensionCoverage.length >
                            0 && (
                            <section
                              className="p-4 border rounded-xl bg-[var(--surface)] space-y-3"
                              aria-labelledby="requirement-coverage-heading"
                            >
                              <h3
                                id="requirement-coverage-heading"
                                className="text-sm font-semibold text-theme"
                              >
                                Requirement coverage
                              </h3>
                              {coreCoverage.length > 0 &&
                                renderCoverage(coreCoverage)}
                              {extensionCoverage.length > 0 && (
                                <details className="border-t border-theme/10 pt-3">
                                  <summary className="cursor-pointer text-xs font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                                    Optional extension coverage
                                  </summary>
                                  <div className="mt-3">
                                    {renderCoverage(extensionCoverage, true)}
                                  </div>
                                </details>
                              )}
                            </section>
                          )}

                        {!showAiScore &&
                          Boolean(
                            assessmentResult.structuralChecks?.length,
                          ) && (
                            <section
                              className="p-4 border rounded-xl bg-[var(--surface)]"
                              aria-labelledby="structural-checks-heading"
                            >
                              <h3
                                id="structural-checks-heading"
                                className="text-sm font-semibold text-theme"
                              >
                                Observed structure
                              </h3>
                              <ul className="mt-3 space-y-3">
                                {assessmentResult.structuralChecks?.map(
                                  (check, index) => (
                                    <li
                                      key={index}
                                      className="break-words text-xs leading-relaxed"
                                    >
                                      <p className="font-semibold text-theme">
                                        {check.title}
                                      </p>
                                      <p className="text-muted">
                                        {check.status.replaceAll("_", " ")} ·{" "}
                                        {check.explanation}
                                      </p>
                                    </li>
                                  ),
                                )}
                              </ul>
                            </section>
                          )}

                        <AssessmentFindings
                          findings={assessmentResult.findings ?? []}
                          addressedFindingIds={addressedFindingIds}
                          onToggleAddressed={onToggleFindingAddressed}
                          onSelectEvidence={onSelectEvidence}
                          requirementSpec={reviewSpec}
                          suggestions={advice}
                          strengths={
                            assessmentResult.architectureStrengths ?? []
                          }
                          structuralOnly={!showAiScore}
                        />

                        {onReviewAgain && (
                          <button
                            type="button"
                            onClick={onReviewAgain}
                            className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[var(--bg)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
                          >
                            {showAiScore
                              ? "Review again after making changes"
                              : "Retry AI review"}
                          </button>
                        )}

                        {(detailedAnalysis.length > 0 ||
                          feedback.length > 0) && (
                          <details className="p-4 border rounded-xl bg-[var(--surface)]">
                            <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                              Detailed analysis
                            </summary>
                            <div className="mt-4 space-y-4">
                              {detailedAnalysis.map(([dimension, text]) => (
                                <section
                                  key={dimension}
                                  className="space-y-1.5"
                                >
                                  <h4 className="text-xs font-semibold text-theme">
                                    {DIM_LABELS[dimension] ??
                                      dimension.replaceAll("_", " ")}
                                  </h4>
                                  <p className="break-words text-xs leading-relaxed text-muted">
                                    {text}
                                  </p>
                                </section>
                              ))}
                              {feedback.map((item) => (
                                <div
                                  key={`${item.category}:${item.message}`}
                                  className="flex items-start gap-2"
                                >
                                  <FeedbackIcon
                                    type={item.type}
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                                  />
                                  <p className="min-w-0 break-words text-xs leading-relaxed text-muted">
                                    {item.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {showAiScore && (
                          <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                            <summary className="cursor-pointer font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                              How this score works
                            </summary>
                            <p className="mt-2 leading-relaxed text-muted">
                              The API combines the applicable architecture
                              dimensions into one review score. It does not
                              measure accuracy, completion percentage, or
                              production readiness. Findings and requirement
                              evidence explain what to improve next.
                            </p>
                          </details>
                        )}

                        {assessmentHistory.length > 1 && (
                          <details className="rounded-xl border border-theme/10 bg-[var(--surface)] p-4">
                            <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                              Review history ({assessmentHistory.length})
                            </summary>
                            <p className="mt-3 text-xs leading-relaxed text-muted">
                              Score changes are comparable only for AI reviews
                              using the same rubric, requirement revision, and
                              model.
                            </p>
                            <div className="mt-3 space-y-2">
                              {assessmentHistory
                                .slice(-5)
                                .map((entry, index, entries) => {
                                  const previous =
                                    assessmentHistory[
                                      assessmentHistory.length -
                                        entries.length +
                                        index -
                                        1
                                    ];
                                  const currentScore =
                                    entry.source === "ai" &&
                                    entry.scoreAvailable !== false &&
                                    typeof entry.score === "number" &&
                                    Number.isFinite(entry.score) &&
                                    entry.score >= 0 &&
                                    entry.score <= 100
                                      ? entry.score
                                      : null;
                                  const previousScore =
                                    previous?.source === "ai" &&
                                    previous.scoreAvailable !== false &&
                                    typeof previous.score === "number" &&
                                    Number.isFinite(previous.score) &&
                                    previous.score >= 0 &&
                                    previous.score <= 100
                                      ? previous.score
                                      : null;
                                  const comparable =
                                    currentScore !== null &&
                                    previousScore !== null &&
                                    Boolean(entry.rubricVersion?.trim()) &&
                                    entry.rubricVersion ===
                                      previous.rubricVersion &&
                                    Boolean(
                                      entry.requirementRevision?.trim(),
                                    ) &&
                                    entry.requirementRevision ===
                                      previous.requirementRevision &&
                                    Boolean(entry.modelVersion?.trim()) &&
                                    entry.modelVersion ===
                                      previous.modelVersion;
                                  const unchangedInput =
                                    Boolean(entry.inputFingerprint) &&
                                    entry.inputFingerprint ===
                                      previous?.inputFingerprint;
                                  const delta =
                                    comparable &&
                                    !unchangedInput &&
                                    currentScore !== null &&
                                    previousScore !== null
                                      ? currentScore - previousScore
                                      : null;
                                  return (
                                    <div
                                      key={entry.id}
                                      className="flex flex-wrap items-center justify-between gap-2 border-t border-theme/10 py-2 text-xs"
                                    >
                                      <span className="text-muted">
                                        Review{" "}
                                        {assessmentHistory.length -
                                          entries.length +
                                          index +
                                          1}
                                      </span>
                                      <span className="font-semibold text-theme">
                                        {currentScore !== null
                                          ? `${currentScore}/100`
                                          : entry.source === "rule_based"
                                            ? "Structure check · unscored"
                                            : "Unscored"}
                                      </span>
                                      <span className="text-muted">
                                        {delta === null
                                          ? unchangedInput && comparable
                                            ? "Same input · —"
                                            : "Not comparable · —"
                                          : delta > 0
                                            ? `+${delta}`
                                            : String(delta)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </details>
                        )}

                        {showAiScore && (
                          <AssessmentFeedbackPrompt
                            problemId={problemId}
                            assessmentId={assessmentResult.assessmentId}
                            traceId={assessmentResult.traceId}
                          />
                        )}

                        {/* ── 8. Follow-up Questions ── */}
                        {assessmentResult.interviewQuestions &&
                          assessmentResult.interviewQuestions.length > 0 && (
                            <div className="border rounded-xl bg-[var(--surface)] overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowInterviewQuestions((v) => !v)
                                }
                                aria-expanded={showInterviewQuestions}
                                aria-controls="review-follow-up-questions"
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <MdTrackChanges
                                    className="h-4 w-4 text-indigo-400"
                                    aria-hidden="true"
                                  />
                                  <span className="font-semibold text-theme text-sm">
                                    Follow-up Questions
                                  </span>
                                  <span className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded-full">
                                    {assessmentResult.interviewQuestions.length}
                                  </span>
                                </div>
                                <PiCaretDownBold
                                  size={14}
                                  className={`text-muted transition-transform ${showInterviewQuestions ? "rotate-180" : ""}`}
                                />
                              </button>
                              {showInterviewQuestions && (
                                <div
                                  id="review-follow-up-questions"
                                  className="px-4 pb-4 space-y-2.5 border-t border-[var(--border)]"
                                >
                                  <p className="text-[10px] text-muted pt-3 pb-1">
                                    Questions tailored to your specific design —
                                    use them to guide your next iteration.
                                  </p>
                                  <ol className="space-y-2.5 list-none">
                                    {assessmentResult.interviewQuestions.map(
                                      (q, i) => (
                                        <li
                                          key={`iq-${q.slice(0, 30)}`}
                                          className="flex items-start gap-2.5"
                                        >
                                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                                            {i + 1}
                                          </span>
                                          <span className="text-xs text-theme leading-relaxed">
                                            {q}
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}

                        {/* ── Copy / Download ── */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={copyAssessment}
                            className="flex-1 px-3 py-2 bg-theme border border-theme rounded-md hover:bg-[var(--bg-hover)] transition-colors text-sm"
                          >
                            <MdContentCopy
                              className="mr-1.5 inline h-4 w-4"
                              aria-hidden="true"
                            />
                            Copy JSON
                          </button>
                          <button
                            type="button"
                            onClick={downloadAssessment}
                            className="flex-1 px-3 py-2 bg-theme border border-theme rounded-md hover:bg-[var(--bg-hover)] transition-colors text-sm"
                          >
                            <MdDownload
                              className="mr-1.5 inline h-4 w-4"
                              aria-hidden="true"
                            />
                            Download
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <MdAssessment
                          className="mx-auto mb-4 h-12 w-12 text-[var(--brand)]"
                          aria-hidden="true"
                        />
                        <div className="text-lg font-semibold text-theme mb-2">
                          No Assessment Yet
                        </div>
                        <div className="text-sm text-muted">
                          Run an assessment to see your design evaluation and
                          feedback.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {sharedCta && (
          <div className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3">
            <Link
              to={sharedCta.to}
              className="block w-full text-center py-2.5 rounded-xl bg-[var(--brand,#6366f1)] text-[var(--bg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {sharedCta.label}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
};

export default InspectorPanel;
