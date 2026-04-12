import { getDefaultStore } from 'jotai';
import { globalStaffIdAtom } from '../atom/globalAtom';

/**
 * 获取员工ID
 * 从全局 jotai atom 中获取 Staff ID
 * @returns 员工ID字符串
 */
export const getEmployeeId = (): string => {
  const store = getDefaultStore();
  const staffId = store.get(globalStaffIdAtom);
  return staffId || '123'; // 如果未设置，返回默认值
};

/**
 * 示例：从 jotai store 获取当前活跃的会话 ID
 * @returns 当前活跃的会话 ID 或 null
 */
export const getActiveConversationId = (): string | null => {
  // 方法 1: 使用 getDefaultStore() 直接访问
  // const store = getDefaultStore();
  // const activeId = store.get(activeConversationIdAtom);
  // return activeId;

  // 如果不想在工具文件中直接访问 store，可以从组件传递值
  return null;
};

/**
 * 示例：设置 jotai atom 的值
 */
export const setUserPreference = (key: string, value: any) => {
  // const store = getDefaultStore();
  // store.set(userPreferenceAtom, (prev) => ({
  //   ...prev,
  //   [key]: value
  // }));
};

/**
 * 示例：订阅 atom 的变化
 * @returns 取消订阅的函数
 */
export const subscribeToUserChanges = (callback: (userId: string) => void) => {
  // const store = getDefaultStore();
  // const unsubscribe = store.sub(userIdAtom, () => {
  //   const userId = store.get(userIdAtom);
  //   callback(userId);
  // });
  // return unsubscribe;
  return () => {};
};

