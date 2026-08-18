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

/** 判断下一来源原子组是否应并入当前 Evidence 组。 */
const canJoinEvidenceGroup = (
  group: MutableEvidenceGroup,
  nextSourceGroup: CopyTestEvidenceSourceGroup
): boolean => {
  return group.evidenceGroupId === nextSourceGroup.evidenceGroupId
    && isPhysicallyContinuous(group, nextSourceGroup);
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

/** 统计每张候选图片覆盖的已选且有结果来源原子组数量。 */
const countImageVotes = (group: MutableEvidenceGroup): Map<string, number> => {
  /** 图片文件名到有效来源原子组覆盖数的映射。 */
  const votesByFileName = new Map<string, number>();
  group.sourceGroups.filter(hasRowResult).forEach(sourceGroup => {
    /** 同一来源结果重复引用同一图片时只计算一票。 */
    const sourceFileNames = new Set(sourceGroup.evidenceImages.map(image => image.fileName));
    sourceFileNames.forEach(fileName => {
      votesByFileName.set(fileName, (votesByFileName.get(fileName) || 0) + 1);
    });
  });
  return votesByFileName;
};

/** 按覆盖票数选择唯一 Evidence，平票时保持上传图片顺序。 */
const selectWinningImage = (
  group: MutableEvidenceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestImage | undefined => {
  /** 每张已上传候选图片覆盖的有效来源原子组数量。 */
  const votesByFileName = countImageVotes(group);
  /** 当前最高覆盖票数；只有正票候选可以成为 winner。 */
  let highestVoteCount = 0;
  /** 当前唯一 winner；相同票数不会覆盖先上传的图片。 */
  let winner: CopyTestImage | undefined;
  uploadedImages.forEach(image => {
    /** 当前候选在本结构组中的覆盖票数。 */
    const voteCount = votesByFileName.get(image.fileName) || 0;
    if (voteCount > highestVoteCount) {
      highestVoteCount = voteCount;
      winner = image;
    }
  });
  return winner;
};

/** 为当前结构组的唯一 winner 创建 Screen 列表。 */
const createGroupScreens = (
  group: MutableEvidenceGroup,
  uploadedImages: CopyTestImage[]
): CopyTestEvidenceScreen[] => {
  /** 由覆盖票数和上传顺序确定的唯一 Evidence 图片。 */
  const winner = selectWinningImage(group, uploadedImages);
  return winner ? [{ image: winner, label: createImageLabel(winner) }] : [];
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
  /** 当前组 Evidence 使用的有序 Screen。 */
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
 * 图片命中、选择和结果状态仅影响唯一 Screen 与逐行 Result，不改变结构分组。
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
