/**
 * 文件作用：提供导入预览、导出 storage 和 Validate 前置校验工具。
 */
import { message } from 'antd';
import type {
  CopyTestAttachmentsRequest,
  CopyTestAttachmentsResponse,
  CopyTestRowInput,
} from '../api/copyTestApi';
import {
  buildConfluenceStorageTableImagePreviewBundle,
  getConfluenceStorageTableImageFileNames,
  type CopyTestStorageImagePreviewBundle,
} from '../table/copyTestTableImages';
import { buildCurrentColumnExportStorage } from '../table/copyTestTableExporter';
import { createCopyTestExportScope } from '../table/copyTestExportScope';
import type { CopyTestHeader, CopyTestMemoryImage, CopyTestTableEntry } from '../types';
import type { UseCopyTestSessionResult } from '../hooks/useCopyTestSession';
import { getImageLimitError } from './uploadUtils';

/** 定义 CopyTestValidationContext 的数据结构。 */
export interface CopyTestValidationContext {
  referenceHeader?: CopyTestHeader;
  rows: CopyTestRowInput[];
  selectedColumnIndex: number;
  selectedColumnLabel: string;
  selectedTable: CopyTestTableEntry;
}

/** 定义 AttachmentPreviewParams 的数据结构。 */
interface AttachmentPreviewParams {
  confluenceUrl: string;
  loadAttachments: (data: CopyTestAttachmentsRequest) => Promise<CopyTestAttachmentsResponse>;
  storageHtml: string;
}

/** 导入时分离的 storage 和内存预览图片。 */
export type CopyTestAttachmentPreviewBundle = CopyTestStorageImagePreviewBundle;

/** 构建 strict managed Evidence 所需的附件请求，无引用时不发请求。 */
export const getAttachmentPreviewRequest = (
  confluenceUrl: string,
  storageHtml: string
): CopyTestAttachmentsRequest | null => {
  const fileNames = getConfluenceStorageTableImageFileNames(storageHtml);
  return fileNames.length > 0 ? { confluenceUrl, fileNames } : null;
};

/** 构建不含预览图片的稳定 bundle。 */
export const getEmptyAttachmentPreviewBundle = (
  storageHtml: string
): CopyTestAttachmentPreviewBundle => ({ images: [], storageHtml });

/** 统一附件预览失败的降级结果。 */
export const getFailedAttachmentPreviewBundle = (
  storageHtml: string,
  error: unknown
): CopyTestAttachmentPreviewBundle => {
  console.error('Failed to load Confluence attachment previews:', error);
  message.warning('Failed to load existing evidence image previews');
  return getEmptyAttachmentPreviewBundle(storageHtml);
};

/** 处理 getRequiredExportStorage 辅助逻辑。 */
export const getRequiredExportStorage = (
  tableState: UseCopyTestSessionResult,
  exportScope = createCopyTestExportScope(),
  baseStorageHtml?: string
): string | null => {
  if (!tableState.selectedTable || tableState.selectedColumnIndex === undefined || !tableState.selectedHeader) {
    message.warning('Please select a table and column first');
    return null;
  }

  return buildCurrentColumnExportStorage({
    exportScope,
    originalStorageHtml: baseStorageHtml || tableState.originalStorageHtml,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedColumnLabel: tableState.selectedHeader.label,
    table: tableState.selectedTable,
  });
};

/** 构建 storage 和独立内存图片 bundle，避免把 base64 写入整页 HTML。 */
export const buildStorageAttachmentPreviewBundle = ({
  confluenceUrl,
  loadAttachments,
  storageHtml,
}: AttachmentPreviewParams): Promise<CopyTestAttachmentPreviewBundle> => {
  const request = getAttachmentPreviewRequest(confluenceUrl, storageHtml);
  if (!request) {
    return Promise.resolve(getEmptyAttachmentPreviewBundle(storageHtml));
  }
  return Promise.resolve().then(() => loadAttachments(request)).then(response => buildConfluenceStorageTableImagePreviewBundle(storageHtml, response.images)).catch(error => getFailedAttachmentPreviewBundle(storageHtml, error));
};

/** 处理 getCopyTestValidationContext 辅助逻辑。 */
export const getCopyTestValidationContext = (
  tableState: UseCopyTestSessionResult,
  uploadImages: CopyTestMemoryImage[]
): CopyTestValidationContext | null => {
  if (uploadImages.length === 0) {
    message.warning('Please choose screenshots first');
    return null;
  }

  if (!tableState.selectedTable || tableState.selectedColumnIndex === undefined || !tableState.selectedHeader) {
    message.warning('Please select a table and column first');
    return null;
  }

  /** 定义 uploadError 常量。 */

  const uploadError = getImageLimitError(uploadImages);
  if (uploadError) {
    message.warning(uploadError);
    return null;
  }

  /** 定义 rows 常量。 */

  const rows = tableState.buildSelectedRowsForValidation();
  if (rows.length === 0) {
    message.warning('Selected column has no copy to validate');
    return null;
  }

  return {
    referenceHeader: tableState.referenceHeader,
    rows,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedColumnLabel: tableState.selectedHeader.label,
    selectedTable: tableState.selectedTable,
  };
};
