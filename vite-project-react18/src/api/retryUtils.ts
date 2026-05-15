import axios from './axios';
import { isAxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';
import {message} from 'antd';

/**
 * API 请求默认尝试次数，包含首次请求本身。
 */
export const API_RETRY_ATTEMPTS = 3;

/**
 * 每次重试之间的固定等待时间，单位毫秒。
 */
export const API_RETRY_DELAY_MS = 1000;

/**
 * 延迟指定时间后继续执行，用于控制重试间隔。
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * 判断当前错误是否适合重试。
 * 只对 Axios 网络异常、请求超时、限流和服务端错误重试，取消请求和业务错误不重试。
 */
const isRetryableError = (error: unknown): boolean => {
  if (!isAxiosError(error) || error.code === 'ERR_CANCELED') {
    return false;
  }

  const status = error.response?.status;
  return !status || status === 408 || status === 429 || status >= 500;
};

/**
 * 包装任意 API 请求，失败时按默认重试策略自动重试。
 */
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

/**
 * 为 Axios 请求配置补充默认错误处理策略。
 * 默认跳过 axios 拦截器里的通用错误提示，由 ApiRetryUtil 统一决定是否提示。
 */
const withDefaultSkipError = <D = unknown>(config?: AxiosRequestConfig<D>): AxiosRequestConfig<D> => ({
  ...config,
  skipError: config?.skipError ?? true
});

/**
 * 根据 Axios 配置决定是否由 ApiRetryUtil 展示额外错误提示。
 * 当调用方显式设置 skipError=false 时，错误提示交给 axios 拦截器处理，避免重复提示。
 */
const resolveErrorMessage = <D = unknown>(
  config: AxiosRequestConfig<D> | undefined,
  errorMessage: string | undefined
): string | undefined => (config?.skipError === false ? undefined : errorMessage);

/**
 * 带重试能力的 API 请求工具。
 * 对外方法的前置参数与 axios 保持一致，并在最后额外追加可选错误提示。
 */
export class ApiRetryUtil {
  /**
   * 执行请求函数，并在最终失败后按需展示错误提示。
   */
  private static async execute<T>(request: () => Promise<T>, errorMessage?: string): Promise<T> {
    try {
      return await requestWithRetry(request);
    } catch (error) {
      if (errorMessage) {
        message.error(errorMessage);
        console.error(errorMessage, error);
      }
      throw error;
    }
  }

  /**
   * 发起通用请求，配置对象的使用方式与 axios.request 保持一致。
   * 也兼容传入自定义请求函数，便于少量特殊场景复用重试逻辑。
   */
  static request<T = unknown, R = T, D = unknown>(config: AxiosRequestConfig<D>, errorMessage?: string): Promise<R>;
  static request<R = unknown>(request: () => Promise<R>, errorMessage?: string): Promise<R>;
  static request<T = unknown, R = T, D = unknown>(
    requestOrConfig: AxiosRequestConfig<D> | (() => Promise<R>),
    errorMessage?: string
  ): Promise<R> {
    if (typeof requestOrConfig === 'function') {
      return this.execute(requestOrConfig, errorMessage);
    }

    return this.execute(
      () => axios.request<T, R, D>(withDefaultSkipError(requestOrConfig)),
      resolveErrorMessage(requestOrConfig, errorMessage)
    );
  }

  /**
   * 发起 GET 请求，前置参数与 axios.get 一致，最后额外接收错误提示。
   */
  static get<T = unknown, R = T, D = unknown>(
    url: string,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.get<T, R, D>(url, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 DELETE 请求，前置参数与 axios.delete 一致，最后额外接收错误提示。
   */
  static delete<T = unknown, R = T, D = unknown>(
    url: string,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.delete<T, R, D>(url, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 HEAD 请求，前置参数与 axios.head 一致，最后额外接收错误提示。
   */
  static head<T = unknown, R = T, D = unknown>(
    url: string,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.head<T, R, D>(url, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 OPTIONS 请求，前置参数与 axios.options 一致，最后额外接收错误提示。
   */
  static options<T = unknown, R = T, D = unknown>(
    url: string,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.options<T, R, D>(url, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 POST 请求，前置参数与 axios.post 一致，最后额外接收错误提示。
   */
  static post<T = unknown, R = T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.post<T, R, D>(url, data, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 PUT 请求，前置参数与 axios.put 一致，最后额外接收错误提示。
   */
  static put<T = unknown, R = T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.put<T, R, D>(url, data, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }

  /**
   * 发起 PATCH 请求，前置参数与 axios.patch 一致，最后额外接收错误提示。
   */
  static patch<T = unknown, R = T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
    errorMessage?: string
  ): Promise<R> {
    return this.execute(
      () => axios.patch<T, R, D>(url, data, withDefaultSkipError(config)),
      resolveErrorMessage(config, errorMessage)
    );
  }
}
