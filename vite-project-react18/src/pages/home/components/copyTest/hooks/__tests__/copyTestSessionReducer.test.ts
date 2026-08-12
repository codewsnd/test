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
      pendingExportPairKeys: ['2:0:Target'],
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
      pendingExportPairKeys: ['2:0:Target'],
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
      pendingExportPairKey: '0:1:Target',
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
    expect(updated).toMatchObject({
      pendingExportPairKeys: ['0:1:Target'],
      revision: 3,
      tables: [updatedTable],
    });
    expect(clearedColumn).toMatchObject({
      revision: 3,
      selectedColumnIndex: undefined,
      selectedRowIndexes: [],
    });
    expect(originalTable.workingHtml).toBe('table-0');
  });

  it('clears only the exported Pair and replaces pending keys on a new import', () => {
    const loaded = copyTestSessionReducer(copyTestSessionInitialState, {
      storageHtml: 'storage-v1',
      tables: [createTable(0)],
      type: 'LOADED',
    });
    /** 仅第一组来源列存在待回写变更的状态。 */
    const firstPending = copyTestSessionReducer(loaded, {
      pendingExportPairKey: '0:0:Reference',
      table: createTable(0, 'first-pending'),
      type: 'TABLE_UPDATED',
    });
    /** 两组来源列同时存在待回写变更的状态。 */
    const twoPending = copyTestSessionReducer(firstPending, {
      pendingExportPairKey: '0:1:Target',
      table: createTable(0, 'two-pending'),
      type: 'TABLE_UPDATED',
    });
    /** 模拟成功回写后使用最新 storage 刷新的表格集合。 */
    const exportedTables = [createTable(0, 'exported')];
    /** 仅清除本次成功回写 Pair 后的会话状态。 */
    const exported = copyTestSessionReducer(twoPending, {
      exportedPairKey: '0:1:Target',
      nextTables: exportedTables,
      storageHtml: 'storage-v2',
      type: 'EXPORT_COMMITTED',
    });
    expect(exported).toMatchObject({
      originalStorageHtml: 'storage-v2',
      pendingExportPairKeys: ['0:0:Reference'],
      revision: 4,
      tables: exportedTables,
    });

    /** 重新导入后得到的全新会话状态。 */
    const reloaded = copyTestSessionReducer(exported, {
      storageHtml: 'storage-v3',
      tables: exportedTables,
      type: 'LOADED',
    });
    expect(reloaded.pendingExportPairKeys).toEqual([]);
  });

  it('clears every imported table and selection when the current URL session is invalidated', () => {
    const loaded = copyTestSessionReducer(copyTestSessionInitialState, {
      storageHtml: 'storage-v1',
      tables: [createTable(0)],
      type: 'LOADED',
    });
    const reset = copyTestSessionReducer(loaded, { type: 'RESET' });

    expect(reset).toEqual({
      originalStorageHtml: '',
      pendingExportPairKeys: [],
      revision: 2,
      selectedColumnIndex: undefined,
      selectedRowIndexes: [],
      selectedTableIndex: undefined,
      tables: [],
    });
  });
});
