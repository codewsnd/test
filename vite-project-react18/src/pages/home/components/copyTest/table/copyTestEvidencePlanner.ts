/**
 * 文件作用：根据逐行 AI 图片命中关系，纯计算 Test Evidence 合并组与 Test Result 图片引用。
 */
import type { CopyTestImage } from '../api/copyTestApi';
import { getCopyTestImageDisplayName } from './copyTestImageUtils';

/** Evidence Planner 接收的不可拆分来源原子组。 */
export interface CopyTestEvidenceSourceGroup {
  /** 来源单元格在物理数据行中的锚点下标。 */
  anchorRowIndex: number;
  /** Comparison Column 按空行边界确定的稳定 Evidence 结构组标识。 */
  evidenceGroupId: number;
  /** 当前原子组逐行校验命中的 Evidence 图片。 */
  evidenceImages: CopyTestImage[];
  /** 本轮 AI 为当前原子组选择的唯一图片；仅用于新增动态合并边。 */
  currentEvidenceFileName?: string;
  /** 当前原子组是否已有 AI 校验结果。 */
  hasResult: boolean;
  /** 来源单元格实际覆盖的物理行数。 */
  rowSpan: number;
  /** 当前原子组是否被用户选中参与校验。 */
  selected: boolean;
}

/** Evidence 或 Result 中可直接渲染的 Screen 引用。 */
export interface CopyTestEvidenceScreen {
  /** 当前 Screen 对应的上传图片。 */
  image: CopyTestImage;
  /** 优先使用原始文件名主体，缺失时回退到附件名主体。 */
  label: string;
}

/** 单个来源原子组对应的 Result 图片规划。 */
export interface CopyTestEvidenceRowResultPlan {
  /** 来源原子组的锚点物理行下标。 */
  anchorRowIndex: number;
  /** 来源原子组不可拆分的物理行数。 */
  rowSpan: number;
  /** 当前 Result 真正使用的 Screen 子集。 */
  screens: CopyTestEvidenceScreen[];
}

/** 一个连续 Test Evidence 合并组的完整规划。 */
export interface CopyTestEvidenceGroupPlan {
  /** Evidence 合并单元格的锚点物理行下标。 */
  anchorRowIndex: number;
  /** Evidence 合并单元格覆盖的物理行数。 */
  rowSpan: number;
  /** 组内每个来源原子组对应的 Result 图片规划。 */
  rowResults: CopyTestEvidenceRowResultPlan[];
  /** 图片文件名到当前组 Screen 标签的映射。 */
  screenLabelByFileName: Record<string, string>;
  /** Evidence 合并单元格按上传顺序展示的去重 Screen。 */
  screens: CopyTestEvidenceScreen[];
  /** 被当前 Evidence 合并组完整包含的来源原子组。 */
  sourceGroups: CopyTestEvidenceSourceGroup[];
}

/** Planner 构建过程中使用的可变 Evidence 组。 */
interface MutableEvidenceGroup {
  /** 当前结构组的稳定标识。 */
  evidenceGroupId: number;
  /** 当前组完整包含的来源原子组。 */
  sourceGroups: CopyTestEvidenceSourceGroup[];
}

/** 判断两张 Evidence 是否代表同一张图片。 */
const hasSameImageIdentity = (
  existingImage: CopyTestImage,
  nextImage: CopyTestImage
): boolean => {
  if (existingImage.fileName === nextImage.fileName) {
    return true;
  }

  return existingImage.base64.trim() !== ''
    && existingImage.base64 === nextImage.base64;
};

/** 按文件名去重上传图片，并保留首次上传顺序。 */
const deduplicateUploadedImages = (uploadedImages: CopyTestImage[]): CopyTestImage[] => {
  /** 已加入结果的图片文件名。 */
  const addedFileNames = new Set<string>();
  return uploadedImages.filter(image => {
    if (addedFileNames.has(image.fileName)) {
      return false;
    }

    addedFileNames.add(image.fileName);
    return true;
  });
};

/** 在单个最终 Evidence 组内按文件名或非空内容去重。 */
const deduplicateGroupImages = (images: CopyTestImage[]): CopyTestImage[] => {
  /** 当前组已接受的图片，保持历史顺序。 */
  const acceptedImages: CopyTestImage[] = [];
  return images.filter(image => {
    if (acceptedImages.some(acceptedImage => hasSameImageIdentity(acceptedImage, image))) {
      return false;
    }

    acceptedImages.push(image);
    return true;
  });
};

/** 按上传顺序筛选当前来源原子组真正命中的图片。 */
const orderSourceImages = (
  sourceGroup: CopyTestEvidenceSourceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestImage[] => {
  /** AI 为当前来源原子组返回的图片文件名集合。 */
  const sourceFileNames = new Set(sourceGroup.evidenceImages.map(image => image.fileName));
  return uploadedImages.filter(image => sourceFileNames.has(image.fileName));
};

/** 使用规范图片顺序复制来源原子组，避免修改调用方数据。 */
const normalizeSourceGroup = (
  sourceGroup: CopyTestEvidenceSourceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestEvidenceSourceGroup => ({
  ...sourceGroup,
  evidenceImages: orderSourceImages(sourceGroup, uploadedImages),
});

/** 判断来源原子组是否能够生成逐行 Result。 */
const hasRowResult = (sourceGroup: CopyTestEvidenceSourceGroup): boolean => {
  return sourceGroup.selected && sourceGroup.hasResult;
};

/** 读取当前 Evidence 组的最后一个来源原子组。 */
const getLastSourceGroup = (group: MutableEvidenceGroup): CopyTestEvidenceSourceGroup => {
  return group.sourceGroups[group.sourceGroups.length - 1];
};

/** 判断两个来源原子组在物理行上是否紧邻。 */
const isPhysicallyContinuous = (
  group: MutableEvidenceGroup,
  nextSourceGroup: CopyTestEvidenceSourceGroup
): boolean => {
  /** 当前 Evidence 组最后一个原子组。 */
  const previousSourceGroup = getLastSourceGroup(group);
  return previousSourceGroup.anchorRowIndex + previousSourceGroup.rowSpan === nextSourceGroup.anchorRowIndex;
};

/** 读取当前组所有原子在本轮共同选择的唯一图片。 */
const getSharedCurrentEvidenceFileName = (
  group: MutableEvidenceGroup
): string | undefined => {
  /** 当前结构组内每个原子组的本轮 singleton winner。 */
  const fileNames = group.sourceGroups.map(sourceGroup => {
    return sourceGroup.currentEvidenceFileName;
  });
  if (fileNames.some(fileName => !fileName)) {
    return undefined;
  }

  /** 去重后只有一个文件名才表示整组在同一轮共同匹配该图。 */
  const uniqueFileNames = new Set(fileNames);
  return uniqueFileNames.size === 1 ? fileNames[0] : undefined;
};

/** 判断当前组能否依据本轮共同 winner 单调扩展到下一原子组。 */
const sharesCurrentEvidence = (
  group: MutableEvidenceGroup,
  nextSourceGroup: CopyTestEvidenceSourceGroup
): boolean => {
  /** 下一原子组本轮选择的 singleton winner。 */
  const nextFileName = nextSourceGroup.currentEvidenceFileName;
  return Boolean(nextFileName)
    && getSharedCurrentEvidenceFileName(group) === nextFileName;
};

/** 判断下一来源原子组是否应并入当前 Evidence 组。 */
const canJoinEvidenceGroup = (
  group: MutableEvidenceGroup,
  nextSourceGroup: CopyTestEvidenceSourceGroup
): boolean => {
  if (!isPhysicallyContinuous(group, nextSourceGroup)) {
    return false;
  }

  return group.evidenceGroupId === nextSourceGroup.evidenceGroupId
    || sharesCurrentEvidence(group, nextSourceGroup);
};

/** 为一个来源原子组创建新的可变 Evidence 组。 */
const createMutableEvidenceGroup = (sourceGroup: CopyTestEvidenceSourceGroup): MutableEvidenceGroup => ({
  evidenceGroupId: sourceGroup.evidenceGroupId,
  sourceGroups: [sourceGroup],
});

/** 将来源原子组完整加入当前 Evidence 组。 */
const appendSourceGroup = (
  group: MutableEvidenceGroup,
  sourceGroup: CopyTestEvidenceSourceGroup
): void => {
  group.sourceGroups.push(sourceGroup);
};

/** 根据图片原始文件名生成用户可识别的展示标签。 */
const createImageLabel = (image: CopyTestImage): string => {
  return getCopyTestImageDisplayName(image);
};

/** 按历史批次顺序收集当前结构组累计引用的唯一 Evidence。 */
const collectGroupImages = (
  group: MutableEvidenceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestImage[] => {
  /** 组内任一有效逐行结果实际引用的图片文件名。 */
  const referencedFileNames = new Set<string>();
  group.sourceGroups.filter(hasRowResult).forEach(sourceGroup => {
    sourceGroup.evidenceImages.forEach(image => {
      referencedFileNames.add(image.fileName);
    });
  });
  return deduplicateGroupImages(
    uploadedImages.filter(image => referencedFileNames.has(image.fileName))
  );
};

/** 为当前结构组的累计 Evidence 创建有序 Screen 列表。 */
const createGroupScreens = (
  group: MutableEvidenceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestEvidenceScreen[] => {
  return collectGroupImages(group, uploadedImages).map(image => ({
    image,
    label: createImageLabel(image),
  }));
};

/** 构建单个来源原子组真正使用的 Result Screen 子集。 */
const createRowResultPlan = (
  sourceGroup: CopyTestEvidenceSourceGroup,
  groupScreens: CopyTestEvidenceScreen[]
): CopyTestEvidenceRowResultPlan => {
  return {
    anchorRowIndex: sourceGroup.anchorRowIndex,
    rowSpan: sourceGroup.rowSpan,
    screens: groupScreens,
  };
};

/** 将可变 Evidence 组转换为调用方可消费的只含业务数据的规划。 */
const finalizeEvidenceGroup = (
  group: MutableEvidenceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestEvidenceGroupPlan => {
  /** 当前组 Evidence 使用的跨批累计有序 Screen。 */
  const screens = createGroupScreens(group, uploadedImages);
  return {
    anchorRowIndex: group.sourceGroups[0].anchorRowIndex,
    rowSpan: group.sourceGroups.reduce((total, sourceGroup) => total + sourceGroup.rowSpan, 0),
    rowResults: group.sourceGroups
      .filter(hasRowResult)
      .map(sourceGroup => createRowResultPlan(sourceGroup, screens)),
    screenLabelByFileName: Object.fromEntries(
      screens.map(screen => [screen.image.fileName, screen.label])
    ),
    screens,
    sourceGroups: group.sourceGroups,
  };
};

/**
 * 按稳定 Evidence 组标识和物理连续性规划不可拆分结构组。
 * 已持久化组永不拆分；本轮相邻原子共同选择同一 singleton 时只新增合并边。
 */
export const planCopyTestEvidenceGroups = (
  sourceGroups: CopyTestEvidenceSourceGroup[],
  uploadedImages: CopyTestImage[]
): CopyTestEvidenceGroupPlan[] => {
  /** 上传图片的规范去重顺序。 */
  const orderedUploadedImages = deduplicateUploadedImages(uploadedImages);
  /** 正在构建的 Evidence 分组。 */
  const mutableGroups: MutableEvidenceGroup[] = [];
  /** 当前可继续合并的 Evidence 组；边界后重置为空。 */
  let currentGroup: MutableEvidenceGroup | null = null;

  sourceGroups.forEach(sourceGroup => {
    /** 已按上传顺序规范图片的来源原子组副本。 */
    const normalizedSourceGroup = normalizeSourceGroup(sourceGroup, orderedUploadedImages);
    if (currentGroup && canJoinEvidenceGroup(currentGroup, normalizedSourceGroup)) {
      appendSourceGroup(currentGroup, normalizedSourceGroup);
      return;
    }

    currentGroup = createMutableEvidenceGroup(normalizedSourceGroup);
    mutableGroups.push(currentGroup);
  });

  return mutableGroups.map(group => finalizeEvidenceGroup(group, orderedUploadedImages));
};
