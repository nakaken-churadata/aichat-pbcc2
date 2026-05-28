import type { Metadata } from "next";
import { ChatContainer } from "@/components/chat/ChatContainer";

export const metadata: Metadata = {
  title: "チャット | 社内 AI チャット",
};

export default function ChatPage() {
  return <ChatContainer />;
}
