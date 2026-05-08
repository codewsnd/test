import axios from 'axios'
import type {AxiosInstance, AxiosRequestConfig} from 'axios'
import {message} from 'antd'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipError?: boolean
  }
}

const baseURL = '/';
const instance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

type ApiClient = Omit<AxiosInstance, 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch'> & {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  options<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
}

// 请求拦截器
instance.interceptors.request.use(
  async (config) => {
    config.headers = config.headers || {};
    config.headers.uid = '123456'
    config.headers['X-E2E-Trust-Token'] = '123456'
    return config;
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器

instance.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error?.config?.skipError) {
      return Promise.reject(error)
    }
    if (error?.response?.data) {
      if (typeof error?.response?.data === 'string') {
        message.error(error?.response?.data);
      }
    } else {
      message.error('Failed to fetch')
    }
    return Promise.reject(error)
  },
)

export default instance as ApiClient
