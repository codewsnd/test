import axios from 'axios'
import {message} from "antd";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60000
})

api.interceptors.request.use(
  (config) => {
    config.headers.uid = '123456'
    return config
  },
)

// 响应拦截器统一处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if(error?.response?.data) {
      if(typeof error?.response?.data==='string') {
        message.error(error?.response?.data);
      }
    }
    console.error('API Request Failed:', error)
    return Promise.reject(error);
  }
)

export default api


export const RAG_URL = 'http://localhost:8080'
