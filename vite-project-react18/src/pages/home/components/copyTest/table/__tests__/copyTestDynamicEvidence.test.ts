import { describe, expect, it } from 'vitest';
import type { CopyTestImage } from '../../api/copyTestApi';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  ensureCopyTestWorkingColumns,
  hydrateCopyTestValidationSnapshot,
} from '../copyTestTableEditor';
import { buildCurrentColumnExportStorage } from '../copyTestTableExporter';
import {
  buildConfluenceStorageTableExportPayload,
  getConfluenceStorageTableImageFileNames,
} from '../copyTestTableImages';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSourceColumnKey,
  normalizeCopyTestSelectedRowIndexes,
  parseCopyTestStorageTables,
  type CopyTestWorkingTable,
} from '../copyTestTableParser';
import {
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from '../tableConstants';

/** 测试图片共用的最小 data URL。 */
const IMAGE_BASE64 = 'data:image/png;base64,QUJD';

/** 第一批动态分组的唯一 winner。 */
const SCREEN_A: CopyTestImage = {
  base64: IMAGE_BASE64,
  fileName: 'screen-a.png',
  originalFileName: 'Screen A.png',
};

/** 第二批覆盖并扩展动态分组的唯一 winner。 */
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

/** 无空行五行 Comparison Column，用于 partial Pair 两轮往返。 */
const FIVE_ROW_NO_BLANK_STORAGE = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td>copy 2</td></tr>',
  '<tr><td>3</td><td>copy 3</td></tr>',
  '<tr><td>4</td><td>copy 4</td></tr>',
  '<tr><td>5</td><td>copy 5</td></tr>',
  '</table>',
].join('');

/** partial export 往返共用的唯一作用域。 */
const PARTIAL_EXPORT_SCOPE = 'copytest-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

/** 两个连续非空区段均由前后空白行包围的已有原子 Test Pair。 */
const BLANK_SEPARATED_ATOMIC_PAIR_STORAGE = [
  '<table><tr><th>ID</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>0</td><td></td><td>Leading blank result</td><td>Leading blank evidence</td></tr>',
  '<tr><td>1</td><td>copy 1</td><td>Result 1</td><td>Evidence 1</td></tr>',
  '<tr><td>2</td><td>copy 2</td><td>Result 2</td><td>Evidence 2</td></tr>',
  '<tr><td>3</td><td>copy 3</td><td>Result 3</td><td>Evidence 3</td></tr>',
  '<tr><td>4</td><td></td><td>Result 4</td><td>Evidence 4</td></tr>',
  '<tr><td>5</td><td>copy 5</td><td>Result 5</td><td>Evidence 5</td></tr>',
  '<tr><td>6</td><td>copy 6</td><td>Result 6</td><td>Evidence 6</td></tr>',
  '<tr><td>7</td><td>copy 7</td><td>Result 7</td><td>Evidence 7</td></tr>',
  '<tr><td>8</td><td></td><td>Trailing blank result</td><td>Trailing blank evidence</td></tr>',
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

/** 读取一行中当前 Target Pair 指定类型的唯一直属 managed cell。 */
const getStrictGeneratedCell = (
  row: Element,
  type: typeof COPY_TEST_GENERATED_RESULT_TYPE | typeof COPY_TEST_GENERATED_EVIDENCE_TYPE
): Element | undefined => {
  const sourceColumnKey = getSourceColumnKey(1, 'Target');
  return Array.from(row.children).find(cell => {
    return cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === type
      && cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === sourceColumnKey
      && cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE) === sourceColumnKey
      && cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE) === COPY_TEST_SCHEMA_VERSION;
  });
};

/** 断言未选行的 placeholder Pair 只包含结构 metadata，不含任何校验内容或图片引用。 */
const expectEmptyStrictManagedPair = (row: Element): void => {
  const resultCell = getStrictGeneratedCell(row, COPY_TEST_GENERATED_RESULT_TYPE);
  const evidenceCell = getStrictGeneratedCell(row, COPY_TEST_GENERATED_EVIDENCE_TYPE);
  expect(resultCell).toBeDefined();
  expect(evidenceCell).toBeDefined();
  [resultCell, evidenceCell].forEach(cell => {
    expect(cell?.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}]`)).toBeNull();
    expect(cell?.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)).toBeNull();
    expect(cell?.querySelector(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`)).toBeNull();
    expect(cell?.textContent).toBe('');
  });
};

/** 校验首轮 partial payload 的空占位、矩形逻辑网格和历史快照，并返回 fresh working table。 */
const expectFreshPartialPayload = (
  payload: ReturnType<typeof buildConfluenceStorageTableExportPayload>
): CopyTestWorkingTable => {
  const documentModel = new DOMParser().parseFromString(payload.storageHtml, 'text/html');
  const rows = Array.from(documentModel.querySelectorAll('tr'));
  expect(rows).toHaveLength(6);
  expect(rows[4].children).toHaveLength(4);
  expect(rows[5].children).toHaveLength(4);
  expectEmptyStrictManagedPair(rows[4]);
  expectEmptyStrictManagedPair(rows[5]);
  expect(payload.images.map(image => image.fileName)).toEqual([SCREEN_A.fileName]);

  const imported = parseCopyTestStorageTables(payload.storageHtml)[0];
  const ensured = ensureCopyTestWorkingColumns(imported, 1, 'Target');
  const context = getCopyTestColumnContext(ensured, 1);
  if (!context) {
    throw new Error('Expected fresh Target column context');
  }
  const evidenceCells = getOwnedEvidenceCells(ensured);
  expect(ensured.model.columnCount).toBe(4);
  expect(ensured.model.rows.every(row => {
    const logicalSlots = row.slots.slice(0, 4);
    return logicalSlots.length === 4 && logicalSlots.every(Boolean);
  })).toBe(true);
  expect(context.rowGroups.map(group => group.evidenceGroupId)).toEqual([0, 0, 0, 3, 4]);
  expect(context.selectionRowGroups.map(group => group.evidenceGroupId)).toEqual([0, 1, 2, 3, 4]);
  expect(normalizeCopyTestSelectedRowIndexes(context.selectionRowGroups, [1])).toEqual([1]);
  expect(normalizeCopyTestSelectedRowIndexes(context.selectionRowGroups, [3, 4])).toEqual([3, 4]);
  expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
    .toEqual([3, 1, 1]);
  expect(getEvidenceImageIds(evidenceCells[0])).toEqual([SCREEN_A.fileName]);
  expect(getEvidenceImageIds(evidenceCells[1])).toEqual([]);
  expect(getEvidenceImageIds(evidenceCells[2])).toEqual([]);
  const snapshot = hydrateCopyTestValidationSnapshot(ensured, 1, 'Target');
  if (!snapshot) {
    throw new Error('Expected first partial validation snapshot');
  }
  expect(snapshot.results.map(result => result.rowIndex)).toEqual([0, 1, 2]);
  expect(snapshot.images.map(image => image.fileName)).toEqual([SCREEN_A.fileName]);
  return ensured;
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
      [1, 2, 3],
      [5, 6, 7],
    ]);
    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([
      undefined,
      1,
      1,
      1,
      undefined,
      5,
      5,
      5,
      undefined,
    ]);
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([1, 3, 1, 3, 1]);
    expect(evidenceCells[0].textContent).toContain('Leading blank evidence');
    expect(evidenceCells[1].textContent).toContain('Evidence 1');
    expect(evidenceCells[1].textContent).toContain('Evidence 3');
    expect(evidenceCells[2].textContent).toContain('Evidence 4');
    expect(evidenceCells[3].textContent).toContain('Evidence 5');
    expect(evidenceCells[3].textContent).toContain('Evidence 7');
    expect(evidenceCells[4].textContent).toContain('Trailing blank evidence');
  });

  it('merges equal current winners and keeps only the next winner while expanding', () => {
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

    const secondBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_B.fileName]),
      buildPassedResult(1, [SCREEN_B.fileName]),
      buildPassedResult(2, [SCREEN_B.fileName]),
    ], [SCREEN_B]);
    const afterSecondBatch = applyCopyTestValidationResults(
      afterFirstBatch,
      secondBatch,
      1,
      'Target',
      [SCREEN_B],
      secondBatch
    );
    const secondBatchEvidenceCells = getOwnedEvidenceCells(afterSecondBatch);

    expect(secondBatchEvidenceCells).toHaveLength(1);
    expect(Number(secondBatchEvidenceCells[0].getAttribute('rowspan') || 1)).toBe(3);
    expect(getEvidenceImageIds(secondBatchEvidenceCells[0])).toEqual([SCREEN_B.fileName]);
  });

  it('preserves canonical visual group IDs without restoring linked selection', () => {
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
    expect(context?.selectionRowGroups.map(group => group.evidenceGroupId)).toEqual([0, 1, 2]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.selectionRowGroups || [], [1])).toEqual([1]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.selectionRowGroups || [], [])).toEqual([]);
  });

  it('revalidates one row independently and replans its touched dynamic group', () => {
    const working = buildNoBlankWorkingTable();
    const firstBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const merged = applyCopyTestValidationResults(
      working,
      firstBatch,
      1,
      'Target',
      [SCREEN_A],
      firstBatch
    );
    const overwrittenResults = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_B.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
    ], [SCREEN_A, SCREEN_B]);
    const currentBatch = bindResultImages([
      buildPassedResult(1, [SCREEN_B.fileName]),
    ], [SCREEN_B]);
    const revalidated = applyCopyTestValidationResults(
      merged,
      overwrittenResults,
      1,
      'Target',
      [SCREEN_A, SCREEN_B],
      currentBatch
    );
    const evidenceCells = getOwnedEvidenceCells(revalidated);

    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([1, 1, 1]);
    expect(evidenceCells.map(getEvidenceImageIds)).toEqual([
      [SCREEN_A.fileName],
      [SCREEN_B.fileName],
      [SCREEN_A.fileName],
    ]);
    expect(buildCopyTestRowGroups(revalidated, 1).map(group => group.evidenceGroupId))
      .toEqual([0, 1, 2]);
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
    expect(context?.selectionRowGroups.map(group => group.evidenceGroupId)).toEqual([0, 1, 2]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.selectionRowGroups || [], [1])).toEqual([1]);
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([2, 1]);
    expect(getEvidenceImageIds(evidenceCells[0])).toEqual([SCREEN_A.fileName]);
  });

  it('keeps empty strict Pair placeholders for unselected rows across two partial exports', () => {
    const imported = parseCopyTestStorageTables(FIVE_ROW_NO_BLANK_STORAGE)[0];
    const working = ensureCopyTestWorkingColumns(imported, 1, 'Target');
    const firstBatch = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
    ], [SCREEN_A]);
    const firstValidated = applyCopyTestValidationResults(
      working,
      firstBatch,
      1,
      'Target',
      [SCREEN_A],
      firstBatch
    );
    const firstExported = buildCurrentColumnExportStorage({
      exportScope: PARTIAL_EXPORT_SCOPE,
      originalStorageHtml: FIVE_ROW_NO_BLANK_STORAGE,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target',
      selectedRowIndexes: [0, 1, 2],
      table: firstValidated,
    });

    expect(firstExported).not.toBeNull();
    const firstPayload = buildConfluenceStorageTableExportPayload(
      firstExported || '',
      getSourceColumnKey(1, 'Target'),
      PARTIAL_EXPORT_SCOPE,
      [SCREEN_A]
    );
    const freshEnsured = expectFreshPartialPayload(firstPayload);

    const cumulativeResults = bindResultImages([
      buildPassedResult(0, [SCREEN_A.fileName]),
      buildPassedResult(1, [SCREEN_A.fileName]),
      buildPassedResult(2, [SCREEN_A.fileName]),
      buildPassedResult(3, [SCREEN_B.fileName]),
      buildPassedResult(4, [SCREEN_B.fileName]),
    ], [SCREEN_A, SCREEN_B]);
    const secondBatch = bindResultImages([
      buildPassedResult(3, [SCREEN_B.fileName]),
      buildPassedResult(4, [SCREEN_B.fileName]),
    ], [SCREEN_B]);
    const secondValidated = applyCopyTestValidationResults(
      freshEnsured,
      cumulativeResults,
      1,
      'Target',
      [SCREEN_A, SCREEN_B],
      secondBatch
    );
    expect(getOwnedEvidenceCells(secondValidated).map(cell => {
      return Number(cell.getAttribute('rowspan') || 1);
    })).toEqual([3, 2]);

    const secondExported = buildCurrentColumnExportStorage({
      exportScope: PARTIAL_EXPORT_SCOPE,
      originalStorageHtml: firstPayload.storageHtml,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Target',
      selectedRowIndexes: [3, 4],
      table: secondValidated,
    });
    expect(secondExported).not.toBeNull();
    const secondPayload = buildConfluenceStorageTableExportPayload(
      secondExported || '',
      getSourceColumnKey(1, 'Target'),
      PARTIAL_EXPORT_SCOPE,
      [SCREEN_A, SCREEN_B]
    );
    expect(secondPayload.images.map(image => image.fileName)).toEqual([SCREEN_B.fileName]);
    expect(getConfluenceStorageTableImageFileNames(secondPayload.storageHtml))
      .toEqual([SCREEN_A.fileName, SCREEN_B.fileName]);

    const finalDocument = new DOMParser().parseFromString(secondPayload.storageHtml, 'text/html');
    expect(finalDocument.querySelectorAll(
      `th[${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(1);
    expect(finalDocument.querySelectorAll(
      `th[${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    )).toHaveLength(1);
    const finalImported = ensureCopyTestWorkingColumns(
      parseCopyTestStorageTables(secondPayload.storageHtml)[0],
      1,
      'Target'
    );
    const finalEvidenceCells = getOwnedEvidenceCells(finalImported);
    expect(getCopyTestColumnContext(finalImported, 1)?.rowGroups.map(group => group.evidenceGroupId))
      .toEqual([0, 0, 0, 3, 3]);
    expect(getCopyTestColumnContext(finalImported, 1)?.selectionRowGroups.map(group => {
      return group.evidenceGroupId;
    })).toEqual([0, 1, 2, 3, 4]);
    expect(finalEvidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([3, 2]);
    expect(getEvidenceImageIds(finalEvidenceCells[0])).toEqual([SCREEN_A.fileName]);
    expect(getEvidenceImageIds(finalEvidenceCells[1])).toEqual([SCREEN_B.fileName]);
    const finalSnapshot = hydrateCopyTestValidationSnapshot(finalImported, 1, 'Target');
    expect(finalSnapshot?.results.map(result => result.rowIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(finalSnapshot?.images.map(image => image.fileName))
      .toEqual([SCREEN_A.fileName, SCREEN_B.fileName]);
  });
});
