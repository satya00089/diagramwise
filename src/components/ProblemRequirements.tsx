import React, { useId } from "react";
import { MdCheckCircleOutline } from "react-icons/md";
import type { Requirement, RequirementSpec } from "../types/requirements";

type ProblemRequirementsProps = {
  requirementSpec?: RequirementSpec;
  requirements?: string[];
  constraints?: string[];
  compact?: boolean;
};

type SectionItem = { id: string; text: string };

const getHeadingClass = (compact: boolean) =>
  compact ? "text-sm font-semibold text-theme" : "text-lg font-bold text-theme";

const getListClass = (compact: boolean) =>
  compact
    ? "mt-2 space-y-2 text-xs leading-relaxed text-muted"
    : "mt-4 space-y-3 leading-7 text-muted";

function RequirementSection({
  id,
  title,
  items,
  compact,
}: {
  id: string;
  title: string;
  items: SectionItem[];
  compact: boolean;
}) {
  const headingClass = getHeadingClass(compact);
  const listClass = getListClass(compact);

  return (
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
}

function AssumptionsSection({
  id,
  assumptions,
  compact,
}: {
  id: string;
  assumptions: string[];
  compact: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-assumptions`}>
      <h3 id={`${id}-assumptions`} className={getHeadingClass(compact)}>
        Assumptions
      </h3>
      <p
        className={`${compact ? "text-xs" : "text-sm"} mt-2 leading-relaxed text-muted`}
      >
        Reference choices; you can justify different assumptions in your design.
      </p>
      {assumptions.length ? (
        <ul className={`${getListClass(compact)} list-disc pl-5`}>
          {assumptions.map((assumption, index) => (
            <li key={index} className="break-words">
              {assumption}
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
}

function RequirementSpecContent({
  id,
  requirementSpec,
  compact,
}: {
  id: string;
  requirementSpec: RequirementSpec;
  compact: boolean;
}) {
  const coreSections = [
    {
      title: "Functional requirements",
      items: requirementSpec.functional.filter((item) => item.scope === "core"),
    },
    {
      title: "Non-functional requirements",
      items: requirementSpec.nonFunctional.filter(
        (item) => item.scope === "core",
      ),
    },
  ];
  const extensionSections = [
    {
      title: "Functional extensions",
      items: requirementSpec.functional.filter(
        (item) => item.scope === "extension",
      ),
    },
    {
      title: "Non-functional extensions",
      items: requirementSpec.nonFunctional.filter(
        (item) => item.scope === "extension",
      ),
    },
  ].filter((section) => section.items.length > 0);

  return (
    <>
      <div className={compact ? "space-y-5" : "grid gap-8 md:grid-cols-2"}>
        {coreSections.map((section) => (
          <RequirementSection
            key={section.title}
            id={id}
            title={section.title}
            items={section.items}
            compact={compact}
          />
        ))}
      </div>
      {extensionSections.length > 0 && (
        <details className="border-y border-theme/10 py-3">
          <summary
            className={`${getHeadingClass(compact)} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}
          >
            Optional extensions
          </summary>
          <p
            className={`${compact ? "text-xs" : "text-sm"} mt-3 leading-relaxed text-muted`}
          >
            Additional scope beyond the core exercise.
          </p>
          <div className="mt-4 space-y-5">
            {extensionSections.map((section) => (
              <RequirementSection
                key={section.title}
                id={id}
                title={section.title}
                items={section.items}
                compact={compact}
              />
            ))}
          </div>
        </details>
      )}
      <AssumptionsSection
        id={id}
        assumptions={requirementSpec.assumptions}
        compact={compact}
      />
    </>
  );
}

const legacyItems = (items: string[]): SectionItem[] =>
  items.map((text, index) => ({ id: String(index), text }));

/** Share the approved brief without reclassifying legacy requirement lists. */
const ProblemRequirements: React.FC<ProblemRequirementsProps> = ({
  requirementSpec,
  requirements = [],
  constraints = [],
  compact = false,
}) => {
  const id = useId();

  return (
    <div className={compact ? "space-y-5 mb-4" : "space-y-8"}>
      {requirementSpec ? (
        <RequirementSpecContent
          id={id}
          requirementSpec={requirementSpec}
          compact={compact}
        />
      ) : (
        <RequirementSection
          id={id}
          title="Requirements"
          items={legacyItems(requirements)}
          compact={compact}
        />
      )}
      {constraints.length > 0 && (
        <RequirementSection
          id={id}
          title="Constraints"
          items={legacyItems(constraints)}
          compact={compact}
        />
      )}
    </div>
  );
};

export default ProblemRequirements;
