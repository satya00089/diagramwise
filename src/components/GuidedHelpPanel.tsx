import React, { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import {
  fetchWalkthrough,
  selectWalkthrough,
  selectWalkthroughLoading,
  selectWalkthroughError,
} from "../store/slices/walkthroughsSlice";
import type { GuidedStep, GuidedStepType } from "../types/systemDesign";

import NodePropertyDisplay from "./NodePropertyDisplay";
import type { CustomProperty } from "./CustomPropertyInput";

// ── Step type badge config ────────────────────────────────────────────────────

const STEP_TYPE_CONFIG: Record<
  GuidedStepType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  explanation: {
    label: "Explanation",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  add_component: {
    label: "Add Component",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  add_connection: {
    label: "Add Connection",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  decision_point: {
    label: "Decision",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  update_component: {
    label: "Design decision",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="m5 12 4 4L19 6" strokeWidth={2} />
      </svg>
    ),
  },
  scale_trigger: {
    label: "Scale Trigger",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    icon: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type ApplyStepPayload = GuidedStep;

type GuidedHelpPanelProps = {
  problemId: string | null;
  onApplyStep: (step: ApplyStepPayload) => boolean | void;
  /** Optional controlled current step index (0-based) */
  currentStep?: number;
  /** Called when the user changes the current step */
  onStepChange?: (index: number) => void;
  appliedGuidedStepIds?: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepTypeBadge({ type }: { type: GuidedStepType }) {
  const cfg = STEP_TYPE_CONFIG[type] ?? STEP_TYPE_CONFIG.explanation;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const GuidedHelpPanel: React.FC<GuidedHelpPanelProps> = ({
  problemId,
  onApplyStep,
  currentStep: currentStepProp,
  onStepChange,
  appliedGuidedStepIds,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const walkthrough = useSelector((state: RootState) =>
    selectWalkthrough(state, problemId ?? ""),
  );
  const loading = useSelector((state: RootState) =>
    selectWalkthroughLoading(state, problemId ?? ""),
  );
  const rawError = useSelector((state: RootState) =>
    selectWalkthroughError(state, problemId ?? ""),
  );
  const error: "not_found" | "error" | null = !rawError
    ? null
    : rawError === "NOT_FOUND"
      ? "not_found"
      : "error";

  const [currentStep, setCurrentStep] = useState<number>(currentStepProp ?? 0); // 0-indexed
  const [appliedSteps, setAppliedSteps] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync controlled prop -> local state when provided
  useEffect(() => {
    if (currentStepProp !== undefined) {
      setCurrentStep(currentStepProp);
    }
  }, [currentStepProp]);

  // Dispatch fetch (Redux condition guard prevents duplicate calls)
  useEffect(() => {
    if (!problemId) return;
    dispatch(fetchWalkthrough(problemId));
  }, [problemId, dispatch]);

  // Reset step position when problem changes
  useEffect(() => {
    if (onStepChange) {
      onStepChange(0);
    } else {
      setCurrentStep(0);
    }
    setAppliedSteps(new Set());
  }, [problemId, onStepChange]);

  // Scroll content to top whenever the step changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    // Notify parent if controlled
    if (onStepChange) onStepChange(currentStep);
  }, [currentStep, onStepChange]);

  const step = walkthrough?.steps[currentStep] ?? null;
  const total = walkthrough?.totalSteps ?? 0;

  // Derive current phase index
  const phaseIndex =
    walkthrough?.phases.findIndex(
      (p) =>
        step &&
        step.stepNumber >= p.stepRange[0] &&
        step.stepNumber <= p.stepRange[1],
    ) ?? 0;

  const handleApply = useCallback(() => {
    if (!step) return;
    if (onApplyStep?.(step) === false) {
      setApplyError(
        "Add the components from the earlier steps before applying this decision or connection.",
      );
      return;
    }
    setApplyError(null);
    setAppliedSteps((prev) => new Set(prev).add(step.id));
  }, [step, onApplyStep]);

  useEffect(() => setApplyError(null), [currentStep, problemId]);

  const effectiveAppliedSteps = appliedGuidedStepIds
    ? new Set(appliedGuidedStepIds)
    : appliedSteps;
  const canApply =
    step &&
    (step.type === "add_component" ||
      step.type === "add_connection" ||
      !!step.componentUpdate) &&
    !effectiveAppliedSteps.has(step.id);

  const alreadyApplied =
    step &&
    (step.type === "add_component" ||
      step.type === "add_connection" ||
      !!step.componentUpdate) &&
    effectiveAppliedSteps.has(step.id);
  const actionSteps =
    walkthrough?.steps.filter(
      (item) =>
        item.type === "add_component" ||
        item.type === "add_connection" ||
        !!item.componentUpdate,
    ) ?? [];
  const completedActions = actionSteps.filter((item) =>
    effectiveAppliedSteps.has(item.id),
  ).length;

  // ── Render states ──────────────────────────────────────────────────────────

  if (!problemId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <svg
          className="w-10 h-10 text-muted/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <p className="text-xs text-muted/60">
          Open a problem to view its guided walkthrough.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-5 h-5 border-2 border-[var(--brand)]/30 border-t-[var(--brand)] rounded-full animate-spin" />
        <p className="text-xs text-muted/60">Loading walkthrough…</p>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <svg
          className="w-10 h-10 text-muted/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm font-medium text-muted">
          Guided walkthrough coming soon
        </p>
        <p className="text-xs text-muted/60">
          Step-by-step guidance for this problem is being authored. Check back
          soon.
        </p>
      </div>
    );
  }

  if (error === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <p className="text-sm font-medium text-red-400">
          Failed to load walkthrough
        </p>
        <button
          type="button"
          onClick={() => {
            if (problemId) dispatch(fetchWalkthrough(problemId));
          }}
          className="text-xs text-[var(--brand)] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!walkthrough || !step) return null;

  // ── Full panel ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Phase tabs */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="flex gap-1 flex-wrap">
          {walkthrough.phases.map((phase, idx) => (
            <button
              key={phase.name}
              type="button"
              onClick={() => {
                const targetIdx =
                  walkthrough.steps.findIndex(
                    (s) => s.stepNumber === phase.stepRange[0],
                  ) ?? 0;
                if (targetIdx >= 0) setCurrentStep(targetIdx);
              }}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                idx === phaseIndex
                  ? "bg-[var(--brand)]/15 text-[var(--brand)] border-[var(--brand)]/30 font-semibold"
                  : "text-muted/50 border-[var(--border)] hover:text-muted hover:border-[var(--border-hover)]"
              }`}
              data-tooltip={phase.description}
            >
              {idx + 1}. {phase.name.replace(/^Phase \d+: /, "")}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted/50">
            Lesson step {step.stepNumber} of {total}
          </span>
          <span className="text-[10px] text-muted/50">
            {completedActions} / {actionSteps.length} design actions applied
          </span>
        </div>
        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--brand)] rounded-full transition-all duration-300"
            style={{ width: `${(step.stepNumber / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Step card — scrollable */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-3 pb-2 space-y-3 min-h-0 node-properties-scroll"
      >
        {/* Header */}
        <div className="space-y-1.5">
          <StepTypeBadge type={step.type as GuidedStepType} />
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {step.title}
          </h3>
        </div>

        {/* Main markdown content */}
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-xs [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:space-y-0.5 [&_li]:leading-relaxed [&_strong]:text-foreground [&_code]:bg-[var(--surface-2)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_table]:text-[10px] [&_th]:text-foreground [&_th]:font-semibold [&_td]:py-0.5">
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(step.content || "")),
            }}
          />
        </div>

        {/* Component card */}
        {step.type === "add_component" && step.component && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg
                  className="w-3.5 h-3.5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-300">
                  {step.component.label}
                </p>
                <p className="text-[10px] text-muted/70 mt-0.5">
                  {step.component.componentType}
                </p>
              </div>
            </div>

            {/* Highlight reason */}
            <div className="rounded bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-2">
              <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                {step.component.highlightReason}
              </p>
            </div>

            {/* Properties */}
            {Object.keys(step.component.properties).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted/50 uppercase tracking-wide font-medium">
                  Properties
                  <span className="ml-1 normal-case font-normal opacity-60">
                    — tap a row to learn why
                  </span>
                </p>
                <div className="space-y-2">
                  {Object.entries(step.component.properties)
                    .filter(([k]) => k !== "_customProperties")
                    .map(([key, entry]) => (
                      <NodePropertyDisplay
                        key={key}
                        propertyKey={key}
                        value={entry}
                      />
                    ))}

                  {/* Render each custom property as its own row for clarity */}
                  {step.component.properties._customProperties &&
                    Array.isArray(
                      step.component.properties._customProperties,
                    ) &&
                    step.component.properties._customProperties.length > 0 && (
                      <>
                        <div className="text-xs font-semibold opacity-60 uppercase tracking-wide">
                          Custom Properties
                        </div>
                        {step.component.properties._customProperties.map(
                          (cp: CustomProperty) => (
                            <NodePropertyDisplay
                              key={cp.id}
                              propertyKey={cp.label || cp.key}
                              value={cp.value}
                            />
                          ),
                        )}
                      </>
                    )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connection card */}
        {step.type === "add_connection" && step.connection && (
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3.5 h-3.5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-300">
                  {step.connection.label}
                </p>
                <p className="text-[10px] text-muted/70">
                  {step.connection.connectionType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted/70">
              <span className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-muted">
                {step.connection.sourceNodeId.replace("guided_", "")}
              </span>
              <svg
                className="w-3 h-3 text-muted/40 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
              <span className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-muted">
                {step.connection.targetNodeId.replace("guided_", "")}
              </span>
            </div>
            <p className="text-[11px] text-muted/80 leading-relaxed">
              {step.connection.description}
            </p>
          </div>
        )}

        {/* Decision point card */}
        {step.componentUpdate && (
          <section
            className="space-y-2 border-t border-[var(--border)] pt-3"
            aria-label="Decision to apply"
          >
            <h4 className="text-xs font-semibold text-foreground">
              What this changes
            </h4>
            <p className="text-xs text-muted">
              These decisions are recorded on the component only when you apply
              them.
            </p>
            {Object.entries(step.componentUpdate.properties).map(
              ([key, value]) => (
                <NodePropertyDisplay
                  key={key}
                  propertyKey={key}
                  value={
                    typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean"
                      ? value
                      : (JSON.stringify(value) ?? "")
                  }
                />
              ),
            )}
          </section>
        )}
        {step.type === "decision_point" && step.decision && (
          <div className="space-y-2">
            {/* Question */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-amber-300">
                {step.decision.question}
              </p>
              {/* Chosen */}
              <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <svg
                    className="w-3 h-3 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-[11px] font-semibold text-amber-300">
                    {step.decision.chosen}
                  </span>
                </div>
                <p className="text-[11px] text-muted/80 leading-relaxed">
                  {step.decision.chosenReason}
                </p>
              </div>
            </div>

            {/* Alternatives */}
            {step.decision.alternatives.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted/50 uppercase tracking-wide font-medium px-0.5">
                  Alternatives & Trade-offs
                </p>
                {step.decision.alternatives.map((alt) => (
                  <div
                    key={alt.option}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-2.5 space-y-1"
                  >
                    <p className="text-[11px] font-semibold text-muted">
                      {alt.option}
                    </p>
                    <p className="text-[10px] text-muted/60 leading-relaxed">
                      {alt.tradeoff}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scale trigger card */}
        {step.type === "scale_trigger" && step.scaleTrigger && (
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <svg
                  className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-orange-400/70 uppercase tracking-wide font-medium">
                    Trigger Metric
                  </p>
                  <p className="text-[11px] text-orange-300 font-medium leading-relaxed">
                    {step.scaleTrigger.metric}
                  </p>
                </div>
              </div>

              <div className="border-t border-orange-500/15 pt-2 space-y-0.5">
                <p className="text-[10px] text-muted/50 uppercase tracking-wide font-medium">
                  Action
                </p>
                <p className="text-[11px] text-muted/80 leading-relaxed">
                  {step.scaleTrigger.action}
                </p>
              </div>

              <div className="border-t border-orange-500/15 pt-2 space-y-0.5">
                <p className="text-[10px] text-muted/50 uppercase tracking-wide font-medium">
                  Expected Impact
                </p>
                <p className="text-[11px] text-muted/80 leading-relaxed">
                  {step.scaleTrigger.impact}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — Apply + Navigation */}
      <div className="flex-shrink-0 border-t border-[var(--border)] px-3 py-2.5 space-y-2">
        {applyError && (
          <p role="status" className="text-xs leading-relaxed text-foreground">
            {applyError}
          </p>
        )}
        {/* Apply button */}
        {(canApply || alreadyApplied) && (
          <button
            type="button"
            onClick={canApply ? handleApply : undefined}
            disabled={!!alreadyApplied}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              alreadyApplied
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 cursor-default"
                : "bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/25 hover:bg-[var(--brand)]/20 hover:border-[var(--brand)]/50 cursor-pointer"
            }`}
          >
            {alreadyApplied ? (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Applied to Canvas
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {step?.type === "add_component"
                  ? "Apply to Canvas"
                  : step?.type === "add_connection"
                    ? "Draw Connection"
                    : "Use this design decision"}
              </>
            )}
          </button>
        )}

        {/* Prev / Next */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Prev
          </button>
          <span className="text-[10px] text-muted/40 flex-shrink-0">
            {currentStep + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(total - 1, s + 1))}
            disabled={currentStep >= total - 1}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuidedHelpPanel;
