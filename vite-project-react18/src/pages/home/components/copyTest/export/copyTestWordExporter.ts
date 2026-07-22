/**
 * 文件作用：使用 docx 将中立表格模型导出为可编辑 Word 文件。
 */
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IImageOptions,
} from 'docx';
import {
  COPY_TEST_EXPORT_FAILED_COLOR,
  COPY_TEST_EXPORT_FAILED_LABEL,
  COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT,
  COPY_TEST_EXPORT_IMAGE_MAX_WIDTH,
  COPY_TEST_EXPORT_PASSED_COLOR,
  COPY_TEST_EXPORT_PASSED_LABEL,
  COPY_TEST_WORD_MIME_TYPE,
} from './copyTestExportConstants';
import { downloadCopyTestBlob } from './copyTestExportDownload';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportTableModel,
} from './copyTestExportTypes';

/** Word 表头单元格使用的浅灰色背景。 */
const COPY_TEST_WORD_HEADER_FILL = 'EDEFF2';

/** Word 表格整体使用的百分比宽度。 */
const COPY_TEST_WORD_TABLE_WIDTH = 100;

/** Word 表格网格分配使用的基础单位。 */
const COPY_TEST_WORD_TABLE_GRID_WIDTH = 10_000;

/** Word 不支持的图片格式使用的说明前缀。 */
const COPY_TEST_WORD_UNSUPPORTED_IMAGE_PREFIX = 'Image unavailable in Word:';

/** docx 可直接嵌入的普通图片类型。 */
type CopyTestWordImageType = 'jpg' | 'png' | 'gif' | 'bmp';

/** 从 data URL 中读取 docx 支持的图片类型。 */
const getWordImageType = (dataUrl: string): CopyTestWordImageType | null => {
  /** 当前 data URL 声明的小写 MIME 子类型。 */
  const mimeSubtype = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(dataUrl)?.[1]?.toLowerCase();
  if (mimeSubtype === 'jpeg' || mimeSubtype === 'jpg') {
    return 'jpg';
  }
  if (mimeSubtype === 'png' || mimeSubtype === 'gif' || mimeSubtype === 'bmp') {
    return mimeSubtype;
  }
  return null;
};

/** 按最大展示范围等比缩放 Evidence 图片。 */
const getWordImageTransformation = (
  image: CopyTestExportCellImage
): IImageOptions['transformation'] => {
  /** 将原图限制在 Word 单元格范围内的缩放比例。 */
  const scale = Math.min(
    1,
    COPY_TEST_EXPORT_IMAGE_MAX_WIDTH / image.width,
    COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT / image.height
  );
  return {
    height: Math.max(1, Math.round(image.height * scale)),
    width: Math.max(1, Math.round(image.width * scale)),
  };
};

/** 根据 Result 单元格中的 Passed 或 Failed 文本选择 Word 字体颜色。 */
const getWordTextColor = (
  cell: CopyTestExportCell,
  text: string
): string | undefined => {
  if (cell.kind !== 'result' || cell.header) {
    return undefined;
  }
  if (text.startsWith(COPY_TEST_EXPORT_PASSED_LABEL)) {
    return COPY_TEST_EXPORT_PASSED_COLOR;
  }
  if (text.startsWith(COPY_TEST_EXPORT_FAILED_LABEL)) {
    return COPY_TEST_EXPORT_FAILED_COLOR;
  }
  return undefined;
};

/** 将一行单元格文本转换为 Word 段落。 */
const createWordTextParagraph = (
  cell: CopyTestExportCell,
  text: string,
): Paragraph => {
  /** 当前文本行的 Passed 或 Failed 状态色。 */
  const color = getWordTextColor(cell, text);
  return new Paragraph({
    children: [new TextRun({
      bold: cell.header || Boolean(color),
      color,
      text,
    })],
    spacing: { after: 60 },
  });
};

/** 将一张可用 Evidence 图片转换为 Word 图片段落。 */
const createWordImageParagraph = (
  image: CopyTestExportCellImage
): Paragraph => {
  /** 当前 Evidence data URL 可映射到的 docx 图片类型。 */
  const imageType = image.dataUrl ? getWordImageType(image.dataUrl) : null;
  if (!image.dataUrl || !imageType) {
    return new Paragraph({
      text: `${COPY_TEST_WORD_UNSUPPORTED_IMAGE_PREFIX} ${image.fileName}`,
    });
  }
  return new Paragraph({
    children: [new ImageRun({
      data: image.dataUrl,
      transformation: getWordImageTransformation(image),
      type: imageType,
    })],
    spacing: { after: 100 },
  });
};

/** 构建一个 Word 单元格中的文本和图片段落。 */
const buildWordCellChildren = (cell: CopyTestExportCell): Paragraph[] => {
  /** 当前单元格按原始换行拆分出的文本段落。 */
  const textParagraphs = cell.text
    .split('\n')
    .filter(Boolean)
    .map(text => createWordTextParagraph(cell, text));
  /** 当前单元格按 DOM 顺序生成的 Evidence 图片段落。 */
  const imageParagraphs = cell.images.map(createWordImageParagraph);
  return [...textParagraphs, ...imageParagraphs].length > 0
    ? [...textParagraphs, ...imageParagraphs]
    : [new Paragraph('')];
};

/** 将一个中立单元格转换为 docx TableCell。 */
const createWordTableCell = (
  cell: CopyTestExportCell,
  columnCount: number
): TableCell => {
  return new TableCell({
    children: buildWordCellChildren(cell),
    columnSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    shading: cell.header
      ? { fill: COPY_TEST_WORD_HEADER_FILL, type: ShadingType.CLEAR }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: {
      size: (cell.colSpan / columnCount) * COPY_TEST_WORD_TABLE_WIDTH,
      type: WidthType.PERCENTAGE,
    },
  });
};

/** 将一个中立物理行转换为 docx TableRow。 */
const createWordTableRow = (
  cells: CopyTestExportCell[],
  columnCount: number
): TableRow => {
  return new TableRow({
    cantSplit: true,
    children: cells.map(cell => createWordTableCell(cell, columnCount)),
    tableHeader: cells.length > 0 && cells.every(cell => cell.header),
  });
};

/** 创建只包含当前选中表格的 docx Document。 */
export const createCopyTestWordDocument = (
  model: CopyTestExportTableModel
): Document => {
  /** 每个逻辑列在 Word 固定表格网格中的宽度。 */
  const columnWidth = Math.floor(COPY_TEST_WORD_TABLE_GRID_WIDTH / model.columnCount);
  /** 按物理行和原始合并关系生成的 Word 表格。 */
  const table = new Table({
    alignment: AlignmentType.CENTER,
    columnWidths: Array.from({ length: model.columnCount }, () => columnWidth),
    layout: TableLayoutType.FIXED,
    rows: model.rows.map(row => createWordTableRow(row.cells, model.columnCount)),
    width: { size: COPY_TEST_WORD_TABLE_WIDTH, type: WidthType.PERCENTAGE },
  });
  return new Document({
    sections: [{
      children: [table],
      properties: {
        page: {
          margin: { bottom: 360, left: 360, right: 360, top: 360 },
          size: { orientation: PageOrientation.LANDSCAPE },
        },
      },
    }],
  });
};

/** 使用中立模型创建 Word Blob。 */
export const createCopyTestWordBlob = async (
  model: CopyTestExportTableModel
): Promise<Blob> => {
  /** docx Packer 在浏览器中生成的标准 OOXML Blob。 */
  const wordBlob = await Packer.toBlob(createCopyTestWordDocument(model));
  return wordBlob.type === COPY_TEST_WORD_MIME_TYPE
    ? wordBlob
    : new Blob([wordBlob], { type: COPY_TEST_WORD_MIME_TYPE });
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
