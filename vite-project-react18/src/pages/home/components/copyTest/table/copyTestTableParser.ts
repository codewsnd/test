/**
 * 文件作用：解析 CopyTest storage 表格、列、逻辑行组和校验输入。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';
import { projectCopyTestSourceColumn } from './copyTestGridModel';
import {
  COPY_TEST_EVIDENCE_GROUP_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_RESULT_HEADER_PREFIX,
} from './tableConstants';
import {
  buildRowsForValidation,
  getCopyTestSourceColumnKey,
  normalizeLabel,
  parseSingleTable,
  parseStorageTables,
  type CopyTestGeneratedColumnType,
  type CopyTestHeader,
  type CopyTestCellSlot,
  type CopyTestTableEntry,
} from './tableModel';

/** CopyTest 工作表格。 */
export interface CopyTestWorkingTable extends Omit<CopyTestTableEntry, 'html'> {
  /** 最近一次从 Confluence 导入的原始单表 Storage。 */
  originalHtml: string;
  /** 包含当前本地校验结果的工作副本。 */
  workingHtml: string;
}

/** CopyTest 逻辑行组。 */
export interface CopyTestRowGroup {
  /** 合并组左上角单元格所在的物理行下标。 */
  anchorRowIndex: number;
  /** 合并组覆盖的业务数据行下标。 */
  dataRowIndexes: number[];
  /** 非空 Evidence section 首个原子组的零基业务行下标；空行边界不属于 section。 */
  evidenceGroupId?: number;
  /** 合并组覆盖的物理行数。 */
  rowSpan: number;
}

/** 所选列按空白条件策略形成的非空 Evidence section。 */
export interface CopyTestEvidenceSection {
  /** section 首个原子组所在的物理行下标。 */
  anchorRowIndex: number;
  /** section 内每个原子组的零基业务锚点行下标。 */
  dataRowIndexes: number[];
  /** section 首个原子组的零基业务锚点，作为稳定 Evidence 分组 ID。 */
  evidenceGroupId: number;
  /** section 内仍保持 rowspan 原子语义的有序行组。 */
  rowGroups: CopyTestRowGroup[];
  /** section 中所有原子组覆盖的物理行总数。 */
  rowSpan: number;
}

/** 当前 comparison column 的上下文。 */
export interface CopyTestColumnContext {
  /** Comparison Column 按 rowspan 划分出的原子行组。 */
  rowGroups: CopyTestRowGroup[];
  /** Comparison Column 按空白条件策略形成的 Evidence section。 */
  evidenceSections: CopyTestEvidenceSection[];
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex: number;
  /** 当前 Comparison Column 的表头。 */
  selectedHeader: CopyTestHeader;
  /** 当前 Comparison Column 对应生成双列的 ownership 键。 */
  sourceColumnKey: string;
}

/** 构建来源行组所需的最小表格结构。 */
type CopyTestTableStructure = Pick<CopyTestTableEntry, 'headers' | 'model'>;

/** 判断表格是否包含至少一个逻辑列和一行数据。 */
const isValidCopyTestTable = (table: CopyTestWorkingTable): boolean => {
  return (
    table.model.rows.length > 1 &&
    table.model.columnCount > 0
  );
};

/** 从 storage 中解析工作表格。 */
export const parseCopyTestStorageTables = (storageHtml: string): CopyTestWorkingTable[] => {
  return parseStorageTables(storageHtml)
    .map(
      /** 为每张导入表格建立互不覆盖的原始快照与本地工作副本。 */
      ({ html, ...table }) => ({
        ...table,
        originalHtml: html,
        workingHtml: html,
      })
    )
    .filter(isValidCopyTestTable);
};

/** 使用新的 working html 刷新工作表格模型。 */
export const refreshWorkingTable = (table: CopyTestWorkingTable, workingHtml: string): CopyTestWorkingTable => {
  /** 从新工作副本重新解析出的单表结构。 */
  const parsedTable = parseSingleTable(workingHtml);
  if (!parsedTable) {
    return table;
  }

  /** 去除仅供解析阶段传递的 html，保留最新结构模型和规范化工作副本。 */
  const { html, ...refreshedTable } = parsedTable;
  return {
    ...refreshedTable,
    index: table.index,
    originalHtml: table.originalHtml,
    workingHtml: html,
  };
};

/** 读取当前列对应的 source column key。 */
export const getSourceColumnKey = (columnIndex: number, columnLabel: string): string => {
  return getCopyTestSourceColumnKey(columnIndex, columnLabel);
};

/** 为空来源表头生成 Column N 展示名，非空表头返回规范化后的原文。 */
export const getSourceColumnDisplayLabel = (columnIndex: number, columnLabel: string): string => {
  /** 去除来源表头首尾空白并合并连续空白后的展示文本。 */
  const normalizedLabel = normalizeLabel(columnLabel);
  return normalizedLabel || `Column ${columnIndex + 1}`;
};

/** 判断列头是否是生成列。 */
export const isCopyTestGeneratedHeader = (header: CopyTestHeader): boolean => {
  return (
    Boolean(header.generatedType) ||
    normalizeLabel(header.label).startsWith(COPY_TEST_RESULT_HEADER_PREFIX) ||
    normalizeLabel(header.label).startsWith(COPY_TEST_EVIDENCE_HEADER_PREFIX)
  );
};

/** 判断生成列是否匹配当前 source column。 */
const isGeneratedHeaderForSource = (
  header: CopyTestHeader,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): boolean => {
  return header.generatedType === type && header.sourceColumnKey === sourceColumnKey;
};

/** 查找当前 source column 的生成列下标。 */
const findGeneratedColumnIndex = (
  headers: CopyTestHeader[],
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): number | undefined => {
  return headers.find(
    /** 严格按生成类型与 source key 同时匹配当前来源列。 */
    header => isGeneratedHeaderForSource(header, type, sourceColumnKey)
  )?.index;
};

/** 查找当前 Result/Evidence 两列。 */
export const findGeneratedColumnIndexes = (
  headers: CopyTestHeader[],
  sourceColumnKey: string
): { evidence?: number; result?: number } => {
  return {
    evidence: findGeneratedColumnIndex(headers, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey),
    result: findGeneratedColumnIndex(headers, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey),
  };
};

/** 构建当前 Comparison Column 的逻辑行组。 */
const buildModelRowGroups = (table: CopyTestTableStructure, selectedColumnIndex: number): CopyTestRowGroup[] => {
  return table.model.rows
    .slice(1)
    .filter(
      /** 仅由 Comparison Column 直接拥有的单元格创建原子逻辑行组。 */
      row => row.slots[selectedColumnIndex]?.owned
    )
    .map(
      /** 用来源单元格 rowspan 计算其覆盖的数据行集合。 */
      row => {
        /** Comparison Column 在当前物理行直接拥有的来源单元格。 */
        const cell = row.slots[selectedColumnIndex]?.cell;
        /** 来源单元格实际覆盖的物理行数。 */
        const rowSpan = cell?.rowSpan || 1;
        return {
          anchorRowIndex: row.index,
          dataRowIndexes: Array.from(
            { length: rowSpan },
            /** 将每个物理行偏移转换为零起始业务数据行下标。 */
            (_, offset) => row.index - 1 + offset
          ),
          rowSpan,
        };
      }
    );
};

/** 只按来源列 rowspan 构建不可拆分原子行组。 */
const buildAtomicCopyTestRowGroups = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): CopyTestRowGroup[] => {
  /** 表格 span 完整合法时生成的严格二维网格。 */
  const grid = table.model.spanGrid;
  /** 用户选择的 Comparison Column 表头。 */
  const header = table.headers.find(
    /** 使用逻辑列下标定位当前选择，而不依赖可能重复的表头文本。 */
    item => item.index === selectedColumnIndex
  );
  if (!grid || !header) {
    return buildModelRowGroups(table, selectedColumnIndex);
  }

  try {
    /** 严格网格对当前来源列生成的不可拆分行组投影。 */
    const projection = projectCopyTestSourceColumn(grid, {
      sourceColumnIndex: selectedColumnIndex,
    });
    return projection.groups.map(
      /** 将网格行组转换为编辑器使用的物理锚点和业务行下标。 */
      group => ({
        anchorRowIndex: group.anchorRowIndex,
        dataRowIndexes: group.coveredRowIndexes.map(
          /** 表头占用第零行，因此业务数据行下标需要减一。 */
          rowIndex => rowIndex - 1
        ),
        rowSpan: group.rowSpan,
      })
    );
  } catch {
    return buildModelRowGroups(table, selectedColumnIndex);
  }
};

/** 判断原子行组在所选列中是否是空白 section 边界。 */
const isBlankEvidenceBoundary = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number,
  group: CopyTestRowGroup
): boolean => {
  /** 原子组锚点在所选列中直接拥有的来源单元格。 */
  const cell = table.model.rows[group.anchorRowIndex]?.slots[selectedColumnIndex]?.cell;
  return !cell || cell.text.trim() === '';
};

/** 判断一个新原子组是否与当前 section 物理连续。 */
const isContinuousEvidenceSection = (
  section: CopyTestEvidenceSection,
  group: CopyTestRowGroup
): boolean => {
  return section.anchorRowIndex + section.rowSpan === group.anchorRowIndex;
};

/** 从首个非空原子组创建 Evidence section 及带分组 ID 的原子组。 */
const createEvidenceSection = (
  group: CopyTestRowGroup
): { rowGroup: CopyTestRowGroup; section: CopyTestEvidenceSection } => {
  /** 原子组对外使用的零基业务锚点。 */
  const evidenceGroupId = group.evidenceGroupId ?? group.dataRowIndexes[0];
  /** 每个数据原子组都必然至少覆盖一行。 */
  if (evidenceGroupId === undefined || evidenceGroupId < 0) {
    throw new Error('Evidence section requires a non-negative data row anchor');
  }
  /** 保留 rowspan 原子结构并附加 section 稳定 ID 的新行组。 */
  const rowGroup = { ...group, evidenceGroupId };
  return {
    rowGroup,
    section: {
      anchorRowIndex: group.anchorRowIndex,
      dataRowIndexes: [evidenceGroupId],
      evidenceGroupId,
      rowGroups: [rowGroup],
      rowSpan: group.rowSpan,
    },
  };
};

/** 将物理连续的非空原子组加入现有 Evidence section。 */
const appendEvidenceSectionRowGroup = (
  section: CopyTestEvidenceSection,
  group: CopyTestRowGroup
): CopyTestRowGroup => {
  /** 使用 section 首行稳定 ID 的原子行组。 */
  const rowGroup = { ...group, evidenceGroupId: section.evidenceGroupId };
  /** 当前原子组的零基业务锚点。 */
  const dataRowIndex = group.dataRowIndexes[0];
  if (dataRowIndex !== undefined) {
    section.dataRowIndexes.push(dataRowIndex);
  }
  section.rowGroups.push(rowGroup);
  section.rowSpan += group.rowSpan;
  return rowGroup;
};

/** 从已解析的行组构建物理连续的 Evidence section。 */
const buildEvidenceSectionsFromRowGroups = (
  rowGroups: CopyTestRowGroup[]
): CopyTestEvidenceSection[] => {
  /** 按结构组 ID 与物理连续性划分的结果。 */
  const evidenceSections: CopyTestEvidenceSection[] = [];
  /** 当前可继续追加的非空 section。 */
  let currentSection: CopyTestEvidenceSection | undefined;
  rowGroups.forEach(group => {
    if (group.evidenceGroupId === undefined) {
      currentSection = undefined;
      return;
    }
    if (
      !currentSection
      || currentSection.evidenceGroupId !== group.evidenceGroupId
      || !isContinuousEvidenceSection(currentSection, group)
    ) {
      /** 新结构组首个原子行创建的 section。 */
      const created = createEvidenceSection(group);
      currentSection = created.section;
      evidenceSections.push(currentSection);
      return;
    }
    appendEvidenceSectionRowGroup(currentSection, group);
  });
  return evidenceSections;
};

/** 只依据来源列空白边界构建不可拆分的基础分组。 */
const buildBaseCopyTestRowGrouping = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): { evidenceSections: CopyTestEvidenceSection[]; rowGroups: CopyTestRowGroup[] } => {
  /** 不改变 rowspan 语义的来源列原子组。 */
  const atomicRowGroups = buildAtomicCopyTestRowGroups(table, selectedColumnIndex);
  /** 只有整列至少包含一个空白原子行时，连续非空原子才允许合并。 */
  const hasBlankBoundary = atomicRowGroups.some(group => {
    return isBlankEvidenceBoundary(table, selectedColumnIndex, group);
  });
  /** 附加 Evidence 分组 ID 后仍与原子组一一对应的结果。 */
  const rowGroups: CopyTestRowGroup[] = [];
  /** 由空白来源单元格分隔的连续非空 section。 */
  const evidenceSections: CopyTestEvidenceSection[] = [];
  /** 当前可继续追加的非空 section。 */
  let currentSection: CopyTestEvidenceSection | undefined;
  atomicRowGroups.forEach(group => {
    if (isBlankEvidenceBoundary(table, selectedColumnIndex, group)) {
      rowGroups.push(group);
      currentSection = undefined;
      return;
    }
    if (!hasBlankBoundary || !currentSection || !isContinuousEvidenceSection(currentSection, group)) {
      /** 一个新连续非空区域的首个原子组和 section。 */
      const created = createEvidenceSection(group);
      currentSection = created.section;
      evidenceSections.push(currentSection);
      rowGroups.push(created.rowGroup);
      return;
    }
    rowGroups.push(appendEvidenceSectionRowGroup(currentSection, group));
  });
  return { evidenceSections, rowGroups };
};

/** 判断持久化组 ID 是否是合法的零基业务锚点。 */
const isValidEvidenceGroupId = (value: number): boolean => {
  return Number.isSafeInteger(value) && value >= 0;
};

/** 持久化 Evidence 组序列校验的可变状态。 */
interface EvidenceGroupResolutionState {
  /** 基础组 ID 到持久化组 ID 的单调映射。 */
  resolvedIdByBaseId: Map<number, number>;
  /** 已读取过的持久化组 ID。 */
  seenResolvedIds: Set<number>;
  /** 上一个非空来源原子组。 */
  previousGroup?: CopyTestRowGroup;
  /** 上一个非空原子组的持久化 ID。 */
  previousResolvedId?: number;
}

/** 校验并记录一个非空原子的持久化组位置。 */
const acceptResolvedEvidenceGroup = (
  state: EvidenceGroupResolutionState,
  group: CopyTestRowGroup,
  resolvedId: number | undefined
): boolean => {
  /** 当前原子的基础组与零基业务锚点。 */
  const baseId = group.evidenceGroupId!;
  const dataAnchor = group.dataRowIndexes[0];
  if (resolvedId === undefined || dataAnchor === undefined || !isValidEvidenceGroupId(resolvedId)) {
    return false;
  }
  /** 同一基础 section 之前已锁定的持久化组 ID。 */
  const baseResolvedId = state.resolvedIdByBaseId.get(baseId);
  if (baseResolvedId !== undefined && baseResolvedId !== resolvedId) {
    return false;
  }
  const continuesPrevious = state.previousResolvedId === resolvedId;
  if (continuesPrevious) {
    const physicallyContinuous = state.previousGroup
      && state.previousGroup.anchorRowIndex + state.previousGroup.rowSpan === group.anchorRowIndex;
    if (!physicallyContinuous) {
      return false;
    }
  } else if (state.seenResolvedIds.has(resolvedId) || resolvedId !== dataAnchor) {
    return false;
  }
  state.resolvedIdByBaseId.set(baseId, resolvedId);
  state.seenResolvedIds.add(resolvedId);
  state.previousGroup = group;
  state.previousResolvedId = resolvedId;
  return true;
};

/** 按物理锚点应用单调 Evidence 合并关系，非法时整体失败关闭。 */
export const resolveCopyTestEvidenceGroupIds = (
  baseRowGroups: CopyTestRowGroup[],
  groupIdByAnchorRowIndex: ReadonlyMap<number, number>
): CopyTestRowGroup[] | null => {
  const nonBlankGroupCount = baseRowGroups.filter(group => group.evidenceGroupId !== undefined).length;
  if (groupIdByAnchorRowIndex.size !== nonBlankGroupCount) {
    return null;
  }
  /** 按顺序校验基础 section 不被拆分且合并组物理连续的状态。 */
  const state: EvidenceGroupResolutionState = {
    resolvedIdByBaseId: new Map<number, number>(),
    seenResolvedIds: new Set<number>(),
  };
  const resolvedGroups: CopyTestRowGroup[] = [];
  for (const group of baseRowGroups) {
    if (group.evidenceGroupId === undefined) {
      if (groupIdByAnchorRowIndex.has(group.anchorRowIndex)) {
        return null;
      }
      resolvedGroups.push(group);
      state.previousGroup = undefined;
      state.previousResolvedId = undefined;
      continue;
    }

    /** 当前来源原子组在 Result cell 上声明的结构组 ID。 */
    const resolvedId = groupIdByAnchorRowIndex.get(group.anchorRowIndex);
    if (!acceptResolvedEvidenceGroup(state, group, resolvedId)) {
      return null;
    }
    resolvedGroups.push({ ...group, evidenceGroupId: resolvedId! });
  }
  return resolvedGroups;
};

/** 单个来源原子上的持久化 Evidence 组读取结果。 */
interface PersistedEvidenceGroupIdRead {
  /** 当前严格 Result cell 是否显式声明了属性。 */
  explicit: boolean;
  /** 显式值或缺失值回填后的基础 canonical ID。 */
  groupId?: number;
  /** 显式值及其 Result 原子结构是否全部合法。 */
  valid: boolean;
}

/** 整列 Result Evidence 分组元数据的候选读取结果。 */
interface PersistedEvidenceGroupIdsRead {
  /** 显式声明 group-id 的来源原子物理锚点。 */
  explicitAnchorRowIndexes: Set<number>;
  /** 当前列是否至少包含一个显式声明。 */
  found: boolean;
  /** 每个非空来源原子的显式值或基础 canonical ID。 */
  groupIds: Map<number, number> | null;
}

/** 定位当前来源原子所在逻辑列的严格 managed Result cell。 */
const getStrictResultSlot = (
  table: CopyTestTableStructure,
  group: CopyTestRowGroup,
  resultColumnIndex: number,
  sourceColumnKey: string
): CopyTestCellSlot | undefined => {
  /** 当前原子锚点上的 Result 逻辑槽位。 */
  const slot = table.model.rows[group.anchorRowIndex]?.slots[resultColumnIndex];
  if (slot?.cell.generatedType !== COPY_TEST_GENERATED_RESULT_TYPE) {
    return undefined;
  }
  return slot.cell.sourceColumnKey === sourceColumnKey ? slot : undefined;
};

/** 读取并严格校验一个来源原子的显式或基础 Evidence 组 ID。 */
const readPersistedEvidenceGroupId = (
  table: CopyTestTableStructure,
  group: CopyTestRowGroup,
  resultColumnIndex: number,
  sourceColumnKey: string
): PersistedEvidenceGroupIdRead => {
  const slot = getStrictResultSlot(table, group, resultColumnIndex, sourceColumnKey);
  const rawGroupId = slot?.cell.element.getAttribute(COPY_TEST_EVIDENCE_GROUP_ID_ATTRIBUTE);
  if (rawGroupId === null || rawGroupId === undefined) {
    return { explicit: false, groupId: group.evidenceGroupId, valid: true };
  }
  if (!slot?.owned || group.evidenceGroupId === undefined) {
    return { explicit: true, valid: false };
  }
  const matchesSourceAtom = slot.cell.rowIndex === group.anchorRowIndex
    && slot.cell.rowSpan === group.rowSpan;
  if (!matchesSourceAtom || !/^(?:0|[1-9]\d*)$/.test(rawGroupId)) {
    return { explicit: true, valid: false };
  }
  const groupId = Number(rawGroupId);
  return {
    explicit: true,
    groupId,
    valid: isValidEvidenceGroupId(groupId),
  };
};

/** 从当前来源列严格 managed Result 原子单元格读取持久化分组。 */
const readPersistedEvidenceGroupIds = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number,
  baseRowGroups: CopyTestRowGroup[]
): PersistedEvidenceGroupIdsRead => {
  /** 当前 Comparison Column 表头与稳定 ownership key。 */
  const header = table.headers.find(item => item.index === selectedColumnIndex);
  const sourceColumnKey = header ? getSourceColumnKey(selectedColumnIndex, header.label) : '';
  /** 当前来源列的严格 Result 逻辑列。 */
  const resultColumnIndex = sourceColumnKey
    ? findGeneratedColumnIndexes(table.headers, sourceColumnKey).result
    : undefined;
  if (resultColumnIndex === undefined) {
    return { explicitAnchorRowIndexes: new Set<number>(), found: false, groupIds: null };
  }

  /** 按来源原子物理锚点保存的候选组 ID。 */
  const groupIds = new Map<number, number>();
  const explicitAnchorRowIndexes = new Set<number>();
  let found = false;
  let valid = true;
  baseRowGroups.forEach(group => {
    const read = readPersistedEvidenceGroupId(
      table,
      group,
      resultColumnIndex,
      sourceColumnKey
    );
    if (read.explicit) {
      found = true;
      explicitAnchorRowIndexes.add(group.anchorRowIndex);
    }
    if (!read.valid) {
      valid = false;
      return;
    }
    if (read.groupId !== undefined) {
      groupIds.set(group.anchorRowIndex, read.groupId);
    }
  });
  return {
    explicitAnchorRowIndexes,
    found,
    groupIds: valid ? groupIds : null,
  };
};

/** 找出跨越多个基础组的动态 Evidence group-id。 */
const findDynamicEvidenceGroupIds = (
  baseRowGroups: CopyTestRowGroup[],
  resolvedRowGroups: CopyTestRowGroup[]
): Set<number> => {
  const firstBaseIdByResolvedId = new Map<number, number>();
  const dynamicGroupIds = new Set<number>();
  resolvedRowGroups.forEach((group, index) => {
    const resolvedId = group.evidenceGroupId;
    const baseId = baseRowGroups[index]?.evidenceGroupId;
    if (resolvedId === undefined || baseId === undefined) {
      return;
    }
    const firstBaseId = firstBaseIdByResolvedId.get(resolvedId);
    if (firstBaseId === undefined) {
      firstBaseIdByResolvedId.set(resolvedId, baseId);
      return;
    }
    if (firstBaseId !== baseId) {
      dynamicGroupIds.add(resolvedId);
    }
  });
  return dynamicGroupIds;
};

/** 动态合并不得由缺失 metadata 的后续原子反向推断产生。 */
const hasCompleteDynamicGroupMetadata = (
  baseRowGroups: CopyTestRowGroup[],
  resolvedRowGroups: CopyTestRowGroup[],
  explicitAnchorRowIndexes: ReadonlySet<number>
): boolean => {
  const dynamicGroupIds = findDynamicEvidenceGroupIds(baseRowGroups, resolvedRowGroups);
  return resolvedRowGroups.every(group => {
    const groupId = group.evidenceGroupId;
    return groupId === undefined
      || !dynamicGroupIds.has(groupId)
      || explicitAnchorRowIndexes.has(group.anchorRowIndex);
  });
};

/** 同时构建 rowspan 原子组与基础或已持久化的 Evidence section。 */
const buildCopyTestRowGrouping = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): { evidenceSections: CopyTestEvidenceSection[]; rowGroups: CopyTestRowGroup[] } => {
  /** 只依据来源列空白边界得到的不可拆分基础结构。 */
  const baseGrouping = buildBaseCopyTestRowGrouping(table, selectedColumnIndex);
  /** 严格 Result 原子 cell 中可选的单调布局组 ID。 */
  const persisted = readPersistedEvidenceGroupIds(table, selectedColumnIndex, baseGrouping.rowGroups);
  if (!persisted.found) {
    return baseGrouping;
  }
  /** 任一持久化值非法时，整列回退到基础结构。 */
  const resolvedGroups = persisted.groupIds
    ? resolveCopyTestEvidenceGroupIds(baseGrouping.rowGroups, persisted.groupIds)
    : null;
  const hasCompleteDynamicMetadata = resolvedGroups && hasCompleteDynamicGroupMetadata(
    baseGrouping.rowGroups,
    resolvedGroups,
    persisted.explicitAnchorRowIndexes
  );
  return resolvedGroups && hasCompleteDynamicMetadata
    ? { evidenceSections: buildEvidenceSectionsFromRowGroups(resolvedGroups), rowGroups: resolvedGroups }
    : baseGrouping;
};

/** 构建当前 Comparison Column 的 rowspan 原子行组。 */
export const buildCopyTestRowGroups = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): CopyTestRowGroup[] => {
  return buildCopyTestRowGrouping(table, selectedColumnIndex).rowGroups;
};

/** 按整列空白条件构建当前 Comparison Column 的 Evidence section。 */
export const buildCopyTestEvidenceSections = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): CopyTestEvidenceSection[] => {
  return buildCopyTestRowGrouping(table, selectedColumnIndex).evidenceSections;
};

/** 构建当前 Comparison Column 上下文。 */
export const getCopyTestColumnContext = (
  table: CopyTestWorkingTable | undefined,
  selectedColumnIndex: number | undefined
): CopyTestColumnContext | null => {
  if (!table || selectedColumnIndex === undefined) {
    return null;
  }

  /** 与用户所选逻辑列下标对应的表头。 */
  const selectedHeader = table.headers.find(
    /** 避免以表头文本匹配同名列。 */
    header => header.index === selectedColumnIndex
  );
  if (!selectedHeader) {
    return null;
  }

  /** 一次构建保证原子组和 Evidence section 共享同一批分组 ID。 */
  const grouping = buildCopyTestRowGrouping(table, selectedColumnIndex);
  return {
    evidenceSections: grouping.evidenceSections,
    rowGroups: grouping.rowGroups,
    selectedColumnIndex,
    selectedHeader,
    sourceColumnKey: getSourceColumnKey(selectedColumnIndex, selectedHeader.label),
  };
};

/** 读取当前可校验的行下标。 */
export const getSelectableCopyTestRowIndexes = (
  table: CopyTestTableStructure | undefined,
  selectedColumnIndex: number | undefined
): number[] => {
  if (!table || selectedColumnIndex === undefined) {
    return [];
  }

  return buildCopyTestEvidenceSections(table, selectedColumnIndex)
    .flatMap(section => section.dataRowIndexes);
};

/** 按 Evidence 分组 ID 将原子组收集为顺序稳定的 section。 */
const groupRowGroupsByEvidenceId = (
  rowGroups: CopyTestRowGroup[]
): CopyTestRowGroup[][] => {
  /** 保持首次出现顺序的 section 原子组索引。 */
  const groupsById = new Map<number, CopyTestRowGroup[]>();
  rowGroups.forEach(group => {
    if (group.evidenceGroupId === undefined) {
      return;
    }
    /** 当前 Evidence section 已经收集的原子组。 */
    const groupedRows = groupsById.get(group.evidenceGroupId) || [];
    groupedRows.push(group);
    groupsById.set(group.evidenceGroupId, groupedRows);
  });
  return Array.from(groupsById.values());
};

/** 将来源 section 内任意行下标扩展为整组全部原子锚点，并保持表格顺序。 */
export const normalizeCopyTestSelectedRowIndexes = (
  rowGroups: CopyTestRowGroup[],
  selectedRowIndexes: number[]
): number[] => {
  /** 便于快速判断某个 section 是否含有任意已选数据行。 */
  const selectedRows = new Set(selectedRowIndexes);
  return groupRowGroupsByEvidenceId(rowGroups).flatMap(sectionRowGroups => {
    /** section 内所有 rowspan 原子组的完整物理数据行。 */
    const coveredDataRowIndexes = sectionRowGroups.flatMap(group => group.dataRowIndexes);
    /** section 内任意物理行被选中时，整组所有原子锚点一起生效。 */
    const sectionSelected = coveredDataRowIndexes.some(rowIndex => selectedRows.has(rowIndex));
    return sectionSelected
      ? sectionRowGroups.flatMap(group => group.dataRowIndexes.slice(0, 1))
      : [];
  });
};

/** 为校验输入行按原子锚点建立稳定 Evidence 分组 ID 索引。 */
const buildEvidenceGroupIdByRowIndex = (
  rowGroups: CopyTestRowGroup[]
): Map<number, number> => {
  return new Map(rowGroups.flatMap(group => {
    /** 当前非空原子组的业务锚点。 */
    const rowIndex = group.dataRowIndexes[0];
    return rowIndex === undefined || group.evidenceGroupId === undefined
      ? []
      : [[rowIndex, group.evidenceGroupId] as const];
  }));
};

/** 构建发给校验接口的行输入。 */
export const buildCopyTestRowsForValidation = (
  table: CopyTestWorkingTable | undefined,
  context: CopyTestColumnContext | null,
  selectedRowIndexes: number[]
): CopyTestRowInput[] => {
  if (!table || !context) {
    return [];
  }

  /** 只包含来源原子组锚点且按表格顺序排列的选中下标。 */
  const normalizedRowIndexes = normalizeCopyTestSelectedRowIndexes(context.rowGroups, selectedRowIndexes);
  /** 每个校验行锚点所属的稳定 Evidence section ID。 */
  const evidenceGroupIdByRowIndex = buildEvidenceGroupIdByRowIndex(context.rowGroups);
  return buildRowsForValidation(table, context.selectedColumnIndex, normalizedRowIndexes).flatMap(row => {
    /** 当前非空校验行所属 section 的稳定 ID。 */
    const evidenceGroupId = evidenceGroupIdByRowIndex.get(row.rowIndex);
    return evidenceGroupId === undefined ? [] : [{ ...row, evidenceGroupId }];
  });
};
