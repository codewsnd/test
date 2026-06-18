import { describe, expect, it } from 'vitest';
import { parseCopyTestStorageTables } from '../copyTestTableParser';
import { applyCopyTestValidationResults, ensureCopyTestWorkingColumns } from '../copyTestTableEditor';
import {
  buildCurrentColumnExportStorage,
  replaceTableInStorage,
} from '../copyTestTableExporter';

const IMAGE_BASE64 = 'data:image/png;base64,QUJD';
const image = { base64: IMAGE_BASE64, fileName: 'screen-a.png' };
const storageHtml = [
  '<table>',
  '<tr><th>Reference|values=hk_en|</th><th>Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Result - Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Evidence - Target|values=hk_sc|</th></tr>',
  '<tr><td>hello</td><td>你好</td><td>human result</td><td>human evidence</td></tr>',
  '</table>',
].join('');

describe('copyTestTableExporter', () => {
  it('patches only current generated columns and preserves or removes managed content correctly', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    const working = ensureCopyTestWorkingColumns(table, 1, 'Target|values=hk_sc|');
    const validated = applyCopyTestValidationResults(
      working,
      [{ evidenceImageFileNames: ['screen-a.png'], passed: true, rowIndex: 0 }],
      [image],
      1,
      'Target|values=hk_sc|'
    );
    expect(buildCurrentColumnExportStorage({
      originalStorageHtml: storageHtml,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target|values=hk_sc|',
      table: validated,
    })).toContain('screen-a.png');
    expect(buildCurrentColumnExportStorage({
      originalStorageHtml: '<p>no table</p>',
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target',
      table: { ...validated, range: undefined },
    })).toBeNull();
    expect(buildCurrentColumnExportStorage({
      originalStorageHtml: storageHtml,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target|values=hk_sc|',
      table: { ...validated, workingHtml: '<p>bad</p>' },
    })).toContain('human result');
    expect(buildCurrentColumnExportStorage({
      originalStorageHtml: storageHtml,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target|values=hk_sc|',
      table: { ...validated, workingHtml: '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>' },
    })).toContain('human evidence');

    const originalWithManaged = storageHtml.replace('human evidence', '<div data-copy-test-generated-content="evidence"><strong>Old evidence</strong></div>');
    const workingWithoutManaged = storageHtml.replace('human evidence', '');
    expect(buildCurrentColumnExportStorage({
      originalStorageHtml: originalWithManaged,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target|values=hk_sc|',
      table: { ...validated, index: 0, originalHtml: originalWithManaged, workingHtml: workingWithoutManaged },
    })).not.toContain('Old evidence');
    const workingWithManaged = storageHtml.replace('human evidence', '<div data-copy-test-generated-content="evidence"><strong>New evidence</strong></div>');
    const replaced = buildCurrentColumnExportStorage({
      originalStorageHtml: originalWithManaged,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target|values=hk_sc|',
      table: { ...validated, index: 0, originalHtml: originalWithManaged, workingHtml: workingWithManaged },
    });
    expect(replaced).toContain('New evidence');

    const rowSpanStorage = [
      '<table>',
      '<tr><th>Reference</th><th>Target</th><th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target">Test Result - Target</th>',
      '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target">Test Evidence - Target</th></tr>',
      '<tr><td>hello</td><td rowspan="2">你好</td><td>old first</td><td>old evidence first</td></tr>',
      '<tr><td>world</td><td>old second</td><td>old evidence second</td></tr>',
      '</table>',
    ].join('');
    const rowSpanTable = parseCopyTestStorageTables(rowSpanStorage)[0];
    const rowSpanWorking = applyCopyTestValidationResults(
      ensureCopyTestWorkingColumns(rowSpanTable, 1, 'Target'),
      [{ evidenceImageFileNames: ['screen-a.png'], evidenceRowSpan: 2, passed: true, rowIndex: 0 }],
      [image],
      1,
      'Target'
    );
    const rowSpanExported = buildCurrentColumnExportStorage({
      originalStorageHtml: rowSpanStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target',
      table: rowSpanWorking,
    });
    expect(rowSpanExported).toContain('rowspan="2"');
    expect(rowSpanExported).not.toContain('old second');
    expect(replaceTableInStorage('aa<table></table>zz', { end: 17, start: 2 }, '<table><tr /></table>'))
      .toBe('aa<table><tr /></table>zz');
  });
});
