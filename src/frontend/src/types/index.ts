export type Message = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type User = {
  email: string;
  name: string;
  picture?: string;
};

export type ChatRequest = {
  message: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type ChatResponse = {
  reply: string;
  created_at: string;
};
