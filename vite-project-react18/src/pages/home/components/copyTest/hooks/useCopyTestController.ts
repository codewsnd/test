/**
 * 文件作用：封装 CopyTest 主流程的状态、请求和事件处理。
 */
import { useRef, useState } from 'react';
import { Modal, message } from 'antd';
import { useRequest } from 'ahooks';
import {
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  copyTestValidationApi,
  type CopyTestImage,
} from '../api/copyTestApi';
import { buildCopyTestActionState } from '../utils/copyTestActionState';
import { bindResultImages } from '../table/copyTestTableEditor';
import { parseCopyTestStorageTables } from '../table/copyTestTableParser';
import { buildConfluenceStorageTableExportPayload } from '../table/copyTestTableImages';
import { getCopyTestImageId } from '../table/copyTestImageUtils';
import { createCopyTestExportScope } from '../table/copyTestExportScope';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestEvidencePreviewInfo,
  CopyTestResultStatusUpdate,
} from '../types';
import {
  getConfluenceTableError,
  getConfluenceUrlError,
  INVALID_CONFLUENCE_URL_ERROR,
  isValidConfluenceUrl,
} from '../utils/urlUtils';
import {
  getCopyTestValidationContext,
  getRequiredExportStorage,
  type CopyTestValidationContext,
} from '../utils/copyTestControllerUtils';
import {
  useCopyTestSession,
  type CopyTestComparisonColumnSelection,
  type UseCopyTestSessionResult,
} from './useCopyTestSession';
import { useCopyTestUpload, type UseCopyTestUploadResult } from './useCopyTestUpload';

/** CopyTest 控制器初始化参数。 */
interface CopyTestControllerParams {
  /** 主弹窗关闭后的外部回调。 */
  onClose: () => void;
}

/** CopyTest 页面直接消费的控制器状态。 */
interface CopyTestControllerState {
  /** 当前生成双列是否允许导出到 Confluence。 */
  canExportToConfluence: boolean;
  /** 当前选择是否允许打开截图上传弹窗。 */
  canUpload: boolean;
  /** 当前上传图片和选择状态是否允许发起校验。 */
  canValidate: boolean;
  /** 用户输入的 Confluence 页面 URL。 */
  confluenceUrl: string;
  /** 当前 Comparison Column 的 Evidence 附件是否正在加载。 */
  comparisonColumnLoading: boolean;
  /** 等待用户确认删除的 Evidence 图片实例。 */
  deleteImageTarget: CopyTestEvidenceDeleteTarget | null;
  /** storage 导出请求是否正在执行。 */
  exportLoading: boolean;
  /** 当前输入 URL 是否对应一份已完成导入且仍有效的表格会话。 */
  hasActiveImportedSession: boolean;
  /** 导入链路是否占用主操作区。 */
  importBusy: boolean;
  /** URL 或 storage 表格校验错误。 */
  importError?: string;
  /** Confluence storage 是否正在导入。 */
  importLoading: boolean;
  /** 当前打开的大图预览信息。 */
  previewImage: CopyTestEvidencePreviewInfo | null;
  /** 表格解析、选择和写回状态。 */
  tableState: UseCopyTestSessionResult;
  /** 截图上传弹窗是否打开。 */
  uploadModalOpen: boolean;
  /** 图片准备与上传列表状态。 */
  uploadState: UseCopyTestUploadResult;
  /** AI 校验和表格写入是否正在执行。 */
  validationLoading: boolean;
}

/** CopyTest 页面可触发的控制器操作。 */
interface CopyTestControllerHandlers {
  /** 取消 Evidence 图片删除确认。 */
  handleCancelEvidenceImageDelete: () => void;
  /** 打开截图上传弹窗。 */
  handleChooseImages: () => void;
  /** 关闭 Evidence 大图预览。 */
  handleClosePreviewImage: () => void;
  /** 在非忙碌状态关闭截图上传弹窗。 */
  handleCloseUploadModal: () => void;
  /** 切换 Comparison Column。 */
  handleComparisonColumnChange: (value?: number) => Promise<void>;
  /** 确认删除一个 Evidence 图片实例。 */
  handleConfirmEvidenceImageDelete: () => void;
  /** 更新 Confluence URL 并清除旧输入错误。 */
  handleConfluenceUrlChange: (value: string) => void;
  /** 打开 Evidence 图片删除确认。 */
  handleEvidenceImageDelete: (target: CopyTestEvidenceDeleteTarget) => void;
  /** 打开 Evidence 大图预览。 */
  handleEvidenceImagePreview: (previewInfo: CopyTestEvidencePreviewInfo) => void;
  /** 将单个 Result Screen 移入明确的 Passed 或 Failed 分组。 */
  handleResultStatusChange: (update: CopyTestResultStatusUpdate) => void;
  /** 打开导出确认弹窗。 */
  handleExportToConfluence: () => void;
  /** 将用户选择的文件转换为待校验图片。 */
  handleFilesSelected: (files: File[]) => Promise<void>;
  /** 校验 URL 并导入 Confluence storage 与附件。 */
  handleLoadTables: () => Promise<void>;
  /** 关闭 CopyTest 主弹窗并清理临时上传状态。 */
  handleMainClose: () => void;
  /** 从本次上传列表移除指定图片。 */
  handleRemoveUploadImage: (md5: string) => void;
  /** 切换当前 Confluence 表格。 */
  handleTableChange: (value: number) => void;
  /** 发起 AI 校验并写入 Result/Evidence 双列。 */
  handleValidateClick: () => Promise<void>;
}

/** 在两次 latest storage 读取中复用同一 scope 的导出结果。 */
interface PreparedExportStorage {
  /** 本次导出用于定位临时节点的唯一作用域。 */
  exportScope: string;
  /** 基于最新 Confluence storage 生成的完整回写内容。 */
  storageHtml: string;
}

/** 一次可丢弃的 Comparison Column 附件请求上下文。 */
interface ComparisonAttachmentRequestContext {
  /** 当前列选择生成的单调递增请求编号。 */
  requestId: number;
  /** 请求所属的导入会话编号。 */
  sessionId: number;
  /** 请求对应的严格 managed Evidence Pair。 */
  selection: CopyTestComparisonColumnSelection;
}

/** 页面状态和操作组成的 CopyTest 控制器结果。 */
export interface CopyTestControllerResult extends CopyTestControllerState, CopyTestControllerHandlers {}

/** 导出确认弹窗标题。 */
const EXPORT_CONFIRM_TITLE = 'Confirm export';

/** 导出确认弹窗风险提示。 */
const EXPORT_CONFIRM_CONTENT = 'This operation will update the table in your Confluence page. Are you sure you want to proceed?';

/** AI 校验和本地表格写入成功后的提示。 */
const COPY_TEST_VALIDATION_SUCCESS_MESSAGE = 'Copy test validation completed';

/** Confluence storage 或附件导入失败时显示在输入框下方的文案。 */
const CONFLUENCE_IMPORT_ERROR = 'Failed to load Confluence tables. Please check whether your Confluence URL or Confluence token is correct.';

/** 当前 Comparison Column 的 Evidence 附件读取失败提示。 */
const CONFLUENCE_ATTACHMENT_ERROR = 'Failed to load Test Evidence attachments.';

/** 等待浏览器先完成一次界面绘制。 */
const waitForNextPaint = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
};

/** 读取最新 Confluence storage 作为导出基线。 */
const loadLatestExportStorage = async (confluenceUrl: string): Promise<string> => {
  /** 最新 Confluence storage 接口响应。 */
  const response = await copyTestStorageApi(confluenceUrl);
  return response.storage;
};

/** 判断两次读取的 Confluence Storage 是否发生变化。 */
export const hasConfluenceStorageChanged = (firstBase: string, confirmedBase: string): boolean => {
  return firstBase !== confirmedBase;
};

/** 合并已校验快照和当前上传图片；后者在 stable id 或文件名重复时覆盖旧值。 */
export const mergeCopyTestExportImages = (
  snapshotImages: CopyTestImage[],
  uploadImages: CopyTestImage[]
): CopyTestImage[] => {
  /** 保持首次出现顺序的图片合并结果。 */
  const mergedImages: CopyTestImage[] = [];
  [...snapshotImages, ...uploadImages].forEach(image => {
    /** 当前图片以附件文件名表示的稳定标识。 */
    const imageId = getCopyTestImageId(image);
    /** 与当前附件文件名标识冲突的已有位置。 */
    const existingIndex = mergedImages.findIndex(existing => {
      return getCopyTestImageId(existing) === imageId;
    });
    if (existingIndex >= 0) {
      mergedImages[existingIndex] = image;
    } else {
      mergedImages.push(image);
    }
  });
  return mergedImages;
};

/** 在 POST 前再次读取最新 Storage；发生变化时只重放一次当前 Pair patch。 */
const prepareLatestExportStorage = async (
  confluenceUrl: string,
  tableState: UseCopyTestSessionResult
): Promise<PreparedExportStorage | null> => {
  /** 本次双读和 rebase 全程复用的导出作用域。 */
  const exportScope = createCopyTestExportScope();
  /** 第一次读取的最新 storage 候选基线。 */
  const firstBase = await loadLatestExportStorage(confluenceUrl);
  /** 在第一次候选基线上生成的当前 Pair patch。 */
  const firstPatch = getRequiredExportStorage(tableState, exportScope, firstBase);
  if (!firstPatch) {
    return null;
  }

  /** POST 前确认 Confluence 未被再次修改的第二份 storage。 */
  const confirmedBase = await loadLatestExportStorage(confluenceUrl);
  if (!hasConfluenceStorageChanged(firstBase, confirmedBase)) {
    return { exportScope, storageHtml: firstPatch };
  }
  /** storage 已变化时在第二份基线上重放的当前 Pair patch。 */
  const rebasedPatch = getRequiredExportStorage(tableState, exportScope, confirmedBase);
  return rebasedPatch ? { exportScope, storageHtml: rebasedPatch } : null;
};

/** 封装 useCopyTestController Hook 的状态和操作。 */
export const useCopyTestController = ({
  onClose,
}: CopyTestControllerParams): CopyTestControllerResult => {

  /** URL 输入框值及其更新函数。 */
  const [confluenceUrl, setConfluenceUrl] = useState('');

  /** 当前表格实际加载自哪个 URL。 */
  const [loadedConfluenceUrl, setLoadedConfluenceUrl] = useState('');

  /** URL 输入框下方的导入错误。 */
  const [importError, setImportError] = useState<string>();

  /** 等待确认删除的 Evidence 图片实例及其更新函数。 */
  const [deleteImageTarget, setDeleteImageTarget] = useState<CopyTestEvidenceDeleteTarget | null>(null);

  /** 截图上传弹窗开关及其更新函数。 */
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  /** AI 校验执行状态及其更新函数。 */
  const [validationLoading, setValidationLoading] = useState(false);

  /** Confluence 双读准备阶段是否已进入导出临界区。 */
  const [exportPreparing, setExportPreparing] = useState(false);

  /** 当前 Comparison Column 的已有 Evidence 附件读取状态。 */
  const [comparisonColumnLoading, setComparisonColumnLoading] = useState(false);

  /** 当前 Evidence 大图预览及其更新函数。 */
  const [previewImage, setPreviewImage] = useState<CopyTestEvidencePreviewInfo | null>(null);

  /** 当前 CopyTest 表格会话状态。 */
  const tableState = useCopyTestSession();

  /** 供静态确认弹窗在真正确认时读取最新表格会话。 */
  const tableStateRef = useRef(tableState);
  tableStateRef.current = tableState;

  /** 只允许最后一次导入请求提交状态。 */
  const importRequestIdRef = useRef(0);

  /** 只允许当前会话最后一次 Comparison Column 附件请求提交状态。 */
  const comparisonAttachmentRequestIdRef = useRef(0);

  /** 标识当前表格会话；URL 变化或重新导入时单调递增。 */
  const sessionIdRef = useRef(0);

  /** 只允许当前会话中最后一次 AI 校验请求提交状态。 */
  const validationRequestIdRef = useRef(0);

  /** 同步标记当前是否存在可操作的已导入会话。 */
  const sessionReadyRef = useRef(false);

  /** 从双读准备到提交完成全程同步阻止 Result 状态并发写入。 */
  const exportInProgressRef = useRef(false);

  /** 当前截图上传列表状态。 */
  const uploadState = useCopyTestUpload();

  /** 手动触发的 Confluence storage 请求状态。 */
  const storageRequest = useRequest(copyTestStorageApi, {
    manual: true,
  });

  /** 手动触发的 storage 与附件导出请求状态。 */
  const exportRequest = useRequest(copyTestUploadApi, {
    manual: true,
  });

  /** 覆盖 storage 双读准备和最终上传的完整导出状态。 */
  const exportLoading = exportPreparing || exportRequest.loading;

  /** 手动触发的已有附件预览请求状态。 */
  const attachmentsRequest = useRequest(copyTestAttachmentsApi, {
    manual: true,
  });

  /** URL 导入阶段只反映 Confluence storage 请求状态。 */
  const importLoading = storageRequest.loading;

  /** 当前输入、成功导入 URL 与表格状态共同确认的有效会话。 */
  const hasActiveImportedSession = sessionReadyRef.current
    && loadedConfluenceUrl !== ''
    && confluenceUrl.trim() === loadedConfluenceUrl
    && tableState.tables.length > 0
    && !storageRequest.loading;

  /** 根据请求、选择和上传状态计算全部操作按钮权限。 */
  const {
    canExportToConfluence,
    canUpload,
    canValidate,
    importBusy,
    uploadBusy,
  } = buildCopyTestActionState({
    attachmentsLoading: comparisonColumnLoading,
    exportLoading,
    hasExportableContent: tableState.selectedColumnHasExportableContent,
    hasActiveImportedSession,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedRowCount: tableState.selectedRowIndexes.length,
    selectedTable: tableState.selectedTable,
    storageHtml: tableState.originalStorageHtml,
    storageLoading: storageRequest.loading,
    uploadImageCount: uploadState.uploadImages.length,
    uploadPreparing: uploadState.preparingUpload,
    validationLoading,
  });

  /** 关闭当前 Evidence 大图预览。 */
  const handleClosePreviewImage = (): void => {
    setPreviewImage(null);
  };

  /** 清空只属于当前已导入页面的表格和临时交互状态。 */
  const resetImportedSessionState = (): void => {
    sessionReadyRef.current = false;
    setLoadedConfluenceUrl('');
    setComparisonColumnLoading(false);
    setValidationLoading(false);
    setUploadModalOpen(false);
    setDeleteImageTarget(null);
    uploadState.resetUploadState();
    handleClosePreviewImage();
    tableState.resetSession();
  };

  /** 使当前会话及其尚未返回的 AI 校验请求立即失效。 */
  const invalidateCurrentSession = (): void => {
    sessionIdRef.current += 1;
    comparisonAttachmentRequestIdRef.current += 1;
    validationRequestIdRef.current += 1;
    resetImportedSessionState();
  };

  /** 更新 URL 输入，同时使旧导入请求和旧表格会话失效。 */
  const handleConfluenceUrlChange = (value: string): void => {
    importRequestIdRef.current += 1;
    invalidateCurrentSession();
    setConfluenceUrl(value);
    setImportError(undefined);
  };

  /** 校验 URL 并只导入最新 storage；Evidence 附件延迟到选择列时读取。 */
  const handleLoadTables = async (): Promise<void> => {
    if (importBusy) {
      return;
    }

    /** 去除输入两端空白后的 Confluence URL。 */
    const trimmedUrl = confluenceUrl.trim();
    /** URL 格式不合法时展示在输入框下方的错误。 */
    const urlError = getConfluenceUrlError(trimmedUrl);
    if (urlError) {
      importRequestIdRef.current += 1;
      invalidateCurrentSession();
      setImportError(urlError);
      return;
    }

    /** 用于丢弃过期异步响应的单调递增请求编号。 */
    const requestId = importRequestIdRef.current + 1;
    importRequestIdRef.current = requestId;
    invalidateCurrentSession();

    try {
      setImportError(undefined);

      /** 后端返回的最新 Confluence storage。 */
      const response = await storageRequest.runAsync(trimmedUrl);
      if (requestId !== importRequestIdRef.current) {
        return;
      }

      /** storage 中没有有效表格时展示的输入错误。 */
      const storageError = getConfluenceTableError(parseCopyTestStorageTables(response.storage).length);
      if (storageError) {
        setImportError(storageError);
        return;
      }

      /** 应用 storage 后实际保留的有效表格数量。 */
      const tableCount = tableState.applyLoadedStorage(response.storage);
      /** storage 应用后再次确认有效表格数量的错误。 */
      const appliedStorageError = getConfluenceTableError(tableCount);
      if (appliedStorageError) {
        setImportError(appliedStorageError);
        return;
      }
      sessionReadyRef.current = true;
      setLoadedConfluenceUrl(trimmedUrl);
    } catch (error) {
      if (requestId !== importRequestIdRef.current) {
        return;
      }
      console.error('Failed to load Confluence tables:', error);
      setImportError(CONFLUENCE_IMPORT_ERROR);
    }
  };

  /** 切换表格并清理上一张表的临时上传与预览。 */
  const handleTableChange = (value: number): void => {
    if (!sessionReadyRef.current) {
      return;
    }

    comparisonAttachmentRequestIdRef.current += 1;
    setComparisonColumnLoading(false);
    tableState.handleTableChange(value);
    uploadState.resetUploadState();
    handleClosePreviewImage();
  };

  /** 判断一次附件响应是否仍属于当前导入会话和最后一次列选择。 */
  const isCurrentComparisonAttachmentRequest = (
    context: ComparisonAttachmentRequestContext
  ): boolean => {
    return sessionReadyRef.current
      && context.requestId === comparisonAttachmentRequestIdRef.current
      && context.sessionId === sessionIdRef.current;
  };

  /** 请求当前严格 managed Evidence Pair 的附件并合并到会话预览。 */
  const loadComparisonColumnAttachments = async (
    context: ComparisonAttachmentRequestContext
  ): Promise<void> => {
    try {
      const response = await attachmentsRequest.runAsync({
        confluenceUrl: loadedConfluenceUrl,
        fileNames: context.selection.fileNames,
      });
      if (!isCurrentComparisonAttachmentRequest(context)) {
        return;
      }
      tableStateRef.current.applyComparisonColumnPreviewImages(
        context.selection,
        response.images
      );
    } catch (error) {
      if (!isCurrentComparisonAttachmentRequest(context)) {
        return;
      }
      console.error('Failed to load Test Evidence attachments:', error);
      message.error(CONFLUENCE_ATTACHMENT_ERROR);
    } finally {
      if (isCurrentComparisonAttachmentRequest(context)) {
        setComparisonColumnLoading(false);
      }
    }
  };

  /** 切换 Comparison Column，并按当前严格 Pair 延迟读取 Evidence 附件。 */
  const handleComparisonColumnChange = async (value?: number): Promise<void> => {
    if (!sessionReadyRef.current) {
      return;
    }

    /** 当前选择用于使更早的列附件请求立即失效。 */
    const requestId = comparisonAttachmentRequestIdRef.current + 1;
    comparisonAttachmentRequestIdRef.current = requestId;
    /** 同步完成列切换并取得当前严格 managed Evidence Pair。 */
    const selection = tableState.handleComparisonColumnChange(value);
    handleClosePreviewImage();
    if (!selection || selection.fileNames.length === 0) {
      setComparisonColumnLoading(false);
      return;
    }

    setComparisonColumnLoading(true);
    await loadComparisonColumnAttachments({
      requestId,
      selection,
      sessionId: sessionIdRef.current,
    });
  };

  /** 将文件选择结果交给上传状态准备。 */
  const handleFilesSelected = async (files: File[]): Promise<void> => {
    if (!sessionReadyRef.current || comparisonColumnLoading) {
      return;
    }

    await uploadState.prepareUploadImages(files, uploadBusy);
  };

  /** 从尚未写入表格的上传列表删除图片。 */
  const handleRemoveUploadImage = (md5: string): void => {
    if (uploadBusy) {
      return;
    }

    uploadState.removeUploadImage(md5);
  };

  /** 在当前选择允许上传时打开截图弹窗。 */
  const handleChooseImages = (): void => {
    if (!sessionReadyRef.current || !canUpload) {
      return;
    }

    setUploadModalOpen(true);
  };

  /** 基于双读最新 storage 导出当前 owned Pair。 */
  const exportStorageToConfluence = async (): Promise<void> => {
    if (exportInProgressRef.current) {
      return;
    }
    /** 用户点击 Confirm 时的最新表格会话，避免使用打开弹窗时的旧闭包。 */
    const exportTableState = tableStateRef.current;
    if (!exportTableState.originalStorageHtml) {
      message.warning('No Confluence storage to export');
      return;
    }

    /** 最近一次成功导入且即将用于导出的 URL。 */
    const trimmedUrl = loadedConfluenceUrl.trim();
    if (!isValidConfluenceUrl(trimmedUrl)) {
      setImportError(INVALID_CONFLUENCE_URL_ERROR);
      return;
    }

    exportInProgressRef.current = true;
    setExportPreparing(true);
    try {
      await waitForNextPaint();

      /** 在最新 storage 上生成或 rebase 后的导出内容。 */
      const preparedStorage = await prepareLatestExportStorage(trimmedUrl, exportTableState);
      if (!preparedStorage) {
        message.warning('Confluence table changed. Please import the page again.');
        return;
      }

      /** 当前 Pair 校验快照与临时上传列表的去重合集。 */
      const exportImages = mergeCopyTestExportImages(
        exportTableState.getCurrentValidationImages(),
        uploadState.uploadImages
      );

      /** 当前 Comparison Column 的严格 ownership 键。 */
      const sourceColumnKey = exportTableState.selectedColumnContext?.sourceColumnKey;
      if (!sourceColumnKey) {
        message.warning('Please select a table and column first');
        return;
      }
      /** 仅包含实际 Evidence 附件的最终 storage 上传数据。 */
      const payload = buildConfluenceStorageTableExportPayload(
        preparedStorage.storageHtml,
        sourceColumnKey,
        preparedStorage.exportScope,
        exportImages
      );
      await exportRequest.runAsync({
        confluenceUrl: trimmedUrl,
        ...payload,
      });
      exportTableState.commitExportedStorage(payload.storageHtml);
      message.success('Export to Confluence successful');
    } catch (error) {
      console.error('Export to Confluence failed:', error);
      message.error('Export to Confluence failed');
      throw error;
    } finally {
      exportInProgressRef.current = false;
      setExportPreparing(false);
    }
  };

  /** 打开导出确认弹窗。 */
  const handleExportToConfluence = (): void => {
    if (!canExportToConfluence) {
      return;
    }

    Modal.confirm({
      title: EXPORT_CONFIRM_TITLE,
      icon: null,
      content: EXPORT_CONFIRM_CONTENT,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: exportStorageToConfluence,
    });
  };

  /** 非忙碌状态下关闭截图上传弹窗。 */
  const handleCloseUploadModal = (): void => {
    if (uploadBusy) {
      return;
    }

    setUploadModalOpen(false);
  };

  /** 判断 AI 校验响应是否仍属于当前已导入页面和最后一次请求。 */
  const isCurrentValidationRequest = (requestId: number, sessionId: number): boolean => {
    return sessionReadyRef.current
      && requestId === validationRequestIdRef.current
      && sessionId === sessionIdRef.current;
  };

  /** 调用严格校验接口，并仅在请求仍有效时把结果写入目标表格。 */
  const applyValidationResults = async (
    context: CopyTestValidationContext,
    images: CopyTestImage[],
    requestId: number,
    sessionId: number
  ): Promise<boolean> => {
    /** mock 或真实 aiChat 返回的严格校验结果。 */
    const results = await copyTestValidationApi(
      images,
      context.rows,
      context.selectedColumnLabel
    );
    if (!isCurrentValidationRequest(requestId, sessionId)) {
      return false;
    }

    /** 按返回的附件文件名绑定本次上传内存图片后的结果。 */
    const boundResults = bindResultImages(results, images);
    tableState.applyValidationResults(
      boundResults,
      images,
      context.selectedColumnIndex,
      context.selectedColumnLabel,
      context.selectedTable.index
    );
    return true;
  };

  /** 记录等待用户确认删除的 Evidence 图片实例。 */
  const handleEvidenceImageDelete = (target: CopyTestEvidenceDeleteTarget): void => {
    if (!sessionReadyRef.current || comparisonColumnLoading) {
      return;
    }

    setDeleteImageTarget(target);
  };

  /** 取消 Evidence 图片删除确认。 */
  const handleCancelEvidenceImageDelete = (): void => {
    setDeleteImageTarget(null);
  };

  /** 删除确认目标并同步关闭已无引用的预览。 */
  const handleConfirmEvidenceImageDelete = (): void => {
    if (!sessionReadyRef.current || comparisonColumnLoading || !deleteImageTarget) {
      return;
    }

    /** 当前 source Pair 内精确图片实例的删除结果。 */
    const result = tableState.deleteEvidenceImage(deleteImageTarget);
    if (!result.removed) {
      message.warning('Screenshot cannot be deleted from the current table');
    }
    if (previewImage?.imageId === deleteImageTarget.imageId && !result.imageStillUsed) {
      handleClosePreviewImage();
    }
    setDeleteImageTarget(null);
  };

  /** 打开指定 Evidence 图片的大图预览。 */
  const handleEvidenceImagePreview = (previewInfo: CopyTestEvidencePreviewInfo): void => {
    if (!sessionReadyRef.current || comparisonColumnLoading) {
      return;
    }

    setPreviewImage(previewInfo);
  };

  /** 在当前有效会话内人工移动一个 Result Screen 状态。 */
  const handleResultStatusChange = (update: CopyTestResultStatusUpdate): void => {
    if (
      !sessionReadyRef.current
      || comparisonColumnLoading
      || validationLoading
      || exportInProgressRef.current
    ) {
      return;
    }

    tableState.setResultStatus(update);
  };

  /** 校验上传与选择上下文并执行一次 AI 校验。 */
  const handleValidateClick = async (): Promise<void> => {
    if (!sessionReadyRef.current || comparisonColumnLoading) {
      return;
    }

    /** 通过图片限制和表格选择校验后的请求上下文。 */
    const context = getCopyTestValidationContext(tableState, uploadState.uploadImages);
    if (!context) {
      return;
    }

    /** 锁定本次校验使用的上传图片，避免异步期间被新状态替换。 */
    const requestImages = [...uploadState.uploadImages];
    /** 当前会话内单调递增的 AI 校验请求编号。 */
    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;
    /** 校验发起时所属的导入会话编号。 */
    const sessionId = sessionIdRef.current;
    setValidationLoading(true);
    try {
      const applied = await applyValidationResults(
        context,
        requestImages,
        requestId,
        sessionId
      );
      if (!applied) {
        return;
      }
      setUploadModalOpen(false);
      uploadState.resetUploadState();
      message.success(COPY_TEST_VALIDATION_SUCCESS_MESSAGE);
    } catch (error) {
      if (!isCurrentValidationRequest(requestId, sessionId)) {
        return;
      }
      console.error('Copy test validation failed:', error);
      message.error('Copy test validation failed');
    } finally {
      if (isCurrentValidationRequest(requestId, sessionId)) {
        setValidationLoading(false);
      }
    }
  };

  /** 在非忙碌状态关闭主弹窗并清理临时 UI 状态。 */
  const handleMainClose = (): void => {
    if (uploadBusy) {
      return;
    }

    uploadState.resetUploadState();
    handleClosePreviewImage();
    setUploadModalOpen(false);
    onClose();
  };

  return {
    canExportToConfluence: hasActiveImportedSession
      && !comparisonColumnLoading
      && canExportToConfluence,
    canUpload: hasActiveImportedSession && canUpload,
    canValidate: hasActiveImportedSession && canValidate,
    comparisonColumnLoading,
    confluenceUrl,
    deleteImageTarget,
    exportLoading,
    hasActiveImportedSession,
    handleCancelEvidenceImageDelete,
    handleChooseImages,
    handleClosePreviewImage,
    handleCloseUploadModal,
    handleComparisonColumnChange,
    handleConfirmEvidenceImageDelete,
    handleConfluenceUrlChange,
    handleEvidenceImageDelete,
    handleEvidenceImagePreview,
    handleResultStatusChange,
    handleExportToConfluence,
    handleFilesSelected,
    handleLoadTables,
    handleMainClose,
    handleRemoveUploadImage,
    handleTableChange,
    handleValidateClick,
    importBusy,
    importError,
    importLoading,
    previewImage,
    tableState,
    uploadModalOpen,
    uploadState,
    validationLoading,
  };
};
