import axios from 'axios'
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

export default instance
