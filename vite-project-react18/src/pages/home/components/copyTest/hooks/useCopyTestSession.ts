/**
 * 文件作用：管理 CopyTest 原始 storage、working table、列选择、行选择和校验写入。
 */
import { useMemo, useReducer, useRef } from 'react';
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
import { getConfluenceStorageTableImageFileNames } from '../table/copyTestTableImages';
import {
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
} from '../table/tableConstants';
import {
  copyTestSessionInitialState,
  copyTestSessionReducer,
} from './copyTestSessionReducer';

/** 删除 Evidence 后的状态。 */
export interface CopyTestSessionDeleteResult {
  /** 同一图片文件是否仍被当前表格的其他 Evidence 实例引用。 */
  imageStillUsed: boolean;
  /** 是否成功删除了目标图片实例。 */
  removed: boolean;
}

/** copyTest 会话状态 hook 的返回值。 */
export interface UseCopyTestSessionResult {
  /** 导入 storage 并返回解析出的有效表格数量。 */
  applyLoadedStorage: (nextStorageHtml: string, previewImages?: CopyTestImage[]) => number;
  /** 把当前列的严格校验结果写入 working table。 */
  applyValidationResults: (
    results: CopyTestValidationResultWithEvidence[],
    images: CopyTestImage[],
    selectedColumnIndex: number,
    selectedColumnLabel: string,
    tableIndex: number
  ) => void;
  /** 生成当前选中来源原子组的 AI 校验输入。 */
  buildSelectedRowsForValidation: () => CopyTestRowInput[];
  /** 将已成功导出的 storage 设为后续增量导出的基线。 */
  commitExportedStorage: (nextStorageHtml: string) => void;
  /** 删除当前生成列中的一个 Evidence 图片实例。 */
  deleteEvidenceImage: (target: CopyTestEvidenceDeleteTarget) => CopyTestSessionDeleteResult;
  /** 读取当前表格实际引用且已加载到内存的预览图片。 */
  getCurrentPreviewImages: () => CopyTestImage[];
  /** 读取当前列最近一次校验使用的图片。 */
  getCurrentValidationImages: () => CopyTestImage[];
  /** 切换 Comparison Column 并初始化对应生成双列。 */
  handleComparisonColumnChange: (columnIndex?: number) => void;
  /** 切换当前操作的 Confluence 表格。 */
  handleTableChange: (value: number) => void;
  /** 最近一次成功导入或导出后的完整 storage。 */
  originalStorageHtml: string;
  /** 清空各列保存的校验图片快照。 */
  resetValidationSnapshots: () => void;
  /** 当前选中 Comparison Column 的解析上下文。 */
  selectedColumnContext: CopyTestColumnContext | null;
  /** 当前选中 Comparison Column 的模型下标。 */
  selectedColumnIndex?: number;
  /** 当前选中 Comparison Column 的表头。 */
  selectedHeader?: CopyTestHeader;
  /** 当前选中的来源原子组锚点行下标。 */
  selectedRowIndexes: number[];
  /** 当前操作的表格。 */
  selectedTable?: CopyTestTableEntry;
  /** 当前生成双列是否包含可导出的内容。 */
  selectedColumnHasExportableContent: boolean;
  /** 当前操作表格在 storage 中的下标。 */
  selectedTableIndex?: number;
  /** 更新选中的来源原子组锚点行。 */
  setSelectedRowIndexes: (value: number[]) => void;
  /** 当前 storage 中解析出的全部有效表格。 */
  tables: CopyTestTableEntry[];
}

/** 校验图片快照集合。 */
type ValidationImageSnapshotMap = Record<string, CopyTestImage[]>;

/** 未产生校验图片时复用稳定空数组。 */
const EMPTY_VALIDATION_IMAGES: CopyTestImage[] = [];

/** 只保留当前表格 managed Evidence 实际引用的内存图片。 */
const buildCurrentPreviewImages = (
  table: CopyTestTableEntry | undefined,
  importedImages: CopyTestImage[],
  validationSnapshots: ValidationImageSnapshotMap
): CopyTestImage[] => {
  if (!table) {
    return EMPTY_VALIDATION_IMAGES;
  }
  /** 以 Confluence 附件文件名索引全部可用内存图片。 */
  const imageByFileName = new Map<string, CopyTestImage>();
  importedImages.forEach(image => imageByFileName.set(image.fileName, image));
  Object.values(validationSnapshots).flat().forEach(image => {
    imageByFileName.set(image.fileName, image);
  });
  return getConfluenceStorageTableImageFileNames(table.workingHtml).flatMap(fileName => {
    /** working table 当前附件引用对应的内存图片。 */
    const image = imageByFileName.get(fileName);
    return image ? [image] : [];
  });
};

/** 生成当前列快照 key。 */
const buildSnapshotKey = (
  tableIndex: number,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): string => {
  return `${tableIndex}:${selectedColumnIndex}:${selectedColumnLabel}`;
};

/** 使用最新 original storage 刷新表格原始快照。 */
const refreshOriginalTableSnapshots = (
  tables: CopyTestTableEntry[],
  nextStorageHtml: string
): CopyTestTableEntry[] => {
  /** 从新 storage 解析出的最新原始表格快照。 */
  const parsedTables = parseCopyTestStorageTables(nextStorageHtml);
  return tables.map(table => {
    /** 与当前 working table 下标一致的最新原始表格。 */
    const parsedTable = parsedTables.find(item => item.index === table.index);
    if (!parsedTable) {
      return table;
    }

    return {
      ...table,
      originalHtml: parsedTable.originalHtml,
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

  /** 当前生成类型的受控内容选择器。 */
  const selector = `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${generatedType}"]`;
  return table.model.rows.slice(1).some(row => {
    /** 指定生成列在当前物理行中直接拥有的单元格。 */
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

  /** 当前 source key 对应 Result/Evidence 双列的逻辑下标。 */
  const indexes = findGeneratedColumnIndexes(
    table.headers,
    context.sourceColumnKey
  );
  return hasGeneratedColumnContent(table, indexes.result, COPY_TEST_GENERATED_RESULT_TYPE)
    || hasGeneratedColumnContent(table, indexes.evidence, COPY_TEST_GENERATED_EVIDENCE_TYPE);
};

/** 管理 CopyTest 会话状态。 */
export const useCopyTestSession = (): UseCopyTestSessionResult => {
  /** reducer 会话状态及动作分发函数。 */
  const [state, dispatch] = useReducer(copyTestSessionReducer, copyTestSessionInitialState);
  /** 当前操作频繁使用的会话字段。 */
  const {
    originalStorageHtml,
    selectedColumnIndex,
    selectedRowIndexes,
    selectedTableIndex,
    tables,
  } = state;
  /** 最近一次成功导入的附件预览图片。 */
  const importedPreviewImagesRef = useRef<CopyTestImage[]>([]);
  /** 按表格和来源列保存的最近校验图片快照。 */
  const validationImageSnapshotsRef = useRef<ValidationImageSnapshotMap>({});

  /** 当前 selectedTableIndex 对应的工作表格。 */
  const selectedTable = useMemo(
    () => tables.find(table => table.index === selectedTableIndex),
    [selectedTableIndex, tables]
  );

  /** 当前 Comparison Column 的来源 key 与原子行组上下文。 */
  const selectedColumnContext = useMemo(
    () => getCopyTestColumnContext(selectedTable, selectedColumnIndex),
    [selectedColumnIndex, selectedTable]
  );

  /** 当前 Comparison Column 的表头。 */
  const selectedHeader = selectedColumnContext?.selectedHeader;
  /** 当前生成双列是否包含可导出的受控内容。 */
  const selectedColumnHasExportableContent = useMemo(
    () => hasSelectedColumnExportableContent(selectedTable, selectedColumnContext),
    [selectedColumnContext, selectedTable]
  );
  /** 当前 working table 实际引用的内存预览图片。 */
  const currentPreviewImages = useMemo(
    () => buildCurrentPreviewImages(
      selectedTable,
      importedPreviewImagesRef.current,
      validationImageSnapshotsRef.current
    ),
    [selectedTable]
  );

  /** 重置校验图片快照。 */
  const resetValidationSnapshots = (): void => {
    validationImageSnapshotsRef.current = {};
  };

  /** 应用导入的 storage。 */
  const applyLoadedStorage = (
    nextStorageHtml: string,
    previewImages: CopyTestImage[] = []
  ): number => {
    /** 新 storage 中解析出的全部有效工作表格。 */
    const nextTables = parseCopyTestStorageTables(nextStorageHtml);
    importedPreviewImagesRef.current = [...previewImages];
    dispatch({ storageHtml: nextStorageHtml, tables: nextTables, type: 'LOADED' });
    resetValidationSnapshots();
    return nextTables.length;
  };

  /** 提交已成功导出的 storage 作为后续列级 patch 基底。 */
  const commitExportedStorage = (nextStorageHtml: string): void => {
    dispatch({
      nextTables: refreshOriginalTableSnapshots(tables, nextStorageHtml),
      storageHtml: nextStorageHtml,
      type: 'EXPORT_COMMITTED',
    });
  };

  /** 切换表格。 */
  const handleTableChange = (value: number): void => {
    dispatch({ tableIndex: value, type: 'TABLE_SELECTED' });
  };

  /** 更新指定表格。 */
  const updateWorkingTable = (nextTable: CopyTestTableEntry): void => {
    dispatch({ table: nextTable, type: 'TABLE_UPDATED' });
  };

  /** 切换 Comparison Column 并确保当前列 Test 列存在。 */
  const handleComparisonColumnChange = (columnIndex?: number): void => {
    if (!selectedTable || columnIndex === undefined) {
      dispatch({ columnIndex: undefined, type: 'COLUMN_SELECTED' });
      return;
    }

    /** 当前逻辑列下标对应的非空表头。 */
    const header = selectedTable.headers.find(item => item.index === columnIndex);
    if (!header) {
      dispatch({ columnIndex: undefined, type: 'COLUMN_SELECTED' });
      return;
    }

    /** 已确保当前 source Pair 双列存在的新工作表格。 */
    const nextTable = ensureCopyTestWorkingColumns(selectedTable, columnIndex, header.label);
    dispatch({
      columnIndex,
      defaultSelectedRowIndexes: getSelectableCopyTestRowIndexes(nextTable, columnIndex),
      nextTable,
      type: 'COLUMN_SELECTED',
    });
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
    ] || EMPTY_VALIDATION_IMAGES;
  };

  /** 读取当前表格实际引用的导入附件和校验图片。 */
  const getCurrentPreviewImages = (): CopyTestImage[] => {
    return currentPreviewImages;
  };

  /** 应用校验结果。 */
  const applyValidationResults = (
    results: CopyTestValidationResultWithEvidence[],
    images: CopyTestImage[],
    columnIndex: number,
    columnLabel: string,
    tableIndex: number
  ): void => {
    /** 校验发起时锁定的目标工作表格。 */
    const targetTable = tables.find(table => table.index === tableIndex);
    if (!targetTable) {
      return;
    }

    /** 写入严格校验结果后的工作表格。 */
    const nextTable = applyCopyTestValidationResults(
      targetTable,
      results,
      columnIndex,
      columnLabel
    );
    updateWorkingTable(nextTable);
    saveValidationImages(tableIndex, columnIndex, columnLabel, images);
  };

  /** 删除当前列 Evidence 图片引用。 */
  const deleteEvidenceImage = (target: CopyTestEvidenceDeleteTarget): CopyTestSessionDeleteResult => {
    if (!selectedTable || !selectedHeader || selectedColumnIndex === undefined) {
      return { imageStillUsed: false, removed: false };
    }

    /** 在当前 source Pair 内删除精确图片实例的结果。 */
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
      /** 当前来源列校验图片快照的稳定键。 */
      const snapshotKey = buildSnapshotKey(selectedTable.index, selectedColumnIndex, selectedHeader.label);
      validationImageSnapshotsRef.current = {
        ...validationImageSnapshotsRef.current,
        [snapshotKey]: (validationImageSnapshotsRef.current[snapshotKey] || [])
          .filter(image => getCopyTestImageId(image) !== target.imageId),
      };
    }
    return { imageStillUsed: result.imageStillUsed, removed: true };
  };

  /** 更新当前选中的来源原子组首行。 */
  const setSelectedRowIndexes = (value: number[]): void => {
    dispatch({ selectedRowIndexes: value, type: 'ROWS_SELECTED' });
  };

  return {
    applyLoadedStorage,
    applyValidationResults,
    buildSelectedRowsForValidation,
    commitExportedStorage,
    deleteEvidenceImage,
    getCurrentPreviewImages,
    getCurrentValidationImages,
    handleComparisonColumnChange,
    handleTableChange,
    originalStorageHtml,
    resetValidationSnapshots,
    selectedColumnContext,
    selectedColumnHasExportableContent,
    selectedColumnIndex,
    selectedHeader,
    selectedRowIndexes,
    selectedTable,
    selectedTableIndex,
    setSelectedRowIndexes,
    tables,
  };
};
