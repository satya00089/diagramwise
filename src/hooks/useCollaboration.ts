import { useCallback, useEffect, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useWebSocket } from "./useWebSocket";
import type { WebSocketMessage } from "./useWebSocket";

interface CollaboratorUser {
  id: string;
  name: string;
  email: string;
  pictureUrl?: string;
  avatarKey?: string | null;
}

interface CollaboratorCursor {
  userId: string;
  user: CollaboratorUser;
  position: { x: number; y: number };
  timestamp: string;
}

interface DiagramUpdateData {
  nodes?: Node[];
  edges?: Edge[];
  title?: string;
}

interface UseCollaborationOptions {
  diagramId: string;
  enabled: boolean;
  onDiagramUpdate?: (data: DiagramUpdateData, userId: string) => void;
  onUserJoined?: (user: CollaboratorUser) => void;
  onUserLeft?: (user: CollaboratorUser) => void;
  onError?: (error: string) => void;
}

interface UseCollaborationReturn {
  sendDiagramUpdate: (data: DiagramUpdateData) => void;
  sendCursorPosition: (position: { x: number; y: number }) => void;
  collaborators: CollaboratorUser[];
  cursors: CollaboratorCursor[];
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  disconnect: () => void;
}

// Convert HTTP/HTTPS URL to WS/WSS appropriately
const getWebSocketUrl = (apiUrl: string): string => {
  if (!apiUrl) return "ws://localhost:8000";

  // Replace https:// with wss:// and http:// with ws://
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://");
  } else if (apiUrl.startsWith("http://")) {
    return apiUrl.replace("http://", "ws://");
  }

  // If no protocol, default to ws://
  return `ws://${apiUrl}`;
};

const WS_BASE_URL = getWebSocketUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_ASSESSMENT_API_URL || "",
);

export const useCollaboration = ({
  diagramId,
  enabled,
  onDiagramUpdate,
  onUserJoined,
  onUserLeft,
  onError,
}: UseCollaborationOptions): UseCollaborationReturn => {
  const [collaborators, setCollaborators] = useState<CollaboratorUser[]>([]);
  const [cursors, setCursors] = useState<CollaboratorCursor[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // The browser sends the HttpOnly session cookie during the WebSocket upgrade.
  const wsUrl = `${WS_BASE_URL}/api/v1/diagrams/${encodeURIComponent(diagramId)}/collaborate`;

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      const messageType = message.type?.trim();

      switch (messageType) {
        case "welcome": {
          const user = message.user as CollaboratorUser;
          currentUserIdRef.current = user.id;
          break;
        }

        case "user_joined": {
          const user = message.user as CollaboratorUser;
          setCollaborators((prev) => {
            // Don't add if already exists
            if (prev.some((c) => c.id === user.id)) return prev;
            return [...prev, user];
          });
          onUserJoined?.(user);
          break;
        }

        case "user_left": {
          const user = message.user as CollaboratorUser;
          setCollaborators((prev) => prev.filter((c) => c.id !== user.id));
          setCursors((prev) => prev.filter((c) => c.userId !== user.id));
          onUserLeft?.(user);
          break;
        }

        case "diagram_update": {
          const user = message.user as CollaboratorUser;
          const data = message.data as DiagramUpdateData;

          // Ignore updates if we haven't received welcome yet
          if (!currentUserIdRef.current) {
            return;
          }

          // Ignore our own updates
          if (user.id === currentUserIdRef.current) {
            return;
          }

          // Prevent rapid updates
          const now = Date.now();
          if (now - lastUpdateRef.current < 100) {
            return;
          }
          lastUpdateRef.current = now;

          onDiagramUpdate?.(data, user.id);
          break;
        }

        case "cursor_move":
        case "cursor_update": {
          // cursor_update is legacy support, both use same logic
          const user = message.user as CollaboratorUser;
          const position = message.position as { x: number; y: number };
          const timestamp = message.timestamp as string;

          // Ignore our own cursor
          if (user.id === currentUserIdRef.current) {
            return;
          }

          setCursors((prev) => {
            const existing = prev.findIndex((c) => c.userId === user.id);
            const newCursor: CollaboratorCursor = {
              userId: user.id,
              user,
              position,
              timestamp,
            };

            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newCursor;
              return updated;
            }
            return [...prev, newCursor];
          });
          break;
        }

        case "pong": {
          // Heartbeat response
          break;
        }

        case "error": {
          const errorMessage = (message.message as string) || "Unknown error";
          console.error("WebSocket error:", errorMessage);
          onError?.(errorMessage);
          break;
        }

        default:
          console.warn("Unknown WebSocket message type:", messageType);
      }
    },
    [onDiagramUpdate, onUserJoined, onUserLeft, onError],
  );

  const handleClose = useCallback(() => {
    setCollaborators([]);
    setCursors([]);
  }, []);

  const handleError = useCallback(
    (error: Event) => {
      console.error("Collaboration WebSocket error:", error);
      onError?.("Connection error. Retrying...");
    },
    [onError],
  );

  const {
    sendMessage,
    disconnect,
    isConnected,
    isConnecting,
    reconnectAttempts,
  } = useWebSocket({
    url: wsUrl,
    enabled, // Pass the enabled flag to prevent connection when not authenticated
    onMessage: handleMessage,
    onClose: handleClose,
    onError: handleError,
    reconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
  });

  const sendDiagramUpdate = useCallback(
    (data: DiagramUpdateData) => {
      if (!enabled || !isConnected) return;

      // Debounce updates to prevent flooding
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }

      updateDebounceRef.current = setTimeout(() => {
        sendMessage({
          type: "diagram_update",
          data,
          timestamp: new Date().toISOString(),
        });
      }, 300); // 300ms debounce
    },
    [enabled, isConnected, sendMessage],
  );

  const sendCursorPosition = useCallback(
    (position: { x: number; y: number }) => {
      if (!enabled || !isConnected) return;

      sendMessage({
        type: "cursor_move",
        position,
        timestamp: new Date().toISOString(),
      });
    },
    [enabled, isConnected, sendMessage],
  );

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
    };
  }, []);

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected || !enabled) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: "ping", timestamp: new Date().toISOString() });
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, enabled, sendMessage]);

  return {
    sendDiagramUpdate,
    sendCursorPosition,
    collaborators,
    cursors,
    isConnected,
    isConnecting,
    reconnectAttempts,
    disconnect,
  };
};
