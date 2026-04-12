import * as conversationHistoryApi from '../../../../api/conversationHistoryApi';

// IndexedDB 配置常量
const DB_CONFIG = {
  NAME: "conversationHistoryDB",
  VERSION: 1,
  TABLE_NAME: "conversations"
} as const;

// 检查是否存在 IndexedDB 数据库
export const checkIndexedDbExists = async (): Promise<boolean> => {
  if (!window.indexedDB) {
    console.log('IndexedDB not supported');
    return false;
  }

  try {
    const databases = await window.indexedDB.databases();
    return databases.some(db => db.name === DB_CONFIG.NAME);
  } catch (error) {
    console.error('Error checking IndexedDB:', error);
    return false;
  }
};

// 获取 IndexedDB 中的所有会话数据
export const getIndexedDbConversations = async (): Promise<any[]> => {
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

      if (!db.objectStoreNames.contains(DB_CONFIG.TABLE_NAME)) {
        resolve([]);
        return;
      }

      const transaction = db.transaction([DB_CONFIG.TABLE_NAME], 'readonly');
      const store = transaction.objectStore(DB_CONFIG.TABLE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
        db.close();
      };

      getAllRequest.onerror = () => {
        reject(new Error('Failed to read from IndexedDB'));
        db.close();
      };
    };
  });
};

// 删除 IndexedDB 数据库
export const deleteIndexedDb = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve();
      return;
    }

    const deleteRequest = window.indexedDB.deleteDatabase(DB_CONFIG.NAME);

    deleteRequest.onsuccess = () => {
      console.log('IndexedDB deleted successfully');
      resolve();
    };

    deleteRequest.onerror = () => {
      reject(new Error('Failed to delete IndexedDB'));
    };

    deleteRequest.onblocked = () => {
      console.warn('IndexedDB deletion blocked, retrying...');
      // 可以选择重试或提示用户关闭其他标签页
    };
  });
};

// 转换和清理数据
const transformConversationData = (indexedDbData: any[]): any[] => {
  return indexedDbData.map(conv => {
    // 移除不需要的字段
    const { isStarred, chatId, ...cleanedConv } = conv;

    // 确保必要字段存在
    const transformed = {
      ...cleanedConv,
      id: cleanedConv.id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      title: cleanedConv.title || 'Untitled Conversation',
      isPinned: cleanedConv.isPinned || false,
      titleGenerating: cleanedConv.titleGenerating || false,
      conversationState: cleanedConv.conversationState || { turns: [] }
    };

    // 确保时间戳是数字格式
    if (transformed.createdAt && typeof transformed.createdAt !== 'number') {
      transformed.createdAt = new Date(transformed.createdAt).getTime();
    }
    if (transformed.updatedAt && typeof transformed.updatedAt !== 'number') {
      transformed.updatedAt = new Date(transformed.updatedAt).getTime();
    }
    if (transformed.pinnedAt && typeof transformed.pinnedAt !== 'number') {
      transformed.pinnedAt = new Date(transformed.pinnedAt).getTime();
    }

    return transformed;
  });
};

// 执行完整的迁移流程
export const migrateIndexedDbToBackend = async (staffId: string): Promise<{
  success: boolean;
  message: string;
  migratedCount: number;
  totalCount: number;
}> => {
  try {
    // 1. 检查 IndexedDB 是否存在
    const dbExists = await checkIndexedDbExists();
    if (!dbExists) {
      return {
        success: true,
        message: 'No IndexedDB found, migration not needed',
        migratedCount: 0,
        totalCount: 0
      };
    }

    // 2. 获取所有会话数据
    const indexedDbData = await getIndexedDbConversations();
    if (indexedDbData.length === 0) {
      return {
        success: true,
        message: 'No conversations found in IndexedDB',
        migratedCount: 0,
        totalCount: 0
      };
    }

    // 3. 转换和清理数据
    const cleanedData = transformConversationData(indexedDbData);

    // 4. 发送到后端进行迁移
    const result = await conversationHistoryApi.migrateFromIndexedDbApi(cleanedData, staffId);

    // 解析后端返回的成功计数
    const successCountMatch = result.match(/Successfully migrated (\d+) conversations/);
    const actualMigratedCount = successCountMatch ? parseInt(successCountMatch[1]) : 0;

    // 5. 只有在成功迁移了数据时才删除 IndexedDB
    if (actualMigratedCount > 0) {
      await deleteIndexedDb();
    }

    return {
      success: true,
      message: result,
      migratedCount: actualMigratedCount,
      totalCount: indexedDbData.length
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      migratedCount: 0,
      totalCount: 0
    };
  }
};

// 自动迁移检查和执行（无需用户确认）
export const autoMigrateIfNeeded = async (staffId: string): Promise<{
  migrated: boolean;
  result?: {
    success: boolean;
    message: string;
    migratedCount: number;
    totalCount: number;
  }
}> => {
  try {
    const dbExists = await checkIndexedDbExists();
    if (!dbExists) {
      return { migrated: false };
    }

    const conversations = await getIndexedDbConversations();
    if (conversations.length === 0) {
      // 如果数据库存在但没有数据，直接删除空数据库
      await deleteIndexedDb();
      return { migrated: false };
    }

    console.log(`Found ${conversations.length} conversations in IndexedDB, starting automatic migration...`);

    const result = await migrateIndexedDbToBackend(staffId);

    if (result.success) {
      console.log(`Migration completed successfully: ${result.message}`);
    } else {
      console.error(`Migration failed: ${result.message}`);
    }

    return {
      migrated: true,
      result
    };

  } catch (error) {
    console.error('Auto migration check failed:', error);
    return {
      migrated: false,
      result: {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        migratedCount: 0,
        totalCount: 0
      }
    };
  }
};
