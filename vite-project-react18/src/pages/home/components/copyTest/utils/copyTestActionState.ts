/**
 * 文件作用：计算 CopyTest 操作按钮的可用状态和忙碌状态。
 */
import type { CopyTestTableEntry } from '../types';

/** 定义 CopyTestActionStateParams 的数据结构。 */
export interface CopyTestActionStateParams {
  attachmentsLoading: boolean;
  exportLoading: boolean;
  hasExportableContent: boolean;
  selectedColumnIndex?: number;
  selectedRowCount: number;
  selectedTable?: CopyTestTableEntry;
  storageHtml: string;
  storageLoading: boolean;
  uploadImageCount: number;
  uploadPreparing: boolean;
  validationLoading: boolean;
}

/** 定义 CopyTestActionState 的数据结构。 */
export interface CopyTestActionState {
  canExportToConfluence: boolean;
  canUpload: boolean;
  canValidate: boolean;
  importBusy: boolean;
  uploadBusy: boolean;
}

/** 处理 hasSelectedComparisonColumn 辅助逻辑。 */
const hasSelectedComparisonColumn = (selectedColumnIndex?: number): boolean => {
  return selectedColumnIndex !== undefined;
};

/** 处理 isCopyTestUploadBusy 辅助逻辑。 */
const isCopyTestUploadBusy = (
  validationLoading: boolean,
  uploadPreparing: boolean,
  exportLoading: boolean
): boolean => {
  return validationLoading || uploadPreparing || exportLoading;
};

/** 处理 isCopyTestImportBusy 辅助逻辑。 */
const isCopyTestImportBusy = (
  storageLoading: boolean,
  attachmentsLoading: boolean,
  validationLoading: boolean,
  exportLoading: boolean,
  uploadPreparing: boolean
): boolean => {
  return storageLoading
    || attachmentsLoading
    || validationLoading
    || exportLoading
    || uploadPreparing;
};

/** 处理 canUseSelectedTable 辅助逻辑。 */
const canUseSelectedTable = (
  selectedTable: CopyTestTableEntry | undefined,
  selectedColumnIndex: number | undefined,
  busy: boolean
): boolean => {
  return Boolean(selectedTable)
    && hasSelectedComparisonColumn(selectedColumnIndex)
    && !busy;
};

/** 处理 canUploadScreenshots 辅助逻辑。 */
const canUploadScreenshots = (
  selectedTable: CopyTestTableEntry | undefined,
  selectedColumnIndex: number | undefined,
  selectedRowCount: number,
  busy: boolean
): boolean => {
  return canUseSelectedTable(selectedTable, selectedColumnIndex, busy) && selectedRowCount > 0;
};

/** 处理 canWriteConfluenceStorage 辅助逻辑。 */
const canWriteConfluenceStorage = (
  hasExportableContent: boolean,
  storageHtml: string,
  selectedColumnIndex: number | undefined,
  storageLoading: boolean,
  uploadBusy: boolean
): boolean => {
  return Boolean(storageHtml)
    && hasExportableContent
    && hasSelectedComparisonColumn(selectedColumnIndex)
    && !storageLoading
    && !uploadBusy;
};

/** 处理 buildCopyTestActionState 辅助逻辑。 */
export const buildCopyTestActionState = ({
  attachmentsLoading,
  exportLoading,
  hasExportableContent,
  selectedColumnIndex,
  selectedRowCount,
  selectedTable,
  storageHtml,
  storageLoading,
  uploadImageCount,
  uploadPreparing,
  validationLoading,
}: CopyTestActionStateParams): CopyTestActionState => {

  /** 定义 uploadBusy 常量。 */
  const uploadBusy = isCopyTestUploadBusy(validationLoading, uploadPreparing, exportLoading);

  /** 定义 importBusy 常量。 */
  const importBusy = isCopyTestImportBusy(
    storageLoading,
    attachmentsLoading,
    validationLoading,
    exportLoading,
    uploadPreparing
  );

  /** 定义 canUpload 常量。 */
  const canUpload = canUploadScreenshots(selectedTable, selectedColumnIndex, selectedRowCount, uploadBusy);

  return {
    canExportToConfluence: canWriteConfluenceStorage(
      hasExportableContent,
      storageHtml,
      selectedColumnIndex,
      storageLoading,
      uploadBusy
    ),
    canUpload,
    canValidate: canUpload && uploadImageCount > 0,
    importBusy,
    uploadBusy,
  };
};
