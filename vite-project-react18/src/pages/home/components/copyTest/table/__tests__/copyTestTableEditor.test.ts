import { describe, expect, it } from 'vitest';
import { getSourceColumnKey, parseCopyTestStorageTables } from '../copyTestTableParser';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import { getCopyTestImageId } from '../copyTestImageUtils';
import {
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
} from '../tableConstants';
import { parseHtml } from '../tableModel';

const IMAGE_BASE64 = 'data:image/png;base64,QUJD';
const images = [
  { base64: IMAGE_BASE64, fileName: 'screen-a.png' },
  { base64: IMAGE_BASE64, fileName: 'screen-b.png' },
];

const storageHtml = [
  '<table>',
  '<tr><th>Reference</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td>human result</td><td>human evidence</td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
].join('');

describe('copyTestTableEditor', () => {
  it('creates generated columns, writes results, binds images, and deletes evidence safely', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    const workingWithColumns = ensureCopyTestWorkingColumns(table, 1, 'Target');
    const workingWithColumnsAgain = ensureCopyTestWorkingColumns(workingWithColumns, 1, 'Target');
    expect(workingWithColumnsAgain.workingHtml).toBe(workingWithColumns.workingHtml);
    const bound = bindResultImages(
      [
        {
          evidenceImageFileNames: ['screen-a.png'],
          hideEvidenceCell: false,
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen-b.png'],
          hideEvidenceCell: false,
          languageIssues: ['Missing copy'],
          passed: false,
          rowIndex: 2,
        },
      ],
      images
    );
    expect(bound[0].evidenceImages[0].fileName).toBe('screen-a.png');
    expect(
      bindResultImages([{ hideEvidenceCell: false, passed: true, rowIndex: 0 }], images)[0].evidenceImages
    ).toEqual([]);

    const validated = applyCopyTestValidationResults(workingWithColumns, bound, 1, 'Target');
    expect(validated.workingHtml).toContain('Passed:');
    expect(validated.workingHtml).toContain('Failed:');
    expect(validated.workingHtml).toContain('screen-a.png');
    const validatedAgain = applyCopyTestValidationResults(validated, bound, 1, 'Target');
    expect(
      parseHtml(validatedAgain.workingHtml).querySelectorAll(
        `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
      )
    ).toHaveLength(2);

    const skipped = applyCopyTestValidationResults(
      workingWithColumns,
      bindResultImages(
        [
          {
            evidenceImageFileNames: ['screen-a.png'],
            evidenceRowSpan: 2,
            hideEvidenceCell: false,
            passed: true,
            rowIndex: 0,
          },
        ],
        images
      ),
      1,
      'Target'
    );
    expect(skipped.workingHtml).toContain('rowspan="2"');

    const imageId = getCopyTestImageId(images[0]);
    expect(
      deleteCopyTestEvidenceImage(validated, { imageId, instanceId: 'different-instance' }, 1, 'Target').removed
    ).toBe(false);
    const instanceId = `${imageId}:1:0`;
    const deleted = deleteCopyTestEvidenceImage(validated, { imageId, instanceId }, 1, 'Target');
    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(
      deleteCopyTestEvidenceImage(validated, { imageId: 'missing', instanceId: 'missing:1:0' }, 1, 'Target').removed
    ).toBe(false);
    expect(deleteCopyTestEvidenceImage(validated, { imageId, instanceId }, 9, 'Missing').removed).toBe(false);
    const createdEmptyColumns = applyCopyTestValidationResults(table, [], 9, 'Missing');
    expect(createdEmptyColumns.workingHtml).toContain('Test Result - Missing');
    expect(createdEmptyColumns.workingHtml).toContain('Test Evidence - Missing');
  });

  it('merges consecutive matching evidence into the expected number of physical groups', () => {
    const table = parseCopyTestStorageTables(
      [
        '<table><tr><th>ID</th><th>Target</th></tr>',
        '<tr><td>1</td><td>A</td></tr>',
        '<tr><td>2</td><td>B</td></tr>',
        '<tr><td>3</td><td>C</td></tr></table>',
      ].join('')
    )[0];
    const results = bindResultImages(
      [
        {
          evidenceImageFileNames: ['screen-a.png'],
          evidenceRowSpan: 2,
          hideEvidenceCell: false,
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen-a.png'],
          hideEvidenceCell: true,
          passed: true,
          rowIndex: 1,
        },
        {
          evidenceImageFileNames: ['screen-b.png'],
          hideEvidenceCell: false,
          languageIssues: ['Mismatch'],
          passed: false,
          rowIndex: 2,
        },
      ],
      images
    );
    const validated = applyCopyTestValidationResults(table, results, 1, 'Target');
    const sourceKey = getSourceColumnKey(1, 'Target');
    const evidenceCells = Array.from(parseHtml(validated.workingHtml).querySelectorAll('td'))
      .filter(
        cell => cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === COPY_TEST_GENERATED_EVIDENCE_TYPE
      )
      .filter(cell => cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === sourceKey)
      .filter(cell =>
        cell.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`)
      );

    expect(evidenceCells).toHaveLength(2);
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([2, 1]);
  });

  it('deletes evidence only from the selected A source and leaves B ownership untouched', () => {
    const table = parseCopyTestStorageTables(
      [
        '<table><tr><th>ID</th><th>Target A</th><th>Target B</th></tr>',
        '<tr><td>1</td><td>A1</td><td>B1</td></tr>',
        '<tr><td>2</td><td>A2</td><td>B2</td></tr></table>',
      ].join('')
    )[0];
    const aValidated = applyCopyTestValidationResults(
      table,
      bindResultImages(
        [
          {
            evidenceImageFileNames: ['screen-a.png'],
            hideEvidenceCell: false,
            passed: true,
            rowIndex: 0,
          },
        ],
        images
      ),
      1,
      'Target A'
    );
    const bothValidated = applyCopyTestValidationResults(
      aValidated,
      bindResultImages(
        [
          {
            evidenceImageFileNames: ['screen-a.png'],
            hideEvidenceCell: false,
            languageIssues: ['Mismatch'],
            passed: false,
            rowIndex: 0,
          },
        ],
        images
      ),
      2,
      'Target B'
    );
    const imageId = getCopyTestImageId(images[0]);
    const deleted = deleteCopyTestEvidenceImage(
      bothValidated,
      { imageId, instanceId: `${imageId}:1:0` },
      1,
      'Target A'
    );
    const doc = parseHtml(deleted.table.workingHtml);
    const aSourceKey = getSourceColumnKey(1, 'Target A');
    const bSourceKey = getSourceColumnKey(2, 'Target B');
    const generatedCells = Array.from(doc.querySelectorAll('td'));
    const aCells = generatedCells.filter(cell => {
      return cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === aSourceKey;
    });
    const bCells = generatedCells.filter(cell => {
      return cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === bSourceKey;
    });

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(true);
    expect(
      aCells.flatMap(cell =>
        Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${imageId}"]`))
      )
    ).toHaveLength(0);
    expect(
      aCells.flatMap(cell =>
        Array.from(
          cell.querySelectorAll(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`)
        )
      )
    ).toHaveLength(0);
    expect(
      bCells.flatMap(cell =>
        Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${imageId}"]`))
      )
    ).toHaveLength(1);
    expect(
      bCells.flatMap(cell =>
        Array.from(
          cell.querySelectorAll(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`)
        )
      )
    ).toHaveLength(1);
  });

  it('keeps guard branches synchronous and returns the original table for invalid working html', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    const invalidWorkingTable = { ...table, workingHtml: '<p>bad</p>' };
    const imageId = getCopyTestImageId(images[0]);

    expect(ensureCopyTestWorkingColumns(invalidWorkingTable, 1, 'Target')).toBe(invalidWorkingTable);
    expect(
      deleteCopyTestEvidenceImage(invalidWorkingTable, { imageId, instanceId: `${imageId}:1:0` }, 1, 'Target')
    ).toEqual({
      imageStillUsed: false,
      removed: false,
      table: invalidWorkingTable,
    });
    expect(() => applyCopyTestValidationResults(invalidWorkingTable, [], 1, 'Target')).toThrow(
      'Generated result columns cannot be created'
    );
  });
});
