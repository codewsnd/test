// IndexedDB 兼容性处理
const indexedDB = window.indexedDB || 
                 (window as any).mozIndexedDB || 
                 (window as any).webkitIndexedDB || 
                 (window as any).msIndexedDB;

// 类型定义
export interface IndexedDbItem {
  id: string;
  [key: string]: any;
}

export interface PaginationResult<T> {
  data: T[];
  hasMore: boolean;
  total: number;
}

export type SuccessCallback<T = any> = (result: T) => void;
export type ErrorCallback = (error: Event | DOMException) => void;

/**
 * IndexedDB 封装类，提供类型安全的数据库操作
 * 假设所有对象都有 'id' 作为主键
 */
class IndexedDb<T extends IndexedDbItem = IndexedDbItem> {
  private version: number;
  private storeName: string;
  private db: IDBDatabase | null = null;
  private dbName: string;
  private dbConnection: IDBOpenDBRequest | null = null;

  constructor(dbName: string, version: number, storeName: string) {
    this.version = version;
    this.storeName = storeName;
    this.dbName = dbName;
  }

  /**
   * 打开数据库连接
   */
  async open(): Promise<IndexedDb<T>> {
    return new Promise((resolve, reject) => {
      this.dbConnection = indexedDB.open(this.dbName, this.version);

      this.dbConnection.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          this.db.createObjectStore(this.storeName, { keyPath: 'id' });
          console.log(`Created object store for ${this.storeName}.`);
        }
      };

      this.dbConnection.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this);
        console.log(`IndexedDB opened successfully for ${this.dbName}!`);
      };

      this.dbConnection.onerror = (event: Event) => {
        console.error(`Failed to open IndexedDB for ${this.dbName}.`);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * 保存对象到数据库
   */
  async saveObject(
    obj: T, 
    successFunc: SuccessCallback<Event> = () => {}, 
    errFunc: ErrorCallback = () => {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction([this.storeName], "readwrite")
        .objectStore(this.storeName)
        .put(obj);

      request.onsuccess = (event: Event) => {
        successFunc(event);
        resolve();
      };

      request.onerror = (event: Event) => {
        errFunc(event);
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 批量保存对象
   */
  async saveBatch(
    objects: T[], 
    successFunc: SuccessCallback<Event> = () => {}, 
    errFunc: ErrorCallback = () => {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      
      let completed = 0;
      const total = objects.length;

      if (total === 0) {
        resolve();
        return;
      }

      objects.forEach(obj => {
        const request = store.put(obj);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            successFunc(new Event('success'));
            resolve();
          }
        };

        request.onerror = (event: Event) => {
          errFunc(event);
          reject((event.target as IDBRequest).error);
        };
      });
    });
  }

  /**
   * 根据键删除项目
   */
  async deleteItemByKey(
    key: string, 
    successFunc: SuccessCallback<Event> = () => {}, 
    errFunc: ErrorCallback = () => {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction([this.storeName], "readwrite")
        .objectStore(this.storeName)
        .delete(key);

      request.onsuccess = (event: Event) => {
        successFunc(event);
        resolve();
      };

      request.onerror = (event: Event) => {
        errFunc(event);
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 清空所有数据
   */
  async deleteAll(
    successFunc: SuccessCallback<Event> = () => {}, 
    errFunc: ErrorCallback = () => {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction([this.storeName], "readwrite")
        .objectStore(this.storeName)
        .clear();

      request.onsuccess = (event: Event) => {
        successFunc(event);
        resolve();
      };

      request.onerror = (event: Event) => {
        errFunc(event);
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 获取所有数据
   */
  async getAll(): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction(this.storeName)
        .objectStore(this.storeName)
        .getAll();

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest<T[]>).result);
      };

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 根据键获取单个项目
   */
  async getItemByKey(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction(this.storeName)
        .objectStore(this.storeName)
        .get(key);

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest<T>).result);
      };

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 分页获取数据，支持按时间排序
   */
  async getScrollPageData(
    page: number = 1, 
    pageSize: number = 20, 
    sortByTime: boolean = true
  ): Promise<PaginationResult<T>> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = (event: Event) => {
        let allData = (event.target as IDBRequest<T[]>).result;
        
        // 按时间排序（如果需要）
        if (sortByTime) {
          allData = allData.sort((a: any, b: any) => {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA; // 降序排列，最新的在前
          });
        }

        const total = allData.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, total);
        const data = allData.slice(startIndex, endIndex);
        const hasMore = endIndex < total;

        resolve({
          data,
          hasMore,
          total
        });
      };

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{ total: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const request = this.db
        .transaction(this.storeName)
        .objectStore(this.storeName)
        .count();

      request.onsuccess = (event: Event) => {
        resolve({ 
          total: (event.target as IDBRequest<number>).result 
        });
      };

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error);
      };
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default IndexedDb;