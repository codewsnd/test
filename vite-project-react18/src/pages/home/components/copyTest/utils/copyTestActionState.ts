/**
 * 文件作用：计算 CopyTest 操作按钮的可用状态和忙碌状态。
 */
import type { CopyTestTableEntry } from '../types';

/** 计算 CopyTest 操作状态所需的页面快照。 */
export interface CopyTestActionStateParams {
  /** 是否正在读取 Confluence Evidence 附件。 */
  attachmentsLoading: boolean;
  /** 是否正在回写 Confluence storage。 */
  exportLoading: boolean;
  /** 当前 Comparison Column 是否包含可回写的本地变更，包括清空双列。 */
  hasExportableContent: boolean;
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex?: number;
  /** 当前勾选的来源原子组数量。 */
  selectedRowCount: number;
  /** 当前用户选中的工作表格。 */
  selectedTable?: CopyTestTableEntry;
  /** 最近一次导入或导出后的完整 storage。 */
  storageHtml: string;
  /** 是否正在读取 Confluence storage。 */
  storageLoading: boolean;
  /** 当前已上传到内存的截图数量。 */
  uploadImageCount: number;
  /** 是否正在把浏览器文件转换为内存图片。 */
  uploadPreparing: boolean;
  /** 是否正在执行 AI 校验。 */
  validationLoading: boolean;
}

/** CopyTest 页面各操作入口的最终可用状态。 */
export interface CopyTestActionState {
  /** 是否允许把当前生成双列回写到 Confluence。 */
  canExportToConfluence: boolean;
  /** 是否允许打开截图上传流程。 */
  canUpload: boolean;
  /** 是否允许使用已有截图发起 AI 校验。 */
  canValidate: boolean;
  /** 导入入口及其依赖操作是否处于忙碌状态。 */
  importBusy: boolean;
  /** 截图上传、校验或导出链是否处于忙碌状态。 */
  uploadBusy: boolean;
}

/** 判断用户是否已经选择 Comparison Column。 */
const hasSelectedComparisonColumn = (selectedColumnIndex?: number): boolean => {
  return selectedColumnIndex !== undefined;
};

/** 汇总会阻止截图上传和校验入口的忙碌状态。 */
const isCopyTestUploadBusy = (
  validationLoading: boolean,
  uploadPreparing: boolean,
  exportLoading: boolean
): boolean => {
  return validationLoading || uploadPreparing || exportLoading;
};

/** 汇总会阻止重新导入 Confluence 页面的忙碌状态。 */
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

/** 判断当前表格和 Comparison Column 是否可用于后续操作。 */
const canUseSelectedTable = (
  selectedTable: CopyTestTableEntry | undefined,
  selectedColumnIndex: number | undefined,
  busy: boolean
): boolean => {
  return Boolean(selectedTable)
    && hasSelectedComparisonColumn(selectedColumnIndex)
    && !busy;
};

/** 判断当前选择是否允许进入截图上传流程。 */
const canUploadScreenshots = (
  selectedTable: CopyTestTableEntry | undefined,
  selectedColumnIndex: number | undefined,
  selectedRowCount: number,
  busy: boolean
): boolean => {
  return canUseSelectedTable(selectedTable, selectedColumnIndex, busy) && selectedRowCount > 0;
};

/** 判断当前生成结果是否满足 Confluence 回写条件。 */
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

/** 根据当前页面快照一次性计算全部操作入口状态。 */
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

  /** 会阻止上传、校验和导出的组合忙碌状态。 */
  const uploadBusy = isCopyTestUploadBusy(validationLoading, uploadPreparing, exportLoading);

  /** 会阻止重新导入页面的组合忙碌状态。 */
  const importBusy = isCopyTestImportBusy(
    storageLoading,
    attachmentsLoading,
    validationLoading,
    exportLoading,
    uploadPreparing
  );

  /** 上传和校验入口共同依赖的选择可用状态。 */
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
