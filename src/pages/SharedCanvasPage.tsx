import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  ConnectionMode,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./SharedCanvasPage.css";

import { apiService } from "../services/api";
import { componentProviderService } from "../services/componentProviderService";
import CustomNode from "../components/Node";
import ERNode from "../components/ERNode";
import TableNode from "../components/TableNode";
import GroupNode from "../components/GroupNode";
import FreeformNode from "../components/FreeformNode";
import StyledFlowControls from "../components/shared/StyledFlowControls";
import ThemeSwitcher from "../components/ThemeSwitcher";
import CustomEdge from "../components/CustomEdge";
import ERRelationshipEdge from "../components/ERRelationshipEdge";
import AssessmentFindings from "../components/AssessmentFindings";
import SEO from "../components/SEO";
import type { ValidationResult } from "../types/systemDesign";
import { COMPONENTS } from "../config/components";
import { shouldUseDirectIcon } from "../utils/iconRendering";
import {
  MdAccountTree,
  MdArrowForward,
  MdAssessment,
  MdCheckCircle,
  MdClose,
  MdError,
  MdInfo,
  MdInsights,
  MdLink,
  MdMenu,
  MdPublic,
  MdTouchApp,
  MdTrendingUp,
  MdTune,
  MdWarning,
} from "react-icons/md";

// ---------------------------------------------------------------------------
// Constants mirrored from InspectorPanel
// ---------------------------------------------------------------------------

const DISPLAY_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Scalability", keys: ["scalability"] },
  { label: "Reliability", keys: ["reliability"] },
  { label: "Security", keys: ["security"] },
  { label: "Maintainability", keys: ["maintainability"] },
  { label: "Performance", keys: ["performance"] },
  {
    label: "Operations",
    keys: ["cost_efficiency", "observability", "deliverability"],
  },
  {
    label: "Alignment",
    keys: ["requirements_alignment", "constraint_compliance"],
  },
  {
    label: "Documentation",
    keys: ["component_justification", "connection_clarity"],
  },
];

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

const FEEDBACK_TYPE_SURFACE: Record<string, string> = {
  success: "bg-green-500/10",
  warning: "bg-amber-400/10",
  error: "bg-red-500/10",
  info: "bg-[var(--brand)]/10",
};

const FeedbackIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === "success")
    return <MdCheckCircle className="text-green-500" aria-hidden />;
  if (type === "warning")
    return <MdWarning className="text-amber-500" aria-hidden />;
  if (type === "error") return <MdError className="text-red-500" aria-hidden />;
  return <MdInfo className="text-[var(--brand)]" aria-hidden />;
};

const scoreColor = (v: number) => {
  if (v >= 75) return "#22c55e";
  if (v >= 50) return "#f59e0b";
  return "#ef4444";
};

// ---------------------------------------------------------------------------
// Read-only node wrappers (disable copy / drag interactions)
// ---------------------------------------------------------------------------

const noop = () => {};

const ReadOnlyNodeShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="cursor-pointer [&_*]:pointer-events-none">{children}</div>
);

/* eslint-disable @typescript-eslint/no-explicit-any */
const ReadOnlyCustomNode = (props: any) => (
  <ReadOnlyNodeShell>
    <CustomNode
      {...props}
      onCopy={noop}
      isInGroup={false}
      disableProviderSprites
    />
  </ReadOnlyNodeShell>
);
const ReadOnlyERNode = (props: any) => (
  <ReadOnlyNodeShell>
    <ERNode {...props} onCopy={noop} isInGroup={false} />
  </ReadOnlyNodeShell>
);
const ReadOnlyTableNode = (props: any) => (
  <ReadOnlyNodeShell>
    <TableNode {...props} onCopy={noop} isInGroup={false} />
  </ReadOnlyNodeShell>
);
const ReadOnlyFreeformNode = (props: any) => (
  <ReadOnlyNodeShell>
    <FreeformNode {...props} onCopy={noop} isInGroup={false} />
  </ReadOnlyNodeShell>
);
const ReadOnlyGroupNode = (props: any) => (
  <ReadOnlyNodeShell>
    <GroupNode {...props} disableProviderSprites />
  </ReadOnlyNodeShell>
);
const ReadOnlyCustomEdge = (props: any) => (
  <CustomEdge {...props} data={{ ...props.data, readOnly: true }} />
);
/* eslint-enable @typescript-eslint/no-explicit-any */

const NODE_TYPES = {
  custom: ReadOnlyCustomNode,
  erNode: ReadOnlyERNode,
  tableNode: ReadOnlyTableNode,
  freeform: ReadOnlyFreeformNode,
  group: ReadOnlyGroupNode,
};

const EDGE_TYPES = {
  customEdge: ReadOnlyCustomEdge,
  erRelationship: ERRelationshipEdge,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const restorePublicNodeIcons = (
  nodes: Node[],
  iconUrls: Record<string, string> = {},
): Node[] =>
  nodes.map((node) => {
    const componentId =
      typeof node.data?.componentId === "string" ? node.data.componentId : null;
    const localComponent = componentId
      ? COMPONENTS.find((component) => component.id === componentId)
      : null;
    const storedIcon = node.data?.icon;
    const safeStoredIcon =
      typeof storedIcon === "function" ||
      (typeof storedIcon === "object" && storedIcon !== null)
        ? storedIcon
        : undefined;
    const storedIconUrl =
      typeof node.data?.iconUrl === "string" ? node.data.iconUrl : undefined;

    return {
      ...node,
      data: {
        ...node.data,
        icon: localComponent?.icon ?? safeStoredIcon,
        iconUrl:
          storedIconUrl ?? (componentId ? iconUrls[componentId] : undefined),
      },
    };
  });

const SYSTEM_PROPERTY_KEYS = new Set([
  "label",
  "componentName",
  "componentId",
  "icon",
  "iconUrl",
  "subtitle",
  "description",
  "backgroundColor",
  "borderColor",
  "textColor",
  "renderConfig",
  "_customProperties",
]);

const EDGE_PROPERTY_KEYS = new Set([
  "label",
  "hasLabel",
  "description",
  "readOnly",
  "color",
  "strokeWidth",
  "bidirectional",
  "animated",
  "pathType",
  "type",
  "connectionType",
]);

type InspectorEntry = { key: string; label: string; value: string };
type SelectedElement =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;
type PanelTab = "overview" | "properties";

const humanizeKey = (key: string): string =>
  key
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const plainText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const parsed = new DOMParser().parseFromString(value, "text/html");
  return (parsed.body.textContent ?? "").replace(/\s+/g, " ").trim();
};

const formatInspectorValue = (value: unknown): string | null => {
  if (value == null || typeof value === "function") return null;
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return plainText(value) || null;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatInspectorValue(item))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "bigint" || typeof value === "symbol") {
    return value.toString();
  }
  return null;
};

const getNodeName = (node: Node | undefined): string => {
  if (!node) return "Unknown component";
  const data = node.data as Record<string, unknown>;
  return (
    plainText(data.componentName) ||
    plainText(data.label) ||
    plainText(data.componentId) ||
    "Untitled component"
  );
};

const getNodeDescription = (node: Node): string => {
  const data = node.data as Record<string, unknown>;
  return plainText(data.description) || plainText(data.subtitle);
};

const getNodeProperties = (node: Node): InspectorEntry[] => {
  const data = node.data as Record<string, unknown>;
  const componentId =
    typeof data.componentId === "string" ? data.componentId : null;
  const component = componentId
    ? COMPONENTS.find((item) => item.id === componentId)
    : null;
  const labels = new Map(
    (component?.properties ?? []).map((property) => [
      property.key,
      property.label,
    ]),
  );
  const entries = Object.entries(data)
    .filter(([key]) => !SYSTEM_PROPERTY_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: labels.get(key) ?? humanizeKey(key),
      value: formatInspectorValue(value),
    }))
    .filter(
      (entry): entry is InspectorEntry =>
        entry.value != null && entry.value.length > 0,
    );

  const customProperties = Array.isArray(data._customProperties)
    ? data._customProperties
        .map((property) => {
          if (!property || typeof property !== "object") return null;
          const item = property as Record<string, unknown>;
          const key =
            typeof item.key === "string"
              ? item.key
              : (formatInspectorValue(item.id) ?? "custom");
          const value = formatInspectorValue(item.value);
          if (!value) return null;
          return {
            key: `custom:${key}`,
            label:
              typeof item.label === "string" && item.label.trim()
                ? item.label
                : humanizeKey(key),
            value,
          };
        })
        .filter((entry): entry is InspectorEntry => entry != null)
    : [];

  return [...entries, ...customProperties];
};

const getEdgeProperties = (edge: Edge): InspectorEntry[] => {
  const data = (edge.data ?? {}) as Record<string, unknown>;
  return Object.entries(data)
    .filter(([key]) => !EDGE_PROPERTY_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      value: formatInspectorValue(value),
    }))
    .filter(
      (entry): entry is InspectorEntry =>
        entry.value != null && entry.value.length > 0,
    );
};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface AttemptPublicData {
  kind: "attempt";
  id: string;
  title: string;
  difficulty?: string;
  category?: string;
  problemId: string;
  nodes: Node[];
  edges: Edge[];
  lastAssessment?: ValidationResult | null;
  authorName?: string | null;
  authorPicture?: string | null;
  publishedAt?: string | null;
  viewCount: number;
}

interface DiagramPublicData {
  kind: "diagram";
  id: string;
  title: string;
  description?: string | null;
  nodes: Node[];
  edges: Edge[];
  authorName?: string | null;
  authorPicture?: string | null;
  publishedAt?: string | null;
  viewCount: number;
}

type PublicData = AttemptPublicData | DiagramPublicData;

// ---------------------------------------------------------------------------
// Assessment panel — mirrors InspectorPanel's assessment tab exactly
// ---------------------------------------------------------------------------

const AssessmentPanel: React.FC<{ assessment: ValidationResult }> = ({
  assessment,
}) => (
  <div className="space-y-4">
    {/* Score header */}
    <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)] flex items-center gap-4">
      <div className="flex w-16 flex-shrink-0 flex-col border-r border-[var(--border)] pr-4">
        <span
          className="text-2xl font-bold leading-none tabular-nums"
          style={{ color: scoreColor(assessment.score) }}
        >
          {assessment.score}
        </span>
        <span className="mt-1 text-[10px] font-semibold text-muted">
          out of 100
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-theme text-base">
          Architecture review
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              assessment.isValid
                ? "bg-green-500/15 text-green-500"
                : "bg-amber-500/15 text-amber-500"
            }`}
          >
            {assessment.isValid ? "Pass" : "Needs work"}
          </span>
          <span className="text-[10px] text-muted">
            {assessment.source === "rule_based"
              ? "Basic structural check"
              : "AI review"}
          </span>
        </div>
        {assessment.summary && (
          <p className="text-xs text-theme/80 leading-relaxed mt-2">
            {assessment.summary}
          </p>
        )}
        {assessment.processingTimeMs && (
          <div className="text-[10px] text-muted mt-1">
            Analysed in {(assessment.processingTimeMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </div>
    <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-theme">
        How this score works
      </summary>
      <p className="mt-2 leading-relaxed text-muted">
        This is a directional learning signal: the API computes a weighted
        average of the scored architecture dimensions, with scalability,
        reliability, security, and maintainability weighted more heavily. A
        score of 50 or higher meets the current baseline; it is not a
        production-readiness approval.
      </p>
    </details>

    {/* Score breakdown */}
    {assessment.scores && (
      <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)] space-y-3">
        <div className="font-semibold text-theme text-sm flex items-center gap-2">
          <MdAssessment className="text-[var(--brand)]" aria-hidden />
          <span>Score breakdown</span>
        </div>
        {DISPLAY_GROUPS.map(({ label, keys }) => {
          const s = assessment.scores as unknown as Record<
            string,
            number | undefined
          >;
          const vals = keys
            .map((k) => s[k])
            .filter((v): v is number => v != null);
          if (vals.length === 0) return null;
          const val = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          const color = scoreColor(val);
          const subtitle =
            keys.length > 1
              ? keys.map((k) => DIM_LABELS[k] ?? k).join(" · ")
              : null;
          return (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <span className="text-xs text-muted">{label}</span>
                  {subtitle && (
                    <span className="text-[10px] text-muted/50 ml-1.5">
                      {subtitle}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold" style={{ color }}>
                  {val}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${val}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* What went well */}
    {assessment.architectureStrengths.length > 0 && (
      <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
        <div className="font-semibold text-theme text-sm mb-3 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span>What Went Well</span>
        </div>
        <ul className="space-y-1.5">
          {assessment.architectureStrengths.map((strength) => (
            <li key={strength} className="flex items-start gap-2 text-sm">
              <MdCheckCircle
                className="mt-0.5 flex-shrink-0 text-green-500"
                aria-hidden
              />
              <span className="text-theme">{strength}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <AssessmentFindings findings={assessment.findings ?? []} />

    {/* Where to improve */}
    {(assessment.improvements.length > 0 ||
      (assessment.suggestions && assessment.suggestions.length > 0)) && (
      <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
        <div className="font-semibold text-theme text-sm mb-3 flex items-center gap-2">
          <MdTrendingUp className="text-orange-500" aria-hidden />
          <span>Where to improve</span>
        </div>
        {assessment.improvements.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {assessment.improvements.map((improvement) => (
              <li key={improvement} className="flex items-start gap-2 text-sm">
                <MdWarning
                  className="mt-0.5 flex-shrink-0 text-orange-500"
                  aria-hidden
                />
                <span className="text-theme">{improvement}</span>
              </li>
            ))}
          </ul>
        )}
        {assessment.suggestions && assessment.suggestions.length > 0 && (
          <>
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
              Suggestions
            </div>
            <ul className="space-y-1.5">
              {assessment.suggestions.map((suggestion) => (
                <li key={suggestion} className="flex items-start gap-2 text-sm">
                  <MdArrowForward
                    className="mt-0.5 flex-shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  <span className="text-muted">{suggestion}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )}

    {/* Analysis & Feedback */}
    {((assessment.detailedAnalysis &&
      Object.keys(assessment.detailedAnalysis).length > 0) ||
      assessment.feedback.length > 0) &&
      (() => {
        const feedbackByCategory: Record<string, ValidationResult["feedback"]> =
          {};
        const uncategorised: ValidationResult["feedback"] = [];
        for (const fb of assessment.feedback) {
          if (assessment.detailedAnalysis?.[fb.category]) {
            feedbackByCategory[fb.category] ??= [];
            feedbackByCategory[fb.category].push(fb);
          } else {
            uncategorised.push(fb);
          }
        }
        return (
          <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--surface)] space-y-4">
            <div className="font-semibold text-theme text-sm flex items-center gap-2">
              <MdInsights className="text-[var(--brand)]" aria-hidden />
              <span>Analysis &amp; feedback</span>
            </div>
            {assessment.detailedAnalysis &&
              Object.entries(assessment.detailedAnalysis).map(([dim, text]) => {
                if (!text) return null;
                const dimFeedback = feedbackByCategory[dim] ?? [];
                return (
                  <div key={dim} className="space-y-1.5">
                    <div className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-widest">
                      {DIM_LABELS[dim] ?? dim}
                    </div>
                    <div className="text-xs leading-relaxed text-theme">
                      {text}
                    </div>
                    {dimFeedback.map((feedback) => (
                      <div
                        key={`${feedback.type}:${feedback.message}`}
                        className={`flex items-start gap-1.5 rounded-lg p-2 ${FEEDBACK_TYPE_SURFACE[feedback.type] ?? "bg-[var(--brand)]/10"}`}
                      >
                        <span className="mt-0.5 flex-shrink-0">
                          <FeedbackIcon type={feedback.type} />
                        </span>
                        <span className="text-xs text-theme leading-relaxed">
                          {feedback.message}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            {uncategorised.map((feedback) => (
              <div
                key={`${feedback.type}:${feedback.message}`}
                className={`flex items-start gap-1.5 rounded-lg p-2 ${FEEDBACK_TYPE_SURFACE[feedback.type] ?? "bg-[var(--brand)]/10"}`}
              >
                <span className="mt-0.5 flex-shrink-0">
                  <FeedbackIcon type={feedback.type} />
                </span>
                <span className="text-xs text-theme leading-relaxed">
                  {feedback.message}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
  </div>
);

const PropertyRows: React.FC<{ entries: InspectorEntry[] }> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl bg-[var(--bg)] px-4 py-5 text-center text-xs leading-relaxed text-muted">
        No additional configuration was documented for this item.
      </p>
    );
  }

  return (
    <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-xl bg-[var(--bg)] px-4">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="grid grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-3 py-3"
        >
          <dt className="break-words text-xs font-medium leading-relaxed text-muted">
            {entry.label}
          </dt>
          <dd className="break-words text-right text-xs font-semibold leading-relaxed text-theme">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const SelectionInspector: React.FC<{
  selection: SelectedElement;
  nodes: Node[];
  edges: Edge[];
  onInspectEdge: (edgeId: string) => void;
}> = ({ selection, nodes, edges, onInspectEdge }) => {
  if (!selection) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center">
        <MdTouchApp className="text-[var(--brand)]" size={32} aria-hidden />
        <h2 className="mt-4 text-sm font-bold text-theme">
          Inspect the architecture
        </h2>
        <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-muted">
          Select any component or connection on the canvas to see its read-only
          configuration and documentation.
        </p>
        <div className="mt-5 flex items-center gap-4 text-xs text-muted">
          <span>
            <strong className="tabular-nums text-theme">{nodes.length}</strong>{" "}
            components
          </span>
          <span>
            <strong className="tabular-nums text-theme">{edges.length}</strong>{" "}
            connections
          </span>
        </div>
      </div>
    );
  }

  if (selection.kind === "node") {
    const node = nodes.find((item) => item.id === selection.id);
    if (!node) return null;
    const data = node.data as Record<string, unknown>;
    const componentId =
      plainText(data.componentId) || humanizeKey(node.type ?? "component");
    const description = getNodeDescription(node);
    const properties = getNodeProperties(node);
    const connectedEdges = edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id,
    );

    return (
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
            <MdTune size={20} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-base font-bold leading-snug text-theme">
              {getNodeName(node)}
            </h2>
            <p className="mt-1 break-words text-xs text-muted">{componentId}</p>
          </div>
        </div>

        {description && (
          <p className="mt-4 break-words text-xs leading-relaxed text-muted">
            {description}
          </p>
        )}

        <section className="mt-6" aria-labelledby="component-config-title">
          <h3
            id="component-config-title"
            className="mb-2 text-xs font-bold text-theme"
          >
            Configuration
          </h3>
          <PropertyRows entries={properties} />
        </section>

        <section className="mt-6" aria-labelledby="component-connections-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3
              id="component-connections-title"
              className="text-xs font-bold text-theme"
            >
              Connected flows
            </h3>
            <span className="text-xs tabular-nums text-muted">
              {connectedEdges.length}
            </span>
          </div>
          {connectedEdges.length > 0 ? (
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl bg-[var(--bg)]">
              {connectedEdges.map((edge) => {
                const outgoing = edge.source === node.id;
                const otherNode = nodes.find(
                  (item) => item.id === (outgoing ? edge.target : edge.source),
                );
                const edgeData = (edge.data ?? {}) as Record<string, unknown>;
                const edgeLabel = plainText(edgeData.label);
                return (
                  <button
                    key={edge.id}
                    type="button"
                    onClick={() => onInspectEdge(edge.id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
                  >
                    <MdArrowForward
                      className={`flex-shrink-0 text-[var(--brand)] ${outgoing ? "" : "rotate-180"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-theme">
                        {getNodeName(otherNode)}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {edgeLabel ||
                          (outgoing ? "Outgoing flow" : "Incoming flow")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-[var(--bg)] px-4 py-4 text-xs leading-relaxed text-muted">
              This component has no documented connections.
            </p>
          )}
        </section>
      </div>
    );
  }

  const edge = edges.find((item) => item.id === selection.id);
  if (!edge) return null;
  const data = (edge.data ?? {}) as Record<string, unknown>;
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  const label = plainText(data.label) || "Unlabelled connection";
  const description = plainText(data.description);
  const flowType =
    plainText(data.connectionType) || plainText(data.type) || "Data flow";
  const properties: InspectorEntry[] = [
    { key: "flow-type", label: "Flow type", value: humanizeKey(flowType) },
    {
      key: "direction",
      label: "Direction",
      value: data.bidirectional === true ? "Bidirectional" : "One-way",
    },
    ...getEdgeProperties(edge),
  ];

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          <MdLink size={21} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-bold leading-snug text-theme">
            {label}
          </h2>
          <p className="mt-1 text-xs text-muted">Connection</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-[var(--bg)] px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 break-words text-xs font-semibold text-theme">
            {getNodeName(sourceNode)}
          </span>
          <MdArrowForward
            className="flex-shrink-0 text-[var(--brand)]"
            aria-hidden
          />
          <span className="min-w-0 flex-1 break-words text-right text-xs font-semibold text-theme">
            {getNodeName(targetNode)}
          </span>
        </div>
      </div>

      {description && (
        <p className="mt-4 break-words text-xs leading-relaxed text-muted">
          {description}
        </p>
      )}

      <section className="mt-6" aria-labelledby="connection-config-title">
        <h3
          id="connection-config-title"
          className="mb-2 text-xs font-bold text-theme"
        >
          Connection details
        </h3>
        <PropertyRows entries={properties} />
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inner canvas (must be inside ReactFlowProvider)
// ---------------------------------------------------------------------------

const ReadOnlyCanvas: React.FC<{
  nodes: Node[];
  edges: Edge[];
  onSelectNode: (node: Node) => void;
  onSelectEdge: (edge: Edge) => void;
  onClearSelection: () => void;
}> = ({ nodes, edges, onSelectNode, onSelectEdge, onClearSelection }) => (
  <ReactFlow
    className="public-read-only-canvas"
    nodes={nodes}
    edges={edges}
    nodeTypes={NODE_TYPES}
    edgeTypes={EDGE_TYPES}
    nodesDraggable={false}
    nodesConnectable={false}
    elementsSelectable
    nodesFocusable
    edgesFocusable
    connectionMode={ConnectionMode.Loose}
    onNodeClick={(_, node) => onSelectNode(node)}
    onEdgeClick={(_, edge) => onSelectEdge(edge)}
    onPaneClick={onClearSelection}
    panOnDrag
    zoomOnScroll
    zoomOnPinch
    minZoom={0.08}
    maxZoom={2}
    fitView
    fitViewOptions={{ padding: 0.12 }}
    proOptions={{ hideAttribution: true }}
  >
    <Background gap={20} size={1} color="var(--border)" />
    <StyledFlowControls showInteractive={false} />
    <MiniMap
      nodeStrokeWidth={3}
      zoomable
      pannable
      className="!bottom-4 !right-4"
    />
  </ReactFlow>
);

// ---------------------------------------------------------------------------
// Right panel — mirrors playground InspectorPanel look (no ScoreRing)
// ---------------------------------------------------------------------------

const RightPanel: React.FC<{
  data: PublicData;
  nodes: Node[];
  edges: Edge[];
  selection: SelectedElement;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onInspectEdge: (edgeId: string) => void;
  mobile?: boolean;
  onClose?: () => void;
}> = ({
  data,
  nodes,
  edges,
  selection,
  activeTab,
  onTabChange,
  onInspectEdge,
  mobile = false,
  onClose,
}) => {
  const assessment =
    data.kind === "attempt" ? (data.lastAssessment ?? null) : null;
  const ctaTo =
    data.kind === "attempt"
      ? `/playground/${data.problemId}`
      : `/playground/free?remix=${encodeURIComponent(data.id)}`;
  const ctaText =
    data.kind === "attempt" ? "Try this problem" : "Remix this design";
  let panelContent: React.ReactNode = (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
      <MdAccountTree
        className="mb-3 text-[var(--brand)]"
        size={34}
        aria-hidden
      />
      <p className="mb-1 text-sm font-semibold text-theme">Free-form design</p>
      <p className="max-w-[200px] text-xs leading-relaxed text-muted">
        Explore the architecture, then create an editable copy of your own.
      </p>
      <div className="mt-5 flex items-center gap-4 text-xs text-muted">
        <span>
          <strong className="tabular-nums text-theme">{nodes.length}</strong>{" "}
          components
        </span>
        <span>
          <strong className="tabular-nums text-theme">{edges.length}</strong>{" "}
          connections
        </span>
      </div>
    </div>
  );
  if (activeTab === "properties") {
    panelContent = (
      <SelectionInspector
        selection={selection}
        nodes={nodes}
        edges={edges}
        onInspectEdge={onInspectEdge}
      />
    );
  } else if (assessment) {
    panelContent = <AssessmentPanel assessment={assessment} />;
  }

  return (
    <aside
      className={`shared-details-panel flex flex-col overflow-hidden bg-[var(--surface)] ${
        mobile
          ? "h-[82dvh] w-full rounded-t-2xl shadow-[0_-16px_48px_rgba(0,0,0,0.22)]"
          : "h-full w-[360px] flex-shrink-0 border-l border-[var(--border)] xl:w-[400px]"
      }`}
    >
      {/* Header band */}
      <div className="shared-details-heading relative flex-shrink-0 bg-[var(--share-bg)] px-5 py-5 text-[var(--share-text)]">
        <div className="flex items-start gap-3">
          <span className="shared-details-heading__icon" aria-hidden="true">
            <MdPublic size={16} />
          </span>
          <h1 className="min-w-0 flex-1 break-words text-base font-bold leading-snug text-[color:var(--share-text)]">
            {data.title}
          </h1>
          {mobile && (
            <button
              id="shared-details-close"
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[color:var(--share-text)] hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label="Close design details"
            >
              <MdClose size={19} />
            </button>
          )}
        </div>
        <p className="shared-details-kicker">Published architecture</p>
        {data.kind === "attempt" && (data.difficulty || data.category) && (
          <div className="ml-8 mt-3 flex flex-wrap items-center gap-2">
            {data.difficulty && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[color:var(--share-text)]/80 font-medium">
                {data.difficulty}
              </span>
            )}
            {data.category && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[color:var(--share-text)]/80 font-medium">
                {data.category}
              </span>
            )}
          </div>
        )}
        {data.kind === "diagram" && data.description && (
          <p className="ml-8 mt-2 break-words text-xs leading-relaxed text-[color:var(--share-text)]/75">
            {data.description}
          </p>
        )}
      </div>

      {/* Author row */}
      <div className="shared-author-row flex items-center gap-3 px-5 py-4 flex-shrink-0 border-b border-[var(--border)]">
        {data.authorPicture ? (
          <img
            src={data.authorPicture}
            alt={data.authorName ?? "Author"}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--brand,#6366f1)]/15 flex items-center justify-center flex-shrink-0 text-[var(--brand,#6366f1)] font-bold text-sm">
            {(data.authorName ?? "A")[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-theme truncate">
            {data.authorName ?? "Anonymous"}
          </p>
          {data.publishedAt && (
            <p className="text-xs text-muted">{formatDate(data.publishedAt)}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold tabular-nums text-theme">
            {data.viewCount}
          </p>
          <p className="text-[10px] text-muted">
            {data.viewCount === 1 ? "view" : "views"}
          </p>
        </div>
      </div>

      <div
        className="shared-tabs grid flex-shrink-0 grid-cols-2 gap-1 border-b border-[var(--border)] bg-[var(--surface)] p-3"
        role="tablist"
        aria-label="Public design details"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => onTabChange("overview")}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
            activeTab === "overview"
              ? "bg-[var(--brand)]/10 text-[var(--brand)]"
              : "text-muted hover:bg-[var(--bg-hover)] hover:text-theme"
          }`}
        >
          <MdAssessment aria-hidden /> Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "properties"}
          onClick={() => onTabChange("properties")}
          className={`relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
            activeTab === "properties"
              ? "bg-[var(--brand)]/10 text-[var(--brand)]"
              : "text-muted hover:bg-[var(--bg-hover)] hover:text-theme"
          }`}
        >
          <MdTune aria-hidden /> Properties
          {selection && activeTab !== "properties" && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
              aria-label="A canvas item is selected"
            />
          )}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="shared-panel-body flex-1 overflow-y-auto px-5 py-5 min-h-0">
        {panelContent}
      </div>

      {/* CTA footer */}
      <div className="shared-panel-footer flex-shrink-0 border-t border-[var(--border)] px-5 py-4">
        <Link
          to={ctaTo}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand,#6366f1)] py-2.5 text-center text-sm font-semibold text-white transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
        >
          {ctaText} <MdArrowForward aria-hidden />
        </Link>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SharedCanvasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selection, setSelection] = useState<SelectedElement>(null);
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>("overview");
  const [publicIconUrls, setPublicIconUrls] = useState<Record<string, string>>(
    {},
  );

  // Reconstruct composite id if hash was not URL-encoded (legacy broken links)
  const resolvedId = useMemo(() => {
    if (!id) return id;
    const fragment = globalThis.location.hash.replace(/^#/, "");
    return fragment ? `${id}#${fragment}` : id;
  }, [id]);

  useEffect(() => {
    if (!resolvedId) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isAttempt = resolvedId.includes("#");

    const req = isAttempt
      ? apiService.getPublicSolution(resolvedId).then((res) => ({
          kind: "attempt" as const,
          id: res.id,
          title: res.title,
          difficulty: res.difficulty,
          category: res.category,
          problemId: res.problemId,
          nodes: res.nodes as Node[],
          edges: res.edges as Edge[],
          lastAssessment:
            res.lastAssessment == null
              ? null
              : (res.lastAssessment as unknown as ValidationResult),
          authorName: res.authorName,
          authorPicture: res.authorPicture,
          publishedAt: res.publishedAt,
          viewCount: res.viewCount,
        }))
      : apiService.getPublicDiagramData(resolvedId).then((res) => ({
          kind: "diagram" as const,
          id: res.id,
          title: res.title,
          description: res.description,
          nodes: res.nodes as Node[],
          edges: res.edges as Edge[],
          authorName: res.authorName,
          authorPicture: res.authorPicture,
          publishedAt: res.publishedAt,
          viewCount: res.viewCount,
        }));

    req
      .then((result) => {
        setData(result);
        setSelection(null);
        setActivePanelTab("overview");
      })
      .catch(() =>
        setError("This design is not available or has been unpublished."),
      )
      .finally(() => setLoading(false));
  }, [resolvedId]);

  useEffect(() => {
    if (!data) {
      setPublicIconUrls({});
      return;
    }

    const componentIds = Array.from(
      new Set(
        data.nodes
          .map((node) =>
            typeof node.data?.componentId === "string"
              ? node.data.componentId
              : null,
          )
          .filter((componentId): componentId is string => {
            if (!componentId) return false;
            const node = data.nodes.find(
              (candidate) => candidate.data?.componentId === componentId,
            );
            return !node?.data?.iconUrl && shouldUseDirectIcon(componentId);
          }),
      ),
    );

    if (componentIds.length === 0) {
      setPublicIconUrls({});
      return;
    }

    let cancelled = false;
    setPublicIconUrls({});

    Promise.all(
      componentIds.map(async (componentId) => {
        try {
          const component =
            await componentProviderService.getComponentById(componentId);
          return component.iconUrl
            ? ([componentId, component.iconUrl] as const)
            : null;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setPublicIconUrls(
        Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [string, string] => entry !== null,
          ),
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const nodes = useMemo(
    () => restorePublicNodeIcons(data?.nodes ?? [], publicIconUrls),
    [data, publicIconUrls],
  );
  const edges = useMemo(
    () =>
      (data?.edges ?? []).map((edge) => {
        const edgeData = (edge.data ?? {}) as Record<string, unknown>;
        const configuredStrokeWidth =
          typeof edgeData.strokeWidth === "number" ? edgeData.strokeWidth : 0;
        return {
          ...edge,
          type: edge.type ?? "customEdge",
          data: {
            ...edgeData,
            readOnly: true,
            strokeWidth: Math.max(configuredStrokeWidth, 2.25),
          },
        };
      }),
    [data],
  );
  const canvasNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: selection?.kind === "node" && selection.id === node.id,
      })),
    [nodes, selection],
  );
  const canvasEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        selected: selection?.kind === "edge" && selection.id === edge.id,
      })),
    [edges, selection],
  );

  const revealMobileInspector = () => {
    if (globalThis.matchMedia("(max-width: 1023px)").matches) {
      setShowDetails(true);
    }
  };

  const inspectNode = (node: Node) => {
    setSelection({ kind: "node", id: node.id });
    setActivePanelTab("properties");
    revealMobileInspector();
  };

  const inspectEdge = (edge: Edge | string) => {
    setSelection({
      kind: "edge",
      id: typeof edge === "string" ? edge : edge.id,
    });
    setActivePanelTab("properties");
    revealMobileInspector();
  };

  const pageTitle = data
    ? `${data.title} — Diagramwise`
    : "Shared Design — Diagramwise";

  useEffect(() => {
    if (!showDetails) return;
    const focusTimer = window.setTimeout(
      () => document.getElementById("shared-details-close")?.focus(),
      0,
    );
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDetails(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showDetails]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--brand,#6366f1)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted text-sm">Loading design…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14"
              />
            </svg>
          </div>
          <h2 className="text-theme font-bold text-lg mb-2">
            Design unavailable
          </h2>
          <p className="text-muted text-sm mb-6">
            {error ?? "This design is not available or has been unpublished."}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2 rounded-xl bg-[var(--brand,#6366f1)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Diagramwise
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={pageTitle}
        description={
          data.kind === "attempt"
            ? `Check out this system design solution for "${data.title}" on Diagramwise.`
            : `Check out this interactive diagram "${data.title}" on Diagramwise.`
        }
        image="https://diagramwise.com/og/shared-canvas.png"
        imageAlt={pageTitle}
      />

      <div className="shared-page flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
        {/* Top bar */}
        <header className="shared-header flex h-16 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-7">
          <Link
            to="/"
            className="shared-brand flex flex-shrink-0 items-center gap-2.5 text-theme transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <img src="/logo-64.png" alt="" className="h-7 w-7 object-contain" />
            <span>Diagramwise</span>
          </Link>
          <span className="shared-header-divider" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-theme">
            {data.title}
          </span>
          <div className="shared-header-actions ml-auto flex flex-shrink-0 items-center gap-3">
            <span className="shared-readonly hidden sm:inline-flex">Read-only view</span>
            <div className="shared-theme-control" aria-label="Theme preference">
              <ThemeSwitcher />
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="shared-details-trigger inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] lg:hidden"
              aria-label="Open design details"
            >
              <MdMenu aria-hidden /> Details
            </button>
          </div>
        </header>

        {/* Body: canvas + sidebar */}
        <div className="flex flex-1 min-h-0">
          {/* Canvas */}
          <div className="shared-canvas-shell relative flex-1 min-w-0 h-full">
            <ReactFlowProvider>
              <ReadOnlyCanvas
                nodes={canvasNodes}
                edges={canvasEdges}
                onSelectNode={inspectNode}
                onSelectEdge={inspectEdge}
                onClearSelection={() => setSelection(null)}
              />
            </ReactFlowProvider>
            <div className="shared-canvas-label" aria-hidden="true">
              <span className="shared-canvas-label__title">Architecture canvas</span>
              <span className="shared-canvas-label__meta">
                {nodes.length} components <span>·</span> {edges.length} connections
              </span>
            </div>
            <div className="shared-canvas-hint" aria-hidden="true">
              Select an element to inspect
            </div>
          </div>

          {/* Right panel */}
          <div className="shared-panel-shell hidden h-full lg:block">
            <RightPanel
              data={data}
              nodes={nodes}
              edges={edges}
              selection={selection}
              activeTab={activePanelTab}
              onTabChange={setActivePanelTab}
              onInspectEdge={inspectEdge}
            />
          </div>
        </div>

        {showDetails && (
          <dialog
            open
            className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-end border-0 bg-transparent p-0 lg:hidden"
            aria-modal="true"
            aria-label="Design details"
          >
            <button
              type="button"
              aria-label="Close design details"
              className="absolute inset-0 bg-slate-950/60"
              onClick={() => setShowDetails(false)}
            />
            <div className="relative z-10 w-full">
              <RightPanel
                data={data}
                nodes={nodes}
                edges={edges}
                selection={selection}
                activeTab={activePanelTab}
                onTabChange={setActivePanelTab}
                onInspectEdge={inspectEdge}
                mobile
                onClose={() => setShowDetails(false)}
              />
            </div>
          </dialog>
        )}
      </div>
    </>
  );
};

export default SharedCanvasPage;
