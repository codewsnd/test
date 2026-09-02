/**
 * 文件作用：将选中表格的 workingHtml 转换为三个文件格式共用的中立模型。
 */
import {
  COPY_TEST_EXPORT_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EXPORT_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_EXPORT_EVIDENCE_TYPE,
  COPY_TEST_EXPORT_GENERATED_TYPE_ATTRIBUTE,
  COPY_TEST_EXPORT_IMAGE_DEFAULT_HEIGHT,
  COPY_TEST_EXPORT_IMAGE_DEFAULT_WIDTH,
  COPY_TEST_EXPORT_RESULT_HEADER_PREFIX,
  COPY_TEST_EXPORT_RESULT_TYPE,
} from './copyTestExportConstants';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportCellKind,
  CopyTestExportImageInput,
  CopyTestExportRow,
  CopyTestExportTableModel,
} from './copyTestExportTypes';
import { COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE } from '../table/tableConstants';
import { getCopyTestStoredImageDisplayName } from '../table/copyTestImageUtils';

/** 构建模型时发现无有效表格使用的错误文案。 */
const COPY_TEST_EXPORT_INVALID_TABLE_ERROR = 'No valid table found for export';

/** 合并单元格越界或重叠时使用的错误文案。 */
const COPY_TEST_EXPORT_INVALID_SPAN_ERROR = 'The selected table contains an invalid merged-cell layout';

/** 读取文本时需要跳过的交互、脚本和图片元素。 */
const COPY_TEST_EXPORT_IGNORED_TEXT_TAGS = new Set([
  'ac:image',
  'button',
  'img',
  'input',
  'script',
  'select',
  'style',
  'textarea',
]);

/** 读取文本时需要在结尾增加换行的块级元素。 */
const COPY_TEST_EXPORT_BLOCK_TEXT_TAGS = new Set([
  'div',
  'p',
  'section',
  'ul',
  'ol',
]);

/** 将图片文件名映射为当前内存中的 data URL。 */
const buildImageDataMap = (
  images: readonly CopyTestExportImageInput[]
): Map<string, string> => {
  return new Map(images.map(image => [image.fileName, image.base64.trim()]));
};

/** 将合法正整数 span 转换为数值，非法值回退为一格。 */
const readPositiveSpan = (cell: Element, attributeName: 'colspan' | 'rowspan'): number => {
  /** 当前 span 属性转换后的数值。 */
  const parsedValue = Number(cell.getAttribute(attributeName) || 1);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.floor(parsedValue)
    : 1;
};

/** 将合法正尺寸转换为数值，非法值使用对应默认值。 */
const readPositiveSize = (value: string | null, fallback: number): number => {
  /** 当前尺寸属性转换后的数值。 */
  const parsedValue = Number(value || fallback);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

/** 判断节点是否是浏览器文本节点。 */
const isTextNode = (node: Node): boolean => {
  return node.nodeType === Node.TEXT_NODE;
};

/** 递归读取一个元素的可导出文本，并跳过图片和交互节点。 */
const readElementText = (element: Element): string => {
  /** 当前元素的小写标签名。 */
  const tagName = element.tagName.toLowerCase();
  if (COPY_TEST_EXPORT_IGNORED_TEXT_TAGS.has(tagName)) {
    return '';
  }
  if (tagName === 'br') {
    return '\n';
  }

  /** 当前元素全部子节点拼接后的文本。 */
  const childText = Array.from(element.childNodes).map(readNodeText).join('');
  if (tagName === 'li') {
    return `• ${childText.trim()}\n`;
  }
  return COPY_TEST_EXPORT_BLOCK_TEXT_TAGS.has(tagName) ? `\n${childText}\n` : childText;
};

/** 读取文本节点或元素节点的可导出内容。 */
const readNodeText = (node: Node): string => {
  if (isTextNode(node)) {
    return node.textContent || '';
  }
  return node instanceof Element ? readElementText(node) : '';
};

/** 规范文本的空白、空行和项目符号。 */
const normalizeCellText = (value: string): string => {
  return value
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
};

/** 读取单元格中除图片节点以外的可导出文本。 */
const getCellText = (cell: HTMLTableCellElement): string => {
  return normalizeCellText(Array.from(cell.childNodes).map(readNodeText).join(''));
};

/** 判断候选元素是否由当前物理单元格直接拥有。 */
const isOwnedByCell = (element: Element, cell: HTMLTableCellElement): boolean => {
  return element.closest('th,td') === cell;
};

/** 读取 ac:image 的直属 ri:attachment 文件名。 */
const getStorageImageFileName = (imageElement: Element): string => {
  /** 当前 ac:image 直属的规范附件节点。 */
  const attachment = Array.from(imageElement.children).find(child => {
    return child.tagName.toLowerCase() === 'ri:attachment';
  });
  return attachment?.getAttribute('ri:filename')?.trim() || '';
};

/** 读取 Evidence 图片所在卡片的显式标签。 */
const getStorageImageLabel = (imageElement: Element, fallback: string): string => {
  /** 当前图片所属的 Evidence 卡片。 */
  const card = imageElement.closest(`[${COPY_TEST_EXPORT_EVIDENCE_CARD_ATTRIBUTE}]`);
  return card?.querySelector('strong')?.textContent?.trim() || fallback;
};

/** 将一个规范 ac:image 转换为中立图片模型。 */
const buildCellImage = (
  imageElement: Element,
  imageDataByFileName: Map<string, string>,
  missingImageFileNames: Set<string>
): CopyTestExportCellImage | null => {
  /** 当前 Confluence 图片引用的规范附件文件名。 */
  const fileName = getStorageImageFileName(imageElement);
  if (!fileName) {
    return null;
  }
  /** Storage 中未加载到当前会话缓存的图片不参与本次导出。 */
  if (!imageDataByFileName.has(fileName)) {
    return null;
  }

  /** 当前附件在浏览器内存中对应的 data URL。 */
  const dataUrl = imageDataByFileName.get(fileName) || '';
  if (!dataUrl) {
    missingImageFileNames.add(fileName);
  }
  return {
    dataUrl: dataUrl || undefined,
    fileName,
    height: readPositiveSize(
      imageElement.getAttribute('ac:height'),
      COPY_TEST_EXPORT_IMAGE_DEFAULT_HEIGHT
    ),
    label: getStorageImageLabel(
      imageElement,
      getCopyTestStoredImageDisplayName({
        attachmentFileName: fileName,
        displayFileName: imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE),
      })
    ),
    width: readPositiveSize(
      imageElement.getAttribute('ac:width'),
      COPY_TEST_EXPORT_IMAGE_DEFAULT_WIDTH
    ),
  };
};

/** 读取当前物理单元格直接拥有的全部 Evidence 图片。 */
const getCellImages = (
  cell: HTMLTableCellElement,
  imageDataByFileName: Map<string, string>,
  missingImageFileNames: Set<string>
): CopyTestExportCellImage[] => {
  /** 当前单元格直接拥有的 Confluence 图片元素。 */
  const imageElements = Array.from(cell.querySelectorAll('*')).filter(element => {
    return element.tagName.toLowerCase() === 'ac:image' && isOwnedByCell(element, cell);
  });
  return imageElements.flatMap(element => {
    /** 当前 Confluence 图片转换后的中立模型。 */
    const image = buildCellImage(
      element,
      imageDataByFileName,
      missingImageFileNames
    );
    return image ? [image] : [];
  });
};

/** 根据严格 metadata 或表头前缀识别单元格业务类型。 */
const getCellKind = (cell: HTMLTableCellElement, text: string): CopyTestExportCellKind => {
  /** 当前单元格 metadata 声明的生成列类型。 */
  const generatedType = cell.getAttribute(COPY_TEST_EXPORT_GENERATED_TYPE_ATTRIBUTE);
  if (generatedType === COPY_TEST_EXPORT_RESULT_TYPE || text.startsWith(COPY_TEST_EXPORT_RESULT_HEADER_PREFIX)) {
    return 'result';
  }
  if (generatedType === COPY_TEST_EXPORT_EVIDENCE_TYPE || text.startsWith(COPY_TEST_EXPORT_EVIDENCE_HEADER_PREFIX)) {
    return 'evidence';
  }
  return 'normal';
};

/** 读取顶层表格直接拥有的全部物理行。 */
const getTopLevelRows = (table: HTMLTableElement): HTMLTableRowElement[] => {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tr')).filter(row => {
    return row.closest('table') === table;
  });
};

/** 读取物理行直接拥有的 th 和 td。 */
const getDirectCells = (row: HTMLTableRowElement): HTMLTableCellElement[] => {
  return Array.from(row.children).filter((child): child is HTMLTableCellElement => {
    /** 当前直属子元素的小写标签名。 */
    const tagName = child.tagName.toLowerCase();
    return tagName === 'th' || tagName === 'td';
  });
};

/** 生成占用矩阵中一个逻辑位置的稳定键。 */
const getSlotKey = (rowIndex: number, columnIndex: number): string => {
  return `${rowIndex}:${columnIndex}`;
};

/** 查找当前物理行中第一个未被上方 rowspan 占用的逻辑列。 */
const findAvailableColumn = (
  occupiedSlots: Set<string>,
  rowIndex: number,
  startingColumn: number
): number => {
  /** 从建议起点开始查找的逻辑列下标。 */
  let columnIndex = startingColumn;
  while (occupiedSlots.has(getSlotKey(rowIndex, columnIndex))) {
    columnIndex += 1;
  }
  return columnIndex;
};

/** 校验并登记一个物理单元格覆盖的全部逻辑位置。 */
const occupyCellSlots = (
  occupiedSlots: Set<string>,
  rowCount: number,
  rowIndex: number,
  columnIndex: number,
  rowSpan: number,
  colSpan: number
): void => {
  if (rowIndex + rowSpan > rowCount) {
    throw new Error(COPY_TEST_EXPORT_INVALID_SPAN_ERROR);
  }
  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
      /** 当前单元格将要占用的逻辑位置键。 */
      const slotKey = getSlotKey(rowIndex + rowOffset, columnIndex + columnOffset);
      if (occupiedSlots.has(slotKey)) {
        throw new Error(COPY_TEST_EXPORT_INVALID_SPAN_ERROR);
      }
      occupiedSlots.add(slotKey);
    }
  }
};

/** 将一个 DOM 单元格转换为中立单元格模型。 */
const buildExportCell = (
  cell: HTMLTableCellElement,
  rowIndex: number,
  columnIndex: number,
  imageDataByFileName: Map<string, string>,
  missingImageFileNames: Set<string>
): CopyTestExportCell => {
  /** 当前单元格去除图片和交互节点后的文本。 */
  const text = getCellText(cell);
  /** 当前单元格由严格 metadata 或生成列表头识别出的业务类型。 */
  const kind = getCellKind(cell, text);
  return {
    colSpan: readPositiveSpan(cell, 'colspan'),
    columnIndex,
    header: cell.tagName.toLowerCase() === 'th',
    images: kind === 'evidence'
      ? getCellImages(cell, imageDataByFileName, missingImageFileNames)
      : [],
    kind,
    rowIndex,
    rowSpan: readPositiveSpan(cell, 'rowspan'),
    text,
  };
};

/** 将全部 DOM 行转换为 anchor-only 中立表格行。 */
const buildExportRows = (
  domRows: HTMLTableRowElement[],
  imageDataByFileName: Map<string, string>,
  missingImageFileNames: Set<string>
): CopyTestExportRow[] => {
  /** 已被物理单元格覆盖的逻辑位置集合。 */
  const occupiedSlots = new Set<string>();
  return domRows.map((row, rowIndex) => {
    /** 当前行下一物理单元格开始查找的逻辑列。 */
    let nextColumnIndex = 0;
    /** 当前行直接拥有的锚点单元格模型。 */
    const cells = getDirectCells(row).map(cell => {
      /** 跳过上方 rowspan 后得到的真实逻辑列。 */
      const columnIndex = findAvailableColumn(occupiedSlots, rowIndex, nextColumnIndex);
      /** 当前 DOM 单元格转换后的中立模型。 */
      const exportCell = buildExportCell(
        cell,
        rowIndex,
        columnIndex,
        imageDataByFileName,
        missingImageFileNames
      );
      occupyCellSlots(
        occupiedSlots,
        domRows.length,
        rowIndex,
        columnIndex,
        exportCell.rowSpan,
        exportCell.colSpan
      );
      nextColumnIndex = columnIndex + exportCell.colSpan;
      return exportCell;
    });
    return { cells, index: rowIndex };
  });
};

/** 计算全部锚点单元格覆盖后的最大逻辑列数。 */
const getColumnCount = (rows: CopyTestExportRow[]): number => {
  return rows.reduce((maximum, row) => {
    /** 当前行中最右侧单元格的逻辑结束位置。 */
    const rowWidth = row.cells.reduce(
      (width, cell) => Math.max(width, cell.columnIndex + cell.colSpan),
      0
    );
    return Math.max(maximum, rowWidth);
  }, 0);
};

/** 将 workingHtml 解析为 PDF、Word、Excel 共用的中立模型。 */
export const buildCopyTestExportTableModel = (
  tableHtml: string,
  images: readonly CopyTestExportImageInput[]
): CopyTestExportTableModel => {
  /** 隔离解析外部 Storage HTML 的临时文档。 */
  const documentModel = new DOMParser().parseFromString(tableHtml, 'text/html');
  /** workingHtml 中第一张顶层候选表格。 */
  const table = documentModel.body.querySelector<HTMLTableElement>('table');
  if (!table) {
    throw new Error(COPY_TEST_EXPORT_INVALID_TABLE_ERROR);
  }

  /** 当前顶层表格直接拥有的物理行。 */
  const domRows = getTopLevelRows(table);
  if (domRows.length === 0) {
    throw new Error(COPY_TEST_EXPORT_INVALID_TABLE_ERROR);
  }

  /** workingHtml 未能从当前内存图片集解析出的附件文件名。 */
  const missingImageFileNames = new Set<string>();
  /** 三种格式共用的 anchor-only 物理行模型。 */
  const rows = buildExportRows(
    domRows,
    buildImageDataMap(images),
    missingImageFileNames
  );
  /** 合并关系展开后的最大逻辑列数。 */
  const columnCount = getColumnCount(rows);
  if (columnCount === 0) {
    throw new Error(COPY_TEST_EXPORT_INVALID_TABLE_ERROR);
  }
  return {
    columnCount,
    missingImageFileNames: Array.from(missingImageFileNames),
    rowCount: rows.length,
    rows,
  };
};
