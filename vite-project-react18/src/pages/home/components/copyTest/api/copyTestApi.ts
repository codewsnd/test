import axios from '@/api/axios';
import { aiChat, type AiChatRequest } from '@/api';
import { getEmployeeId } from '@/utils/userUtils';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
} from '../prompt/copyTestValidationPrompt';

/** Spring Boot 后端服务地址。 */
const SPRINGBOOT3_BACKEND_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';

export interface CopyTestStorageResponse {
  storage: string;
  confluenceTitle: string;
}

export interface CopyTestImage {
  fileName: string;
  base64: string;
  md5?: string;
}

export interface CopyTestRowInput {
  rowIndex: number;
  expected: string;
  reference?: string;
}

export interface CopyTestValidationResult {
  rowIndex: number;
  passed: boolean;
  evidenceImageFileNames?: string[];
  evidenceRowSpan?: number;
  hideEvidenceCell?: boolean;
  languageIssues?: string[];
}

interface CopyTestModelValidationResult extends CopyTestValidationResult {
  failureReason?: string;
  evidenceImageIndexes?: number[];
  resultImageIndexes?: number[];
}

/** 模型可能使用的失败原因字段名。 */
const FAILURE_REASON_FIELDS = ['failureReason', 'errorReason', 'reason'] as const;

/** AI 漏返回勾选行时使用的兜底失败原因。 */
const MISSING_MODEL_ROW_ISSUE = 'AI validation did not return this selected row.';

export interface CopyTestUploadRequest {
  confluenceUrl: string;
  storageHtml: string;
  images: CopyTestImage[];
}

export interface CopyTestAttachmentsRequest {
  confluenceUrl: string;
  fileNames: string[];
}

export interface CopyTestAttachmentsResponse {
  images: CopyTestImage[];
}

export type CopyTestUploadProgressHandler = (percent: number) => void;

/** 从 Confluence 页面读取 storage html。 */
export const copyTestStorageApi = async (confluenceUrl: string): Promise<CopyTestStorageResponse> => {
  const response = await axios.get<CopyTestStorageResponse>(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/storage`, {
    params: {
      confluenceUrl,
      staffId: getEmployeeId(),
    },
  });
  return response as unknown as CopyTestStorageResponse;
};

/** 将 copyTest 结果上传回后端。 */
export const copyTestUploadApi = async (
  data: CopyTestUploadRequest,
  onProgress?: CopyTestUploadProgressHandler
): Promise<void> => {
  await axios.post(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/upload`, {
    ...data,
    staffId: getEmployeeId(),
  }, {
    onUploadProgress: progressEvent => {
      if (!onProgress || !progressEvent.total) {
        return;
      }

      onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    },
  });
};

/** 获取 Confluence 已有附件图片的 base64 数据，用于本地 storage 预览。 */
export const copyTestAttachmentsApi = async (
  data: CopyTestAttachmentsRequest
): Promise<CopyTestAttachmentsResponse> => {
  const response = await axios.post<CopyTestAttachmentsResponse>(`${SPRINGBOOT3_BACKEND_API_URL}/api/chatbycard/copydeck/getAttachments`, {
    ...data,
    staffId: getEmployeeId(),
  });
  return response as unknown as CopyTestAttachmentsResponse;
};

/** 将内存图片转换为 aiChat 接口可识别的 data url。 */
const toDataUrl = (image: CopyTestImage): string => {
  if (image.base64.startsWith('data:')) {
    return image.base64;
  }

  return `data:image/png;base64,${image.base64}`;
};

/** 移除 AI 返回内容中可能包裹的 Markdown 代码块。 */
const stripCodeFence = (content: string): string => {
  return content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
};

/** 判断未知值是否是普通对象。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

/** 从 AI JSON 中读取结果数组。 */
const readValidationItems = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isRecord(parsed) && Array.isArray(parsed.results)) {
    return parsed.results;
  }

  return [];
};

/** 读取字符串数组字段。 */
const readStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === 'string');
};

/** 读取可选字符串字段。 */
const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value.trim();
};

/** 读取模型返回的失败原因。 */
const readFailureReason = (item: Record<string, unknown>): string | undefined => {
  const fieldName = FAILURE_REASON_FIELDS.find(field => readOptionalString(item[field]));
  return fieldName ? readOptionalString(item[fieldName]) : undefined;
};

/** 合并模型返回的错误原因和附加说明。 */
const readLanguageIssues = (item: Record<string, unknown>, passed: boolean): string[] | undefined => {
  const issues = readStringArray(item.languageIssues) || [];
  const failureReason = passed ? undefined : readFailureReason(item);
  const mergedIssues = Array.from(new Set([failureReason, ...issues].filter((issue): issue is string => Boolean(issue))));
  return mergedIssues.length > 0 ? mergedIssues : undefined;
};

/** 读取数字数组字段。 */
const readNumberArray = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is number => Number.isInteger(item));
};

/** 读取正整数 rowSpan。 */
const readPositiveInteger = (value: unknown): number | undefined => {
  if (!Number.isInteger(value) || Number(value) < 1) {
    return undefined;
  }

  return Number(value);
};

/** 按图片下标读取文件名。 */
const getImageFileNamesByIndexes = (images: CopyTestImage[], indexes?: number[]): string[] => {
  if (!indexes) {
    return [];
  }

  return indexes
    .map(index => images[index]?.fileName)
    .filter((fileName): fileName is string => Boolean(fileName));
};

/** 去重并过滤空文件名。 */
const uniqueFileNames = (fileNames: string[]): string[] => {
  return Array.from(new Set(fileNames.filter(Boolean)));
};

/** 读取本次上传图片的文件名集合。 */
const getAvailableImageFileNames = (images: CopyTestImage[]): Set<string> => {
  return new Set(images.map(image => image.fileName).filter(Boolean));
};

/** 只保留本次上传截图中的文件名。 */
const filterAvailableImageFileNames = (
  fileNames: string[],
  images: CopyTestImage[]
): string[] => {
  const availableFileNames = getAvailableImageFileNames(images);
  return fileNames.filter(fileName => availableFileNames.has(fileName));
};

/** 合并模型返回的图片下标和文件名。 */
const readImageFileNames = (
  item: CopyTestModelValidationResult,
  images: CopyTestImage[]
): string[] | undefined => {
  const imageFileNames = filterAvailableImageFileNames(uniqueFileNames([
    ...(item.evidenceImageFileNames || []),
    ...getImageFileNamesByIndexes(images, item.evidenceImageIndexes),
    ...getImageFileNamesByIndexes(images, item.resultImageIndexes),
  ]), images);
  return imageFileNames.length > 0 ? imageFileNames : undefined;
};

/** 判断 AI 返回的校验项是否具备基础字段。 */
const isModelValidationItem = (item: unknown): item is Record<string, unknown> => {
  return isRecord(item)
    && Number.isInteger(item.rowIndex)
    && typeof item.passed === 'boolean';
};

/** 将模型单项转换成前端写表格需要的结果结构。 */
const normalizeModelValidationItem = (
  item: Record<string, unknown>,
  images: CopyTestImage[]
): CopyTestValidationResult => {
  const modelItem: CopyTestModelValidationResult = {
    evidenceImageFileNames: readStringArray(item.evidenceImageFileNames),
    evidenceImageIndexes: readNumberArray(item.evidenceImageIndexes),
    evidenceRowSpan: readPositiveInteger(item.evidenceRowSpan),
    failureReason: readFailureReason(item),
    hideEvidenceCell: item.hideEvidenceCell === true,
    passed: item.passed as boolean,
    resultImageIndexes: readNumberArray(item.resultImageIndexes),
    rowIndex: item.rowIndex as number,
  };
  modelItem.languageIssues = readLanguageIssues(item, modelItem.passed);
  return {
    evidenceImageFileNames: readImageFileNames(modelItem, images),
    evidenceRowSpan: modelItem.evidenceRowSpan,
    hideEvidenceCell: modelItem.hideEvidenceCell,
    languageIssues: modelItem.languageIssues,
    passed: modelItem.passed,
    rowIndex: modelItem.rowIndex,
  };
};

/** 为 AI 漏返回的行创建 mock 同结构失败项。 */
const buildMissingRowValidationResult = (row: CopyTestRowInput): CopyTestValidationResult => {
  return {
    evidenceRowSpan: 1,
    hideEvidenceCell: false,
    languageIssues: [MISSING_MODEL_ROW_ISSUE],
    passed: false,
    rowIndex: row.rowIndex,
  };
};

/** 按 rowIndex 建立模型返回结果索引。 */
const buildValidationResultByRowIndex = (
  results: CopyTestValidationResult[]
): Map<number, CopyTestValidationResult> => {
  return new Map(results.map(result => [result.rowIndex, result]));
};

/** 将 AI 返回结果压回和 mock 一样的 selected rows 顺序。 */
const alignValidationResultsWithRows = (
  results: CopyTestValidationResult[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  const resultByRowIndex = buildValidationResultByRowIndex(results);
  return rows.map(row => resultByRowIndex.get(row.rowIndex) || buildMissingRowValidationResult(row));
};

/** 将 AI JSON 文本解析为 copyTest 校验结果。 */
const parseValidationResults = (
  content: string,
  images: CopyTestImage[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  const parsed = JSON.parse(stripCodeFence(content));
  const results = readValidationItems(parsed)
    .filter(isModelValidationItem)
    .map(item => normalizeModelValidationItem(item, images));
  return alignValidationResultsWithRows(results, rows);
};

/** 使用 aiChat 对截图和勾选行做 OCR、匹配和 Evidence 合并判断。 */
export const copyTestValidationApi = async (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string,
  referenceColumnName?: string
): Promise<CopyTestValidationResult[]> => {
  const request: AiChatRequest = {
    modelName: COPY_TEST_VALIDATION_MODEL,
    documents: [
      {
        type: 'image',
        base64url: images.map(toDataUrl),
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildCopyTestValidationPrompt(
          rows,
          targetColumnName,
          referenceColumnName,
          images.map(image => image.fileName)
        ),
      },
    ],
  };

  const response = await aiChat(request);
  const content = response.data?.content;
  if (!content) {
    throw new Error('AI validation returned empty content');
  }

  return parseValidationResults(content, images, rows);
};
