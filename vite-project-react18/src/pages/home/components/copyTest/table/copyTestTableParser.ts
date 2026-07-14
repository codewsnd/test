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
  /** 合并组覆盖的物理行数。 */
  rowSpan: number;
}

/** 当前 comparison column 的上下文。 */
export interface CopyTestColumnContext {
  /** Comparison Column 按 rowspan 划分出的原子行组。 */
  rowGroups: CopyTestRowGroup[];
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex: number;
  /** 当前 Comparison Column 的表头。 */
  selectedHeader: CopyTestHeader;
  /** 当前 Comparison Column 对应生成双列的 ownership 键。 */
  sourceColumnKey: string;
}

/** 构建来源行组所需的最小表格结构。 */
type CopyTestTableStructure = Pick<CopyTestTableEntry, 'headers' | 'model'>;

/** 判断表格是否包含至少一个非空 Header 和一行数据。 */
const isValidCopyTestTable = (table: CopyTestWorkingTable): boolean => {
  return (
    table.model.rows.length > 1 &&
    table.model.columnCount > 0 &&
    table.headers.some(
      /** 至少一个表头含有可供用户识别和选择的文本。 */
      header => header.label.trim() !== ''
    )
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

/** 构建当前 Comparison Column 的逻辑行组。 */
export const buildCopyTestRowGroups = (
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

  return {
    rowGroups: buildCopyTestRowGroups(table, selectedColumnIndex),
    selectedColumnIndex,
    selectedHeader,
    sourceColumnKey: getSourceColumnKey(selectedColumnIndex, selectedHeader.label),
  };
};

/** 读取当前可校验的行下标。 */
export const getSelectableCopyTestRowIndexes = (
  table: CopyTestWorkingTable | undefined,
  selectedColumnIndex: number | undefined
): number[] => {
  if (!table || selectedColumnIndex === undefined) {
    return [];
  }

  return (
    getCopyTestColumnContext(table, selectedColumnIndex)
      ?.rowGroups.filter(
        /** 只保留锚点单元格 Expected Copy 非空的原子行组。 */
        group => {
          /** 行组锚点所在的物理表格行。 */
          const row = table.model.rows[group.anchorRowIndex];
          return row?.slots[selectedColumnIndex]?.cell.text.trim() !== '';
        }
      )
      .map(
        /** 以行组首个业务行下标代表整个不可拆分选择单元。 */
        group => group.dataRowIndexes[0]
      ) || []
  );
};

/** 将来源原子组内任意行下标规范为锚点，并按表格顺序去重。 */
export const normalizeCopyTestSelectedRowIndexes = (
  rowGroups: CopyTestRowGroup[],
  selectedRowIndexes: number[]
): number[] => {
  /** 便于快速判断某个原子组是否含有任意已选物理行。 */
  const selectedRows = new Set(selectedRowIndexes);
  return rowGroups.flatMap(group => {
    /** 当前来源原子组对外唯一使用的业务锚点下标。 */
    const anchorRowIndex = group.dataRowIndexes[0];
    /** 组内任意行被选中时，整个原子组统一映射为锚点。 */
    const groupSelected = group.dataRowIndexes.some(rowIndex => selectedRows.has(rowIndex));
    return anchorRowIndex === undefined || !groupSelected ? [] : [anchorRowIndex];
  });
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
  return buildRowsForValidation(table, context.selectedColumnIndex, normalizedRowIndexes);
};
