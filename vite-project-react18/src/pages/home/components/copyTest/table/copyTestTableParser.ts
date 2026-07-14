/**
 * 文件作用：解析 CopyTest storage 表格、列、逻辑行组和校验输入。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';
import { projectCopyTestSourceColumn } from './copyTestGridModel';
import {
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
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
export interface CopyTestWorkingTable extends CopyTestTableEntry {
  originalHtml: string;
  workingHtml: string;
}

/** CopyTest 逻辑行组。 */
export interface CopyTestRowGroup {
  anchorRowIndex: number;
  dataRowIndexes: number[];
  groupId: string;
  rowSpan: number;
}

/** 当前 comparison column 的上下文。 */
export interface CopyTestColumnContext {
  referenceColumnIndex?: number;
  referenceHeader?: CopyTestHeader;
  rowGroups: CopyTestRowGroup[];
  selectedColumnIndex: number;
  selectedHeader: CopyTestHeader;
  sourceColumnKey: string;
}

/** 判断表格是否包含至少一个非空 Header 和一行数据。 */
export const isValidCopyTestTable = (table: CopyTestWorkingTable): boolean => {
  return table.model.rows.length > 1
    && table.model.columnCount > 0
    && table.headers.some(header => header.label.trim() !== '');
};

/** 从 storage 中解析工作表格。 */
export const parseCopyTestStorageTables = (storageHtml: string): CopyTestWorkingTable[] => {
  return parseStorageTables(storageHtml)
    .map(table => ({
      ...table,
      originalHtml: table.html,
      workingHtml: table.html,
    }))
    .filter(isValidCopyTestTable);
};

/** 使用新的 working html 刷新工作表格模型。 */
export const refreshWorkingTable = (
  table: CopyTestWorkingTable,
  workingHtml: string
): CopyTestWorkingTable => {
  const parsedTable = parseSingleTable(workingHtml);
  if (!parsedTable) {
    return table;
  }

  return {
    ...parsedTable,
    index: table.index,
    originalHtml: table.originalHtml,
    range: table.range,
    workingHtml: parsedTable.html,
  };
};

/** 读取当前列对应的 source column key。 */
export const getSourceColumnKey = (columnIndex: number, columnLabel: string): string => {
  return getCopyTestSourceColumnKey(columnIndex, columnLabel);
};

/** 判断列头是否是生成列。 */
export const isCopyTestGeneratedHeader = (header: CopyTestHeader): boolean => {
  return Boolean(header.generatedType)
    || normalizeLabel(header.label).startsWith(COPY_TEST_RESULT_HEADER_PREFIX_WITH_SPACE)
    || normalizeLabel(header.label).startsWith(COPY_TEST_EVIDENCE_HEADER_PREFIX_WITH_SPACE);
};

/** 定义 COPY_TEST_RESULT_HEADER_PREFIX_WITH_SPACE 常量。 */
const COPY_TEST_RESULT_HEADER_PREFIX_WITH_SPACE = 'Test Result -';

/** 定义 COPY_TEST_EVIDENCE_HEADER_PREFIX_WITH_SPACE 常量。 */
const COPY_TEST_EVIDENCE_HEADER_PREFIX_WITH_SPACE = 'Test Evidence -';

/** 判断生成列是否匹配当前 source column。 */
export const isGeneratedHeaderForSource = (
  header: CopyTestHeader,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string,
  _sourceLabel: string
): boolean => {
  void _sourceLabel;
  return header.generatedType === type && header.sourceColumnKey === sourceColumnKey;
};

/** 查找当前 source column 的生成列下标。 */
export const findGeneratedColumnIndex = (
  headers: CopyTestHeader[],
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string,
  sourceLabel: string
): number | undefined => {
  return headers.find(header => isGeneratedHeaderForSource(header, type, sourceColumnKey, sourceLabel))?.index;
};

/** 查找当前 Result/Evidence 两列。 */
export const findGeneratedColumnIndexes = (
  headers: CopyTestHeader[],
  sourceColumnKey: string,
  sourceLabel: string
): { evidence?: number; result?: number } => {
  return {
    evidence: findGeneratedColumnIndex(headers, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey, sourceLabel),
    result: findGeneratedColumnIndex(headers, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey, sourceLabel),
  };
};

/** 构建当前 Comparison Column 的逻辑行组。 */
const buildModelRowGroups = (
  table: CopyTestTableEntry,
  selectedColumnIndex: number
): CopyTestRowGroup[] => {
  return table.model.rows.slice(1)
    .filter(row => row.slots[selectedColumnIndex]?.owned)
    .map(row => {
      const cell = row.slots[selectedColumnIndex]?.cell;
      const rowSpan = cell?.rowSpan || 1;
      return {
        anchorRowIndex: row.index,
        dataRowIndexes: Array.from({ length: rowSpan }, (_, offset) => row.index - 1 + offset),
        groupId: `table-${table.index}/${selectedColumnIndex}/${cell?.sourceCellId || row.index}`,
        rowSpan,
      };
    });
};

/** 构建当前 Comparison Column 的逻辑行组。 */
export const buildCopyTestRowGroups = (
  table: CopyTestTableEntry,
  selectedColumnIndex: number
): CopyTestRowGroup[] => {
  const grid = table.model.spanGrid;
  const header = table.headers.find(item => item.index === selectedColumnIndex);
  if (!grid || !header) {
    return buildModelRowGroups(table, selectedColumnIndex);
  }

  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, header.label);
  try {
    const projection = projectCopyTestSourceColumn(grid, {
      sourceColumnId: sourceColumnKey,
      sourceColumnIndex: selectedColumnIndex,
      tableId: `table-${table.index}`,
    });
    return projection.groups.map(group => ({
      anchorRowIndex: group.anchorRowIndex,
      dataRowIndexes: group.coveredRowIndexes.map(rowIndex => rowIndex - 1),
      groupId: group.groupId,
      rowSpan: group.rowSpan,
    }));
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

  const selectedHeader = table.headers.find(header => header.index === selectedColumnIndex);
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

  return getCopyTestColumnContext(table, selectedColumnIndex)?.rowGroups
    .filter(group => {
      const row = table.model.rows[group.anchorRowIndex];
      return row?.slots[selectedColumnIndex]?.cell.text.trim() !== '';
    })
    .map(group => group.dataRowIndexes[0]) || [];
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

  return buildRowsForValidation(
    table,
    context.selectedColumnIndex,
    context.referenceColumnIndex,
    selectedRowIndexes
  );
};
