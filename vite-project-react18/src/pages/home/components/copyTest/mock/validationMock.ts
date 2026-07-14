/**
 * 文件作用：提供 Validate 调用 LLM 前的随机 mock 校验实现。
 */
import type {
  CopyTestImage,
  CopyTestRowInput,
  CopyTestValidationResult,
} from '../api/copyTestApi';

/** mock 里最多连续合并的行数。 */
const MAX_RANDOM_GROUP_SIZE = 3;

/** mock 里单行随机通过的概率。 */
const RANDOM_PASS_RATE = 0.65;

/** 保留可感知的 loading，同时避免 mock 阻塞浏览器回归流程。 */
const MOCK_VALIDATION_DELAY_MS = 300;

/** mock 失败原因候选。 */
const RANDOM_FAILURE_REASONS = [
  'OCR text does not match the selected comparison copy.',
  'Expected copy was not found in the uploaded screenshots.',
  'Screenshot contains similar text, but the wording is different.',
  'The selected row appears to be missing from the matched screenshot range.',
];

/** mock LLM 生成的连续行合并计划。 */
interface MockMergePlan {
  images: CopyTestImage[];
  rowSpan: number;
  rows: CopyTestRowInput[];
}

/** 生成闭区间随机整数。 */
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/** 按概率返回随机布尔值。 */
const getRandomBoolean = (rate: number): boolean => {
  return Math.random() < rate;
};

/** 等待指定毫秒数。 */
const wait = (durationMs: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, durationMs);
  });
};

/** 从数组中随机读取一个值。 */
const getRandomItem = <T>(items: T[]): T => {
  return items[getRandomInt(0, items.length - 1)];
};

/** 随机抽取若干张图片，不重复。 */
const getRandomImages = (images: CopyTestImage[]): CopyTestImage[] => {
  if (images.length === 0) {
    return [];
  }

  /** 定义 availableImages 常量。 */

  const availableImages = [...images];

  /** 定义 imageCount 常量。 */
  const imageCount = getRandomInt(1, Math.min(images.length, 2));
  return Array.from({ length: imageCount }, () => {

    /** 定义 imageIndex 常量。 */
    const imageIndex = getRandomInt(0, availableImages.length - 1);
    return availableImages.splice(imageIndex, 1)[0];
  });
};

/** 读取图片文件名。 */
const getImageFileNames = (images: CopyTestImage[]): string[] | undefined => {

  /** 定义 fileNames 常量。 */
  const fileNames = images.map(image => image.fileName).filter(Boolean);
  return fileNames.length > 0 ? fileNames : undefined;
};

/** 计算从当前位置开始最多能连续合并多少行。 */
const getMaxConsecutiveGroupSize = (rows: CopyTestRowInput[], startIndex: number): number => {

  /** 定义 maxSize 常量。 */
  const maxSize = Math.min(MAX_RANDOM_GROUP_SIZE, rows.length - startIndex);

  /** 定义 groupSize 常量。 */
  let groupSize = 1;
  while (
    groupSize < maxSize
    && rows[startIndex + groupSize]?.rowIndex === rows[startIndex].rowIndex + groupSize
  ) {
    groupSize += 1;
  }

  return groupSize;
};

/** 随机生成 LLM 返回的连续行合并计划。 */
const buildRandomMergePlans = (
  rows: CopyTestRowInput[],
  images: CopyTestImage[]
): MockMergePlan[] => {

  /** 定义 plans 常量。 */
  const plans: MockMergePlan[] = [];

  /** 定义 rowIndex 常量。 */
  let rowIndex = 0;
  while (rowIndex < rows.length) {

    /** 定义 maxGroupSize 常量。 */
    const maxGroupSize = getMaxConsecutiveGroupSize(rows, rowIndex);

    /** 定义 groupSize 常量。 */
    const groupSize = getRandomInt(1, maxGroupSize);
    plans.push({
      images: getRandomImages(images),
      rowSpan: groupSize,
      rows: rows.slice(rowIndex, rowIndex + groupSize),
    });
    rowIndex += groupSize;
  }

  return plans;
};

/** 生成 Failed 行的错误原因。 */
const buildRandomFailureFields = () => {
  /** 定义 selectedReason 常量。 */
  const selectedReason = getRandomItem(RANDOM_FAILURE_REASONS);
  return {
    languageIssues: [selectedReason],
  };
};

/** 随机生成单行校验结果。 */
const buildRandomValidationResult = (
  row: CopyTestRowInput,
  plan: MockMergePlan,
  rowOffset: number
): CopyTestValidationResult => {

  /** 定义 passed 常量。 */
  const passed = getRandomBoolean(RANDOM_PASS_RATE);

  /** 定义 failedFields 常量。 */
  const failedFields = passed ? {} : buildRandomFailureFields();
  return {
    ...failedFields,
    evidenceImageFileNames: getImageFileNames(plan.images),
    evidenceRowSpan: rowOffset === 0 ? plan.rowSpan : undefined,
    hideEvidenceCell: rowOffset > 0,
    passed,
    rowIndex: row.rowIndex,
  };
};

/** 模拟 LLM：每次调用随机返回 Passed/Failed、错误原因和需要合并的连续行组。 */
export const mockCopyTestLlmValidationApi = async (
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  targetColumnName: string,
  referenceColumnName?: string
): Promise<CopyTestValidationResult[]> => {
  void targetColumnName;
  void referenceColumnName;
  await wait(MOCK_VALIDATION_DELAY_MS);
  return buildRandomMergePlans(rows, images).flatMap(plan => {
    return plan.rows.map((row, rowOffset) => buildRandomValidationResult(row, plan, rowOffset));
  });
};

/** Upload Validate 当前使用的 mock 入口，后续可替换为真实 LLM API。 */
export const mockCopyTestValidationApi = mockCopyTestLlmValidationApi;
