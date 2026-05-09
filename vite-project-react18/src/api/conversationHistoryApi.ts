import type {ConversationState, ConversationTurn} from "../pages/home/components/chat/types";
import {message} from "antd";
import {ApiRetryUtil} from "./retryUtils";

const SPRINGBOOT3_BACKEND_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';

// 分页响应类型（Spring Data Page）
export interface SpringDataPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}


// 会话历史记录类型
export type ConversationHistory = {
  id: string;
  title: string;
  conversationState?: ConversationState;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  pinnedAt?: string; // 置顶时间，用于排序
  staffId?: string;
  titleGenerating?: boolean; // 标题是否正在生成中
  isUpdating?: boolean; // 前端本地状态：是否正在持久化
  isCreating?: boolean; // 前端本地状态：是否已经成功创建到后端
};

export type ConversationStatePatch = {
  turns?: [ConversationTurn];
};

// 分页获取会话（页码从0开始，与后端保持一致）
export const pageConversationsApi = async (
  page: number = 0,
  size: number = 10,
  search?: string
): Promise<SpringDataPage<ConversationHistory>> => {
  // 前端和后端都使用0开始的页码
  const params: Record<string, string | number> = {
    page,
    size
  };

  if (search?.trim()) {
    params.search = search.trim();
  }

  try {
    return await ApiRetryUtil.get<SpringDataPage<ConversationHistory>>(
      `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories`,
      {params}
    );
  } catch (error) {
    message.error('Failed to fetch conversations page');
    console.error('Error fetching conversations page:', error);
    throw error;
  }
};

// 创建会话；后续更新请使用 saveConversationStateApi / renameConversationApi 做增量更新
export const createConversationApi = async (conversation: ConversationHistory): Promise<ConversationHistory> => {
  try {
    return await ApiRetryUtil.post<ConversationHistory>(
      `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories`,
      conversation
    );
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

export const saveConversationStateApi = async (
  id: string,
  conversationState: ConversationState
): Promise<ConversationHistory> => {
  try {
    return await ApiRetryUtil.post<ConversationHistory>(
      `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/state/${id}`,
      {conversationState}
    );
  } catch (error) {
    console.error('Error saving conversation state:', error);
    throw error;
  }
};

export const getConversationDetailApi = async (id: string): Promise<ConversationHistory> => {
  return await ApiRetryUtil.get<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/${id}`
  );
};

// 重命名会话
export const renameConversationApi = async (id: string, title: string): Promise<ConversationHistory> => {
  return await ApiRetryUtil.put<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/${id}/rename`,
    {title}
  );
};

// 批量删除会话
export const batchDeleteConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.delete<void>(`${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch`, {
    data: conversationIds
  });
};

// 批量置顶会话
export const batchPinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.put<void>(`${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch/pin`, conversationIds);
};

// 批量取消置顶会话
export const batchUnpinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.put<void>(`${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch/unpin`, conversationIds);
};
