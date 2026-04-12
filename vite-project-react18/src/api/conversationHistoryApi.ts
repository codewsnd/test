import axios from './axios';
import type { ConversationState } from "../pages/home/components/chat/types";
import { getEmployeeId } from '@/utils/userUtils';

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
  staffId: string;
  titleGenerating?: boolean; // 标题是否正在生成中
};


// 分页获取会话（页码从0开始，与后端保持一致）
export const pageConversationsApi = async (
  staffId: string,
  page: number = 0,
  size: number = 10,
  search?: string
): Promise<SpringDataPage<ConversationHistory>> => {
  try {
    // 前端和后端都使用0开始的页码
    const params: any = {
      staffId,
      page,
      size
    };

    if (search && search.trim()) {
      params.search = search.trim();
    }

    return await axios.get('/conversations/histories/page', {
      params
    });
  } catch (error) {
    console.error('Error fetching conversations page:', error);
    throw error;
  }
};

// 保存会话 (如果存在则更新，否则创建)
export const saveConversationApi = async (conversation: ConversationHistory): Promise<ConversationHistory> => {
  try {
    return await axios.post('/conversations/histories', conversation);
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

export const getConversationDetailApi = async (id: string): Promise<ConversationHistory> => {
  return await axios.get(`/conversations/histories/${id}`, {
    params: { staffId: getEmployeeId() }
  });
};

// 重命名会话
export const renameConversationApi = async (id: string, title: string): Promise<ConversationHistory | null> => {
  try {
    return await axios.put(`/conversations/histories/${id}/rename`, {title});
  } catch (error: any) {
    throw error;
  }
};

// 删除会话 (使用批量API)
export const deleteConversationApi = async (id: string): Promise<void> => {
  await batchDeleteConversationsApi([id]);
};

// 批量删除会话
export const batchDeleteConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await axios.delete('/conversations/histories/batch', {
    data: conversationIds
  });
};

// 批量置顶会话
export const batchPinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await axios.put('/conversations/histories/batch/pin', conversationIds);
};

// 批量取消置顶会话
export const batchUnpinConversationsApi = async (conversationIds: string[]): Promise<void> => {
  await axios.put('/conversations/histories/batch/unpin', conversationIds);
};

// IndexedDB 迁移相关类型
interface IndexedDbConversation {
  id: string;
  title: string;
  conversationState?: any;
  isPinned?: boolean;
  createdAt?: number;
  updatedAt?: number;
  pinnedAt?: number;
  userId?: string;
  staffId?: string;
  titleGenerating?: boolean;
}

interface MigrationRequest {
  conversations: IndexedDbConversation[];
}

// 迁移 IndexedDB 数据到后端
export const migrateFromIndexedDbApi = async (conversations: IndexedDbConversation[], staffId: string): Promise<string> => {
  const request: MigrationRequest = { conversations };
  return await axios.post('/conversations/histories/migrate', request, {
    params: {staffId}
  });
};
