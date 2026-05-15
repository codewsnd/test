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
 * HTML 分享创建请求
 */
export interface CreateHtmlShareRequest {
  previewId?: string | null;
  conversationId?: string | null;
  turnId?: string | null;
  htmlContent?: string | null;
}

/**
 * HTML 分享状态更新请求
 */
export interface UpdateHtmlShareStatusRequest {
  enabled: boolean;
}

/**
 * HTML 分享响应
 */
export interface HtmlShareResponse {
  id: string | null;
  previewId: string | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  htmlContent?: string | null;
  hasXss?: boolean | null;
  hasExternalReferences?: boolean | null;
  htmlContentLength?: number | null;
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

/**
 * 创建分享（若 previewId 缺失，后端会先创建 preview）
 */
export const createHtmlShareApi = async (
  request: CreateHtmlShareRequest
): Promise<HtmlShareResponse> => {
  return await ApiRetryUtil.post<HtmlShareResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview/share`,
    request,
    undefined,
    'Failed to create HTML share'
  );
};

/**
 * 更新分享状态（开启/关闭）
 */
export const updateHtmlShareStatusApi = async (
  id: string,
  request: UpdateHtmlShareStatusRequest
): Promise<HtmlShareResponse> => {
  return await ApiRetryUtil.put<HtmlShareResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview/share/${id}/status`,
    request,
    undefined,
    'Failed to update HTML share status'
  );
};

/**
 * 根据分享 ID 获取分享内容
 */
export const getHtmlShareContentApi = async (id: string): Promise<HtmlShareResponse> => {
  return await ApiRetryUtil.get<HtmlShareResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview/share/${id}`,
    undefined,
    'Failed to get HTML share'
  );
};

/**
 * 根据 previewId 查询分享状态
 */
export const getHtmlShareByPreviewApi = async (previewId: string): Promise<HtmlShareResponse> => {
  return await ApiRetryUtil.get<HtmlShareResponse>(
    `${SPRINGBOOT3_API_URL}/conversation/html/preview/share/preview/${previewId}`,
    undefined,
    'Failed to get HTML share status'
  );
};
