/**
 * 文件作用：在 SheetJS 生成的工作簿内补充 Evidence 图片和 Result 富文本颜色。
 */
import * as XLSX from 'xlsx';
import {
  COPY_TEST_EXPORT_FAILED_COLOR,
  COPY_TEST_EXPORT_FAILED_LABEL,
  COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT,
  COPY_TEST_EXPORT_IMAGE_MAX_WIDTH,
  COPY_TEST_EXPORT_PASSED_COLOR,
  COPY_TEST_EXPORT_PASSED_LABEL,
} from './copyTestExportConstants';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportTableModel,
} from './copyTestExportTypes';

/** Excel 工作表 XML 在 OOXML 压缩包中的路径。 */
const COPY_TEST_EXCEL_WORKSHEET_PATH = 'xl/worksheets/sheet1.xml';

/** Excel 工作表关系 XML 在 OOXML 压缩包中的路径。 */
const COPY_TEST_EXCEL_WORKSHEET_RELATIONSHIPS_PATH = 'xl/worksheets/_rels/sheet1.xml.rels';

/** Excel 样式 XML 在 OOXML 压缩包中的路径。 */
const COPY_TEST_EXCEL_STYLES_PATH = 'xl/styles.xml';

/** Excel Drawing XML 在 OOXML 压缩包中的路径。 */
const COPY_TEST_EXCEL_DRAWING_PATH = 'xl/drawings/drawing1.xml';

/** Excel Drawing 关系 XML 在 OOXML 压缩包中的路径。 */
const COPY_TEST_EXCEL_DRAWING_RELATIONSHIPS_PATH = 'xl/drawings/_rels/drawing1.xml.rels';

/** OOXML Content Types 文件在压缩包中的路径。 */
const COPY_TEST_EXCEL_CONTENT_TYPES_PATH = '[Content_Types].xml';

/** SpreadsheetML 主命名空间。 */
const COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** OOXML 包关系命名空间。 */
const COPY_TEST_EXCEL_PACKAGE_RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Office 文档关系命名空间。 */
const COPY_TEST_EXCEL_OFFICE_RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Excel Drawing 与工作表之间使用的关系类型。 */
const COPY_TEST_EXCEL_DRAWING_RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';

/** Excel 图片与 Drawing 之间使用的关系类型。 */
const COPY_TEST_EXCEL_IMAGE_RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/** Excel Drawing XML 使用的 Content Type。 */
const COPY_TEST_EXCEL_DRAWING_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawing+xml';

/** Excel Drawing XML 在 Content Types 中使用的绝对 PartName。 */
const COPY_TEST_EXCEL_DRAWING_PART_NAME = '/xl/drawings/drawing1.xml';

/** Excel Drawing 相对于工作表关系文件的目标路径。 */
const COPY_TEST_EXCEL_DRAWING_RELATIONSHIP_TARGET = '../drawings/drawing1.xml';

/** 一个 CSS 像素对应的 Office EMU 数值。 */
const COPY_TEST_EXCEL_EMU_PER_PIXEL = 9_525;

/** Excel 图片与单元格边界之间的像素间距。 */
const COPY_TEST_EXCEL_IMAGE_PADDING = 6;

/** Excel 单元格每行文字预留的像素高度。 */
export const COPY_TEST_EXCEL_TEXT_LINE_HEIGHT = 18;

/** XML 标准命名空间。 */
const COPY_TEST_XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';

/** XML 属性值中需要按顺序执行的字符转义映射。 */
const COPY_TEST_XML_ATTRIBUTE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['&', '&amp;'],
  ['"', '&quot;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
];

/** 为当前较低 TypeScript lib 补充的局部原生 replaceAll 字符串类型。 */
type CopyTestReplaceAllString = string & {
  /** 使用原生 String.prototype.replaceAll 替换全部匹配内容。 */
  replaceAll(searchValue: string | RegExp, replaceValue: string): string;
};

/** 在不修改项目全局 TypeScript lib 的情况下调用原生 replaceAll。 */
const replaceAllText = (
  value: string,
  searchValue: string | RegExp,
  replaceValue: string
): string => {
  return (value as CopyTestReplaceAllString).replaceAll(searchValue, replaceValue);
};

/** 可以直接嵌入 Excel Drawing 的图片格式。 */
type CopyTestExcelImageExtension = 'bmp' | 'gif' | 'jpeg' | 'jpg' | 'png';

/** Excel OOXML 中一张待嵌入图片的完整布局数据。 */
interface CopyTestExcelImagePart {
  /** 图片在 Evidence 单元格中的逻辑列下标。 */
  columnIndex: number;
  /** 图片解码后的原始二进制。 */
  content: Uint8Array;
  /** 图片在 OOXML media 文件中使用的扩展名。 */
  extension: CopyTestExcelImageExtension;
  /** 图片在 Excel 中显示的像素高度。 */
  height: number;
  /** 图片关系和 media 文件使用的一基序号。 */
  index: number;
  /** 图片在 Excel Drawing 中使用的可读名称。 */
  name: string;
  /** 图片在 Evidence 单元格中的物理行下标。 */
  rowIndex: number;
  /** 图片相对锚点行顶部的像素偏移。 */
  verticalOffset: number;
  /** 图片在 Excel 中显示的像素宽度。 */
  width: number;
}

/** data URL 解码后的 Excel 图片数据。 */
interface CopyTestExcelDecodedImage {
  /** 图片解码后的原始二进制。 */
  content: Uint8Array;
  /** 图片在 OOXML media 文件中使用的扩展名。 */
  extension: CopyTestExcelImageExtension;
}

/** Result 单元格中的一个 Excel 富文本片段。 */
interface CopyTestExcelTextRun {
  /** 状态片段使用的可选 ARGB 颜色。 */
  color?: string;
  /** 当前富文本片段的完整文本。 */
  text: string;
}

/** CFB 压缩包内单个文件的最小读取结构。 */
interface CopyTestExcelArchiveEntry {
  /** 压缩包文件解压后的二进制内容。 */
  content?: ArrayBuffer | ArrayLike<number>;
}

/** 支持的 Excel 图片 MIME 子类型与文件扩展名映射。 */
const COPY_TEST_EXCEL_IMAGE_EXTENSIONS = new Map<string, CopyTestExcelImageExtension>([
  ['bmp', 'bmp'],
  ['gif', 'gif'],
  ['jpeg', 'jpeg'],
  ['jpg', 'jpg'],
  ['png', 'png'],
]);

/** 按中立图片对象缓存一次 Excel base64 解码结果，避免重复分配大二进制。 */
const COPY_TEST_EXCEL_DECODED_IMAGE_CACHE = new WeakMap<
  CopyTestExportCellImage,
  CopyTestExcelDecodedImage | null
>();

/** 将像素转换为 Excel Drawing 使用的 EMU。 */
const pixelsToEmu = (pixels: number): number => {
  return Math.max(1, Math.round(pixels * COPY_TEST_EXCEL_EMU_PER_PIXEL));
};

/** 按最大展示区域等比缩放一张 Excel Evidence 图片。 */
const getExcelImageDisplaySize = (
  image: CopyTestExportCellImage
): { height: number; width: number } => {
  /** 将原始图片限制在 Excel Evidence 单元格内的缩放比例。 */
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

/** 将 base64 字符串转换为二进制数组。 */
const decodeBase64 = (base64: string): Uint8Array | null => {
  try {
    /** 浏览器原生 atob 解码后的二进制字符串。 */
    const binary = globalThis.atob(base64);
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

/** 解析一张可由 Excel 直接嵌入的图片 data URL。 */
const decodeExcelImageDataUrl = (
  dataUrl: string | undefined
): CopyTestExcelDecodedImage | null => {
  if (!dataUrl) {
    return null;
  }
  /** data URL 中的 MIME 子类型和 base64 内容。 */
  const match = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  /** MIME 子类型对应的 OOXML media 文件扩展名。 */
  const extension = COPY_TEST_EXCEL_IMAGE_EXTENSIONS.get(match[1].toLowerCase());
  /** 去除可选空白后的图片二进制。 */
  const content = extension
    ? decodeBase64(replaceAllText(match[2], /\s/g, ''))
    : null;
  return extension && content ? { content, extension } : null;
};

/** 读取一张中立图片的缓存 Excel 解码结果。 */
const decodeExcelImage = (
  image: CopyTestExportCellImage
): CopyTestExcelDecodedImage | null => {
  if (COPY_TEST_EXCEL_DECODED_IMAGE_CACHE.has(image)) {
    return COPY_TEST_EXCEL_DECODED_IMAGE_CACHE.get(image) || null;
  }
  /** 当前图片第一次执行 base64 解码得到的结果。 */
  const decodedImage = decodeExcelImageDataUrl(image.dataUrl);
  COPY_TEST_EXCEL_DECODED_IMAGE_CACHE.set(image, decodedImage);
  return decodedImage;
};

/** 判断一张 data URL 图片能否由当前 Excel OOXML 实现直接嵌入。 */
export const canEmbedCopyTestExcelImage = (
  image: CopyTestExportCellImage
): boolean => {
  return decodeExcelImage(image) !== null;
};

/** 计算单个单元格中可以嵌入 Excel 的全部图片高度。 */
export const getCopyTestExcelImageContentHeight = (
  cell: CopyTestExportCell
): number => {
  return cell.images.reduce((height, image) => {
    if (!decodeExcelImage(image)) {
      return height;
    }
    return height + getExcelImageDisplaySize(image).height + COPY_TEST_EXCEL_IMAGE_PADDING;
  }, 0);
};

/** 将中立模型中的图片转换为 Excel Drawing 布局数据。 */
const buildExcelImageParts = (
  model: CopyTestExportTableModel
): CopyTestExcelImagePart[] => {
  /** 当前工作表中全部物理单元格按 DOM 顺序展开后的集合。 */
  const cells = model.rows.flatMap(row => row.cells);
  /** 当前工作表按图片顺序累计生成的 Drawing 数据。 */
  const imageParts: CopyTestExcelImagePart[] = [];
  cells.forEach(cell => {
    /** 图片开始位置需要避让的单元格文本高度。 */
    let verticalOffset = Math.max(1, cell.text.split('\n').filter(Boolean).length)
      * COPY_TEST_EXCEL_TEXT_LINE_HEIGHT + COPY_TEST_EXCEL_IMAGE_PADDING;
    cell.images.forEach(image => {
      /** 当前图片能够由 Excel 直接嵌入的二进制内容。 */
      const decodedImage = decodeExcelImage(image);
      if (!decodedImage) {
        return;
      }
      /** 当前图片在 Excel 单元格中的等比缩放尺寸。 */
      const displaySize = getExcelImageDisplaySize(image);
      imageParts.push({
        columnIndex: cell.columnIndex,
        content: decodedImage.content,
        extension: decodedImage.extension,
        height: displaySize.height,
        index: imageParts.length + 1,
        name: `${image.label} - ${image.fileName}`,
        rowIndex: cell.rowIndex,
        verticalOffset,
        width: displaySize.width,
      });
      verticalOffset += displaySize.height + COPY_TEST_EXCEL_IMAGE_PADDING;
    });
  });
  return imageParts;
};

/** 将 CFB 文件内容统一转换为 Uint8Array。 */
const normalizeArchiveContent = (
  content: CopyTestExcelArchiveEntry['content']
): Uint8Array => {
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  return new Uint8Array(content || []);
};

/** 读取 OOXML 压缩包中的一个文件。 */
const readArchiveFile = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string
): Uint8Array => {
  /** CFB 使用 Root Entry 前缀索引 ZIP 内文件。 */
  const entry = XLSX.CFB.find(
    archive,
    `Root Entry/${path}`
  ) as CopyTestExcelArchiveEntry | null;
  if (!entry?.content) {
    throw new Error(`Missing Excel OOXML part: ${path}`);
  }
  return normalizeArchiveContent(entry.content);
};

/** 读取 OOXML 压缩包中的 UTF-8 XML。 */
const readArchiveXml = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string
): string => {
  return new TextDecoder().decode(readArchiveFile(archive, path));
};

/** 新增或覆盖 OOXML 压缩包中的一个文件。 */
const writeArchiveFile = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string,
  content: Uint8Array
): void => {
  XLSX.CFB.utils.cfb_del(archive, `/${path}`);
  XLSX.CFB.utils.cfb_add(archive, path, content, { unsafe: true });
};

/** 新增或覆盖 OOXML 压缩包中的 UTF-8 XML。 */
const writeArchiveXml = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string,
  xml: string
): void => {
  writeArchiveFile(archive, path, new TextEncoder().encode(xml));
};

/** 将 XML 字符串解析为可编辑文档。 */
const parseXml = (xml: string): XMLDocument => {
  /** 浏览器 XML 解析器生成的 OOXML 文档。 */
  const documentModel = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentModel.querySelector('parsererror')) {
    throw new Error('Invalid Excel OOXML document');
  }
  return documentModel;
};

/** 将编辑后的 XML 文档序列化为字符串。 */
const serializeXml = (documentModel: XMLDocument): string => {
  return new XMLSerializer().serializeToString(documentModel);
};

/** 读取 Result 中单个状态行对应的 Excel ARGB 颜色。 */
const getExcelResultLineColor = (line: string): string | undefined => {
  if (line === COPY_TEST_EXPORT_PASSED_LABEL) {
    return `FF${COPY_TEST_EXPORT_PASSED_COLOR}`;
  }
  if (line === COPY_TEST_EXPORT_FAILED_LABEL) {
    return `FF${COPY_TEST_EXPORT_FAILED_COLOR}`;
  }
  return undefined;
};

/** 将 Result 单元格拆成状态标签和普通详情的 Excel 富文本片段。 */
const getExcelResultTextRuns = (
  cell: CopyTestExportCell
): CopyTestExcelTextRun[] | null => {
  if (cell.kind !== 'result' || cell.header) {
    return null;
  }
  /** 当前 Result 的全部显式文本行。 */
  const lines = cell.text.split('\n');
  /** 当前 Result 是否包含至少一个合法状态标签。 */
  let hasStatusLine = false;
  /** 保留原始换行顺序的全部富文本片段。 */
  const runs = lines.flatMap((line, lineIndex): CopyTestExcelTextRun[] => {
    /** 当前状态行使用的可选 ARGB 颜色。 */
    const color = getExcelResultLineColor(line);
    /** 除最后一行外保留的原始换行符。 */
    const newline = lineIndex < lines.length - 1 ? '\n' : '';
    if (!color) {
      return [{ text: `${line}${newline}` }];
    }
    hasStatusLine = true;
    return newline
      ? [{ color, text: line }, { text: newline }]
      : [{ color, text: line }];
  });
  return hasStatusLine ? runs : null;
};

/** 创建 Excel inline rich text 中的一个文字节点。 */
const createExcelRichTextRun = (
  documentModel: XMLDocument,
  text: string,
  color?: string
): Element => {
  /** 当前富文本片段的 run 节点。 */
  const run = documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 'r');
  if (color) {
    /** 状态文字使用的加粗和颜色属性。 */
    const properties = documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 'rPr');
    properties.append(documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 'b'));
    /** Excel 富文本使用的 ARGB 颜色节点。 */
    const colorElement = documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 'color');
    colorElement.setAttribute('rgb', color);
    properties.append(colorElement);
    run.append(properties);
  }
  /** 富文本片段的实际字符串。 */
  const textElement = documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 't');
  textElement.setAttributeNS(COPY_TEST_XML_NAMESPACE, 'xml:space', 'preserve');
  textElement.textContent = text;
  run.append(textElement);
  return run;
};

/** 将一个 Result 单元格改写为仅状态标签着色的 Excel 富文本。 */
const applyExcelResultRichText = (
  documentModel: XMLDocument,
  cellElement: Element,
  runs: CopyTestExcelTextRun[]
): void => {
  while (cellElement.firstChild) {
    cellElement.firstChild.remove();
  }
  cellElement.setAttribute('t', 'inlineStr');
  /** 当前单元格的 inline string 容器。 */
  const inlineString = documentModel.createElementNS(COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE, 'is');
  runs.forEach(run => {
    inlineString.append(createExcelRichTextRun(documentModel, run.text, run.color));
  });
  cellElement.append(inlineString);
};

/** 在工作表 XML 中应用全部 Result 状态富文本。 */
const patchExcelResultColors = (
  worksheetDocument: XMLDocument,
  model: CopyTestExportTableModel
): void => {
  /** 工作表内全部有值单元格按引用索引。 */
  const cellByReference = new Map(
    Array.from(worksheetDocument.getElementsByTagNameNS(
      COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
      'c'
    )).map(element => [element.getAttribute('r') || '', element])
  );
  model.rows.flatMap(row => row.cells).forEach(cell => {
    /** 当前 Result 单元格中按状态行拆分的富文本片段。 */
    const runs = getExcelResultTextRuns(cell);
    if (!runs) {
      return;
    }
    /** 当前中立单元格对应的 A1 引用。 */
    const reference = XLSX.utils.encode_cell({ c: cell.columnIndex, r: cell.rowIndex });
    /** SheetJS 输出中与中立单元格对应的 XML 节点。 */
    const cellElement = cellByReference.get(reference);
    if (cellElement) {
      applyExcelResultRichText(worksheetDocument, cellElement, runs);
    }
  });
};

/** 为完整表格创建顶部对齐和自动换行样式并应用到全部单元格。 */
const applyExcelTableCellAlignment = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  worksheetDocument: XMLDocument
): void => {
  /** SheetJS 生成的工作簿样式文档。 */
  const stylesDocument = parseXml(readArchiveXml(archive, COPY_TEST_EXCEL_STYLES_PATH));
  /** 工作簿的单元格格式列表。 */
  const cellFormats = stylesDocument.getElementsByTagNameNS(
    COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
    'cellXfs'
  )[0];
  if (!cellFormats) {
    throw new Error('Missing Excel cell styles');
  }
  /** 新增表格格式在 cellXfs 中使用的零基样式下标。 */
  const styleIndex = cellFormats.children.length;
  /** 当前完整表格使用的独立单元格格式。 */
  const tableFormat = stylesDocument.createElementNS(
    COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
    'xf'
  );
  tableFormat.setAttribute('applyAlignment', '1');
  tableFormat.setAttribute('borderId', '0');
  tableFormat.setAttribute('fillId', '0');
  tableFormat.setAttribute('fontId', '0');
  tableFormat.setAttribute('numFmtId', '0');
  tableFormat.setAttribute('xfId', '0');
  /** 独立表格格式使用的顶部对齐和自动换行节点。 */
  const alignment = stylesDocument.createElementNS(
    COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
    'alignment'
  );
  alignment.setAttribute('vertical', 'top');
  alignment.setAttribute('wrapText', '1');
  tableFormat.append(alignment);
  cellFormats.append(tableFormat);
  cellFormats.setAttribute('count', String(cellFormats.children.length));
  writeArchiveXml(
    archive,
    COPY_TEST_EXCEL_STYLES_PATH,
    serializeXml(stylesDocument)
  );
  Array.from(worksheetDocument.getElementsByTagNameNS(
    COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
    'c'
  )).forEach(cell => {
    cell.setAttribute('s', String(styleIndex));
  });
};

/** 读取关系文档中下一个可用的 rId。 */
const getNextRelationshipId = (relationshipsDocument: XMLDocument): string => {
  /** 关系文件内全部已经使用的一基序号。 */
  const usedIndexes = Array.from(relationshipsDocument.documentElement.children).flatMap(element => {
    /** 当前关系 Id 末尾的数字部分。 */
    const matchedIndex = /^rId(\d+)$/.exec(element.getAttribute('Id') || '')?.[1];
    return matchedIndex ? [Number(matchedIndex)] : [];
  });
  return `rId${Math.max(0, ...usedIndexes) + 1}`;
};

/** 创建空的 OOXML Relationships 文档。 */
const createRelationshipsDocument = (): XMLDocument => {
  return parseXml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="${COPY_TEST_EXCEL_PACKAGE_RELATIONSHIPS_NAMESPACE}"/>`
  );
};

/** 创建工作表到 Drawing 的关系并返回关系 Id。 */
const createWorksheetDrawingRelationship = (
  archive: ReturnType<typeof XLSX.CFB.read>
): string => {
  /** SheetJS 可能已经为超链接等内容生成的工作表关系。 */
  let relationshipsDocument: XMLDocument;
  try {
    relationshipsDocument = parseXml(readArchiveXml(
      archive,
      COPY_TEST_EXCEL_WORKSHEET_RELATIONSHIPS_PATH
    ));
  } catch {
    relationshipsDocument = createRelationshipsDocument();
  }
  /** 不与现有超链接或其他关系冲突的 Drawing 关系 Id。 */
  const relationshipId = getNextRelationshipId(relationshipsDocument);
  /** 工作表指向 Drawing 的关系节点。 */
  const relationship = relationshipsDocument.createElementNS(
    COPY_TEST_EXCEL_PACKAGE_RELATIONSHIPS_NAMESPACE,
    'Relationship'
  );
  relationship.setAttribute('Id', relationshipId);
  relationship.setAttribute('Target', COPY_TEST_EXCEL_DRAWING_RELATIONSHIP_TARGET);
  relationship.setAttribute('Type', COPY_TEST_EXCEL_DRAWING_RELATIONSHIP_TYPE);
  relationshipsDocument.documentElement.append(relationship);
  writeArchiveXml(
    archive,
    COPY_TEST_EXCEL_WORKSHEET_RELATIONSHIPS_PATH,
    serializeXml(relationshipsDocument)
  );
  return relationshipId;
};

/** 在工作表 XML 中声明 Drawing 关系。 */
const appendWorksheetDrawing = (
  worksheetDocument: XMLDocument,
  relationshipId: string
): void => {
  /** 当前工作表引用 Drawing 的节点。 */
  const drawing = worksheetDocument.createElementNS(
    COPY_TEST_EXCEL_SPREADSHEET_NAMESPACE,
    'drawing'
  );
  drawing.setAttributeNS(
    COPY_TEST_EXCEL_OFFICE_RELATIONSHIPS_NAMESPACE,
    'r:id',
    relationshipId
  );
  worksheetDocument.documentElement.append(drawing);
};

/** 对 XML 属性值中的特殊字符进行转义。 */
const escapeXmlAttribute = (value: string): string => {
  return COPY_TEST_XML_ATTRIBUTE_REPLACEMENTS.reduce(
    (escapedValue, [searchValue, replaceValue]) => {
      return replaceAllText(escapedValue, searchValue, replaceValue);
    },
    value
  );
};

/** 为一张图片创建 Excel oneCellAnchor XML。 */
const createExcelImageAnchorXml = (image: CopyTestExcelImagePart): string => {
  /** 当前图片在 Drawing 中使用的关系 Id。 */
  const relationshipId = `rId${image.index}`;
  return [
    '<xdr:oneCellAnchor>',
    '<xdr:from>',
    `<xdr:col>${image.columnIndex}</xdr:col>`,
    `<xdr:colOff>${pixelsToEmu(COPY_TEST_EXCEL_IMAGE_PADDING)}</xdr:colOff>`,
    `<xdr:row>${image.rowIndex}</xdr:row>`,
    `<xdr:rowOff>${pixelsToEmu(image.verticalOffset)}</xdr:rowOff>`,
    '</xdr:from>',
    `<xdr:ext cx="${pixelsToEmu(image.width)}" cy="${pixelsToEmu(image.height)}"/>`,
    '<xdr:pic>',
    '<xdr:nvPicPr>',
    `<xdr:cNvPr id="${image.index}" name="Picture ${image.index}" descr="${escapeXmlAttribute(image.name)}"/>`,
    '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>',
    '</xdr:nvPicPr>',
    '<xdr:blipFill>',
    `<a:blip r:embed="${relationshipId}"/>`,
    '<a:stretch><a:fillRect/></a:stretch>',
    '</xdr:blipFill>',
    '<xdr:spPr>',
    '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '</xdr:spPr>',
    '</xdr:pic>',
    '<xdr:clientData/>',
    '</xdr:oneCellAnchor>',
  ].join('');
};

/** 创建包含全部 Evidence 图片锚点的 Drawing XML。 */
const createExcelDrawingXml = (images: CopyTestExcelImagePart[]): string => {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<xdr:wsDr',
    ' xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ` xmlns:r="${COPY_TEST_EXCEL_OFFICE_RELATIONSHIPS_NAMESPACE}">`,
    ...images.map(createExcelImageAnchorXml),
    '</xdr:wsDr>',
  ].join('');
};

/** 创建 Drawing 到全部 media 图片的关系 XML。 */
const createExcelDrawingRelationshipsXml = (
  images: CopyTestExcelImagePart[]
): string => {
  /** 每张图片对应的 OOXML Relationship 节点。 */
  const relationships = images.map(image => {
    return `<Relationship Id="rId${image.index}" Type="${COPY_TEST_EXCEL_IMAGE_RELATIONSHIP_TYPE}" Target="../media/image${image.index}.${image.extension}"/>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<Relationships xmlns="${COPY_TEST_EXCEL_PACKAGE_RELATIONSHIPS_NAMESPACE}">`,
    ...relationships,
    '</Relationships>',
  ].join('');
};

/** 确保 Content Types 声明当前 Drawing。 */
const ensureExcelDrawingContentType = (
  archive: ReturnType<typeof XLSX.CFB.read>
): void => {
  /** 当前 Excel 文件的 Content Types 文档。 */
  const contentTypesDocument = parseXml(readArchiveXml(
    archive,
    COPY_TEST_EXCEL_CONTENT_TYPES_PATH
  ));
  /** 是否已经存在当前 Drawing 的 Override。 */
  const hasDrawingOverride = Array.from(contentTypesDocument.documentElement.children).some(element => {
    return element.localName === 'Override'
      && element.getAttribute('PartName') === COPY_TEST_EXCEL_DRAWING_PART_NAME;
  });
  if (!hasDrawingOverride) {
    /** 当前 Drawing 使用的 Content Type Override。 */
    const override = contentTypesDocument.createElementNS(
      contentTypesDocument.documentElement.namespaceURI,
      'Override'
    );
    override.setAttribute('ContentType', COPY_TEST_EXCEL_DRAWING_CONTENT_TYPE);
    override.setAttribute('PartName', COPY_TEST_EXCEL_DRAWING_PART_NAME);
    contentTypesDocument.documentElement.append(override);
  }
  writeArchiveXml(
    archive,
    COPY_TEST_EXCEL_CONTENT_TYPES_PATH,
    serializeXml(contentTypesDocument)
  );
};

/** 将 Drawing、关系和 media 图片写入 Excel OOXML 压缩包。 */
const writeExcelImages = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  worksheetDocument: XMLDocument,
  images: CopyTestExcelImagePart[]
): void => {
  if (images.length === 0) {
    return;
  }
  /** 工作表引用 Drawing 使用的关系 Id。 */
  const relationshipId = createWorksheetDrawingRelationship(archive);
  appendWorksheetDrawing(worksheetDocument, relationshipId);
  writeArchiveXml(archive, COPY_TEST_EXCEL_DRAWING_PATH, createExcelDrawingXml(images));
  writeArchiveXml(
    archive,
    COPY_TEST_EXCEL_DRAWING_RELATIONSHIPS_PATH,
    createExcelDrawingRelationshipsXml(images)
  );
  images.forEach(image => {
    writeArchiveFile(
      archive,
      `xl/media/image${image.index}.${image.extension}`,
      image.content
    );
  });
  ensureExcelDrawingContentType(archive);
};

/** 将 CFB 输出统一转换为浏览器 Blob 可读取的 Uint8Array。 */
const normalizeArchiveOutput = (output: ArrayBuffer | ArrayLike<number>): Uint8Array => {
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }
  return Uint8Array.from(output);
};

/** 为 SheetJS 工作簿补充图片 Drawing 和 Passed/Failed 富文本。 */
export const enhanceCopyTestExcelWorkbook = (
  workbookData: ArrayBuffer,
  model: CopyTestExportTableModel
): Uint8Array => {
  /** 将标准 XLSX 读取为可编辑的 CFB ZIP 容器。 */
  const archive = XLSX.CFB.read(new Uint8Array(workbookData), { type: 'array' });
  /** 当前唯一 CopyTest 工作表的 XML 文档。 */
  const worksheetDocument = parseXml(readArchiveXml(
    archive,
    COPY_TEST_EXCEL_WORKSHEET_PATH
  ));
  patchExcelResultColors(worksheetDocument, model);
  applyExcelTableCellAlignment(archive, worksheetDocument);
  /** 当前工作表全部可以直接嵌入的 Evidence 图片。 */
  const images = buildExcelImageParts(model);
  writeExcelImages(archive, worksheetDocument, images);
  writeArchiveXml(
    archive,
    COPY_TEST_EXCEL_WORKSHEET_PATH,
    serializeXml(worksheetDocument)
  );
  /** 重新压缩后的标准 XLSX 二进制。 */
  const output = XLSX.CFB.write(archive, {
    compression: true,
    fileType: 'zip',
    type: 'array',
  }) as ArrayBuffer | ArrayLike<number>;
  return normalizeArchiveOutput(output);
};
