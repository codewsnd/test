import type {FormResponse} from "../models/formResponse";
import { springboot2Api, springboot3BackendApi } from "./axios";

export const getMyFormResponseApi = async (formId: string): Promise<FormResponse> => {
    return springboot2Api.get(`/forms/responses/${formId}`);
}

// 上传表格数据和图片到后端
export const copyDeckUploadApi = async (formData: FormData): Promise<any> => {
    return springboot3BackendApi.post('/test/table', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
}

// 调用 chat/completions API 进行 OCR 识别
interface ChatCompletionsDocument {
    base64url: string[];
    id: string;
    type: string;
    name?: string;
}

interface ChatCompletionsRequest {
    requestId: string;
    agentId: string;
    modelName: string;
    documents: ChatCompletionsDocument[];
    messages: Array<{
        role: string;
        content: string;
    }>;
}

export const callChatCompletions = async (requestBody: ChatCompletionsRequest): Promise<any> => {
    // 打印请求体的大小信息，而不是完整内容（避免console截断）
    console.log('=== 调用 chat/completions ===');
    console.log('Documents 数量:', requestBody.documents.length);
    requestBody.documents.forEach((doc, index) => {
        const base64Length = doc.base64url[0]?.length || 0;
        const estimatedSize = (base64Length / 1024).toFixed(2);
        console.log(`  图片 ${index + 1}: ${doc.name}, Base64长度: ${base64Length}, 预估大小: ${estimatedSize} KB`);
    });
    console.log('请求体总大小:', (JSON.stringify(requestBody).length / 1024).toFixed(2), 'KB');

    const result = await springboot3BackendApi.post('/chat/completions', requestBody);
    console.log('Chat completions 响应:', result);
    return result;
}

export type { ChatCompletionsDocument, ChatCompletionsRequest };
