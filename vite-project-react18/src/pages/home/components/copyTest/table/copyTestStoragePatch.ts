/**
 * 文件作用：提供 Confluence storage 的 raw range 扫描和最小字符串 patch 基础设施。
 */

/** raw 字符串中的半开区间。 */
export interface CopyTestRawRange {
  /** 半开区间中不包含在结果内的结束偏移量。 */
  end: number;
  /** 半开区间中包含在结果内的起始偏移量。 */
  start: number;
}

/** table、tr、th、td 共用的 raw 元素区间。 */
export interface CopyTestRawElementRange extends CopyTestRawRange {
  /** 元素关闭标签在完整 storage 中的绝对区间。 */
  closeTagRange: CopyTestRawRange;
  /** 元素打开标签在完整 storage 中的绝对区间。 */
  openTagRange: CopyTestRawRange;
  /** raw 扫描器支持记录的表格元素标签名。 */
  tagName: 'table' | 'tr' | 'th' | 'td';
}

/** th/td 的 raw 区间。 */
export interface CopyTestRawCellRange extends CopyTestRawElementRange {
  /** 当前单元格实际使用的表头或数据标签名。 */
  tagName: 'th' | 'td';
}

/** tr 的 raw 区间及其直属单元格。 */
export interface CopyTestRawRowRange extends CopyTestRawElementRange {
  /** 当前行直属且不属于嵌套表格的单元格区间。 */
  cells: CopyTestRawCellRange[];
  /** 将该元素范围收窄为表格行。 */
  tagName: 'tr';
}

/** 顶层 table 的 raw 区间及其直属行。 */
export interface CopyTestRawTableRange extends CopyTestRawElementRange {
  /** 当前顶层表格直属且不属于嵌套表格的行区间。 */
  rows: CopyTestRawRowRange[];
  /** 将该元素范围收窄为表格。 */
  tagName: 'table';
}

/** 一次 raw range 替换。 */
export interface CopyTestRawReplacement {
  /** 需要在原 storage 中替换的绝对半开区间。 */
  range: CopyTestRawRange;
  /** 写入目标区间的新 raw storage 片段。 */
  replacement: string;
}

/** raw 标签扫描得到的轻量不可变 token。 */
interface RawTagToken {
  /** 标记当前 token 是否为关闭标签。 */
  closing: boolean;
  /** 已统一为小写的原始标签名。 */
  name: string;
  /** 完整标签在 storage 中的绝对区间。 */
  range: CopyTestRawRange;
  /** 标记打开标签是否在同一个 token 内自闭合。 */
  selfClosing: boolean;
}

/** 尚未读取关闭标签的 raw 元素公共构建状态。 */
interface RawElementBuilder {
  /** 已读取打开标签的绝对区间。 */
  openTagRange: CopyTestRawRange;
  /** 元素完整 raw 区间的起始偏移量。 */
  start: number;
}

/** 尚未完成的 th 或 td 单元格扫描状态。 */
interface RawCellBuilder extends RawElementBuilder {
  /** 当前扫描单元格的真实标签名。 */
  tagName: 'th' | 'td';
}

/** 尚未完成的顶层表格直属行扫描状态。 */
interface RawRowBuilder extends RawElementBuilder {
  /** 当前行中已经完成扫描的直属单元格区间。 */
  cells: CopyTestRawCellRange[];
}

/** 尚未完成的顶层表格扫描状态。 */
interface RawTableBuilder extends RawElementBuilder {
  /** 当前表格中已经完成扫描的直属行区间。 */
  rows: CopyTestRawRowRange[];
}

/** 单次线性 storage 扫描持有的可变上下文。 */
interface RawStorageScanState {
  /** 当前尚未闭合的直属单元格。 */
  cell?: RawCellBuilder;
  /** 当前尚未闭合的顶层表格直属行。 */
  row?: RawRowBuilder;
  /** 当前尚未闭合的顶层表格。 */
  table?: RawTableBuilder;
  /** 当前 token 所处的 table 嵌套深度。 */
  tableDepth: number;
  /** 已完成扫描的全部顶层表格区间。 */
  tables: CopyTestRawTableRange[];
}

/** Confluence 标签名允许使用的字符。 */
const RAW_TAG_NAME_CHARACTER_PATTERN = /[A-Za-z0-9:_-]/;
/** 用于跳过标签名周围空白的单字符模式。 */
const RAW_WHITESPACE_PATTERN = /\s/;
/** 扫描时必须整体跳过、不能解释为表格标签的特殊 raw block。 */
const SPECIAL_RAW_BLOCKS = [
  { prefix: '<!--', suffix: '-->' },
  { prefix: '<![CDATA[', suffix: ']]>' },
] as const;

/** 校验 range 是否可用于给定 raw 字符串。 */
const assertValidRawRange = (raw: string, range: CopyTestRawRange): void => {
  /** 标记区间边界是否为整数、有序且完全位于 raw 字符串内。 */
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
  /** 复制后按起点和终点排序的区间，避免修改调用方数组。 */
  const sortedRanges = ranges.map(
    /** 复制每个区间，避免排序过程修改调用方持有的对象。 */
    range => ({ ...range })
  ).sort(
    /** 先按起点、再按终点升序稳定排列区间。 */
    (left, right) => left.start - right.start || left.end - right.end
  );
  sortedRanges.forEach(
    /** 在检查相互重叠前逐个验证区间边界。 */
    range => assertValidRawRange(raw, range)
  );
  assertNonOverlappingRanges(sortedRanges);
  return sortedRanges;
};

/** 查找 comment 或 CDATA block 的结束位置。 */
const getSpecialRawBlockEnd = (raw: string, start: number): number | undefined => {
  /** 与当前位置前缀匹配的注释或 CDATA 语法。 */
  const block = SPECIAL_RAW_BLOCKS.find(
    /** 选择前缀与当前位置 raw 内容匹配的特殊块语法。 */
    item => raw.startsWith(item.prefix, start)
  );
  if (!block) {
    return undefined;
  }

  /** 特殊块结束标记在 storage 中的起始偏移量。 */
  const suffixIndex = raw.indexOf(block.suffix, start + block.prefix.length);
  return suffixIndex < 0 ? raw.length : suffixIndex + block.suffix.length;
};

/** 查找标签结束位置，同时忽略引号内的 >。 */
const findRawTagEnd = (raw: string, start: number): number => {
  let quote = '';
  for (let index = start + 1; index < raw.length; index += 1) {
    /** 当前待判断的标签字符。 */
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
  /** 标记标签名之前是否存在关闭斜杠。 */
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
  /** 标签名的起点以及是否为关闭标签。 */
  const nameStart = readRawTagNameStart(raw, start, end);
  /** 标签名最后一个字符之后的偏移量。 */
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
    /** 下一个可能打开 raw 标签的位置。 */
    const start = raw.indexOf('<', nextCursor);
    if (start < 0) {
      return null;
    }
    /** 若当前位置是注释或 CDATA，则记录其整体结束位置。 */
    const specialEnd = getSpecialRawBlockEnd(raw, start);
    if (specialEnd !== undefined) {
      nextCursor = specialEnd;
      continue;
    }
    /** 忽略属性引号后得到的完整标签结束位置。 */
    const end = findRawTagEnd(raw, start);
    if (end < 0) {
      return null;
    }
    /** 当前完整标签解析得到的轻量 token。 */
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
  /** 当前 table 深度、未闭合元素和完成结果组成的扫描状态。 */
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
  /** 按原始起点排序的 replacement 副本。 */
  const sortedReplacements = [...replacements].sort(
    /** 先按目标起点、再按终点稳定排列 replacement。 */
    (left, right) => left.range.start - right.range.start || left.range.end - right.range.end
  );
  /** 已完成边界和重叠校验的规范区间。 */
  const ranges = prepareRanges(raw, sortedReplacements.map(
    /** 提取每个 replacement 的待校验目标区间。 */
    item => item.range
  ));
  /** 绑定规范区间并按降序执行的 replacement 列表。 */
  const normalized = sortedReplacements.map(
    /** 将排序后的 replacement 与完成校验的同下标区间重新绑定。 */
    (item, index) => ({ ...item, range: ranges[index] })
  ).reverse();
  return normalized.reduce(
    /** 从较大 offset 向前替换，确保尚未处理区间的坐标保持有效。 */
    (nextRaw, item) => {
      return `${nextRaw.slice(0, item.range.start)}${item.replacement}${nextRaw.slice(item.range.end)}`;
    },
    raw
  );
};

/** 读取排除目标 ranges 后的所有原始字符串片段。 */
export const getNonTargetRawSegments = (
  raw: string,
  targetRanges: CopyTestRawRange[]
): string[] => {
  /** 经过排序和重叠校验的目标区间。 */
  const ranges = prepareRanges(raw, targetRanges);
  /** 按原始顺序收集的全部非目标字符串片段。 */
  const segments: string[] = [];
  let cursor = 0;
  ranges.forEach(
    /** 收集当前游标到目标区间起点之间的非目标原始片段。 */
    range => {
      segments.push(raw.slice(cursor, range.start));
      cursor = range.end;
    }
  );
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
  /** 修改前排除目标区间后的原始片段。 */
  const beforeSegments = getNonTargetRawSegments(beforeRaw, beforeTargetRanges);
  /** 修改后排除目标区间后的原始片段。 */
  const afterSegments = getNonTargetRawSegments(afterRaw, afterTargetRanges);
  return beforeSegments.length === afterSegments.length
    && beforeSegments.every(
      /** 要求每个非目标片段都与修改后同位置片段逐字节一致。 */
      (segment, index) => segment === afterSegments[index]
    );
};
