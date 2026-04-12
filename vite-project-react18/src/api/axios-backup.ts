// import axios, {
//   type AxiosInstance,
//   type AxiosResponse,
//   AxiosError,
//   type InternalAxiosRequestConfig,
//   type AxiosRequestHeaders
// } from "axios";
//
// // 通用拦截器配置函数
// const configureInterceptors = (instance: AxiosInstance): void => {
//   // 请求拦截器
//   instance.interceptors.request.use(
//     (config: InternalAxiosRequestConfig) => {
//       // 类型安全地设置 header
//       if (!config.headers) {
//         config.headers = {} as AxiosRequestHeaders;
//       }
//       config.headers["uid"] = "123456";
//       return config;
//     },
//     (error: AxiosError) => {
//       return Promise.reject(error);
//     }
//   );
//
//   // 响应拦截器
//   instance.interceptors.response.use(
//     (response: AxiosResponse) => response.data,
//     (error: AxiosError) => {
//       console.error("API Request Failed:", error.message);
//       return Promise.reject(error);
//     }
//   );
// };
//
// // 主 API 实例
// const api: AxiosInstance = axios.create({
//   baseURL: import.meta.env.VITE_API_URL,
//   timeout: 60000,
// });
//
// // 网关 API 实例
// const gatewayApi: AxiosInstance = axios.create({
//   baseURL: import.meta.env.VITE_GATEWAY_API_URL,
//   timeout: 60000,
// });
//
// // 应用拦截器配置
// configureInterceptors(api);
// configureInterceptors(gatewayApi);
//
// export { api, gatewayApi };
