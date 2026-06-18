/**
 * 文件作用：封装 CopyTest 主流程的状态、请求和事件处理。
 */
import { useState } from 'react';
import { Modal, message } from 'antd';
import { useRequest } from 'ahooks';
import {
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  copyTestValidationApi,
} from '../api/copyTestApi';
import { buildCopyTestActionState } from '../utils/copyTestActionState';
import { bindResultImages } from '../table/copyTestTableEditor';
import { buildConfluenceStorageTableExportPayload } from '../table/copyTestTableImages';
import { getCopyTestImageId } from '../table/copyTestImageUtils';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestEvidencePreviewInfo,
} from '../types';
import { isValidConfluenceUrl } from '../utils/urlUtils';
import {
  buildStorageWithAttachmentPreviews,
  getCopyTestValidationContext,
  getRequiredExportStorage,
  type CopyTestValidationContext,
} from '../utils/copyTestControllerUtils';
import { useCopyTestSession, type UseCopyTestSessionResult } from './useCopyTestSession';
import { useCopyTestUpload, type UseCopyTestUploadResult } from './useCopyTestUpload';

/** 定义 CopyTestControllerParams 的数据结构。 */
interface CopyTestControllerParams {
  onClose: () => void;
}

/** 定义 CopyTestControllerState 的数据结构。 */
interface CopyTestControllerState {
  canExportToConfluence: boolean;
  canUpload: boolean;
  canValidate: boolean;
  confluenceUrl: string;
  deleteImageTarget: CopyTestEvidenceDeleteTarget | null;
  exportLoading: boolean;
  importBusy: boolean;
  importLoading: boolean;
  previewImage: CopyTestEvidencePreviewInfo | null;
  tableState: UseCopyTestSessionResult;
  uploadBusy: boolean;
  uploadModalOpen: boolean;
  uploadState: UseCopyTestUploadResult;
  validationLoading: boolean;
}

/** 定义 CopyTestControllerHandlers 的数据结构。 */
interface CopyTestControllerHandlers {
  handleCancelEvidenceImageDelete: () => void;
  handleChooseImages: () => void;
  handleClosePreviewImage: () => void;
  handleCloseUploadModal: () => void;
  handleComparisonColumnChange: (value?: number) => void;
  handleConfirmEvidenceImageDelete: () => void;
  handleConfluenceUrlChange: (value: string) => void;
  handleEvidenceImageDelete: (target: CopyTestEvidenceDeleteTarget) => void;
  handleEvidenceImagePreview: (previewInfo: CopyTestEvidencePreviewInfo) => void;
  handleExportToConfluence: () => void;
  handleFilesSelected: (files: File[]) => Promise<void>;
  handleLoadTables: () => Promise<void>;
  handleMainClose: () => void;
  handleRemoveUploadImage: (md5: string) => void;
  handleTableChange: (value: number) => void;
  handleValidateClick: () => Promise<void>;
}

/** 定义 CopyTestControllerResult 的数据结构。 */
export interface CopyTestControllerResult extends CopyTestControllerState, CopyTestControllerHandlers {}

/** 定义 EXPORT_CONFIRM_TITLE 常量。 */
const EXPORT_CONFIRM_TITLE = 'Confirm export';

/** 定义 EXPORT_CONFIRM_CONTENT 常量。 */
const EXPORT_CONFIRM_CONTENT = 'This operation will update the table in your Confluence page. Are you sure you want to proceed?';

/** 定义 COPY_TEST_VALIDATION_SUCCESS_MESSAGE 常量。 */
const COPY_TEST_VALIDATION_SUCCESS_MESSAGE = 'Copy test validation completed';

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
  const response = await copyTestStorageApi(confluenceUrl);
  return response.storage;
};

/** 封装 useCopyTestController Hook 的状态和操作。 */
export const useCopyTestController = ({
  onClose,
}: CopyTestControllerParams): CopyTestControllerResult => {

  /** 定义 [confluenceUrl, setConfluenceUrl] 常量。 */
  const [confluenceUrl, setConfluenceUrl] = useState('');

  /** 定义 [deleteImageTarget, setDeleteImageTarget] 常量。 */
  const [deleteImageTarget, setDeleteImageTarget] = useState<CopyTestEvidenceDeleteTarget | null>(null);

  /** 定义 [uploadModalOpen, setUploadModalOpen] 常量。 */
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  /** 定义 [validationLoading, setValidationLoading] 常量。 */
  const [validationLoading, setValidationLoading] = useState(false);

  /** 定义 [previewImage, setPreviewImage] 常量。 */
  const [previewImage, setPreviewImage] = useState<CopyTestEvidencePreviewInfo | null>(null);

  /** 定义 tableState 常量。 */
  const tableState = useCopyTestSession();

  /** 定义 uploadState 常量。 */
  const uploadState = useCopyTestUpload();

  /** 定义 storageRequest 常量。 */
  const storageRequest = useRequest(copyTestStorageApi, {
    manual: true,
  });

  /** 定义 exportRequest 常量。 */
  const exportRequest = useRequest(copyTestUploadApi, {
    manual: true,
  });

  /** 定义 attachmentsRequest 常量。 */
  const attachmentsRequest = useRequest(copyTestAttachmentsApi, {
    manual: true,
  });

  /** 定义 importLoading 常量。 */
  const importLoading = storageRequest.loading || attachmentsRequest.loading;

  /** 定义操作按钮状态常量。 */
  const {
    canExportToConfluence,
    canUpload,
    canValidate,
    importBusy,
    uploadBusy,
  } = buildCopyTestActionState({
    attachmentsLoading: attachmentsRequest.loading,
    exportLoading: exportRequest.loading,
    hasExportableContent: tableState.selectedColumnHasExportableContent,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedRowCount: tableState.selectedRowIndexes.length,
    selectedTable: tableState.selectedTable,
    storageHtml: tableState.originalStorageHtml,
    storageLoading: storageRequest.loading,
    uploadImageCount: uploadState.uploadImages.length,
    uploadPreparing: uploadState.preparingUpload,
    validationLoading,
  });

  /** 处理 handleClosePreviewImage 方法逻辑。 */

  const handleClosePreviewImage = (): void => {
    setPreviewImage(null);
  };

  /** 处理 handleConfluenceUrlChange 方法逻辑。 */

  const handleConfluenceUrlChange = (value: string): void => {
    setConfluenceUrl(value);
  };

  /** 处理 resetImportSideEffects 方法逻辑。 */

  const resetImportSideEffects = (): void => {
    uploadState.resetUploadState();
    handleClosePreviewImage();
    tableState.resetValidationSnapshots();
  };

  /** 处理 handleLoadTables 方法逻辑。 */

  const handleLoadTables = async (): Promise<void> => {

    /** 定义 trimmedUrl 常量。 */
    const trimmedUrl = confluenceUrl.trim();
    if (!isValidConfluenceUrl(trimmedUrl)) {
      message.error('Please enter a valid Confluence URL');
      return;
    }

    try {

      /** 定义 response 常量。 */
      const response = await storageRequest.runAsync(trimmedUrl);

      /** 定义 storageHtml 常量。 */
      const storageHtml = await buildStorageWithAttachmentPreviews({
        confluenceUrl: trimmedUrl,
        loadAttachments: attachmentsRequest.runAsync,
        storageHtml: response.storage,
      });

      /** 定义 tableCount 常量。 */
      const tableCount = tableState.applyLoadedStorage(storageHtml);
      resetImportSideEffects();
      message.success(`Loaded ${tableCount} table${tableCount === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Failed to load Confluence tables:', error);
      tableState.resetLoadedData();
      resetImportSideEffects();
      message.error('Failed to load Confluence tables');
    }
  };

  /** 处理 handleTableChange 方法逻辑。 */

  const handleTableChange = (value: number): void => {
    tableState.handleTableChange(value);
    uploadState.resetUploadState();
    handleClosePreviewImage();
    tableState.resetValidationSnapshots();
  };

  /** 处理 handleComparisonColumnChange 方法逻辑。 */

  const handleComparisonColumnChange = (value?: number): void => {
    tableState.handleComparisonColumnChange(value);
    handleClosePreviewImage();
  };

  /** 处理 handleFilesSelected 方法逻辑。 */

  const handleFilesSelected = async (files: File[]): Promise<void> => {
    await uploadState.prepareUploadImages(files, uploadBusy);
  };

  /** 处理 handleRemoveUploadImage 方法逻辑。 */

  const handleRemoveUploadImage = (md5: string): void => {

    /** 定义 image 常量。 */
    const image = uploadState.uploadImages.find(item => item.md5 === md5);
    if (!image) {
      return;
    }

    /** 定义 removedFromTable 常量。 */

    const removeResult = tableState.removeEvidenceImageReference({
      imageId: getCopyTestImageId(image),
    });
    if (!removeResult.removed || !removeResult.imageStillUsed) {
      uploadState.removeUploadImage(md5);
    }
  };

  /** 处理 handleChooseImages 方法逻辑。 */

  const handleChooseImages = (): void => {
    if (!canUpload) {
      return;
    }

    setUploadModalOpen(true);
  };

  /** 处理 exportStorageToConfluence 方法逻辑。 */

  const exportStorageToConfluence = async (): Promise<void> => {
    if (!tableState.storageHtml) {
      message.warning('No Confluence storage to export');
      return;
    }

    /** 定义 trimmedUrl 常量。 */

    const trimmedUrl = confluenceUrl.trim();
    if (!isValidConfluenceUrl(trimmedUrl)) {
      message.error('Please enter a valid Confluence URL');
      return;
    }

    try {
      await waitForNextPaint();

      /** 定义 latestStorageHtml 常量。 */
      const latestStorageHtml = await loadLatestExportStorage(trimmedUrl);

      /** 定义 storageHtml 常量。 */
      const storageHtml = getRequiredExportStorage(tableState, latestStorageHtml);
      if (!storageHtml) {
        return;
      }

      /** 定义 exportImages 常量。 */
      const exportImages = uploadState.uploadImages.length > 0
        ? uploadState.uploadImages
        : tableState.getCurrentValidationImages();

      /** 定义 payload 常量。 */
      const payload = buildConfluenceStorageTableExportPayload(storageHtml, exportImages);
      await exportRequest.runAsync({
        confluenceUrl: trimmedUrl,
        ...payload,
      });
      tableState.commitExportedStorage(payload.storageHtml);
      message.success('Export to Confluence successful');
    } catch (error) {
      console.error('Export to Confluence failed:', error);
      message.error('Export to Confluence failed');
      throw error;
    }
  };

  /** 处理 handleExportToConfluence 方法逻辑。 */

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

  /** 处理 handleCloseUploadModal 方法逻辑。 */

  const handleCloseUploadModal = (): void => {
    if (uploadBusy) {
      return;
    }

    setUploadModalOpen(false);
  };

  /** 处理 applyValidationResults 方法逻辑。 */

  const applyValidationResults = async (context: CopyTestValidationContext): Promise<void> => {

    /** 定义 results 常量。 */
    setValidationLoading(true);
    try {
      // const results = await mockCopyTestValidationApi(
      const results = await copyTestValidationApi(
        uploadState.uploadImages,
        context.rows,
        context.selectedColumnLabel,
        context.referenceHeader?.label
      );

      /** 定义 boundResults 常量。 */
      const boundResults = bindResultImages(results, uploadState.uploadImages);

      tableState.applyValidationResults(
        boundResults,
        uploadState.uploadImages,
        context.selectedColumnIndex,
        context.selectedColumnLabel,
        context.selectedTable.index
      );
    } finally {
      setValidationLoading(false);
    }
  };

  /** 处理 handleEvidenceImageDelete 方法逻辑。 */

  const handleEvidenceImageDelete = (target: CopyTestEvidenceDeleteTarget): void => {
    setDeleteImageTarget(target);
  };

  /** 处理 handleCancelEvidenceImageDelete 方法逻辑。 */

  const handleCancelEvidenceImageDelete = (): void => {
    setDeleteImageTarget(null);
  };

  /** 处理 handleConfirmEvidenceImageDelete 方法逻辑。 */

  const handleConfirmEvidenceImageDelete = (): void => {
    if (!deleteImageTarget) {
      return;
    }

    const result = tableState.deleteEvidenceImage(deleteImageTarget);
    if (!result.removed) {
      message.warning('Screenshot cannot be deleted from the current table');
    }
    if (previewImage?.imageId === deleteImageTarget.imageId && !result.imageStillUsed) {
      handleClosePreviewImage();
    }
    setDeleteImageTarget(null);
  };

  /** 处理 handleEvidenceImagePreview 方法逻辑。 */

  const handleEvidenceImagePreview = (previewInfo: CopyTestEvidencePreviewInfo): void => {
    setPreviewImage(previewInfo);
  };

  /** 处理 handleValidateClick 方法逻辑。 */

  const handleValidateClick = async (): Promise<void> => {

    /** 定义 context 常量。 */
    const context = getCopyTestValidationContext(tableState, uploadState.uploadImages);
    if (!context) {
      return;
    }

    try {
      await applyValidationResults(context);
      setUploadModalOpen(false);
      uploadState.resetUploadState();
      message.success(COPY_TEST_VALIDATION_SUCCESS_MESSAGE);
    } catch (error) {
      console.error('Copy test validation failed:', error);
      message.error('Copy test validation failed');
    }
  };

  /** 处理 handleMainClose 方法逻辑。 */

  const handleMainClose = (): void => {
    if (uploadBusy) {
      return;
    }

    uploadState.resetUploadState();
    tableState.resetValidationSnapshots();
    handleClosePreviewImage();
    setUploadModalOpen(false);
    onClose();
  };

  return {
    canExportToConfluence,
    canUpload,
    canValidate,
    confluenceUrl,
    deleteImageTarget,
    exportLoading: exportRequest.loading,
    handleCancelEvidenceImageDelete,
    handleChooseImages,
    handleClosePreviewImage,
    handleCloseUploadModal,
    handleComparisonColumnChange,
    handleConfirmEvidenceImageDelete,
    handleConfluenceUrlChange,
    handleEvidenceImageDelete,
    handleEvidenceImagePreview,
    handleExportToConfluence,
    handleFilesSelected,
    handleLoadTables,
    handleMainClose,
    handleRemoveUploadImage,
    handleTableChange,
    handleValidateClick,
    importBusy,
    importLoading,
    previewImage,
    tableState,
    uploadBusy,
    uploadModalOpen,
    uploadState,
    validationLoading,
  };
};
