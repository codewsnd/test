import axios from '@/api/axios';
import {
  aiChat,
  type AiChatRequest,
  type AiChatResponse,
  type ApiResponse,
} from '@/api';
import { getEmployeeId } from '@/utils/userUtils';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_MAX_LANGUAGE_ISSUE_CHARACTERS,
  COPY_TEST_MAX_LANGUAGE_ISSUES_PER_ROW,
  COPY_TEST_MAX_OUTPUT_TOKENS,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_SYSTEM_PROMPT,
} from '../prompt/copyTestValidationPrompt';
import { mockCopyTestAiChat } from '../mock/validationMock';

/** Spring Boot 后端服务地址。 */
const API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';

/** CopyTest AI 根对象唯一允许出现的字段。 */
const VALIDATION_PAYLOAD_FIELDS = new Set(['results']);

/** CopyTest AI 单行结果必须且只允许出现的字段。 */
const VALIDATION_RESULT_FIELDS = new Set([
  'evidenceImageFileNames',
  'languageIssues',
  'passed',
  'rowIndex',
]);

/** AI 契约错误使用的统一消息前缀。 */
const INVALID_AI_CONTENT_PREFIX = 'AI validation returned invalid content';

/** AI 请求接受的图片 data URL 格式。 */
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;

/** 轮次 Mock 保持 loading 可感知的最短等待时间。 */
const MOCK_VALIDATION_DELAY_MS = 300;

/** 仅在显式的本地环境开关为 true 时启用按调用轮次变化的 AI 校验结果。 */
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
  /** 用户选择图片时的原始文件名，用于界面展示。 */
  originalFileName?: string;
  /** 图片内容；发送给 AI 时必须是 image data URL。 */
  base64: string;
}

/** 单个待校验表格逻辑行。 */
export interface CopyTestRowInput {
  /** 空行分隔出的 Evidence 组首个零基业务行下标。 */
  evidenceGroupId: number;
  /** 逻辑行在数据行数组中的稳定下标。 */
  rowIndex: number;
  /** Comparison Column 中期望出现在截图里的文案。 */
  expected: string;
}

/** CopyTest AI 与轮次 Mock 共用的逐行校验结果。 */
export interface CopyTestValidationResult {
  /** AI 返回的逻辑行下标。 */
  rowIndex: number;
  /** 至少一张相关截图是否可靠支持期望文案。 */
  passed: boolean;
  /** 当前行真正相关的上传图片文件名；没有相关图片时为空数组。 */
  evidenceImageFileNames: string[];
  /** 校验失败时的问题说明；通过时为空数组。 */
  languageIssues: string[];
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
export const copyTestStorageApi = async (
  confluenceUrl: string
): Promise<CopyTestStorageResponse> => {
  /** 后端返回的当前 Confluence 页面 storage。 */
  const response = await axios.get<CopyTestStorageResponse>(
    `${API_URL}/api/chatbycard/copydeck/storage`,
    {
      params: {
        confluenceUrl,
        staffId: getEmployeeId(),
      },
      skipError: true,
    }
  );
  return response as unknown as CopyTestStorageResponse;
};

/** 将 CopyTest storage 与 Evidence 图片上传回后端。 */
export const copyTestUploadApi = async (
  data: CopyTestUploadRequest,
  onProgress?: CopyTestUploadProgressHandler
): Promise<void> => {
  await axios.post(
    `${API_URL}/api/chatbycard/copydeck/upload`,
    {
      ...data,
      staffId: getEmployeeId(),
    },
    {
      onUploadProgress: progressEvent => {
        if (!onProgress || !progressEvent.total) {
          return;
        }
        onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      },
    }
  );
};

/** 获取 Confluence 已有附件图片，供本地 storage 预览使用。 */
export const copyTestAttachmentsApi = async (
  data: CopyTestAttachmentsRequest
): Promise<CopyTestAttachmentsResponse> => {
  /** 后端按规范附件文件名返回的内存图片集合。 */
  const response = await axios.post<CopyTestAttachmentsResponse>(
    `${API_URL}/api/chatbycard/copydeck/getAttachments`,
    {
      ...data,
      staffId: getEmployeeId(),
    },
    {
      skipError: true,
    }
  );
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

/** 校验对象字段与严格契约完全一致。 */
const assertExactFields = (
  value: Record<string, unknown>,
  allowedFields: Set<string>,
  label: string
): void => {
  /** 对象中第一个不属于严格契约的字段名。 */
  const unknownField = Object.keys(value).find(field => !allowedFields.has(field));
  if (unknownField) {
    throwInvalidAiContent(`${label} contains unsupported field ${unknownField}`);
  }

  /** 严格契约中第一个没有出现在对象里的必填字段名。 */
  const missingField = [...allowedFields].find(field => {
    return !Object.prototype.hasOwnProperty.call(value, field);
  });
  if (missingField) {
    throwInvalidAiContent(`${label} is missing required field ${missingField}`);
  }
};

/** 将 AI 原始文本严格解析为唯一根对象中的 results 数组。 */
const parseValidationArray = (content: string): unknown[] => {
  /** JSON.parse 成功后尚未校验结构的顶层值。 */
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return throwInvalidAiContent('the response is not raw JSON');
  }

  if (!isRecord(parsed)) {
    return throwInvalidAiContent('the top-level value must be an object');
  }
  assertExactFields(parsed, VALIDATION_PAYLOAD_FIELDS, 'the root object');
  if (!Array.isArray(parsed.results)) {
    return throwInvalidAiContent('the results field must be an array');
  }
  return parsed.results;
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

/** 读取必填布尔 passed 字段。 */
const readPassed = (item: Record<string, unknown>, itemIndex: number): boolean => {
  /** 当前结果对象未经类型校验的 passed。 */
  const value = item.passed;
  if (typeof value !== 'boolean') {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid passed`);
  }
  return value;
};

/** 读取允许为空但不允许空白项或重复项的必填字符串数组。 */
const readRequiredStringArray = (
  item: Record<string, unknown>,
  fieldName: 'evidenceImageFileNames' | 'languageIssues',
  itemIndex: number
): string[] => {
  /** 当前结果对象未经结构校验的必填字符串数组。 */
  const value = item[fieldName];
  if (!Array.isArray(value)) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }

  /** 仅包含非空字符串的候选数组，用于发现非法成员。 */
  const strings = value.filter((entry): entry is string => {
    return typeof entry === 'string' && entry.trim() !== '';
  });
  if (strings.length !== value.length || new Set(strings).size !== strings.length) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }
  const hasInvalidIssueBounds = fieldName === 'languageIssues'
    && (
      strings.length > COPY_TEST_MAX_LANGUAGE_ISSUES_PER_ROW
      || strings.some(entry => {
        return Array.from(entry).length > COPY_TEST_MAX_LANGUAGE_ISSUE_CHARACTERS;
      })
    );
  if (hasInvalidIssueBounds) {
    return throwInvalidAiContent(`result ${itemIndex} has an invalid ${fieldName}`);
  }
  return strings;
};

/** 校验 Evidence 文件名全部来自本次上传图片。 */
const assertAvailableImageFileNames = (
  fileNames: string[],
  availableFileNames: Set<string>,
  itemIndex: number
): void => {
  if (fileNames.some(fileName => !availableFileNames.has(fileName))) {
    throwInvalidAiContent(`result ${itemIndex} references an unknown image fileName`);
  }
};

/** 校验通过状态、Evidence 和语言问题之间的严格关系。 */
const assertResultSemantics = (
  passed: boolean,
  evidenceImageFileNames: string[],
  languageIssues: string[],
  itemIndex: number
): void => {
  if (passed && evidenceImageFileNames.length === 0) {
    throwInvalidAiContent(`result ${itemIndex} must include Evidence when passed is true`);
  }
  if (passed && languageIssues.length > 0) {
    throwInvalidAiContent(`result ${itemIndex} must use empty languageIssues when passed is true`);
  }
  if (!passed && languageIssues.length === 0) {
    throwInvalidAiContent(`result ${itemIndex} must include languageIssues when passed is false`);
  }
};

/** 将一个严格合法的 AI 对象转换为逐行校验结果。 */
const parseValidationItem = (
  value: unknown,
  availableFileNames: Set<string>,
  itemIndex: number
): CopyTestValidationResult => {
  if (!isRecord(value)) {
    return throwInvalidAiContent(`result ${itemIndex} must be an object`);
  }
  assertExactFields(value, VALIDATION_RESULT_FIELDS, `result ${itemIndex}`);
  /** 通过严格整数校验的请求行下标。 */
  const rowIndex = readRowIndex(value, itemIndex);
  /** 当前结果通过严格布尔校验后的通过状态。 */
  const passed = readPassed(value, itemIndex);
  /** 当前结果引用且已通过数组结构校验的 Evidence 文件名。 */
  const evidenceImageFileNames = readRequiredStringArray(
    value,
    'evidenceImageFileNames',
    itemIndex
  );
  /** 当前结果通过数组结构校验的问题说明。 */
  const languageIssues = readRequiredStringArray(value, 'languageIssues', itemIndex);
  assertAvailableImageFileNames(evidenceImageFileNames, availableFileNames, itemIndex);
  assertResultSemantics(passed, evidenceImageFileNames, languageIssues, itemIndex);
  return {
    evidenceImageFileNames,
    languageIssues,
    passed,
    rowIndex,
  };
};

/** 校验每个请求行都带有合法的应用层 Evidence 分组标识。 */
const assertValidEvidenceGroupIds = (rows: CopyTestRowInput[]): void => {
  if (rows.some(row => !Number.isInteger(row.evidenceGroupId) || row.evidenceGroupId < 0)) {
    throwInvalidAiContent('requested evidenceGroupId values must be non-negative integers');
  }
};

/** 解析并校验 AI 返回的逐行 CopyTest 根对象契约。 */
export const parseCopyTestValidationResults = (
  content: string,
  images: CopyTestImage[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  assertValidEvidenceGroupIds(rows);
  /** 本次上传图片允许被 AI 引用的唯一文件名集合。 */
  const availableFileNames = new Set(images.map(image => image.fileName));
  /** 完成字段、图片来源和通过状态语义校验的逐行结果。 */
  const results = parseValidationArray(content).map((item, itemIndex) => {
    return parseValidationItem(item, availableFileNames, itemIndex);
  });
  return results;
};

/** 解包 aiChat 响应并通过唯一严格解析器生成逐行结果。 */
export const parseCopyTestValidationResponse = (
  response: ApiResponse<AiChatResponse>,
  images: CopyTestImage[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  if (!response.success) {
    throw new Error(response.error || 'AI validation request failed');
  }
  /** AI 响应中必须承载严格根对象 JSON 的文本内容。 */
  const content = response.data?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return throwInvalidAiContent('the response is empty');
  }
  return parseCopyTestValidationResults(content, images, rows);
};

/** 读取 AI 请求图片，仅接受完整 image data URL。 */
const getImageDataUrl = (image: CopyTestImage): string => {
  if (!IMAGE_DATA_URL_PATTERN.test(image.base64)) {
    throw new Error(`CopyTest image ${image.fileName} must use an image data URL`);
  }
  return image.base64;
};

/** 构建稳定 system prompt 与纯运行时 user JSON 分离的 aiChat 请求。 */
export const buildCopyTestValidationRequest = (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string
): AiChatRequest => {
  return {
    maxTokens: COPY_TEST_MAX_OUTPUT_TOKENS,
    modelName: COPY_TEST_VALIDATION_MODEL,
    documents: [
      {
        type: 'image',
        base64url: images.map(getImageDataUrl),
      },
    ],
    messages: [
      {
        role: 'system',
        content: COPY_TEST_VALIDATION_SYSTEM_PROMPT,
      },
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

/** 判断当前运行环境是否应该返回轮次 Mock 校验结果。 */
const shouldUseCopyTestAiChatMock = (): boolean => {
  return COPY_TEST_AI_CHAT_MOCK_ENABLED;
};

/** 在返回轮次 Mock 前保留短暂且可感知的异步 loading。 */
const waitForMockValidation = (): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, MOCK_VALIDATION_DELAY_MS);
  });
};

/** 通过真实或 Mock aiChat 执行同一请求并返回同一响应外层结构。 */
const executeValidationRequest = async (
  request: AiChatRequest
): Promise<ApiResponse<AiChatResponse>> => {
  if (!shouldUseCopyTestAiChatMock()) {
    return aiChat(request);
  }
  await waitForMockValidation();
  return mockCopyTestAiChat(request);
};

/** 使用 Mock 或真实 aiChat 校验截图，并经同一严格解析器返回逐行结果。 */
export const copyTestValidationApi = async (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string
): Promise<CopyTestValidationResult[]> => {
  /** 当前校验稳定 system prompt 与运行时 JSON 分离后的请求。 */
  const request = buildCopyTestValidationRequest(images, rows, targetColumnName);
  /** Mock 与真实 aiChat 完全相同的响应外层对象。 */
  const response = await executeValidationRequest(request);
  return parseCopyTestValidationResponse(response, images, rows);
};
