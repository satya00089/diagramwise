/**
 * Unified Collaboration Hook
 * Provides a single interface for collaboration regardless of underlying implementation
 *
 * Responsibilities (Single Responsibility Principle):
 * - Abstract collaboration implementation details
 * - Switch between Yjs and WebSocket based on feature flags
 * - Maintain consistent API for components
 *
 * Open/Closed Principle:
 * - Open for new collaboration backends
 * - Closed for modification of existing implementations
 */

import { useState, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useAuth } from "./useAuth";
import { isFeatureEnabled, FeatureFlags } from "../config/featureFlags";
import { getYjsUrl } from "../config/environment";
import { useYjsCollaboration } from "./useYjsCollaboration";
import type {
  CollaboratorUser,
  CollaboratorCursor,
} from "./useYjsCollaboration";
import { useCollaboration as useWebSocketCollaboration } from "./useCollaboration";

export interface UnifiedCollaborationState {
  isConnected: boolean;
  isSynced: boolean;
  collaboratorCount: number;
  error: string | null;
}

export interface UnifiedCollaborationOptions {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  enabled: boolean;
  /** Yjs room to join when it differs from the design (per-canvas rooms). */
  roomId?: string;
  /** Content to seed an empty Yjs room with. See UseYjsCollaborationParams.getSeed. */
  getSeed?: () => { nodes: Node[]; edges: Edge[] } | null;
}

export interface UnifiedCollaborationReturn {
  state: UnifiedCollaborationState;
  collaborators: CollaboratorUser[];
  cursors: CollaboratorCursor[];
  sendUpdate: (data: { nodes?: Node[]; edges?: Edge[] }) => void;
  sendCursorPosition: (position: { x: number; y: number }) => void;
  disconnect: () => void;
  reconnect: () => void;
}

/**
 * Unified collaboration hook that switches between implementations
 */
export const useUnifiedCollaboration = ({
  diagramId,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  enabled,
  roomId,
  getSeed,
}: UnifiedCollaborationOptions): UnifiedCollaborationReturn => {
  const { user } = useAuth();

  // Check if Yjs is enabled via feature flag AND Yjs URL is configured
  // If no VITE_YJS_URL is provided, automatically fall back to custom WebSocket
  const yjsUrl = getYjsUrl();
  const useYjs = !!yjsUrl && isFeatureEnabled(FeatureFlags.YJS_COLLABORATION);

  // Yjs collaboration
  const yjsCollaboration = useYjsCollaboration({
    diagramId: roomId ?? diagramId,
    nodes,
    edges,
    getSeed,
    onNodesChange,
    onEdgesChange,
    userId: user?.id || "anonymous",
    userName: user?.name || "Anonymous",
    userEmail: user?.email,
    userPictureUrl: user?.picture || undefined,
    userAvatarKey: user?.avatarKey,
    enabled: useYjs && enabled,
  });

  // WebSocket collaboration
  const [wsCollaborators, setWsCollaborators] = useState<CollaboratorUser[]>(
    [],
  );
  const [wsCursors, setWsCursors] = useState<CollaboratorCursor[]>([]);
  const wsCollaboration = useWebSocketCollaboration({
    diagramId,
    enabled: !useYjs && enabled,
    onDiagramUpdate: (data) => {
      if (data.nodes) {
        onNodesChange(data.nodes);
      }
      if (data.edges) {
        onEdgesChange(data.edges);
      }
    },
    onUserJoined: (user) => {
      setWsCollaborators((prev) => {
        if (prev.some((c) => c.id === user.id)) return prev;
        return [...prev, user];
      });
    },
    onUserLeft: (user) => {
      setWsCollaborators((prev) => prev.filter((c) => c.id !== user.id));
      setWsCursors((prev) => prev.filter((c) => c.userId !== user.id));
    },
  });

  // Update WebSocket cursors from the hook
  const wsCursorsFromHook = wsCollaboration.cursors;
  if (wsCursorsFromHook && wsCursorsFromHook.length !== wsCursors.length) {
    setWsCursors(
      wsCursorsFromHook.map((c) => ({
        userId: c.userId,
        user: c.user,
        position: c.position,
        timestamp: c.timestamp,
      })),
    );
  }

  // Unified state
  const state: UnifiedCollaborationState = useYjs
    ? {
        isConnected: yjsCollaboration.state.isConnected,
        isSynced: yjsCollaboration.state.isSynced,
        collaboratorCount: yjsCollaboration.state.collaboratorCount,
        error: yjsCollaboration.state.error,
      }
    : {
        isConnected: wsCollaboration.isConnected,
        isSynced: wsCollaboration.isConnected, // WebSocket doesn't have separate sync state
        collaboratorCount: wsCollaborators.length,
        error: wsCollaboration.isConnected ? null : "Disconnected",
      };

  // Unified collaborators and cursors
  const collaborators = useYjs
    ? yjsCollaboration.collaborators
    : wsCollaborators;
  const cursors = useYjs ? yjsCollaboration.cursors : wsCursors;

  // Unified send function
  const sendUpdate = useCallback(
    (data: { nodes?: Node[]; edges?: Edge[] }) => {
      if (!useYjs) {
        // WebSocket backend handles updates automatically via debouncing
        wsCollaboration.sendDiagramUpdate(data);
      }
      // Yjs handles updates automatically via observer pattern
    },
    [useYjs, wsCollaboration],
  );

  // Unified send cursor position
  const sendCursorPosition = useCallback(
    (position: { x: number; y: number }) => {
      if (useYjs) {
        yjsCollaboration.sendCursorPosition(position);
      } else {
        wsCollaboration.sendCursorPosition(position);
      }
    },
    [useYjs, yjsCollaboration, wsCollaboration],
  );

  // Unified disconnect function
  const disconnect = useCallback(() => {
    if (useYjs) {
      yjsCollaboration.disconnect();
    } else {
      wsCollaboration.disconnect();
    }
  }, [useYjs, yjsCollaboration, wsCollaboration]);

  // Unified reconnect function
  const reconnect = useCallback(() => {
    if (useYjs) {
      yjsCollaboration.reconnect();
    }
    // WebSocket hook auto-reconnects, no manual reconnect needed
  }, [useYjs, yjsCollaboration]);

  return {
    state,
    collaborators,
    cursors,
    sendUpdate,
    sendCursorPosition,
    disconnect,
    reconnect,
  };
};
