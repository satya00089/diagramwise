import React, { createContext, useState, useCallback, useMemo } from "react";
import type {
  ChatBotState,
  ChatBotContextType,
  UserIntent,
  CanvasContext,
  ChatMessage,
} from "../types/chatBot";

const initialState: ChatBotState = {
  isOpen: false,
  showWelcome: true,
  userIntent: null,
  canvasContext: null,
  messages: [],
  currentSuggestions: [],
};

// eslint-disable-next-line react-refresh/only-export-components
export const ChatBotContext = createContext<ChatBotContextType | undefined>(
  undefined,
);

export const ChatBotProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<ChatBotState>(initialState);

  const toggleChatBot = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const setUserIntent = useCallback((intent: UserIntent) => {
    setState((prev) => ({
      ...prev,
      userIntent: intent,
      showWelcome: false,
    }));
  }, []);

  const updateCanvasContext = useCallback((context: CanvasContext) => {
    setState((prev) => ({ ...prev, canvasContext: context }));
  }, []);

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: `msg-${Date.now()}-${crypto.randomUUID()}`,
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }));
    },
    [],
  );

  const dismissWelcome = useCallback(() => {
    setState((prev) => ({ ...prev, showWelcome: false }));
  }, []);

  const resetChatBot = useCallback(() => {
    setState(initialState);
  }, []);

  const value: ChatBotContextType = useMemo(
    () => ({
      ...state,
      toggleChatBot,
      setUserIntent,
      updateCanvasContext,
      addMessage,
      dismissWelcome,
      resetChatBot,
    }),
    [
      state,
      toggleChatBot,
      setUserIntent,
      updateCanvasContext,
      addMessage,
      dismissWelcome,
      resetChatBot,
    ],
  );

  return (
    <ChatBotContext.Provider value={value}>{children}</ChatBotContext.Provider>
  );
};
