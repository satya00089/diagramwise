import React from "react";
import { MdAutoAwesome, MdPsychology } from "react-icons/md";
import type { DesignReasoningContext } from "../types/systemDesign";

type ReasoningPanelProps = {
  context: DesignReasoningContext;
  canvasStats: {
    componentCount: number;
    connectionCount: number;
    componentTypes: string[];
    disconnectedCount: number;
  };
};

const ContextRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-start justify-between gap-4 border-b border-theme/10 py-2.5 last:border-b-0">
    <dt className="text-xs font-medium text-theme">{label}</dt>
    <dd className="max-w-[65%] text-right text-xs leading-relaxed text-muted">
      {value}
    </dd>
  </div>
);

const ReasoningPanel: React.FC<ReasoningPanelProps> = ({
  context,
  canvasStats,
}) => {
  const targetsToClarify = [
    context.scaleAssumptions,
    context.expectedTraffic,
    context.latencyGoals,
    context.availabilityTarget,
    context.consistencyRequirements,
  ].filter(Boolean);

  const componentNoun =
    canvasStats.disconnectedCount === 1 ? "component" : "components";
  return (
    <section
      className="mt-5 border-t border-theme/15 pt-4"
      aria-labelledby="reasoning-context-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
          <MdPsychology className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              id="reasoning-context-title"
              className="text-sm font-semibold text-theme"
            >
              Reasoning context
            </h4>
            <span className="rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
              Provided by Diagramwise
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            This context is derived from the problem and canvas. You do not need
            to write it; use the assessment interview to explain your decisions.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[var(--brand)]">
        <MdAutoAwesome className="h-3.5 w-3.5" aria-hidden />
        <span>What the reviewer will use</span>
      </div>

      <dl className="mt-1 border-y border-theme/10">
        <ContextRow
          label="Canvas snapshot"
          value={`${canvasStats.componentCount} components, ${canvasStats.connectionCount} connections, ${canvasStats.componentTypes.length || 0} component types`}
        />
        <ContextRow
          label="Design signal"
          value={
            canvasStats.disconnectedCount > 0
              ? `${canvasStats.disconnectedCount} disconnected ${componentNoun} to review`
              : "All components are currently connected; failure paths still need review"
          }
        />
        <ContextRow
          label="Current choices"
          value={context.technologyChoices || "No components added yet"}
        />
        <ContextRow
          label="Targets to clarify"
          value={
            targetsToClarify.length > 0
              ? "Scale, traffic, latency, availability, and consistency are not explicit in the brief"
              : "The brief provides explicit quality targets"
          }
        />
      </dl>
    </section>
  );
};

export default ReasoningPanel;
