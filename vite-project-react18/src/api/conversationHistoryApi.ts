import type {ConversationState} from "../pages/home/components/chat/types";
import {ApiRetryUtil} from "./retryUtils";
import type {Page} from "./types";

const SPRINGBOOT3_BACKEND_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8082';

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

// 分页获取会话（请求参数页码从1开始）
export const pageConversationsApi = async (
  page: number = 1,
  size: number = 50,
  search?: string
): Promise<Page<ConversationHistory>> => {
  const params: Record<string, string | number> = {
    page: Math.max(1, page),
    size
  };

  if (search?.trim()) {
    params.search = search.trim();
  }

  return await ApiRetryUtil.get<Page<ConversationHistory>>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories`,
    {params},
    'Failed to fetch conversations page. Please refresh the page.'
  );
};

// 创建会话
export const createConversationApi = async (conversation: ConversationHistory): Promise<ConversationHistory> => {
  return await ApiRetryUtil.post<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories`,
    conversation,
    undefined,
    'Failed to create conversation. Please try again.'
  );
};

export const saveConversationStateApi = async (
  id: string,
  conversationState: ConversationState
): Promise<ConversationHistory> => {
  return await ApiRetryUtil.post<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/state/${id}`,
    {conversationState},
    undefined,
    'Failed to save conversation state. Please try again.'
  );
};

export const getConversationDetailApi = async (id: string): Promise<ConversationHistory> => {
  return await ApiRetryUtil.get<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/${id}`,
    undefined,
    'Failed to fetch conversation detail. Please try again.'
  );
};

// 重命名会话
export const renameConversationApi = async (id: string, title: string): Promise<ConversationHistory> => {
  return await ApiRetryUtil.put<ConversationHistory>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/${id}/rename`,
    {title},
    undefined,
    'Failed to rename conversation. Please try again.'
  );
};

// 批量删除会话
export const batchDeleteConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.delete<void>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch`,
    {data: conversationIds},
    'Failed to delete conversations. Please try again.'
  );
};

// 批量置顶会话
export const batchPinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.put<void>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch/pin`,
    conversationIds,
    undefined,
    'Failed to pin conversations. Please try again.'
  );
};

// 批量取消置顶会话
export const batchUnpinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await ApiRetryUtil.put<void>(
    `${SPRINGBOOT3_BACKEND_API_URL}/conversations/histories/batch/unpin`,
    conversationIds,
    undefined,
    'Failed to unpin conversations. Please try again.'
  );
};
