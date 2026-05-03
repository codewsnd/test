import { springboot3BackendApi } from "@/api/axios";

export interface AiChatRequest {
  requestId?: string;
  agentId?: string;
  modelName?: string;
  documents?: Array<{
    content?: string;
    base64url?: string[];
    type?: string;
    extension?: string;
    id?: string;
    name?: string;
  }>;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

export interface  AiChatResponse {
  content: string;
  modelName: string;
  agentName?: string;
  timestamp: string;
  characterCount: number;
}

export const aiChat = async (request: AiChatRequest): Promise<ApiResponse<AiChatResponse>> => {
  // 调用 API
  return await springboot3BackendApi.post('/chat/completions', request);
}
