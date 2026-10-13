import React from "react";
import {
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  ReactFlow,
  MiniMap,
  Background,
  ConnectionMode,
} from "@xyflow/react";
import StyledFlowControls from "./shared/StyledFlowControls";

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
          <StyledFlowControls>{canvasActions}</StyledFlowControls>
          <Background gap={16} />
          {children}
        </ReactFlow>
      </section>
    </div>
  );
};

export default DiagramCanvas;
