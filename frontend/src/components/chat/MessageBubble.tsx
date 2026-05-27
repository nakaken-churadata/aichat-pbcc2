import type { Message } from "@/types";

type Props = {
  message: Message;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      role="listitem"
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.created_at && (
          <time
            className={`mt-1 block text-right text-xs opacity-70`}
            dateTime={message.created_at}
          >
            {new Date(message.created_at).toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </div>
  );
}
