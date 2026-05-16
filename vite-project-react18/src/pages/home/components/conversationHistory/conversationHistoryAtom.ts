import { atom } from 'jotai';
import type { ConversationState, ConversationTurn } from '../chat/types';
import type {ConversationHistory} from "@/api/conversationHistoryApi";
import {
  pageConversationsApi,
  createConversationApi,
  batchDeleteConversationsApi,
  batchPinConversationsApi,
  batchUnpinConversationsApi,
  renameConversationApi,
  saveConversationStateApi
} from "@/api/conversationHistoryApi";
import {aiChat} from "@/api";
import {v7} from 'uuid';

// 分页大小配置
const PAGE_SIZE = 50;
const FIRST_PAGE = 1;

// 基础状态
export const conversationHistoriesAtom = atom<ConversationHistory[]>([]);
export const activeConversationIdAtom = atom<string | null>(null);
export const dbInitializedAtom = atom<boolean>(false);
export const searchQueryAtom = atom<string>('');
export const currentPageAtom = atom<number>(FIRST_PAGE);
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
      ...initialState
    };

    try {
      // 添加到状态并立即激活
      set(conversationHistoriesAtom, prev => [newConversationHistory, ...prev]);
      set(activeConversationIdAtom, newId);

      // 持久化到数据库
      await createConversationApi(newConversationHistory);

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

    // 是否有更新
    if (JSON.stringify(targetConvHistory) === JSON.stringify(updatedConvHistory)) {
      return;
    }

    const newConvs = conversations.map(conv =>
      conv.id === conversationHistoryId ? updatedConvHistory : conv
    );

    set(conversationHistoriesAtom, newConvs);

    // 自动异步持久化到数据库
    if (isDone) {
      try {
        const conversationState = updatedConvHistory.conversationState;
        const lastTurn = conversationState?.turns[conversationState.turns.length - 1];

        if (conversationState) {
          await saveConversationStateApi(conversationHistoryId, {
            ...conversationState,
            turns: lastTurn ? [lastTurn] : []
          });
        }
      } catch (error) {
        console.error('Failed to persist conversation history', error);
      }
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
      set(currentPageAtom, FIRST_PAGE);
      set(hasMoreAtom, true);

      let allInitialData: ConversationHistory[] = [];

      // 只加载第一页数据用于初始化
      const result = await pageConversationsApi(FIRST_PAGE, PAGE_SIZE);
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
  async (get, set, { currentPage, pageSize = PAGE_SIZE }: { currentPage: number; pageSize?: number }) => {
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
      set(currentPageAtom, FIRST_PAGE);
      set(hasMoreAtom, true);

      // 获取搜索结果
      const result = await pageConversationsApi(FIRST_PAGE, PAGE_SIZE, searchQuery);

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
          conversationState: updatedState
        };
      },
      isDone
    });
  }
);

export const generateConversationTitleAtom = atom(
  null,
  async (get, set, {
    conversationId,
    turns,
    turnId
  }: {
    conversationId: string;
    turns: ConversationTurn[];
    turnId: string;
  }) => {
    // 只在第一次对话且有AI回复内容时生成标题
    if (turns.length !== 1 || !conversationId) return;

    const turn = turns.find((turn) => turn.id === turnId);
    if (!turn?.aiResponse.content) return;

    const conversations = get(conversationHistoriesAtom);
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    const userInput = turn.userInput.content;
    const aiResponse = turn.aiResponse.content.replace(/<think>[\s\S]*?<\/think>/g, '') || '';
    const fallbackTitle = userInput.trim().substring(0, 20);
    const applyGeneratedTitle = async (title: string) => {
      const renamedConversation = await renameConversationApi(conversationId, title);

      set(setConversationHistoryAtom, {
        conversationHistoryId: conversationId,
        updater: {
          title: renamedConversation.title,
          titleGenerating: renamedConversation.titleGenerating ?? false,
          updatedAt: renamedConversation.updatedAt
        },
        isDone: false
      });

      return renamedConversation.title;
    };

    try {
      const summaryContent = `Generate a concise conversation title (maximum 20 characters) based on the following conversation. The title should:
1. Be in the same language as the user's input
2. Capture the main topic or question
3. Be specific and descriptive
4. Use clear, natural language

User Input: ${userInput}
AI Response: ${aiResponse}

Please provide only the title, no additional text or explanation.`;

      const response = await aiChat({
        messages: [
          {
            role: 'user',
            content: summaryContent
          }
        ]
      });
      const finalTitle = response.data?.content.trim().substring(0, 20) || fallbackTitle;

      return await applyGeneratedTitle(finalTitle);
    } catch (error) {
      console.error('Failed to generate title:', error);

      // 失败时使用fallback标题
      try {
        return await applyGeneratedTitle(fallbackTitle);
      } catch (renameError) {
        console.error('Failed to persist generated fallback title:', renameError);
        set(setConversationHistoryAtom, {
          conversationHistoryId: conversationId,
          updater: { title: fallbackTitle, titleGenerating: false },
          isDone: false
        });
        return fallbackTitle;
      }
    }
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
