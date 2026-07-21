/**
 * 文件作用：提供与 aiChat 完全同签名、同响应外层结构的 CopyTest 随机 Mock。
 */
import {
  aiChat,
  type AiChatRequest,
  type AiChatResponse,
  type ApiResponse,
} from '@/api';
import type { CopyTestValidationResult } from '../api/copyTestApi';
import {
  COPY_TEST_VALIDATION_MODEL,
  type CopyTestValidationRuntimeContext,
} from '../prompt/copyTestValidationPrompt';

/** 随机结果判定为通过的概率。 */
const RANDOM_PASS_RATE = 0.65;

/** 单行随机 Evidence 最多引用的图片数量。 */
const MAX_RANDOM_IMAGE_COUNT = 2;

/** 没有上传截图时返回的真实边界失败原因。 */
const NO_SCREENSHOT_FAILURE_REASON = 'No uploaded screenshot is available for validation.';

/** 随机失败结果可使用的真实测试问题说明。 */
const RANDOM_FAILURE_REASONS = [
  'OCR text does not match the selected comparison copy.',
  'Expected copy was not found in the uploaded screenshots.',
  'Screenshot contains related text, but the visible wording is different.',
  'The expected copy is incomplete or truncated in the screenshot.',
] as const;

/** 随机 Mock 可注入的确定性依赖。 */
export interface CopyTestValidationMockOptions {
  /** 返回区间为 [0, 1) 的随机数函数。 */
  random?: () => number;
  /** 生成响应时间戳的当前时间函数。 */
  now?: () => Date;
}

/** 判断未知值是否为普通对象。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

/** 读取 aiChat 请求中唯一的 CopyTest 运行时 user 消息。 */
const readRuntimeContext = (
  request: AiChatRequest
): CopyTestValidationRuntimeContext => {
  /** 当前请求中承载 CopyTest 运行时 JSON 的 user 消息。 */
  const runtimeMessage = [...request.messages]
    .reverse()
    .find(message => message.role === 'user');
  if (!runtimeMessage) {
    throw new Error('CopyTest mock requires a user runtime message');
  }

  /** user 消息反序列化后的未知运行时值。 */
  const parsed: unknown = JSON.parse(runtimeMessage.content);
  if (!isRecord(parsed)
    || !Array.isArray(parsed.selectedRows)
    || !Array.isArray(parsed.uploadedScreenshots)) {
    throw new Error('CopyTest mock received invalid runtime JSON');
  }
  return parsed as unknown as CopyTestValidationRuntimeContext;
};

/** 在包含上下界的整数范围内生成随机值。 */
const getRandomInt = (
  min: number,
  max: number,
  random: () => number
): number => {
  return Math.floor(random() * (max - min + 1)) + min;
};

/** 从上传图片中随机选出不重复的 Evidence 文件名。 */
const getRandomImageFileNames = (
  fileNames: string[],
  random: () => number
): string[] => {
  if (fileNames.length === 0) {
    return [];
  }

  /** 当前行允许随机引用的最大图片数量。 */
  const maxImageCount = Math.min(fileNames.length, MAX_RANDOM_IMAGE_COUNT);
  /** 当前行随机生成的 Evidence 数量；存在上传图片时至少引用一张真实图片。 */
  const imageCount = getRandomInt(1, maxImageCount, random);
  /** 尚未被当前行选中的上传图片副本。 */
  const availableFileNames = [...fileNames];
  /** 当前行最终引用的唯一 Evidence 文件名。 */
  const selectedFileNames: string[] = [];
  while (selectedFileNames.length < imageCount) {
    /** 当前从剩余图片中随机抽取的位置。 */
    const imageIndex = getRandomInt(0, availableFileNames.length - 1, random);
    selectedFileNames.push(availableFileNames.splice(imageIndex, 1)[0]);
  }
  return selectedFileNames;
};

/** 从失败原因集合中随机选出一条真实问题说明。 */
const getRandomFailureReason = (random: () => number): string => {
  /** 当前随机命中的失败原因下标。 */
  const reasonIndex = getRandomInt(0, RANDOM_FAILURE_REASONS.length - 1, random);
  return RANDOM_FAILURE_REASONS[reasonIndex];
};

/** 根据通过状态和真实 Evidence 生成契合当前结果的问题列表。 */
const buildMockLanguageIssues = (
  passed: boolean,
  evidenceImageFileNames: string[],
  random: () => number
): string[] => {
  if (passed) {
    return [];
  }
  if (evidenceImageFileNames.length === 0) {
    return [NO_SCREENSHOT_FAILURE_REASON];
  }
  return [getRandomFailureReason(random)];
};

/** 为一个选中行生成严格的逐行校验结果。 */
const buildRandomValidationResult = (
  row: CopyTestValidationRuntimeContext['selectedRows'][number],
  imageFileNames: string[],
  random: () => number
): CopyTestValidationResult => {
  /** 当前行随机选出的相关截图文件名。 */
  const evidenceImageFileNames = getRandomImageFileNames(imageFileNames, random);
  /** 只有存在截图证据时才允许随机生成通过结果。 */
  const passed = evidenceImageFileNames.length > 0 && random() < RANDOM_PASS_RATE;
  return {
    evidenceImageFileNames,
    languageIssues: buildMockLanguageIssues(passed, evidenceImageFileNames, random),
    passed,
    rowIndex: row.rowIndex,
  };
};

/** 根据 aiChat 请求构建可同步断言的完整 Mock 响应。 */
export const buildMockCopyTestAiChatResponse = (
  request: AiChatRequest,
  options: CopyTestValidationMockOptions = {}
): ApiResponse<AiChatResponse> => {
  /** 当前 Mock 调用使用的可注入随机数函数。 */
  const random = options.random || Math.random;
  /** 当前 Mock 调用使用的可注入时间函数。 */
  const now = options.now || (() => new Date());
  /** 从 user 消息读取的 CopyTest 运行时上下文。 */
  const runtimeContext = readRuntimeContext(request);
  /** 按上传顺序读取且只允许模型引用的图片文件名。 */
  const imageFileNames = runtimeContext.uploadedScreenshots.map(image => image.fileName);
  /** 与真实 AI 契约完全一致的逐行随机结果。 */
  const results = runtimeContext.selectedRows.map(row => {
    return buildRandomValidationResult(row, imageFileNames, random);
  });
  /** 写入 AiChatResponse.content 的严格根对象 JSON。 */
  const content = JSON.stringify({ results });
  return {
    success: true,
    data: {
      characterCount: content.length,
      content,
      modelName: COPY_TEST_VALIDATION_MODEL,
      timestamp: now().toISOString(),
    },
  };
};

/** 创建可注入随机数和时间的 aiChat 同签名 Mock。 */
export const createMockCopyTestAiChat = (
  options: CopyTestValidationMockOptions = {}
): typeof aiChat => {
  return request => {
    return Promise.resolve(buildMockCopyTestAiChatResponse(request, options));
  };
};

/** CopyTest 默认使用的 aiChat 同签名随机 Mock。 */
export const mockCopyTestAiChat: typeof aiChat = createMockCopyTestAiChat();
