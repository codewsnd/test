/**
 * 文件作用：按严格 AI 契约生成真实随机的 CopyTest 校验结果。
 */
import type {
  CopyTestImage,
  CopyTestRowInput,
  CopyTestValidationResult,
} from '../api/copyTestApi';

/** 单个随机 Evidence 分组最多覆盖的连续逻辑行数。 */
const MAX_RANDOM_GROUP_SIZE = 3;

/** 随机结果判定为通过的概率。 */
const RANDOM_PASS_RATE = 0.65;

/** 随机失败结果可使用的真实测试问题说明。 */
const RANDOM_FAILURE_REASONS = [
  'OCR text does not match the selected comparison copy.',
  'Expected copy was not found in the uploaded screenshots.',
  'Screenshot contains similar text, but the wording is different.',
  'The selected row appears to be missing from the matched screenshot range.',
] as const;

/** 一组连续逻辑行共享的随机 Evidence 计划。 */
interface MockMergePlan {
  /** 当前分组共同引用的上传图片。 */
  images: CopyTestImage[];
  /** 当前分组覆盖的连续逻辑行数。 */
  rowSpan: number;
  /** 当前分组按请求顺序包含的逻辑行。 */
  rows: CopyTestRowInput[];
}

/** 生成包含上下界的随机整数。 */
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/** 按指定概率生成随机布尔值。 */
const getRandomBoolean = (rate: number): boolean => {
  return Math.random() < rate;
};

/** 从非空只读数组中随机选择一项。 */
const getRandomItem = <T>(items: readonly T[]): T => {
  return items[getRandomInt(0, items.length - 1)];
};

/** 从本次上传图片中随机抽取一到两张且不重复的 Evidence。 */
const getRandomImages = (images: CopyTestImage[]): CopyTestImage[] => {
  if (images.length === 0) {
    return [];
  }

  /** 尚未被当前随机分组选中的上传图片副本。 */
  const availableImages = [...images];
  /** 当前分组随机选择的一到两张 Evidence 图片数量。 */
  const imageCount = getRandomInt(1, Math.min(images.length, 2));
  return Array.from({ length: imageCount }, () => {
    /** 当前从剩余图片中抽取的位置。 */
    const imageIndex = getRandomInt(0, availableImages.length - 1);
    return availableImages.splice(imageIndex, 1)[0];
  });
};

/** 将随机 Evidence 图片转换为严格契约使用的文件名数组。 */
const getImageFileNames = (images: CopyTestImage[]): string[] | undefined => {
  /** 过滤空值后可写入严格结果的 Evidence 文件名。 */
  const fileNames = images.map(image => image.fileName).filter(Boolean);
  return fileNames.length > 0 ? fileNames : undefined;
};

/** 将所有请求行随机划分为互不重叠的合法 Evidence 分组。 */
const buildRandomMergePlans = (
  rows: CopyTestRowInput[],
  images: CopyTestImage[]
): MockMergePlan[] => {
  /** 按请求顺序累积且互不重叠的随机 Evidence 分组。 */
  const plans: MockMergePlan[] = [];
  /** 下一个尚未加入随机分组的请求行位置。 */
  let rowOffset = 0;
  while (rowOffset < rows.length) {
    /** 按 selected_rows 顺序计算当前锚点可覆盖的最大逻辑行数量。 */
    const maxGroupSize = Math.min(MAX_RANDOM_GROUP_SIZE, rows.length - rowOffset);
    /** 当前分组在合法范围内随机选出的跨度。 */
    const groupSize = getRandomInt(1, maxGroupSize);
    plans.push({
      images: getRandomImages(images),
      rowSpan: groupSize,
      rows: rows.slice(rowOffset, rowOffset + groupSize),
    });
    rowOffset += groupSize;
  }
  return plans;
};

/** 为随机失败结果生成严格非空的问题数组。 */
const buildRandomLanguageIssues = (): string[] => {
  return [getRandomItem(RANDOM_FAILURE_REASONS)];
};

/** 为 Evidence 分组中的单行生成严格契约结果。 */
const buildRandomValidationResult = (
  row: CopyTestRowInput,
  plan: MockMergePlan,
  rowOffset: number
): CopyTestValidationResult => {
  /** 当前逻辑行按固定通过概率生成的随机校验状态。 */
  const passed = getRandomBoolean(RANDOM_PASS_RATE);
  /** 当前分组共享且符合严格契约的 Evidence 文件名。 */
  const evidenceImageFileNames = getImageFileNames(plan.images);
  return {
    ...(evidenceImageFileNames ? { evidenceImageFileNames } : {}),
    ...(rowOffset === 0 ? { evidenceRowSpan: plan.rowSpan } : {}),
    ...(!passed ? { languageIssues: buildRandomLanguageIssues() } : {}),
    hideEvidenceCell: rowOffset > 0,
    passed,
    rowIndex: row.rowIndex,
  };
};

/** 为每个请求行生成顺序一致、图片合法且分组显式的随机结果。 */
export const mockCopyTestValidationApi = (
  images: CopyTestImage[],
  rows: CopyTestRowInput[]
): CopyTestValidationResult[] => {
  return buildRandomMergePlans(rows, images).flatMap(plan => {
    return plan.rows.map((row, rowOffset) => buildRandomValidationResult(row, plan, rowOffset));
  });
};
