import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useTheme } from "../hooks/useTheme";
import AnimatedTextarea from "../components/shared/AnimatedTextarea";
import SEO from "../components/SEO";
import type { Requirement, RequirementSpec } from "../types/requirements";
import {
  HiDocumentText,
  HiLightBulb,
  HiArrowRight,
  HiChevronDown,
} from "react-icons/hi2";
import {
  MdTune,
  MdLabel,
  MdAccessTime,
  MdCheckCircle,
  MdClose,
  MdWarning,
} from "react-icons/md";

type ArrayField =
  | "requirements"
  | "nonFunctionalRequirements"
  | "assumptions"
  | "constraints"
  | "hints"
  | "tags";

interface ArrayItemWithId {
  id: string;
  value: string;
  scope?: Requirement["scope"];
}

const CreateProblem: React.FC = () => {
  useTheme();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const itemIdCounter = useRef(0);

  const generateItemId = () => {
    itemIdCounter.current += 1;
    return `item-${Date.now()}-${itemIdCounter.current}`;
  };

  const [formData, setFormData] = useState(() => ({
    title: "",
    description: "",
    difficulty: "Medium" as "Easy" | "Medium" | "Hard",
    category: "Web Application",
    estimatedTime: "30 minutes",
    requirements: [{ id: generateItemId(), value: "" }] as ArrayItemWithId[],
    nonFunctionalRequirements: [
      { id: generateItemId(), value: "" },
    ] as ArrayItemWithId[],
    assumptions: [{ id: generateItemId(), value: "" }] as ArrayItemWithId[],
    constraints: [{ id: generateItemId(), value: "" }] as ArrayItemWithId[],
    hints: [{ id: generateItemId(), value: "" }] as ArrayItemWithId[],
    tags: [{ id: generateItemId(), value: "" }] as ArrayItemWithId[],
  }));

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayItemChange = (
    field: ArrayField,
    id: string,
    value: string,
  ) => {
    const newArray = formData[field].map((item) =>
      item.id === id ? { ...item, value } : item,
    );
    setFormData((prev) => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field: ArrayField) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], { id: generateItemId(), value: "" }],
    }));
  };

  const handleRequirementScopeChange = (
    field: "requirements" | "nonFunctionalRequirements",
    id: string,
    scope: Requirement["scope"],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item) =>
        item.id === id ? { ...item, scope } : item,
      ),
    }));
  };

  const removeArrayItem = (field: ArrayField, id: string) => {
    const newArray = formData[field].filter((item) => item.id !== id);
    setFormData((prev) => ({
      ...prev,
      [field]:
        newArray.length > 0 ? newArray : [{ id: generateItemId(), value: "" }],
    }));
  };

  const handleSubmit = () => {
    if (isSubmitting || !formData.title.trim() || !formData.description.trim())
      return;
    setIsSubmitting(true);
    setSaveError(null);

    const plainText = (value: string) => {
      const document = new DOMParser().parseFromString(value, "text/html");
      document
        .querySelectorAll("script, style")
        .forEach((element) => element.remove());
      document
        .querySelectorAll("p, li, div, h1, h2, h3, br")
        .forEach((element) => element.prepend(" "));
      return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
    };
    const toRequirements = (
      items: ArrayItemWithId[],
      prefix: string,
    ): Requirement[] =>
      items
        .map((item) => ({
          id: `${prefix}-${item.id}`,
          text: plainText(item.value),
          scope: item.scope ?? "core",
        }))
        .filter((item) => item.text.length > 0);
    const requirementSpec: RequirementSpec = {
      schemaVersion: 1,
      revision: `local-${Date.now()}`,
      functional: toRequirements(formData.requirements, "functional"),
      nonFunctional: toRequirements(
        formData.nonFunctionalRequirements,
        "non-functional",
      ),
      assumptions: formData.assumptions
        .map((item) => item.value.trim())
        .filter(Boolean),
    };

    // Create a custom problem object
    const customProblem = {
      id: `custom-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      difficulty: formData.difficulty,
      category: formData.category,
      estimated_time: formData.estimatedTime,
      requirementSpec,
      requirements: [
        ...formData.requirements,
        ...formData.nonFunctionalRequirements,
      ]
        .filter((item) => plainText(item.value).length > 0)
        .map((item) => item.value),
      constraints: formData.constraints
        .map((c) => c.value)
        .filter((v) => v.trim() !== ""),
      hints: formData.hints.map((h) => h.value).filter((v) => v.trim() !== ""),
      tags: formData.tags.map((t) => t.value).filter((v) => v.trim() !== ""),
    };

    // Store in localStorage for now (you can replace with API call)
    try {
      localStorage.setItem(
        `custom-problem-${customProblem.id}`,
        JSON.stringify(customProblem),
      );
    } catch {
      setSaveError(
        "Could not save this problem in your browser. Your entries are still here; free up browser storage and try again.",
      );
      setIsSubmitting(false);
      return;
    }

    // Small delay for better UX
    setTimeout(() => {
      navigate(`/playground/${customProblem.id}`);
    }, 300);
  };

  return (
    <>
      <SEO
        title="Create Custom System Design Problem | Diagramwise"
        description="Create and share custom system design problems with your students or team. Define requirements, constraints, and evaluation criteria for personalized learning experiences."
        keywords="create system design problem, custom architecture challenge, teaching system design, system design assignment creator"
        image="https://diagramwise.com/og/create-problem.png"
        imageAlt="Diagramwise custom problem creation preview"
        url="https://diagramwise.com/create-problem"
        noIndex
      />
      <div className="min-h-screen bg-[var(--bg)] text-theme relative grid-pattern-overlay">
        {/* Header */}
        <header
          className="fixed left-0 right-0 z-50 bg-[var(--brand)] transition-all duration-300 shadow-lg"
          style={{ top: "var(--announcement-h, 0px)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center space-x-3 group cursor-pointer"
              >
                <img
                  src="/logo-64.png"
                  alt="Logo"
                  className="h-7 transition-transform group-hover:scale-110 duration-300"
                />
                <span className="text-lg font-bold text-white tracking-wide leading-none">
                  Diagramwise
                </span>
              </button>
              <div className="flex items-center gap-4">
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="pt-16 relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="text-center mb-12">
              <div className="inline-block mb-4">
                <span className="px-4 py-2 bg-[var(--brand)] text-white text-sm font-semibold rounded-full">
                  Custom Problem Creator
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Create Custom Problem
              </h1>
              <p className="text-muted text-lg max-w-2xl mx-auto">
                Define your own system design challenge and start solving
              </p>
            </div>

            <div className="elevated-card-bg backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-12">
              <div className="space-y-8">
                {/* Title */}
                <div>
                  <label
                    htmlFor="title"
                    className="text-sm font-bold text-theme mb-3 flex items-center gap-2"
                  >
                    <HiDocumentText className="w-5 h-5" /> Problem Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="e.g., Design a URL Shortener"
                    className="w-full px-5 py-4 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme text-lg transition-all duration-300 hover:border-[var(--brand)]/30"
                  />
                </div>

                {/* Description */}
                <div>
                  <AnimatedTextarea
                    id="description"
                    label="Description *"
                    value={formData.description}
                    onChange={(value) =>
                      handleInputChange("description", value)
                    }
                    placeholder="Describe the problem in detail..."
                  />
                </div>

                {/* Difficulty & Category */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label
                      htmlFor="difficulty"
                      className="text-sm font-bold text-theme mb-3 flex items-center gap-2"
                    >
                      <MdTune className="w-5 h-5" /> Difficulty
                    </label>
                    <div className="select-field-wrapper">
                      <select
                        id="difficulty"
                        value={formData.difficulty}
                        onChange={(e) =>
                          handleInputChange(
                            "difficulty",
                            e.target.value as "Easy" | "Medium" | "Hard",
                          )
                        }
                        className="select-field"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                      <HiChevronDown
                        aria-hidden="true"
                        className="select-field-icon"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="category"
                      className="text-sm font-bold text-theme mb-3 flex items-center gap-2"
                    >
                      <MdLabel className="w-5 h-5" /> Category
                    </label>
                    <input
                      id="category"
                      type="text"
                      value={formData.category}
                      onChange={(e) =>
                        handleInputChange("category", e.target.value)
                      }
                      placeholder="e.g., Web Application"
                      className="w-full px-5 py-4 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300 hover:border-[var(--brand)]/30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="estimatedTime"
                      className="text-sm font-bold text-theme mb-3 flex items-center gap-2"
                    >
                      <MdAccessTime className="w-5 h-5" /> Estimated Time
                    </label>
                    <input
                      id="estimatedTime"
                      type="text"
                      value={formData.estimatedTime}
                      onChange={(e) =>
                        handleInputChange("estimatedTime", e.target.value)
                      }
                      placeholder="e.g., 30 minutes"
                      className="w-full px-5 py-4 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300 hover:border-[var(--brand)]/30"
                    />
                  </div>
                </div>

                {(
                  [
                    {
                      field: "requirements",
                      title: "Functional requirements",
                      description: "What the system must let users do.",
                      placeholder: "e.g., Create and share a document",
                    },
                    {
                      field: "nonFunctionalRequirements",
                      title: "Non-functional requirements",
                      description:
                        "The qualities the design must support, such as scale, latency, or availability.",
                      placeholder: "e.g., Support 100,000 concurrent editors",
                    },
                  ] as const
                ).map(({ field, title, description, placeholder }) => (
                  <section
                    key={field}
                    className="rounded-2xl bg-[var(--surface)]/50"
                    aria-labelledby={`${field}-heading`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <h2
                        id={`${field}-heading`}
                        className="text-sm font-bold text-theme flex items-center gap-2"
                      >
                        <MdCheckCircle
                          className="w-5 h-5 text-[var(--brand)]"
                          aria-hidden="true"
                        />
                        {title}
                      </h2>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => addArrayItem(field)}
                        aria-label={`Add ${title.toLowerCase().replace(/s$/, "")}`}
                        className="px-4 py-2 text-sm text-white bg-[var(--brand)] rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                      >
                        + Add
                      </button>
                    </div>
                    <p className="mb-4 text-sm leading-relaxed text-muted">
                      {description} Core requirements are evaluated; extensions
                      add optional scope.
                    </p>
                    {formData[field].map((item, index) => (
                      <div key={item.id} className="mb-4">
                        <div className="flex gap-3 items-start">
                          <div className="min-w-0 flex-1">
                            <AnimatedTextarea
                              id={`${field}-${item.id}`}
                              label={`${title.replace(/s$/, "")} ${index + 1}`}
                              value={item.value}
                              disabled={isSubmitting}
                              onChange={(value) =>
                                handleArrayItemChange(field, item.id, value)
                              }
                              placeholder={placeholder}
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <label
                                htmlFor={`scope-${item.id}`}
                                className="text-sm font-semibold text-theme"
                              >
                                Scope
                              </label>
                              <div className="select-field-wrapper">
                                <select
                                  id={`scope-${item.id}`}
                                  value={item.scope ?? "core"}
                                  disabled={isSubmitting}
                                  onChange={(event) =>
                                    handleRequirementScopeChange(
                                      field,
                                      item.id,
                                      event.target.value === "extension"
                                        ? "extension"
                                        : "core",
                                    )
                                  }
                                  className="select-field"
                                  aria-label={`Scope for ${title.toLowerCase().replace(/s$/, "")} ${index + 1}`}
                                >
                                  <option value="core">Core requirement</option>
                                  <option value="extension">
                                    Optional extension
                                  </option>
                                </select>
                                <HiChevronDown
                                  aria-hidden="true"
                                  className="select-field-icon"
                                />
                              </div>
                            </div>
                          </div>
                          {formData[field].length > 1 && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => removeArrayItem(field, item.id)}
                              aria-label={`Remove ${title.toLowerCase().replace(/s$/, "")} ${index + 1}`}
                              className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer font-bold text-lg mt-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                            >
                              <MdClose className="h-5 w-5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}

                {/* Constraints */}
                <div className="rounded-2xl bg-[var(--surface)]/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold text-theme flex items-center gap-2">
                      <MdWarning className="w-5 h-5" /> Constraints
                    </div>
                    <button
                      type="button"
                      onClick={() => addArrayItem("constraints")}
                      className="px-4 py-2 text-sm text-white bg-[var(--brand)] rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                  {formData.constraints.map((item) => (
                    <div key={item.id} className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) =>
                          handleArrayItemChange(
                            "constraints",
                            item.id,
                            e.target.value,
                          )
                        }
                        placeholder="Enter a constraint"
                        className="flex-1 px-4 py-3 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300"
                      />
                      {formData.constraints.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeArrayItem("constraints", item.id)
                          }
                          className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer font-bold text-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <section
                  className="rounded-2xl bg-[var(--surface)]/50"
                  aria-labelledby="assumptions-heading"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2
                      id="assumptions-heading"
                      className="text-sm font-bold text-theme"
                    >
                      Assumptions
                    </h2>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => addArrayItem("assumptions")}
                      aria-label="Add assumption"
                      className="px-4 py-2 text-sm text-white bg-[var(--brand)] rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-muted">
                    Reference choices learners may replace with a justified
                    assumption.
                  </p>
                  {formData.assumptions.map((item, index) => (
                    <div key={item.id} className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={item.value}
                        disabled={isSubmitting}
                        onChange={(event) =>
                          handleArrayItemChange(
                            "assumptions",
                            item.id,
                            event.target.value,
                          )
                        }
                        aria-label={`Assumption ${index + 1}`}
                        placeholder="e.g., Most documents are read more often than edited"
                        className="min-w-0 flex-1 px-4 py-3 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300"
                      />
                      {formData.assumptions.length > 1 && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            removeArrayItem("assumptions", item.id)
                          }
                          aria-label={`Remove assumption ${index + 1}`}
                          className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          <MdClose className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </section>

                {/* Hints */}
                <div className="rounded-2xl bg-[var(--surface)]/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold text-theme flex items-center gap-2">
                      <HiLightBulb className="w-5 h-5" /> Hints
                    </div>
                    <button
                      type="button"
                      onClick={() => addArrayItem("hints")}
                      className="px-4 py-2 text-sm text-white bg-[var(--brand)] rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                  {formData.hints.map((item) => (
                    <div key={item.id} className="flex gap-3 mb-3">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) =>
                          handleArrayItemChange(
                            "hints",
                            item.id,
                            e.target.value,
                          )
                        }
                        placeholder="Enter a helpful hint"
                        className="flex-1 px-4 py-3 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300"
                      />
                      {formData.hints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeArrayItem("hints", item.id)}
                          className="px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer font-bold text-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="rounded-2xl bg-[var(--surface)]/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold text-theme flex items-center gap-2">
                      <MdLabel className="w-5 h-5" /> Tags
                    </div>
                  </div>

                  {/* Tag Chips Display */}
                  {formData.tags.some((item) => item.value.trim()) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {formData.tags
                        .filter((item) => item.value.trim())
                        .map((item) => (
                          <div
                            key={item.id}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-full text-sm font-semibold transition-all duration-200 group"
                          >
                            <span>{item.value}</span>
                            <button
                              type="button"
                              onClick={() => removeArrayItem("tags", item.id)}
                              className="hover:bg-white/20 rounded-full p-1 transition-colors"
                              aria-label="Remove tag"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Tag Input */}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={formData.tags.at(-1)?.value || ""}
                      onChange={(e) =>
                        handleArrayItemChange(
                          "tags",
                          formData.tags.at(-1)?.id || "",
                          e.target.value,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          e.preventDefault();
                          addArrayItem("tags");
                        }
                      }}
                      placeholder="Type a tag and press Enter (e.g., caching, scalability)"
                      className="flex-1 px-4 py-3 border-2 border-[var(--theme)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent bg-[var(--bg)] text-theme transition-all duration-300 hover:border-[var(--brand)]/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.tags.at(-1)?.value.trim()) {
                          addArrayItem("tags");
                        }
                      }}
                      className="px-6 py-3 text-white bg-[var(--brand)] rounded-lg hover:shadow-sm transition-all duration-200 cursor-pointer font-semibold"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                {saveError && (
                  <p
                    role="alert"
                    className="text-sm leading-relaxed text-red-600 dark:text-red-300"
                  >
                    {saveError}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t-2 border-[var(--theme)]/10">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      !formData.title.trim() ||
                      !formData.description.trim() ||
                      isSubmitting
                    }
                    className="flex-1 px-8 py-4 bg-[var(--brand)] text-white font-semibold rounded-lg hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />{" "}
                        Creating...
                      </>
                    ) : (
                      <>
                        <HiArrowRight className="w-4 h-4" /> Create & Start
                        Designing
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    disabled={isSubmitting}
                    className="px-8 py-4 elevated-card-bg border-2 border-[var(--theme)]/10 text-theme font-bold rounded-xl hover:border-[var(--brand)]/30 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateProblem;
