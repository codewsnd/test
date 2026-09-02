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

/** PDF 默认使用的 A4 纵向页面点数高度。 */
const COPY_TEST_PDF_DEFAULT_PAGE_HEIGHT = 841.89;

/** 为 AutoTable 边框和行高舍入误差预留的 PDF 点数高度。 */
const COPY_TEST_PDF_LAYOUT_HEIGHT_ALLOWANCE = 8;

/** PDF 规范和 jsPDF 允许的单页安全最大点数边长。 */
const COPY_TEST_PDF_MAX_PAGE_DIMENSION = 14_000;

/** 浏览器 Canvas 渲染非拉丁文字时使用的像素倍率。 */
const COPY_TEST_PDF_CANVAS_SCALE = 2;

/** 将 CSS 像素换算为 PDF 点的比例。 */
const COPY_TEST_PDF_PIXEL_TO_POINT = 0.75;

/** PDF 正文使用的统一行高倍率，为复杂字形留出上下空间。 */
const COPY_TEST_PDF_LINE_HEIGHT_FACTOR = 1.3;

/** Result 状态行与 Screen 或失败原因之间的点数间距。 */
const COPY_TEST_PDF_STATUS_DETAIL_GAP = 4;

/** jsPDF 内置 Helvetica 可以稳定绘制且无需 Canvas 字体回退的字符。 */
const COPY_TEST_PDF_VECTOR_TEXT_PATTERN = /^[\t\n\r\u0020-\u007E\u2022]*$/u;

/** 需要使用从右到左方向绘制的主要文字脚本。 */
const COPY_TEST_PDF_RTL_TEXT_PATTERN = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/** Canvas 多语言文字使用的跨平台字体回退顺序。 */
const COPY_TEST_PDF_RASTER_FONT_FAMILY = [
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  '"Noto Sans"',
  '"Noto Sans CJK SC"',
  '"Noto Sans Arabic"',
  '"Noto Sans Devanagari"',
  '"Noto Sans Thai"',
  '"PingFang SC"',
  '"Microsoft YaHei"',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  'sans-serif',
].join(', ');

/** 浏览器分词器的最小结构，兼容当前 ES2020 类型库。 */
interface CopyTestPdfSegmenter {
  /** 将字符串按指定粒度分割为可安全拼接的片段。 */
  segment: (value: string) => Iterable<{ segment: string }>;
}

/** 浏览器分词器构造器的最小结构。 */
interface CopyTestPdfSegmenterConstructor {
  new (
    locales?: string | string[],
    options?: { granularity: 'grapheme' | 'word' }
  ): CopyTestPdfSegmenter;
}

/** AutoTable 原始 CellDef 中附带的中立单元格。 */
interface CopyTestPdfCellDef extends CellDef {
  /** 供绘制图片和非拉丁文字时读取的原始中立单元格。 */
  copyTestCell: CopyTestExportCell;
  /** Result 单元格首个 Passed 或 Failed 标签使用的可选 RGB 颜色。 */
  statusColor?: [number, number, number];
}

/** 多页 PDF 使用的自然宽度和稳定页面高度。 */
interface CopyTestPdfPageLayout {
  /** 每一页固定使用的 A4 纵向点数高度。 */
  height: number;
  /** 根据宽高关系选择的页面方向。 */
  orientation: 'landscape' | 'portrait';
  /** 自适应页面的点数宽度。 */
  width: number;
}

/** 单个 PDF continuation cell 中按顺序消费的文字与图片。 */
interface CopyTestPdfCellFragment {
  /** 当前 continuation cell 包含的 Evidence 图片。 */
  images: CopyTestExportCellImage[];
  /** 当前 continuation cell 包含的稳定换行文字。 */
  textLines: string[];
}

/** 传给 AutoTable 的重复表头和正文行。 */
interface CopyTestPdfTableRows {
  /** 当前表格的全部正文行。 */
  body: RowInput[];
  /** 当前表格是否具有可重复的独立表头。 */
  hasHeaderRow: boolean;
  /** 当前表格顶部连续且可重复的表头行。 */
  head: RowInput[];
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

/** 读取 Result 中单个状态行对应的 PDF 字体颜色。 */
const getPdfStatusLineColor = (
  cell: CopyTestExportCell,
  line: string
): [number, number, number] | undefined => {
  if (cell.kind !== 'result' || cell.header) {
    return undefined;
  }
  if (line === COPY_TEST_EXPORT_PASSED_LABEL) {
    return hexToRgb(COPY_TEST_EXPORT_PASSED_COLOR);
  }
  if (line === COPY_TEST_EXPORT_FAILED_LABEL) {
    return hexToRgb(COPY_TEST_EXPORT_FAILED_COLOR);
  }
  return undefined;
};

/** 判断 Result 单元格是否包含至少一个可着色的状态行。 */
const hasPdfStatusLine = (cell: CopyTestExportCell): boolean => {
  return cell.text.split('\n').some(line => {
    return Boolean(getPdfStatusLineColor(cell, line));
  });
};

/** 读取 Result 首行状态色，供 AutoTable 原始单元格元数据兼容使用。 */
const getPdfTextColor = (cell: CopyTestExportCell): [number, number, number] | undefined => {
  return getPdfStatusLineColor(cell, cell.text.split('\n')[0] || '');
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

/** 判断文本是否需要浏览器字体回退，避免 jsPDF 内置字体缺字。 */
const shouldRasterPdfText = (value: string): boolean => {
  return !COPY_TEST_PDF_VECTOR_TEXT_PATTERN.test(value);
};

/** 读取当前 PDF 文档使用的准确文字行高。 */
const getPdfTextLineHeight = (doc: jsPDF): number => {
  return COPY_TEST_PDF_FONT_SIZE * doc.getLineHeightFactor();
};

/** 读取 Result 状态行与后续详情之间需要预留的间距。 */
const getPdfStatusDetailGap = (
  cell: CopyTestExportCell,
  lines: string[]
): number => {
  return hasPdfStatusLine(cell) && lines.length > 1
    ? COPY_TEST_PDF_STATUS_DETAIL_GAP
    : 0;
};

/** 计算已换行文本和 Result 段落间距占用的 PDF 点数高度。 */
const getPdfTextHeight = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  lines: string[]
): number => {
  return lines.length * getPdfTextLineHeight(doc)
    + getPdfStatusDetailGap(cell, lines);
};

/** 创建用于多语言测量和绘制的 Canvas 字体声明。 */
const getPdfRasterFont = (bold: boolean): string => {
  /** PDF 字号换算为浏览器 Canvas 使用的 CSS 像素字号。 */
  const fontSize = COPY_TEST_PDF_FONT_SIZE / COPY_TEST_PDF_PIXEL_TO_POINT;
  return `${bold ? 700 : 400} ${fontSize}px ${COPY_TEST_PDF_RASTER_FONT_FAMILY}`;
};

/** 创建一个仅用于多语言文字测量的 Canvas 上下文。 */
const createPdfTextMeasurementContext = (): CanvasRenderingContext2D | null => {
  return document.createElement('canvas').getContext('2d');
};

/** 使用 Intl.Segmenter 或安全回退方式分割单词、复杂字形和 Emoji。 */
const getPdfTextSegments = (
  value: string,
  granularity: 'grapheme' | 'word'
): string[] => {
  /** 当前浏览器可能提供的 Unicode 分词器构造器。 */
  const Segmenter = (
    Intl as typeof Intl & { Segmenter?: CopyTestPdfSegmenterConstructor }
  ).Segmenter;
  if (Segmenter) {
    return Array.from(
      new Segmenter(undefined, { granularity }).segment(value),
      item => item.segment
    );
  }
  if (granularity === 'word') {
    return value.match(/\s+|\S+/gu) || [];
  }
  return Array.from(value);
};

/** 使用当前 Canvas 字体测量一段文字的 CSS 像素宽度。 */
const getPdfCanvasTextWidth = (
  context: CanvasRenderingContext2D,
  value: string
): number => {
  return context.measureText(value).width;
};

/** 把超过单行宽度的长词按 grapheme 拆成不会截断的多个片段。 */
const splitOversizedPdfTextSegment = (
  context: CanvasRenderingContext2D,
  segment: string,
  maximumWidth: number
): string[] => {
  /** 当前长词按 grapheme 累积后的多行结果。 */
  const lines: string[] = [];
  /** 当前正在累积且尚未提交的文字行。 */
  let currentLine = '';
  getPdfTextSegments(segment, 'grapheme').forEach(grapheme => {
    /** 追加当前 grapheme 后的候选文字行。 */
    const candidateLine = `${currentLine}${grapheme}`;
    if (currentLine && getPdfCanvasTextWidth(context, candidateLine) > maximumWidth) {
      lines.push(currentLine);
      currentLine = grapheme;
      return;
    }
    currentLine = candidateLine;
  });
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
};

/** 使用浏览器实际字体把一个显式文本行换行到目标宽度内。 */
const wrapPdfRasterParagraph = (
  context: CanvasRenderingContext2D,
  paragraph: string,
  maximumWidth: number
): string[] => {
  if (!paragraph) {
    return [''];
  }
  /** 当前段落按单词或文字边界累积后的多行结果。 */
  const lines: string[] = [];
  /** 当前正在累积且尚未提交的文字行。 */
  let currentLine = '';
  getPdfTextSegments(paragraph, 'word').forEach(segment => {
    /** 追加当前片段后的候选文字行。 */
    const candidateLine = `${currentLine}${segment}`;
    if (getPdfCanvasTextWidth(context, candidateLine) <= maximumWidth) {
      currentLine = candidateLine;
      return;
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
    /** 移除换行后不应出现在新行开头的空白。 */
    const nextSegment = segment.trimStart();
    /** 当前片段自身过宽时按 grapheme 拆分出的安全行。 */
    const segmentLines = splitOversizedPdfTextSegment(
      context,
      nextSegment,
      maximumWidth
    );
    currentLine = segmentLines.pop() || '';
    lines.push(...segmentLines);
  });
  if (currentLine.trim()) {
    lines.push(currentLine.trimEnd());
  }
  return lines.length > 0 ? lines : [''];
};

/** 使用 Canvas 实际字体为非拉丁文字构建稳定换行。 */
const getPdfRasterTextLines = (
  cell: CopyTestExportCell,
  text: string,
  availableWidth: number
): string[] | null => {
  /** 用于测量浏览器实际回退字体的 Canvas 上下文。 */
  const context = createPdfTextMeasurementContext();
  if (!context) {
    return null;
  }
  /** PDF 点数宽度换算成 Canvas CSS 像素后的可用宽度。 */
  const maximumWidth = availableWidth / COPY_TEST_PDF_PIXEL_TO_POINT;
  return text.split('\n').flatMap(paragraph => {
    /** 表头和 Result 状态行使用粗体完成同字体测量。 */
    const bold = cell.header || Boolean(getPdfStatusLineColor(cell, paragraph));
    context.font = getPdfRasterFont(bold);
    return wrapPdfRasterParagraph(context, paragraph, maximumWidth);
  });
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
  if (shouldRasterPdfText(text)) {
    /** 使用 Canvas 实际字体获得的多语言安全换行结果。 */
    const rasterLines = getPdfRasterTextLines(cell, text, availableWidth);
    if (rasterLines) {
      return rasterLines;
    }
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
  /** 使用目标列宽预先生成的稳定换行文本。 */
  const wrappedText = doc && columnWidths
    ? getPdfWrappedTextLines(doc, cell, getPdfCellWidth(columnWidths, cell))
    : undefined;
  return {
    colSpan: cell.colSpan,
    content: wrappedText?.join('\n') ?? getPdfCellText(cell),
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

/** 读取不会通过 rowspan 跨入正文区域的连续表头行数。 */
const getPdfHeaderRowCount = (rows: CopyTestExportRow[]): number => {
  /** 第一个包含正文单元格或不含锚点单元格的物理行位置。 */
  const firstBodyRowIndex = rows.findIndex(row => {
    return row.cells.length === 0 || row.cells.some(cell => !cell.header);
  });
  /** 从表格顶部开始连续出现的候选表头行数。 */
  const headerRowCount = firstBodyRowIndex < 0 ? rows.length : firstBodyRowIndex;
  /** 候选表头中是否存在跨入正文区域的纵向合并单元格。 */
  const crossesIntoBody = rows.slice(0, headerRowCount).some(row => {
    return row.cells.some(cell => cell.rowIndex + cell.rowSpan > headerRowCount);
  });
  return crossesIntoBody ? 0 : headerRowCount;
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

/** 将 AutoTable 为无文字单元格生成的单个空行恢复为空数组。 */
const normalizePdfDrawTextLines = (lines: string[]): string[] => {
  return lines.length === 1 && lines[0] === '' ? [] : lines;
};

/** 为非拉丁文字和 Emoji 创建透明背景的 Canvas 图片。 */
const createRasterTextDataUrl = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  lines: string[],
  widthInPoints: number
): string | null => {
  /** PDF 点数换算到浏览器 CSS 像素后的宽度。 */
  const widthInCssPixels = Math.max(1, Math.ceil(widthInPoints / COPY_TEST_PDF_PIXEL_TO_POINT));
  /** 当前文字行高换算后的 CSS 像素值。 */
  const lineHeightInCssPixels = getPdfTextLineHeight(doc) / COPY_TEST_PDF_PIXEL_TO_POINT;
  /** Result 状态与详情间距换算后的 CSS 像素值。 */
  const statusDetailGapInCssPixels = (
    getPdfStatusDetailGap(cell, lines) / COPY_TEST_PDF_PIXEL_TO_POINT
  );
  /** 当前完整文字块换算后的 CSS 像素高度。 */
  const textHeightInCssPixels = (
    getPdfTextHeight(doc, cell, lines) / COPY_TEST_PDF_PIXEL_TO_POINT
  );
  /** 仅用于栅格化非拉丁文字和 Emoji 的临时画布。 */
  const canvas = document.createElement('canvas');
  canvas.width = widthInCssPixels * COPY_TEST_PDF_CANVAS_SCALE;
  canvas.height = Math.max(
    1,
    Math.ceil(textHeightInCssPixels * COPY_TEST_PDF_CANVAS_SCALE)
  );
  /** 临时画布的二维绘图上下文。 */
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.scale(COPY_TEST_PDF_CANVAS_SCALE, COPY_TEST_PDF_CANVAS_SCALE);
  context.textBaseline = 'top';
  lines.forEach((line, lineIndex) => {
    /** 当前 Result 状态行使用的可选 RGB 颜色。 */
    const statusColor = getPdfStatusLineColor(cell, line);
    /** 当前文字行是否需要从右向左绘制。 */
    const rightToLeft = COPY_TEST_PDF_RTL_TEXT_PATTERN.test(line);
    /** 状态行之后需要追加的额外段落间距。 */
    const detailGap = lineIndex > 0 ? statusDetailGapInCssPixels : 0;
    context.fillStyle = statusColor
      ? `#${statusColor.map(value => value.toString(16).padStart(2, '0')).join('')}`
      : '#141414';
    context.font = getPdfRasterFont(cell.header || Boolean(statusColor));
    context.direction = rightToLeft ? 'rtl' : 'ltr';
    context.textAlign = rightToLeft ? 'right' : 'left';
    context.fillText(
      line,
      rightToLeft ? widthInCssPixels : 0,
      lineIndex * lineHeightInCssPixels + detailGap
    );
  });
  return canvas.toDataURL('image/png');
};

/** 读取自定义文字块在当前单元格中的顶部坐标。 */
const getPdfTextBlockTop = (
  data: CellHookData,
  textHeight: number
): number => {
  /** 当前单元格扣除上下 padding 后的内容高度。 */
  const availableHeight = data.cell.height - data.cell.padding('vertical');
  if (data.cell.styles.valign === 'bottom') {
    return data.cell.y + data.cell.height
      - data.cell.padding('bottom')
      - textHeight;
  }
  if (data.cell.styles.valign === 'middle') {
    return data.cell.y
      + data.cell.padding('top')
      + Math.max(0, (availableHeight - textHeight) / 2);
  }
  return data.cell.y + data.cell.padding('top');
};

/** 在 AutoTable 单元格中绘制已栅格化的非拉丁文字和 Emoji。 */
const drawRasterText = (
  doc: jsPDF,
  data: CellHookData,
  cell: CopyTestExportCell,
  lines: string[]
): void => {
  /** 当前栅格文字块在 PDF 中使用的准确点数高度。 */
  const textHeight = getPdfTextHeight(doc, cell, lines);
  /** 当前单元格文本区域栅格化后的 PNG data URL。 */
  const textDataUrl = createRasterTextDataUrl(
    doc,
    cell,
    lines,
    Math.max(1, data.cell.width - COPY_TEST_PDF_CELL_PADDING * 2)
  );
  if (!textDataUrl) {
    return;
  }
  doc.addImage(
    textDataUrl,
    'PNG',
    data.cell.x + COPY_TEST_PDF_CELL_PADDING,
    getPdfTextBlockTop(data, textHeight),
    Math.max(1, data.cell.width - COPY_TEST_PDF_CELL_PADDING * 2),
    textHeight,
    undefined,
    'FAST'
  );
};

/** 绘制 Result 中由状态、Screen 和失败原因组成的完整文字块。 */
const drawPdfResultText = (
  doc: jsPDF,
  data: CellHookData,
  cell: CopyTestExportCell,
  lines: string[]
): void => {
  if (!hasPdfStatusLine(cell) || lines.length === 0) {
    return;
  }
  /** 当前完整 Result 文字块的点数高度。 */
  const textHeight = getPdfTextHeight(doc, cell, lines);
  /** 当前 Result 文字块的顶部绘制坐标。 */
  const textTop = getPdfTextBlockTop(data, textHeight);
  /** 当前 Result 每一行使用的准确点数行高。 */
  const lineHeight = getPdfTextLineHeight(doc);
  /** 状态行和 Screen 或失败原因之间的段落间距。 */
  const statusDetailGap = getPdfStatusDetailGap(cell, lines);
  /** 当前 Result 文字块的左侧绘制坐标。 */
  const textX = data.cell.x + data.cell.padding('left');
  doc.setFontSize(data.cell.styles.fontSize);
  lines.forEach((line, lineIndex) => {
    /** 当前行若为状态标签则使用对应的 Passed 或 Failed 颜色。 */
    const statusColor = getPdfStatusLineColor(cell, line);
    /** 当前 Screen、失败原因或状态行的纵向坐标。 */
    const lineY = textTop
      + lineIndex * lineHeight
      + (lineIndex > 0 ? statusDetailGap : 0);
    doc.setFont('helvetica', statusColor ? 'bold' : 'normal');
    if (statusColor) {
      doc.setTextColor(...statusColor);
    } else {
      doc.setTextColor(20, 20, 20);
    }
    doc.text(line, textX, lineY, { baseline: 'top' });
  });
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
    + getPdfTextHeight(doc, cell, textLines)
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

/** 计算已经稳定换行并选择图片后的 PDF 单元格高度。 */
const getPdfCellContentHeight = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  textLines: string[],
  images: CopyTestExportCellImage[],
  cellWidth: number
): number => {
  /** 仅包含当前分页片段内容的中立单元格。 */
  const contentCell = {
    ...cell,
    images,
    text: textLines.join('\n'),
  };
  /** 扣除左右 padding 后供 Evidence 图片使用的宽度。 */
  const availableImageWidth = Math.max(
    1,
    cellWidth - COPY_TEST_PDF_CELL_PADDING * 2
  );
  /** 当前单元格全部可绘制图片及间距的自然高度。 */
  const imageHeight = getPdfImageContentHeight(contentCell, availableImageWidth);
  /** 文字和第一张图片之间需要保留的额外间距。 */
  const textImageGap = textLines.length > 0 && imageHeight > 0
    ? COPY_TEST_PDF_CELL_PADDING
    : 0;
  return Math.max(
    18,
    COPY_TEST_PDF_CELL_PADDING * 2
      + getPdfTextHeight(doc, contentCell, textLines)
      + textImageGap
      + imageHeight
  );
};

/** 计算单元格完整文字和图片在 PDF 布局中的自然高度。 */
const getPdfNaturalCellHeight = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth: number
): number => {
  /** 按当前单元格准确宽度换行后的文字行。 */
  const textLines = getPdfWrappedTextLines(doc, cell, cellWidth);
  return getPdfCellContentHeight(doc, cell, textLines, cell.images, cellWidth);
};

/** 判断当前 PDF 单元格分页片段是否已经包含内容。 */
const hasPdfCellFragmentContent = (fragment: CopyTestPdfCellFragment): boolean => {
  return fragment.textLines.length > 0 || fragment.images.length > 0;
};

/** 读取正在填充的最后一个 PDF 单元格分页片段。 */
const getLastPdfCellFragment = (
  fragments: CopyTestPdfCellFragment[]
): CopyTestPdfCellFragment => {
  return fragments[fragments.length - 1];
};

/** 按页面正文容量把稳定换行文字依次加入 continuation cell。 */
const appendPdfTextFragments = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth: number,
  maximumHeight: number,
  textLines: string[],
  fragments: CopyTestPdfCellFragment[]
): void => {
  textLines.forEach(line => {
    /** 当前正在填充的分页片段。 */
    let fragment = getLastPdfCellFragment(fragments);
    /** 追加当前文字行后的候选片段高度。 */
    const candidateLines = [...fragment.textLines, line];
    const candidateHeight = getPdfCellContentHeight(
      doc,
      cell,
      candidateLines,
      fragment.images,
      cellWidth
    );
    if (hasPdfCellFragmentContent(fragment) && candidateHeight > maximumHeight) {
      fragment = { images: [], textLines: [] };
      fragments.push(fragment);
    }
    fragment.textLines.push(line);
  });
};

/** 按页面正文容量把 Evidence 图片依次加入 continuation cell。 */
const appendPdfImageFragments = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth: number,
  maximumHeight: number,
  images: CopyTestExportCellImage[],
  fragments: CopyTestPdfCellFragment[]
): void => {
  images.forEach(image => {
    /** 当前正在填充的分页片段。 */
    let fragment = getLastPdfCellFragment(fragments);
    /** 追加当前图片后的候选片段高度。 */
    const candidateImages = [...fragment.images, image];
    const candidateHeight = getPdfCellContentHeight(
      doc,
      cell,
      fragment.textLines,
      candidateImages,
      cellWidth
    );
    if (hasPdfCellFragmentContent(fragment) && candidateHeight > maximumHeight) {
      fragment = { images: [], textLines: [] };
      fragments.push(fragment);
    }
    fragment.images.push(image);
  });
};

/** 把一个超高单元格拆为若干可以完整放入页面正文的 cell。 */
const splitPdfCellIntoPageFragments = (
  doc: jsPDF,
  cell: CopyTestExportCell,
  cellWidth: number,
  maximumHeight: number
): CopyTestExportCell[] => {
  if (getPdfNaturalCellHeight(doc, cell, cellWidth) <= maximumHeight) {
    return [cell];
  }
  /** 当前单元格按目标宽度得到的完整稳定文字行。 */
  const textLines = getPdfWrappedTextLines(doc, cell, cellWidth);
  /** 当前单元格中可以实际写入 PDF 的全部图片。 */
  const drawableImages = cell.images.filter(isDrawablePdfImage);
  /** 按文字在前、图片在后的原有绘制顺序生成的分页片段。 */
  const fragments: CopyTestPdfCellFragment[] = [{ images: [], textLines: [] }];
  appendPdfTextFragments(
    doc,
    cell,
    cellWidth,
    maximumHeight,
    textLines,
    fragments
  );
  appendPdfImageFragments(
    doc,
    cell,
    cellWidth,
    maximumHeight,
    drawableImages,
    fragments
  );
  return fragments.map(fragment => ({
    ...cell,
    images: fragment.images,
    rowSpan: 1,
    text: fragment.textLines.join('\n'),
  }));
};

/** 为已在前一个 continuation row 消费完成的单元格创建占位。 */
const createEmptyPdfCellFragment = (
  cell: CopyTestExportCell
): CopyTestExportCell => {
  return {
    ...cell,
    images: [],
    rowSpan: 1,
    text: '',
  };
};

/** 展开多页正文的全部 rowspan，并在每个被覆盖行补齐逻辑列占位。 */
const expandPdfBodyRowSpans = (
  rows: CopyTestExportRow[]
): CopyTestExportRow[] => {
  /** 所有原始正文单元格都先降级为单行锚点。 */
  const expandedRows = rows.map(row => ({
    ...row,
    cells: row.cells.map(cell => ({ ...cell, rowSpan: 1 })),
  }));
  rows.forEach((row, rowPosition) => {
    row.cells.forEach(cell => {
      for (let offset = 1; offset < cell.rowSpan; offset += 1) {
        /** 当前 rowspan 覆盖且需要补入空单元格的正文行。 */
        const coveredRow = expandedRows[rowPosition + offset];
        if (coveredRow) {
          coveredRow.cells.push({
            ...cell,
            images: [],
            rowIndex: coveredRow.index,
            rowSpan: 1,
            text: '',
          });
        }
      }
    });
  });
  expandedRows.forEach(row => {
    row.cells.sort((left, right) => left.columnIndex - right.columnIndex);
  });
  return expandedRows;
};

/** 把一个超高物理行拆为列对齐的若干 continuation rows。 */
const splitPdfRowIntoPageFragments = (
  doc: jsPDF,
  row: CopyTestExportRow,
  columnWidths: number[],
  maximumHeight: number
): CopyTestExportRow[] => {
  /** 当前行每个单元格各自按页面容量拆出的片段。 */
  const cellFragments = row.cells.map(cell => {
    return splitPdfCellIntoPageFragments(
      doc,
      cell,
      getPdfCellWidth(columnWidths, cell),
      maximumHeight
    );
  });
  /** 当前行全部列所需的最大 continuation row 数量。 */
  const fragmentCount = Math.max(1, ...cellFragments.map(fragments => fragments.length));
  if (fragmentCount === 1) {
    return [row];
  }
  return Array.from({ length: fragmentCount }, (_, fragmentIndex) => ({
    cells: row.cells.map((cell, cellIndex) => {
      return cellFragments[cellIndex][fragmentIndex]
        || createEmptyPdfCellFragment(cell);
    }),
    index: row.index,
  }));
};

/** 为 PDF 专用合成正文行重新分配不会冲突的稳定行下标。 */
const reindexPdfBodyRows = (
  rows: CopyTestExportRow[],
  startingRowIndex: number
): CopyTestExportRow[] => {
  return rows.map((row, rowOffset) => {
    /** 当前合成正文行在最终 PDF 表格中的唯一行下标。 */
    const rowIndex = startingRowIndex + rowOffset;
    return {
      cells: row.cells.map(cell => ({ ...cell, rowIndex })),
      index: rowIndex,
    };
  });
};

/** 校验表格自然宽度不会超过 PDF 安全边长。 */
const assertPdfPageWidth = (width: number): void => {
  if (width > COPY_TEST_PDF_MAX_PAGE_DIMENSION) {
    throw new Error('The selected table has too many columns for PDF export');
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

/** 使用指定表头和正文行构建统一的 AutoTable 配置。 */
const buildPdfTableOptionsFromRows = (
  model: CopyTestExportTableModel,
  tableRows: CopyTestPdfTableRows
): UserOptions => {
  return {
    body: tableRows.body,
    columnStyles: buildPdfColumnStyles(model),
    head: tableRows.head,
    headStyles: { fillColor: COPY_TEST_PDF_HEADER_FILL },
    horizontalPageBreak: false,
    margin: COPY_TEST_PDF_PAGE_MARGIN,
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    showHead: tableRows.hasHeaderRow ? 'everyPage' : 'never',
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

/** 读取固定页面扣除重复表头、边距和舍入余量后的正文容量。 */
const getPdfBodyPageHeight = (
  doc: jsPDF,
  measuredTable: ReturnType<typeof __createTable>
): number => {
  /** 每一页顶部需要重复绘制的完整表头高度。 */
  const headerHeight = measuredTable.getHeadHeight(measuredTable.columns);
  return Math.max(
    18,
    doc.internal.pageSize.getHeight()
      - COPY_TEST_PDF_PAGE_MARGIN * 2
      - headerHeight
      - COPY_TEST_PDF_LAYOUT_HEIGHT_ALLOWANCE
  );
};

/** 判断当前完整正文是否需要使用两个或更多 PDF 页面。 */
const doesPdfBodyRequireMultiplePages = (
  measuredTable: ReturnType<typeof __createTable>,
  bodyPageHeight: number
): boolean => {
  /** AutoTable 计算出的全部正文物理行总高度。 */
  const bodyHeight = measuredTable.body.reduce((height, row) => {
    return height + row.height;
  }, 0);
  return bodyHeight > bodyPageHeight;
};

/** 创建不含超页 rowspan 或超高单行的 PDF 专用正文。 */
const buildPaginatedPdfBodyRows = (
  doc: jsPDF,
  sourceRows: CopyTestExportRow[],
  columnWidths: number[],
  bodyPageHeight: number,
  startingRowIndex: number
): CopyTestExportRow[] => {
  /** 多页正文中的 rowspan 全部展开后具有完整逻辑列占位的行。 */
  const expandedRows = expandPdfBodyRowSpans(sourceRows);
  /** 每个超高物理行拆分后得到的完整 continuation rows。 */
  const fragmentedRows = expandedRows.flatMap(row => {
    return splitPdfRowIntoPageFragments(
      doc,
      row,
      columnWidths,
      bodyPageHeight
    );
  });
  return reindexPdfBodyRows(fragmentedRows, startingRowIndex);
};

/** 将完整中立模型拆分为 AutoTable 的重复表头和全部正文行。 */
export const buildCopyTestPdfTableRows = (
  model: CopyTestExportTableModel,
  doc?: jsPDF
): CopyTestPdfTableRows => {
  /** 可以安全地从正文中拆出的连续 AutoTable 表头行数。 */
  const headerRowCount = getPdfHeaderRowCount(model.rows);
  /** 当前 PDF 文档中每个逻辑列的准确点数宽度。 */
  const columnWidths = doc ? getPdfColumnWidths(model) : undefined;
  /** 当前表格中可以在每页重复绘制的原始表头行。 */
  const headerRows = model.rows.slice(0, headerRowCount);
  /** 当前表格的原始正文物理行。 */
  const bodyRows = model.rows.slice(headerRowCount);
  /** 未进行多页降级前的原始 AutoTable 行。 */
  const originalTableRows: CopyTestPdfTableRows = {
    body: bodyRows.map(row => {
      return createPdfRow(row, doc, columnWidths);
    }),
    hasHeaderRow: headerRowCount > 0,
    head: headerRows.map(row => {
      return createPdfRow(row, doc, columnWidths);
    }),
  };
  if (!doc || !columnWidths) {
    return originalTableRows;
  }
  /** 使用原始合并布局得到的精确表头和正文行高。 */
  const measuredTable = __createTable(
    doc,
    buildPdfTableOptionsFromRows(model, originalTableRows)
  );
  /** 固定页面中每一页可以安全使用的正文高度。 */
  const bodyPageHeight = getPdfBodyPageHeight(doc, measuredTable);
  if (!doesPdfBodyRequireMultiplePages(measuredTable, bodyPageHeight)) {
    return originalTableRows;
  }
  /** 多页正文展开合并并拆分超高内容后的 PDF 专用行。 */
  const paginatedBodyRows = buildPaginatedPdfBodyRows(
    doc,
    bodyRows,
    columnWidths,
    bodyPageHeight,
    headerRowCount
  );
  return {
    body: paginatedBodyRows.map(row => createPdfRow(row, doc, columnWidths)),
    hasHeaderRow: originalTableRows.hasHeaderRow,
    head: originalTableRows.head,
  };
};

/** 构建测量和最终绘制共用的 AutoTable 布局配置。 */
const buildPdfTableLayoutOptions = (
  model: CopyTestExportTableModel,
  doc: jsPDF
): UserOptions => {
  /** 完整表格拆分后的 AutoTable 表头和正文行。 */
  const tableRows = buildCopyTestPdfTableRows(model, doc);
  return buildPdfTableOptionsFromRows(model, tableRows);
};

/** 根据自然列宽构建固定 A4 高度的纵向分页 PDF 页面。 */
export const buildCopyTestPdfPageLayout = (
  model: CopyTestExportTableModel
): CopyTestPdfPageLayout => {
  /** 完整表格加左右页边距后的自然页面宽度。 */
  const width = getPdfColumnWidths(model).reduce(
    (totalWidth, columnWidth) => totalWidth + columnWidth,
    COPY_TEST_PDF_PAGE_MARGIN * 2
  );
  /** 所有纵向内容都通过 continuation rows 在固定 A4 高度内分页。 */
  const height = COPY_TEST_PDF_DEFAULT_PAGE_HEIGHT;
  assertPdfPageWidth(width);
  return {
    height,
    orientation: width >= height ? 'landscape' : 'portrait',
    width,
  };
};

/** 使用中立模型创建 PDF Blob。 */
export const createCopyTestPdfBlob = (model: CopyTestExportTableModel): Blob => {
  /** 根据自然列宽和固定 A4 高度计算出的多页 PDF 画布。 */
  const pageLayout = buildCopyTestPdfPageLayout(model);
  /** 使用自然列宽和固定页高创建的可纵向分页 PDF 文档。 */
  const doc = new jsPDF({
    compress: true,
    format: [pageLayout.width, pageLayout.height],
    orientation: pageLayout.orientation,
    unit: 'pt',
  });
  doc.setLineHeightFactor(COPY_TEST_PDF_LINE_HEIGHT_FACTOR);
  /** 需要自定义绘制的 Result 或多语言单元格换行文本。 */
  const customTextLines = new WeakMap<object, string[]>();
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
      const cellKey = getPdfCellKey(cell);
      /** 当前单元格在绘制前保存或 AutoTable 保留的完整换行文本。 */
      const textLines = normalizePdfDrawTextLines(
        customTextLines.get(data.cell) || data.cell.text
      );
      if (customTextLines.has(data.cell)) {
        if (shouldRasterPdfText(textLines.join('\n'))) {
          drawRasterText(doc, data, cell, textLines);
        } else {
          drawPdfResultText(doc, data, cell, textLines);
        }
      }
      /** 当前分页片段对应的稳定中立单元格键。 */
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
      if (!cell) {
        return;
      }
      /** Result 或多语言单元格是否需要避开 AutoTable 默认字体绘制。 */
      const customDraw = hasPdfStatusLine(cell)
        || shouldRasterPdfText(data.cell.text.join('\n'));
      if (!customDraw) {
        return;
      }
      /** 当前分页片段绘制时保存的完整稳定换行文本。 */
      customTextLines.set(data.cell, [...data.cell.text]);
      data.cell.text = [];
    },
  });
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
