/**
 * 文件作用：解析 Confluence 表格结构并构建行列 slot 模型。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';
import { buildCopyTestSpanGrid, type CopyTestGridCellInput, type CopyTestSpanGrid } from './copyTestGridModel';
import {
  COPY_TEST_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_HEADER_PREFIX,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from './tableConstants';

/** CopyTest 生成列支持的业务类型。 */
export type CopyTestGeneratedColumnType =
  | typeof COPY_TEST_GENERATED_RESULT_TYPE
  | typeof COPY_TEST_GENERATED_EVIDENCE_TYPE;

/** 表头在逻辑网格中的结构化信息。 */
export interface CopyTestHeader {
  /** 具备完整 ownership 元数据时识别出的生成列类型。 */
  generatedType?: CopyTestGeneratedColumnType;
  /** 表头在逻辑网格中的列下标。 */
  index: number;
  /** 表头去除 HTML 后的文本。 */
  label: string;
  /** 生成列所属 Comparison Column 的稳定键。 */
  sourceColumnKey?: string;
}

/** 单元格在解析后表格模型中的位置和 ownership 信息。 */
export interface CopyTestCellModel {
  /** 单元格横向覆盖的逻辑列数。 */
  colSpan: number;
  /** 单元格左上角所在的逻辑列下标。 */
  columnIndex: number;
  /** 对应的真实 DOM 单元格。 */
  element: HTMLTableCellElement;
  /** 具备完整 ownership 元数据时识别出的生成列类型。 */
  generatedType?: CopyTestGeneratedColumnType;
  /** 单元格左上角所在的物理行下标。 */
  rowIndex: number;
  /** 单元格纵向覆盖的物理行数。 */
  rowSpan: number;
  /** 生成列所属 Comparison Column 的稳定键。 */
  sourceColumnKey?: string;
  /** 单元格的 HTML 标签类型。 */
  tagName: 'td' | 'th';
  /** 单元格去除 HTML 后的文本。 */
  text: string;
}

/** 逻辑网格中的一个位置及其覆盖单元格。 */
export interface CopyTestCellSlot {
  /** 覆盖当前位置的物理单元格。 */
  cell: CopyTestCellModel;
  /** 当前逻辑位置是否由该物理单元格直接拥有。 */
  owned: boolean;
}

/** 单个物理表格行的解析模型。 */
export interface CopyTestRowModel {
  /** 当前行直接包含的物理单元格。 */
  cells: CopyTestCellModel[];
  /** 对应的真实 DOM 行元素。 */
  element: HTMLTableRowElement;
  /** 行在表格中的物理下标。 */
  index: number;
  /** 当前行按 rowspan/colspan 展开后的逻辑槽位。 */
  slots: Array<CopyTestCellSlot | undefined>;
}

/** 单张表格的行列和合并单元格模型。 */
export interface CopyTestTableModel {
  /** 表格展开后的最大逻辑列数。 */
  columnCount: number;
  /** 第一行投影出的逻辑表头。 */
  headers: CopyTestHeader[];
  /** 按物理顺序解析出的表格行。 */
  rows: CopyTestRowModel[];
  /** 合并单元格合法时构建出的严格二维网格。 */
  spanGrid?: CopyTestSpanGrid;
}

/** 从 Confluence Storage 中解析出的单张表格。 */
export interface CopyTestTableEntry {
  /** 表格的逻辑表头。 */
  headers: CopyTestHeader[];
  /** 规范化后的单表 Storage HTML。 */
  html: string;
  /** 表格在页面顶层表格集合中的下标。 */
  index: number;
  /** 表格的结构化模型。 */
  model: CopyTestTableModel;
}

/** 跨行单元格在后续行中的剩余占位状态。 */
interface ActiveRowSpanSlot {
  /** 正在跨行覆盖的物理单元格。 */
  cell: CopyTestCellModel;
  /** 当前行之后仍需覆盖的行数。 */
  remainingRows: number;
}

/** 匹配 DOMParser 无法可靠保留的 Confluence namespace 自闭合标签。 */
const SELF_CLOSING_STORAGE_TAG_PATTERN = /<((?:ac|ri):[A-Za-z][\w.-]*)([^<>]*?)\s*\/>/g;

/** 当前严格 schema 允许识别的生成列类型集合。 */
const GENERATED_COLUMN_TYPES = new Set<string>([COPY_TEST_GENERATED_RESULT_TYPE, COPY_TEST_GENERATED_EVIDENCE_TYPE]);

/** 回写 Storage 时需要恢复自闭合形式的空 namespace 标签。 */
const EMPTY_NAMESPACE_TAG_NAMES = ['ri:attachment'];

/** 回写 Storage 时统一规范为自闭合形式的 HTML void 标签。 */
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

/** 统一表头标签的首尾空白和连续空白，生成稳定比较文本。 */
export const normalizeLabel = (label: string): string => {
  return label.trim().replace(/\s+/g, ' ');
};

/** 使用逻辑列下标和规范化表头生成双列 ownership 键。 */
export const getCopyTestSourceColumnKey = (columnIndex: number, columnLabel: string): string => {
  return `${columnIndex}:${normalizeLabel(columnLabel)}`;
};

/** 根据生成列类型拼出 Result 或 Evidence 表头文案。 */
export const getGeneratedColumnLabel = (type: CopyTestGeneratedColumnType, sourceLabel: string): string => {
  /** 与生成列类型对应的固定表头前缀。 */
  const prefix =
    type === COPY_TEST_GENERATED_RESULT_TYPE ? COPY_TEST_RESULT_HEADER_PREFIX : COPY_TEST_EVIDENCE_HEADER_PREFIX;
  return `${prefix} ${sourceLabel}`;
};

/** 将 Storage 片段转换为可编辑 DOM，并先展开 namespace 自闭合标签。 */
export const parseHtml = (html: string): Document => {
  /** 供 DOMParser 解析的 namespace 标签成对形式。 */
  const preparedHtml = html.replace(SELF_CLOSING_STORAGE_TAG_PATTERN, '<$1$2></$1>');
  return new DOMParser().parseFromString(preparedHtml, 'text/html');
};

/** 将指定空标签的成对形式恢复为 Confluence Storage 自闭合形式。 */
const normalizePairedTag = (html: string, tagName: string): string => {
  /** 只匹配内容为空的指定标签，避免破坏有效子节点。 */
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>\\s*<\\/${tagName}\\s*>`, HTML_TAG_REGEXP_FLAGS);
  return html.replace(pattern, `<${tagName}$1 />`);
};

/** 为指定 HTML void 标签补齐 Storage 所需的自闭合斜杠。 */
const normalizeOpenVoidTag = (html: string, tagName: string): string => {
  /** 匹配指定 void 标签的普通或自闭合写法。 */
  const pattern = new RegExp(`<${tagName}\\b(\\s[^>]*)?\\s*/?>`, HTML_TAG_REGEXP_FLAGS);
  return html.replace(
    pattern,
    /** 保留已规范化标签，并只为普通开始标签补齐自闭合斜杠。 */
    match => {
      if (match.endsWith('/>')) {
        return match;
      }
      return `${match.slice(0, -1).trimEnd()} />`;
    }
  );
};

/** 删除 DOMParser 为 void 标签补出的无效结束标签。 */
const removeClosingTag = (html: string, tagName: string): string => {
  return html.replace(new RegExp(`<\\/${tagName}\\s*>`, HTML_TAG_REGEXP_FLAGS), '');
};

/** 将 DOM 序列化结果规范化为 Confluence 可接受的 Storage 标签形式。 */
export const toConfluenceStorageHtml = (html: string): string => {
  /** 已完成所有 HTML void 标签规范化的 Storage 文本。 */
  const normalizedVoidTags = VOID_TAG_NAMES.reduce(
    /** 逐类修复 void 标签，保留非目标内容的原始顺序。 */
    (nextHtml, tagName) => {
      return removeClosingTag(normalizeOpenVoidTag(normalizePairedTag(nextHtml, tagName), tagName), tagName);
    },
    html
  );
  return EMPTY_NAMESPACE_TAG_NAMES.reduce(normalizePairedTag, normalizedVoidTags);
};

/** 读取单元格纯文本并去除首尾空白。 */
const getText = (element?: Element | null): string => {
  return element?.textContent?.trim() || '';
};

/** 读取合法正整数 span；缺失或非法值统一回退为一格。 */
const getSpan = (cell: Element, attributeName: 'colspan' | 'rowspan'): number => {
  /** 单元格 span 属性转换得到的数值。 */
  const value = Number(cell.getAttribute(attributeName) || 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

/** 仅识别符合当前 schema 且 ownership 完整的生成列。 */
const getGeneratedType = (cell: Element): CopyTestGeneratedColumnType | undefined => {
  /** 单元格声明的生成列类型。 */
  const value = cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE);
  /** 单元格声明的来源列 ownership 键。 */
  const sourceColumnKey = cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE);
  /** 用于防止跨来源列认领的 owner 标识。 */
  const ownerId = cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE);
  /** 单元格声明的 CopyTest schema 版本。 */
  const schemaVersion = cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE);
  /** ownership 键、owner 和 schema 均符合当前严格契约。 */
  const hasCurrentOwnership =
    Boolean(sourceColumnKey) && ownerId === sourceColumnKey && schemaVersion === COPY_TEST_SCHEMA_VERSION;
  return value && GENERATED_COLUMN_TYPES.has(value) && hasCurrentOwnership
    ? (value as CopyTestGeneratedColumnType)
    : undefined;
};

/** 使用物理行和行内单元格下标生成当前解析周期稳定 ID。 */
const createCellId = (rowIndex: number, cellIndex: number): string => {
  return `copy-test-cell-${rowIndex}-${cellIndex}`;
};

/** 将真实 DOM 单元格转换为带逻辑坐标和 ownership 的模型。 */
const createCellModel = (cell: HTMLTableCellElement, rowIndex: number, columnIndex: number): CopyTestCellModel => {
  /** 当前单元格通过严格 ownership 校验后的生成列类型。 */
  const generatedType = getGeneratedType(cell);
  return {
    colSpan: getSpan(cell, 'colspan'),
    columnIndex,
    element: cell,
    generatedType,
    rowIndex,
    rowSpan: getSpan(cell, 'rowspan'),
    sourceColumnKey: generatedType
      ? cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) || undefined
      : undefined,
    tagName: cell.tagName.toLowerCase() as 'td' | 'th',
    text: getText(cell),
  };
};

/** 将上一行延续的 rowspan 单元格登记为当前行的非拥有槽位。 */
const appendRowSpanSlot = (
  row: CopyTestRowModel,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  columnIndex: number,
  activeSlot: ActiveRowSpanSlot
): void => {
  row.slots[columnIndex] = {
    cell: activeSlot.cell,
    owned: false,
  };
  if (activeSlot.remainingRows > 1) {
    nextActiveSlots.set(columnIndex, {
      cell: activeSlot.cell,
      remainingRows: activeSlot.remainingRows - 1,
    });
  }
};

/** 跳过被既有 rowspan 占据的连续逻辑列并返回首个空列。 */
const skipRowSpanSlots = (
  row: CopyTestRowModel,
  activeSlots: Map<number, ActiveRowSpanSlot>,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  startColumnIndex: number
): number => {
  /** 当前检查的逻辑列下标。 */
  let columnIndex = startColumnIndex;
  while (activeSlots.has(columnIndex)) {
    appendRowSpanSlot(row, nextActiveSlots, columnIndex, activeSlots.get(columnIndex)!);
    columnIndex += 1;
  }
  return columnIndex;
};

/** 将当前物理单元格覆盖的 colspan 槽位登记为当前行直接拥有。 */
const appendOwnedSlots = (
  row: CopyTestRowModel,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  cell: CopyTestCellModel
): number => {
  for (let offset = 0; offset < cell.colSpan; offset += 1) {
    /** 当前 colspan 偏移对应的逻辑列下标。 */
    const columnIndex = cell.columnIndex + offset;
    row.slots[columnIndex] = { cell, owned: true };
    if (cell.rowSpan > 1) {
      nextActiveSlots.set(columnIndex, {
        cell,
        remainingRows: cell.rowSpan - 1,
      });
    }
  }
  return cell.columnIndex + cell.colSpan;
};

/** 补入当前行末尾仍由上一行 rowspan 覆盖的离散槽位。 */
const appendTrailingRowSpanSlots = (
  row: CopyTestRowModel,
  activeSlots: Map<number, ActiveRowSpanSlot>,
  nextActiveSlots: Map<number, ActiveRowSpanSlot>,
  startColumnIndex: number
): void => {
  Array.from(activeSlots.keys())
    .sort(
      /** 按逻辑列从左到右补齐剩余 rowspan 槽位。 */
      (left, right) => left - right
    )
    .forEach(
      /** 只补入当前行尚未登记且位于已解析单元格之后的槽位。 */
      columnIndex => {
        if (columnIndex >= startColumnIndex && !row.slots[columnIndex]) {
          appendRowSpanSlot(row, nextActiveSlots, columnIndex, activeSlots.get(columnIndex)!);
        }
      }
    );
};

/** 展开单个物理行的 rowspan/colspan，生成逻辑槽位模型。 */
const parseRow = (
  element: HTMLTableRowElement,
  rowIndex: number,
  activeSlots: Map<number, ActiveRowSpanSlot>
): { activeSlots: Map<number, ActiveRowSpanSlot>; row: CopyTestRowModel } => {
  /** 当前物理行对应的可变解析模型。 */
  const row: CopyTestRowModel = {
    cells: [],
    element,
    index: rowIndex,
    slots: [],
  };

  /** 需要传递给下一物理行的 rowspan 占位状态。 */
  const nextActiveSlots = new Map<number, ActiveRowSpanSlot>();

  /** 下一个物理单元格尝试放置的逻辑列下标。 */
  let columnIndex = 0;
  Array.from(element.children)
    .filter(
      /** 排除非 th/td 子元素，确保只解析当前物理行直属单元格。 */
      (child): child is HTMLTableCellElement => {
        /** 当前直属子元素的小写标签名。 */
        const tagName = child.tagName.toLowerCase();
        return tagName === 'th' || tagName === 'td';
      }
    )
    .forEach(
      /** 按 DOM 顺序把物理单元格放入首个未被 rowspan 占据的位置。 */
      cellElement => {
        columnIndex = skipRowSpanSlots(row, activeSlots, nextActiveSlots, columnIndex);

        /** 当前 DOM 单元格转换得到的结构化模型。 */
        const cell = createCellModel(cellElement, rowIndex, columnIndex);
        row.cells.push(cell);
        columnIndex = appendOwnedSlots(row, nextActiveSlots, cell);
      }
    );
  appendTrailingRowSpanSlots(row, activeSlots, nextActiveSlots, columnIndex);
  return { activeSlots: nextActiveSlots, row };
};

/** 从第一物理行展开后的槽位构建逻辑表头。 */
const buildHeaders = (row?: CopyTestRowModel): CopyTestHeader[] => {
  if (!row) {
    return [];
  }

  return row.slots.map(
    /** 为每个逻辑列保留标签和严格 ownership 信息。 */
    (slot, index) => ({
      generatedType: slot?.cell.generatedType,
      index,
      label: slot?.cell.text || '',
      sourceColumnKey: slot?.cell.sourceColumnKey,
    })
  );
};

/** 将 DOM cell 模型转换成纯二维网格输入。 */
const buildGridInputRows = (rows: CopyTestRowModel[]): CopyTestGridCellInput[][] => {
  return rows.map(
    /** 将每个物理行投影为不含 DOM 引用的 span 输入行。 */
    row =>
      row.cells.map(
        /** 仅保留严格网格构建所需的单元格 ID 和 span。 */
        (cell, cellIndex) => ({
          cellId: createCellId(row.index, cellIndex),
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
        })
      )
  );
};

/** 构建 span 网格；存在空洞或非法 span 的表格视为无效表格。 */
const buildSpanGrid = (rows: CopyTestRowModel[]): CopyTestSpanGrid | undefined => {
  try {
    return buildCopyTestSpanGrid(buildGridInputRows(rows));
  } catch {
    return undefined;
  }
};

/** 解析单张真实 DOM 表格并构建逻辑行列及严格 span 网格。 */
export const parseTableModel = (table: HTMLTableElement): CopyTestTableModel => {
  /** 当前物理行继承的 rowspan 占位状态。 */
  let activeSlots = new Map<number, ActiveRowSpanSlot>();

  /** 排除嵌套表格后按物理顺序生成的行模型。 */
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'))
    .filter(
      /** 仅保留当前顶层表格直接拥有的行。 */
      rowElement => rowElement.closest('table') === table
    )
    .map(
      /** 顺序解析每行并把 rowspan 状态传递给下一行。 */
      (rowElement, rowIndex) => {
        /** 当前物理行及其后续 rowspan 状态。 */
        const parsedRow = parseRow(rowElement, rowIndex, activeSlots);
        activeSlots = parsedRow.activeSlots;
        return parsedRow.row;
      }
    );

  /** 所有物理行展开后的最大逻辑列数。 */
  const columnCount = rows.reduce(
    /** 使用每行槽位长度更新当前最大逻辑列数。 */
    (maxCount, row) => Math.max(maxCount, row.slots.length),
    0
  );
  return {
    columnCount,
    headers: buildHeaders(rows[0]),
    rows,
    spanGrid: buildSpanGrid(rows),
  };
};

/** 解析整页 Storage 中的全部顶层表格。 */
export const parseStorageTables = (storageHtml: string): CopyTestTableEntry[] => {
  /** 由 Storage 页面解析得到的可查询 DOM。 */
  const doc = parseHtml(storageHtml);

  return Array.from(doc.querySelectorAll<HTMLTableElement>('table'))
    .filter(
      /** 排除嵌套表格，避免同一 Storage 片段被独立回写两次。 */
      table => !table.parentElement?.closest('table')
    )
    .map(
      /** 将顶层 DOM 表格转换为带顺序下标的结构化工作条目。 */
      (table, index) => {
        /** 当前顶层表格的结构化行列模型。 */
        const model = parseTableModel(table);
        return {
          headers: model.headers,
          html: toConfluenceStorageHtml(table.outerHTML),
          index,
          model,
        };
      }
    );
};

/** 解析单表 Storage 片段；缺少 table 根元素时返回 null。 */
export const parseSingleTable = (tableHtml: string): CopyTestTableEntry | null => {
  /** 单表 Storage 片段解析得到的 DOM。 */
  const doc = parseHtml(tableHtml);

  /** 片段内首张可用表格元素。 */
  const table = doc.querySelector<HTMLTableElement>('table');
  if (!table) {
    return null;
  }

  /** 单表 DOM 对应的结构化行列模型。 */
  const model = parseTableModel(table);
  return {
    headers: model.headers,
    html: toConfluenceStorageHtml(table.outerHTML),
    index: 0,
    model,
  };
};

/** 读取指定逻辑列中由当前行直接拥有的单元格文本。 */
const getCellText = (row: CopyTestRowModel, columnIndex: number): string => {
  /** 指定逻辑列在当前行中的槽位。 */
  const slot = row.slots[columnIndex];
  return slot?.owned ? slot.cell.text : '';
};

/** 将选中的 Comparison Column 行转换为严格校验输入。 */
export const buildRowsForValidation = (
  table: Pick<CopyTestTableEntry, 'model'>,
  selectedColumnIndex: number,
  selectedRowIndexes: number[]
): CopyTestRowInput[] => {
  /** 需要发送给校验接口的数据行下标集合。 */
  const selectedRows = new Set(selectedRowIndexes);
  return table.model.rows
    .slice(1)
    .filter(
      /** 只从 Comparison Column 的物理拥有行生成输入，跳过 rowspan 覆盖行。 */
      row => row.slots[selectedColumnIndex]?.owned
    )
    .map(
      /** 将物理行下标转换为接口使用的零起始数据行下标。 */
      row => ({
        expected: getCellText(row, selectedColumnIndex),
        rowIndex: row.index - 1,
      })
    )
    .filter(
      /** 仅保留用户选中的逻辑行。 */
      row => selectedRows.has(row.rowIndex)
    )
    .filter(
      /** 不向校验接口发送 Expected Copy 为空的行。 */
      row => row.expected.trim() !== ''
    );
};
