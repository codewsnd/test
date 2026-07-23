/**
 * 文件作用：提供 CopyTest Word 文件创建和下载接口。
 */
import { COPY_TEST_WORD_MIME_TYPE } from './copyTestExportConstants';
import { downloadCopyTestBlob } from './copyTestExportDownload';
import type { CopyTestExportTableModel } from './copyTestExportTypes';
import { createCopyTestWordPackage } from './copyTestWordOoxml';

/** 使用中立模型创建 Word Blob。 */
export const createCopyTestWordBlob = (
  model: CopyTestExportTableModel
): Promise<Blob> => {
  /** fflate 打包得到的标准 Word OOXML 二进制。 */
  const wordPackage = createCopyTestWordPackage(model);
  return Promise.resolve(new Blob([wordPackage], { type: COPY_TEST_WORD_MIME_TYPE }));
};

/** 创建并下载当前选中表格的 Word 文件。 */
export const exportCopyTestTableToWord = async (
  model: CopyTestExportTableModel,
  fileName: string
): Promise<void> => {
  /** 当前中立表格模型生成的 Word Blob。 */
  const wordBlob = await createCopyTestWordBlob(model);
  downloadCopyTestBlob(wordBlob, fileName);
};
