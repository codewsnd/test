import { describe, expect, it } from 'vitest';
import {
  buildCopyTestRowsForValidation,
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSelectableCopyTestRowIndexes,
  getSourceColumnKey,
  isCopyTestGeneratedHeader,
  parseCopyTestStorageTables,
  refreshWorkingTable,
} from '../copyTestTableParser';

const storageHtml = [
  '<table>',
  '<tr><th>Reference|values=hk_en|</th><th>Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Result - Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Evidence - Target|values=hk_sc|</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td></td><td></td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
].join('');

describe('copyTestTableParser', () => {
  it('builds working tables, contexts, generated indexes, and selected validation rows', () => {
    const tables = parseCopyTestStorageTables(storageHtml);
    const sourceKey = getSourceColumnKey(1, 'Target|values=hk_sc|');
    expect(sourceKey).toBe('1:Target|values=hk_sc|');
    expect(isCopyTestGeneratedHeader({ index: 9, label: 'Test Evidence - A' })).toBe(true);
    expect(findGeneratedColumnIndexes(tables[0].headers, sourceKey, 'Target|values=hk_sc|')).toEqual({ evidence: 3, result: 2 });

    const context = getCopyTestColumnContext(tables[0], 1);
    expect(context?.referenceHeader?.label).toBe('Reference|values=hk_en|');
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
  });
});
