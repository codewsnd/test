/**
 * 聊天 API 服务
 * 提供与后端 DeepSeek 聊天接口的交互功能
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
  requestId?: string;
  agentId?: string;
  modelName?: string;
  documents?: any[];
  messages: ChatMessage[];
}

/**
 * 流式响应回调函数类型
 */
export interface StreamCallbacks {
  onMessage: (content: string) => void; // 接收到新的内容片段
  onComplete: () => void; // 流式传输完成
  onError: (error: Error) => void; // 发生错误
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
  // const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const baseURL = 'http://localhost:8081';

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
        // SSE 的 data 字段包含服务器发送的内容
        if (event.data) {
          let content = '';

          // 尝试解析 JSON（如果后端返回的是 JSON 格式）
          try {
            const parsed = JSON.parse(event.data);

            // 根据后端返回的数据结构提取文本内容
            // 数据结构: {"output":{"text":"..."},"metadata":{...}}
            if (parsed.output && parsed.output.text !== null && parsed.output.text !== undefined) {
              content = parsed.output.text;
            } else if (parsed.content && parsed.content !== null && parsed.content !== undefined) {
              content = parsed.content;
            } else if (parsed.data && parsed.data !== null && parsed.data !== undefined) {
              content = parsed.data;
            } else if (typeof parsed === 'string') {
              content = parsed;
            }
            // 如果 parsed 是对象但没有找到文本字段，就不赋值（保持 content 为空字符串）
          } catch {
            // 如果不是 JSON，直接使用原始数据（但要过滤特殊标记）
            content = event.data;
          }

          // 过滤掉不应该显示的特殊标记
          const shouldIgnore =
            !content ||
            content === 'null' ||
            content === 'undefined' ||
            content === 'Stream finished' ||
            content.trim() === '';

          // 只有当 content 是有效文本时才调用回调
          if (!shouldIgnore && typeof content === 'string') {
            callbacks.onMessage(content);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    },

    /**
     * 连接打开时触发
     */
    onopen(response) {
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
