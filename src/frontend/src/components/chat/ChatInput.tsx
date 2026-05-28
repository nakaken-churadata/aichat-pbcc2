"use client";

import { useState, type KeyboardEvent, type FormEvent } from "react";

type Props = {
  onSend: (text: string) => void;
  isLoading: boolean;
};

export function ChatInput({ onSend, isLoading }: Props) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSend(inputText);
    setInputText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!inputText.trim() || isLoading) return;
      onSend(inputText);
      setInputText("");
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-4xl items-end gap-3"
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力（Enter で送信、Shift+Enter で改行）"
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
          style={{
            minHeight: "48px",
            maxHeight: "200px",
          }}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="送信"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-600">
        社内限定 AI チャット | @churadata.okinawa アカウント専用
      </p>
    </div>
  );
}
