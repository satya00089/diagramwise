import React, { useId } from "react";
import { MdCheckCircleOutline } from "react-icons/md";
import type { Requirement, RequirementSpec } from "../types/requirements";

type ProblemRequirementsProps = {
  requirementSpec?: RequirementSpec;
  requirements?: string[];
  constraints?: string[];
  compact?: boolean;
};

/** Share the approved brief without reclassifying legacy requirement lists. */
const ProblemRequirements: React.FC<ProblemRequirementsProps> = ({
  requirementSpec,
  requirements = [],
  constraints = [],
  compact = false,
}) => {
  const id = useId();
  const headingClass = compact
    ? "text-sm font-semibold text-theme"
    : "text-lg font-bold text-theme";
  const listClass = compact
    ? "mt-2 space-y-2 text-xs leading-relaxed text-muted"
    : "mt-4 space-y-3 leading-7 text-muted";

  const section = (title: string, items: { id: string; text: string }[]) => (
    <section aria-labelledby={`${id}-${title.replaceAll(" ", "-")}`}>
      <h3 id={`${id}-${title.replaceAll(" ", "-")}`} className={headingClass}>
        {title}
      </h3>
      {items.length ? (
        <ul className={listClass}>
          {items.map((item) => (
            <li key={item.id} className="flex min-w-0 items-start gap-3">
              <MdCheckCircleOutline
                className="mt-1 shrink-0 text-[var(--brand)]"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`${compact ? "text-xs" : "text-sm"} mt-2 text-muted`}>
          None specified.
        </p>
      )}
    </section>
  );
  const legacyItems = (items: string[]) =>
    items.map((text, index) => ({ id: String(index), text }));
  const core = (items: Requirement[]) =>
    items.filter((item) => item.scope === "core");
  const extensions = (items: Requirement[]) =>
    items.filter((item) => item.scope === "extension");
  const functionalExtensions = requirementSpec
    ? extensions(requirementSpec.functional)
    : [];
  const nonFunctionalExtensions = requirementSpec
    ? extensions(requirementSpec.nonFunctional)
    : [];

  return (
    <div className={compact ? "space-y-5 mb-4" : "space-y-8"}>
      {requirementSpec ? (
        <>
          <div className={compact ? "space-y-5" : "grid gap-8 md:grid-cols-2"}>
            {section(
              "Functional requirements",
              core(requirementSpec.functional),
            )}
            {section(
              "Non-functional requirements",
              core(requirementSpec.nonFunctional),
            )}
          </div>
          {(functionalExtensions.length > 0 ||
            nonFunctionalExtensions.length > 0) && (
            <details className="border-y border-theme/10 py-3">
              <summary
                className={`${headingClass} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}
              >
                Optional extensions
              </summary>
              <p
                className={`${compact ? "text-xs" : "text-sm"} mt-3 leading-relaxed text-muted`}
              >
                Additional scope beyond the core exercise.
              </p>
              <div className="mt-4 space-y-5">
                {functionalExtensions.length > 0 &&
                  section("Functional extensions", functionalExtensions)}
                {nonFunctionalExtensions.length > 0 &&
                  section("Non-functional extensions", nonFunctionalExtensions)}
              </div>
            </details>
          )}
          <section aria-labelledby={`${id}-assumptions`}>
            <h3 id={`${id}-assumptions`} className={headingClass}>
              Assumptions
            </h3>
            <p
              className={`${compact ? "text-xs" : "text-sm"} mt-2 leading-relaxed text-muted`}
            >
              Reference choices; you can justify different assumptions in your
              design.
            </p>
            {requirementSpec.assumptions.length > 0 ? (
              <ul className={`${listClass} list-disc pl-5`}>
                {requirementSpec.assumptions.map((assumption, index) => (
                  <li key={index} className="break-words">
                    {assumption}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className={`${compact ? "text-xs" : "text-sm"} mt-2 text-muted`}
              >
                None specified.
              </p>
            )}
          </section>
        </>
      ) : (
        section("Requirements", legacyItems(requirements))
      )}
      {constraints.length > 0 &&
        section("Constraints", legacyItems(constraints))}
    </div>
  );
};

export default ProblemRequirements;
