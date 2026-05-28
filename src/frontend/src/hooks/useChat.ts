"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { sendChatMessage } from "@/lib/api";
import type { Message } from "@/types";

type ChatState = {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
};

export function useChat() {
  const { data: session } = useSession();
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });

  const sendMessage = useCallback(
    async (inputText: string) => {
      if (!inputText.trim() || !session?.id_token) return;

      const userMessage: Message = {
        role: "user",
        content: inputText.trim(),
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        error: null,
      }));

      try {
        const history = state.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendChatMessage(
          { message: inputText.trim(), history },
          session.id_token,
        );

        const assistantMessage: Message = {
          role: "assistant",
          content: response.reply,
          created_at: response.created_at,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
        }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "送信に失敗しました";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    },
    [session, state.messages],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearError,
  };
}
