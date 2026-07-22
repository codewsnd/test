/**
 * 文件作用：使用 jsPDF 和 jspdf-autotable 将中立表格模型导出为 PDF 文件。
 */
import { jsPDF } from 'jspdf';
import {
  __createTable,
  autoTable,
  type CellDef,
  type CellHookData,
  type RowInput,
  type UserOptions,
} from 'jspdf-autotable';
import {
  COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH,
  COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH,
  COPY_TEST_EXPORT_FAILED_COLOR,
  COPY_TEST_EXPORT_FAILED_LABEL,
  COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT,
  COPY_TEST_EXPORT_IMAGE_MAX_WIDTH,
  COPY_TEST_EXPORT_PASSED_COLOR,
  COPY_TEST_EXPORT_PASSED_LABEL,
  COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH,
  COPY_TEST_PDF_MIME_TYPE,
} from './copyTestExportConstants';
import { downloadCopyTestBlob } from './copyTestExportDownload';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportCellKind,
  CopyTestExportRow,
  CopyTestExportTableModel,
} from './copyTestExportTypes';

/** PDF 表头使用的浅灰色 RGB 背景。 */
const COPY_TEST_PDF_HEADER_FILL: [number, number, number] = [237, 239, 242];

/** PDF 表格边框使用的 RGB 颜色。 */
const COPY_TEST_PDF_BORDER_COLOR: [number, number, number] = [190, 198, 210];

/** PDF 单元格内容与边框之间的点数间距。 */
const COPY_TEST_PDF_CELL_PADDING = 4;

/** PDF 表格正文使用的字号。 */
const COPY_TEST_PDF_FONT_SIZE = 8;

/** PDF 页面四周使用的点数边距。 */
const COPY_TEST_PDF_PAGE_MARGIN = 24;

/** 为 AutoTable 边框和分页舍入误差预留的 PDF 点数高度。 */
const COPY_TEST_PDF_LAYOUT_HEIGHT_ALLOWANCE = 8;

/** PDF 规范和 jsPDF 允许的单页安全最大点数边长。 */
const COPY_TEST_PDF_MAX_PAGE_DIMENSION = 14_000;

/** 浏览器 Canvas 渲染非拉丁文字时使用的像素倍率。 */
const COPY_TEST_PDF_CANVAS_SCALE = 2;

/** 将 CSS 像素换算为 PDF 点的比例。 */
const COPY_TEST_PDF_PIXEL_TO_POINT = 0.75;

/** 非拉丁文字和 Emoji 使用 Canvas 栅格化，避免 jsPDF 内置字体显示方框。 */
const COPY_TEST_PDF_RASTER_TEXT_PATTERN = /(?:(?!\p{Script=Latin})\p{Letter})|\p{Extended_Pictographic}/u;

/** AutoTable 原始 CellDef 中附带的中立单元格。 */
interface CopyTestPdfCellDef extends CellDef {
  /** 供绘制图片和非拉丁文字时读取的原始中立单元格。 */
  copyTestCell: CopyTestExportCell;
  /** Result 单元格 Passed 或 Failed 标签使用的可选 RGB 颜色。 */
  statusColor?: [number, number, number];
}

/** 完整表格单页 PDF 使用的自适应页面尺寸。 */
interface CopyTestPdfPageLayout {
  /** 自适应页面的点数高度。 */
  height: number;
  /** 根据宽高关系选择的页面方向。 */
  orientation: 'landscape' | 'portrait';
  /** 自适应页面的点数宽度。 */
  width: number;
}

/** jsPDF 可直接读取的图片格式。 */
type CopyTestPdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

/** 将十六进制颜色转换为 AutoTable 使用的 RGB 元组。 */
const hexToRgb = (hexColor: string): [number, number, number] => {
  return [
    Number.parseInt(hexColor.slice(0, 2), 16),
    Number.parseInt(hexColor.slice(2, 4), 16),
    Number.parseInt(hexColor.slice(4, 6), 16),
  ];
};

/** 将逻辑列类型转换为 PDF 点数列宽。 */
const getPdfColumnWidth = (kind: CopyTestExportCellKind): number => {
  if (kind === 'result') {
    return COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH * COPY_TEST_PDF_PIXEL_TO_POINT;
  }
  if (kind === 'evidence') {
    return COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH * COPY_TEST_PDF_PIXEL_TO_POINT;
  }
  return COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH * COPY_TEST_PDF_PIXEL_TO_POINT;
};

/** 根据 Result 内容读取 PDF 字体颜色。 */
const getPdfTextColor = (cell: CopyTestExportCell): [number, number, number] | undefined => {
  if (cell.kind !== 'result' || cell.header) {
    return undefined;
  }
  if (cell.text.startsWith(COPY_TEST_EXPORT_PASSED_LABEL)) {
    return hexToRgb(COPY_TEST_EXPORT_PASSED_COLOR);
  }
  if (cell.text.startsWith(COPY_TEST_EXPORT_FAILED_LABEL)) {
    return hexToRgb(COPY_TEST_EXPORT_FAILED_COLOR);
  }
  return undefined;
};

/** 根据图片 data URL 读取 jsPDF 支持的格式。 */
const getPdfImageFormat = (dataUrl: string): CopyTestPdfImageFormat | null => {
  /** 当前 data URL 声明的小写 MIME 子类型。 */
  const mimeSubtype = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(dataUrl)?.[1]?.toLowerCase();
  if (mimeSubtype === 'png') {
    return 'PNG';
  }
  if (mimeSubtype === 'jpeg' || mimeSubtype === 'jpg') {
    return 'JPEG';
  }
  return mimeSubtype === 'webp' ? 'WEBP' : null;
};

/** 判断一张 Evidence 图片是否可以由 jsPDF 直接绘制。 */
const isDrawablePdfImage = (image: CopyTestExportCellImage): boolean => {
  return Boolean(image.dataUrl && getPdfImageFormat(image.dataUrl));
};

/** 为 PDF 无法绘制的 Evidence 图片追加可追溯文件名。 */
const getPdfCellText = (cell: CopyTestExportCell): string => {
  /** 当前单元格中无法由 jsPDF 直接绘制的图片说明。 */
  const unavailableImageLines = cell.images
    .filter(image => !isDrawablePdfImage(image))
    .map(image => `Image unavailable: ${image.fileName}`);
  return [cell.text, ...unavailableImageLines].filter(Boolean).join('\n');
};

/** 按 PDF 单元格可用范围等比缩放一张 Evidence 图片。 */
const getPdfImageSize = (
  image: CopyTestExportCellImage,
  availableWidth: number
): { height: number; width: number } => {
  /** PDF 中单张图片允许使用的最大点数宽度。 */
  const maximumWidth = Math.min(
    COPY_TEST_EXPORT_IMAGE_MAX_WIDTH * COPY_TEST_PDF_PIXEL_TO_POINT,
    availableWidth
  );
  /** PDF 中单张图片允许使用的最大点数高度。 */
  const maximumHeight = COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT * COPY_TEST_PDF_PIXEL_TO_POINT;
  /** 将原始图片限制在 PDF 单元格范围内的缩放比例。 */
  const scale = Math.min(
    1,
    maximumWidth / (image.width * COPY_TEST_PDF_PIXEL_TO_POINT),
    maximumHeight / (image.height * COPY_TEST_PDF_PIXEL_TO_POINT)
  );
  return {
    height: Math.max(1, image.height * COPY_TEST_PDF_PIXEL_TO_POINT * scale),
    width: Math.max(1, image.width * COPY_TEST_PDF_PIXEL_TO_POINT * scale),
  };
};

/** 计算 Evidence 图片为 AutoTable 额外预留的最小高度。 */
const getPdfImageContentHeight = (
  cell: CopyTestExportCell,
  availableWidth = COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH * COPY_TEST_PDF_PIXEL_TO_POINT
): number => {
  return cell.images.filter(isDrawablePdfImage).reduce((height, image) => {
    /** 当前图片在实际 Evidence 可用宽度中的 PDF 展示尺寸。 */
    const imageSize = getPdfImageSize(image, availableWidth);
    return height + imageSize.height + COPY_TEST_PDF_CELL_PADDING;
  }, 0);
};

/** 计算 AutoTable 已换行文本在单元格中占用的 PDF 点数高度。 */
const getPdfTextHeight = (lines: string[]): number => {
  return lines.length * COPY_TEST_PDF_FONT_SIZE * 1.2;
};

/** 读取单元格文本按目标列宽换行后的 PDF 行。 */
const getPdfWrappedTextLines = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth = getPdfColumnWidth(cell.kind) * cell.colSpan
): string[] => {
  /** 当前合并单元格扣除左右 padding 后的文字可用宽度。 */
  const availableWidth = Math.max(
    1,
    cellWidth - COPY_TEST_PDF_CELL_PADDING * 2
  );
  /** 包括图片不可用说明在内的完整单元格文本。 */
  const text = getPdfCellText(cell);
  if (!text) {
    return [];
  }
  /** 测量前保存的 jsPDF 当前字号。 */
  const originalFontSize = doc.getFontSize();
  /** 测量前保存的 jsPDF 当前字体。 */
  const originalFont = doc.getFont();
  doc.setFont(originalFont.fontName, cell.header ? 'bold' : 'normal');
  doc.setFontSize(COPY_TEST_PDF_FONT_SIZE);
  try {
    return doc.splitTextToSize(text, availableWidth) as string[];
  } finally {
    doc.setFont(originalFont.fontName, originalFont.fontStyle);
    doc.setFontSize(originalFontSize);
  }
};

/** 计算完整文字和图片共同需要的 PDF 单元格高度。 */
const getPdfCellMinimumHeight = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  columnWidths: number[]
): number => {
  /** 当前合并单元格覆盖全部逻辑列后的准确点数宽度。 */
  const cellWidth = getPdfCellWidth(columnWidths, cell);
  return getPdfNaturalCellHeight(doc, cell, cellWidth);
};

/** 将一个中立单元格转换为 AutoTable CellDef。 */
const createPdfCellDef = (
  cell: CopyTestExportCell,
  doc?: jsPDF,
  columnWidths?: number[]
): CopyTestPdfCellDef => {
  /** 当前 Result 内容的 Passed 或 Failed 状态色。 */
  const statusColor = getPdfTextColor(cell);
  return {
    colSpan: cell.colSpan,
    content: getPdfCellText(cell),
    copyTestCell: cell,
    rowSpan: cell.rowSpan,
    statusColor,
    styles: {
      fillColor: cell.header ? COPY_TEST_PDF_HEADER_FILL : undefined,
      fontStyle: cell.header ? 'bold' : 'normal',
      minCellHeight: doc && columnWidths
        ? getPdfCellMinimumHeight(doc, cell, columnWidths)
        : Math.max(18, getPdfImageContentHeight(cell) + 18),
      textColor: [20, 20, 20],
      valign: cell.images.length > 0 ? 'top' : 'middle',
    },
  };
};

/** 将一个中立物理行转换为 AutoTable 行。 */
const createPdfRow = (
  row: CopyTestExportRow,
  doc?: jsPDF,
  columnWidths?: number[]
): RowInput => {
  return row.cells.map(cell => createPdfCellDef(cell, doc, columnWidths));
};

/** 判断首行是否是不会跨入正文区域的独立表头。 */
const isStandaloneHeaderRow = (row: CopyTestExportRow | undefined): boolean => {
  return Boolean(
    row
    && row.cells.length > 0
    && row.cells.every(cell => cell.header && cell.rowSpan === 1)
  );
};

/** 从 AutoTable raw cell 中读取附带的中立单元格。 */
const getRawCopyTestCell = (data: CellHookData): CopyTestExportCell | null => {
  /** AutoTable 保留的调用方原始单元格定义。 */
  const rawCell = data.cell.raw;
  if (!rawCell || typeof rawCell !== 'object' || !('copyTestCell' in rawCell)) {
    return null;
  }
  return (rawCell as CopyTestPdfCellDef).copyTestCell;
};

/** 生成中立单元格在当前表格中的稳定键。 */
const getPdfCellKey = (cell: CopyTestExportCell): string => {
  return `${cell.rowIndex}:${cell.columnIndex}`;
};

/** 为非拉丁文字和 Emoji 创建透明背景的 Canvas 图片。 */
const createRasterTextDataUrl = (
  lines: string[],
  statusColor: string | undefined,
  widthInPoints: number
): string | null => {
  /** PDF 点数换算到浏览器 CSS 像素后的宽度。 */
  const widthInCssPixels = Math.max(1, Math.ceil(widthInPoints / COPY_TEST_PDF_PIXEL_TO_POINT));
  /** 当前文字行高换算后的 CSS 像素值。 */
  const lineHeightInCssPixels = Math.ceil(
    COPY_TEST_PDF_FONT_SIZE * 1.2 / COPY_TEST_PDF_PIXEL_TO_POINT
  );
  /** 仅用于栅格化非拉丁文字和 Emoji 的临时画布。 */
  const canvas = document.createElement('canvas');
  canvas.width = widthInCssPixels * COPY_TEST_PDF_CANVAS_SCALE;
  canvas.height = Math.max(1, lines.length * lineHeightInCssPixels * COPY_TEST_PDF_CANVAS_SCALE);
  /** 临时画布的二维绘图上下文。 */
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.scale(COPY_TEST_PDF_CANVAS_SCALE, COPY_TEST_PDF_CANVAS_SCALE);
  context.textBaseline = 'top';
  lines.forEach((line, lineIndex) => {
    /** 仅 Result 第一行使用 Passed 或 Failed 状态色。 */
    const isStatusLine = lineIndex === 0 && Boolean(statusColor);
    context.fillStyle = isStatusLine && statusColor ? statusColor : '#141414';
    context.font = `${isStatusLine ? 'bold ' : ''}${Math.ceil(COPY_TEST_PDF_FONT_SIZE / COPY_TEST_PDF_PIXEL_TO_POINT)}px Arial, sans-serif`;
    context.fillText(line, 0, lineIndex * lineHeightInCssPixels);
  });
  return canvas.toDataURL('image/png');
};

/** 在 AutoTable 单元格中绘制已栅格化的非拉丁文字和 Emoji。 */
const drawRasterText = (
  doc: jsPDF,
  data: CellHookData,
  cell: CopyTestExportCell,
  lines: string[]
): void => {
  /** 当前 Result 第一行在 PDF 中使用的可选状态色。 */
  const statusRgb = getPdfTextColor(cell);
  /** Canvas 使用的十六进制状态色。 */
  const statusColor = statusRgb
    ? `#${statusRgb.map(value => value.toString(16).padStart(2, '0')).join('')}`
    : undefined;
  /** 当前单元格文本区域栅格化后的 PNG data URL。 */
  const textDataUrl = createRasterTextDataUrl(
    lines,
    statusColor,
    Math.max(1, data.cell.width - COPY_TEST_PDF_CELL_PADDING * 2)
  );
  if (!textDataUrl) {
    return;
  }
  doc.addImage(
    textDataUrl,
    'PNG',
    data.cell.x + COPY_TEST_PDF_CELL_PADDING,
    data.cell.y + COPY_TEST_PDF_CELL_PADDING,
    Math.max(1, data.cell.width - COPY_TEST_PDF_CELL_PADDING * 2),
    getPdfTextHeight(lines),
    undefined,
    'FAST'
  );
};

/** 在普通拉丁文字 Result 单元格中只覆盖绘制 Passed 或 Failed 标签。 */
const drawPdfResultStatus = (
  doc: jsPDF,
  data: CellHookData,
  cell: CopyTestExportCell
): void => {
  /** 当前 Result 单元格可选的状态 RGB 颜色。 */
  const statusColor = getPdfTextColor(cell);
  if (!statusColor) {
    return;
  }
  /** 当前 Result 状态标签的文字起点。 */
  const textPosition = data.cell.getTextPos();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(data.cell.styles.fontSize);
  doc.setTextColor(...statusColor);
  doc.text(
    cell.text.startsWith(COPY_TEST_EXPORT_PASSED_LABEL)
      ? COPY_TEST_EXPORT_PASSED_LABEL
      : COPY_TEST_EXPORT_FAILED_LABEL,
    textPosition.x,
    textPosition.y
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
};

/** 在 AutoTable 单元格文字下方按顺序绘制 Evidence 图片。 */
const drawPdfCellImages = (
  doc: jsPDF,
  data: CellHookData,
  cell: CopyTestExportCell,
  textLines: string[]
): void => {
  if (!cell.images.some(isDrawablePdfImage)) {
    return;
  }
  /** 当前单元格扣除左右 padding 后的图片可用宽度。 */
  const availableWidth = Math.max(1, data.cell.width - COPY_TEST_PDF_CELL_PADDING * 2);
  /** 第一张图片在当前单元格中的垂直起点。 */
  let imageY = data.cell.y
    + COPY_TEST_PDF_CELL_PADDING
    + getPdfTextHeight(textLines)
    + (textLines.length > 0 ? COPY_TEST_PDF_CELL_PADDING : 0);
  /** 当前 PDF 页面扣除底部边距后的安全底边。 */
  const pageBottom = doc.internal.pageSize.getHeight() - COPY_TEST_PDF_PAGE_MARGIN;
  /** 图片不得越过单元格底部或页面安全底边。 */
  const imageBottom = Math.min(data.cell.y + data.cell.height, pageBottom);
  /** 不越过当前合并单元格底部的实际可用图片高度。 */
  const availableHeight = Math.max(0, imageBottom - imageY);
  /** 全部图片和间距在当前宽度下未缩放时的高度。 */
  const imageContentHeight = getPdfImageContentHeight(cell, availableWidth);
  /** 内容过高时让全部图片共同等比缩放到单元格内部。 */
  const cellScale = imageContentHeight > 0
    ? Math.min(1, availableHeight / imageContentHeight)
    : 0;
  if (cellScale <= 0) {
    throw new Error('Test Evidence content is too tall for PDF export');
  }
  cell.images.forEach(image => {
    if (!image.dataUrl) {
      return;
    }
    /** 当前 data URL 可供 jsPDF 读取的图片格式。 */
    const imageFormat = getPdfImageFormat(image.dataUrl);
    if (!imageFormat) {
      return;
    }
    /** 当前 Evidence 图片等比缩放后的 PDF 尺寸。 */
    const unscaledImageSize = getPdfImageSize(image, availableWidth);
    /** 应用当前单元格统一缩放后的最终图片尺寸。 */
    const imageSize = {
      height: unscaledImageSize.height * cellScale,
      width: unscaledImageSize.width * cellScale,
    };
    doc.addImage(
      image.dataUrl,
      imageFormat,
      data.cell.x + COPY_TEST_PDF_CELL_PADDING,
      imageY,
      imageSize.width,
      imageSize.height,
      undefined,
      'FAST'
    );
    imageY += imageSize.height + COPY_TEST_PDF_CELL_PADDING * cellScale;
  });
};

/** 读取指定逻辑列当前对应的生成列类型。 */
const getPdfColumnKind = (
  model: CopyTestExportTableModel,
  columnIndex: number
): CopyTestExportCellKind => {
  /** 第一个覆盖当前逻辑列的 Result 或 Evidence 单元格。 */
  const generatedCell = model.rows.flatMap(row => row.cells).find(cell => {
    return cell.kind !== 'normal'
      && columnIndex >= cell.columnIndex
      && columnIndex < cell.columnIndex + cell.colSpan;
  });
  return generatedCell?.kind || 'normal';
};

/** 构建完整表格每个逻辑列的自然点数宽度。 */
const getPdfColumnWidths = (model: CopyTestExportTableModel): number[] => {
  return Array.from({ length: model.columnCount }, (_, columnIndex) => {
    return getPdfColumnWidth(getPdfColumnKind(model, columnIndex));
  });
};

/** 读取一个合并单元格覆盖的全部逻辑列自然宽度。 */
const getPdfCellWidth = (
  columnWidths: number[],
  cell: CopyTestExportCell
): number => {
  return columnWidths
    .slice(cell.columnIndex, cell.columnIndex + cell.colSpan)
    .reduce((width, columnWidth) => width + columnWidth, 0);
};

/** 计算单元格完整文字和图片在单页布局中的自然高度。 */
const getPdfNaturalCellHeight = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth: number
): number => {
  /** 按当前单元格准确宽度换行后的文字行。 */
  const textLines = getPdfWrappedTextLines(doc, cell, cellWidth);
  /** 扣除左右 padding 后供 Evidence 图片使用的宽度。 */
  const availableImageWidth = Math.max(
    1,
    cellWidth - COPY_TEST_PDF_CELL_PADDING * 2
  );
  /** 当前单元格全部可绘制图片及间距的自然高度。 */
  const imageHeight = getPdfImageContentHeight(cell, availableImageWidth);
  /** 文字和第一张图片之间需要保留的额外间距。 */
  const textImageGap = textLines.length > 0 && imageHeight > 0
    ? COPY_TEST_PDF_CELL_PADDING
    : 0;
  return Math.max(
    18,
    COPY_TEST_PDF_CELL_PADDING * 2
      + getPdfTextHeight(textLines)
      + textImageGap
      + imageHeight
  );
};

/** 校验自适应页面尺寸不会超过 PDF 单页安全边长。 */
const assertPdfPageDimension = (width: number, height: number): void => {
  if (
    width > COPY_TEST_PDF_MAX_PAGE_DIMENSION
    || height > COPY_TEST_PDF_MAX_PAGE_DIMENSION
  ) {
    throw new Error('The selected table is too large for single-page PDF export');
  }
};

/** 构建 AutoTable 每个逻辑列的宽度配置。 */
const buildPdfColumnStyles = (
  model: CopyTestExportTableModel
): UserOptions['columnStyles'] => {
  return Object.fromEntries(
    getPdfColumnWidths(model).map((cellWidth, columnIndex) => [
      columnIndex,
      { cellWidth },
    ])
  );
};

/** 将完整中立模型拆分为 AutoTable 的重复表头和全部正文行。 */
export const buildCopyTestPdfTableRows = (
  model: CopyTestExportTableModel,
  doc?: jsPDF
) => {
  /** 首行是否可以安全地从正文中拆为独立 AutoTable 表头。 */
  const hasHeaderRow = isStandaloneHeaderRow(model.rows[0]);
  /** 当前 PDF 文档中每个逻辑列的准确点数宽度。 */
  const columnWidths = doc ? getPdfColumnWidths(model) : undefined;
  return {
    body: model.rows.slice(hasHeaderRow ? 1 : 0).map(row => {
      return createPdfRow(row, doc, columnWidths);
    }),
    hasHeaderRow,
    head: hasHeaderRow ? [createPdfRow(model.rows[0], doc, columnWidths)] : [],
  };
};

/** 构建测量和最终绘制共用的 AutoTable 布局配置。 */
const buildPdfTableLayoutOptions = (
  model: CopyTestExportTableModel,
  doc: jsPDF
): UserOptions => {
  /** 完整表格拆分后的 AutoTable 表头和正文行。 */
  const tableRows = buildCopyTestPdfTableRows(model, doc);
  return {
    body: tableRows.body,
    columnStyles: buildPdfColumnStyles(model),
    head: tableRows.head,
    headStyles: { fillColor: COPY_TEST_PDF_HEADER_FILL },
    horizontalPageBreak: false,
    margin: COPY_TEST_PDF_PAGE_MARGIN,
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    showHead: tableRows.hasHeaderRow ? 'firstPage' : 'never',
    styles: {
      cellPadding: COPY_TEST_PDF_CELL_PADDING,
      fontSize: COPY_TEST_PDF_FONT_SIZE,
      lineColor: COPY_TEST_PDF_BORDER_COLOR,
      lineWidth: 0.5,
      overflow: 'linebreak',
      textColor: [20, 20, 20],
      valign: 'middle',
    },
    tableLineColor: COPY_TEST_PDF_BORDER_COLOR,
    tableLineWidth: 0.5,
    theme: 'grid',
  };
};

/** 使用 AutoTable 的真实合并布局测量完整表格高度。 */
const getPdfMeasuredTableHeight = (
  model: CopyTestExportTableModel,
  pageWidth: number
): number => {
  /** 只负责计算列宽、换行、rowSpan 和 colSpan 的临时 PDF 文档。 */
  const measurementDocument = new jsPDF({
    format: [pageWidth, 100],
    orientation: 'landscape',
    unit: 'pt',
  });
  /** AutoTable 在不绘制时计算出的完整真实表格。 */
  const measuredTable = __createTable(
    measurementDocument,
    buildPdfTableLayoutOptions(model, measurementDocument)
  );
  return measuredTable.allRows().reduce((height, row) => {
    return height + row.height;
  }, 0);
};

/** 根据完整表格真实布局构建不会分页的自适应 PDF 页面。 */
export const buildCopyTestPdfPageLayout = (
  model: CopyTestExportTableModel
): CopyTestPdfPageLayout => {
  /** 完整表格加左右页边距后的自然页面宽度。 */
  const width = getPdfColumnWidths(model).reduce(
    (totalWidth, columnWidth) => totalWidth + columnWidth,
    COPY_TEST_PDF_PAGE_MARGIN * 2
  );
  assertPdfPageDimension(width, 0);
  /** AutoTable 处理复杂合并关系后得到的真实表格高度。 */
  const tableHeight = getPdfMeasuredTableHeight(model, width);
  /** 完整表格加上下边距和边框舍入余量后的页面高度。 */
  const height = tableHeight
    + COPY_TEST_PDF_PAGE_MARGIN * 2
    + COPY_TEST_PDF_LAYOUT_HEIGHT_ALLOWANCE;
  assertPdfPageDimension(width, height);
  return {
    height,
    orientation: width >= height ? 'landscape' : 'portrait',
    width,
  };
};

/** 使用中立模型创建 PDF Blob。 */
export const createCopyTestPdfBlob = (model: CopyTestExportTableModel): Blob => {
  /** 根据完整表格宽高计算出的单页 PDF 画布。 */
  const pageLayout = buildCopyTestPdfPageLayout(model);
  /** 使用完整表格自适应尺寸和点数单位创建的单页 PDF 文档。 */
  const doc = new jsPDF({
    compress: true,
    format: [pageLayout.width, pageLayout.height],
    orientation: pageLayout.orientation,
    unit: 'pt',
  });
  /** 被栅格化的非拉丁文字单元格在绘制前保存的换行文本。 */
  const rasterTextLines = new Map<string, string[]>();
  /** 已经绘制过 Evidence 图片的中立单元格键，避免分页片段重复图片。 */
  const drawnEvidenceCellKeys = new Set<string>();
  autoTable(doc, {
    ...buildPdfTableLayoutOptions(model, doc),
    didDrawCell: data => {
      /** 当前 AutoTable 单元格绑定的中立单元格。 */
      const cell = getRawCopyTestCell(data);
      if (!cell) {
        return;
      }
      /** 当前单元格在 willDrawCell 阶段保存或 AutoTable 保留的文本行。 */
      const textLines = rasterTextLines.get(getPdfCellKey(cell)) || data.cell.text;
      if (rasterTextLines.has(getPdfCellKey(cell))) {
        drawRasterText(doc, data, cell, textLines);
      } else {
        drawPdfResultStatus(doc, data, cell);
      }
      /** 当前分页片段对应的稳定中立单元格键。 */
      const cellKey = getPdfCellKey(cell);
      if (!drawnEvidenceCellKeys.has(cellKey)) {
        drawPdfCellImages(doc, data, cell, textLines);
        if (cell.images.some(isDrawablePdfImage)) {
          drawnEvidenceCellKeys.add(cellKey);
        }
      }
    },
    willDrawCell: data => {
      /** 当前 AutoTable 单元格绑定的中立单元格。 */
      const cell = getRawCopyTestCell(data);
      if (!cell || !COPY_TEST_PDF_RASTER_TEXT_PATTERN.test(data.cell.text.join('\n'))) {
        if (cell && getPdfTextColor(cell) && data.cell.text.length > 0) {
          data.cell.text = ['', ...data.cell.text.slice(1)];
        }
        return;
      }
      /** 当前单元格首次绘制时保存的完整换行文本。 */
      const cellKey = getPdfCellKey(cell);
      if (!rasterTextLines.has(cellKey)) {
        rasterTextLines.set(cellKey, [...data.cell.text]);
      }
      data.cell.text = [];
    },
  });
  if (doc.getNumberOfPages() !== 1) {
    throw new Error('The selected table could not fit on a single PDF page');
  }
  /** jsPDF 输出的浏览器 Blob。 */
  const pdfBlob = doc.output('blob');
  return pdfBlob.type === COPY_TEST_PDF_MIME_TYPE
    ? pdfBlob
    : new Blob([pdfBlob], { type: COPY_TEST_PDF_MIME_TYPE });
};

/** 创建并下载当前选中表格的 PDF 文件。 */
export const exportCopyTestTableToPdf = (
  model: CopyTestExportTableModel,
  fileName: string
): void => {
  downloadCopyTestBlob(createCopyTestPdfBlob(model), fileName);
};
