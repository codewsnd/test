/**
 * 文件作用：提供 Confluence storage 的 raw range 扫描和最小字符串 patch 基础设施。
 */

/** raw 字符串中的半开区间。 */
export interface CopyTestRawRange {
  end: number;
  start: number;
}

/** table、tr、th、td 共用的 raw 元素区间。 */
export interface CopyTestRawElementRange extends CopyTestRawRange {
  closeTagRange: CopyTestRawRange;
  openTagRange: CopyTestRawRange;
  tagName: 'table' | 'tr' | 'th' | 'td';
}

/** th/td 的 raw 区间。 */
export interface CopyTestRawCellRange extends CopyTestRawElementRange {
  tagName: 'th' | 'td';
}

/** tr 的 raw 区间及其直属单元格。 */
export interface CopyTestRawRowRange extends CopyTestRawElementRange {
  cells: CopyTestRawCellRange[];
  tagName: 'tr';
}

/** 顶层 table 的 raw 区间及其直属行。 */
export interface CopyTestRawTableRange extends CopyTestRawElementRange {
  rows: CopyTestRawRowRange[];
  tagName: 'table';
}

/** 一次 raw range 替换。 */
export interface CopyTestRawReplacement {
  range: CopyTestRawRange;
  replacement: string;
}

/** 带旧值校验的 CopyTest owned range。 */
export interface CopyTestOwnedRawTarget {
  expectedRaw: string;
  range: CopyTestRawRange;
}

interface RawTagToken {
  closing: boolean;
  name: string;
  range: CopyTestRawRange;
  selfClosing: boolean;
}

interface RawElementBuilder {
  openTagRange: CopyTestRawRange;
  start: number;
}

interface RawCellBuilder extends RawElementBuilder {
  tagName: 'th' | 'td';
}

interface RawRowBuilder extends RawElementBuilder {
  cells: CopyTestRawCellRange[];
}

interface RawTableBuilder extends RawElementBuilder {
  rows: CopyTestRawRowRange[];
}

interface RawStorageScanState {
  cell?: RawCellBuilder;
  row?: RawRowBuilder;
  table?: RawTableBuilder;
  tableDepth: number;
  tables: CopyTestRawTableRange[];
}

const RAW_TAG_NAME_CHARACTER_PATTERN = /[A-Za-z0-9:_-]/;
const RAW_WHITESPACE_PATTERN = /\s/;
const RAW_CELL_START_PATTERN = /^\s*<(?:th|td)\b/i;
const RAW_ROW_CLOSE_PATTERN = /^<\/tr\s*>$/i;
const COPY_TEST_OWNERSHIP_PATTERN = /\bdata-copy-test-(?:column-type|generated-content|owner|pair-id|source-column-key)\s*=/i;

const SPECIAL_RAW_BLOCKS = [
  { prefix: '<!--', suffix: '-->' },
  { prefix: '<![CDATA[', suffix: ']]>' },
] as const;

/** 校验 range 是否可用于给定 raw 字符串。 */
const assertValidRawRange = (raw: string, range: CopyTestRawRange): void => {
  const valid = Number.isInteger(range.start)
    && Number.isInteger(range.end)
    && range.start >= 0
    && range.start <= range.end
    && range.end <= raw.length;
  if (!valid) {
    throw new RangeError('Raw range is outside the storage bounds');
  }
};

/** 确保按起点升序排列的 ranges 不重叠。 */
const assertNonOverlappingRanges = (ranges: CopyTestRawRange[]): void => {
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end) {
      throw new RangeError('Raw ranges must not overlap');
    }
  }
};

/** 复制、校验并按起点升序排列 ranges。 */
const prepareRanges = (raw: string, ranges: CopyTestRawRange[]): CopyTestRawRange[] => {
  const sortedRanges = ranges.map(range => ({ ...range }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  sortedRanges.forEach(range => assertValidRawRange(raw, range));
  assertNonOverlappingRanges(sortedRanges);
  return sortedRanges;
};

/** 查找 comment 或 CDATA block 的结束位置。 */
const getSpecialRawBlockEnd = (raw: string, start: number): number | undefined => {
  const block = SPECIAL_RAW_BLOCKS.find(item => raw.startsWith(item.prefix, start));
  if (!block) {
    return undefined;
  }

  const suffixIndex = raw.indexOf(block.suffix, start + block.prefix.length);
  return suffixIndex < 0 ? raw.length : suffixIndex + block.suffix.length;
};

/** 查找标签结束位置，同时忽略引号内的 >。 */
const findRawTagEnd = (raw: string, start: number): number => {
  let quote = '';
  for (let index = start + 1; index < raw.length; index += 1) {
    const character = raw[index];
    if (quote) {
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index + 1;
    }
  }
  return -1;
};

/** 跳过标签名之前的空白和关闭斜杠。 */
const readRawTagNameStart = (raw: string, start: number, end: number): { closing: boolean; index: number } => {
  let index = start + 1;
  while (index < end && RAW_WHITESPACE_PATTERN.test(raw[index])) {
    index += 1;
  }
  const closing = raw[index] === '/';
  if (closing) {
    index += 1;
  }
  while (index < end && RAW_WHITESPACE_PATTERN.test(raw[index])) {
    index += 1;
  }
  return { closing, index };
};

/** 读取标签名结束位置。 */
const readRawTagNameEnd = (raw: string, start: number, end: number): number => {
  let index = start;
  while (index < end && RAW_TAG_NAME_CHARACTER_PATTERN.test(raw[index])) {
    index += 1;
  }
  return index;
};

/** 判断打开标签是否以 /> 结束。 */
const isSelfClosingRawTag = (raw: string, start: number, end: number): boolean => {
  let index = end - 2;
  while (index > start && RAW_WHITESPACE_PATTERN.test(raw[index])) {
    index -= 1;
  }
  return raw[index] === '/';
};

/** 把一个完整 raw 标签解析成轻量 token。 */
const parseRawTagToken = (raw: string, start: number, end: number): RawTagToken | null => {
  const nameStart = readRawTagNameStart(raw, start, end);
  const nameEnd = readRawTagNameEnd(raw, nameStart.index, end);
  if (nameEnd === nameStart.index) {
    return null;
  }

  return {
    closing: nameStart.closing,
    name: raw.slice(nameStart.index, nameEnd).toLowerCase(),
    range: { end, start },
    selfClosing: !nameStart.closing && isSelfClosingRawTag(raw, start, end),
  };
};

/** 从指定位置读取下一个非 comment、非 CDATA 的标签。 */
const readNextRawTag = (raw: string, cursor: number): RawTagToken | null => {
  let nextCursor = cursor;
  while (nextCursor < raw.length) {
    const start = raw.indexOf('<', nextCursor);
    if (start < 0) {
      return null;
    }
    const specialEnd = getSpecialRawBlockEnd(raw, start);
    if (specialEnd !== undefined) {
      nextCursor = specialEnd;
      continue;
    }
    const end = findRawTagEnd(raw, start);
    if (end < 0) {
      return null;
    }
    const token = parseRawTagToken(raw, start, end);
    if (token) {
      return token;
    }
    nextCursor = end;
  }
  return null;
};

/** 开始记录一个顶层 table。 */
const beginRawTable = (state: RawStorageScanState, token: RawTagToken): void => {
  state.table = {
    openTagRange: token.range,
    rows: [],
    start: token.range.start,
  };
};

/** 完成当前 cell。 */
const completeRawCell = (state: RawStorageScanState, token: RawTagToken): void => {
  if (!state.cell || !state.row || state.cell.tagName !== token.name) {
    return;
  }
  state.row.cells.push({
    closeTagRange: token.range,
    end: token.range.end,
    openTagRange: state.cell.openTagRange,
    start: state.cell.start,
    tagName: state.cell.tagName,
  });
  state.cell = undefined;
};

/** 完成当前 row。 */
const completeRawRow = (state: RawStorageScanState, token: RawTagToken): void => {
  if (!state.row || !state.table || state.cell) {
    return;
  }
  state.table.rows.push({
    cells: state.row.cells,
    closeTagRange: token.range,
    end: token.range.end,
    openTagRange: state.row.openTagRange,
    start: state.row.start,
    tagName: 'tr',
  });
  state.row = undefined;
};

/** 完成当前顶层 table。 */
const completeRawTable = (state: RawStorageScanState, token: RawTagToken): void => {
  if (!state.table || state.row || state.cell) {
    state.table = undefined;
    state.row = undefined;
    state.cell = undefined;
    return;
  }
  state.tables.push({
    closeTagRange: token.range,
    end: token.range.end,
    openTagRange: state.table.openTagRange,
    rows: state.table.rows,
    start: state.table.start,
    tagName: 'table',
  });
  state.table = undefined;
};

/** 处理 table 打开标签，并跳过嵌套 table 的内部行列。 */
const handleRawTableOpen = (state: RawStorageScanState, token: RawTagToken): void => {
  if (token.selfClosing) {
    return;
  }
  if (state.tableDepth === 0) {
    beginRawTable(state, token);
  }
  state.tableDepth += 1;
};

/** 处理 table 关闭标签。 */
const handleRawTableClose = (state: RawStorageScanState, token: RawTagToken): void => {
  if (state.tableDepth === 0) {
    return;
  }
  if (state.tableDepth === 1) {
    completeRawTable(state, token);
  }
  state.tableDepth -= 1;
};

/** 处理顶层 table 内的行列打开标签。 */
const handleRawContentOpen = (state: RawStorageScanState, token: RawTagToken): void => {
  if (token.selfClosing || state.tableDepth !== 1 || !state.table) {
    return;
  }
  if (token.name === 'tr' && !state.row) {
    state.row = { cells: [], openTagRange: token.range, start: token.range.start };
  } else if ((token.name === 'th' || token.name === 'td') && state.row && !state.cell) {
    state.cell = {
      openTagRange: token.range,
      start: token.range.start,
      tagName: token.name,
    };
  }
};

/** 处理顶层 table 内的行列关闭标签。 */
const handleRawContentClose = (state: RawStorageScanState, token: RawTagToken): void => {
  if (state.tableDepth !== 1) {
    return;
  }
  if (token.name === 'th' || token.name === 'td') {
    completeRawCell(state, token);
  } else if (token.name === 'tr') {
    completeRawRow(state, token);
  }
};

/** 将扫描到的标签应用到当前扫描状态。 */
const applyRawTagToken = (state: RawStorageScanState, token: RawTagToken): void => {
  if (token.name === 'table') {
    if (token.closing) {
      handleRawTableClose(state, token);
    } else {
      handleRawTableOpen(state, token);
    }
    return;
  }
  if (token.closing) {
    handleRawContentClose(state, token);
  } else {
    handleRawContentOpen(state, token);
  }
};

/** 扫描 storage 中所有顶层 table，并记录 table/tr/th/td 的绝对 raw range。 */
export const scanTopLevelTableRawRanges = (storageHtml: string): CopyTestRawTableRange[] => {
  const state: RawStorageScanState = { tableDepth: 0, tables: [] };
  let cursor = 0;
  let token = readNextRawTag(storageHtml, cursor);
  while (token) {
    applyRawTagToken(state, token);
    cursor = token.range.end;
    token = readNextRawTag(storageHtml, cursor);
  }
  return state.tables;
};

/** 读取 range 对应的原始字符串。 */
export const getRawRangeText = (raw: string, range: CopyTestRawRange): string => {
  assertValidRawRange(raw, range);
  return raw.slice(range.start, range.end);
};

/** 从后向前应用互不重叠的 raw replacements，避免前一处修改破坏后续 offset。 */
export const replaceRangesDescending = (
  raw: string,
  replacements: CopyTestRawReplacement[]
): string => {
  const sortedReplacements = [...replacements]
    .sort((left, right) => left.range.start - right.range.start || left.range.end - right.range.end);
  const ranges = prepareRanges(raw, sortedReplacements.map(item => item.range));
  const normalized = sortedReplacements.map((item, index) => ({ ...item, range: ranges[index] })).reverse();
  return normalized.reduce((nextRaw, item) => {
    return `${nextRaw.slice(0, item.range.start)}${item.replacement}${nextRaw.slice(item.range.end)}`;
  }, raw);
};

/** 只在指定 row 的关闭标签之前插入一个 raw cell；相同尾部 cell 已存在时保持幂等。 */
export const insertRawCellBeforeRowClosingTag = (
  raw: string,
  row: CopyTestRawRowRange,
  rawCell: string
): string => {
  assertValidRawRange(raw, row.closeTagRange);
  if (!RAW_ROW_CLOSE_PATTERN.test(getRawRangeText(raw, row.closeTagRange))) {
    throw new Error('Row closing tag range is stale');
  }
  if (!RAW_CELL_START_PATTERN.test(rawCell)) {
    throw new Error('Inserted raw content must be a th or td cell');
  }

  const insertionIndex = row.closeTagRange.start;
  const existingStart = insertionIndex - rawCell.length;
  if (existingStart >= row.openTagRange.end && raw.slice(existingStart, insertionIndex) === rawCell) {
    return raw;
  }
  return replaceRangesDescending(raw, [{
    range: { end: insertionIndex, start: insertionIndex },
    replacement: rawCell,
  }]);
};

/** 校验 owned target 的旧值和 ownership marker。 */
const assertOwnedRawTarget = (raw: string, target: CopyTestOwnedRawTarget): void => {
  const currentRaw = getRawRangeText(raw, target.range);
  if (currentRaw !== target.expectedRaw) {
    throw new Error('Owned raw range no longer matches the expected content');
  }
  if (!COPY_TEST_OWNERSHIP_PATTERN.test(currentRaw)) {
    throw new Error('Raw range is not marked as CopyTest-owned');
  }
};

/** 替换指定且仍匹配旧值的 CopyTest-owned raw range。 */
export const replaceOwnedRawRange = (
  raw: string,
  target: CopyTestOwnedRawTarget,
  replacement: string
): string => {
  assertOwnedRawTarget(raw, target);
  if (target.expectedRaw === replacement) {
    return raw;
  }
  return replaceRangesDescending(raw, [{ range: target.range, replacement }]);
};

/** 删除指定且仍匹配旧值的 CopyTest-owned raw range。 */
export const deleteOwnedRawRange = (raw: string, target: CopyTestOwnedRawTarget): string => {
  return replaceOwnedRawRange(raw, target, '');
};

/** 读取排除目标 ranges 后的所有原始字符串片段。 */
export const getNonTargetRawSegments = (
  raw: string,
  targetRanges: CopyTestRawRange[]
): string[] => {
  const ranges = prepareRanges(raw, targetRanges);
  const segments: string[] = [];
  let cursor = 0;
  ranges.forEach(range => {
    segments.push(raw.slice(cursor, range.start));
    cursor = range.end;
  });
  segments.push(raw.slice(cursor));
  return segments;
};

/** 比较 patch 前后各自目标 ranges 之外的 raw 字节是否完全一致。 */
export const hasUnchangedNonTargetRaw = (
  beforeRaw: string,
  beforeTargetRanges: CopyTestRawRange[],
  afterRaw: string,
  afterTargetRanges: CopyTestRawRange[]
): boolean => {
  const beforeSegments = getNonTargetRawSegments(beforeRaw, beforeTargetRanges);
  const afterSegments = getNonTargetRawSegments(afterRaw, afterTargetRanges);
  return beforeSegments.length === afterSegments.length
    && beforeSegments.every((segment, index) => segment === afterSegments[index]);
};
