/**
 * 文件作用：使用 fflate 将 CopyTest 中立表格模型直接打包为标准 Word OOXML 文件。
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
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
} from './copyTestExportConstants';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportCellKind,
  CopyTestExportTableModel,
} from './copyTestExportTypes';

/** Word 文档 XML 在 DOCX 压缩包中的路径。 */
const COPY_TEST_WORD_DOCUMENT_PATH = 'word/document.xml';

/** Word 文档关系 XML 在 DOCX 压缩包中的路径。 */
const COPY_TEST_WORD_DOCUMENT_RELATIONSHIPS_PATH = 'word/_rels/document.xml.rels';

/** DOCX 根关系 XML 在压缩包中的路径。 */
const COPY_TEST_WORD_ROOT_RELATIONSHIPS_PATH = '_rels/.rels';

/** OOXML Content Types 文件在 DOCX 压缩包中的路径。 */
const COPY_TEST_WORD_CONTENT_TYPES_PATH = '[Content_Types].xml';

/** WordprocessingML 主命名空间。 */
const COPY_TEST_WORD_MAIN_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Office 文档关系命名空间。 */
const COPY_TEST_WORD_OFFICE_RELATIONSHIPS_NAMESPACE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** OOXML 包关系命名空间。 */
const COPY_TEST_WORD_PACKAGE_RELATIONSHIPS_NAMESPACE =
  'http://schemas.openxmlformats.org/package/2006/relationships';

/** DrawingML 主命名空间。 */
const COPY_TEST_WORD_DRAWING_NAMESPACE =
  'http://schemas.openxmlformats.org/drawingml/2006/main';

/** DrawingML 图片命名空间。 */
const COPY_TEST_WORD_PICTURE_NAMESPACE =
  'http://schemas.openxmlformats.org/drawingml/2006/picture';

/** Wordprocessing Drawing 命名空间。 */
const COPY_TEST_WORD_DRAWING_WORDPROCESSING_NAMESPACE =
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';

/** Word 文档到图片 Part 使用的关系类型。 */
const COPY_TEST_WORD_IMAGE_RELATIONSHIP_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/** DOCX 根关系到 Word 主文档使用的关系类型。 */
const COPY_TEST_WORD_DOCUMENT_RELATIONSHIP_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

/** Word 主文档 Part 使用的 Content Type。 */
const COPY_TEST_WORD_DOCUMENT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

/** XML 文件头。 */
const COPY_TEST_WORD_XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Word 表头单元格使用的浅灰色背景。 */
const COPY_TEST_WORD_HEADER_FILL = 'EDEFF2';

/** Word 表格边框使用的颜色。 */
const COPY_TEST_WORD_BORDER_COLOR = 'BFC6D2';

/** Word 文档横向 A4 页面宽度，单位为 twip。 */
const COPY_TEST_WORD_PAGE_WIDTH = 16_838;

/** Word 文档横向 A4 页面高度，单位为 twip。 */
const COPY_TEST_WORD_PAGE_HEIGHT = 11_906;

/** Word 文档四边页距，单位为 twip。 */
const COPY_TEST_WORD_PAGE_MARGIN = 360;

/** Word 表格在页面页距内可使用的总宽度，单位为 twip。 */
const COPY_TEST_WORD_TABLE_WIDTH =
  COPY_TEST_WORD_PAGE_WIDTH - COPY_TEST_WORD_PAGE_MARGIN * 2;

/** Word 正文字号，单位为半磅。 */
const COPY_TEST_WORD_FONT_SIZE = 20;

/** Word 拉丁文字使用的字体。 */
const COPY_TEST_WORD_FONT_FAMILY = 'Arial Unicode MS';

/** Word 东亚文字使用的字体。 */
const COPY_TEST_WORD_EAST_ASIA_FONT = 'Arial Unicode MS';

/** 一个 CSS 像素对应的 Office EMU 数值。 */
const COPY_TEST_WORD_EMU_PER_PIXEL = 9_525;

/** Word 无法嵌入图片时使用的说明前缀。 */
const COPY_TEST_WORD_UNSUPPORTED_IMAGE_PREFIX = 'Image unavailable in Word:';

/** 中立模型包含非法合并布局时使用的错误信息。 */
const COPY_TEST_WORD_INVALID_LAYOUT_ERROR =
  'The selected table contains an invalid merged-cell layout';

/** XML 内容中需要按顺序执行的字符转义映射。 */
const COPY_TEST_WORD_XML_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['&', '&amp;'],
  ['"', '&quot;'],
  ['\'', '&apos;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
];

/** Word 可以直接嵌入的图片扩展名。 */
type CopyTestWordImageExtension = 'bmp' | 'gif' | 'jpg' | 'png';

/** Word 图片 MIME 子类型对应的 OOXML 文件信息。 */
interface CopyTestWordImageFormat {
  /** 图片在 word/media 中使用的扩展名。 */
  extension: CopyTestWordImageExtension;
  /** 图片在 Content Types 中使用的 MIME 类型。 */
  mimeType: string;
}

/** data URL 解码后的 Word 图片数据。 */
interface CopyTestWordDecodedImage extends CopyTestWordImageFormat {
  /** 图片解码后的原始二进制。 */
  content: Uint8Array;
}

/** Word OOXML 中一张待嵌入图片的完整数据。 */
interface CopyTestWordImagePart extends CopyTestWordDecodedImage {
  /** 图片在 Word 中使用的可读说明。 */
  description: string;
  /** 图片在 Word 中显示的 EMU 高度。 */
  height: number;
  /** 图片关系、Drawing 和 media 文件使用的一基序号。 */
  index: number;
  /** 图片在 Word 中显示的 EMU 宽度。 */
  width: number;
}

/** 构建 Word 主文档时累积的资源上下文。 */
interface CopyTestWordBuildContext {
  /** 当前文档按表格顺序收集到的图片 Part。 */
  imageParts: CopyTestWordImagePart[];
}

/** Word 表格中每个逻辑位置对应的左上角锚点单元格。 */
type CopyTestWordOwnerMatrix = Array<Array<CopyTestExportCell | null>>;

/** Word 支持的图片 MIME 子类型映射。 */
const COPY_TEST_WORD_IMAGE_FORMATS = new Map<string, CopyTestWordImageFormat>([
  ['bmp', { extension: 'bmp', mimeType: 'image/bmp' }],
  ['gif', { extension: 'gif', mimeType: 'image/gif' }],
  ['jpeg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['jpg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: 'png', mimeType: 'image/png' }],
]);

/** 判断一个 Unicode 字符是否允许出现在 XML 1.0 文档中。 */
const isValidXmlCharacter = (character: string): boolean => {
  /** 当前 Unicode 字符的码点。 */
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint === 0x09
    || codePoint === 0x0a
    || codePoint === 0x0d
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
};

/** 过滤非法 XML 字符并转义文本或属性值。 */
const escapeWordXml = (value: string): string => {
  /** 已过滤 XML 1.0 非法控制字符的文本。 */
  let escapedValue = Array.from(value).filter(isValidXmlCharacter).join('');
  COPY_TEST_WORD_XML_REPLACEMENTS.forEach(([source, replacement]) => {
    escapedValue = escapedValue.split(source).join(replacement);
  });
  return escapedValue;
};

/** 将 base64 字符串解码为原始二进制。 */
const decodeWordBase64 = (base64: string): Uint8Array | null => {
  try {
    /** 浏览器原生 atob 解码后的二进制字符串。 */
    const binary = globalThis.atob(base64);
    if (!binary) {
      return null;
    }
    /** 与二进制字符串等长的无符号字节数组。 */
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};

/** 解析一张可由 Word 直接嵌入的图片 data URL。 */
const decodeWordImageDataUrl = (
  dataUrl: string | undefined
): CopyTestWordDecodedImage | null => {
  if (!dataUrl) {
    return null;
  }
  /** data URL 中的 MIME 子类型和 base64 内容。 */
  const match = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  /** 当前 MIME 子类型对应的 Word 图片格式。 */
  const format = COPY_TEST_WORD_IMAGE_FORMATS.get(match[1].toLowerCase());
  /** 去除可选空白后解码出的图片二进制。 */
  const content = format
    ? decodeWordBase64(match[2].split(/\s+/u).join(''))
    : null;
  return format && content ? { ...format, content } : null;
};

/** 按最大展示区域等比缩放一张 Word Evidence 图片。 */
const getWordImageDisplaySize = (
  image: CopyTestExportCellImage
): { height: number; width: number } => {
  /** 图片模型中可参与缩放计算的安全宽度。 */
  const sourceWidth = Number.isFinite(image.width) && image.width > 0 ? image.width : 1;
  /** 图片模型中可参与缩放计算的安全高度。 */
  const sourceHeight = Number.isFinite(image.height) && image.height > 0 ? image.height : 1;
  /** 将原图限制在 Word 单元格范围内的缩放比例。 */
  const scale = Math.min(
    1,
    COPY_TEST_EXPORT_IMAGE_MAX_WIDTH / sourceWidth,
    COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT / sourceHeight
  );
  return {
    height: Math.max(1, Math.round(sourceHeight * scale * COPY_TEST_WORD_EMU_PER_PIXEL)),
    width: Math.max(1, Math.round(sourceWidth * scale * COPY_TEST_WORD_EMU_PER_PIXEL)),
  };
};

/** 根据 Result 文本行读取 Word 字体颜色。 */
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

/** 构建一个 Word 文本 Run 的直接格式。 */
const buildWordRunPropertiesXml = (
  bold: boolean,
  color: string | undefined
): string => {
  /** 当前文字可选的粗体设置。 */
  const boldXml = bold ? '<w:b/><w:bCs/>' : '';
  /** 当前文字可选的状态颜色设置。 */
  const colorXml = color ? `<w:color w:val="${color}"/>` : '';
  return [
    '<w:rPr>',
    `<w:rFonts w:ascii="${COPY_TEST_WORD_FONT_FAMILY}"`,
    ` w:hAnsi="${COPY_TEST_WORD_FONT_FAMILY}"`,
    ` w:eastAsia="${COPY_TEST_WORD_EAST_ASIA_FONT}" w:hint="eastAsia"/>`,
    boldXml,
    colorXml,
    `<w:sz w:val="${COPY_TEST_WORD_FONT_SIZE}"/>`,
    `<w:szCs w:val="${COPY_TEST_WORD_FONT_SIZE}"/>`,
    '<w:lang w:val="en-US" w:eastAsia="zh-CN"/>',
    '</w:rPr>',
  ].join('');
};

/** 将一行单元格文本转换为 Word 段落 XML。 */
const buildWordTextParagraphXml = (
  cell: CopyTestExportCell,
  text: string
): string => {
  /** 当前文本行的 Passed 或 Failed 状态色。 */
  const color = getWordTextColor(cell, text);
  /** 表头或状态标签使用的粗体设置。 */
  const bold = cell.header || Boolean(color);
  return [
    '<w:p>',
    '<w:pPr><w:spacing w:after="60"/></w:pPr>',
    '<w:r>',
    buildWordRunPropertiesXml(bold, color),
    `<w:t xml:space="preserve">${escapeWordXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>',
  ].join('');
};

/** 将图片像素尺寸和二进制注册为 Word media Part。 */
const registerWordImagePart = (
  image: CopyTestExportCellImage,
  decodedImage: CopyTestWordDecodedImage,
  context: CopyTestWordBuildContext
): CopyTestWordImagePart => {
  /** 当前图片在 Word 中等比缩放后的 EMU 尺寸。 */
  const displaySize = getWordImageDisplaySize(image);
  /** 当前图片在文档资源中的一基序号。 */
  const index = context.imageParts.length + 1;
  /** 当前图片写入 Word 文档和关系文件所需的完整数据。 */
  const imagePart: CopyTestWordImagePart = {
    ...decodedImage,
    description: `${image.label} - ${image.fileName}`,
    height: displaySize.height,
    index,
    width: displaySize.width,
  };
  context.imageParts.push(imagePart);
  return imagePart;
};

/** 将一张已注册的 Evidence 图片转换为 DrawingML 段落。 */
const buildWordDrawingParagraphXml = (
  imagePart: CopyTestWordImagePart
): string => {
  /** 当前 Drawing 在文档关系文件中的关系 ID。 */
  const relationshipId = `rIdImage${imagePart.index}`;
  /** 当前图片用于 Word 无障碍信息的转义说明。 */
  const description = escapeWordXml(imagePart.description);
  /** 当前图片在 DrawingML 中使用的稳定名称。 */
  const drawingName = `Picture ${imagePart.index}`;
  return [
    '<w:p>',
    '<w:pPr><w:spacing w:after="100"/></w:pPr>',
    '<w:r><w:drawing>',
    '<wp:inline distT="0" distB="0" distL="0" distR="0">',
    `<wp:extent cx="${imagePart.width}" cy="${imagePart.height}"/>`,
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    `<wp:docPr id="${imagePart.index}" name="${drawingName}" descr="${description}"/>`,
    '<wp:cNvGraphicFramePr>',
    '<a:graphicFrameLocks noChangeAspect="1"/>',
    '</wp:cNvGraphicFramePr>',
    '<a:graphic>',
    `<a:graphicData uri="${COPY_TEST_WORD_PICTURE_NAMESPACE}">`,
    '<pic:pic>',
    '<pic:nvPicPr>',
    `<pic:cNvPr id="0" name="${drawingName}" descr="${description}"/>`,
    '<pic:cNvPicPr/>',
    '</pic:nvPicPr>',
    '<pic:blipFill>',
    `<a:blip r:embed="${relationshipId}"/>`,
    '<a:stretch><a:fillRect/></a:stretch>',
    '</pic:blipFill>',
    '<pic:spPr>',
    '<a:xfrm>',
    '<a:off x="0" y="0"/>',
    `<a:ext cx="${imagePart.width}" cy="${imagePart.height}"/>`,
    '</a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '</pic:spPr>',
    '</pic:pic>',
    '</a:graphicData>',
    '</a:graphic>',
    '</wp:inline>',
    '</w:drawing></w:r>',
    '</w:p>',
  ].join('');
};

/** 为 Word 无法嵌入的图片生成可追溯降级文本。 */
const buildWordUnavailableImageParagraphXml = (
  image: CopyTestExportCellImage
): string => {
  /** 当前不可用图片对应的降级说明。 */
  const text = `${COPY_TEST_WORD_UNSUPPORTED_IMAGE_PREFIX} ${image.fileName}`;
  return [
    '<w:p>',
    '<w:pPr><w:spacing w:after="60"/></w:pPr>',
    '<w:r>',
    buildWordRunPropertiesXml(false, undefined),
    `<w:t xml:space="preserve">${escapeWordXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>',
  ].join('');
};

/** 将一张 Evidence 图片转换为图片或降级文本段落。 */
const buildWordImageParagraphXml = (
  image: CopyTestExportCellImage,
  context: CopyTestWordBuildContext
): string => {
  /** 当前图片 data URL 解码后的 Word 资源。 */
  const decodedImage = decodeWordImageDataUrl(image.dataUrl);
  if (!decodedImage) {
    return buildWordUnavailableImageParagraphXml(image);
  }
  /** 当前图片注册后得到的 Word media Part。 */
  const imagePart = registerWordImagePart(image, decodedImage, context);
  return buildWordDrawingParagraphXml(imagePart);
};

/** 构建一个锚点单元格中的完整文本和图片内容。 */
const buildWordCellContentXml = (
  cell: CopyTestExportCell,
  context: CopyTestWordBuildContext
): string => {
  /** 当前单元格按原始换行拆分出的非空文本段落。 */
  const textParagraphs = cell.text
    .split('\n')
    .filter(Boolean)
    .map(text => buildWordTextParagraphXml(cell, text));
  /** 当前单元格按 DOM 顺序生成的 Evidence 图片段落。 */
  const imageParagraphs = cell.images.map(image => {
    return buildWordImageParagraphXml(image, context);
  });
  /** 当前单元格全部可见内容。 */
  const content = [...textParagraphs, ...imageParagraphs].join('');
  return content || '<w:p/>';
};

/** 判断一个单元格的合并范围是否位于当前模型内。 */
const isValidWordCellSpan = (
  cell: CopyTestExportCell,
  model: CopyTestExportTableModel
): boolean => {
  return Number.isInteger(cell.rowIndex)
    && Number.isInteger(cell.columnIndex)
    && Number.isInteger(cell.rowSpan)
    && Number.isInteger(cell.colSpan)
    && cell.rowIndex >= 0
    && cell.columnIndex >= 0
    && cell.rowSpan > 0
    && cell.colSpan > 0
    && cell.rowIndex + cell.rowSpan <= model.rowCount
    && cell.columnIndex + cell.colSpan <= model.columnCount;
};

/** 将一个锚点单元格占用的全部逻辑位置登记到 owner 矩阵。 */
const occupyWordOwnerMatrix = (
  matrix: CopyTestWordOwnerMatrix,
  cell: CopyTestExportCell
): void => {
  for (let rowIndex = cell.rowIndex; rowIndex < cell.rowIndex + cell.rowSpan; rowIndex += 1) {
    for (
      let columnIndex = cell.columnIndex;
      columnIndex < cell.columnIndex + cell.colSpan;
      columnIndex += 1
    ) {
      if (matrix[rowIndex][columnIndex]) {
        throw new Error(COPY_TEST_WORD_INVALID_LAYOUT_ERROR);
      }
      matrix[rowIndex][columnIndex] = cell;
    }
  }
};

/** 根据 anchor-only 中立模型构建完整 Word owner 矩阵。 */
const buildWordOwnerMatrix = (
  model: CopyTestExportTableModel
): CopyTestWordOwnerMatrix => {
  if (model.rowCount <= 0 || model.columnCount <= 0) {
    throw new Error(COPY_TEST_WORD_INVALID_LAYOUT_ERROR);
  }
  /** 按物理行数和逻辑列数初始化的 owner 矩阵。 */
  const matrix: CopyTestWordOwnerMatrix = Array.from(
    { length: model.rowCount },
    () => Array.from({ length: model.columnCount }, () => null)
  );
  model.rows.forEach(row => {
    row.cells.forEach(cell => {
      if (!isValidWordCellSpan(cell, model)) {
        throw new Error(COPY_TEST_WORD_INVALID_LAYOUT_ERROR);
      }
      occupyWordOwnerMatrix(matrix, cell);
    });
  });
  return matrix;
};

/** 读取覆盖指定逻辑列的第一个生成列类型。 */
const getWordColumnKind = (
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

/** 将逻辑列类型转换为 Word 列宽权重。 */
const getWordColumnWidthWeight = (kind: CopyTestExportCellKind): number => {
  if (kind === 'result') {
    return COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH;
  }
  if (kind === 'evidence') {
    return COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH;
  }
  return COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH;
};

/** 将像素列宽权重归一为页面内固定 Word twip 列宽。 */
const buildWordColumnWidths = (
  model: CopyTestExportTableModel
): number[] => {
  /** 每个逻辑列按业务类型得到的宽度权重。 */
  const weights = Array.from({ length: model.columnCount }, (_, columnIndex) => {
    return getWordColumnWidthWeight(getWordColumnKind(model, columnIndex));
  });
  /** 全部逻辑列的宽度权重总和。 */
  const totalWeight = weights.reduce((sum, width) => sum + width, 0);
  /** 已分配给前置逻辑列的 Word twip 宽度。 */
  let allocatedWidth = 0;
  return weights.map((weight, columnIndex) => {
    if (columnIndex === weights.length - 1) {
      return COPY_TEST_WORD_TABLE_WIDTH - allocatedWidth;
    }
    /** 当前逻辑列按比例换算后的 Word twip 宽度。 */
    const width = Math.floor(COPY_TEST_WORD_TABLE_WIDTH * weight / totalWeight);
    allocatedWidth += width;
    return width;
  });
};

/** 计算一个单元格覆盖的全部逻辑列宽度。 */
const getWordCellWidth = (
  columnWidths: number[],
  columnIndex: number,
  colSpan: number
): number => {
  return columnWidths
    .slice(columnIndex, columnIndex + colSpan)
    .reduce((sum, width) => sum + width, 0);
};

/** 构建 Word 单元格的宽度、合并、表头和对齐属性。 */
const buildWordCellPropertiesXml = (
  cell: CopyTestExportCell | null,
  width: number,
  continuation: boolean
): string => {
  /** 当前单元格可选的横向合并设置。 */
  const gridSpanXml = cell && cell.colSpan > 1
    ? `<w:gridSpan w:val="${cell.colSpan}"/>`
    : '';
  /** 当前单元格可选的纵向合并设置。 */
  const verticalMergeXml = cell && cell.rowSpan > 1
    ? `<w:vMerge w:val="${continuation ? 'continue' : 'restart'}"/>`
    : '';
  /** 当前表头单元格可选的背景色。 */
  const shadingXml = cell?.header
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${COPY_TEST_WORD_HEADER_FILL}"/>`
    : '';
  return [
    '<w:tcPr>',
    `<w:tcW w:w="${width}" w:type="dxa"/>`,
    gridSpanXml,
    verticalMergeXml,
    shadingXml,
    '<w:vAlign w:val="center"/>',
    '</w:tcPr>',
  ].join('');
};

/** 构建一个锚点或纵向续接 Word 单元格。 */
const buildWordTableCellXml = (
  cell: CopyTestExportCell,
  rowIndex: number,
  columnWidths: number[],
  context: CopyTestWordBuildContext
): string => {
  /** 当前行是否处于纵向合并单元格的续接区域。 */
  const continuation = rowIndex > cell.rowIndex;
  /** 当前单元格覆盖的固定 Word twip 宽度。 */
  const width = getWordCellWidth(columnWidths, cell.columnIndex, cell.colSpan);
  /** 纵向续接单元格不能重复锚点文字或图片。 */
  const contentXml = continuation
    ? '<w:p/>'
    : buildWordCellContentXml(cell, context);
  return [
    '<w:tc>',
    buildWordCellPropertiesXml(cell, width, continuation),
    contentXml,
    '</w:tc>',
  ].join('');
};

/** 构建 owner 矩阵中一个未占用逻辑位置的空 Word 单元格。 */
const buildWordEmptyTableCellXml = (
  columnWidth: number
): string => {
  return [
    '<w:tc>',
    buildWordCellPropertiesXml(null, columnWidth, false),
    '<w:p/>',
    '</w:tc>',
  ].join('');
};

/** 构建一行内包含空位和合并续接关系的全部 Word 单元格。 */
const buildWordRowCellsXml = (
  matrix: CopyTestWordOwnerMatrix,
  rowIndex: number,
  columnWidths: number[],
  context: CopyTestWordBuildContext
): string => {
  /** 当前物理行已经生成到的逻辑列下标。 */
  let columnIndex = 0;
  /** 当前物理行按逻辑列顺序生成的 Word 单元格。 */
  const cellsXml: string[] = [];
  while (columnIndex < columnWidths.length) {
    /** 当前逻辑位置对应的左上角锚点单元格。 */
    const owner = matrix[rowIndex][columnIndex];
    if (!owner) {
      cellsXml.push(buildWordEmptyTableCellXml(columnWidths[columnIndex]));
      columnIndex += 1;
      continue;
    }
    if (owner.columnIndex !== columnIndex) {
      throw new Error(COPY_TEST_WORD_INVALID_LAYOUT_ERROR);
    }
    cellsXml.push(buildWordTableCellXml(owner, rowIndex, columnWidths, context));
    columnIndex += owner.colSpan;
  }
  return cellsXml.join('');
};

/** 计算从第一行开始连续完整表头的物理行数。 */
const getWordHeaderRowCount = (
  matrix: CopyTestWordOwnerMatrix
): number => {
  /** 第一行开始连续满足全列为表头的行数。 */
  let headerRowCount = 0;
  while (
    headerRowCount < matrix.length
    && matrix[headerRowCount].every(owner => Boolean(owner?.header))
  ) {
    headerRowCount += 1;
  }
  return headerRowCount;
};

/** 构建一条包含合并关系和完整逻辑列的 Word 表格行。 */
const buildWordTableRowXml = (
  matrix: CopyTestWordOwnerMatrix,
  rowIndex: number,
  columnWidths: number[],
  headerRowCount: number,
  context: CopyTestWordBuildContext
): string => {
  /** 连续前置表头行使用的 Word 重复表头标记。 */
  const tableHeaderXml = rowIndex < headerRowCount ? '<w:tblHeader/>' : '';
  return [
    '<w:tr>',
    `<w:trPr><w:cantSplit/>${tableHeaderXml}</w:trPr>`,
    buildWordRowCellsXml(matrix, rowIndex, columnWidths, context),
    '</w:tr>',
  ].join('');
};

/** 构建 Word 固定布局表格的边框和单元格边距。 */
const buildWordTablePropertiesXml = (): string => {
  /** 一个方向的 Word 表格边框 XML。 */
  const buildBorder = (name: string): string => {
    return `<w:${name} w:val="single" w:sz="4" w:space="0" w:color="${COPY_TEST_WORD_BORDER_COLOR}"/>`;
  };
  return [
    '<w:tblPr>',
    `<w:tblW w:w="${COPY_TEST_WORD_TABLE_WIDTH}" w:type="dxa"/>`,
    '<w:jc w:val="center"/>',
    '<w:tblLayout w:type="fixed"/>',
    '<w:tblBorders>',
    buildBorder('top'),
    buildBorder('left'),
    buildBorder('bottom'),
    buildBorder('right'),
    buildBorder('insideH'),
    buildBorder('insideV'),
    '</w:tblBorders>',
    '<w:tblCellMar>',
    '<w:top w:w="80" w:type="dxa"/>',
    '<w:left w:w="100" w:type="dxa"/>',
    '<w:bottom w:w="80" w:type="dxa"/>',
    '<w:right w:w="100" w:type="dxa"/>',
    '</w:tblCellMar>',
    '</w:tblPr>',
  ].join('');
};

/** 构建 Word 固定逻辑列网格。 */
const buildWordTableGridXml = (
  columnWidths: number[]
): string => {
  /** 每个逻辑列对应的固定 Word gridCol。 */
  const columnsXml = columnWidths
    .map(width => `<w:gridCol w:w="${width}"/>`)
    .join('');
  return `<w:tblGrid>${columnsXml}</w:tblGrid>`;
};

/** 构建包含所有物理行和合并关系的 Word 表格。 */
const buildWordTableXml = (
  model: CopyTestExportTableModel,
  context: CopyTestWordBuildContext
): string => {
  /** 中立模型展开后的完整 owner 矩阵。 */
  const matrix = buildWordOwnerMatrix(model);
  /** 按业务列类型归一后的固定 Word 列宽。 */
  const columnWidths = buildWordColumnWidths(model);
  /** 从第一行开始连续完整表头的物理行数。 */
  const headerRowCount = getWordHeaderRowCount(matrix);
  /** 按物理行顺序生成的 Word 表格行。 */
  const rowsXml = matrix.map((_, rowIndex) => {
    return buildWordTableRowXml(
      matrix,
      rowIndex,
      columnWidths,
      headerRowCount,
      context
    );
  }).join('');
  return [
    '<w:tbl>',
    buildWordTablePropertiesXml(),
    buildWordTableGridXml(columnWidths),
    rowsXml,
    '</w:tbl>',
  ].join('');
};

/** 构建 Word 横向 A4 页面设置。 */
const buildWordSectionPropertiesXml = (): string => {
  return [
    '<w:sectPr>',
    `<w:pgSz w:w="${COPY_TEST_WORD_PAGE_WIDTH}"`,
    ` w:h="${COPY_TEST_WORD_PAGE_HEIGHT}" w:orient="landscape"/>`,
    `<w:pgMar w:top="${COPY_TEST_WORD_PAGE_MARGIN}"`,
    ` w:right="${COPY_TEST_WORD_PAGE_MARGIN}"`,
    ` w:bottom="${COPY_TEST_WORD_PAGE_MARGIN}"`,
    ` w:left="${COPY_TEST_WORD_PAGE_MARGIN}"`,
    ' w:header="0" w:footer="0" w:gutter="0"/>',
    '</w:sectPr>',
  ].join('');
};

/** 构建 Word 主文档 XML 并同步收集图片 Part。 */
const buildWordDocumentXml = (
  model: CopyTestExportTableModel,
  context: CopyTestWordBuildContext
): string => {
  return [
    COPY_TEST_WORD_XML_DECLARATION,
    `<w:document xmlns:w="${COPY_TEST_WORD_MAIN_NAMESPACE}"`,
    ` xmlns:r="${COPY_TEST_WORD_OFFICE_RELATIONSHIPS_NAMESPACE}"`,
    ` xmlns:wp="${COPY_TEST_WORD_DRAWING_WORDPROCESSING_NAMESPACE}"`,
    ` xmlns:a="${COPY_TEST_WORD_DRAWING_NAMESPACE}"`,
    ` xmlns:pic="${COPY_TEST_WORD_PICTURE_NAMESPACE}">`,
    '<w:body>',
    buildWordTableXml(model, context),
    buildWordSectionPropertiesXml(),
    '</w:body>',
    '</w:document>',
  ].join('');
};

/** 构建 DOCX 根关系 XML。 */
const buildWordRootRelationshipsXml = (): string => {
  return [
    COPY_TEST_WORD_XML_DECLARATION,
    `<Relationships xmlns="${COPY_TEST_WORD_PACKAGE_RELATIONSHIPS_NAMESPACE}">`,
    `<Relationship Id="rId1" Type="${COPY_TEST_WORD_DOCUMENT_RELATIONSHIP_TYPE}"`,
    ` Target="${COPY_TEST_WORD_DOCUMENT_PATH}"/>`,
    '</Relationships>',
  ].join('');
};

/** 构建 Word 主文档到全部 Evidence 图片的关系 XML。 */
const buildWordDocumentRelationshipsXml = (
  imageParts: CopyTestWordImagePart[]
): string => {
  /** 每张图片对应的 Word 文档关系。 */
  const relationshipsXml = imageParts.map(imagePart => {
    return [
      `<Relationship Id="rIdImage${imagePart.index}"`,
      ` Type="${COPY_TEST_WORD_IMAGE_RELATIONSHIP_TYPE}"`,
      ` Target="media/image${imagePart.index}.${imagePart.extension}"/>`,
    ].join('');
  }).join('');
  return [
    COPY_TEST_WORD_XML_DECLARATION,
    `<Relationships xmlns="${COPY_TEST_WORD_PACKAGE_RELATIONSHIPS_NAMESPACE}">`,
    relationshipsXml,
    '</Relationships>',
  ].join('');
};

/** 构建 DOCX Content Types XML。 */
const buildWordContentTypesXml = (
  imageParts: CopyTestWordImagePart[]
): string => {
  /** 当前文档实际使用的图片扩展名与 MIME 类型。 */
  const imageContentTypes = new Map<CopyTestWordImageExtension, string>();
  imageParts.forEach(imagePart => {
    imageContentTypes.set(imagePart.extension, imagePart.mimeType);
  });
  /** 当前文档实际需要声明的图片 Default 节点。 */
  const imageDefaultsXml = Array.from(imageContentTypes.entries())
    .map(([extension, mimeType]) => {
      return `<Default Extension="${extension}" ContentType="${mimeType}"/>`;
    })
    .join('');
  return [
    COPY_TEST_WORD_XML_DECLARATION,
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    imageDefaultsXml,
    `<Override PartName="/${COPY_TEST_WORD_DOCUMENT_PATH}"`,
    ` ContentType="${COPY_TEST_WORD_DOCUMENT_CONTENT_TYPE}"/>`,
    '</Types>',
  ].join('');
};

/** 将 UTF-8 XML 写入 fflate 的 DOCX 文件集合。 */
const addWordXmlPart = (
  files: Zippable,
  path: string,
  xml: string
): void => {
  files[path] = strToU8(xml);
};

/** 构建包含 Word XML 和图片资源的 fflate 文件集合。 */
const buildWordPackageFiles = (
  model: CopyTestExportTableModel
): Zippable => {
  /** 构建主文档时按顺序收集图片资源的上下文。 */
  const context: CopyTestWordBuildContext = { imageParts: [] };
  /** 包含表格、状态文字和图片引用的 Word 主文档 XML。 */
  const documentXml = buildWordDocumentXml(model, context);
  /** fflate 即将写入 DOCX 压缩包的全部文件。 */
  const files: Zippable = {};
  addWordXmlPart(
    files,
    COPY_TEST_WORD_CONTENT_TYPES_PATH,
    buildWordContentTypesXml(context.imageParts)
  );
  addWordXmlPart(
    files,
    COPY_TEST_WORD_ROOT_RELATIONSHIPS_PATH,
    buildWordRootRelationshipsXml()
  );
  addWordXmlPart(files, COPY_TEST_WORD_DOCUMENT_PATH, documentXml);
  addWordXmlPart(
    files,
    COPY_TEST_WORD_DOCUMENT_RELATIONSHIPS_PATH,
    buildWordDocumentRelationshipsXml(context.imageParts)
  );
  context.imageParts.forEach(imagePart => {
    files[`word/media/image${imagePart.index}.${imagePart.extension}`] = [
      imagePart.content,
      { level: 0 },
    ];
  });
  return files;
};

/** 使用 fflate 创建只包含当前选中表格的标准 DOCX 二进制。 */
export const createCopyTestWordPackage = (
  model: CopyTestExportTableModel
): Uint8Array => {
  return zipSync(buildWordPackageFiles(model), { level: 6 });
};
