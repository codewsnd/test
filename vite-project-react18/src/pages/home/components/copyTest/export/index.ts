/**
 * 文件作用：提供 CopyTest 本地文件导出的唯一公开门面并延迟加载格式实现。
 */
import { createCopyTestExportFileName } from './copyTestExportDownload';
import { normalizeCopyTestExportImages } from './copyTestExportImages';
import { buildCopyTestExportTableModel } from './copyTestExportModel';
import type {
  CopyTestFileExportRequest,
  CopyTestFileExportResult,
} from './copyTestExportTypes';

export type {
  CopyTestFileExportFormat,
  CopyTestFileExportRequest,
  CopyTestFileExportResult,
} from './copyTestExportTypes';

/** 任一已缓存 Test Evidence 图片不可用时阻止生成残缺文件的错误信息。 */
const COPY_TEST_EXPORT_MISSING_EVIDENCE_ERROR = 'Test Evidence images are unavailable for export';

/** 确保中立模型中的每张已缓存 Test Evidence 图片都可以真实嵌入。 */
const assertCopyTestEvidenceImagesAvailable = (
  model: ReturnType<typeof buildCopyTestExportTableModel>
): void => {
  if (model.missingImageFileNames.length === 0) {
    return;
  }
  throw new Error(
    `${COPY_TEST_EXPORT_MISSING_EVIDENCE_ERROR}: ${model.missingImageFileNames.join(', ')}`
  );
};

/** 调用 PDF 导出模块并保持主页面首屏包体稳定。 */
const exportPdf = async (
  model: ReturnType<typeof buildCopyTestExportTableModel>,
  fileName: string
): Promise<void> => {
  /** 按需加载的 PDF 格式实现。 */
  const { exportCopyTestTableToPdf } = await import('./copyTestPdfExporter');
  exportCopyTestTableToPdf(model, fileName);
};

/** 调用 Word 导出模块并保持主页面首屏包体稳定。 */
const exportWord = async (
  model: ReturnType<typeof buildCopyTestExportTableModel>,
  fileName: string
): Promise<void> => {
  /** 按需加载的 Word 格式实现。 */
  const { exportCopyTestTableToWord } = await import('./copyTestWordExporter');
  await exportCopyTestTableToWord(model, fileName);
};

/** 调用 Excel 导出模块并保持主页面首屏包体稳定。 */
const exportExcel = async (
  model: ReturnType<typeof buildCopyTestExportTableModel>,
  fileName: string
): Promise<void> => {
  /** 按需加载的 Excel 格式实现。 */
  const { exportCopyTestTableToExcel } = await import('./copyTestExcelExporter');
  exportCopyTestTableToExcel(model, fileName);
};

/** 根据用户选择把同一中立模型交给对应格式实现。 */
const runFormatExporter = async (
  request: CopyTestFileExportRequest,
  model: ReturnType<typeof buildCopyTestExportTableModel>,
  fileName: string
): Promise<void> => {
  if (request.format === 'pdf') {
    await exportPdf(model, fileName);
    return;
  }
  if (request.format === 'word') {
    await exportWord(model, fileName);
    return;
  }
  await exportExcel(model, fileName);
};

/** 导出当前选中表格并返回实际文件名；Evidence 缺图时不生成文件。 */
export const exportCopyTestTable = async (
  request: CopyTestFileExportRequest
): Promise<CopyTestFileExportResult> => {
  /** 统一为 PDF、Word 和 Excel 都能真实嵌入的图片数据。 */
  const normalizedImages = await normalizeCopyTestExportImages(request.images);
  /** 点击时的 workingHtml 和内存图片构建出的中立模型。 */
  const model = buildCopyTestExportTableModel(request.tableHtml, normalizedImages);
  assertCopyTestEvidenceImagesAvailable(model);
  /** 当前年月日时分秒与格式扩展名组成的文件名。 */
  const fileName = createCopyTestExportFileName(
    request.format,
    request.exportedAt || new Date()
  );
  await runFormatExporter(request, model, fileName);
  return {
    fileName,
  };
};
