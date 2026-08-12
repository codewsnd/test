/**
 * 文件作用：提供与 aiChat 完全同签名、同响应外层结构的 CopyTest 轮次 Mock。
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

/** 默认轮次 Mock 的可复现时间戳起点。 */
const MOCK_TIMESTAMP_EPOCH_MS = Date.parse('2026-01-01T00:00:00.000Z');

/** 没有上传截图时返回的真实边界失败原因。 */
const NO_SCREENSHOT_FAILURE_REASON = 'No uploaded screenshot is available for validation.';

/** 随机失败结果可使用的真实测试问题说明。 */
const RANDOM_FAILURE_REASONS = [
  'OCR text does not match the selected comparison copy.',
  'Expected copy was not found in the uploaded screenshots.',
  'Screenshot contains related text, but the visible wording is different.',
  'The expected copy is incomplete or truncated in the screenshot.',
] as const;

/** Mock 可注入的随机或轮次依赖。 */
export interface CopyTestValidationMockOptions {
  /** 返回区间为 [0, 1) 的随机数函数。 */
  random?: () => number;
  /** 从 0 开始的确定性 Mock 轮次；设置后不使用随机结果。 */
  sequenceIndex?: number;
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
    rowIndex: row.rowIndex,
    passed,
    evidenceImageFileNames,
    languageIssues: buildMockLanguageIssues(passed, evidenceImageFileNames, random),
  };
};

/** 按轮次和行位置选择顺序稳定、内容会变化的真实 Evidence。 */
const getSequencedImageFileNames = (
  fileNames: string[],
  sequenceIndex: number,
  rowPosition: number,
  rowCount: number
): string[] => {
  if (fileNames.length === 0) {
    return [];
  }
  /** 每行先分配一张不同图片，当前轮次变化时同步轮转起点。 */
  const primaryIndex = (sequenceIndex + rowPosition) % fileNames.length;
  /** 首轮分配后仍可被第二张 Evidence 覆盖的唯一图片数量。 */
  const primaryImageCount = Math.min(fileNames.length, rowCount);
  const additionalImageCount = Math.min(
    fileNames.length - primaryImageCount,
    rowCount
  );
  if (rowPosition >= additionalImageCount) {
    return [fileNames[primaryIndex]];
  }
  /** 第二张图片延续轮转序列，避免与当前行第一张图片重复。 */
  const secondaryIndex = (
    sequenceIndex + primaryImageCount + rowPosition
  ) % fileNames.length;
  return [fileNames[primaryIndex], fileNames[secondaryIndex]];
};

/** 为确定性失败轮次生成可在 UI 中区分的 Mock 问题。 */
const buildSequencedLanguageIssues = (
  passed: boolean,
  evidenceImageFileNames: string[],
  sequenceIndex: number,
  rowPosition: number
): string[] => {
  if (passed) {
    return [];
  }
  const reasonIndex = (
    sequenceIndex + rowPosition
  ) % RANDOM_FAILURE_REASONS.length;
  const reason = evidenceImageFileNames.length === 0
    ? NO_SCREENSHOT_FAILURE_REASON
    : RANDOM_FAILURE_REASONS[reasonIndex];
  return [
    `Mock validation round ${sequenceIndex + 1}: ${reason}`,
  ];
};

/** 确定性轮次至少保留一个失败行，使每次响应可由轮次问题稳定区分。 */
const shouldSequencedResultPass = (
  hasEvidence: boolean,
  rowCount: number,
  sequenceIndex: number,
  rowPosition: number
): boolean => {
  if (!hasEvidence) {
    return false;
  }
  if (rowCount === 1) {
    return sequenceIndex === 0;
  }
  return (sequenceIndex + rowPosition) % 2 === 0;
};

/** 为一个选中行生成随调用轮次变化的确定性结果。 */
const buildSequencedValidationResult = (
  row: CopyTestValidationRuntimeContext['selectedRows'][number],
  rowPosition: number,
  rowCount: number,
  imageFileNames: string[],
  sequenceIndex: number
): CopyTestValidationResult => {
  const evidenceImageFileNames = getSequencedImageFileNames(
    imageFileNames,
    sequenceIndex,
    rowPosition,
    rowCount
  );
  const passed = shouldSequencedResultPass(
    evidenceImageFileNames.length > 0,
    rowCount,
    sequenceIndex,
    rowPosition
  );
  return {
    rowIndex: row.rowIndex,
    passed,
    evidenceImageFileNames,
    languageIssues: buildSequencedLanguageIssues(
      passed,
      evidenceImageFileNames,
      sequenceIndex,
      rowPosition
    ),
  };
};

/** 使用随机注入或显式轮次构建严格的逐行结果。 */
const buildMockValidationResults = (
  runtimeContext: CopyTestValidationRuntimeContext,
  imageFileNames: string[],
  options: CopyTestValidationMockOptions
): CopyTestValidationResult[] => {
  const sequenceIndex = options.sequenceIndex;
  if (sequenceIndex !== undefined) {
    const rowCount = runtimeContext.selectedRows.length;
    return runtimeContext.selectedRows.map((row, rowPosition) => {
      return buildSequencedValidationResult(
        row,
        rowPosition,
        rowCount,
        imageFileNames,
        sequenceIndex
      );
    });
  }
  const random = options.random || Math.random;
  return runtimeContext.selectedRows.map(row => {
    return buildRandomValidationResult(row, imageFileNames, random);
  });
};

/** 按轮次生成不依赖真实时钟的 Mock 时间。 */
const getSequencedMockDate = (sequenceIndex: number): Date => {
  return new Date(MOCK_TIMESTAMP_EPOCH_MS + sequenceIndex);
};

/** 根据 aiChat 请求构建可同步断言的完整 Mock 响应。 */
export const buildMockCopyTestAiChatResponse = (
  request: AiChatRequest,
  options: CopyTestValidationMockOptions = {}
): ApiResponse<AiChatResponse> => {
  /** 显式轮次同时控制结果和默认时间，保证完整响应可复现。 */
  const sequenceIndex = options.sequenceIndex;
  /** 当前 Mock 调用使用的可注入时间函数。 */
  const now = options.now || (() => {
    return sequenceIndex === undefined
      ? new Date()
      : getSequencedMockDate(sequenceIndex);
  });
  /** 从 user 消息读取的 CopyTest 运行时上下文。 */
  const runtimeContext = readRuntimeContext(request);
  /** 按本轮上传顺序读取唯一文件名，避免生成重复 Evidence。 */
  const imageFileNames = [...new Set(
    runtimeContext.uploadedScreenshots.map(image => image.fileName)
  )];
  /** 与真实 AI 契约完全一致的逐行 Mock 结果。 */
  const results = buildMockValidationResults(runtimeContext, imageFileNames, options);
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
  /** 每个 Mock 实例独立维护调用轮次，避免测试与页面实例互相污染。 */
  let sequenceIndex = options.sequenceIndex ?? 0;
  return request => {
    if (options.random) {
      return Promise.resolve(buildMockCopyTestAiChatResponse(request, options));
    }
    const response = buildMockCopyTestAiChatResponse(request, {
      ...options,
      sequenceIndex,
    });
    sequenceIndex += 1;
    return Promise.resolve(response);
  };
};

/** 默认单例当前委托的独立轮次 Mock。 */
let defaultMockCopyTestAiChat = createMockCopyTestAiChat();

/** 将默认 CopyTest Mock 重置到首轮，供新页面会话和测试隔离使用。 */
export const resetCopyTestValidationMockSequence = (): void => {
  defaultMockCopyTestAiChat = createMockCopyTestAiChat();
};

/** CopyTest 默认使用的 aiChat 同签名轮次 Mock。 */
export const mockCopyTestAiChat: typeof aiChat = request => {
  return defaultMockCopyTestAiChat(request);
};
