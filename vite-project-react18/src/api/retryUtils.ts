import type { AxiosError } from 'axios';

// API 请求默认重试次数。
export const API_RETRY_COUNT = 3;
// 每次重试之间的等待时间，单位毫秒。
export const API_RETRY_DELAY_MS = 1000;

// 延迟指定时间后继续执行，用于控制重试间隔。
const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// 只对网络异常、请求超时、限流和服务端错误进行重试，避免业务错误被重复提交。
const isRetryableError = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
};

export class ApiRetryUtil {
  // 包装任意 API 请求，失败时按默认策略自动重试。
  static async request<T>(
    request: () => Promise<T>
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= API_RETRY_COUNT; attempt++) {
      try {
        return await request();
      } catch (error) {
        lastError = error;

        if (!isRetryableError(error) || attempt === API_RETRY_COUNT) {
          throw error;
        }

        await delay(API_RETRY_DELAY_MS);
      }
    }

    throw lastError ?? new Error('API request failed');
  }
}
