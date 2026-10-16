/**
 * Yjs Collaboration Hook
 * Manages real-time collaborative editing using Yjs CRDT
 *
 * Responsibilities (Single Responsibility Principle):
 * - Initialize Yjs document and provider
 * - Sync React Flow state with Yjs shared types
 * - Manage collaboration lifecycle
 * - Handle connection status
 *
 * Dependencies (Dependency Inversion Principle):
 * - Abstracts WebSocket provider details
 * - Works with any Yjs-compatible provider
 */

import { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Node, Edge } from "@xyflow/react";
import { getYjsUrl } from "../config/environment";
import {
  getCanvasNodesRevision,
  getCanvasEdgesRevision,
} from "../utils/canvasRevision";

export interface CollaboratorUser {
  id: string;
  name: string;
  email?: string;
  pictureUrl?: string;
  avatarKey?: string | null;
}

export interface CollaboratorCursor {
  userId: string;
  user: CollaboratorUser;
  position: { x: number; y: number };
  timestamp: string;
}

export interface CollaborationState {
  isConnected: boolean;
  isSynced: boolean;
  error: string | null;
  collaboratorCount: number;
}

export interface UseYjsCollaborationParams {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  userId: string;
  userName: string;
  userEmail?: string;
  userPictureUrl?: string;
  userAvatarKey?: string | null;
  enabled?: boolean;
  onUserJoined?: (user: CollaboratorUser) => void;
  onUserLeft?: (user: CollaboratorUser) => void;
  /**
   * Content to seed an empty room with. Multi-canvas passes the canvas being opened,
   * so a new room never receives another tab's nodes. Falls back to the current
   * nodes and edges when omitted or when it returns null.
   */
  getSeed?: () => { nodes: Node[]; edges: Edge[] } | null;
}

export interface UseYjsCollaborationReturn {
  state: CollaborationState;
  provider: WebsocketProvider | null;
  collaborators: CollaboratorUser[];
  cursors: CollaboratorCursor[];
  sendCursorPosition: (position: { x: number; y: number }) => void;
  disconnect: () => void;
  reconnect: () => void;
}

/**
 * Hook for managing Yjs collaboration
 * Implements graceful degradation - falls back to local state if connection fails
 */
export const useYjsCollaboration = ({
  diagramId,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  userId,
  userName,
  userEmail,
  userPictureUrl,
  userAvatarKey,
  enabled = true,
  onUserJoined,
  onUserLeft,
  getSeed,
}: UseYjsCollaborationParams): UseYjsCollaborationReturn => {
  // Read through a ref so a new getter does not re-initialize the room.
  const getSeedRef = useRef(getSeed);
  getSeedRef.current = getSeed;

  // Yjs document (CRDT state container)
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Collaboration state
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isSynced: false,
    error: null,
    collaboratorCount: 0,
  });

  // Collaborators and cursors state
  const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([]);
  const [cursors, setCursors] = useState<CollaboratorCursor[]>([]);
  const collaboratorsRef = useRef<CollaboratorUser[]>([]);

  // Store callbacks in refs to avoid re-initialization when they change
  const onNodesChangeRef = useRef(onNodesChange);
  const onEdgesChangeRef = useRef(onEdgesChange);
  const onUserJoinedRef = useRef(onUserJoined);
  const onUserLeftRef = useRef(onUserLeft);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // Update refs when callbacks or data change
  useEffect(() => {
    onNodesChangeRef.current = onNodesChange;
    onEdgesChangeRef.current = onEdgesChange;
    onUserJoinedRef.current = onUserJoined;
    onUserLeftRef.current = onUserLeft;
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [onNodesChange, onEdgesChange, onUserJoined, onUserLeft, nodes, edges]);

  // Flag to prevent sync loops
  const isLocalChangeRef = useRef(false);

  // Track last synced state to prevent unnecessary updates
  const lastSyncedNodesRef = useRef<string>("");
  const lastSyncedEdgesRef = useRef<string>("");

  /**
   * Initialize Yjs document and provider
   */
  const initialize = useCallback(() => {
    // Don't initialize if not enabled
    if (!enabled) {
      return undefined;
    }

    try {
      // Get Yjs URL - return early if not configured
      const yjsUrl = getYjsUrl();
      if (!yjsUrl) {
        setState((prev) => ({
          ...prev,
          error: "Yjs URL not configured",
          isConnected: false,
        }));
        return;
      }

      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Get shared types
      const yNodes = ydoc.getArray<Node>("nodes");
      const yEdges = ydoc.getArray<Edge>("edges");

      // Create WebSocket provider
      const provider = new WebsocketProvider(
        yjsUrl,
        `diagram-${diagramId}`,
        ydoc,
        {
          connect: true,
        },
      );
      providerRef.current = provider;

      // Set local user awareness state (for presence and cursors)
      provider.awareness.setLocalState({
        user: {
          id: userId,
          name: userName,
          email: userEmail,
          pictureUrl: userPictureUrl,
          avatarKey: userAvatarKey,
        },
        cursor: null,
      });

      // Connection status handlers
      provider.on("status", ({ status }: { status: string }) => {
        setState((prev) => ({
          ...prev,
          isConnected: status === "connected",
          error: status === "disconnected" ? "Disconnected from server" : null,
        }));
      });

      provider.on("sync", (isSynced: boolean) => {
        setState((prev) => ({
          ...prev,
          isSynced,
        }));

        // Initial sync: push local state to Yjs (only for first client or empty state)
        if (isSynced && yNodes.length === 0 && yEdges.length === 0) {
          isLocalChangeRef.current = true;
          const seed = getSeedRef.current?.() ?? {
            nodes: nodesRef.current,
            edges: edgesRef.current,
          };
          ydoc.transact(() => {
            // Only push if we have local data
            if (seed.nodes.length > 0) {
              yNodes.push(seed.nodes);
            }
            if (seed.edges.length > 0) {
              yEdges.push(seed.edges);
            }
          });

          // Update hash refs to prevent re-sync
          lastSyncedNodesRef.current = getCanvasNodesRevision(seed.nodes);
          lastSyncedEdgesRef.current = getCanvasEdgesRevision(seed.edges);

          isLocalChangeRef.current = false;
        } else if (isSynced && (yNodes.length > 0 || yEdges.length > 0)) {
          // If Yjs already has data, pull it (another user already has state)
          isLocalChangeRef.current = true;

          const remoteNodes = yNodes.toArray();
          const remoteEdges = yEdges.toArray();

          // Deduplicate remote data before applying
          const uniqueNodes = remoteNodes.reduce((acc: Node[], node: Node) => {
            if (!acc.some((n: Node) => n.id === node.id)) {
              acc.push(node);
            }
            return acc;
          }, []);

          const uniqueEdges = remoteEdges.reduce((acc: Edge[], edge: Edge) => {
            if (!acc.some((e: Edge) => e.id === edge.id)) {
              acc.push(edge);
            }
            return acc;
          }, []);

          // Update local state with remote data
          onNodesChangeRef.current(uniqueNodes);
          onEdgesChangeRef.current(uniqueEdges);

          // Update hash refs
          lastSyncedNodesRef.current = getCanvasNodesRevision(uniqueNodes);
          lastSyncedEdgesRef.current = getCanvasEdgesRevision(uniqueEdges);

          isLocalChangeRef.current = false;
        }
      });

      // Update collaborators, cursors, and count from awareness
      provider.awareness.on(
        "change",
        (changes: {
          added: number[];
          updated: number[];
          removed: number[];
        }) => {
          const states = provider.awareness.getStates();
          const localClientId = provider.awareness.clientID;

          // Track collaborators
          const collaboratorsList: CollaboratorUser[] = [];
          const cursorsList: CollaboratorCursor[] = [];

          states.forEach(
            (
              state: {
                user?: CollaboratorUser;
                cursor?: { x: number; y: number };
              },
              clientId: number,
            ) => {
              // Skip self
              if (clientId === localClientId) return;

              const user = state.user as CollaboratorUser;
              if (user) {
                collaboratorsList.push(user);

                // Track cursor if present
                if (state.cursor) {
                  cursorsList.push({
                    userId: user.id,
                    user,
                    position: state.cursor,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            },
          );

          setCollaborators(collaboratorsList);
          setCursors(cursorsList);
          collaboratorsRef.current = collaboratorsList;
          setState((prev) => ({
            ...prev,
            collaboratorCount: collaboratorsList.length,
          }));

          // Handle user joined events
          changes.added.forEach((clientId) => {
            if (clientId === localClientId) return;
            const state = states.get(clientId) as
              | { user?: CollaboratorUser; cursor?: { x: number; y: number } }
              | undefined;
            if (state?.user) {
              onUserJoinedRef.current?.(state.user);
            }
          });

          // Handle user left events
          changes.removed.forEach((clientId) => {
            if (clientId === localClientId) return;
            // Find which user left by comparing with previous collaborators
            const leftUser = collaboratorsRef.current.find((c) => {
              return !collaboratorsList.some((nc) => nc.id === c.id);
            });
            if (leftUser) {
              onUserLeftRef.current?.(leftUser);
            }
          });
        },
      );

      // Observe Yjs changes and update React Flow state
      // Use debouncing to prevent rapid updates causing duplicates
      let nodesUpdateTimeout: NodeJS.Timeout | null = null;
      let edgesUpdateTimeout: NodeJS.Timeout | null = null;

      const nodesObserver = () => {
        if (isLocalChangeRef.current) return;

        // Debounce updates to prevent rapid re-renders
        if (nodesUpdateTimeout) clearTimeout(nodesUpdateTimeout);
        nodesUpdateTimeout = setTimeout(() => {
          const updatedNodes = yNodes.toArray();

          // Deduplicate nodes by ID (critical for preventing React key warnings)
          const uniqueNodes = updatedNodes.reduce((acc: Node[], node: Node) => {
            if (!acc.some((n: Node) => n.id === node.id)) {
              acc.push(node);
            }
            return acc;
          }, []);

          const updatedNodesHash = getCanvasNodesRevision(uniqueNodes);

          // Only update if different from last synced state
          if (updatedNodesHash !== lastSyncedNodesRef.current) {
            lastSyncedNodesRef.current = updatedNodesHash;
            onNodesChangeRef.current(uniqueNodes);
          }
        }, 50); // 50ms debounce
      };

      const edgesObserver = () => {
        if (isLocalChangeRef.current) return;

        // Debounce updates to prevent rapid re-renders
        if (edgesUpdateTimeout) clearTimeout(edgesUpdateTimeout);
        edgesUpdateTimeout = setTimeout(() => {
          const updatedEdges = yEdges.toArray();

          // Deduplicate edges by ID (critical for preventing React key warnings)
          const uniqueEdges = updatedEdges.reduce((acc: Edge[], edge: Edge) => {
            if (!acc.some((e: Edge) => e.id === edge.id)) {
              acc.push(edge);
            }
            return acc;
          }, []);

          const updatedEdgesHash = getCanvasEdgesRevision(uniqueEdges);

          // Only update if different from last synced state
          if (updatedEdgesHash !== lastSyncedEdgesRef.current) {
            lastSyncedEdgesRef.current = updatedEdgesHash;
            onEdgesChangeRef.current(uniqueEdges);
          }
        }, 50); // 50ms debounce
      };

      yNodes.observe(nodesObserver);
      yEdges.observe(edgesObserver);

      // Cleanup observers on unmount
      return () => {
        if (nodesUpdateTimeout) clearTimeout(nodesUpdateTimeout);
        if (edgesUpdateTimeout) clearTimeout(edgesUpdateTimeout);
        yNodes.unobserve(nodesObserver);
        yEdges.unobserve(edgesObserver);
        provider.destroy();
        ydoc.destroy();
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize collaboration",
      }));
      console.error("Yjs initialization error:", error);
      return undefined;
    }
    // Only re-initialize if diagramId, user info, or enabled changes
    // NOT when nodes/edges change - that's handled by the sync effect below
  }, [diagramId, userId, userName, userEmail, userPictureUrl, userAvatarKey, enabled]); // Removed: nodes, edges, onNodesChange, onEdgesChange, onUserJoined, onUserLeft

  /**
   * Sync local changes to Yjs with smart delta updates
   * Only syncs when there are actual changes to prevent loops
   * Debounced to prevent rapid successive syncs
   */
  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc || !state.isSynced) return;

    const yNodes = ydoc.getArray<Node>("nodes");
    const yEdges = ydoc.getArray<Edge>("edges");

    // Serialize current state for comparison
    const currentNodesHash = getCanvasNodesRevision(nodes);
    const currentEdgesHash = getCanvasEdgesRevision(edges);

    // Skip sync if nothing changed (prevent infinite loops)
    if (
      currentNodesHash === lastSyncedNodesRef.current &&
      currentEdgesHash === lastSyncedEdgesRef.current
    ) {
      return;
    }

    // Debounce the sync to prevent rapid successive calls
    const syncTimeout = setTimeout(() => {
      // Update Yjs with complete replacement (prevents duplicates)
      isLocalChangeRef.current = true;

      ydoc.transact(() => {
        // Complete replacement strategy to prevent any duplicates
        // This is more efficient than delta updates for preventing duplication issues

        // Clear existing nodes
        if (yNodes.length > 0) {
          yNodes.delete(0, yNodes.length);
        }

        // Add all current nodes
        if (nodes.length > 0) {
          yNodes.push(nodes);
        }

        // Clear existing edges
        if (yEdges.length > 0) {
          yEdges.delete(0, yEdges.length);
        }

        // Add all current edges
        if (edges.length > 0) {
          yEdges.push(edges);
        }
      });

      // Update last synced state
      lastSyncedNodesRef.current = currentNodesHash;
      lastSyncedEdgesRef.current = currentEdgesHash;

      isLocalChangeRef.current = false;
    }, 100); // 100ms debounce - prevents rapid syncs

    return () => clearTimeout(syncTimeout);
  }, [nodes, edges, state.isSynced]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  /**
   * Disconnect from collaboration
   */
  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect();
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isSynced: false,
      }));
    }
  }, []);

  /**
   * Reconnect to collaboration
   */
  const reconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.connect();
    } else {
      initialize();
    }
  }, [initialize]);

  /**
   * Send cursor position to other collaborators
   */
  const sendCursorPosition = useCallback(
    (position: { x: number; y: number }) => {
      const provider = providerRef.current;
      if (!provider || !state.isConnected) return;

      // Update awareness with cursor position
      const currentState = provider.awareness.getLocalState();
      provider.awareness.setLocalState({
        ...currentState,
        cursor: position,
      });
    },
    [state.isConnected],
  );

  return {
    state,
    provider: providerRef.current,
    collaborators,
    cursors,
    sendCursorPosition,
    disconnect,
    reconnect,
  };
};
