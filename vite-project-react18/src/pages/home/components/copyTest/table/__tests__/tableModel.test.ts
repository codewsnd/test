import { describe, expect, it } from 'vitest';
import {
  buildRowsForValidation,
  findReferenceColumnIndex,
  findTableRanges,
  getCellText,
  getCopyTestSourceColumnKey,
  getDataRowIndexes,
  getGeneratedColumnLabel,
  getPreviewColumnIndexes,
  getSelectableDataRowIndexes,
  isGeneratedHeader,
  normalizeLabel,
  parseHtml,
  parseSingleTable,
  parseStorageTables,
  toConfluenceStorageHtml,
} from '../tableModel';
import {
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
} from '../tableConstants';

const storageHtml = [
  '<p>before</p>',
  '<table>',
  '<tr><th>Reference|values=hk_en|</th><th>Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Result - Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Evidence - Target|values=hk_sc|</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td>human result</td><td>human evidence</td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
  '<!-- <table><tr><td>ignored</td></tr></table> -->',
  '<table><tr><th>Only</th></tr><tr><td>second</td></tr></table>',
].join('');

describe('tableModel', () => {
  it('parses storage ranges, spans, generated headers, and validation row inputs', () => {
    const doc = parseHtml('<table><tr><td /><td><br></td></tr></table>');
    expect(toConfluenceStorageHtml(doc.body.innerHTML)).toContain('<br />');
    expect(findTableRanges(storageHtml)).toHaveLength(2);

    const tables = parseStorageTables(storageHtml);
    expect(tables).toHaveLength(2);
    expect(tables[0].model.columnCount).toBe(4);
    expect(tables[0].headers.map(header => header.label)).toContain('Target|values=hk_sc|');
    expect(getCellText(tables[0].model.rows[2], 1)).toBe('');
    expect(getCellText(tables[0].model.rows[1], undefined)).toBe('');
    expect(getDataRowIndexes(tables[0])).toEqual([0, 1, 2]);
    expect(getSelectableDataRowIndexes(tables[0], 1)).toEqual([0, 2]);
    expect(getSelectableDataRowIndexes(tables[0], undefined)).toEqual([]);
    expect(normalizeLabel(' Test   Result ')).toBe('Test Result');
    expect(getCopyTestSourceColumnKey(1, ' Target ')).toBe('1:Target');
    expect(getGeneratedColumnLabel(COPY_TEST_GENERATED_RESULT_TYPE, 'A')).toBe('Test Result - A');
    expect(getGeneratedColumnLabel(COPY_TEST_GENERATED_EVIDENCE_TYPE, 'A')).toBe('Test Evidence - A');
    expect(findReferenceColumnIndex(tables[0].headers, 1)).toBe(0);
    expect(findReferenceColumnIndex([{ index: 0, label: 'Other' }], 0)).toBeUndefined();
    expect(isGeneratedHeader(tables[0].headers[2])).toBe(true);
    expect(getPreviewColumnIndexes(tables[0].headers)).toEqual([0, 1, 2, 3]);
    expect(getPreviewColumnIndexes(tables[0].headers, 1)).toEqual([1, 2, 3]);
    expect(buildRowsForValidation(tables[0], 1, 0, [0, 2])).toEqual([
      { expected: '你好', reference: 'hello', rowIndex: 0 },
      { expected: '提交', reference: 'submit', rowIndex: 2 },
    ]);
    expect(parseSingleTable('no table')).toBeNull();
  });
});
