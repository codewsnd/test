import { describe, expect, it } from 'vitest';
import type { CopyTestImage } from '../../api/copyTestApi';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import { buildCurrentColumnExportStorage } from '../copyTestTableExporter';
import { buildConfluenceStorageTableExportPayload } from '../copyTestTableImages';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSourceColumnKey,
  normalizeCopyTestSelectedRowIndexes,
  parseCopyTestStorageTables,
  type CopyTestWorkingTable,
} from '../copyTestTableParser';
import { COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE } from '../tableConstants';

/** 测试图片共用的最小 data URL。 */
const IMAGE_BASE64 = 'data:image/png;base64,QUJD';

/** 第一批动态分组的唯一 winner。 */
const SCREEN_A: CopyTestImage = {
  base64: IMAGE_BASE64,
  fileName: 'screen-a.png',
  originalFileName: 'Screen A.png',
};

/** 第二批追加并扩展动态分组的唯一 winner。 */
const SCREEN_B: CopyTestImage = {
  base64: 'data:image/png;base64,REVG',
  fileName: 'screen-b.png',
  originalFileName: 'Screen B.png',
};

/** 无空行三行 Comparison Column。 */
const NO_BLANK_STORAGE = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td>copy 2</td></tr>',
  '<tr><td>3</td><td>copy 3</td></tr>',
  '</table>',
].join('');

/** partial export 往返共用的唯一作用域。 */
const PARTIAL_EXPORT_SCOPE = 'copytest-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

/** 已有原子 Test Pair，第四个数据行是两个 Evidence section 的空行边界。 */
const BLANK_SEPARATED_ATOMIC_PAIR_STORAGE = [
  '<table><tr><th>ID</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>1</td><td>copy 1</td><td>Result 1</td><td>Evidence 1</td></tr>',
  '<tr><td>2</td><td>copy 2</td><td>Result 2</td><td>Evidence 2</td></tr>',
  '<tr><td>3</td><td>copy 3</td><td>Result 3</td><td>Evidence 3</td></tr>',
  '<tr><td>4</td><td></td><td>Result 4</td><td>Evidence 4</td></tr>',
  '<tr><td>5</td><td>copy 5</td><td>Result 5</td><td>Evidence 5</td></tr>',
  '<tr><td>6</td><td>copy 6</td><td>Result 6</td><td>Evidence 6</td></tr>',
  '<tr><td>7</td><td>copy 7</td><td>Result 7</td><td>Evidence 7</td></tr>',
  '</table>',
].join('');

/** 读取 Target 所属 managed Evidence 列中每个物理拥有单元格。 */
const getOwnedEvidenceCells = (table: CopyTestWorkingTable): Element[] => {
  const sourceKey = getSourceColumnKey(1, 'Target');
  const evidenceColumnIndex = findGeneratedColumnIndexes(table.headers, sourceKey).evidence;
  if (evidenceColumnIndex === undefined) {
    return [];
  }

  return table.model.rows.slice(1).flatMap(row => {
    const slot = row.slots[evidenceColumnIndex];
    return slot?.owned ? [slot.cell.element] : [];
  });
};

/** 按表格顺序读取一个 Evidence 单元格内的稳定图片 ID。 */
const getEvidenceImageIds = (cell: Element): string[] => {
  return Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)).map(image => {
    return image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
  });
};

/** 从无空行来源表构建已创建 Test Pair 的工作表格。 */
const buildNoBlankWorkingTable = (): CopyTestWorkingTable => {
  const table = parseCopyTestStorageTables(NO_BLANK_STORAGE)[0];
  return ensureCopyTestWorkingColumns(table, 1, 'Target');
};

/** 构建一条可直接应用的通过校验结果。 */
const buildPassedResult = (rowIndex: number, fileNames: string[]) => ({
  evidenceImageFileNames: fileNames,
  languageIssues: [],
  passed: true,
  rowIndex,
});

describe('CopyTest dynamic Evidence integration', () => {
  it('immediately upgrades an existing atomic Pair into two blank-separated Evidence groups', () => {
    const table = parseCopyTestStorageTables(BLANK_SEPARATED_ATOMIC_PAIR_STORAGE)[0];
    const ensured = ensureCopyTestWorkingColumns(table, 1, 'Target');
    const context = getCopyTestColumnContext(ensured, 1);
    const evidenceCells = getOwnedEvidenceCells(ensured);

    expect(context?.evidenceSections.map(section => section.dataRowIndexes)).toEqual([
      [0, 1, 2],
      [4, 5, 6],
    ]);
    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([
      0,
      0,
      0,
      undefined,
      4,
      4,
      4,
    ]);
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([3, 1, 3]);
    expect(evidenceCells[0].textContent).toContain('Evidence 1');
    expect(evidenceCells[0].textContent).toContain('Evidence 3');
    expect(evidenceCells[1].textContent).toContain('Evidence 4');
    expect(evidenceCells[2].textContent).toContain('Evidence 5');
    expect(evidenceCells[2].textContent).toContain('Evidence 7');
  });

  it('merges equal current winners and appends the next batch while monotonically expanding', () => {
    const working = buildNoBlankWorkingTable();

    expect(buildCopyTestRowGroups(working, 1).map(group => group.evidenceGroupId)).toEqual([0, 1, 2]);
    expect(getOwnedEvidenceCells(working).map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([1, 1, 1]);

    const firstBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const afterFirstBatch = applyCopyTestValidationResults(
      working,
      firstBatch,
      1,
      'Target',
      [SCREEN_A],
      firstBatch
    );
    const firstBatchEvidenceCells = getOwnedEvidenceCells(afterFirstBatch);

    expect(firstBatchEvidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([2, 1]);
    expect(getEvidenceImageIds(firstBatchEvidenceCells[0])).toEqual([SCREEN_A.fileName]);

    const cumulativeResults = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName, SCREEN_B.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName, SCREEN_B.fileName]),
      buildPassedResult(2, [SCREEN_B.fileName]),
    ], [SCREEN_A, SCREEN_B]);
    const currentBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_B.fileName]),
      buildPassedResult(1, [SCREEN_B.fileName]),
      buildPassedResult(2, [SCREEN_B.fileName]),
    ], [SCREEN_B]);
    const afterSecondBatch = applyCopyTestValidationResults(
      afterFirstBatch,
      cumulativeResults,
      1,
      'Target',
      [SCREEN_A, SCREEN_B],
      currentBatch
    );
    const secondBatchEvidenceCells = getOwnedEvidenceCells(afterSecondBatch);

    expect(secondBatchEvidenceCells).toHaveLength(1);
    expect(Number(secondBatchEvidenceCells[0].getAttribute('rowspan') || 1)).toBe(3);
    expect(getEvidenceImageIds(secondBatchEvidenceCells[0])).toEqual([
      SCREEN_A.fileName,
      SCREEN_B.fileName,
    ]);
  });

  it('preserves canonical group IDs and linked selection after ensure and reparse', () => {
    const working = buildNoBlankWorkingTable();
    const currentBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const validated = applyCopyTestValidationResults(
      working,
      currentBatch,
      1,
      'Target',
      [SCREEN_A],
      currentBatch
    );
    const reparsed = parseCopyTestStorageTables(validated.workingHtml)[0];
    const ensured = ensureCopyTestWorkingColumns(reparsed, 1, 'Target');
    const context = getCopyTestColumnContext(ensured, 1);

    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([0, 0, 0]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [1])).toEqual([0, 1, 2]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [])).toEqual([]);
  });

  it('does not merge across a row missing from the current batch', () => {
    const working = buildNoBlankWorkingTable();
    const currentBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const validated = applyCopyTestValidationResults(
      working,
      currentBatch,
      1,
      'Target',
      [SCREEN_A],
      currentBatch
    );
    const evidenceCells = getOwnedEvidenceCells(validated);

    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([1, 1, 1]);
    expect(getEvidenceImageIds(evidenceCells[0])).toEqual([SCREEN_A.fileName]);
    expect(getEvidenceImageIds(evidenceCells[1])).toEqual([]);
    expect(getEvidenceImageIds(evidenceCells[2])).toEqual([SCREEN_A.fileName]);
  });

  it('keeps a dynamic group after a partial export and a fresh import', () => {
    const working = buildNoBlankWorkingTable();
    const currentBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const validated = applyCopyTestValidationResults(
      working,
      currentBatch,
      1,
      'Target',
      [SCREEN_A],
      currentBatch
    );
    const exported = buildCurrentColumnExportStorage({
      exportScope: PARTIAL_EXPORT_SCOPE,
      originalStorageHtml: NO_BLANK_STORAGE,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target',
      selectedRowIndexes: [0, 1],
      table: validated,
    });

    expect(exported).not.toBeNull();
    const payload = buildConfluenceStorageTableExportPayload(
      exported || '',
      getSourceColumnKey(1, 'Target'),
      PARTIAL_EXPORT_SCOPE,
      [SCREEN_A]
    );
    expect(payload.storageHtml).toContain('data-copy-test-evidence-group-id="0"');
    expect(payload.storageHtml).not.toContain('data-copy-test-export-scope');
    const imported = parseCopyTestStorageTables(payload.storageHtml)[0];
    const ensured = ensureCopyTestWorkingColumns(imported, 1, 'Target');
    const context = getCopyTestColumnContext(ensured, 1);
    const evidenceCells = getOwnedEvidenceCells(ensured);

    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([0, 0, 2]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [1])).toEqual([0, 1]);
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([2, 1]);
    expect(getEvidenceImageIds(evidenceCells[0])).toEqual([SCREEN_A.fileName]);
  });
});
