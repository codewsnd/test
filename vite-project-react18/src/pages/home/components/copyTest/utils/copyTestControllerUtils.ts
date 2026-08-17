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
import type { CopyTestMemoryImage, CopyTestTableEntry } from '../types';
import type { UseCopyTestSessionResult } from '../hooks/useCopyTestSession';
import { getImageLimitError } from './uploadUtils';

/** 发起一次 CopyTest 校验所需的稳定上下文。 */
export interface CopyTestValidationContext {
  /** 按来源原子组构造的校验输入行。 */
  rows: CopyTestRowInput[];
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex: number;
  /** 当前 Comparison Column 的原始表头文本。 */
  selectedColumnLabel: string;
  /** 校验结果要写回的工作表格。 */
  selectedTable: CopyTestTableEntry;
}

/** 构建 storage 附件预览所需的参数。 */
interface AttachmentPreviewParams {
  /** 当前 Confluence 页面 URL。 */
  confluenceUrl: string;
  /** 按附件名读取图片内容的请求函数。 */
  loadAttachments: (data: CopyTestAttachmentsRequest) => Promise<CopyTestAttachmentsResponse>;
  /** 不允许被预览处理改写的原始 storage。 */
  storageHtml: string;
}

/** 构建 strict managed Evidence 所需的附件请求，无引用时不发请求。 */
export const getAttachmentPreviewRequest = (
  confluenceUrl: string,
  storageHtml: string
): CopyTestAttachmentsRequest | null => {
  /** 严格 managed Evidence 单元格实际引用的附件文件名。 */
  const fileNames = getConfluenceStorageTableImageFileNames(storageHtml);
  return fileNames.length > 0 ? { confluenceUrl, fileNames } : null;
};

/** 构建不含预览图片的稳定 bundle。 */
export const getEmptyAttachmentPreviewBundle = (
  storageHtml: string
): CopyTestStorageImagePreviewBundle => ({ images: [], storageHtml });

/** 校验当前表格选择并构建只包含目标双列改动的 export storage。 */
export const getRequiredExportStorage = (
  tableState: UseCopyTestSessionResult,
  exportScope = createCopyTestExportScope(),
  baseStorageHtml?: string
): string | null => {
  if (!tableState.selectedTable || tableState.selectedColumnIndex === undefined || !tableState.selectedHeader) {
    message.warning('Please select a table and column first');
    return null;
  }

  if (tableState.selectedRowIndexes.length === 0) {
    message.warning('Please select at least one row');
    return null;
  }

  return buildCurrentColumnExportStorage({
    exportScope,
    originalStorageHtml: baseStorageHtml || tableState.originalStorageHtml,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedColumnLabel: tableState.selectedHeader.label,
    selectedRowIndexes: tableState.selectedRowIndexes,
    table: tableState.selectedTable,
  });
};

/** 构建 storage 和独立内存图片 bundle，避免把 base64 写入整页 HTML。 */
export const buildStorageAttachmentPreviewBundle = ({
  confluenceUrl,
  loadAttachments,
  storageHtml,
}: AttachmentPreviewParams): Promise<CopyTestStorageImagePreviewBundle> => {
  /** 当前 storage 中严格 managed Evidence 所需的附件请求。 */
  const request = getAttachmentPreviewRequest(confluenceUrl, storageHtml);
  if (!request) {
    return Promise.resolve(getEmptyAttachmentPreviewBundle(storageHtml));
  }
  return Promise.resolve().then(() => loadAttachments(request))
    .then(response => buildConfluenceStorageTableImagePreviewBundle(storageHtml, response.images));
};

/** 校验截图和表格选择并冻结本次 AI 校验所需上下文。 */
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

  /** 当前内存截图是否超过数量或总容量限制。 */
  const uploadError = getImageLimitError(uploadImages);
  if (uploadError) {
    message.warning(uploadError);
    return null;
  }

  /** 当前勾选来源原子组生成的严格 AI 输入行。 */
  const rows = tableState.buildSelectedRowsForValidation();
  if (rows.length === 0) {
    message.warning('Selected column has no copy to validate');
    return null;
  }

  return {
    rows,
    selectedColumnIndex: tableState.selectedColumnIndex,
    selectedColumnLabel: tableState.selectedHeader.label,
    selectedTable: tableState.selectedTable,
  };
};
