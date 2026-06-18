/**
 * 文件作用：管理 CopyTest 原始 storage、working table、列选择、行选择和校验写入。
 */
import { useMemo, useRef, useState } from 'react';
import type { CopyTestImage, CopyTestRowInput } from '../api/copyTestApi';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestHeader,
  CopyTestTableEntry,
  CopyTestValidationResultWithEvidence,
} from '../types';
import {
  applyCopyTestValidationResults,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
} from '../table/copyTestTableEditor';
import {
  buildCopyTestRowsForValidation,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSelectableCopyTestRowIndexes,
  parseCopyTestStorageTables,
  refreshWorkingTable,
  type CopyTestColumnContext,
} from '../table/copyTestTableParser';
import { getCopyTestImageId } from '../table/copyTestImageUtils';
import {
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
} from '../table/tableConstants';

/** 删除 Evidence 后的状态。 */
export interface CopyTestSessionDeleteResult {
  imageStillUsed: boolean;
  removed: boolean;
}

/** copyTest 会话状态 hook 的返回值。 */
export interface UseCopyTestSessionResult {
  applyLoadedStorage: (nextStorageHtml: string) => number;
  applyValidationResults: (
    results: CopyTestValidationResultWithEvidence[],
    images: CopyTestImage[],
    selectedColumnIndex: number,
    selectedColumnLabel: string,
    tableIndex: number
  ) => void;
  buildSelectedRowsForValidation: () => CopyTestRowInput[];
  commitExportedStorage: (nextStorageHtml: string) => void;
  deleteEvidenceImage: (target: CopyTestEvidenceDeleteTarget) => CopyTestSessionDeleteResult;
  getCurrentValidationImages: () => CopyTestImage[];
  handleComparisonColumnChange: (columnIndex?: number) => void;
  handleTableChange: (value: number) => void;
  originalStorageHtml: string;
  previewColumnIndexes: number[];
  referenceColumnIndex?: number;
  referenceHeader?: CopyTestHeader;
  removeEvidenceImageReference: (target: CopyTestEvidenceDeleteTarget) => CopyTestSessionDeleteResult;
  resetLoadedData: () => void;
  resetValidationSnapshots: () => void;
  selectedColumnContext: CopyTestColumnContext | null;
  selectedColumnIndex?: number;
  selectedHeader?: CopyTestHeader;
  selectedRowIndexes: number[];
  selectedTable?: CopyTestTableEntry;
  selectedColumnHasExportableContent: boolean;
  selectedTableIndex?: number;
  setSelectedRowIndexes: (value: number[]) => void;
  storageHtml: string;
  tables: CopyTestTableEntry[];
}

/** 校验图片快照集合。 */
type ValidationImageSnapshotMap = Record<string, CopyTestImage[]>;

/** 生成当前列快照 key。 */
const buildSnapshotKey = (
  tableIndex: number,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): string => {
  return `${tableIndex}:${selectedColumnIndex}:${selectedColumnLabel}`;
};

/** 从表格中替换指定工作表格。 */
const replaceTable = (
  tables: CopyTestTableEntry[],
  nextTable: CopyTestTableEntry
): CopyTestTableEntry[] => {
  return tables.map(table => (table.index === nextTable.index ? nextTable : table));
};

/** 使用最新 original storage 刷新表格原始快照。 */
const refreshOriginalTableSnapshots = (
  tables: CopyTestTableEntry[],
  nextStorageHtml: string
): CopyTestTableEntry[] => {
  const parsedTables = parseCopyTestStorageTables(nextStorageHtml);
  return tables.map(table => {
    const parsedTable = parsedTables.find(item => item.index === table.index);
    if (!parsedTable) {
      return table;
    }

    return {
      ...table,
      originalHtml: parsedTable.originalHtml,
      range: parsedTable.range,
    };
  });
};

/** 判断元素是否包含可导出的实际内容。 */
const hasElementContent = (element: Element | undefined): boolean => {
  if (!element) {
    return false;
  }

  return element.textContent?.trim() !== ''
    || Boolean(element.querySelector('ac\\:image, ac-image, image, img'));
};

/** 判断指定生成列是否有可导出内容。 */
const hasGeneratedColumnContent = (
  table: CopyTestTableEntry | undefined,
  columnIndex: number | undefined,
  generatedType: string
): boolean => {
  if (!table || columnIndex === undefined) {
    return false;
  }

  const selector = `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${generatedType}"]`;
  return table.model.rows.slice(1).some(row => {
    const cell = row.slots[columnIndex]?.cell.element;
    return hasElementContent(cell?.querySelector(selector) || cell);
  });
};

/** 判断当前 Comparison Column 的 Test 两列是否有内容可导出。 */
const hasSelectedColumnExportableContent = (
  table: CopyTestTableEntry | undefined,
  context: CopyTestColumnContext | null
): boolean => {
  if (!table || !context) {
    return false;
  }

  const indexes = findGeneratedColumnIndexes(
    table.headers,
    context.sourceColumnKey,
    context.selectedHeader.label
  );
  return hasGeneratedColumnContent(table, indexes.result, COPY_TEST_GENERATED_RESULT_TYPE)
    || hasGeneratedColumnContent(table, indexes.evidence, COPY_TEST_GENERATED_EVIDENCE_TYPE);
};

/** 管理 CopyTest 会话状态。 */
export const useCopyTestSession = (): UseCopyTestSessionResult => {
  const [originalStorageHtml, setOriginalStorageHtml] = useState('');
  const [tables, setTables] = useState<CopyTestTableEntry[]>([]);
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>();
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number>();
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const validationImageSnapshotsRef = useRef<ValidationImageSnapshotMap>({});

  const selectedTable = useMemo(
    () => tables.find(table => table.index === selectedTableIndex),
    [selectedTableIndex, tables]
  );

  const selectedColumnContext = useMemo(
    () => getCopyTestColumnContext(selectedTable, selectedColumnIndex),
    [selectedColumnIndex, selectedTable]
  );

  const selectedHeader = selectedColumnContext?.selectedHeader;
  const referenceColumnIndex = selectedColumnContext?.referenceColumnIndex;
  const referenceHeader = selectedColumnContext?.referenceHeader;
  const previewColumnIndexes = useMemo(
    () => selectedColumnIndex === undefined ? selectedTable?.headers.map(header => header.index) || [] : [],
    [selectedColumnIndex, selectedTable]
  );
  const selectedColumnHasExportableContent = useMemo(
    () => hasSelectedColumnExportableContent(selectedTable, selectedColumnContext),
    [selectedColumnContext, selectedTable]
  );

  /** 重置校验图片快照。 */
  const resetValidationSnapshots = (): void => {
    validationImageSnapshotsRef.current = {};
  };

  /** 重置全部已加载数据。 */
  const resetLoadedData = (): void => {
    setOriginalStorageHtml('');
    setTables([]);
    setSelectedTableIndex(undefined);
    setSelectedColumnIndex(undefined);
    setSelectedRowIndexes([]);
    resetValidationSnapshots();
  };

  /** 应用导入的 storage。 */
  const applyLoadedStorage = (nextStorageHtml: string): number => {
    const nextTables = parseCopyTestStorageTables(nextStorageHtml);
    setOriginalStorageHtml(nextStorageHtml);
    setTables(nextTables);
    setSelectedTableIndex(nextTables[0]?.index);
    setSelectedColumnIndex(undefined);
    setSelectedRowIndexes([]);
    resetValidationSnapshots();
    return nextTables.length;
  };

  /** 提交已成功导出的 storage 作为后续列级 patch 基底。 */
  const commitExportedStorage = (nextStorageHtml: string): void => {
    setOriginalStorageHtml(nextStorageHtml);
    setTables(prevTables => refreshOriginalTableSnapshots(prevTables, nextStorageHtml));
  };

  /** 切换表格。 */
  const handleTableChange = (value: number): void => {
    setSelectedTableIndex(value);
    setSelectedColumnIndex(undefined);
    setSelectedRowIndexes([]);
  };

  /** 更新指定表格。 */
  const updateWorkingTable = (nextTable: CopyTestTableEntry): void => {
    setTables(prevTables => replaceTable(prevTables, nextTable));
  };

  /** 切换 Comparison Column 并确保当前列 Test 列存在。 */
  const handleComparisonColumnChange = (columnIndex?: number): void => {
    if (!selectedTable || columnIndex === undefined) {
      setSelectedColumnIndex(undefined);
      setSelectedRowIndexes([]);
      return;
    }

    const header = selectedTable.headers.find(item => item.index === columnIndex);
    if (!header) {
      setSelectedColumnIndex(undefined);
      setSelectedRowIndexes([]);
      return;
    }

    const nextTable = ensureCopyTestWorkingColumns(selectedTable, columnIndex, header.label);
    updateWorkingTable(nextTable);
    setSelectedColumnIndex(columnIndex);
    setSelectedRowIndexes(getSelectableCopyTestRowIndexes(nextTable, columnIndex));
  };

  /** 构建当前选中行校验输入。 */
  const buildSelectedRowsForValidation = (): CopyTestRowInput[] => {
    return buildCopyTestRowsForValidation(selectedTable, selectedColumnContext, selectedRowIndexes);
  };

  /** 保存当前列最近一次校验图片。 */
  const saveValidationImages = (
    tableIndex: number,
    columnIndex: number,
    columnLabel: string,
    images: CopyTestImage[]
  ): void => {
    validationImageSnapshotsRef.current = {
      ...validationImageSnapshotsRef.current,
      [buildSnapshotKey(tableIndex, columnIndex, columnLabel)]: images,
    };
  };

  /** 读取当前列最近一次校验图片。 */
  const getCurrentValidationImages = (): CopyTestImage[] => {
    if (!selectedTable || !selectedHeader || selectedColumnIndex === undefined) {
      return [];
    }

    return validationImageSnapshotsRef.current[
      buildSnapshotKey(selectedTable.index, selectedColumnIndex, selectedHeader.label)
    ] || [];
  };

  /** 应用校验结果。 */
  const applyValidationResults = (
    results: CopyTestValidationResultWithEvidence[],
    images: CopyTestImage[],
    columnIndex: number,
    columnLabel: string,
    tableIndex: number
  ): void => {
    const targetTable = tables.find(table => table.index === tableIndex);
    if (!targetTable) {
      return;
    }

    const nextTable = applyCopyTestValidationResults(
      targetTable,
      results,
      images,
      columnIndex,
      columnLabel
    );
    updateWorkingTable(nextTable);
    saveValidationImages(tableIndex, columnIndex, columnLabel, images);
  };

  /** 删除当前列 Evidence 图片引用。 */
  const removeEvidenceImageReference = (target: CopyTestEvidenceDeleteTarget): CopyTestSessionDeleteResult => {
    if (!selectedTable || !selectedHeader || selectedColumnIndex === undefined) {
      return { imageStillUsed: false, removed: false };
    }

    const result = deleteCopyTestEvidenceImage(
      selectedTable,
      target,
      selectedColumnIndex,
      selectedHeader.label
    );
    if (!result.removed) {
      return { imageStillUsed: false, removed: false };
    }

    updateWorkingTable(refreshWorkingTable(result.table, result.table.workingHtml));
    if (!result.imageStillUsed) {
      const snapshotKey = buildSnapshotKey(selectedTable.index, selectedColumnIndex, selectedHeader.label);
      validationImageSnapshotsRef.current = {
        ...validationImageSnapshotsRef.current,
        [snapshotKey]: (validationImageSnapshotsRef.current[snapshotKey] || [])
          .filter(image => getCopyTestImageId(image) !== target.imageId),
      };
    }
    return { imageStillUsed: result.imageStillUsed, removed: true };
  };

  return {
    applyLoadedStorage,
    applyValidationResults,
    buildSelectedRowsForValidation,
    commitExportedStorage,
    deleteEvidenceImage: removeEvidenceImageReference,
    getCurrentValidationImages,
    handleComparisonColumnChange,
    handleTableChange,
    originalStorageHtml,
    previewColumnIndexes,
    referenceColumnIndex,
    referenceHeader,
    removeEvidenceImageReference,
    resetLoadedData,
    resetValidationSnapshots,
    selectedColumnContext,
    selectedColumnHasExportableContent,
    selectedColumnIndex,
    selectedHeader,
    selectedRowIndexes,
    selectedTable,
    selectedTableIndex,
    setSelectedRowIndexes,
    storageHtml: originalStorageHtml,
    tables,
  };
};
