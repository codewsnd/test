/**
 * 文件作用：管理 CopyTest 原始 storage、working table、列选择、行选择和校验写入。
 */
import { useMemo, useReducer, useRef } from 'react';
import type { CopyTestImage, CopyTestRowInput } from '../api/copyTestApi';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestHeader,
  CopyTestResultStatusUpdate,
  CopyTestTableEntry,
  CopyTestValidationResultWithEvidence,
} from '../types';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
  hydrateCopyTestValidationSnapshot,
  setCopyTestResultStatus,
  type CopyTestResultScreenStatus,
  type CopyTestValidationSnapshot,
} from '../table/copyTestTableEditor';
import { isGeneratedCellForSource } from '../table/copyTestTableColumns';
import {
  buildCopyTestRowsForValidation,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSelectableCopyTestRowIndexes,
  getSourceColumnKey,
  normalizeCopyTestSelectedRowIndexes,
  parseCopyTestStorageTables,
  refreshWorkingTable,
  type CopyTestColumnContext,
} from '../table/copyTestTableParser';
import { getConfluenceStorageTableImageFileNames } from '../table/copyTestTableImages';
import { migrateCopyTestImageLabelsWithDetails } from '../table/copyTestImageLabelMigration';
import { COPY_TEST_GENERATED_EVIDENCE_TYPE } from '../table/tableConstants';
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

/** 一次 Comparison Column 选择对应的严格 Evidence 附件上下文。 */
export interface CopyTestComparisonColumnSelection {
  /** 当前严格 managed Evidence Pair 实际引用的附件文件名。 */
  fileNames: string[];
  /** 当前来源列稳定 ownership 键。 */
  sourceColumnKey: string;
  /** 当前表格在 storage 中的下标。 */
  tableIndex: number;
}

/** copyTest 会话状态 hook 的返回值。 */
export interface UseCopyTestSessionResult {
  /** 合并一次仍有效的 Comparison Column 附件响应。 */
  applyComparisonColumnPreviewImages: (
    selection: CopyTestComparisonColumnSelection,
    images: CopyTestImage[]
  ) => void;
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
  handleComparisonColumnChange: (
    columnIndex?: number
  ) => CopyTestComparisonColumnSelection | null;
  /** 切换当前操作的 Confluence 表格。 */
  handleTableChange: (value: number) => void;
  /** 最近一次成功导入或导出后的完整 storage。 */
  originalStorageHtml: string;
  /** 清空当前导入页面、表格选择和本地校验快照。 */
  resetSession: () => void;
  /** 清空各列保存的校验图片快照。 */
  resetValidationSnapshots: () => void;
  /** working table 内容变更时递增的预览版本号。 */
  revision: number;
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
  /** 当前 Comparison Column 是否包含可回写的本地变更，包括清空双列。 */
  selectedColumnHasExportableContent: boolean;
  /** 当前操作表格在 storage 中的下标。 */
  selectedTableIndex?: number;
  /** 更新选中的来源原子组锚点行。 */
  setSelectedRowIndexes: (value: number[]) => void;
  /** 将当前来源 Pair 中单个 Result Screen 移入明确状态分组。 */
  setResultStatus: (update: CopyTestResultStatusUpdate) => boolean;
  /** 当前 storage 中解析出的全部有效表格。 */
  tables: CopyTestTableEntry[];
}

/** 校验图片快照集合。 */
type ValidationImageSnapshotMap = Record<string, CopyTestImage[]>;

/** 逐来源原子行校验结果快照集合。 */
type ValidationResultSnapshotMap = Record<string, CopyTestValidationResultWithEvidence[]>;

/** 未产生校验图片时复用稳定空数组。 */
const EMPTY_VALIDATION_IMAGES: CopyTestImage[] = [];

/** 构建局部校验合并快照所需的上下文。 */
interface BuildMergedValidationSnapshotParams {
  /** 当前 Comparison Column 的逻辑列下标。 */
  columnIndex: number;
  /** 当前 Comparison Column 的原始表头文本。 */
  columnLabel: string;
  /** 本次 Validate 实际可用的内存图片。 */
  currentImages: CopyTestImage[];
  /** 本次 Validate 返回且应累计到同 rowIndex 历史 Screen 的结果。 */
  currentResults: CopyTestValidationResultWithEvidence[];
  /** 最近一次导入时成功加载的 Evidence 图片。 */
  importedImages: CopyTestImage[];
  /** 当前 Pair 上一次保存且可能带真实 base64 的图片。 */
  previousImages: CopyTestImage[];
  /** 当前 Pair 即将应用局部 Validate 的工作表格。 */
  table: CopyTestTableEntry;
}

/** 判断图片是否包含可用于浏览器预览或附件上传的实际内容。 */
const hasCopyTestImageContent = (image: CopyTestImage): boolean => {
  return image.base64.trim() !== '';
};

/** 按文件名合并 DOM 占位身份和已加载图片，保持首次出现顺序并优先保留实际内容。 */
const mergeCopyTestImageIdentities = (
  ...imageGroups: CopyTestImage[][]
): CopyTestImage[] => {
  /** 按首次出现顺序保存图片身份的文件名索引。 */
  const imageByFileName = new Map<string, CopyTestImage>();
  imageGroups.flat().forEach(image => {
    /** 同一附件文件名当前已经保存的图片身份。 */
    const existingImage = imageByFileName.get(image.fileName);
    if (!existingImage) {
      imageByFileName.set(image.fileName, image);
      return;
    }
    if (hasCopyTestImageContent(image)) {
      imageByFileName.set(image.fileName, {
        ...image,
        originalFileName: image.originalFileName || existingImage.originalFileName,
      });
    }
  });
  return Array.from(imageByFileName.values());
};

/** 将单个 Evidence 单元格包装为图片提取工具可扫描的最小表格。 */
const wrapEvidenceCell = (cell: Element): string => {
  return `<table><tr>${cell.outerHTML}</tr></table>`;
};

/** 读取指定来源 Pair 中严格 managed Evidence 单元格引用的附件文件名。 */
const getManagedPairAttachmentFileNames = (
  table: CopyTestTableEntry,
  sourceColumnKey: string
): string[] => {
  /** 当前来源 Pair 的严格 managed Evidence 逻辑列下标。 */
  const evidenceColumnIndex = findGeneratedColumnIndexes(
    table.headers,
    sourceColumnKey
  ).evidence;
  if (evidenceColumnIndex === undefined) {
    return [];
  }

  /** 当前 Evidence 列中由物理行直接拥有且 ownership 匹配的单元格。 */
  const evidenceCells = table.model.rows.slice(1).flatMap(row => {
    /** 当前物理行在 Evidence 逻辑列上的槽位。 */
    const slot = row.slots[evidenceColumnIndex];
    return slot?.owned && isGeneratedCellForSource(
      slot.cell,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      sourceColumnKey
    )
      ? [slot.cell.element]
      : [];
  });
  return Array.from(new Set(evidenceCells.flatMap(cell => {
    return getConfluenceStorageTableImageFileNames(wrapEvidenceCell(cell));
  })));
};

/** 只保留指定来源 Pair 实际引用且已加载到内存的图片。 */
const getManagedPairPreviewImages = (
  table: CopyTestTableEntry,
  sourceColumnKey: string,
  images: CopyTestImage[]
): CopyTestImage[] => {
  const fileNames = new Set(getManagedPairAttachmentFileNames(table, sourceColumnKey));
  return images.filter(image => fileNames.has(image.fileName));
};

/** 将行级 AI 结果补齐为可独立累计的逐 Screen 状态。 */
const buildCopyTestResultScreenStatuses = (
  result: CopyTestValidationResultWithEvidence
): CopyTestResultScreenStatus[] => {
  /** DOM 恢复结果中可能包含人工调整后的显式 Screen 状态。 */
  const explicitStatusByImageId = new Map(
    (result.screenStatuses || []).map(status => [status.imageId, status])
  );
  return result.evidenceImageFileNames.map(imageId => {
    /** 当前图片已有的人工或历史状态。 */
    const explicitStatus = explicitStatusByImageId.get(imageId);
    if (explicitStatus) {
      return {
        ...explicitStatus,
        languageIssues: [...explicitStatus.languageIssues],
      };
    }
    return {
      imageId,
      languageIssues: [...result.languageIssues],
      passed: result.passed,
    };
  });
};

/** 按图片身份累计 Screen，并优先保留历史人工状态。 */
const mergeCopyTestResultScreenStatuses = (
  historicalStatuses: CopyTestResultScreenStatus[],
  currentStatuses: CopyTestResultScreenStatus[]
): CopyTestResultScreenStatus[] => {
  /** 保持历史图片在前、本批新图片在后的稳定顺序。 */
  const statusByImageId = new Map(
    historicalStatuses.map(status => [status.imageId, status])
  );
  currentStatuses.forEach(status => {
    if (!statusByImageId.has(status.imageId)) {
      statusByImageId.set(status.imageId, status);
    }
  });
  return Array.from(statusByImageId.values());
};

/** 将同一来源行的历史与本批 Evidence 合并为完整结果。 */
const mergeCopyTestValidationRowResult = (
  historicalResult: CopyTestValidationResultWithEvidence,
  currentResult: CopyTestValidationResultWithEvidence
): CopyTestValidationResultWithEvidence => {
  const historicalHasEvidence = historicalResult.evidenceImageFileNames.length > 0;
  const currentHasEvidence = currentResult.evidenceImageFileNames.length > 0;
  if (!currentHasEvidence) {
    return historicalHasEvidence ? historicalResult : currentResult;
  }
  if (!historicalHasEvidence) {
    return currentResult;
  }
  /** 每张旧图保留原状态，每张新图继承本轮 AI 行级状态。 */
  const screenStatuses = mergeCopyTestResultScreenStatuses(
    buildCopyTestResultScreenStatuses(historicalResult),
    buildCopyTestResultScreenStatuses(currentResult)
  );
  return {
    ...currentResult,
    evidenceImageFileNames: screenStatuses.map(status => status.imageId),
    evidenceImages: mergeCopyTestImageIdentities(
      historicalResult.evidenceImages,
      currentResult.evidenceImages
    ),
    languageIssues: Array.from(new Set(
      screenStatuses.flatMap(status => status.languageIssues)
    )),
    passed: screenStatuses.some(status => status.passed),
    screenStatuses,
  };
};

/** 按 rowIndex 累计本次与历史 Screen，并保持物理数据行顺序。 */
const mergeCopyTestValidationResults = (
  historicalResults: CopyTestValidationResultWithEvidence[],
  currentResults: CopyTestValidationResultWithEvidence[]
): CopyTestValidationResultWithEvidence[] => {
  /** 每个业务锚点行当前累计生效的校验结果。 */
  const resultByRowIndex = new Map<number, CopyTestValidationResultWithEvidence>();
  historicalResults.forEach(result => resultByRowIndex.set(result.rowIndex, result));
  currentResults.forEach(result => {
    /** 同一业务行从 working DOM 恢复出的历史结果。 */
    const historicalResult = resultByRowIndex.get(result.rowIndex);
    resultByRowIndex.set(
      result.rowIndex,
      historicalResult
        ? mergeCopyTestValidationRowResult(historicalResult, result)
        : result
    );
  });
  return Array.from(resultByRowIndex.values()).sort(
    /** 按业务数据行下标恢复从上到下的稳定顺序。 */
    (left, right) => left.rowIndex - right.rowIndex
  );
};

/** 读取合并结果仍实际引用的全部 Evidence 文件名。 */
const getReferencedValidationImageFileNames = (
  results: CopyTestValidationResultWithEvidence[]
): Set<string> => {
  return new Set(results.flatMap(result => result.evidenceImageFileNames));
};

/** 从 working DOM 恢复历史结果，并累计本次 Screen 后构建完整快照。 */
const buildMergedValidationSnapshot = ({
  columnIndex,
  columnLabel,
  currentImages,
  currentResults,
  importedImages,
  previousImages,
  table,
}: BuildMergedValidationSnapshotParams): CopyTestValidationSnapshot => {
  /** working DOM 中当前仍真实存在的历史 Result/Evidence 关系。 */
  const historicalSnapshot = hydrateCopyTestValidationSnapshot(
    table,
    columnIndex,
    columnLabel
  );
  /** 用已有内存内容补齐 DOM 恢复出的轻量图片身份。 */
  const availableImages = mergeCopyTestImageIdentities(
    historicalSnapshot?.images || [],
    previousImages,
    importedImages,
    currentImages
  );
  /** 重新绑定真实图片后的历史逐行结果。 */
  const historicalResults = bindResultImages(
    historicalSnapshot?.results || [],
    availableImages
  );
  /** 本次 Screen 累计到历史值后的完整逐行结果。 */
  const mergedResults = mergeCopyTestValidationResults(historicalResults, currentResults);
  /** 完整结果当前仍实际引用的 Evidence 文件名。 */
  const referencedFileNames = getReferencedValidationImageFileNames(mergedResults);
  /** 仅保存仍被结果引用的图片，并优先沿用真实 base64。 */
  const mergedImages = availableImages.filter(image => referencedFileNames.has(image.fileName));
  return {
    images: mergedImages,
    results: bindResultImages(mergedResults, mergedImages),
  };
};

/** 生成表格来源列 Pair 的待回写状态键。 */
const buildPendingExportPairKey = (tableIndex: number, sourceColumnKey: string): string => {
  return `${tableIndex}:${sourceColumnKey}`;
};

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
    return image && hasCopyTestImageContent(image) ? [image] : [];
  });
};

/** 导入表格完成历史标签迁移后的 working 值和待回写 Pair。 */
interface MigratedLoadedTable {
  /** 保持原始快照、只更新 working 标签的表格。 */
  table: CopyTestTableEntry;
  /** 用户选择对应 Comparison Column 后可明确回写的 Pair 键。 */
  pendingExportPairKeys: string[];
}

/** 将导入表格中的历史 Screen 标签迁移为文件名，并保持原始快照不变。 */
const migrateLoadedTableImageLabels = (table: CopyTestTableEntry): MigratedLoadedTable => {
  /** 只改写 working 副本中的严格受管 Result/Evidence 标签。 */
  const migration = migrateCopyTestImageLabelsWithDetails(table.workingHtml);
  return {
    pendingExportPairKeys: migration.sourceColumnKeys.map(sourceColumnKey => {
      return buildPendingExportPairKey(table.index, sourceColumnKey);
    }),
    table: migration.html === table.workingHtml
      ? table
      : refreshWorkingTable(table, migration.html),
  };
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

/** 管理 CopyTest 会话状态。 */
export const useCopyTestSession = (): UseCopyTestSessionResult => {
  /** reducer 会话状态及动作分发函数。 */
  const [state, dispatch] = useReducer(copyTestSessionReducer, copyTestSessionInitialState);
  /** 当前操作频繁使用的会话字段。 */
  const {
    originalStorageHtml,
    pendingExportPairKeys,
    revision,
    selectedColumnIndex,
    selectedRowIndexes,
    selectedTableIndex,
    tables,
  } = state;
  /** 最近一次成功导入的附件预览图片。 */
  const importedPreviewImagesRef = useRef<CopyTestImage[]>([]);
  /** 按表格和来源列保存的最近校验图片快照。 */
  const validationImageSnapshotsRef = useRef<ValidationImageSnapshotMap>({});
  /** 按表格和来源列保存的最近逐行校验结果快照。 */
  const validationResultSnapshotsRef = useRef<ValidationResultSnapshotMap>({});

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
  /** 当前表格与来源列对应的待回写 Pair 键。 */
  const selectedPendingExportPairKey = useMemo(
    () => selectedTable && selectedColumnContext
      ? buildPendingExportPairKey(selectedTable.index, selectedColumnContext.sourceColumnKey)
      : undefined,
    [selectedColumnContext, selectedTable]
  );
  /** 当前 Comparison Column 是否有尚未回写的 Validate 或删除变更。 */
  const selectedColumnHasExportableContent = selectedPendingExportPairKey !== undefined
    && pendingExportPairKeys.includes(selectedPendingExportPairKey);
  /** 当前 working table 实际引用的内存预览图片。 */
  const currentPreviewImages = buildCurrentPreviewImages(
    selectedTable,
    importedPreviewImagesRef.current,
    validationImageSnapshotsRef.current
  );

  /** 重置校验图片快照。 */
  const resetValidationSnapshots = (): void => {
    validationImageSnapshotsRef.current = {};
    validationResultSnapshotsRef.current = {};
  };

  /** 清空当前导入页面及所有只属于该页面的内存状态。 */
  const resetSession = (): void => {
    importedPreviewImagesRef.current = [];
    resetValidationSnapshots();
    dispatch({ type: 'RESET' });
  };

  /** 应用导入的 storage。 */
  const applyLoadedStorage = (
    nextStorageHtml: string,
    previewImages: CopyTestImage[] = []
  ): number => {
    /** 新 storage 中解析并完成历史图片标签迁移的全部有效工作表格。 */
    const migratedTables = parseCopyTestStorageTables(nextStorageHtml)
      .map(migrateLoadedTableImageLabels);
    /** 只包含 working 标签迁移、原始快照仍未变化的表格集合。 */
    const nextTables = migratedTables.map(item => item.table);
    /** 所有历史标签变更所属的待回写 Pair 键。 */
    const pendingExportPairKeys = migratedTables.flatMap(item => item.pendingExportPairKeys);
    importedPreviewImagesRef.current = [...previewImages];
    dispatch({
      pendingExportPairKeys,
      storageHtml: nextStorageHtml,
      tables: nextTables,
      type: 'LOADED',
    });
    resetValidationSnapshots();
    return nextTables.length;
  };

  /** 合并当前列严格附件响应，忽略接口额外返回的非目标图片。 */
  const applyComparisonColumnPreviewImages = (
    selection: CopyTestComparisonColumnSelection,
    images: CopyTestImage[]
  ): void => {
    /** 本次请求声明的严格 Evidence 附件文件名。 */
    const requestedFileNames = new Set(selection.fileNames);
    /** 只允许请求集合内的图片进入当前会话缓存。 */
    const requestedImages = images.filter(image => requestedFileNames.has(image.fileName));
    if (requestedImages.length === 0) {
      return;
    }

    importedPreviewImagesRef.current = mergeCopyTestImageIdentities(
      importedPreviewImagesRef.current,
      requestedImages
    );
    dispatch({ type: 'PREVIEW_IMAGES_UPDATED' });
  };

  /** 提交已成功导出的 storage 作为后续列级 patch 基底。 */
  const commitExportedStorage = (nextStorageHtml: string): void => {
    dispatch({
      exportedPairKey: selectedPendingExportPairKey,
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
  const updateWorkingTable = (
    nextTable: CopyTestTableEntry,
    pendingExportPairKey: string
  ): void => {
    dispatch({ pendingExportPairKey, table: nextTable, type: 'TABLE_UPDATED' });
  };

  /** 切换 Comparison Column 并确保当前列 Test 列存在。 */
  const handleComparisonColumnChange = (
    columnIndex?: number
  ): CopyTestComparisonColumnSelection | null => {
    if (!selectedTable || columnIndex === undefined) {
      dispatch({ columnIndex: undefined, type: 'COLUMN_SELECTED' });
      return null;
    }

    /** 当前逻辑列下标对应的非空表头。 */
    const header = selectedTable.headers.find(item => item.index === columnIndex);
    if (!header) {
      dispatch({ columnIndex: undefined, type: 'COLUMN_SELECTED' });
      return null;
    }

    /** 已确保当前 source Pair 双列存在的新工作表格。 */
    const nextTable = ensureCopyTestWorkingColumns(selectedTable, columnIndex, header.label);
    dispatch({
      columnIndex,
      defaultSelectedRowIndexes: getSelectableCopyTestRowIndexes(nextTable, columnIndex),
      nextTable,
      type: 'COLUMN_SELECTED',
    });
    /** 当前来源列与生成 Pair 共用的严格 ownership 键。 */
    const sourceColumnKey = getSourceColumnKey(columnIndex, header.label);
    return {
      fileNames: getManagedPairAttachmentFileNames(nextTable, sourceColumnKey),
      sourceColumnKey,
      tableIndex: nextTable.index,
    };
  };

  /** 构建当前选中行校验输入。 */
  const buildSelectedRowsForValidation = (): CopyTestRowInput[] => {
    return buildCopyTestRowsForValidation(selectedTable, selectedColumnContext, selectedRowIndexes);
  };

  /** 保存当前列最近一次图片顺序和逐行校验关系。 */
  const saveValidationSnapshot = (
    tableIndex: number,
    columnIndex: number,
    columnLabel: string,
    images: CopyTestImage[],
    results: CopyTestValidationResultWithEvidence[]
  ): void => {
    /** 当前表格与来源列共用的快照键。 */
    const snapshotKey = buildSnapshotKey(tableIndex, columnIndex, columnLabel);
    validationImageSnapshotsRef.current = {
      ...validationImageSnapshotsRef.current,
      [snapshotKey]: images,
    };
    validationResultSnapshotsRef.current = {
      ...validationResultSnapshotsRef.current,
      [snapshotKey]: results,
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

    /** 当前表格与来源列共用的校验快照键。 */
    const snapshotKey = buildSnapshotKey(tableIndex, columnIndex, columnLabel);
    /** working DOM 历史与本次局部结果合并后的完整 Pair 快照。 */
    const mergedSnapshot = buildMergedValidationSnapshot({
      columnIndex,
      columnLabel,
      currentImages: images,
      currentResults: results,
      importedImages: getManagedPairPreviewImages(
        targetTable,
        getSourceColumnKey(columnIndex, columnLabel),
        importedPreviewImagesRef.current
      ),
      previousImages: validationImageSnapshotsRef.current[snapshotKey] || [],
      table: targetTable,
    });
    /** 写入完整合并校验结果后的工作表格。 */
    const nextTable = applyCopyTestValidationResults(
      targetTable,
      mergedSnapshot.results,
      columnIndex,
      columnLabel,
      mergedSnapshot.images
    );
    /** 校验结果即使为空也必须作为可回写的 Pair 变更保存。 */
    const pendingExportPairKey = buildPendingExportPairKey(
      tableIndex,
      getSourceColumnKey(columnIndex, columnLabel)
    );
    updateWorkingTable(nextTable, pendingExportPairKey);
    saveValidationSnapshot(
      tableIndex,
      columnIndex,
      columnLabel,
      mergedSnapshot.images,
      mergedSnapshot.results
    );
  };

  /** 删除当前列 Evidence 图片引用。 */
  const deleteEvidenceImage = (target: CopyTestEvidenceDeleteTarget): CopyTestSessionDeleteResult => {
    if (!selectedTable || !selectedHeader || selectedColumnIndex === undefined) {
      return { imageStillUsed: false, removed: false };
    }

    /** 当前表格与来源列共用的校验快照键。 */
    const snapshotKey = buildSnapshotKey(selectedTable.index, selectedColumnIndex, selectedHeader.label);
    /** 当前来源列最近一次逐行关系与图片顺序快照。 */
    const snapshot: CopyTestValidationSnapshot | undefined = validationResultSnapshotsRef.current[snapshotKey]
      ? {
          images: validationImageSnapshotsRef.current[snapshotKey] || [],
          results: validationResultSnapshotsRef.current[snapshotKey],
        }
      : undefined;
    /** 在当前 source Pair 内删除精确图片实例的结果。 */
    const result = deleteCopyTestEvidenceImage(
      selectedTable,
      target,
      selectedColumnIndex,
      selectedHeader.label,
      snapshot
    );
    if (!result.removed) {
      return { imageStillUsed: false, removed: false };
    }

    updateWorkingTable(
      refreshWorkingTable(result.table, result.table.workingHtml),
      buildPendingExportPairKey(
        selectedTable.index,
        getSourceColumnKey(selectedColumnIndex, selectedHeader.label)
      )
    );
    if (result.validationResults) {
      /** 合并 DOM 恢复的完整身份、本会话快照和已加载预览，避免部分附件响应丢失后续删除目标。 */
      const availableImages = mergeCopyTestImageIdentities(
        result.validationImages || [],
        snapshot?.images || [],
        currentPreviewImages
      );
      /** 把 DOM 恢复的轻量文件名重新绑定到浏览器内真实图片。 */
      const validationResults = bindResultImages(result.validationResults, availableImages);
      validationResultSnapshotsRef.current = {
        ...validationResultSnapshotsRef.current,
        [snapshotKey]: validationResults,
      };
      /** 删除后当前来源列仍实际引用的图片文件名。 */
      const remainingFileNames = new Set(
        validationResults.flatMap(item => item.evidenceImageFileNames)
      );
      validationImageSnapshotsRef.current = {
        ...validationImageSnapshotsRef.current,
        [snapshotKey]: availableImages
          .filter(image => remainingFileNames.has(image.fileName)),
      };
    }
    return { imageStillUsed: result.imageStillUsed, removed: true };
  };

  /** 从更新后的 working DOM 同步逐 Screen 状态和真实图片快照。 */
  const synchronizeResultStatusSnapshot = (
    snapshotKey: string,
    table: CopyTestTableEntry,
    columnIndex: number,
    columnLabel: string
  ): void => {
    /** Result DOM 中按 Screen 恢复出的状态和轻量图片身份。 */
    const snapshot = hydrateCopyTestValidationSnapshot(
      table,
      columnIndex,
      columnLabel
    );
    if (!snapshot) {
      return;
    }

    /** 优先保留浏览器内已有真实内容的可用图片。 */
    const availableImages = mergeCopyTestImageIdentities(
      snapshot.images,
      validationImageSnapshotsRef.current[snapshotKey] || [],
      getManagedPairPreviewImages(
        table,
        getSourceColumnKey(columnIndex, columnLabel),
        importedPreviewImagesRef.current
      )
    );
    /** 当前 Result 仍实际引用的图片文件名。 */
    const referencedFileNames = getReferencedValidationImageFileNames(snapshot.results);
    /** 仅保存当前 Pair 仍引用的真实或轻量图片身份。 */
    const referencedImages = availableImages.filter(image => {
      return referencedFileNames.has(image.fileName);
    });
    validationImageSnapshotsRef.current = {
      ...validationImageSnapshotsRef.current,
      [snapshotKey]: referencedImages,
    };
    validationResultSnapshotsRef.current = {
      ...validationResultSnapshotsRef.current,
      [snapshotKey]: bindResultImages(snapshot.results, referencedImages),
    };
  };

  /** 人工移动当前来源 Pair 中单个 Screen 的状态分组。 */
  const setResultStatus = (update: CopyTestResultStatusUpdate): boolean => {
    if (
      !selectedTable
      || !selectedHeader
      || selectedColumnIndex === undefined
      || update.tableIndex !== selectedTable.index
      || update.previewRevision !== revision
    ) {
      return false;
    }

    /** 将目标 Screen 移入明确状态分组，重复消息不会产生额外变更。 */
    const result = setCopyTestResultStatus(
      selectedTable,
      selectedColumnIndex,
      selectedHeader.label,
      update
    );
    if (!result.changed) {
      return false;
    }

    /** 当前表格与来源列共用的校验快照键。 */
    const snapshotKey = buildSnapshotKey(
      selectedTable.index,
      selectedColumnIndex,
      selectedHeader.label
    );
    synchronizeResultStatusSnapshot(
      snapshotKey,
      result.table,
      selectedColumnIndex,
      selectedHeader.label
    );
    updateWorkingTable(
      result.table,
      buildPendingExportPairKey(selectedTable.index, update.sourceColumnKey)
    );
    return true;
  };

  /** 更新当前选中的来源原子组首行。 */
  const setSelectedRowIndexes = (value: number[]): void => {
    /** 将组内任意行统一映射到来源原子组锚点的规范化下标。 */
    const normalizedRowIndexes = normalizeCopyTestSelectedRowIndexes(
      selectedColumnContext?.rowGroups || [],
      value
    );
    dispatch({ selectedRowIndexes: normalizedRowIndexes, type: 'ROWS_SELECTED' });
  };

  return {
    applyComparisonColumnPreviewImages,
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
    resetSession,
    resetValidationSnapshots,
    revision,
    selectedColumnContext,
    selectedColumnHasExportableContent,
    selectedColumnIndex,
    selectedHeader,
    selectedRowIndexes,
    selectedTable,
    selectedTableIndex,
    setSelectedRowIndexes,
    setResultStatus,
    tables,
  };
};
