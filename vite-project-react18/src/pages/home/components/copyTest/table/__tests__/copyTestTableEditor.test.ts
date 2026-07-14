import { describe, expect, it } from 'vitest';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
} from '../copyTestTableParser';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import { getCopyTestImageId } from '../copyTestImageUtils';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
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

/** Target 第 2、3 个数据行合并的四行回归表格。 */
const middleMergedStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>A1</td></tr>',
  '<tr><td>2</td><td rowspan="2">A2-3</td></tr>',
  '<tr><td>3</td></tr>',
  '<tr><td>4</td><td>A4</td></tr>',
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
          cell.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${imageId}"]`)
        )
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

  it('restores an emptied merged Evidence cell to the source atomic row groups', () => {
    const table = parseCopyTestStorageTables(middleMergedStorageHtml)[0];
    const validated = applyCopyTestValidationResults(
      table,
      bindResultImages(
        [
          {
            evidenceImageFileNames: ['screen-a.png'],
            evidenceRowSpan: 3,
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
            evidenceImageFileNames: ['screen-a.png'],
            hideEvidenceCell: true,
            passed: true,
            rowIndex: 3,
          },
        ],
        images
      ),
      1,
      'Target'
    );
    const sourceKey = getSourceColumnKey(1, 'Target');
    const initialIndexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    expect(validated.model.rows[1].slots[initialIndexes.evidence!]?.cell.rowSpan).toBe(4);

    const imageId = getCopyTestImageId(images[0]);
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId: `${imageId}:1:0` },
      1,
      'Target'
    );
    const indexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    const evidenceSlots = [1, 2, 3, 4].map(rowIndex => {
      /** 删除后当前物理行在 Evidence 列中的归属和来源原子跨度。 */
      const slot = deleted.table.model.rows[rowIndex].slots[indexes.evidence!];
      return { owned: slot?.owned, rowSpan: slot?.cell.rowSpan };
    });
    const doc = parseHtml(deleted.table.workingHtml);

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(evidenceSlots).toEqual([
      { owned: true, rowSpan: 1 },
      { owned: true, rowSpan: 2 },
      { owned: false, rowSpan: 2 },
      { owned: true, rowSpan: 1 },
    ]);
    expect(buildCopyTestRowGroups(deleted.table, 1).map(group => group.rowSpan)).toEqual([1, 2, 1]);
    expect(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)).toHaveLength(0);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    )).toHaveLength(0);
    expect(doc.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`)).toHaveLength(0);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
  });

  it('renumbers remaining Evidence and Result screens while keeping stable instance ids', () => {
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy 1</td></tr><tr><td>copy 2</td></tr></table>'
    )[0];
    const validated = applyCopyTestValidationResults(
      table,
      bindResultImages(
        [
          {
            evidenceImageFileNames: ['screen-a.png', 'screen-b.png'],
            evidenceRowSpan: 2,
            hideEvidenceCell: false,
            passed: true,
            rowIndex: 0,
          },
          {
            evidenceImageFileNames: ['screen-a.png', 'screen-b.png'],
            hideEvidenceCell: true,
            passed: true,
            rowIndex: 1,
          },
        ],
        images
      ),
      0,
      'Target'
    );
    const firstImageId = getCopyTestImageId(images[0]);
    const secondImageId = getCopyTestImageId(images[1]);
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${firstImageId}:1:0` },
      0,
      'Target'
    );
    const doc = parseHtml(deleted.table.workingHtml);
    const evidenceCards = Array.from(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`));
    const resultReferences = Array.from(doc.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`));

    expect(evidenceCards.map(card => card.querySelector('strong')?.textContent)).toEqual(['Screen01']);
    expect(resultReferences.map(reference => reference.firstChild?.textContent)).toEqual(['Screen01', 'Screen01']);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${firstImageId}"]`
    )).toHaveLength(0);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${firstImageId}"]`
    )).toHaveLength(0);
    expect(doc.querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${secondImageId}"]`
    )?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)).toBe(`${secondImageId}:1:1`);
    expect(doc.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${secondImageId}"]`
    )?.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE)).toBe(`${secondImageId}:1:1`);
    expect(deleted.table.workingHtml).not.toContain('Screen02');

    const deletedAgain = deleteCopyTestEvidenceImage(
      deleted.table,
      { imageId: secondImageId, instanceId: `${secondImageId}:1:1` },
      0,
      'Target'
    );
    expect(deletedAgain.removed).toBe(true);
    expect(deletedAgain.table.workingHtml).not.toContain('Passed:');
    const deletedAgainDoc = parseHtml(deletedAgain.table.workingHtml);
    expect(deletedAgainDoc.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
    )).toHaveLength(0);
    expect(deletedAgainDoc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
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
