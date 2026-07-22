/**
 * 文件作用：统一生成时间戳文件名并触发浏览器 Blob 下载。
 */
import type { CopyTestFileExportFormat } from './copyTestExportTypes';

/** 本地导出格式对应的文件扩展名。 */
const COPY_TEST_EXPORT_FILE_EXTENSIONS: Record<CopyTestFileExportFormat, string> = {
  excel: 'xlsx',
  pdf: 'pdf',
  word: 'docx',
};

/** 将不足两位的本地日期数字补零。 */
const padDatePart = (value: number): string => {
  return String(value).padStart(2, '0');
};

/** 使用用户本地时区生成 YYYYMMDDHHmmss 时间戳。 */
export const createCopyTestExportTimestamp = (exportedAt: Date): string => {
  /** 当前年份的四位文本。 */
  const year = String(exportedAt.getFullYear());
  /** 月、日、时、分、秒按顺序组成的两位文本。 */
  const dateParts = [
    exportedAt.getMonth() + 1,
    exportedAt.getDate(),
    exportedAt.getHours(),
    exportedAt.getMinutes(),
    exportedAt.getSeconds(),
  ].map(padDatePart);
  return [year, ...dateParts].join('');
};

/** 按当前年月日时分秒和目标格式生成文件名。 */
export const createCopyTestExportFileName = (
  format: CopyTestFileExportFormat,
  exportedAt: Date
): string => {
  return `${createCopyTestExportTimestamp(exportedAt)}.${COPY_TEST_EXPORT_FILE_EXTENSIONS[format]}`;
};

/** 使用临时 Object URL 下载 Blob，并在点击后立即释放资源。 */
export const downloadCopyTestBlob = (blob: Blob, fileName: string): void => {
  /** 浏览器为当前导出内容创建的临时 URL。 */
  const objectUrl = URL.createObjectURL(blob);
  /** 不插入界面布局的临时下载链接。 */
  const downloadLink = document.createElement('a');
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  try {
    downloadLink.click();
  } finally {
    downloadLink.remove();
    URL.revokeObjectURL(objectUrl);
  }
};
