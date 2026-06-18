/**
 * 文件作用：解析 Confluence 表格结构并构建行列 slot 模型。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_RESULT_HEADER_PREFIX,
  COPY_TEST_SOURCE_CELL_ID_ATTRIBUTE,
} from './tableConstants';

/** 定义 CopyTestGeneratedColumnType 类型。 */
export type CopyTestGeneratedColumnType =
  | typeof COPY_TEST_GENERATED_RESULT_TYPE
  | typeof COPY_TEST_GENERATED_EVIDENCE_TYPE;

/** 定义 CopyTestHeader 的数据结构。 */
export interface CopyTestHeader {
  generatedType?: CopyTestGeneratedColumnType;
  index: number;
  label: string;
  sourceCellId?: string;
  sourceColumnKey?: string;
}

/** 定义 CopyTestCellModel 的数据结构。 */
export interface CopyTestCellModel {
  colSpan: number;
  columnIndex: number;
  element: HTMLTableCellElement;
  generatedType?: CopyTestGeneratedColumnType;
  html: string;
  rowIndex: number;
  rowSpan: number;
  sourceCellId: string;
  sourceColumnKey?: string;
  tagName: 'td' | 'th';
  text: string;
}

/** 定义 CopyTestCellSlot 的数据结构。 */
export interface CopyTestCellSlot {
  cell: CopyTestCellModel;
  columnIndex: number;
  owned: boolean;
}

/** 定义 CopyTestRowModel 的数据结构。 */
export interface CopyTestRowModel {
  cells: CopyTestCellModel[];
  element: HTMLTableRowElement;
  index: number;
  slots: Array<CopyTestCellSlot | undefined>;
}

/** 定义 CopyTestTableModel 的数据结构。 */
export interface CopyTestTableModel {
  columnCount: number;
  headers: CopyTestHeader[];
  rows: CopyTestRowModel[];
  table: HTMLTableElement;
}

/** 定义 CopyTestTableEntry 的数据结构。 */
export interface CopyTestTableEntry {
  headers: CopyTestHeader[];
  html: string;
  index: number;
  model: CopyTestTableModel;
  range?: CopyTestTableRange;
}

/** 定义 CopyTestTableRange 的数据结构。 */
export interface CopyTestTableRange {
  end: number;
  start: number;
}

/** 定义 ActiveRowSpanSlot 的数据结构。 */
interface ActiveRowSpanSlot {
  cell: CopyTestCellModel;
  remainingRows: number;
}

/** 定义 TableRangeScanState 的数据结构。 */
interface TableRangeScanState {
  depth: number;
  ranges: CopyTestTableRange[];
  start: number;
}

/** 定义 SELF_CLOSING_STORAGE_TAG_PATTERN 常量。 */
const SELF_CLOSING_STORAGE_TAG_PATTERN = /<((?:ac|ri):[A-Za-z][\w.-]*)([^<>]*?)\s*\/>/g;

/** 定义 TABLE_TAG_PATTERN 常量。 */
const TABLE_TAG_PATTERN = /<\/?table\b[^>]*>/gi;

/** 定义 CLOSING_TABLE_TAG_PATTERN 常量。 */
const CLOSING_TABLE_TAG_PATTERN = /^<\/table\b/i;

/** 定义 SELF_CLOSING_TABLE_TAG_PATTERN 常量。 */
const SELF_CLOSING_TABLE_TAG_PATTERN = /\/>\s*$/i;

/** 定义 GENERATED_COLUMN_TYPES 常量。 */
const GENERATED_COLUMN_TYPES = new Set<string>([
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
]);

/** 定义 IGNORED_TABLE_RANGE_PATTERNS 常量。 */
const IGNORED_TABLE_RANGE_PATTERNS = [/<!\[CDATA\[[\s\S]*?\]\]>/gi, /<!--[\s\S]*?-->/g];

/** 定义 EMPTY_NAMESPACE_TAG_NAMES 常量。 */
const EMPTY_NAMESPACE_TAG_NAMES = ['ri:attachment'];

/** 定义 VOID_TAG_NAMES 常量。 */
const VOID_TAG_NAMES = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

/** HTML 标签正则统一使用全局大小写不敏感匹配。 */
const HTML_TAG_REGEXP_FLAGS = 'gi';

/** 处理 escapeRegExp 辅助逻辑。 */
export const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/** 处理 normalizeLabel 辅助逻辑。 */
export const normalizeLabel = (label: string): string => {
  return label.trim().replace(/\s+/g, ' ');
};

/** 处理 getCopyTestSourceColumnKey 辅助逻辑。 */
export const getCopyTestSourceColumnKey = (columnIndex: number, columnLabel: string): string => {
  return `${columnIndex}:${normalizeLabel(columnLabel)}`;
};

/** 处理 getGeneratedColumnLabel 辅助逻辑。 */
export const getGeneratedColumnLabel = (
  type: CopyTestGeneratedColumnType,
  sourceLabel: string
): string => {

  /** 定义 prefix 常量。 */
  const prefix = type === COPY_TEST_GENERATED_RESULT_TYPE
    ? COPY_TEST_RESULT_HEADER_PREFIX
    : COPY_TEST_EVIDENCE_HEADER_PREFIX;
  return `${prefix} ${sourceLabel}`;
};

/** 处理 parseHtml 辅助逻辑。 */
export const parseHtml = (html: string): Document => {

  /** 定义 preparedHtml 常量。 */
  const preparedHtml = html.replace(SELF_CLOSING_STORAGE_TAG_PATTERN, '<$1$2></$1>');
  return new DOMParser().parseFromString(preparedHtml, 'text/html');
};

/** 处理 normalizePairedTag 辅助逻辑。 */
const normalizePairedTag = (html: string, tagName: string): string => {

  /** 定义 pattern 常量。 */
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>\\s*<\\/${tagName}\\s*>`, HTML_TAG_REGEXP_FLAGS);
  return html.replace(pattern, `<${tagName}$1 />`);
};

/** 处理 normalizeOpenVoidTag 辅助逻辑。 */
const normalizeOpenVoidTag = (html: string, tagName: string): string => {

  /** 定义 pattern 常量。 */
  const pattern = new RegExp(`<${tagName}\\b(\\s[^>]*)?\\s*/?>`, HTML_TAG_REGEXP_FLAGS);
  return html.replace(pattern, match => {
    if (match.endsWith('/>')) {
      return match;
    }
    return `${match.slice(0, -1).trimEnd()} />`;
  });
};

/** 处理 removeClosingTag 辅助逻辑。 */
const removeClosingTag = (html: string, tagName: string): string => {
  return html.replace(new RegExp(`<\\/${tagName}\\s*>`, HTML_TAG_REGEXP_FLAGS), '');
};

/** 处理 toConfluenceStorageHtml 辅助逻辑。 */
export const toConfluenceStorageHtml = (html: string): string => {

  /** 定义 normalizedVoidTags 常量。 */
  const normalizedVoidTags = VOID_TAG_NAMES.reduce((nextHtml, tagName) => {
    return removeClosingTag(normalizeOpenVoidTag(normalizePairedTag(nextHtml, tagName), tagName), tagName);
  }, html);
  return EMPTY_NAMESPACE_TAG_NAMES.reduce(normalizePairedTag, normalizedVoidTags);
};

/** 处理 getText 辅助逻辑。 */
const getText = (element?: Element | null): string => {
  return element?.textContent?.trim() || '';
};

/** 处理 getSpan 辅助逻辑。 */
const getSpan = (cell: Element, attributeName: 'colspan' | 'rowspan'): number => {

  /** 定义 value 常量。 */
  const value = Number(cell.getAttribute(attributeName) || 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

/** 处理 getGeneratedType 辅助逻辑。 */
const getGeneratedType = (cell: Element): CopyTestGeneratedColumnType | undefined => {

  /** 定义 value 常量。 */
  const value = cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE);
  return value && GENERATED_COLUMN_TYPES.has(value) ? value as CopyTestGeneratedColumnType : undefined;
};

/** 处理 getOrCreateCellId 辅助逻辑。 */
const getOrCreateCellId = (cell: Element, rowIndex: number, cellIndex: number): string => {

  /** 定义 existingId 常量。 */
  const existingId = cell.getAttribute(COPY_TEST_SOURCE_CELL_ID_ATTRIBUTE);
  if (existingId) {
    return existingId;
  }

  return `copy-test-cell-${rowIndex}-${cellIndex}`;
};

/** 处理 createCellModel 辅助逻辑。 */
const createCellModel = (
  cell: HTMLTableCellElement,
  rowIndex: number,
  cellIndex: number,
  columnIndex: number
): CopyTestCellModel => {
  return {
    colSpan: getSpan(cell, 'colspan'),
    columnIndex,
    element: cell,
    generatedType: getGeneratedType(cell),
    html: cell.innerHTML,
    rowIndex,
    rowSpan: getSpan(cell, 'rowspan'),
    sourceCellId: getOrCreateCellId(cell, rowIndex, cellIndex),
    sourceColumnKey: cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) || undefined,
    tagName: cell.tagName.toLowerCase() as 'td' | 'th',
    text: getText(cell),
  };
};

/** 处理 appendRowSpanSlot 辅助逻辑。 */
const appendRowSpanSlot = (
  row: CopyTestRowModel,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  columnIndex: number,
  activeSlot: ActiveRowSpanSlot
): void => {
  row.slots[columnIndex] = {
    cell: activeSlot.cell,
    columnIndex,
    owned: false,
  };
  if (activeSlot.remainingRows > 1) {
    nextActiveSlots.set(columnIndex, {
      cell: activeSlot.cell,
      remainingRows: activeSlot.remainingRows - 1,
    });
  }
};

/** 处理 skipRowSpanSlots 辅助逻辑。 */
const skipRowSpanSlots = (
  row: CopyTestRowModel,
  activeSlots: Map<number, ActiveRowSpanSlot>,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  startColumnIndex: number
): number => {

  /** 定义 columnIndex 常量。 */
  let columnIndex = startColumnIndex;
  while (activeSlots.has(columnIndex)) {
    appendRowSpanSlot(row, nextActiveSlots, columnIndex, activeSlots.get(columnIndex)!);
    columnIndex += 1;
  }
  return columnIndex;
};

/** 处理 appendOwnedSlots 辅助逻辑。 */
const appendOwnedSlots = (
  row: CopyTestRowModel,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  cell: CopyTestCellModel
): number => {
  for (let offset = 0; offset < cell.colSpan; offset += 1) {

    /** 定义 columnIndex 常量。 */
    const columnIndex = cell.columnIndex + offset;
    row.slots[columnIndex] = { cell, columnIndex, owned: true };
    if (cell.rowSpan > 1) {
      nextActiveSlots.set(columnIndex, { cell, remainingRows: cell.rowSpan - 1 });
    }
  }
  return cell.columnIndex + cell.colSpan;
};

/** 处理 appendTrailingRowSpanSlots 辅助逻辑。 */
const appendTrailingRowSpanSlots = (
  row: CopyTestRowModel,
  activeSlots: Map<number, ActiveRowSpanSlot>,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  startColumnIndex: number
): void => {
  Array.from(activeSlots.keys()).sort((left, right) => left - right).forEach(columnIndex => {
    if (columnIndex >= startColumnIndex && !row.slots[columnIndex]) {
      appendRowSpanSlot(row, nextActiveSlots, columnIndex, activeSlots.get(columnIndex)!);
    }
  });
};

/** 处理 parseRow 辅助逻辑。 */
const parseRow = (
  element: HTMLTableRowElement,
  rowIndex: number,
  activeSlots: Map<number, ActiveRowSpanSlot>
): { activeSlots: Map<number, ActiveRowSpanSlot>; row: CopyTestRowModel } => {

  /** 定义 row 常量。 */
  const row: CopyTestRowModel = { cells: [], element, index: rowIndex, slots: [] };

  /** 定义 nextActiveSlots 常量。 */
  const nextActiveSlots = new Map<number, ActiveRowSpanSlot>();

  /** 定义 columnIndex 常量。 */
  let columnIndex = 0;
  Array.from(element.querySelectorAll<HTMLTableCellElement>('th,td')).forEach((cellElement, cellIndex) => {
    columnIndex = skipRowSpanSlots(row, activeSlots, nextActiveSlots, columnIndex);

    /** 定义 cell 常量。 */
    const cell = createCellModel(cellElement, rowIndex, cellIndex, columnIndex);
    row.cells.push(cell);
    columnIndex = appendOwnedSlots(row, nextActiveSlots, cell);
  });
  appendTrailingRowSpanSlots(row, activeSlots, nextActiveSlots, columnIndex);
  return { activeSlots: nextActiveSlots, row };
};

/** 处理 buildHeaders 辅助逻辑。 */
const buildHeaders = (row?: CopyTestRowModel): CopyTestHeader[] => {
  if (!row) {
    return [];
  }

  return row.slots.map((slot, index) => ({
    generatedType: slot?.cell.generatedType,
    index,
    label: slot?.cell.text || `Column ${index + 1}`,
    sourceCellId: slot?.cell.sourceCellId,
    sourceColumnKey: slot?.cell.sourceColumnKey,
  }));
};

/** 处理 parseTableModel 辅助逻辑。 */
export const parseTableModel = (table: HTMLTableElement): CopyTestTableModel => {

  /** 定义 activeSlots 常量。 */
  let activeSlots = new Map<number, ActiveRowSpanSlot>();

  /** 定义 rows 常量。 */
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr')).map((rowElement, rowIndex) => {

    /** 定义 parsedRow 常量。 */
    const parsedRow = parseRow(rowElement, rowIndex, activeSlots);
    activeSlots = parsedRow.activeSlots;
    return parsedRow.row;
  });

  /** 定义 columnCount 常量。 */
  const columnCount = rows.reduce((maxCount, row) => Math.max(maxCount, row.slots.length), 0);
  return { columnCount, headers: buildHeaders(rows[0]), rows, table };
};

/** 处理 maskIgnoredTableRangeText 辅助逻辑。 */
const maskIgnoredTableRangeText = (storageHtml: string): string => {
  return IGNORED_TABLE_RANGE_PATTERNS.reduce((nextHtml, pattern) => {
    return nextHtml.replace(pattern, match => ' '.repeat(match.length));
  }, storageHtml);
};

/** 处理 isClosingTableTag 辅助逻辑。 */
const isClosingTableTag = (tag: string): boolean => {
  return CLOSING_TABLE_TAG_PATTERN.test(tag);
};

/** 处理 isSelfClosingTableTag 辅助逻辑。 */
const isSelfClosingTableTag = (tag: string): boolean => {
  return SELF_CLOSING_TABLE_TAG_PATTERN.test(tag);
};

/** 处理 closeTableRange 辅助逻辑。 */
const closeTableRange = (
  state: TableRangeScanState,
  matchIndex: number,
  tagLength: number
): TableRangeScanState => {

  /** 定义 nextDepth 常量。 */
  const nextDepth = state.depth - 1;
  if (nextDepth === 0 && state.start >= 0) {
    return {
      depth: nextDepth,
      ranges: [...state.ranges, { end: matchIndex + tagLength, start: state.start }],
      start: state.start,
    };
  }

  return { ...state, depth: nextDepth };
};

/** 处理 openTableRange 辅助逻辑。 */
const openTableRange = (state: TableRangeScanState, matchIndex: number): TableRangeScanState => {
  return {
    depth: state.depth + 1,
    ranges: state.ranges,
    start: state.depth === 0 ? matchIndex : state.start,
  };
};

/** 处理 scanTableRangeTag 辅助逻辑。 */
const scanTableRangeTag = (
  state: TableRangeScanState,
  tag: string,
  matchIndex: number
): TableRangeScanState => {
  if (isClosingTableTag(tag)) {
    return closeTableRange(state, matchIndex, tag.length);
  }

  if (isSelfClosingTableTag(tag)) {
    return state;
  }

  return openTableRange(state, matchIndex);
};

/** 处理 findTableRanges 辅助逻辑。 */
export const findTableRanges = (storageHtml: string): CopyTestTableRange[] => {

  /** 定义 searchableHtml 常量。 */
  const searchableHtml = maskIgnoredTableRangeText(storageHtml);

  /** 定义 state 常量。 */
  let state: TableRangeScanState = { depth: 0, ranges: [], start: -1 };

  /** 定义 match 常量。 */
  let match = TABLE_TAG_PATTERN.exec(searchableHtml);
  while (match) {
    state = scanTableRangeTag(state, match[0], match.index);
    match = TABLE_TAG_PATTERN.exec(searchableHtml);
  }
  return state.ranges;
};

/** 处理 parseStorageTables 辅助逻辑。 */
export const parseStorageTables = (storageHtml: string): CopyTestTableEntry[] => {

  /** 定义 doc 常量。 */
  const doc = parseHtml(storageHtml);

  /** 定义 ranges 常量。 */
  const ranges = findTableRanges(storageHtml);
  return Array.from(doc.querySelectorAll<HTMLTableElement>('table')).map((table, index) => {

    /** 定义 model 常量。 */
    const model = parseTableModel(table);
    return {
      headers: model.headers,
      html: toConfluenceStorageHtml(table.outerHTML),
      index,
      model,
      range: ranges[index],
    };
  });
};

/** 处理 parseSingleTable 辅助逻辑。 */
export const parseSingleTable = (tableHtml: string): CopyTestTableEntry | null => {

  /** 定义 doc 常量。 */
  const doc = parseHtml(tableHtml);

  /** 定义 table 常量。 */
  const table = doc.querySelector<HTMLTableElement>('table');
  if (!table) {
    return null;
  }

  /** 定义 model 常量。 */
  const model = parseTableModel(table);
  return {
    headers: model.headers,
    html: toConfluenceStorageHtml(table.outerHTML),
    index: 0,
    model,
  };
};

/** 处理 isGeneratedHeader 辅助逻辑。 */
export const isGeneratedHeader = (header: CopyTestHeader): boolean => {
  return Boolean(header.generatedType) || header.label.startsWith(COPY_TEST_RESULT_HEADER_PREFIX)
    || header.label.startsWith(COPY_TEST_EVIDENCE_HEADER_PREFIX);
};

/** 处理 getLanguageCode 辅助逻辑。 */
const getLanguageCode = (label: string): string | null => {
  return label.match(/\|values=([^|]+)\|/i)?.[1]?.trim().toLowerCase() || null;
};

/** 处理 isReferenceLanguage 辅助逻辑。 */
const isReferenceLanguage = (language: string | null): boolean => {
  return language === 'gl' || language === 'en' || language?.endsWith('_gl') === true || language?.endsWith('_en') === true;
};

/** 处理 findReferenceColumnIndex 辅助逻辑。 */
export const findReferenceColumnIndex = (
  headers: CopyTestHeader[],
  selectedColumnIndex?: number
): number | undefined => {
  return headers.find(header => header.index !== selectedColumnIndex && isReferenceLanguage(getLanguageCode(header.label)))?.index;
};

/** 处理 getCellText 辅助逻辑。 */
export const getCellText = (row: CopyTestRowModel, columnIndex?: number): string => {
  if (columnIndex === undefined) {
    return '';
  }

  /** 定义 slot 常量。 */
  const slot = row.slots[columnIndex];
  return slot?.owned ? slot.cell.text : '';
};

/** 处理 getPreviewColumnIndexes 辅助逻辑。 */
export const getPreviewColumnIndexes = (
  headers: CopyTestHeader[],
  selectedColumnIndex?: number
): number[] => {
  if (selectedColumnIndex === undefined) {
    return headers.map(header => header.index);
  }

  /** 定义 selectedHeader 常量。 */

  const selectedHeader = headers.find(header => header.index === selectedColumnIndex);

  /** 定义 sourceColumnKey 常量。 */
  const sourceColumnKey = selectedHeader ? getCopyTestSourceColumnKey(selectedHeader.index, selectedHeader.label) : '';

  /** 定义 generatedIndexes 常量。 */
  const generatedIndexes = headers
    .filter(header => header.sourceColumnKey === sourceColumnKey)
    .map(header => header.index);
  return [selectedColumnIndex, ...generatedIndexes];
};

/** 处理 getDataRowIndexes 辅助逻辑。 */
export const getDataRowIndexes = (table: CopyTestTableEntry): number[] => {
  return table.model.rows.slice(1).map((_, index) => index);
};

/** 处理 getSelectableDataRowIndexes 辅助逻辑。 */
export const getSelectableDataRowIndexes = (
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): number[] => {
  if (selectedColumnIndex === undefined) {
    return [];
  }

  return table.model.rows.slice(1)
    .filter(row => row.slots[selectedColumnIndex]?.owned)
    .map(row => row.index - 1);
};

/** 处理 buildRowsForValidation 辅助逻辑。 */
export const buildRowsForValidation = (
  table: CopyTestTableEntry,
  selectedColumnIndex: number,
  referenceColumnIndex?: number,
  selectedRowIndexes: number[] = []
): CopyTestRowInput[] => {

  /** 定义 selectedRows 常量。 */
  const selectedRows = new Set(selectedRowIndexes);
  return table.model.rows.slice(1)
    .filter(row => row.slots[selectedColumnIndex]?.owned)
    .map(row => ({
      expected: getCellText(row, selectedColumnIndex),
      reference: getCellText(row, referenceColumnIndex) || undefined,
      rowIndex: row.index - 1,
    }))
    .filter(row => selectedRows.has(row.rowIndex))
    .filter(row => row.expected.trim() !== '');
};
