import { atom } from 'jotai';
import type { ConversationState } from '../chat/types';
import type {ConversationHistory} from "@/api/conversationHistoryApi";
import {
  pageConversationsApi,
  batchDeleteConversationsApi,
  batchPinConversationsApi,
  batchUnpinConversationsApi
} from "@/api/conversationHistoryApi";
import {v7} from 'uuid';
import {
  enqueueConversationHistoryPersistenceAtom,
  installConversationHistoryPersistenceGuard
} from './conversationHistoryPersistenceAtom';

// 分页大小配置
export const CONVERSATION_HISTORY_PAGE_SIZE = 50;

installConversationHistoryPersistenceGuard();

// 基础状态
export const conversationHistoriesAtom = atom<ConversationHistory[]>([]);
export const activeConversationIdAtom = atom<string | null>(null);
export const dbInitializedAtom = atom<boolean>(false);
export const searchQueryAtom = atom<string>('');
export const currentPageAtom = atom<number>(0);
export const hasMoreAtom = atom<boolean>(true);


// 创建会话历史
export const createConversationHistoryAtom = atom(
  null,
  async (_get, set, { title, initialState }: { title: string; initialState?: Partial<ConversationHistory> }) => {

    const newId = v7();

    const newConversationHistory: ConversationHistory = {
      id: newId,
      title: title.trim().substring(0, 100),
      conversationState: { turns: [] },
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      titleGenerating: true,
      ...initialState,
      isCreating: true,
      isUpdating: false
    };

    try {
      // 添加到状态并立即激活
      set(conversationHistoriesAtom, prev => [newConversationHistory, ...prev]);
      set(activeConversationIdAtom, newId);

      // 持久化到数据库
      set(enqueueConversationHistoryPersistenceAtom, {
        operation: 'create',
        conversation: newConversationHistory,
        conversationHistoriesAtom
      });

      return { conversation: newConversationHistory, id: newId };
    } catch (error) {
      // 失败时回滚
      set(conversationHistoriesAtom, prev => prev.filter(c => c.id !== newId));
      console.error('Failed to create conversation history', error);
      throw error;
    }
  }
);

// 更新会话历史
export const setConversationHistoryAtom = atom(
  null,
  async (get, set, {
    conversationHistoryId,
    updater,
    isDone = false
  }: {
    conversationHistoryId: string;
    updater: Partial<ConversationHistory> | ((convHistory: ConversationHistory) => ConversationHistory);
    isDone?: boolean;
  }) => {
    const conversations = get(conversationHistoriesAtom);
    const targetConvHistory = conversations.find(c => c.id === conversationHistoryId);

    if (!targetConvHistory) {
      console.warn(`Conversation history not found: ${conversationHistoryId}`);
      return;
    }

    const updatedConvHistory = typeof updater === 'function'
      ? updater(targetConvHistory)
      : { ...targetConvHistory, ...updater };

    const localUpdatedConvHistory = isDone
      ? { ...updatedConvHistory, isUpdating: true}
      : updatedConvHistory;

    const newConvs = conversations.map(conv =>
      conv.id === conversationHistoryId ? localUpdatedConvHistory : conv
    );

    set(conversationHistoriesAtom, newConvs);

    // 自动异步持久化到数据库，队列会保证创建完成后再执行更新
    if (isDone) {
      set(enqueueConversationHistoryPersistenceAtom, {
        operation: 'update',
        previousConversation: targetConvHistory,
        conversation: localUpdatedConvHistory,
        conversationHistoriesAtom
      });
    }
  }
);


// 数据库初始化
export const initializeDbAtom = atom(
  null,
  async (_get, set) => {
    try {
      // 重置搜索和分页状态
      set(searchQueryAtom, '');
      set(currentPageAtom, 0);
      set(hasMoreAtom, true);

      let allInitialData: ConversationHistory[] = [];

      // 只加载第一页数据用于初始化（页码从0开始）
      const result = await pageConversationsApi(0, CONVERSATION_HISTORY_PAGE_SIZE);
      allInitialData = result.content;
      set(hasMoreAtom, result.number + 1 < result.totalPages);

      // 清理所有可能残留的titleGenerating状态（页面刷新时）
      const cleanedData = allInitialData.map(conv => {
        if (conv.titleGenerating) {
          return {
            ...conv,
            titleGenerating: false
          };
        }
        return conv;
      });

      set(conversationHistoriesAtom, cleanedData);
      set(dbInitializedAtom, true);
    } catch (error) {
      console.error("Database initialization failed:", error);
      set(conversationHistoriesAtom, []);
      set(dbInitializedAtom, true);
      set(hasMoreAtom, false);
    }
  }
);

// 加载更多会话
export const loadMoreConversationsAtom = atom(
  null,
  async (get, set, {
    currentPage,
    pageSize = CONVERSATION_HISTORY_PAGE_SIZE
  }: { currentPage: number; pageSize?: number }) => {
    try {
      const searchQuery = get(searchQueryAtom);
      const result = await pageConversationsApi(currentPage, pageSize, searchQuery);

      if (result.content.length > 0) {
        set(conversationHistoriesAtom, prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newConversations = result.content.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConversations];
        });
        set(hasMoreAtom, result.number + 1 < result.totalPages);
        set(currentPageAtom, currentPage);
        return { success: true, hasMore: result.number + 1 < result.totalPages, newData: result.content };
      } else {
        set(hasMoreAtom, false);
        return { success: true, hasMore: false, newData: [] };
      }
    } catch (error) {
      console.error('Failed to load more conversations:', error);
      return { success: false, hasMore: false, newData: [] };
    }
  }
);

// 搜索会话
export const searchConversationsAtom = atom(
  null,
  async (_get, set, searchQuery: string) => {
    try {
      // 更新搜索状态
      set(searchQueryAtom, searchQuery);
      set(currentPageAtom, 0);
      set(hasMoreAtom, true);

      // 获取搜索结果
      const result = await pageConversationsApi(0, CONVERSATION_HISTORY_PAGE_SIZE, searchQuery);

      set(conversationHistoriesAtom, result.content);
      set(hasMoreAtom, result.number + 1 < result.totalPages);

      return { success: true, data: result.content, hasMore: result.number + 1 < result.totalPages };
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return { success: false, data: [], hasMore: false };
    }
  }
);

// 设置会话状态
export const setConversationStateAtom = atom(
  null,
  (_get, set,
   newState: ConversationState | ((prevState: ConversationState) => ConversationState),
   conversationHistoryId: string | null,
   isDone: boolean = false
  ) => {
    if (!conversationHistoryId) {
      console.error('conversationHistoryId is required for setConversationState');
      return;
    }

    set(setConversationHistoryAtom, {
      conversationHistoryId,
      updater: (convHistory: ConversationHistory) => {
        const currentState = convHistory.conversationState || { turns: [] };
        const updatedState = typeof newState === 'function'
          ? newState(currentState)
          : newState;

        return {
          ...convHistory,
          titleGenerating: updatedState.currentTurnId ? true : convHistory.titleGenerating,
          conversationState: updatedState
        };
      },
      isDone
    });
  }
);

// 批量删除会话
export const batchDeleteConversationsAtom = atom(
  null,
  async (get, set, conversationIds: string[]) => {
    try {
      // 从状态中删除
      set(conversationHistoriesAtom, prev =>
        prev.filter(c => !conversationIds.includes(c.id))
      );

      // 如果删除的包含当前活跃对话，清空活跃状态
      const activeId = get(activeConversationIdAtom);
      if (activeId && conversationIds.includes(activeId)) {
        set(activeConversationIdAtom, null);
      }

      // 批量删除
      await batchDeleteConversationsApi(conversationIds);
    } catch (error) {
      console.error('Failed to batch delete conversations:', error);
      throw error;
    }
  }
);

// 批量置顶会话
export const batchPinConversationsAtom = atom(
  null,
  async (_get, set, conversationIds: string[]) => {
    try {
      // 更新本地状态
      set(conversationHistoriesAtom, prev =>
        prev.map(c => conversationIds.includes(c.id)
          ? { ...c, isPinned: true, pinnedAt: new Date().toISOString() }
          : c
        )
      );

      // 批量置顶
      await batchPinConversationsApi(conversationIds);
    } catch (error) {
      console.error('Failed to batch pin conversations:', error);
      throw error;
    }
  }
);

// 批量取消置顶会话
export const batchUnpinConversationsAtom = atom(
  null,
  async (_get, set, conversationIds: string[]) => {
    try {
      // 更新本地状态
      set(conversationHistoriesAtom, prev =>
        prev.map(c => conversationIds.includes(c.id)
          ? { ...c, isPinned: false, pinnedAt: undefined }
          : c
        )
      );

      // 批量取消置顶
      await batchUnpinConversationsApi(conversationIds);
    } catch (error) {
      console.error('Failed to batch unpin conversations:', error);
      throw error;
    }
  }
);
