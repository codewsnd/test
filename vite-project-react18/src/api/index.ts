import axios from "@/api/axios";

const CORE_API_URL = import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000';

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
  timestamp: string;
  characterCount: number;
}

export const aiChat = async (request: AiChatRequest): Promise<ApiResponse<AiChatResponse>> => {
  // 调用 API
  const response = await axios.post<ApiResponse<AiChatResponse>>(`${CORE_API_URL}/chat/completions`, request);
  return response;
}
