import { describe, expect, it } from 'vitest';
import type { CopyTestValidationResultWithEvidence } from '../copyTestTableEditor';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import { getCopyTestImageId } from '../copyTestImageUtils';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
} from '../copyTestTableParser';
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

/** 测试图片共用的最小 data URL。 */
const IMAGE_BASE64 = 'data:image/png;base64,QUJD';

/** 用户核心案例中的 Screen01。 */
const SCREEN_1 = { base64: IMAGE_BASE64, fileName: 'screen-a.png' };

/** 用户核心案例中的 Screen02。 */
const SCREEN_2 = { base64: IMAGE_BASE64, fileName: 'screen-b.png' };

/** 与任何校验行都不相关、不得写入表格的 Screen03。 */
const SCREEN_3 = { base64: IMAGE_BASE64, fileName: 'screen-c.png' };

/** 所有编辑器测试共用的上传图片顺序。 */
const images = [SCREEN_1, SCREEN_2, SCREEN_3];

/** 包含来源 rowspan 和人工内容的基础表格。 */
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

/** 读取指定 owner 和生成类型的全部数据单元格。 */
const getGeneratedDataCells = (
  doc: Document,
  type: string,
  sourceColumnKey: string
): Element[] => {
  return Array.from(doc.querySelectorAll('td')).filter(cell => {
    return cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === type
      && cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === sourceColumnKey;
  });
};

/** 读取一个 Result 单元格引用的图片 ID。 */
const getResultImageIds = (cell: Element | undefined): string[] => {
  if (!cell) {
    return [];
  }
  return Array.from(cell.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`))
    .map(reference => reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) || '');
};

/** 构建结构化删除快照。 */
const buildSnapshot = (results: CopyTestValidationResultWithEvidence[]) => ({
  images,
  results,
});

describe('copyTestTableEditor', () => {
  it('creates generated columns, writes strict results, and guards evidence deletion', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    const workingWithColumns = ensureCopyTestWorkingColumns(table, 1, 'Target');
    const workingWithColumnsAgain = ensureCopyTestWorkingColumns(workingWithColumns, 1, 'Target');
    expect(workingWithColumnsAgain.workingHtml).toBe(workingWithColumns.workingHtml);

    const bound = bindResultImages(
      [
        {
          evidenceImageFileNames: [SCREEN_1.fileName],
          languageIssues: [],
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: [SCREEN_2.fileName],
          languageIssues: ['Missing copy'],
          passed: false,
          rowIndex: 2,
        },
      ],
      images
    );
    expect(bound[0].evidenceImages[0].fileName).toBe(SCREEN_1.fileName);
    expect(bindResultImages([{
      evidenceImageFileNames: [],
      languageIssues: ['No matching screenshot'],
      passed: false,
      rowIndex: 0,
    }], images)[0].evidenceImages).toEqual([]);

    const validated = applyCopyTestValidationResults(workingWithColumns, bound, 1, 'Target', images);
    expect(validated.workingHtml).toContain('Passed:');
    expect(validated.workingHtml).toContain('Failed:');
    expect(validated.workingHtml).toContain(SCREEN_1.fileName);
    const validatedAgain = applyCopyTestValidationResults(validated, bound, 1, 'Target', images);
    expect(
      parseHtml(validatedAgain.workingHtml).querySelectorAll(
        `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
      )
    ).toHaveLength(2);

    const sourceKey = getSourceColumnKey(1, 'Target');
    const imageId = getCopyTestImageId(SCREEN_1);
    const instanceId = `${sourceKey}:1:${imageId}`;
    const snapshot = buildSnapshot(bound);
    expect(deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId: `${instanceId}:different` },
      1,
      'Target',
      snapshot
    ).removed).toBe(false);

    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId },
      1,
      'Target',
      snapshot
    );
    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(deleteCopyTestEvidenceImage(
      validated,
      { imageId: 'missing', instanceId: `${sourceKey}:1:missing` },
      1,
      'Target',
      snapshot
    ).removed).toBe(false);
    expect(deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId },
      9,
      'Missing'
    ).removed).toBe(false);

    const createdEmptyColumns = applyCopyTestValidationResults(table, [], 9, 'Missing', images);
    expect(createdEmptyColumns.workingHtml).toContain('Test Result - Missing');
    expect(createdEmptyColumns.workingHtml).toContain('Test Evidence - Missing');
  });

  it('merges the three selected rows while keeping each Result image subset independent', () => {
    const table = parseCopyTestStorageTables([
      '<table><tr><th>ID</th><th>Target</th></tr>',
      '<tr><td>1</td><td>你好</td></tr>',
      '<tr><td>2</td><td>我在</td></tr>',
      '<tr><td>3</td><td>吃饭</td></tr></table>',
    ].join(''))[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 2,
      },
    ], images);

    const validated = applyCopyTestValidationResults(table, results, 1, 'Target', images);
    const sourceKey = getSourceColumnKey(1, 'Target');
    const indexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    const doc = parseHtml(validated.workingHtml);
    const evidenceCells = getGeneratedDataCells(doc, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceKey)
      .filter(cell => cell.querySelector(
        `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
      ));
    const evidenceImages = Array.from(
      evidenceCells[0].querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)
    );
    const resultCells = [1, 2, 3].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[indexes.result!]?.cell.element;
    });

    expect(evidenceCells).toHaveLength(1);
    expect(Number(evidenceCells[0].getAttribute('rowspan') || 1)).toBe(3);
    expect(evidenceImages.map(image => image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE))).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
    expect(evidenceImages.map(image => image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE))).toEqual([
      `${sourceKey}:1:${SCREEN_1.fileName}`,
      `${sourceKey}:1:${SCREEN_2.fileName}`,
    ]);
    expect(getResultImageIds(resultCells[0])).toEqual([SCREEN_1.fileName]);
    expect(getResultImageIds(resultCells[1])).toEqual([SCREEN_1.fileName]);
    expect(getResultImageIds(resultCells[2])).toEqual([SCREEN_1.fileName, SCREEN_2.fileName]);
    expect(resultCells.map(cell => Array.from(
      cell?.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`) || []
    ).map(reference => reference.firstChild?.textContent))).toEqual([
      ['Screen01'],
      ['Screen01'],
      ['Screen01', 'Screen02'],
    ]);
    expect(validated.workingHtml).not.toContain(SCREEN_3.fileName);
  });

  it('hydrates the new DOM contract when deleting after a table reload without a memory snapshot', () => {
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td>copy 1</td></tr>',
      '<tr><td>copy 2</td></tr></table>',
    ].join(''))[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
    ], images);
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    const sourceKey = getSourceColumnKey(0, 'Target');
    const firstImageId = getCopyTestImageId(SCREEN_1);

    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target'
    );
    const doc = parseHtml(deleted.table.workingHtml);
    const resultRoots = doc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    );
    const evidenceCards = Array.from(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`));

    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults?.map(result => result.evidenceImageFileNames)).toEqual([
      [],
      [SCREEN_2.fileName],
    ]);
    expect(resultRoots).toHaveLength(1);
    expect(evidenceCards).toHaveLength(1);
    expect(evidenceCards[0].querySelector('strong')?.textContent).toBe('Screen01');
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).toContain(SCREEN_2.fileName);
  });

  it('deletes evidence only from source A and leaves source B ownership unchanged', () => {
    const table = parseCopyTestStorageTables([
      '<table><tr><th>ID</th><th>Target A</th><th>Target B</th></tr>',
      '<tr><td>1</td><td>A1</td><td>B1</td></tr>',
      '<tr><td>2</td><td>A2</td><td>B2</td></tr></table>',
    ].join(''))[0];
    const aResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    const aValidated = applyCopyTestValidationResults(table, aResults, 1, 'Target A', images);
    const bResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: ['Mismatch'],
      passed: false,
      rowIndex: 0,
    }], images);
    const bothValidated = applyCopyTestValidationResults(aValidated, bResults, 2, 'Target B', images);
    const aSourceKey = getSourceColumnKey(1, 'Target A');
    const bSourceKey = getSourceColumnKey(2, 'Target B');
    const beforeDoc = parseHtml(bothValidated.workingHtml);
    const bCellsBefore = getGeneratedDataCells(beforeDoc, COPY_TEST_GENERATED_RESULT_TYPE, bSourceKey)
      .concat(getGeneratedDataCells(beforeDoc, COPY_TEST_GENERATED_EVIDENCE_TYPE, bSourceKey))
      .map(cell => cell.outerHTML);
    const imageId = getCopyTestImageId(SCREEN_1);

    const deleted = deleteCopyTestEvidenceImage(
      bothValidated,
      { imageId, instanceId: `${aSourceKey}:1:${imageId}` },
      1,
      'Target A',
      buildSnapshot(aResults)
    );
    const afterDoc = parseHtml(deleted.table.workingHtml);
    const aCells = getGeneratedDataCells(afterDoc, COPY_TEST_GENERATED_RESULT_TYPE, aSourceKey)
      .concat(getGeneratedDataCells(afterDoc, COPY_TEST_GENERATED_EVIDENCE_TYPE, aSourceKey));
    const bCells = getGeneratedDataCells(afterDoc, COPY_TEST_GENERATED_RESULT_TYPE, bSourceKey)
      .concat(getGeneratedDataCells(afterDoc, COPY_TEST_GENERATED_EVIDENCE_TYPE, bSourceKey));

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(true);
    expect(aCells.flatMap(cell => Array.from(cell.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${imageId}"]`
    )))).toHaveLength(0);
    expect(aCells.flatMap(cell => Array.from(cell.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${imageId}"]`
    )))).toHaveLength(0);
    expect(bCells.map(cell => cell.outerHTML)).toEqual(bCellsBefore);
    expect(bCells.flatMap(cell => Array.from(cell.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${imageId}"]`
    )))).toHaveLength(1);
    expect(bCells.flatMap(cell => Array.from(cell.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${imageId}"]`
    )))).toHaveLength(1);
  });

  it('replans a middle-rowspan table after deleting the connecting Screen01', () => {
    const table = parseCopyTestStorageTables(middleMergedStorageHtml)[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 3,
      },
    ], images);
    const validated = applyCopyTestValidationResults(table, results, 1, 'Target', images);
    const sourceKey = getSourceColumnKey(1, 'Target');
    const initialIndexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    expect(validated.model.rows[1].slots[initialIndexes.evidence!]?.cell.rowSpan).toBe(4);

    const firstImageId = getCopyTestImageId(SCREEN_1);
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      1,
      'Target',
      buildSnapshot(results)
    );
    const indexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    const evidenceSlots = [1, 2, 3, 4].map(rowIndex => {
      const slot = deleted.table.model.rows[rowIndex].slots[indexes.evidence!];
      return { owned: slot?.owned, rowSpan: slot?.cell.rowSpan };
    });
    const resultCells = [1, 2, 4].map(rowIndex => {
      return deleted.table.model.rows[rowIndex].slots[indexes.result!]?.cell.element;
    });
    const doc = parseHtml(deleted.table.workingHtml);
    const remainingEvidence = doc.querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${SCREEN_2.fileName}"]`
    );

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(evidenceSlots).toEqual([
      { owned: true, rowSpan: 1 },
      { owned: true, rowSpan: 2 },
      { owned: false, rowSpan: 2 },
      { owned: true, rowSpan: 1 },
    ]);
    expect(buildCopyTestRowGroups(deleted.table, 1).map(group => group.rowSpan)).toEqual([1, 2, 1]);
    expect(resultCells[0]?.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toBeNull();
    expect(resultCells[1]?.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toBeNull();
    expect(resultCells[2]?.textContent).toContain('Passed:');
    expect(getResultImageIds(resultCells[2])).toEqual([SCREEN_2.fileName]);
    expect(remainingEvidence?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)).toBe(
      `${sourceKey}:4:${SCREEN_2.fileName}`
    );
    expect(remainingEvidence?.closest('td')?.getAttribute('rowspan')).toBeNull();
    expect(remainingEvidence?.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`)
      ?.querySelector('strong')?.textContent).toBe('Screen01');
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_3.fileName);
    expect(deleted.validationResults?.map(result => result.evidenceImageFileNames)).toEqual([
      [],
      [],
      [SCREEN_2.fileName],
    ]);
  });

  it('renumbers remaining screens and removes Passed after every image is deleted', () => {
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy 1</td></tr><tr><td>copy 2</td></tr></table>'
    )[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
    ], images);
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    const sourceKey = getSourceColumnKey(0, 'Target');
    const firstImageId = getCopyTestImageId(SCREEN_1);
    const secondImageId = getCopyTestImageId(SCREEN_2);
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target',
      buildSnapshot(results)
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
    )?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)).toBe(`${sourceKey}:1:${secondImageId}`);
    expect(doc.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${secondImageId}"]`
    )?.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE)).toBe(`${sourceKey}:1:${secondImageId}`);
    expect(deleted.table.workingHtml).not.toContain('Screen02');

    const deletedAgain = deleteCopyTestEvidenceImage(
      deleted.table,
      { imageId: secondImageId, instanceId: `${sourceKey}:1:${secondImageId}` },
      0,
      'Target',
      buildSnapshot(deleted.validationResults || [])
    );
    expect(deletedAgain.removed).toBe(true);
    expect(deletedAgain.table.workingHtml).not.toContain('Passed:');
    const deletedAgainDoc = parseHtml(deletedAgain.table.workingHtml);
    expect(deletedAgainDoc.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`)).toHaveLength(0);
    expect(deletedAgainDoc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
  });

  it('keeps guard branches synchronous and returns the original table for invalid working html', () => {
    const table = parseCopyTestStorageTables(storageHtml)[0];
    const invalidWorkingTable = { ...table, workingHtml: '<p>bad</p>' };
    const imageId = getCopyTestImageId(SCREEN_1);

    expect(ensureCopyTestWorkingColumns(invalidWorkingTable, 1, 'Target')).toBe(invalidWorkingTable);
    expect(deleteCopyTestEvidenceImage(
      invalidWorkingTable,
      { imageId, instanceId: `1:Target:1:${imageId}` },
      1,
      'Target'
    )).toEqual({
      imageStillUsed: false,
      removed: false,
      table: invalidWorkingTable,
    });
    expect(() => applyCopyTestValidationResults(
      invalidWorkingTable,
      [],
      1,
      'Target',
      images
    )).toThrow('Generated result columns cannot be created');
  });
});
