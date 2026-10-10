import React, { useId } from "react";
import type {
  ReviewFinding,
  ReviewFindingSeverity,
} from "../types/systemDesign";
import { getReviewFindingId } from "../types/systemDesign";
import type { RequirementSpec } from "../types/requirements";

const SEVERITY_LABELS: Record<ReviewFindingSeverity, string> = {
  critical: "Critical",
  important: "Important",
  improvement: "Improvement",
  positive: "Strength",
};
const SEVERITY_STYLES: Record<ReviewFindingSeverity, string> = {
  critical: "border-red-500/40 bg-red-500/5",
  important: "border-amber-500/40 bg-amber-500/5",
  improvement: "border-[var(--brand)]/30 bg-[var(--brand)]/5",
  positive: "border-green-500/40 bg-green-500/5",
};
const SEVERITY_BADGE_STYLES: Record<ReviewFindingSeverity, string> = {
  critical: "bg-red-500/15 text-red-400",
  important: "bg-amber-500/15 text-amber-400",
  improvement: "bg-[var(--brand)]/15 text-[var(--brand)]",
  positive: "bg-green-500/15 text-green-400",
};
const normalize = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

type AssessmentFindingsProps = {
  findings: ReviewFinding[];
  addressedFindingIds?: string[];
  onToggleAddressed?: (findingId: string) => void;
  onSelectEvidence?: (evidenceId: string) => void;
  requirementSpec?: RequirementSpec;
  suggestions?: string[];
  strengths?: string[];
  structuralOnly?: boolean;
};

const AssessmentFindings: React.FC<AssessmentFindingsProps> = ({
  findings,
  addressedFindingIds = [],
  onToggleAddressed,
  onSelectEvidence,
  requirementSpec,
  suggestions = [],
  strengths = [],
  structuralOnly = false,
}) => {
  const id = useId();
  const requirements = new Map(
    [
      ...(requirementSpec?.functional ?? []),
      ...(requirementSpec?.nonFunctional ?? []),
    ].map((requirement) => [requirement.id, requirement]),
  );
  const isOptional = (finding: ReviewFinding) =>
    finding.kind === "extension" ||
    (Boolean(finding.requirement_ids?.length) &&
      finding.requirement_ids?.every(
        (requirementId) =>
          requirements.get(requirementId)?.scope === "extension",
      ));
  const seen = new Set<string>();
  const priority: Record<ReviewFindingSeverity, number> = {
    critical: 0,
    important: 1,
    improvement: 2,
    positive: 3,
  };
  const uniqueFindings = [...findings]
    .sort((a, b) => priority[a.severity] - priority[b.severity])
    .filter((finding) => {
      const keys = [finding.title, finding.recommendation]
        .filter((text): text is string => Boolean(text))
        .map(normalize);
      if (keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      seen.add(normalize(finding.explanation));
      return true;
    });
  const positives = uniqueFindings.filter(
    (finding) => finding.severity === "positive" || finding.kind === "strength",
  );
  const optional = uniqueFindings.filter(
    (finding) => !positives.includes(finding) && isOptional(finding),
  );
  const actions = uniqueFindings.filter(
    (finding) => !positives.includes(finding) && !isOptional(finding),
  );
  const uniqueText = (items: string[]) =>
    items.filter((item) => {
      const key = normalize(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const extraStrengths = uniqueText(strengths);
  const extraSuggestions = uniqueText(suggestions);
  const nextActions = actions.slice(0, 3);
  const nextSuggestions = extraSuggestions.slice(0, 3 - nextActions.length);
  const remainingActions = actions.slice(3);
  const remainingSuggestions = extraSuggestions.slice(nextSuggestions.length);

  const renderFinding = (finding: ReviewFinding, optionalFinding = false) => {
    const findingId = getReviewFindingId(finding);
    const changed = addressedFindingIds.includes(findingId);
    const severity = optionalFinding
      ? "improvement"
      : positives.includes(finding)
        ? "positive"
        : finding.severity;
    return (
      <article
        key={findingId}
        className={`rounded-lg border p-3 ${SEVERITY_STYLES[severity]}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="min-w-0 break-words text-sm font-semibold text-theme leading-snug">
            {finding.title}
          </h4>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE_STYLES[severity]}`}
          >
            {optionalFinding ? "Optional" : SEVERITY_LABELS[severity]}
          </span>
        </div>
        <div className="mt-2 space-y-2 break-words text-xs leading-relaxed text-theme">
          <p>
            <span className="font-semibold">Why it matters: </span>
            {finding.explanation}
          </p>
          {finding.recommendation && (
            <p>
              <span className="font-semibold">
                {severity === "positive"
                  ? "Keep: "
                  : finding.kind === "clarification"
                    ? "What to clarify: "
                    : "What to change: "}
              </span>
              {finding.recommendation}
            </p>
          )}
          {finding.requirement_ids?.length ? (
            <p className="text-muted">
              Requirements:{" "}
              {finding.requirement_ids
                .map(
                  (requirementId) =>
                    requirements.get(requirementId)?.text ?? requirementId,
                )
                .join("; ")}
            </p>
          ) : null}
        </div>
        {finding.evidence_ids?.length ? (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {[...new Set(finding.evidence_ids)].map((evidenceId) =>
              onSelectEvidence ? (
                <button
                  key={evidenceId}
                  type="button"
                  onClick={() => onSelectEvidence(evidenceId)}
                  className="max-w-full break-words rounded-md border border-theme/15 px-2 py-1 text-[var(--brand)] hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  Show evidence: {evidenceId}
                </button>
              ) : (
                <span key={evidenceId} className="break-words text-muted">
                  Evidence: {evidenceId}
                </span>
              ),
            )}
          </div>
        ) : null}
        {onToggleAddressed && severity !== "positive" && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onToggleAddressed(findingId)}
              aria-pressed={changed}
              className="rounded-md border border-theme/15 px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-[var(--bg-hover)] hover:text-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/60"
            >
              {changed ? "Changed — review again" : "Mark as changed"}
            </button>
            {changed && (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Your change has not been verified. Run another review to check
                it.
              </p>
            )}
          </div>
        )}
      </article>
    );
  };
  const renderText = (items: string[]) => (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-theme">
      {items.map((item) => (
        <li key={normalize(item)} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );

  if (
    !uniqueFindings.length &&
    !extraStrengths.length &&
    !extraSuggestions.length
  )
    return null;

  return (
    <div className="space-y-4">
      {(nextActions.length > 0 || nextSuggestions.length > 0) && (
        <section
          className="p-4 border rounded-xl bg-[var(--surface)] space-y-3"
          aria-labelledby={`${id}-actions`}
        >
          <h3 id={`${id}-actions`} className="font-semibold text-theme text-sm">
            {structuralOnly ? "Structure-check observations" : "Next actions"}
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            {structuralOnly
              ? "Check these observations against your design, then retry the AI review."
              : "Start with these changes, then review your design again."}
          </p>
          {nextActions.map((finding) => renderFinding(finding))}
          {nextSuggestions.length > 0 && renderText(nextSuggestions)}
          {(remainingActions.length > 0 || remainingSuggestions.length > 0) && (
            <details className="border-t border-theme/10 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
                More observations (
                {remainingActions.length + remainingSuggestions.length})
              </summary>
              <div className="mt-3 space-y-3">
                {remainingActions.map((finding) => renderFinding(finding))}
                {remainingSuggestions.length > 0 &&
                  renderText(remainingSuggestions)}
              </div>
            </details>
          )}
        </section>
      )}
      {(positives.length > 0 || extraStrengths.length > 0) && (
        <section
          className="p-4 border rounded-xl bg-[var(--surface)] space-y-3"
          aria-labelledby={`${id}-strengths`}
        >
          <h3
            id={`${id}-strengths`}
            className="font-semibold text-theme text-sm"
          >
            {structuralOnly ? "Structure checks supported" : "Strengths"}
          </h3>
          {positives.map((finding) => renderFinding(finding))}
          {extraStrengths.length > 0 && renderText(extraStrengths)}
        </section>
      )}
      {optional.length > 0 && (
        <details className="p-4 border rounded-xl bg-[var(--surface)]">
          <summary className="cursor-pointer text-sm font-semibold text-theme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">
            Optional improvements ({optional.length})
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            These extend the exercise beyond its core requirements.
          </p>
          <div className="mt-3 space-y-3">
            {optional.map((finding) => renderFinding(finding, true))}
          </div>
        </details>
      )}
    </div>
  );
};

export default AssessmentFindings;
