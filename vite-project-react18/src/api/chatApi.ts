/**
 * 聊天 API 服务
 * 提供与 core ADK 聊天接口的交互功能
 */
import { fetchEventSource } from '@microsoft/fetch-event-source';

/**
 * 消息接口定义（与后端对应）
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 聊天请求参数（与后端 AiChatRequest 对应）
 */
export interface ChatStreamRequest {
  conversationId?: string;
  requestId?: string;
  agentId?: string;
  modelName?: string;
  skillIds?: string[];
  userId?: string;
  documents?: any[];
  messages: ChatMessage[];
}

export interface SessionStreamEvent {
  sessionId?: string;
  requestId?: string;
  conversationId?: string;
  modelName?: string;
  startedAt?: string;
  resumed?: boolean;
}

export interface StatusStreamEvent {
  stage?: string;
  state?: 'waiting' | 'processing' | 'completed' | 'error';
  label?: string;
  detail?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface ToolCallStreamEvent {
  toolName?: string;
  toolCallId?: string;
  params?: string;
  toolname?: string;
  timestamp?: string;
}

export interface ToolResultStreamEvent {
  toolName?: string;
  toolCallId?: string;
  result?: string;
  'tool-result'?: string;
  timestamp?: string;
}

export interface DoneStreamEvent {
  done?: boolean;
  sessionId?: string;
  requestId?: string;
  conversationId?: string;
  chunkCount?: number;
  characterCount?: number;
  completedAt?: string;
}

/**
 * 流式响应回调函数类型
 */
export interface StreamCallbacks {
  onMessage: (content: string) => void; // 接收到新的内容片段
  onComplete: () => void; // 流式传输完成
  onError: (error: Error) => void; // 发生错误
  onSession?: (event: SessionStreamEvent) => void;
  onStatus?: (event: StatusStreamEvent) => void;
  onToolCall?: (event: ToolCallStreamEvent) => void;
  onToolResult?: (event: ToolResultStreamEvent) => void;
  onDone?: (event: DoneStreamEvent) => void;
}

/**
 * 调用流式聊天接口
 * 使用 SSE (Server-Sent Events) 实现打字机效果
 *
 * @param request 聊天请求参数
 * @param callbacks 回调函数
 * @returns AbortController 用于取消请求
 */
export const chatStream = (
  request: ChatStreamRequest,
  callbacks: StreamCallbacks
): AbortController => {
  const controller = new AbortController();
  const baseURL = import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000';

  // 使用 fetchEventSource 处理 SSE 流
  fetchEventSource(`${baseURL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'uid': '123456', // 与 axios 拦截器保持一致
    },
    body: JSON.stringify(request),
    signal: controller.signal,

    /**
     * 处理接收到的消息
     */
    onmessage(event) {
      try {
        if (!event.data) {
          return;
        }

        const parsed = JSON.parse(event.data);

        switch (event.event) {
          case 'session':
            callbacks.onSession?.(parsed as SessionStreamEvent);
            return;

          case 'status':
            callbacks.onStatus?.(parsed as StatusStreamEvent);
            return;

          case 'tool-call':
            callbacks.onToolCall?.(parsed as ToolCallStreamEvent);
            return;

          case 'tool-result':
            callbacks.onToolResult?.(parsed as ToolResultStreamEvent);
            return;

          case 'done':
            callbacks.onDone?.(parsed as DoneStreamEvent);
            return;

          case 'error-message':
            callbacks.onError(new Error((parsed as { error?: string }).error || 'SSE error'));
            return;

          default:
            break;
        }

        let content = '';

        if (parsed.output && parsed.output.text !== null && parsed.output.text !== undefined) {
          content = parsed.output.text;
        } else if (parsed.delta && parsed.delta !== null && parsed.delta !== undefined) {
          content = parsed.delta;
        } else if (parsed.content && parsed.content !== null && parsed.content !== undefined) {
          content = parsed.content;
        } else if (typeof parsed === 'string') {
          content = parsed;
        }

        const shouldIgnore =
          !content ||
          content === 'null' ||
          content === 'undefined' ||
          content === 'Stream finished';

        if (!shouldIgnore && typeof content === 'string') {
          callbacks.onMessage(content);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    },

    /**
     * 连接打开时触发
     */
    async onopen(response) {
      if (response.ok) {
        console.log('SSE connection opened');
      } else {
        throw new Error(`Failed to open SSE connection: ${response.status}`);
      }
    },

    /**
     * 发生错误时触发
     */
    onerror(error) {
      console.error('SSE error:', error);
      callbacks.onError(error as Error);
      throw error; // 停止重连
    },

    /**
     * 连接关闭时触发
     */
    onclose() {
      console.log('SSE connection closed');
      callbacks.onComplete();
    },
  }).catch((error) => {
    // 捕获 fetchEventSource 抛出的错误
    if (error.name !== 'AbortError') {
      console.error('Stream error:', error);
      callbacks.onError(error);
    }
  });

  return controller;
};
