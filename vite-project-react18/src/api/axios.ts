import axios from 'axios'
import type { AxiosInstance } from 'axios'
import {message} from "antd";

export const API_BASE_URLS = {
  springboot2: import.meta.env.VITE_API_SPRINGBOOT2_URL || 'http://localhost:8082',
  springboot3: import.meta.env.VITE_API_SPRINGBOOT3_URL || 'http://localhost:8080',
  springboot3Backend: import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081',
  core: import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000',
} as const;

const createApiClient = (baseURL: string): AxiosInstance => {
  const api = axios.create({
    baseURL,
    timeout: 60000
  });

  api.interceptors.request.use(
    (config) => {
      config.headers.uid = '123456';
      config.headers['X-E2E-Trust-Token'] = '123456';
      return config;
    },
  );

  api.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if(error?.response?.data) {
        if(typeof error?.response?.data==='string') {
          message.error(error?.response?.data);
        }
      }
      console.error('API Request Failed:', error);
      return Promise.reject(error);
    }
  );

  return api;
};

export const springboot2Api = createApiClient(API_BASE_URLS.springboot2);
export const springboot3Api = createApiClient(API_BASE_URLS.springboot3);
export const springboot3BackendApi = createApiClient(API_BASE_URLS.springboot3Backend);
export const coreApi = createApiClient(API_BASE_URLS.core);

export default springboot3Api
