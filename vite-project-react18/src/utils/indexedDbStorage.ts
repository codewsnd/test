import type { ConversationHistory } from '../api/conversationHistoryApi';

// IndexedDB 配置常量
const DB_CONFIG = {
  NAME: "conversationHistoryDB",
  VERSION: 1,
  TABLE_NAME: "conversations"
} as const;

/**
 * 打开IndexedDB数据库
 */
export const openIndexedDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(DB_CONFIG.TABLE_NAME)) {
        const store = db.createObjectStore(DB_CONFIG.TABLE_NAME, { keyPath: 'id' });
        // 创建索引用于查询
        store.createIndex('staffId', 'staffId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('isPinned', 'isPinned', { unique: false });
      }
    };
  });
};

/**
 * 保存单个会话到IndexedDB
 */
export const saveConversationToIndexedDb = async (conversation: ConversationHistory): Promise<void> => {
  const db = await openIndexedDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_CONFIG.TABLE_NAME], 'readwrite');
    const store = transaction.objectStore(DB_CONFIG.TABLE_NAME);

    const request = store.put(conversation);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to save conversation to IndexedDB'));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * 批量保存会话到IndexedDB
 */
export const saveConversationsToIndexedDb = async (conversations: ConversationHistory[]): Promise<void> => {
  const db = await openIndexedDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_CONFIG.TABLE_NAME], 'readwrite');
    const store = transaction.objectStore(DB_CONFIG.TABLE_NAME);

    let completedCount = 0;
    let hasError = false;

    const onComplete = () => {
      completedCount++;
      if (completedCount === conversations.length) {
        if (hasError) {
          reject(new Error('Some conversations failed to save'));
        } else {
          resolve();
        }
      }
    };

    conversations.forEach((conversation) => {
      const request = store.put(conversation);

      request.onsuccess = () => {
        onComplete();
      };

      request.onerror = () => {
        hasError = true;
        onComplete();
      };
    });

    transaction.oncomplete = () => {
      db.close();
    };

    transaction.onerror = () => {
      reject(new Error('Transaction failed'));
      db.close();
    };
  });
};

/**
 * 从IndexedDB获取所有会话
 */
export const getConversationsFromIndexedDb = async (): Promise<ConversationHistory[]> => {
  const db = await openIndexedDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_CONFIG.TABLE_NAME], 'readonly');
    const store = transaction.objectStore(DB_CONFIG.TABLE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
      db.close();
    };

    request.onerror = () => {
      reject(new Error('Failed to read from IndexedDB'));
      db.close();
    };
  });
};

/**
 * 清空IndexedDB中的所有会话数据
 */
export const clearIndexedDb = async (): Promise<void> => {
  const db = await openIndexedDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_CONFIG.TABLE_NAME], 'readwrite');
    const store = transaction.objectStore(DB_CONFIG.TABLE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to clear IndexedDB'));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};