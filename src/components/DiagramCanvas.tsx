import React from "react";
import {
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  ReactFlow,
  MiniMap,
  ConnectionMode,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import StyledFlowControls from "./shared/StyledFlowControls";
import CanvasInteractivityControl from "./CanvasInteractivityControl";
import CanvasBackgroundLayer from "./CanvasBackgroundLayer";
import type { CanvasBackground } from "../hooks/useCanvasBackground";

type DiagramCanvasProps = {
  readOnly?: boolean;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement>;
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  onNodesChange: (...changes: unknown[]) => void;
  onEdgesChange: (...changes: unknown[]) => void;
  onConnect: (c: Connection) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onNodeDragStop?: (event: React.MouseEvent, node: Node) => void;
  onMouseMove?: (event: React.MouseEvent) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  canvasActions?: React.ReactNode;
  /** Background pattern, or "none" to hide it. */
  backgroundVariant?: CanvasBackground;
  children?: React.ReactNode;
};

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  readOnly,
  reactFlowWrapperRef,
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDragOver,
  onDrop,
  onNodeDragStop,
  onMouseMove,
  onEdgeClick,
  canvasActions,
  backgroundVariant = BackgroundVariant.Dots,
  children,
}) => {
  return (
    <div
      className="flex-1 relative min-w-0 min-h-0 overflow-hidden bg-theme"
      data-tour="canvas-area"
    >
      <section
        className="w-full h-full"
        ref={reactFlowWrapperRef}
        onDragOver={onDragOver}
        onDrop={onDrop}
        aria-label="Diagram canvas drop area"
      >
        <ReactFlow
          className="w-full h-full"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeDragStop={readOnly ? undefined : onNodeDragStop}
          onMouseMove={onMouseMove}
          onEdgeClick={readOnly ? undefined : onEdgeClick}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          connectionMode={ConnectionMode.Loose}
          minZoom={0.18}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap nodeStrokeWidth={3} />
          {/* Two columns in one bottom-left group: direct actions (zoom, fit, lock) on the left,
              dropdown actions (canvas, layout, canvases, background) on the right. */}
          <Panel
            position="bottom-left"
            className="flex items-start gap-1.5 nodrag nopan"
            style={{ margin: 10 }}
          >
            <StyledFlowControls
              showInteractive={false}
              position="bottom-left"
              style={{ position: "relative", inset: "auto", margin: 0 }}
            >
              <CanvasInteractivityControl />
            </StyledFlowControls>
            {canvasActions && (
              <div className="react-flow__controls flex flex-col">
                {canvasActions}
              </div>
            )}
          </Panel>
          {backgroundVariant !== "none" && (
            <CanvasBackgroundLayer variant={backgroundVariant} />
          )}
          {children}
        </ReactFlow>
      </section>
    </div>
  );
};

export default DiagramCanvas;
