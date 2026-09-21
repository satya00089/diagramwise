import React, { useMemo, useState } from "react";
import {
  Background,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  MdAccountTree,
  MdArrowForward,
  MdExpandMore,
  MdInfoOutline,
} from "react-icons/md";

import StyledFlowControls from "../shared/StyledFlowControls";
import CustomEdge from "../../components/CustomEdge";
import CustomNode, { type NodeData } from "../../components/Node";
import { COMPONENTS } from "../../config/components";
import { getDefaultArchitectureHandlePair } from "../../utils/architectureEdgeRouting";
import type {
  GuideArchitecture,
  GuideArchitectureComponent,
} from "../../types/problemGuide";

import "@xyflow/react/dist/style.css";

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

const noop = () => {};

const ReadOnlyNodeShell: React.FC<
  React.PropsWithChildren<{ highlighted?: boolean }>
> = ({ children, highlighted = false }) => (
  <div
    className="cursor-pointer [&_*]:pointer-events-none"
    style={{
      borderRadius: "0.75rem",
      boxShadow: highlighted
        ? "0 0 0 2px var(--brand), 0 0 22px color-mix(in srgb, var(--brand) 42%, transparent)"
        : "none",
      transition: "box-shadow 150ms ease",
    }}
  >
    {children}
  </div>
);

const ReadOnlyCustomNode = (props: NodeProps) => (
  <ReadOnlyNodeShell highlighted={props.data?.highlighted === true}>
    <CustomNode
      id={props.id}
      data={props.data as NodeData}
      onCopy={noop}
      isInGroup={false}
    />
  </ReadOnlyNodeShell>
);

const ReadOnlyCustomEdge = (props: EdgeProps) => (
  <CustomEdge
    {...props}
    data={{
      ...((props.data ?? {}) as Record<string, unknown>),
      readOnly: true,
    }}
  />
);

const NODE_TYPES = { custom: ReadOnlyCustomNode };
const EDGE_TYPES = { customEdge: ReadOnlyCustomEdge };

const componentDefinition = (component: GuideArchitectureComponent) => {
  const componentId = component.componentId || component.type;
  return COMPONENTS.find((entry) => entry.id === componentId);
};

const toFlowNodes = (architecture: GuideArchitecture): Node[] =>
  architecture.components.map((component) => {
    const definition = componentDefinition(component);
    const properties = component.properties ?? {};

    return {
      id: component.id,
      type: component.nodeType || "custom",
      position: component.position,
      data: {
        ...properties,
        label: component.label,
        componentName: component.label,
        componentId: component.componentId || component.type,
        icon: definition?.icon,
        iconUrl: definition?.iconUrl,
        subtitle: component.description,
        purpose: component.description,
        backgroundColor:
          "color-mix(in srgb, var(--surface) 94%, var(--brand) 6%)",
        borderColor: "color-mix(in srgb, var(--brand) 58%, var(--border))",
      },
    };
  });

const toFlowEdges = (architecture: GuideArchitecture): Edge[] => {
  return architecture.connections.map((connection) => {
    const properties = connection.properties ?? {};
    const defaultHandles = getDefaultArchitectureHandlePair(
      connection,
      architecture.components,
    );

    return {
      id: connection.id,
      source: connection.source,
      sourceHandle:
        typeof properties.sourceHandle === "string"
          ? properties.sourceHandle
          : defaultHandles.sourceHandle,
      target: connection.target,
      targetHandle:
        typeof properties.targetHandle === "string"
          ? properties.targetHandle
          : defaultHandles.targetHandle,
      type: "customEdge",
      data: {
        label: connection.label || connection.type,
        hasLabel: Boolean(connection.label),
        purpose: connection.description,
        connectionType: connection.type,
        readOnly: true,
        pathType: properties.pathType === "bezier" ? "bezier" : "smoothstep",
        labelPosition:
          properties.labelPosition === "source" ||
          properties.labelPosition === "target"
            ? properties.labelPosition
            : "center",
        labelOffset:
          typeof properties.labelOffset === "number"
            ? properties.labelOffset
            : undefined,
        labelMaxWidth:
          typeof properties.labelMaxWidth === "number"
            ? properties.labelMaxWidth
            : undefined,
      },
    };
  });
};

const ArchitectureFlow: React.FC<{
  nodes: Node[];
  edges: Edge[];
  onSelect: (selection: Selection) => void;
}> = ({ nodes, edges, onSelect }) => {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const hoveredEdge = useMemo(
    () => edges.find((edge) => edge.id === hoveredEdgeId),
    [edges, hoveredEdgeId],
  );
  const highlightedNodeIds = useMemo(
    () => new Set(hoveredEdge ? [hoveredEdge.source, hoveredEdge.target] : []),
    [hoveredEdge],
  );
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: highlightedNodeIds.has(node.id),
        },
      })),
    [highlightedNodeIds, nodes],
  );
  const displayEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          highlighted: edge.id === hoveredEdgeId,
          dimmed: hoveredEdgeId !== null && edge.id !== hoveredEdgeId,
        },
      })),
    [edges, hoveredEdgeId],
  );

  return (
    <div className="relative h-[28rem] min-h-[28rem] w-full overflow-hidden border border-theme/10 bg-[var(--bg)] sm:h-[34rem] sm:min-h-[34rem] lg:h-[38rem] lg:min-h-[38rem] xl:h-[42rem] xl:min-h-[42rem] 2xl:h-[46rem] 2xl:min-h-[46rem]">
      <ReactFlow
        className="public-architecture-canvas"
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        nodesFocusable
        edgesFocusable
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, node) => onSelect({ kind: "node", id: node.id })}
        onEdgeClick={(_, edge) => onSelect({ kind: "edge", id: edge.id })}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        onPaneClick={() => {
          setHoveredEdgeId(null);
          onSelect(null);
        }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.08}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--border)" />
        <StyledFlowControls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bottom-3 !right-3"
        />
      </ReactFlow>
    </div>
  );
};

const getComponent = (architecture: GuideArchitecture, id: string) =>
  architecture.components.find((component) => component.id === id);

const SelectionPanel: React.FC<{
  architecture: GuideArchitecture;
  selection: Selection;
}> = ({ architecture, selection }) => {
  const selectedNode =
    selection?.kind === "node"
      ? getComponent(architecture, selection.id)
      : undefined;
  const selectedEdge =
    selection?.kind === "edge"
      ? architecture.connections.find((edge) => edge.id === selection.id)
      : undefined;

  if (!selectedNode && !selectedEdge) {
    return null;
  }

  if (selectedNode) {
    const properties = Object.entries(selectedNode.properties ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    );

    return (
      <div className="h-full border border-theme/10 bg-[var(--bg)] p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 bg-[var(--brand)]/10 p-2 text-[var(--brand)]">
            <MdAccountTree aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold">{selectedNode.label}</h4>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
              {selectedNode.type.replaceAll("-", " ")}
            </p>
          </div>
        </div>
        {selectedNode.description && (
          <p className="mt-5 text-sm leading-6 text-muted">
            {selectedNode.description}
          </p>
        )}
        {properties.length > 0 && (
          <dl className="mt-5 space-y-3 border-t border-theme/10 pt-4">
            {properties.map(([key, value]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <dt className="text-muted">{key}</dt>
                <dd className="text-right font-medium text-theme">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  const source = selectedEdge
    ? getComponent(architecture, selectedEdge.source)
    : null;
  const target = selectedEdge
    ? getComponent(architecture, selectedEdge.target)
    : null;

  return (
    <div className="h-full border border-theme/10 bg-[var(--bg)] p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 bg-[var(--brand)]/10 p-2 text-[var(--brand)]">
          <MdArrowForward aria-hidden="true" />
        </div>
        <div>
          <h4 className="font-semibold">
            {selectedEdge?.label || "Data flow"}
          </h4>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
            {source?.label || selectedEdge?.source} →{" "}
            {target?.label || selectedEdge?.target}
          </p>
        </div>
      </div>
      {selectedEdge?.description && (
        <p className="mt-5 text-sm leading-6 text-muted">
          {selectedEdge.description}
        </p>
      )}
      <div className="mt-5 flex items-start gap-2 border-t border-theme/10 pt-4 text-sm text-muted">
        <MdInfoOutline
          className="mt-0.5 shrink-0 text-[var(--brand)]"
          aria-hidden="true"
        />
        <span>Connections describe the important request or data path.</span>
      </div>
    </div>
  );
};

const PublicArchitectureCanvas: React.FC<{
  architecture: GuideArchitecture;
  onPractice?: () => void;
}> = ({ architecture, onPractice }) => {
  const nodes = useMemo(() => toFlowNodes(architecture), [architecture]);
  const edges = useMemo(() => toFlowEdges(architecture), [architecture]);
  const [selection, setSelection] = useState<Selection>(null);

  return (
    <section className="overflow-hidden border border-theme/10 bg-[var(--surface)] shadow-[0_16px_40px_rgba(17,24,39,0.08)]">
      <header className="border-b border-theme/10 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
              {architecture.title}
            </h3>
            <p className="mt-3 leading-7 text-muted">{architecture.summary}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <MdAccountTree className="text-[var(--brand)]" aria-hidden="true" />
            {architecture.components.length} components
          </div>
        </div>
        <details className="group mt-5 border-t border-theme/10">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] [&::-webkit-details-marker]:hidden">
            <span>{architecture.layers.length} architecture layers</span>
            <MdExpandMore
              className="text-xl text-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="grid gap-3 pb-2 sm:grid-cols-3">
            {architecture.layers.map((layer) => (
              <li key={layer.id} className="text-sm leading-6 text-muted">
                <strong className="block text-theme">{layer.label}</strong>
                {layer.description}
              </li>
            ))}
          </ul>
        </details>
      </header>

      <div className="p-3 sm:p-5">
        <ReactFlowProvider>
          <ArchitectureFlow
            nodes={nodes}
            edges={edges}
            onSelect={setSelection}
          />
        </ReactFlowProvider>

        <div className="mt-3">
          {selection ? (
            <SelectionPanel architecture={architecture} selection={selection} />
          ) : (
            <div className="border border-theme/10 bg-[var(--bg)] px-4 py-3 text-sm text-muted">
              <span className="font-semibold text-theme">How to read it:</span>{" "}
              follow the primary request path from left to right, then inspect
              the asynchronous paths below it. Select any component or
              connection for details.
            </div>
          )}
        </div>
      </div>

      {onPractice && (
        <footer className="flex flex-col gap-4 border-t border-theme/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="font-semibold">Ready to design your own version?</p>
            <p className="mt-1 text-sm text-muted">
              Use this architecture as a reference, then explain your own
              choices.
            </p>
          </div>
          <button
            type="button"
            onClick={onPractice}
            className="inline-flex items-center justify-center gap-2 bg-[var(--brand)] px-5 py-3 font-semibold text-[var(--bg)] shadow-[0_8px_22px_rgba(99,102,241,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(99,102,241,0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            Start designing <MdArrowForward aria-hidden="true" />
          </button>
        </footer>
      )}
    </section>
  );
};

export default PublicArchitectureCanvas;
