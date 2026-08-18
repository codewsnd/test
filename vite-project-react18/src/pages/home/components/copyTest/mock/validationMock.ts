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

/** 连续调用 Mock 工厂时可注入的确定性依赖。 */
export interface CopyTestValidationMockOptions {
  /** 从 0 开始的确定性 Mock 轮次。 */
  sequenceIndex?: number;
  /** 生成响应时间戳的当前时间函数。 */
  now?: () => Date;
}

/** 构建单次响应时可额外注入的随机依赖。 */
export interface CopyTestValidationResponseOptions
  extends CopyTestValidationMockOptions {
  /** 返回区间为 [0, 1) 的随机数函数。 */
  random?: () => number;
}

/** 判断未知值是否为普通对象。 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

/** 判断未知值是否为严格的上传截图输入。 */
const isRuntimeScreenshot = (
  value: unknown
): value is CopyTestValidationRuntimeContext['uploadedScreenshots'][number] => {
  return isRecord(value)
    && typeof value.fileName === 'string'
    && value.fileName.trim() !== '';
};

/** 判断未知值是否为严格的待校验行输入。 */
const isRuntimeRow = (
  value: unknown
): value is CopyTestValidationRuntimeContext['selectedRows'][number] => {
  return isRecord(value)
    && Number.isInteger(value.evidenceGroupId)
    && Number(value.evidenceGroupId) >= 0
    && Number.isInteger(value.rowIndex)
    && Number(value.rowIndex) >= 0
    && typeof value.expectedText === 'string';
};

/** 判断待校验行中的稳定下标是否全部唯一。 */
const hasUniqueRowIndexes = (
  rows: CopyTestValidationRuntimeContext['selectedRows']
): boolean => {
  return new Set(rows.map(row => row.rowIndex)).size === rows.length;
};

/** 判断运行时 JSON 是否满足 CopyTest user 消息契约。 */
const isRuntimeContext = (
  value: unknown
): value is CopyTestValidationRuntimeContext => {
  return isRecord(value)
    && typeof value.targetColumnName === 'string'
    && Array.isArray(value.selectedRows)
    && value.selectedRows.every(isRuntimeRow)
    && hasUniqueRowIndexes(value.selectedRows)
    && Array.isArray(value.uploadedScreenshots)
    && value.uploadedScreenshots.every(isRuntimeScreenshot);
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
  if (!isRuntimeContext(parsed)) {
    throw new Error('CopyTest mock received invalid runtime JSON');
  }
  return parsed;
};

/** 在包含上下界的整数范围内生成随机值。 */
const getRandomInt = (
  min: number,
  max: number,
  random: () => number
): number => {
  return Math.floor(random() * (max - min + 1)) + min;
};

/** Evidence 组选择图片时使用的分组位置与图片数量函数。 */
type EvidenceImageIndexSelector = (groupPosition: number, imageCount: number) => number;

/** 读取待校验行中按首次出现顺序排列的 Evidence 组标识。 */
const getEvidenceGroupIds = (
  rows: CopyTestValidationRuntimeContext['selectedRows']
): number[] => {
  return Array.from(new Set(rows.map(row => row.evidenceGroupId)));
};

/** 为每个 Evidence 组选择一张共享截图。 */
const buildGroupEvidenceMap = (
  rows: CopyTestValidationRuntimeContext['selectedRows'],
  fileNames: string[],
  selectImageIndex: EvidenceImageIndexSelector
): Map<number, string> => {
  if (fileNames.length === 0) {
    return new Map();
  }
  return new Map(getEvidenceGroupIds(rows).map((groupId, groupPosition) => {
    const imageIndex = selectImageIndex(groupPosition, fileNames.length);
    return [groupId, fileNames[imageIndex]];
  }));
};

/** 读取当前行所属组唯一共享的 Evidence 文件名。 */
const getRowEvidenceFileNames = (
  row: CopyTestValidationRuntimeContext['selectedRows'][number],
  fileNameByGroupId: Map<number, string>
): string[] => {
  const fileName = fileNameByGroupId.get(row.evidenceGroupId);
  return fileName ? [fileName] : [];
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
  evidenceImageFileNames: string[],
  random: () => number
): CopyTestValidationResult => {
  /** 只有存在截图证据时才允许随机生成通过结果。 */
  const passed = evidenceImageFileNames.length > 0 && random() < RANDOM_PASS_RATE;
  return {
    rowIndex: row.rowIndex,
    passed,
    evidenceImageFileNames,
    languageIssues: buildMockLanguageIssues(passed, evidenceImageFileNames, random),
  };
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
  evidenceImageFileNames: string[],
  sequenceIndex: number
): CopyTestValidationResult => {
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
  options: CopyTestValidationResponseOptions
): CopyTestValidationResult[] => {
  const sequenceIndex = options.sequenceIndex;
  /** 当前轮次为每个应用层分组锁定的唯一 Evidence。 */
  const fileNameByGroupId = buildGroupEvidenceMap(
    runtimeContext.selectedRows,
    imageFileNames,
    sequenceIndex === undefined
      ? (_groupPosition, imageCount) => getRandomInt(0, imageCount - 1, options.random || Math.random)
      : (groupPosition, imageCount) => (sequenceIndex + groupPosition) % imageCount
  );
  if (sequenceIndex !== undefined) {
    const rowCount = runtimeContext.selectedRows.length;
    return runtimeContext.selectedRows.map((row, rowPosition) => {
      return buildSequencedValidationResult(
        row,
        rowPosition,
        rowCount,
        getRowEvidenceFileNames(row, fileNameByGroupId),
        sequenceIndex
      );
    });
  }
  const random = options.random || Math.random;
  return runtimeContext.selectedRows.map(row => {
    return buildRandomValidationResult(
      row,
      getRowEvidenceFileNames(row, fileNameByGroupId),
      random
    );
  });
};

/** 按轮次生成不依赖真实时钟的 Mock 时间。 */
const getSequencedMockDate = (sequenceIndex: number): Date => {
  return new Date(MOCK_TIMESTAMP_EPOCH_MS + sequenceIndex);
};

/** 将可注入时钟转换为严格递增的工厂响应时间。 */
const createMonotonicNow = (now: () => Date): (() => Date) => {
  let previousTimestampMs: number | undefined;
  return () => {
    const currentTimestampMs = now().getTime();
    const timestampMs = previousTimestampMs === undefined
      ? currentTimestampMs
      : Math.max(currentTimestampMs, previousTimestampMs + 1);
    previousTimestampMs = timestampMs;
    return new Date(timestampMs);
  };
};

/** 根据 aiChat 请求构建可同步断言的完整 Mock 响应。 */
export const buildMockCopyTestAiChatResponse = (
  request: AiChatRequest,
  options: CopyTestValidationResponseOptions = {}
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

/** 创建每次递增轮次且时间单调的 aiChat 同签名 Mock。 */
export const createMockCopyTestAiChat = (
  options: CopyTestValidationMockOptions = {}
): typeof aiChat => {
  /** 每个 Mock 实例独立维护调用轮次，避免测试与页面实例互相污染。 */
  let sequenceIndex = options.sequenceIndex ?? 0;
  /** 固定或回拨时钟下仍保证完整响应按调用变化。 */
  const monotonicNow = options.now
    ? createMonotonicNow(options.now)
    : undefined;
  return request => {
    const response = buildMockCopyTestAiChatResponse(request, {
      ...options,
      now: monotonicNow,
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
