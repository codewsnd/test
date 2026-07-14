import axios from '@/api/axios';
import { aiChat, type AiChatRequest } from '@/api';
import { getEmployeeId } from '@/utils/userUtils';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
} from '../prompt/copyTestValidationPrompt';
import { mockCopyTestValidationApi } from '../mock/validationMock';

/** Spring Boot 后端服务地址。 */
const API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';

/** CopyTest AI 返回值允许出现的字段。 */
const VALIDATION_RESULT_FIELDS = new Set([
  'evidenceImageFileNames',
  'evidenceRowSpan',
  'hideEvidenceCell',
  'languageIssues',
  'passed',
  'rowIndex',
]);

/** AI 契约错误使用的统一消息前缀。 */
const INVALID_AI_CONTENT_PREFIX = 'AI validation returned invalid content';

/** AI 请求接受的图片 data URL 格式。 */
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

/** 随机 mock 保持 loading 可感知的最短等待时间。 */
const MOCK_VALIDATION_DELAY_MS = 300;

/** 临时启用随机 AI 校验结果；设为 false 后恢复真实 aiChat。 */
export const COPY_TEST_AI_CHAT_MOCK_ENABLED = true;

/** Confluence storage 查询接口的返回结构。 */
export interface CopyTestStorageResponse {
  /** Confluence 页面正文的 storage HTML。 */
  storage: string;
}

/** CopyTest 在浏览器内传递的图片数据。 */
export interface CopyTestImage {
  /** 图片文件名，也是 AI Evidence 返回时使用的稳定标识。 */
  fileName: string;
  /** 图片内容；发送给 AI 时必须是 image data URL。 */
  base64: string;
}

/** 单个待校验表格逻辑行。 */
export interface CopyTestRowInput {
  /** 逻辑行在数据行数组中的稳定下标。 */
  rowIndex: number;
  /** Comparison Column 中期望出现在截图里的文案。 */
  expected: string;
}

/** CopyTest AI 与随机 mock 共用的唯一校验结果结构。 */
export interface CopyTestValidationResult {
  /** 与请求行完全一致的逻辑行下标。 */
  rowIndex: number;
  /** 截图证据是否与期望文案一致。 */
  passed: boolean;
  /** Evidence 使用的上传图片文件名。 */
  evidenceImageFileNames?: string[];
  /** Evidence 锚点覆盖的连续逻辑行数。 */
  evidenceRowSpan?: number;
  /** 当前行是否隐藏 Evidence 单元格并归入前一个锚点。 */
  hideEvidenceCell: boolean;
  /** 校验失败时给测试人员的具体问题说明。 */
  languageIssues?: string[];
}

/** 上传 CopyTest storage 与 Evidence 图片的请求结构。 */
export interface CopyTestUploadRequest {
  /** 需要回写的 Confluence 页面 URL。 */
  confluenceUrl: string;
  /** 只包含当前 CopyTest 变更的完整 storage HTML。 */
  storageHtml: string;
  /** 回写 storage 引用的 Evidence 图片。 */
  images: CopyTestImage[];
}

/** 获取 Confluence 附件图片的请求结构。 */
export interface CopyTestAttachmentsRequest {
  /** 附件所属的 Confluence 页面 URL。 */
  confluenceUrl: string;
  /** storage 中需要加载预览的附件文件名。 */
  fileNames: string[];
}

/** 获取 Confluence 附件图片的返回结构。 */
export interface CopyTestAttachmentsResponse {
  /** 已转换为浏览器可用内容的附件图片。 */
  images: CopyTestImage[];
}

/** CopyTest storage 上传进度回调。 */
export type CopyTestUploadProgressHandler = (percent: number) => void;

/** 从 Confluence 页面读取 storage HTML。 */
export const copyTestStorageApi = async (confluenceUrl: string): Promise<CopyTestStorageResponse> => {
  /** 后端返回的当前 Confluence 页面 storage。 */
  const response = await axios.get<CopyTestStorageResponse>(`${API_URL}/api/chatbycard/copydeck/storage`, {
    params: {
      confluenceUrl,
      staffId: getEmployeeId(),
    },
  });
  return response as unknown as CopyTestStorageResponse;
};

/** 将 CopyTest storage 与 Evidence 图片上传回后端。 */
export const copyTestUploadApi = async (
  data: CopyTestUploadRequest,
  onProgress?: CopyTestUploadProgressHandler
): Promise<void> => {
  await axios.post(`${API_URL}/api/chatbycard/copydeck/upload`, {
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

/** 获取 Confluence 已有附件图片，供本地 storage 预览使用。 */
export const copyTestAttachmentsApi = async (
  data: CopyTestAttachmentsRequest
): Promise<CopyTestAttachmentsResponse> => {
  /** 后端按规范附件文件名返回的内存图片集合。 */
  const response = await axios.post<CopyTestAttachmentsResponse>(`${API_URL}/api/chatbycard/copydeck/getAttachments`, {
    ...data,
    staffId: getEmployeeId(),
  });
  return response as unknown as CopyTestAttachmentsResponse;
};

/** 以统一错误格式终止整批 AI 结果解析。 */
const throwInvalidAiContent = (reason: string): never => {
  throw new Error(`${INVALID_AI_CONTENT_PREFIX}: ${reason}`);
};

/** 判断未知值是否是可读取字段的普通对象。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

/** 将 AI 原始文本严格解析为顶层 JSON 数组。 */
const parseValidationArray = (content: string): unknown[] => {
  /** JSON.parse 成功后尚未校验结构的顶层值。 */
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return throwInvalidAiContent('the response is not raw JSON');
  }

  if (!Array.isArray(parsed)) {
    return throwInvalidAiContent('the top-level value must be an array');
  }
  return parsed;
};

/** 拒绝单项结果中不属于严格契约的字段。 */
const assertAllowedFields = (item: Record<string, unknown>, itemIndex: number): void => {
  /** 当前结果对象中第一个不属于严格契约的字段名。 */
  const unknownField = Object.keys(item).find(field => !VALIDATION_RESULT_FIELDS.has(field));
  if (unknownField) {
    throwInvalidAiContent(`result ${itemIndex} contains unsupported field ${unknownField}`);
  }
};

/** 读取必填的非负整数 rowIndex。 */
const readRowIndex = (item: Record<string, unknown>, itemIndex: number): number => {
  /** 当前结果对象未经类型校验的 rowIndex。 */
  const value = item.rowIndex;
  if (!Number.isInteger(value) || Number(value) < 0) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid rowIndex`);
  }
  return Number(value);
};

/** 读取必填布尔字段。 */
const readRequiredBoolean = (
  item: Record<string, unknown>,
  fieldName: 'hideEvidenceCell' | 'passed',
  itemIndex: number
): boolean => {
  /** 当前结果对象未经类型校验的必填布尔字段值。 */
  const value = item[fieldName];
  if (typeof value !== 'boolean') {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }
  return value;
};

/** 读取可选的正整数 Evidence row span。 */
const readEvidenceRowSpan = (
  item: Record<string, unknown>,
  itemIndex: number
): number | undefined => {
  /** 当前结果对象未经类型校验的 Evidence 分组跨度。 */
  const value = item.evidenceRowSpan;
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || Number(value) < 1) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid evidenceRowSpan`);
  }
  return Number(value);
};

/** 读取不允许空值、空白项或重复项的可选字符串数组。 */
const readOptionalStringArray = (
  item: Record<string, unknown>,
  fieldName: 'evidenceImageFileNames' | 'languageIssues',
  itemIndex: number
): string[] | undefined => {
  /** 当前结果对象未经结构校验的可选字符串数组。 */
  const value = item[fieldName];
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }

  /** 仅包含非空字符串的候选数组，用于发现非法成员。 */
  const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
  if (strings.length !== value.length || new Set(strings).size !== strings.length) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }
  return strings;
};

/** 校验 Evidence 文件名全部来自本次上传图片。 */
const assertAvailableImageFileNames = (
  fileNames: string[] | undefined,
  availableFileNames: Set<string>,
  itemIndex: number
): void => {
  if (fileNames?.some(fileName => !availableFileNames.has(fileName))) {
    throwInvalidAiContent(`result ${itemIndex} references an unknown image fileName`);
  }
};

/** 校验 passed 与 languageIssues 的互斥关系。 */
const assertLanguageIssueContract = (
  passed: boolean,
  languageIssues: string[] | undefined,
  itemIndex: number
): void => {
  if (passed && languageIssues) {
    throwInvalidAiContent(`result ${itemIndex} must omit languageIssues when passed is true`);
  }
  if (!passed && !languageIssues) {
    throwInvalidAiContent(`result ${itemIndex} must include languageIssues when passed is false`);
  }
};

/** 将一个严格合法的 AI 对象转换为唯一结果结构。 */
const parseValidationItem = (
  value: unknown,
  availableFileNames: Set<string>,
  itemIndex: number
): CopyTestValidationResult => {
  if (!isRecord(value)) {
    return throwInvalidAiContent(`result ${itemIndex} must be an object`);
  }
  assertAllowedFields(value, itemIndex);
  /** 通过严格整数校验的请求行下标。 */
  const rowIndex = readRowIndex(value, itemIndex);
  /** 当前结果通过严格布尔校验后的通过状态。 */
  const passed = readRequiredBoolean(value, 'passed', itemIndex);
  /** 当前结果通过严格布尔校验后的 Evidence 隐藏状态。 */
  const hideEvidenceCell = readRequiredBoolean(value, 'hideEvidenceCell', itemIndex);
  /** 当前锚点行可选的合法 Evidence 分组跨度。 */
  const evidenceRowSpan = readEvidenceRowSpan(value, itemIndex);
  /** 当前结果引用且已通过数组结构校验的 Evidence 文件名。 */
  const evidenceImageFileNames = readOptionalStringArray(value, 'evidenceImageFileNames', itemIndex);
  /** 当前失败结果通过数组结构校验的问题说明。 */
  const languageIssues = readOptionalStringArray(value, 'languageIssues', itemIndex);
  assertAvailableImageFileNames(evidenceImageFileNames, availableFileNames, itemIndex);
  assertLanguageIssueContract(passed, languageIssues, itemIndex);
  return {
    ...(evidenceImageFileNames ? { evidenceImageFileNames } : {}),
    ...(evidenceRowSpan ? { evidenceRowSpan } : {}),
    ...(languageIssues ? { languageIssues } : {}),
    hideEvidenceCell,
    passed,
    rowIndex,
  };
};

/** 校验结果条数、顺序和 rowIndex 与请求完全一致。 */
const assertRowsMatchRequest = (
  results: CopyTestValidationResult[],
  rows: CopyTestRowInput[]
): void => {
  if (results.length !== rows.length) {
    throwInvalidAiContent('the result count must equal the requested row count');
  }
  /** 第一个没有保持请求 rowIndex 顺序的结果位置。 */
  const mismatchIndex = results.findIndex((result, index) => result.rowIndex !== rows[index].rowIndex);
  if (mismatchIndex >= 0) {
    throwInvalidAiContent(`result ${mismatchIndex} does not match the requested row order`);
  }
};

/** 判断两行 Evidence 是否引用完全相同且顺序一致的图片。 */
const hasSameEvidenceImages = (
  left: string[] | undefined,
  right: string[] | undefined
): boolean => {
  /** 左侧结果的 Evidence 文件名；缺省时按空集合比较。 */
  const leftNames = left || [];
  /** 右侧结果的 Evidence 文件名；缺省时按空集合比较。 */
  const rightNames = right || [];
  return leftNames.length === rightNames.length
    && leftNames.every((fileName, index) => fileName === rightNames[index]);
};

/** 校验 Evidence 分组中的单个续行。 */
const assertEvidenceContinuation = (
  anchor: CopyTestValidationResult,
  continuation: CopyTestValidationResult,
  itemIndex: number
): void => {
  if (!continuation.hideEvidenceCell) {
    throwInvalidAiContent(`result ${itemIndex} must be an Evidence continuation`);
  }
  if (continuation.evidenceRowSpan !== undefined) {
    throwInvalidAiContent(`result ${itemIndex} must omit evidenceRowSpan`);
  }
  if (!hasSameEvidenceImages(anchor.evidenceImageFileNames, continuation.evidenceImageFileNames)) {
    throwInvalidAiContent(`result ${itemIndex} must reuse its Evidence anchor images`);
  }
};

/** 读取 Evidence 锚点必填的分组跨度。 */
const readAnchorRowSpan = (
  anchor: CopyTestValidationResult,
  anchorIndex: number
): number => {
  if (anchor.evidenceRowSpan === undefined) {
    return throwInvalidAiContent(`result ${anchorIndex} must include evidenceRowSpan`);
  }
  return anchor.evidenceRowSpan;
};

/** 校验所有 Evidence 锚点与续行形成无嵌套、无越界的显式分组。 */
const assertEvidenceGroups = (results: CopyTestValidationResult[]): void => {
  /** 当前待校验 Evidence 锚点在结果数组中的位置。 */
  let anchorIndex = 0;
  while (anchorIndex < results.length) {
    /** 当前显式 Evidence 分组的锚点结果。 */
    const anchor = results[anchorIndex];
    if (anchor.hideEvidenceCell) {
      throwInvalidAiContent(`result ${anchorIndex} has no Evidence anchor`);
    }
    /** 当前 Evidence 锚点声明的连续逻辑行数量。 */
    const rowSpan = readAnchorRowSpan(anchor, anchorIndex);
    /** 当前 Evidence 分组在结果数组中的开区间终点。 */
    const groupEnd = anchorIndex + rowSpan;
    if (groupEnd > results.length) {
      throwInvalidAiContent(`result ${anchorIndex} has an out-of-range evidenceRowSpan`);
    }
    for (let itemIndex = anchorIndex + 1; itemIndex < groupEnd; itemIndex += 1) {
      assertEvidenceContinuation(anchor, results[itemIndex], itemIndex);
    }
    anchorIndex = groupEnd;
  }
};

/** 严格解析并校验 AI 返回的唯一 CopyTest JSON 数组契约。 */
export const parseCopyTestValidationResults = (
  content: string,
  images: CopyTestImage[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  /** 本次上传图片允许被 AI 引用的唯一文件名集合。 */
  const availableFileNames = new Set(images.map(image => image.fileName));
  /** 严格完成字段解析但尚未校验请求顺序和分组的结果。 */
  const results = parseValidationArray(content)
    .map((item, itemIndex) => parseValidationItem(item, availableFileNames, itemIndex));
  assertRowsMatchRequest(results, rows);
  assertEvidenceGroups(results);
  return results;
};

/** 读取 AI 请求图片，仅接受完整 image data URL。 */
const getImageDataUrl = (image: CopyTestImage): string => {
  if (!IMAGE_DATA_URL_PATTERN.test(image.base64)) {
    throw new Error(`CopyTest image ${image.fileName} must use an image data URL`);
  }
  return image.base64;
};

/** 构建只包含当前严格 CopyTest 契约的 aiChat 请求。 */
const buildValidationRequest = (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string
): AiChatRequest => {
  return {
    modelName: COPY_TEST_VALIDATION_MODEL,
    documents: [
      {
        type: 'image',
        base64url: images.map(getImageDataUrl),
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildCopyTestValidationPrompt(
          rows,
          targetColumnName,
          images.map(image => image.fileName)
        ),
      },
    ],
  };
};

/** 判断当前运行环境是否应该返回随机 mock 校验结果。 */
const shouldUseCopyTestAiChatMock = (): boolean => {
  return COPY_TEST_AI_CHAT_MOCK_ENABLED && import.meta.env.MODE !== 'test';
};

/** 在返回随机 mock 前保留短暂且可感知的异步 loading。 */
const waitForMockValidation = (): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, MOCK_VALIDATION_DELAY_MS);
  });
};

/** 使用 mock 或 aiChat 校验截图，并返回严格契约结果。 */
export const copyTestValidationApi = async (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string
): Promise<CopyTestValidationResult[]> => {
  if (shouldUseCopyTestAiChatMock()) {
    await waitForMockValidation();
    return mockCopyTestValidationApi(images, rows);
  }

  /** 真实 aiChat 返回的原始响应对象。 */
  const response = await aiChat(buildValidationRequest(images, rows, targetColumnName));
  /** AI 响应中必须承载严格 JSON 数组的文本内容。 */
  const content = response.data?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('AI validation returned empty content');
  }

  return parseCopyTestValidationResults(content, images, rows);
};
