/**
 * 聊天应用的 Jotai 状态管理
 * 使用原子化状态管理，便于组件间共享和更新状态
 */
import { atom } from 'jotai';

/**
 * 消息接口定义
 */
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

/**
 * 会话接口定义
 */
export interface ChatSession {
  key: string;
  label: string;
  timestamp: number;
  messages: Message[];
}

/**
 * 会话列表原子
 * 存储所有的聊天会话
 */
export const chatSessionsAtom = atom<ChatSession[]>([
  {
    key: 'session-1',
    label: '新对话',
    timestamp: Date.now(),
    messages: [],
  },
]);

/**
 * 当前激活的会话 key 原子
 */
export const activeSessionKeyAtom = atom<string>('session-1');

/**
 * 加载状态原子
 * 用于显示 AI 正在思考的状态
 */
export const loadingAtom = atom<boolean>(false);

/**
 * 派生原子：获取当前激活的会话
 */
export const activeSessionAtom = atom(
  (get) => {
    const sessions = get(chatSessionsAtom);
    const activeKey = get(activeSessionKeyAtom);
    return sessions.find((session) => session.key === activeKey);
  }
);

/**
 * 派生原子：获取当前会话的消息列表
 */
export const currentMessagesAtom = atom(
  (get) => {
    const activeSession = get(activeSessionAtom);
    return activeSession?.messages || [];
  }
);
