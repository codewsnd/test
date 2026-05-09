import axios from './axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';

// API 请求默认尝试次数。
export const API_RETRY_ATTEMPTS = 3;
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

// 包装任意 API 请求，失败时按默认策略自动重试。
export const requestWithRetry = async <T>(
  request: () => Promise<T>
): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (!isRetryableError(error) || attempt >= API_RETRY_ATTEMPTS) {
        throw error;
      }

      await delay(API_RETRY_DELAY_MS);
    }
  }
};

const withDefaultSkipError = (config?: AxiosRequestConfig): AxiosRequestConfig => ({
  ...config,
  skipError: config?.skipError ?? true
});

export class ApiRetryUtil {
  static request<T>(request: () => Promise<T>): Promise<T> {
    return requestWithRetry(request);
  }

  static get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.get<T>(url, withDefaultSkipError(config)));
  }

  static delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.delete<T>(url, withDefaultSkipError(config)));
  }

  static head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.head<T>(url, withDefaultSkipError(config)));
  }

  static options<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.options<T>(url, withDefaultSkipError(config)));
  }

  static post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.post<T>(url, data, withDefaultSkipError(config)));
  }

  static put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.put<T>(url, data, withDefaultSkipError(config)));
  }

  static patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(() => axios.patch<T>(url, data, withDefaultSkipError(config)));
  }
}
