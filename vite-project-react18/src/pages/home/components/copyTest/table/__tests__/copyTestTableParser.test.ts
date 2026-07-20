import { describe, expect, it } from 'vitest';
import {
  buildCopyTestRowsForValidation,
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSelectableCopyTestRowIndexes,
  getSourceColumnKey,
  isCopyTestGeneratedHeader,
  normalizeCopyTestSelectedRowIndexes,
  parseCopyTestStorageTables,
  refreshWorkingTable,
} from '../copyTestTableParser';

const storageHtml = [
  '<table>',
  '<tr><th>Reference</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td></td><td></td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
].join('');

/** A 列第 2、3 个数据行合并的四行回归表格。 */
const middleMergedStorageHtml = [
  '<table><tr><th>ID</th><th>A</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td rowspan="2">copy 2 and 3</td></tr>',
  '<tr><td>3</td></tr>',
  '<tr><td>4</td><td>copy 4</td></tr>',
  '</table>',
].join('');

describe('copyTestTableParser', () => {
  it('builds working tables, contexts, generated indexes, and selected validation rows', () => {
    const tables = parseCopyTestStorageTables(storageHtml);
    const sourceKey = getSourceColumnKey(1, 'Target');
    expect(sourceKey).toBe('1:Target');
    expect(isCopyTestGeneratedHeader({ index: 9, label: 'Test Evidence - A' })).toBe(true);
    expect(findGeneratedColumnIndexes(tables[0].headers, sourceKey)).toEqual({
      evidence: 3,
      result: 2,
    });

    const context = getCopyTestColumnContext(tables[0], 1);
    expect(context?.rowGroups.map(group => group.dataRowIndexes)).toEqual([[0, 1], [2]]);
    expect(buildCopyTestRowGroups(tables[0], 1).map(group => group.rowSpan)).toEqual([2, 1]);
    expect(getSelectableCopyTestRowIndexes(tables[0], 1)).toEqual([0, 2]);
    expect(getSelectableCopyTestRowIndexes(undefined, 1)).toEqual([]);
    expect(getSelectableCopyTestRowIndexes(tables[0], undefined)).toEqual([]);
    expect(buildCopyTestRowsForValidation(tables[0], context, [0, 2])).toHaveLength(2);
    expect(buildCopyTestRowsForValidation(undefined, context, [0])).toEqual([]);
    expect(buildCopyTestRowsForValidation(tables[0], null, [0])).toEqual([]);
    expect(refreshWorkingTable(tables[0], '<p>bad</p>')).toBe(tables[0]);
    expect(getCopyTestColumnContext(tables[0], undefined)).toBeNull();
    expect(getCopyTestColumnContext(tables[0], 99)).toBeNull();
    expect(getSelectableCopyTestRowIndexes(tables[0], 99)).toEqual([]);
    expect(parseCopyTestStorageTables('<p>no table</p>')).toEqual([]);
    /** 仅含空表头但具备数据行的表格仍是可选择的有效表格。 */
    const blankHeaderTables = parseCopyTestStorageTables(
      '<table><tr><th><br /></th></tr><tr><td>value</td></tr></table>'
    );
    expect(blankHeaderTables).toHaveLength(1);
    expect(blankHeaderTables[0].headers).toEqual([
      expect.objectContaining({ index: 0, label: '' }),
    ]);
  });

  it('requires strict generated metadata and never claims title-only or foreign columns', () => {
    const table = parseCopyTestStorageTables(
      [
        '<table><tr><th>Target</th><th>Test Result - Target</th>',
        '<th data-copy-test-column-type="result" data-copy-test-source-column-key="foreign">Foreign result</th>',
        '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Owned evidence</th></tr>',
        '<tr><td>copy</td><td>manual result</td><td>foreign result</td><td></td></tr></table>',
      ].join('')
    )[0];
    const sourceKey = getSourceColumnKey(0, 'Target');

    expect(isCopyTestGeneratedHeader(table.headers[1])).toBe(true);
    expect(isCopyTestGeneratedHeader(table.headers[1])).toBe(true);
    expect(isCopyTestGeneratedHeader(table.headers[2])).toBe(false);
    expect(isCopyTestGeneratedHeader(table.headers[3])).toBe(true);
    expect(findGeneratedColumnIndexes(table.headers, sourceKey)).toEqual({
      evidence: 3,
      result: undefined,
    });
  });

  it('uses model fallback for hole tables and projection-boundary failures', () => {
    const holeTable = parseCopyTestStorageTables(
      '<table><tr><th>ID</th><th>Target</th></tr><tr><td>1</td></tr></table>'
    )[0];
    const crossingHeaderTable = parseCopyTestStorageTables(
      ['<table><tr><th>ID</th><th rowspan="2">Target</th></tr>', '<tr><td>1</td></tr></table>'].join('')
    )[0];

    expect(holeTable).toBeDefined();
    expect(holeTable.model.spanGrid).toBeUndefined();
    expect(buildCopyTestRowGroups(holeTable, 0).map(group => group.dataRowIndexes)).toEqual([[0]]);
    expect(buildCopyTestRowGroups(holeTable, 1)).toEqual([]);
    expect(crossingHeaderTable.model.spanGrid).toBeDefined();
    expect(buildCopyTestRowGroups(crossingHeaderTable, 1)).toEqual([]);
  });

  it('normalizes every selected row in a middle rowspan group to its anchor', () => {
    const table = parseCopyTestStorageTables(middleMergedStorageHtml)[0];
    const context = getCopyTestColumnContext(table, 1);

    expect(context?.rowGroups.map(group => group.dataRowIndexes)).toEqual([[0], [1, 2], [3]]);
    expect(getSelectableCopyTestRowIndexes(table, 1)).toEqual([0, 1, 3]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [3, 2, 1, 99, 0, 2]))
      .toEqual([0, 1, 3]);
    expect(buildCopyTestRowsForValidation(table, context, [2, 3, 1])).toEqual([
      { expected: 'copy 2 and 3', rowIndex: 1 },
      { expected: 'copy 4', rowIndex: 3 },
    ]);
  });
});
