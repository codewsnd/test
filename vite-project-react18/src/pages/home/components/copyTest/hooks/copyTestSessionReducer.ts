/**
 * 文件作用：使用纯 reducer 管理 CopyTest 表格会话的基础状态。
 */
import type { CopyTestTableEntry } from '../types';

/** CopyTest 表格会话的可归约状态。 */
export interface CopyTestSessionState {
  originalStorageHtml: string;
  revision: number;
  selectedColumnIndex?: number;
  selectedRowIndexes: number[];
  selectedTableIndex?: number;
  tables: CopyTestTableEntry[];
}

/** CopyTest 表格会话支持的状态动作。 */
export type CopyTestSessionAction =
  | { type: 'RESET' }
  | { storageHtml: string; tables: CopyTestTableEntry[]; type: 'LOADED' }
  | { tableIndex: number; type: 'TABLE_SELECTED' }
  | {
    columnIndex?: number;
    defaultSelectedRowIndexes?: number[];
    nextTable?: CopyTestTableEntry;
    type: 'COLUMN_SELECTED';
  }
  | { selectedRowIndexes: number[]; type: 'ROWS_SELECTED' }
  | { table: CopyTestTableEntry; type: 'TABLE_UPDATED' }
  | { nextTables: CopyTestTableEntry[]; storageHtml: string; type: 'EXPORT_COMMITTED' };

/** 创建指定版本的空会话状态。 */
const createEmptySessionState = (revision: number): CopyTestSessionState => ({
  originalStorageHtml: '',
  revision,
  selectedColumnIndex: undefined,
  selectedRowIndexes: [],
  selectedTableIndex: undefined,
  tables: [],
});

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
        revision: state.revision + 1,
        tables: replaceTable(state.tables, action.table),
      };
    case 'EXPORT_COMMITTED':
      return {
        ...state,
        originalStorageHtml: action.storageHtml,
        revision: state.revision + 1,
        tables: [...action.nextTables],
      };
    default:
      return state;
  }
};
