import axios from '../axios';
import {getEmployeeId} from "@/utils/userUtils";
import {aiChat, type AiChatRequest} from "@/api";
import {buildGroupedMatchPrompt, buildSingleTableMatchPrompt} from './copyDeckPrompt';
import {buildLanguageComparePrompt, type LanguageCompareDifference, type LanguageIssue} from './languageComparePrompt';
import {mergeChineseQualityIssues} from "@/utils/chineseUtils";
import {message} from "antd";

const SPRINGBOOT3_BACKEND_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';


/**
 * Storage API 响应接口
 */
export interface CopyDeckStorageResponse {
  storage: string;
  confluenceTitle: string;
}

/**
 * 获取Confluence页面的Storage HTML和页面标题
 */
export const copyDeckStorageApi = async (confluenceUrl: string): Promise<CopyDeckStorageResponse> => {
  const response = await axios.get<CopyDeckStorageResponse>(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/storage`, {
    params: {
      confluenceUrl,
      staffId: getEmployeeId()
    }
  });
  return response;
};


/**
 * 准备图片的 base64 数组（提取公共逻辑）
 */
const prepareBase64Images = (images: Array<{ base64: string; fileName: string }>): string[] => {
  return images.map(img => {
    const base64Data = img.base64.split(',')[1] || img.base64;
    return `data:image/png;base64,${base64Data}`;
  });
};

/**
 * 清理 AI 返回的 JSON 字符串（移除 markdown 代码块）
 */
const cleanAIResponse = (content: string): string => {
  return content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^```|```$/g, '')
    .trim();
};

/**
 * 解析 AI 返回的 JSON 数据
 */
const parseAIResponse = <T>(apiResponse: unknown): T | null => {
  const payload = apiResponse as { data?: { content?: string } };
  if (!payload.data || !payload.data.content) {
    console.error('Unexpected API response structure:', payload.data);
    return null;
  }

  const resultContent = payload.data.content;
  const cleanedResponse = cleanAIResponse(resultContent);

  try {
    return JSON.parse(cleanedResponse) as T;
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    console.error('Raw response:', cleanedResponse);
    return null;
  }
};

// ==================== API 函数 ====================

export const groupedIntelligentMatchApi = async (
  images: Array<{ base64: string; fileName: string }>,
  groupedData: Array<{
    group: string;
    rows: Array<{ customId: string; copyValue: string }>;
  }>
): Promise<Array<{
  fileName: string;
  ocrContent: string;
  group: string;
  rows: Array<{
    customId: string;
    copy: string;
    matchRate: string;
    passed: boolean;
    failed?: boolean;
    discrepancies?: Array<{ expected: string; found: string }>;
  }>;
}> | null> => {
  try {
    // 使用提取的 prompt 构建函数
    const prompt = buildGroupedMatchPrompt(images, groupedData);

    // 构建请求
    const request: AiChatRequest = {
      modelName: 'gpt-4-all',
      documents: [{
        base64url: prepareBase64Images(images),
        type: 'image',
      }],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    // 调用 API
    const response = await aiChat( request);

    return parseAIResponse(response);
  } catch (error) {
    message.error('API Call error, please try again.');
    console.error('Grouped intelligent match API error:', error);
    return null;
  }
};


// 单表格智能图片匹配API - 单表格场景的图片文本匹配
export const singleTableIntelligentMatchApi = async (
  images: Array<{ base64: string; fileName: string }>,
  selectedRows: Array<{ customId: string; copyValue: string }>
): Promise<Array<{
  matchRow: string[];
  fileName: string;
  ocrContent: string;
  rows: Array<{
    customId: string;
    copy: string;
    matchRate: string;
    passed: boolean;
    discrepancies?: Array<{ expected: string; found: string }>;
  }>;
}> | null> => {
  try {
    // 自动检测连续行分组
    const sortedRows = [...selectedRows].sort((a, b) => parseInt(a.customId) - parseInt(b.customId));
    const consecutiveGroups: Array<{ customId: string; copyValue: string }[]> = [];

    let currentGroup = [sortedRows[0]];

    for (let i = 1; i < sortedRows.length; i++) {
      const currentId = parseInt(sortedRows[i].customId);
      const previousId = parseInt(sortedRows[i - 1].customId);

      if (currentId === previousId + 1) {
        // 连续的，加入当前组
        currentGroup.push(sortedRows[i]);
      } else {
        // 不连续，保存当前组，开始新组
        consecutiveGroups.push(currentGroup);
        currentGroup = [sortedRows[i]];
      }
    }

    // 保存最后一个组
    consecutiveGroups.push(currentGroup);

    // 使用提取的 prompt 构建函数
    const prompt = buildSingleTableMatchPrompt(images, consecutiveGroups);

    // 构建请求
    const request: AiChatRequest = {
      modelName: 'gpt-4-all',
      documents: [{
        base64url: prepareBase64Images(images),
        type: 'image',
      }],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    const response = await aiChat( request);

    return parseAIResponse(response);
  } catch (error) {
    console.error('Single table intelligent match API error:', error);
    return null;
  }
};


/**
 * 上传完整的 Storage HTML 到 Confluence
 */
export interface UploadStorageRequest {
  confluenceUrl: string;
  storageHtml: string;
  images: Array<{
    fileName: string;
    base64: string;
  }>;
}

export interface UploadStorageResponse {
  success: boolean;
  message: string;
}

export const uploadStorageApi = async (
  data: UploadStorageRequest
): Promise<UploadStorageResponse> => {
  const response = await axios.post<UploadStorageResponse>(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/upload`, {
    ...data,
    staffId: getEmployeeId()
  });
  return response;
};

/**
 * 获取 Confluence 附件的 base64 数据
 */
export interface GetAttachmentsRequest {
  confluenceUrl: string;
  fileNames: string[];
}

export interface GetAttachmentsResponse {
  images: Array<{
    fileName: string;
    base64: string;
  }>;
}

export const getAttachmentsApi = async (
  data: GetAttachmentsRequest
): Promise<GetAttachmentsResponse> => {
  const response = await axios.post<GetAttachmentsResponse>(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/getAttachments`, {
    ...data,
    staffId: getEmployeeId()
  });
  return response;
};

/**
 * Language comparison request interface
 */
export interface LanguageCompareRequest {
  referenceLanguage: string;
  selectedLanguage: string;
  comparisonData: Array<{
    rowIndex: number;
    referenceValue: string;
    targetValue: string;
  }>;
}

/**
 * Language comparison API response interface
 */
export interface LanguageCompareApiResponse {
  differences: LanguageCompareDifference[];
}

const normalizeIssueType = (rawType: string): LanguageIssue['type'] | null => {
  const normalized = rawType.trim();
  const lower = normalized.toLowerCase();

  if (lower === 'semantic') {
    return 'Semantic';
  }
  if (lower === 'grammar') {
    return 'Grammar';
  }
  if (lower === 'punctuation') {
    return 'Punctuation';
  }
  if (lower === 'character') {
    return 'Character';
  }

  return null;
};

const normalizeLanguageIssue = (issue: unknown): LanguageIssue | null => {
  if (!issue || typeof issue !== 'object') return null;

  const type = (issue as { type?: unknown }).type;
  const reason = (issue as { reason?: unknown }).reason;

  if (typeof type !== 'string' || typeof reason !== 'string') {
    return null;
  }

  const normalizedType = normalizeIssueType(type);
  if (!normalizedType || reason.trim() === '') {
    return null;
  }

  return {
    type: normalizedType,
    reason: reason.trim(),
  };
};

const normalizeLanguageDifferences = (parsed: unknown): LanguageCompareDifference[] => {
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item): LanguageCompareDifference | null => {
      if (!item || typeof item !== 'object') return null;

      const rowIndex = (item as { rowIndex?: unknown }).rowIndex;
      const targetValue = (item as { targetValue?: unknown }).targetValue;
      const reasonsRaw = (item as { reasons?: unknown }).reasons;

      if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex)) return null;
      if (typeof targetValue !== 'string') return null;
      if (!Array.isArray(reasonsRaw)) return null;

      const reasons = reasonsRaw
        .map(normalizeLanguageIssue)
        .filter((reason): reason is LanguageIssue => reason !== null);

      if (reasons.length === 0) return null;

      return {
        rowIndex,
        targetValue,
        reasons,
      };
    })
    .filter((item): item is LanguageCompareDifference => item !== null);
};

/**
 * Language comparison API
 * Compares selected language column values with reference language (gl or en) column values
 * AI handles semantic + grammar detection
 * chineseUtils handles punctuation + character anomalies
 */
export const languageCompareApi = async (
  request: LanguageCompareRequest
): Promise<LanguageCompareApiResponse | null> => {
  try {
    // Use the prompt building function
    const prompt = buildLanguageComparePrompt(
      request.referenceLanguage,
      request.selectedLanguage,
      request.comparisonData
    );

    // Build the AI chat request
    const aiRequest: AiChatRequest = {
      modelName: 'gpt-4-all',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    // Call the AI API
    const apiResponse = await aiChat(aiRequest);

    // Parse the response
    if (!apiResponse.data || !apiResponse.data.content) {
      console.error('Unexpected API response structure:', apiResponse.data);
      return null;
    }

    const resultContent = apiResponse.data.content;
    console.log('=== Language Compare AI Response ===');
    console.log('Raw response:', resultContent);

    const cleanedResponse = resultContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('Cleaned response:', cleanedResponse);

    let aiDifferences: LanguageCompareDifference[] = [];

    try {
      aiDifferences = normalizeLanguageDifferences(JSON.parse(cleanedResponse));
      console.log('Parsed differences:', aiDifferences);
      console.log('Differences count:', aiDifferences.length);
      console.log('=====================================');

      // Merge with Chinese utility-detected issues (punctuation, character variants)
      const mergedDifferences = mergeChineseQualityIssues(
        aiDifferences,
        request.comparisonData,
        request.selectedLanguage
      );

      console.log('After Chinese utility merge:');
      console.log('Merged differences count:', mergedDifferences.length);

      // Return merged results
      return {
        differences: mergedDifferences
      };
    } catch (parseError) {
      message.error('Language comparison API error, please try again.');
      console.error('JSON parsing failed:', parseError);
      console.error('Raw response:', cleanedResponse);
      return null;
    }
  } catch (error) {
    message.error('Language comparison API error, please try again.');
    console.error('Language compare API error:', error);
    return null;
  }
};
