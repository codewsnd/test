import axios from 'axios'
import { message } from 'antd'

axios.defaults.timeout = 60000

axios.interceptors.request.use((config) => {
  config.headers.uid = '123456'
  config.headers['X-E2E-Trust-Token'] = '123456'
  return config
})

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data && typeof error.response.data === 'string') {
      message.error(error.response.data)
    }
    console.error('API Request Failed:', error)
    return Promise.reject(error)
  },
)

export default axios
