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
  type CopyTestWorkingTable,
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

/** 从指定物理行移除 managed Result，构造 Evidence 仍存在的局部 DOM 恢复场景。 */
const removeManagedResultAtRow = (
  table: CopyTestWorkingTable,
  physicalRowIndex: number,
  sourceColumnKey: string
): CopyTestWorkingTable => {
  /** 当前来源列生成双列的逻辑下标。 */
  const indexes = findGeneratedColumnIndexes(table.headers, sourceColumnKey);
  /** 指定物理行直接拥有的 Result 单元格。 */
  const resultCell = table.model.rows[physicalRowIndex].slots[indexes.result!]!.cell.element;
  /** 当前 Result 单元格中待移除的 managed 内容。 */
  const resultRoot = resultCell.querySelector(
    `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
  );
  resultRoot?.remove();
  /** 移除局部 Result 后重新解析的工作表格。 */
  const tableElement = resultCell.closest('table')!;
  return parseCopyTestStorageTables(tableElement.outerHTML)[0];
};

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

  it('uses Column N labels for new and existing managed pairs with a blank source header', () => {
    /** 仅包含一个空来源表头、尚未生成 Test 双列的表格。 */
    const blankHeaderTable = parseCopyTestStorageTables(
      '<table><tr><th><br /></th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** 空来源表头对应的稳定 ownership key，不能包含展示用 Column N。 */
    const sourceKey = getSourceColumnKey(0, '');
    /** 首次选择空来源列后创建的可辨识 Test 双列。 */
    const created = ensureCopyTestWorkingColumns(blankHeaderTable, 0, '');

    expect(created.headers.map(header => header.label)).toEqual([
      '',
      'Test Result - Column 1',
      'Test Evidence - Column 1',
    ]);
    expect(findGeneratedColumnIndexes(created.headers, sourceKey)).toEqual({
      evidence: 2,
      result: 1,
    });
    expect(created.headers.slice(1).every(header => header.sourceColumnKey === sourceKey)).toBe(true);

    /** 模拟已经回写过旧版不可区分表头的严格 managed Pair。 */
    const existingPairTable = parseCopyTestStorageTables([
      '<table><tr><th></th>',
      '<th data-copy-test-column-type="result" data-copy-test-source-column-key="0:" data-copy-test-owner-id="0:" data-copy-test-schema="2">Test Result -</th>',
      '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:" data-copy-test-owner-id="0:" data-copy-test-schema="2">Test Evidence -</th></tr>',
      '<tr><td>copy</td><td></td><td></td></tr></table>',
    ].join(''))[0];
    /** 重新选择空来源列后修正表头、但不新增 Pair 的工作表格。 */
    const repaired = ensureCopyTestWorkingColumns(existingPairTable, 0, '');

    expect(repaired.headers.map(header => header.label)).toEqual([
      '',
      'Test Result - Column 1',
      'Test Evidence - Column 1',
    ]);
    expect(findGeneratedColumnIndexes(repaired.headers, sourceKey)).toEqual({
      evidence: 2,
      result: 1,
    });
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

  it('clears Result status when a rowspan source group has no Evidence', () => {
    /** 中间合并原子组没有命中图片、前后两组命中同一图片的校验结果。 */
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [],
        languageIssues: ['Expected copy is missing.'],
        passed: false,
        rowIndex: 1,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 3,
      },
    ], images);
    /** 应用包含无 Evidence 失败结果的工作表格。 */
    const validated = applyCopyTestValidationResults(
      parseCopyTestStorageTables(middleMergedStorageHtml)[0],
      results,
      1,
      'Target',
      images
    );
    /** Target 来源列稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(1, 'Target');
    /** Target 生成双列的逻辑下标。 */
    const indexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    /** 无 Evidence 原子组恢复为空的 Result 单元格。 */
    const failedResultCell = validated.model.rows[2].slots[indexes.result!]!.cell.element;
    /** 无 Evidence 失败原子组的 Evidence 单元格。 */
    const emptyEvidenceCell = validated.model.rows[2].slots[indexes.evidence!]!.cell.element;
    /** 前后 Evidence 单元格，用于证明空图片原子组阻断跨组合并。 */
    const evidenceCells = [1, 4].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[indexes.evidence!]!.cell.element;
    });

    expect(failedResultCell.getAttribute('rowspan')).toBe('2');
    expect(failedResultCell.textContent?.trim()).toBe('');
    expect(failedResultCell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toBeNull();
    expect(getResultImageIds(failedResultCell)).toEqual([]);
    expect(emptyEvidenceCell.getAttribute('rowspan')).toBe('2');
    expect(emptyEvidenceCell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    )).toBeNull();
    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([1, 1]);
    expect(evidenceCells.every(cell => cell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    ))).toBe(true);

    /** 模拟回写后重新 Import 的工作表格。 */
    const imported = parseCopyTestStorageTables(validated.workingHtml)[0];
    /** 删除首个 Evidence 组的唯一图片，验证无图行不会恢复 Result。 */
    const imageId = getCopyTestImageId(SCREEN_1);
    const deleted = deleteCopyTestEvidenceImage(
      imported,
      { imageId, instanceId: `${sourceKey}:1:${imageId}` },
      1,
      'Target'
    );

    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults?.map(result => ({
      evidenceImageFileNames: result.evidenceImageFileNames,
      languageIssues: result.languageIssues,
      rowIndex: result.rowIndex,
    }))).toEqual([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        rowIndex: 3,
      },
    ]);
    expect(deleted.table.model.rows[2].slots[indexes.result!]!.cell.element.textContent?.trim()).toBe('');
  });

  it('keeps a four-row source group blank in both generated columns without Evidence', () => {
    /** 与截图中 Permissions flow 06 一致的四物理行来源合并组。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>ID</th><th>Feature group</th></tr>',
      '<tr><td>1</td><td rowspan="4">Permissions flow 06</td></tr>',
      '<tr><td>2</td></tr><tr><td>3</td></tr><tr><td>4</td></tr></table>',
    ].join(''))[0];
    /** AI 返回失败原因但没有关联任何 Evidence 的结果。 */
    const results = bindResultImages([{
      evidenceImageFileNames: [],
      languageIssues: ['OCR text does not match the selected comparison copy.'],
      passed: false,
      rowIndex: 0,
    }], images);
    /** 应用结果后仍需要保留来源组的四行跨度。 */
    const validated = applyCopyTestValidationResults(table, results, 1, 'Feature group', images);
    /** 当前来源列生成双列的逻辑下标。 */
    const indexes = findGeneratedColumnIndexes(
      validated.headers,
      getSourceColumnKey(1, 'Feature group')
    );
    /** 四行组锚点对应的空 Result 和 Evidence 单元格。 */
    const resultCell = validated.model.rows[1].slots[indexes.result!]!.cell.element;
    const evidenceCell = validated.model.rows[1].slots[indexes.evidence!]!.cell.element;

    expect(resultCell.getAttribute('rowspan')).toBe('4');
    expect(evidenceCell.getAttribute('rowspan')).toBe('4');
    expect(resultCell.textContent?.trim()).toBe('');
    expect(evidenceCell.textContent?.trim()).toBe('');
    expect(validated.workingHtml).not.toContain('Failed:');
    expect(validated.workingHtml).not.toContain('OCR text does not match');
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
      [SCREEN_2.fileName],
    ]);
    expect(resultRoots).toHaveLength(1);
    expect(evidenceCards).toHaveLength(1);
    expect(evidenceCards[0].querySelector('strong')?.textContent).toBe('Screen01');
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).toContain(SCREEN_2.fileName);
  });

  it('keeps unrelated Evidence blocks unchanged after reload while renumbering only the deleted rowspan block', () => {
    /** 包含两个独立 Evidence 连通块和 rowspan 原子组的来源表格。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td rowspan="2">A1-2</td></tr>',
      '<tr></tr>',
      '<tr><td>separator</td></tr>',
      '<tr><td rowspan="2">B1-2</td></tr>',
      '<tr></tr>',
      '<tr><td>B3</td></tr></table>',
    ].join(''))[0];
    /** 为两个连通块构造不同 Screen 顺序的校验结果。 */
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_2.fileName, SCREEN_3.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_3.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 3,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName, SCREEN_3.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 5,
      },
    ], images);
    /** 首次 Validate 后生成 Test 双列的工作表。 */
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    /** 模拟 Export 后再次 Import，确保删除不依赖内存校验快照。 */
    const imported = parseCopyTestStorageTables(validated.workingHtml)[0];
    /** Target 来源列稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 再次导入后 Target Test 双列的逻辑下标。 */
    const indexes = findGeneratedColumnIndexes(imported.headers, sourceKey);
    /** 未受删除影响的第二个 Evidence 连通块完整语义签名。 */
    const unaffectedSignatureBefore = [4, 6].map(rowIndex => {
      return imported.model.rows[rowIndex].slots[indexes.result!]!.cell.element.outerHTML;
    }).concat(imported.model.rows[4].slots[indexes.evidence!]!.cell.element.outerHTML);
    /** 第一个连通块中待删除 Screen 的稳定图片 ID。 */
    const targetImageId = getCopyTestImageId(SCREEN_2);

    /** 删除第一个连通块图片后的局部重投影结果。 */
    const deleted = deleteCopyTestEvidenceImage(
      imported,
      { imageId: targetImageId, instanceId: `${sourceKey}:1:${targetImageId}` },
      0,
      'Target'
    );
    /** 删除后 Target Test 双列的逻辑下标。 */
    const deletedIndexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    /** 删除后同一未受影响连通块的完整语义签名。 */
    const unaffectedSignatureAfter = [4, 6].map(rowIndex => {
      return deleted.table.model.rows[rowIndex].slots[deletedIndexes.result!]!.cell.element.outerHTML;
    }).concat(deleted.table.model.rows[4].slots[deletedIndexes.evidence!]!.cell.element.outerHTML);
    /** 受影响原子组删除后的 Result 单元格。 */
    const affectedResult = deleted.table.model.rows[1].slots[deletedIndexes.result!]!.cell.element;
    /** 受影响原子组删除后的 Evidence 单元格。 */
    const affectedEvidence = deleted.table.model.rows[1].slots[deletedIndexes.evidence!]!.cell.element;

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(true);
    expect(unaffectedSignatureAfter).toEqual(unaffectedSignatureBefore);
    expect(affectedResult.getAttribute('rowspan')).toBe('2');
    expect(affectedEvidence.getAttribute('rowspan')).toBe('2');
    expect(getResultImageIds(affectedResult)).toEqual([SCREEN_3.fileName]);
    expect(affectedResult.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${SCREEN_3.fileName}"]`
    )!.firstChild!.textContent).toBe('Screen01');
    expect(affectedEvidence.querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${SCREEN_3.fileName}"]`
    )!.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`)!.querySelector('strong')!.textContent).toBe('Screen01');
    expect(buildCopyTestRowGroups(deleted.table, 0).map(group => group.rowSpan)).toEqual([2, 1, 2, 1]);
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

  it('keeps rows 2 and 3 atomic when all four physical rows are validated and replanned', () => {
    /** 中间两行通过 rowspan 合并为原子组的四行来源表格。 */
    const table = parseCopyTestStorageTables(middleMergedStorageHtml)[0];
    /** 四行来源表格按原子组构造的校验结果。 */
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
    /** 应用初次校验结果后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, results, 1, 'Target', images);
    /** Target 来源列稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(1, 'Target');
    /** 初次校验后生成双列的逻辑下标。 */
    const initialIndexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    /** 三个来源原子组锚点对应的 Result 单元格。 */
    const initialResultCells = [1, 2, 4].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[initialIndexes.result!]!.cell.element;
    });

    expect(initialResultCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([1, 2, 1]);
    expect(validated.model.rows[3].slots[initialIndexes.result!]!.owned).toBe(false);
    expect(initialResultCells.map(getResultImageIds)).toEqual([
      [SCREEN_1.fileName],
      [SCREEN_1.fileName],
      [SCREEN_1.fileName, SCREEN_2.fileName],
    ]);
    expect(validated.model.rows[1].slots[initialIndexes.evidence!]!.cell.rowSpan).toBe(4);
    expect([2, 3, 4].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[initialIndexes.evidence!]!.owned;
    })).toEqual([false, false, false]);

    /** 首张共享 Evidence 图片的稳定 ID。 */
    const firstImageId = getCopyTestImageId(SCREEN_1);
    /** 删除首张共享图片并重新规划后的结果。 */
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      1,
      'Target',
      buildSnapshot(results)
    );
    /** 删除后生成双列的逻辑下标。 */
    const indexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    /** 删除后四个物理行位置的 Evidence ownership 与 rowspan。 */
    const evidenceSlots = [1, 2, 3, 4].map(rowIndex => {
      const slot = deleted.table.model.rows[rowIndex].slots[indexes.evidence!];
      return { owned: slot!.owned, rowSpan: slot!.cell.rowSpan };
    });
    /** 删除后三个来源原子组锚点的 Result 单元格。 */
    const resultCells = [1, 2, 4].map(rowIndex => {
      return deleted.table.model.rows[rowIndex].slots[indexes.result!]!.cell.element;
    });
    /** 删除后工作表格的可查询文档。 */
    const doc = parseHtml(deleted.table.workingHtml);
    /** 删除后仍保留的第二张 Evidence 图片。 */
    const remainingEvidence = doc.querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${SCREEN_2.fileName}"]`
    )!;

    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(evidenceSlots).toEqual([
      { owned: true, rowSpan: 1 },
      { owned: true, rowSpan: 2 },
      { owned: false, rowSpan: 2 },
      { owned: true, rowSpan: 1 },
    ]);
    expect(buildCopyTestRowGroups(deleted.table, 1).map(group => group.rowSpan)).toEqual([1, 2, 1]);
    expect(resultCells[0].querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toBeNull();
    expect(resultCells[1].querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toBeNull();
    expect(resultCells[2].textContent).toContain('Passed:');
    expect(getResultImageIds(resultCells[2])).toEqual([SCREEN_2.fileName]);
    expect(remainingEvidence.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)).toBe(
      `${sourceKey}:4:${SCREEN_2.fileName}`
    );
    expect(remainingEvidence.closest('td')!.getAttribute('rowspan')).toBeNull();
    expect(remainingEvidence.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`)!
      .querySelector('strong')!.textContent).toBe('Screen01');
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_3.fileName);
    expect(deleted.validationResults!.map(result => result.evidenceImageFileNames)).toEqual([
      [SCREEN_2.fileName],
    ]);
  });

  it('removes Failed and language issues when deleting its final Evidence image', () => {
    /** 单行失败且仅引用一张 Evidence 图片的来源表格。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** 删除前应正常展示 Failed、失败原因和 Screen01 的校验结果。 */
    const results = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: ['Visible copy differs.'],
      passed: false,
      rowIndex: 0,
    }], images);
    /** 应用初次失败结果后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    /** Target 来源列稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 唯一 Evidence 图片的稳定 ID。 */
    const imageId = getCopyTestImageId(SCREEN_1);

    expect(validated.workingHtml).toContain('Failed:');
    expect(validated.workingHtml).toContain('Visible copy differs.');

    /** 删除最后一张 Evidence 图片后的局部重投影结果。 */
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId: `${sourceKey}:1:${imageId}` },
      0,
      'Target',
      buildSnapshot(results)
    );

    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults).toEqual([]);
    expect(deleted.table.workingHtml).not.toContain('Failed:');
    expect(deleted.table.workingHtml).not.toContain('Visible copy differs.');
    expect(parseHtml(deleted.table.workingHtml).querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
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

  it('deletes the visible Evidence instance on the first attempt when the caller snapshot is stale', () => {
    /** 单行同时引用两张图片的当前工作表格。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** 当前 working DOM 中真实存在的两张 Evidence 关系。 */
    const currentResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 模拟仍只记录第二张图片的过期内存快照。 */
    const staleResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_2.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 应用当前真实结果后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, currentResults, 0, 'Target', images);
    /** 当前来源列的稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 当前界面首张 Evidence 图片的稳定 ID。 */
    const firstImageId = getCopyTestImageId(SCREEN_1);

    /** 使用过期快照确认删除当前界面中的首张图片。 */
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target',
      buildSnapshot(staleResults)
    );
    /** 删除后用于检查 Screen 重新编号的文档。 */
    const doc = parseHtml(deleted.table.workingHtml);

    expect(deleted.removed).toBe(true);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${firstImageId}"]`
    )).toHaveLength(0);
    expect(Array.from(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`))
      .map(card => card.querySelector('strong')?.textContent)).toEqual(['Screen01']);
    expect(deleted.validationResults?.map(result => result.evidenceImageFileNames)).toEqual([
      [SCREEN_2.fileName],
    ]);
  });

  it('falls back to an aligned caller snapshot when live DOM hydration lacks the target Result', () => {
    /** 两行分别拥有独立 Evidence 连通块的来源表格。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td>copy 1</td></tr><tr><td>copy 2</td></tr></table>',
    ].join(''))[0];
    /** 当前完整结构化结果，供 fallback 精确恢复目标组。 */
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
    ], images);
    /** 完整校验结果写入后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    /** 当前来源列的稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 移除首行 Result、但保留其 Evidence 的局部不完整 DOM。 */
    const incomplete = removeManagedResultAtRow(validated, 1, sourceKey);
    /** 删除前不受影响的第二个 Evidence 连通块 HTML。 */
    const indexes = findGeneratedColumnIndexes(incomplete.headers, sourceKey);
    const unrelatedEvidenceBefore = incomplete.model.rows[2]
      .slots[indexes.evidence!]!.cell.element.outerHTML;
    /** 当前界面首张 Evidence 图片的稳定 ID。 */
    const firstImageId = getCopyTestImageId(SCREEN_1);

    /** live hydrate 缺少首行 Result 时，应使用对齐的调用方快照完成首次删除。 */
    const deleted = deleteCopyTestEvidenceImage(
      incomplete,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target',
      buildSnapshot(results)
    );
    /** 删除后生成双列的逻辑下标。 */
    const deletedIndexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);

    expect(deleted.removed).toBe(true);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).toContain(SCREEN_2.fileName);
    expect(deleted.table.model.rows[2]
      .slots[deletedIndexes.evidence!]!.cell.element.outerHTML).toBe(unrelatedEvidenceBefore);
  });

  it('fails closed when a stale target or mismatched fallback snapshot is not current', () => {
    /** 单行真实展示两张 Evidence 图片的来源表格。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** working DOM 当前真实拥有的两张图片关系。 */
    const currentResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName, SCREEN_2.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 缺少第二张当前图片的过期调用方关系。 */
    const mismatchedResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 当前完整结果写入后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, currentResults, 0, 'Target', images);
    /** 当前来源列的稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 构造 Result 缺失、只能进入调用方快照 fallback 的工作表格。 */
    const incomplete = removeManagedResultAtRow(validated, 1, sourceKey);
    /** 当前界面首张 Evidence 图片的稳定 ID。 */
    const firstImageId = getCopyTestImageId(SCREEN_1);

    /** 图片集合不一致的快照不得重写当前 Evidence 连通块。 */
    const mismatched = deleteCopyTestEvidenceImage(
      incomplete,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target',
      buildSnapshot(mismatchedResults)
    );
    /** 当前 DOM 已不存在、但旧快照仍包含的虚假删除目标。 */
    const missing = deleteCopyTestEvidenceImage(
      validated,
      { imageId: SCREEN_3.fileName, instanceId: `${sourceKey}:1:${SCREEN_3.fileName}` },
      0,
      'Target',
      buildSnapshot(bindResultImages([{
        evidenceImageFileNames: [SCREEN_3.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], images))
    );

    expect(mismatched).toEqual({ imageStillUsed: false, removed: false, table: incomplete });
    expect(missing).toEqual({ imageStillUsed: false, removed: false, table: validated });
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
