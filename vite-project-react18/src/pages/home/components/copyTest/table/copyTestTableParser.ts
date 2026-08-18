/**
 * 文件作用：解析 CopyTest storage 表格、列、逻辑行组和校验输入。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';
import { projectCopyTestSourceColumn } from './copyTestGridModel';
import {
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

/** 由所选列空白单元格分隔的连续非空 Evidence section。 */
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
  /** Comparison Column 中以空白单元格为边界的连续非空 Evidence section。 */
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
  const evidenceGroupId = group.dataRowIndexes[0];
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

/** 同时构建 rowspan 原子组与空行分隔的 Evidence section。 */
const buildCopyTestRowGrouping = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): { evidenceSections: CopyTestEvidenceSection[]; rowGroups: CopyTestRowGroup[] } => {
  /** 不改变 rowspan 语义的来源列原子组。 */
  const atomicRowGroups = buildAtomicCopyTestRowGroups(table, selectedColumnIndex);
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
    if (!currentSection || !isContinuousEvidenceSection(currentSection, group)) {
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

/** 构建当前 Comparison Column 的 rowspan 原子行组。 */
export const buildCopyTestRowGroups = (
  table: CopyTestTableStructure,
  selectedColumnIndex: number
): CopyTestRowGroup[] => {
  return buildCopyTestRowGrouping(table, selectedColumnIndex).rowGroups;
};

/** 构建当前 Comparison Column 中由空白单元格分隔的 Evidence section。 */
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
