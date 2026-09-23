import { useEffect, useRef, useCallback, useState } from "react";

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean; // Add enabled flag to conditionally connect
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  sendMessage: (message: WebSocketMessage) => void;
  disconnect: () => void;
  connect: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
}

export const useWebSocket = ({
  url,
  enabled = true, // Default to true for backwards compatibility
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 1000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const shouldReconnectRef = useRef<boolean>(true);
  const attemptReconnectRef = useRef<(() => void) | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
  }, [cleanup]);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      setIsConnecting(true);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onClose?.();

        if (
          shouldReconnectRef.current &&
          reconnect &&
          attemptReconnectRef.current
        ) {
          attemptReconnectRef.current();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        onError?.(error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnecting(false);

      if (
        shouldReconnectRef.current &&
        reconnect &&
        attemptReconnectRef.current
      ) {
        attemptReconnectRef.current();
      }
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect]);

  const attemptReconnect = useCallback(() => {
    if (!reconnect || !shouldReconnectRef.current) return;

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      setIsConnecting(false);
      return;
    }

    cleanup();

    const backoffDelay =
      reconnectInterval * Math.pow(2, reconnectAttemptsRef.current);
    const jitter = crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff * 1000; // Add jitter to prevent thundering herd
    const delay = Math.min(backoffDelay + jitter, 30000); // Cap at 30 seconds

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      setReconnectAttempts(reconnectAttemptsRef.current);
      connect();
    }, delay);
  }, [reconnect, reconnectInterval, maxReconnectAttempts, cleanup, connect]);

  // Store the attemptReconnect function in the ref so connect can use it
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
      }
    } else {
      console.warn("WebSocket is not connected. Message not sent:", message);
    }
  }, []);

  useEffect(() => {
    // Only connect if enabled
    if (!enabled) {
      return;
    }

    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      disconnect();
    };
  }, [connect, disconnect, enabled]);

  return {
    sendMessage,
    disconnect,
    connect,
    isConnected,
    isConnecting,
    reconnectAttempts,
  };
};
