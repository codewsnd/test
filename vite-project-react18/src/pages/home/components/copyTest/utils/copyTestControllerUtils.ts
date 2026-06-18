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
  applyConfluenceStorageTableImages,
  getConfluenceStorageTableImageFileNames,
} from '../table/copyTestTableImages';
import { buildCurrentColumnExportStorage } from '../table/copyTestTableExporter';
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

/** 处理 getRequiredExportStorage 辅助逻辑。 */
export const getRequiredExportStorage = (
  tableState: UseCopyTestSessionResult,
  baseStorageHtml?: string
): string | null => {
  if (!tableState.selectedTable || tableState.selectedColumnIndex === undefined || !tableState.selectedHeader) {
    message.warning('Please select a table and column first');
    return null;
  }

  return buildCurrentColumnExportStorage({
    originalStorageHtml: baseStorageHtml || tableState.originalStorageHtml,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedColumnLabel: tableState.selectedHeader.label,
    table: tableState.selectedTable,
  });
};

/** 处理 buildStorageWithAttachmentPreviews 辅助逻辑。 */
export const buildStorageWithAttachmentPreviews = async ({
  confluenceUrl,
  loadAttachments,
  storageHtml,
}: AttachmentPreviewParams): Promise<string> => {
  try {

    /** 定义 fileNames 常量。 */
    const fileNames = getConfluenceStorageTableImageFileNames(storageHtml);
    if (fileNames.length === 0) {
      return storageHtml;
    }

    /** 定义 response 常量。 */

    const response = await loadAttachments({
      confluenceUrl,
      fileNames,
    });
    return applyConfluenceStorageTableImages(storageHtml, response.images);
  } catch (error) {
    console.error('Failed to load Confluence attachment previews:', error);
    message.warning('Failed to load existing evidence image previews');
    return storageHtml;
  }
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
