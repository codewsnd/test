/**
 * HTML 预览 API 服务
 */
import { ApiRetryUtil } from './retryUtils';

const SPRINGBOOT3_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_URL || 'http://localhost:8080';

/**
 * 创建 HTML 预览请求
 */
export interface CreateHtmlPreviewRequest {
  conversationId: string;
  turnId: string;
  htmlContent: string;
}

/**
 * HTML 预览响应
 */
export interface HtmlPreviewResponse {
  id: string;
  htmlContent: string | null;
  hasXss: boolean | null;
  xssContent?: string | null;
  hasExternalReferences: boolean | null;
  externalReferencesContent?: string | null;
  htmlContentLength: number | null;
}

/**
 * 创建或更新 HTML 预览
 * 发送 HTML 内容到后端，进行 XSS 过滤后存储到 S3
 */
export const createHtmlPreviewApi = async (
  request: CreateHtmlPreviewRequest
): Promise<HtmlPreviewResponse> => {
  return await ApiRetryUtil.post<HtmlPreviewResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview`,
    request,
    undefined,
    'Failed to create HTML preview'
  );
};

/**
 * 根据 ID 获取 HTML 预览内容
 * 返回预览元信息和 HTML 内容（仅当安全时，即无 XSS 和外部引用）
 */
export const getHtmlPreviewContentApi = async (id: string): Promise<HtmlPreviewResponse> => {
  return await ApiRetryUtil.get<HtmlPreviewResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview/${id}`,
    undefined,
    'Failed to get HTML preview'
  );
};
