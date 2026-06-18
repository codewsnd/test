import { describe, expect, it } from 'vitest';
import { parseCopyTestStorageTables } from '../copyTestTableParser';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestGeneratedColumns,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import { getCopyTestImageId } from '../copyTestImageUtils';

const IMAGE_BASE64 = 'data:image/png;base64,QUJD';
const images = [
  { base64: IMAGE_BASE64, fileName: 'screen-a.png' },
  { base64: IMAGE_BASE64, fileName: 'screen-b.png' },
];

const storageHtml = [
  '<table>',
  '<tr><th>Reference|values=hk_en|</th><th>Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Result - Target|values=hk_sc|</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target|values=hk_sc|">Test Evidence - Target|values=hk_sc|</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td>human result</td><td>human evidence</td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
].join('');

describe('copyTestTableEditor', () => {
  it('creates generated columns, writes results, binds images, and deletes evidence safely', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    expect(ensureCopyTestGeneratedColumns(table.workingHtml, 1, 'Target|values=hk_sc|')?.html).toContain('Test Result');
    expect(ensureCopyTestGeneratedColumns('<p>bad</p>', 1, 'Target')).toBeNull();

    const workingWithColumns = ensureCopyTestWorkingColumns(table, 1, 'Target|values=hk_sc|');
    const bound = bindResultImages([
      { evidenceImageFileNames: ['screen-a.png'], passed: true, rowIndex: 0 },
      { evidenceImageFileNames: ['screen-b.png'], languageIssues: ['Missing copy'], passed: false, rowIndex: 2 },
    ], images);
    expect(bound[0].evidenceImages?.[0].fileName).toBe('screen-a.png');
    expect(bindResultImages([{ passed: true, rowIndex: 0 }], images)[0].evidenceImages).toHaveLength(2);

    const validated = applyCopyTestValidationResults(workingWithColumns, bound, images, 1, 'Target|values=hk_sc|');
    expect(validated.workingHtml).toContain('Passed:');
    expect(validated.workingHtml).toContain('Failed:');
    expect(validated.workingHtml).toContain('screen-a.png');

    const skipped = applyCopyTestValidationResults(
      workingWithColumns,
      [{ evidenceImageFileNames: ['screen-a.png'], evidenceRowSpan: 2, passed: true, rowIndex: 0 }],
      images,
      1,
      'Target|values=hk_sc|'
    );
    expect(skipped.workingHtml).toContain('rowspan="2"');

    const imageId = getCopyTestImageId(images[0]);
    expect(deleteCopyTestEvidenceImage(validated, { imageId, instanceId: 'different-instance' }, 1, 'Target|values=hk_sc|').removed)
      .toBe(false);
    const deleted = deleteCopyTestEvidenceImage(validated, { imageId }, 1, 'Target|values=hk_sc|');
    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(deleteCopyTestEvidenceImage(validated, { imageId: 'missing' }, 1, 'Target|values=hk_sc|').removed).toBe(false);
    expect(deleteCopyTestEvidenceImage(validated, { imageId }, 9, 'Missing').removed).toBe(false);
    const createdEmptyColumns = applyCopyTestValidationResults(table, [], [], 9, 'Missing');
    expect(createdEmptyColumns.workingHtml).toContain('Test Result - Missing');
    expect(createdEmptyColumns.workingHtml).toContain('Test Evidence - Missing');
  });
});
