import axios from "axios";
import type { ChatRequest, ChatResponse, User } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function sendChatMessage(
  request: ChatRequest,
  idToken: string,
): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>(
    "/api/v1/chat/message",
    request,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
  return response.data;
}

export async function getMe(idToken: string): Promise<User> {
  const response = await apiClient.get<User>("/api/v1/users/me", {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.data;
}
