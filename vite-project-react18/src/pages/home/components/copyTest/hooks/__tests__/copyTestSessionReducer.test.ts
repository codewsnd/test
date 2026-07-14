import { describe, expect, it } from 'vitest';
import type { CopyTestTableEntry } from '../../types';
import {
  copyTestSessionInitialState,
  copyTestSessionReducer,
} from '../copyTestSessionReducer';

/** 创建 reducer 测试所需的最小工作表格。 */
const createTable = (index: number, workingHtml = `table-${index}`): CopyTestTableEntry => {
  return {
    headers: [],
    html: workingHtml,
    index,
    model: {} as CopyTestTableEntry['model'],
    originalHtml: workingHtml,
    workingHtml,
  };
};

describe('copyTestSessionReducer', () => {
  it('loads tables, selects the first table, and clears column state when switching tables', () => {
    const tables = [createTable(2), createTable(5)];
    const loaded = copyTestSessionReducer(copyTestSessionInitialState, {
      storageHtml: 'storage-v1',
      tables,
      type: 'LOADED',
    });
    const withColumn = copyTestSessionReducer(loaded, {
      columnIndex: 3,
      defaultSelectedRowIndexes: [0, 2],
      type: 'COLUMN_SELECTED',
    });
    const selected = copyTestSessionReducer(withColumn, {
      tableIndex: 5,
      type: 'TABLE_SELECTED',
    });

    expect(loaded).toMatchObject({
      originalStorageHtml: 'storage-v1',
      revision: 1,
      selectedTableIndex: 2,
      tables,
    });
    expect(selected).toMatchObject({
      revision: 1,
      selectedColumnIndex: undefined,
      selectedRowIndexes: [],
      selectedTableIndex: 5,
    });
  });

  it('updates a selected column, rows, and table revisions immutably', () => {
    const originalTable = createTable(0);
    const loaded = copyTestSessionReducer(copyTestSessionInitialState, {
      storageHtml: 'storage-v1',
      tables: [originalTable],
      type: 'LOADED',
    });
    const selectedTable = createTable(0, 'selected-column');
    const withColumn = copyTestSessionReducer(loaded, {
      columnIndex: 1,
      defaultSelectedRowIndexes: [0, 3],
      nextTable: selectedTable,
      type: 'COLUMN_SELECTED',
    });
    const withRows = copyTestSessionReducer(withColumn, {
      selectedRowIndexes: [3],
      type: 'ROWS_SELECTED',
    });
    const updatedTable = createTable(0, 'validated');
    const updated = copyTestSessionReducer(withRows, {
      table: updatedTable,
      type: 'TABLE_UPDATED',
    });
    const clearedColumn = copyTestSessionReducer(updated, {
      columnIndex: undefined,
      defaultSelectedRowIndexes: [9],
      type: 'COLUMN_SELECTED',
    });

    expect(withColumn).toMatchObject({
      revision: 2,
      selectedColumnIndex: 1,
      selectedRowIndexes: [0, 3],
      tables: [selectedTable],
    });
    expect(withRows).toMatchObject({ revision: 2, selectedRowIndexes: [3] });
    expect(updated).toMatchObject({ revision: 3, tables: [updatedTable] });
    expect(clearedColumn).toMatchObject({
      revision: 3,
      selectedColumnIndex: undefined,
      selectedRowIndexes: [],
    });
    expect(originalTable.workingHtml).toBe('table-0');
  });

  it('commits exported storage and resets structural state with increasing revisions', () => {
    const loaded = copyTestSessionReducer(copyTestSessionInitialState, {
      storageHtml: 'storage-v1',
      tables: [createTable(0)],
      type: 'LOADED',
    });
    const exportedTables = [createTable(0, 'exported')];
    const exported = copyTestSessionReducer(loaded, {
      nextTables: exportedTables,
      storageHtml: 'storage-v2',
      type: 'EXPORT_COMMITTED',
    });
    const reset = copyTestSessionReducer(exported, { type: 'RESET' });

    expect(exported).toMatchObject({
      originalStorageHtml: 'storage-v2',
      revision: 2,
      tables: exportedTables,
    });
    expect(reset).toEqual({
      originalStorageHtml: '',
      revision: 3,
      selectedColumnIndex: undefined,
      selectedRowIndexes: [],
      selectedTableIndex: undefined,
      tables: [],
    });
  });
});
