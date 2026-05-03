import { springboot3BackendApi } from '../axios';

/**
 * PPT 生成请求参数
 */
export interface PptGenerateRequest {
  font: string;
  pageCount: number;
  title?: string;
}

/**
 * PPT 生成响应
 */
export interface PptGenerateResponse {
  success: boolean;
  message: string;
  pptBase64?: string;
  fileName?: string;
}

/**
 * 调用后端 API 生成 PPT
 */
export const generatePptApi = async (request: PptGenerateRequest): Promise<PptGenerateResponse> => {
  return springboot3BackendApi.post('/api/ppt/generate', request);
};

/**
 * 下载 Base64 编码的 PPT 文件
 */
export const downloadPptFromBase64 = (base64: string, fileName: string) => {
  try {
    // 将 Base64 转换为 Blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载 PPT 失败:', error);
    throw error;
  }
};
