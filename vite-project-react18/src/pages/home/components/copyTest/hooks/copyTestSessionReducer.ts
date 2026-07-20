/**
 * 文件作用：使用纯 reducer 管理 CopyTest 表格会话的基础状态。
 */
import type { CopyTestTableEntry } from '../types';

/** CopyTest 表格会话的可归约状态。 */
export interface CopyTestSessionState {
  /** 最近一次成功导入或导出后的完整 storage。 */
  originalStorageHtml: string;
  /** 已产生本地变更且等待回写的表格来源列 Pair 键。 */
  pendingExportPairKeys: string[];
  /** working table 内容变更时递增的渲染版本号。 */
  revision: number;
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex?: number;
  /** 当前选中的来源原子组锚点行下标。 */
  selectedRowIndexes: number[];
  /** 当前表格在 storage 中的下标。 */
  selectedTableIndex?: number;
  /** storage 中解析出的全部有效表格。 */
  tables: CopyTestTableEntry[];
}

/** CopyTest 表格会话支持的状态动作。 */
export type CopyTestSessionAction =
  | {
    /** 清空当前导入页面及其全部本地工作状态。 */
    type: 'RESET';
  }
  | { storageHtml: string; tables: CopyTestTableEntry[]; type: 'LOADED' }
  | { tableIndex: number; type: 'TABLE_SELECTED' }
  | {
    columnIndex?: number;
    defaultSelectedRowIndexes?: number[];
    nextTable?: CopyTestTableEntry;
    type: 'COLUMN_SELECTED';
  }
  | { selectedRowIndexes: number[]; type: 'ROWS_SELECTED' }
  | {
    /** 本次表格变更所属的待回写 Pair 键。 */
    pendingExportPairKey: string;
    /** 已应用本地变更的工作表格。 */
    table: CopyTestTableEntry;
    /** 表格本地变更动作类型。 */
    type: 'TABLE_UPDATED';
  }
  | {
    /** 本次成功回写且应清除待回写状态的 Pair 键。 */
    exportedPairKey?: string;
    /** 使用最新原始快照刷新的工作表格集合。 */
    nextTables: CopyTestTableEntry[];
    /** 成功回写后的完整 storage。 */
    storageHtml: string;
    /** 导出提交动作类型。 */
    type: 'EXPORT_COMMITTED';
  };

/** 创建指定版本的空会话状态。 */
const createEmptySessionState = (revision: number): CopyTestSessionState => ({
  originalStorageHtml: '',
  pendingExportPairKeys: [],
  revision,
  selectedColumnIndex: undefined,
  selectedRowIndexes: [],
  selectedTableIndex: undefined,
  tables: [],
});

/** 把指定 Pair 加入待回写集合并保持键唯一。 */
const addPendingExportPairKey = (pairKeys: string[], pairKey: string): string[] => {
  if (pairKeys.includes(pairKey)) {
    return pairKeys;
  }

  return [...pairKeys, pairKey];
};

/** 从待回写集合移除本次成功导出的 Pair。 */
const removePendingExportPairKey = (
  pairKeys: string[],
  exportedPairKey: string | undefined
): string[] => {
  if (!exportedPairKey) {
    return pairKeys;
  }

  return pairKeys.filter(pairKey => pairKey !== exportedPairKey);
};

/** CopyTest reducer 的初始状态。 */
export const copyTestSessionInitialState: CopyTestSessionState = createEmptySessionState(0);

/** 使用新表格替换同下标的工作表格。 */
const replaceTable = (
  tables: CopyTestTableEntry[],
  nextTable: CopyTestTableEntry
): CopyTestTableEntry[] => {
  return tables.map(table => (table.index === nextTable.index ? nextTable : table));
};

/** 应用 Comparison Column 选择及其可选工作表格更新。 */
const reduceColumnSelection = (
  state: CopyTestSessionState,
  action: Extract<CopyTestSessionAction, { type: 'COLUMN_SELECTED' }>
): CopyTestSessionState => {
  /** 选择列被清空时同步清空，否则复制默认来源原子组选择。 */
  const selectedRowIndexes = action.columnIndex === undefined
    ? []
    : [...(action.defaultSelectedRowIndexes || [])];
  if (!action.nextTable) {
    return {
      ...state,
      selectedColumnIndex: action.columnIndex,
      selectedRowIndexes,
    };
  }

  return {
    ...state,
    revision: state.revision + 1,
    selectedColumnIndex: action.columnIndex,
    selectedRowIndexes,
    tables: replaceTable(state.tables, action.nextTable),
  };
};

/** 归约 CopyTest 表格会话动作。 */
export const copyTestSessionReducer = (
  state: CopyTestSessionState,
  action: CopyTestSessionAction
): CopyTestSessionState => {
  switch (action.type) {
    case 'RESET':
      return createEmptySessionState(state.revision + 1);
    case 'LOADED':
      return {
        originalStorageHtml: action.storageHtml,
        pendingExportPairKeys: [],
        revision: state.revision + 1,
        selectedColumnIndex: undefined,
        selectedRowIndexes: [],
        selectedTableIndex: action.tables[0]?.index,
        tables: [...action.tables],
      };
    case 'TABLE_SELECTED':
      return {
        ...state,
        selectedColumnIndex: undefined,
        selectedRowIndexes: [],
        selectedTableIndex: action.tableIndex,
      };
    case 'COLUMN_SELECTED':
      return reduceColumnSelection(state, action);
    case 'ROWS_SELECTED':
      return {
        ...state,
        selectedRowIndexes: [...action.selectedRowIndexes],
      };
    case 'TABLE_UPDATED':
      return {
        ...state,
        pendingExportPairKeys: addPendingExportPairKey(
          state.pendingExportPairKeys,
          action.pendingExportPairKey
        ),
        revision: state.revision + 1,
        tables: replaceTable(state.tables, action.table),
      };
    case 'EXPORT_COMMITTED':
      return {
        ...state,
        originalStorageHtml: action.storageHtml,
        pendingExportPairKeys: removePendingExportPairKey(
          state.pendingExportPairKeys,
          action.exportedPairKey
        ),
        revision: state.revision + 1,
        tables: [...action.nextTables],
      };
    default:
      return state;
  }
};
