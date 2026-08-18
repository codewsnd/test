import { describe, expect, it } from 'vitest';
import type { CopyTestValidationResultWithEvidence } from '../copyTestTableEditor';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  deleteCopyTestEvidenceImage,
  ensureCopyTestWorkingColumns,
  hydrateCopyTestValidationSnapshot,
  setCopyTestResultStatus,
} from '../copyTestTableEditor';
import { buildCopyTestExportTableModel } from '../../export/copyTestExportModel';
import { getCopyTestImageId } from '../copyTestImageUtils';
import { buildCurrentColumnExportStorage } from '../copyTestTableExporter';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
  type CopyTestWorkingTable,
} from '../copyTestTableParser';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_RESULT_FAILED_GROUP_VALUE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_RESULT_PASSED_GROUP_VALUE,
  COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE,
  COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
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

/** 读取一个 Result 状态分组中的图片 ID。 */
const getResultGroupImageIds = (
  resultRoot: Element,
  groupValue: string
): string[] => {
  const group = Array.from(resultRoot.children).find(child => {
    return child.getAttribute(COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE) === groupValue;
  });
  return getResultImageIds(group);
};

/** 读取 Result 中指定图片当前实例 ID。 */
const getResultImageInstanceId = (
  resultRoot: Element,
  imageId: string
): string => {
  const reference = Array.from(resultRoot.querySelectorAll(
    `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
  )).find(item => item.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) === imageId);
  return reference?.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE) || '';
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

  it('在 Result 和 Evidence 中显示不带扩展名的原始图片文件名', () => {
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    const uploadedImage = {
      base64: IMAGE_BASE64,
      fileName: '0198f4e0-0000-7000-8000-000000000000.png',
      originalFileName: 'This is just test.png',
    };
    const results = bindResultImages([{
      evidenceImageFileNames: [uploadedImage.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], [uploadedImage]);
    const validated = applyCopyTestValidationResults(
      table,
      results,
      0,
      'Target',
      [uploadedImage]
    );
    const doc = parseHtml(validated.workingHtml);
    const resultReference = doc.querySelector(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`);
    const evidenceCard = doc.querySelector(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`);
    const evidenceImage = doc.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`);
    const hydrated = hydrateCopyTestValidationSnapshot(validated, 0, 'Target');

    expect(resultReference?.firstChild?.textContent).toBe('This is just test');
    expect(evidenceCard?.querySelector('strong')?.textContent)
      .toBe('This is just test');
    expect(evidenceImage?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE))
      .toBe('This is just test.png');
    expect(hydrated?.images[0]).toMatchObject({
      fileName: uploadedImage.fileName,
      originalFileName: uploadedImage.originalFileName,
    });
  });

  it('toggles only the section winner status and keeps export content clean', () => {
    /** 单行候选图片平票时，上传顺序靠前的 Screen01 成为唯一 winner。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** 原始失败结果保留多图片输入，用于验证渲染层只接受唯一 winner。 */
    const results = bindResultImages([{
      evidenceImageFileNames: [SCREEN_2.fileName, SCREEN_1.fileName],
      languageIssues: ['Visible copy differs.'],
      passed: false,
      rowIndex: 0,
    }], images);
    /** 写入初始失败结果后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    /** 当前来源列对应的稳定 ownership 键。 */
    const sourceColumnKey = getSourceColumnKey(0, 'Target');
    /** 切换前不应发生变化的 Evidence 单元格结构。 */
    const initialIndexes = findGeneratedColumnIndexes(validated.headers, sourceColumnKey);
    const evidenceBefore = validated.model.rows[1]
      .slots[initialIndexes.evidence!]!.cell.element.outerHTML;
    const initialRoot = parseHtml(validated.workingHtml).querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;
    const screen1InstanceId = getResultImageInstanceId(initialRoot, SCREEN_1.fileName);

    expect(getResultImageIds(initialRoot)).toEqual([SCREEN_1.fileName]);
    expect(validated.workingHtml).not.toContain(SCREEN_2.fileName);

    /** 把唯一 winner 从 Failed 切换为 Passed。 */
    const passed = setCopyTestResultStatus(validated, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: true,
      rowIndex: 0,
      sourceColumnKey,
    });
    const passedDoc = parseHtml(passed.table.workingHtml);
    const passedRoot = passedDoc.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;
    const passedSnapshot = hydrateCopyTestValidationSnapshot(
      passed.table,
      0,
      'Target'
    );
    const passedExportModel = buildCopyTestExportTableModel(
      passed.table.workingHtml,
      [SCREEN_1, SCREEN_2]
    );
    const passedResultCell = passedExportModel.rows[1].cells.find(cell => {
      return cell.kind === 'result';
    });
    /** 将单一状态通过现有当前列增量导出链路写回 Confluence storage。 */
    const confluenceStorage = buildCurrentColumnExportStorage({
      exportScope: 'copytest-cccccccccccccccccccccccccccccccc',
      originalStorageHtml: table.originalHtml,
      selectedColumnIndex: 0,
      selectedColumnLabel: 'Target',
      table: passed.table,
    });
    const confluenceDocument = parseHtml(confluenceStorage || '');
    const confluenceResult = confluenceDocument.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    );

    expect(passed.changed).toBe(true);
    expect(passed.passed).toBe(true);
    expect(getResultGroupImageIds(
      passedRoot,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([SCREEN_1.fileName]);
    expect(getResultGroupImageIds(
      passedRoot,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([]);
    expect(passedRoot.textContent).not.toContain('Visible copy differs.');
    expect(passedRoot.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${SCREEN_1.fileName}"]`
    )?.getAttribute(COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE)).toBe(
      JSON.stringify(['Visible copy differs.'])
    );
    expect(passedSnapshot?.results[0]).toMatchObject({
      languageIssues: ['Visible copy differs.'],
      passed: true,
      rowIndex: 0,
      screenStatuses: [
        {
          imageId: SCREEN_1.fileName,
          languageIssues: ['Visible copy differs.'],
          passed: true,
        },
      ],
    });
    expect(passedResultCell?.text).toBe('Passed:\n• screen-a');
    expect(passedResultCell?.text).not.toContain('Set to');
    expect(confluenceStorage).not.toBeNull();
    expect(Array.from(confluenceResult?.querySelectorAll('strong') || [])
      .map(status => status.textContent)).toEqual(['Passed:']);
    expect(confluenceResult?.textContent).not.toContain('Visible copy differs.');
    expect(confluenceStorage).not.toContain('Set to Failed');
    expect(confluenceStorage).not.toContain('data-copy-test-result-status-button');
    expect(passed.table.workingHtml).not.toContain('data-copy-test-result-status-button');
    expect(passed.table.workingHtml).not.toContain('Set to Failed');
    expect(passed.table.model.rows[1]
      .slots[initialIndexes.evidence!]!.cell.element.outerHTML).toBe(evidenceBefore);

    /** 再把唯一 winner 切回 Failed，并恢复自身保留的错误信息。 */
    const failed = setCopyTestResultStatus(passed.table, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: false,
      rowIndex: 0,
      sourceColumnKey,
    });
    const failedRoot = parseHtml(failed.table.workingHtml).querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;
    expect(getResultGroupImageIds(
      failedRoot,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([]);
    expect(getResultGroupImageIds(
      failedRoot,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([SCREEN_1.fileName]);
    expect(failedRoot.textContent).toContain('Visible copy differs.');
    expect(failed.table.model.rows[1]
      .slots[initialIndexes.evidence!]!.cell.element.outerHTML).toBe(evidenceBefore);

    /** 相同目标、错误来源列或错误 Screen 身份必须保持幂等。 */
    expect(setCopyTestResultStatus(failed.table, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: false,
      rowIndex: 0,
      sourceColumnKey,
    })).toEqual({ changed: false, table: failed.table });
    expect(setCopyTestResultStatus(failed.table, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: 'stale-instance',
      passed: true,
      rowIndex: 0,
      sourceColumnKey,
    })).toEqual({ changed: false, table: failed.table });
    expect(setCopyTestResultStatus(failed.table, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: true,
      rowIndex: 0,
      sourceColumnKey: 'stale-column',
    })).toEqual({ changed: false, table: failed.table });

    const invalidWorkingTable = { ...validated, workingHtml: '<p>bad</p>' };
    expect(setCopyTestResultStatus(invalidWorkingTable, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: true,
      rowIndex: 0,
      sourceColumnKey,
    })).toEqual({ changed: false, table: invalidWorkingTable });
  });

  it('upgrades a legacy single-status singleton Result when its status changes', () => {
    /** 先生成带完整 Screen 身份的当前结构，再降级成旧单状态 DOM fixture。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    const results = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: ['Legacy retained issue.'],
      passed: true,
      rowIndex: 0,
    }], images);
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    const legacyDocument = parseHtml(validated.workingHtml);
    const legacyRoot = legacyDocument.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;
    const legacyItems = Array.from(legacyRoot.querySelectorAll<HTMLLIElement>(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
    )).map(item => {
      item.removeAttribute(COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE);
      return item.outerHTML;
    });
    legacyRoot.innerHTML = `<strong>Passed:</strong><ul>${legacyItems.join('')}</ul>`;
    legacyRoot.setAttribute(
      COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE,
      JSON.stringify(['Legacy retained issue.'])
    );
    const legacyTable = parseCopyTestStorageTables(
      legacyDocument.querySelector('table')!.outerHTML
    )[0];
    const sourceColumnKey = getSourceColumnKey(0, 'Target');
    const screen1InstanceId = getResultImageInstanceId(legacyRoot, SCREEN_1.fileName);

    /** 第一次人工移动应把旧根节点升级为新双分组结构，并恢复根级历史错误。 */
    const upgraded = setCopyTestResultStatus(legacyTable, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: false,
      rowIndex: 0,
      sourceColumnKey,
    });
    const upgradedRoot = parseHtml(upgraded.table.workingHtml).querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;

    expect(upgraded.changed).toBe(true);
    expect(getResultGroupImageIds(
      upgradedRoot,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([]);
    expect(getResultGroupImageIds(
      upgradedRoot,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([SCREEN_1.fileName]);
    expect(upgradedRoot.textContent).toContain('Legacy retained issue.');
    expect(Array.from(upgradedRoot.children).every(child => {
      return child.hasAttribute(COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE);
    })).toBe(true);
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

  it('merges an existing atomic Evidence Pair immediately while preserving content and blank boundaries', () => {
    /** 历史 managed Pair 中每个来源原子行仍独立拥有 Evidence 单元格。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th>',
      '<th data-copy-test-column-type="result" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Result - Target</th>',
      '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
      '<tr><td>First</td><td>First result</td><td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target"><span data-existing-evidence="first">First evidence</span></td></tr>',
      '<tr><td>Second</td><td>Second result</td><td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target"><em data-existing-evidence="second">Second evidence</em></td></tr>',
      '<tr><td><br /></td><td>Blank result</td><td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target"><span data-existing-evidence="blank">Blank evidence</span></td></tr>',
      '<tr><td>Fourth</td><td>Fourth result</td><td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target"><span data-existing-evidence="fourth">Fourth evidence</span></td></tr>',
      '</table>',
    ].join(''))[0];
    /** 重新选择已有 Pair 后应立即升级 Evidence section，而无需 Validate。 */
    const ensured = ensureCopyTestWorkingColumns(table, 0, 'Target');
    const sourceKey = getSourceColumnKey(0, 'Target');
    const indexes = findGeneratedColumnIndexes(ensured.headers, sourceKey);
    /** 连续 First/Second、空白边界及 Fourth 三个可见 Evidence 单元格。 */
    const evidenceCells = [1, 3, 4].map(rowIndex => {
      return ensured.model.rows[rowIndex].slots[indexes.evidence!]!.cell.element;
    });

    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([2, 1, 1]);
    expect(ensured.model.rows[2].slots[indexes.evidence!]!.owned).toBe(false);
    expect(Array.from(evidenceCells[0].querySelectorAll('[data-existing-evidence]')).map(node => {
      return node.getAttribute('data-existing-evidence');
    })).toEqual(['first', 'second']);
    expect(evidenceCells[0].textContent).toContain('First evidence');
    expect(evidenceCells[0].textContent).toContain('Second evidence');
    expect(evidenceCells[0].textContent).not.toContain('Blank evidence');
    expect(evidenceCells[1].querySelector('[data-existing-evidence="blank"]')).not.toBeNull();
    expect(evidenceCells[2].querySelector('[data-existing-evidence="fourth"]')).not.toBeNull();
  });

  it('uses the coverage winner for a continuous section and shares it across Results', () => {
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
    ]);
    expect(evidenceImages.map(image => image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE))).toEqual([
      `${sourceKey}:1:${SCREEN_1.fileName}`,
    ]);
    expect(getResultImageIds(resultCells[0])).toEqual([SCREEN_1.fileName]);
    expect(getResultImageIds(resultCells[1])).toEqual([SCREEN_1.fileName]);
    expect(getResultImageIds(resultCells[2])).toEqual([SCREEN_1.fileName]);
    expect(resultCells.map(cell => Array.from(
      cell?.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`) || []
    ).map(reference => reference.firstChild?.textContent))).toEqual([
      ['screen-a'],
      ['screen-a'],
      ['screen-a'],
    ]);
    expect(validated.workingHtml).not.toContain(SCREEN_2.fileName);
    expect(validated.workingHtml).not.toContain(SCREEN_3.fileName);
  });

  it('keeps First and Second grouped across a blank boundary from Fourth after deletion', () => {
    /** First、Second 连续非空，第三行为空边界，Fourth 属于独立 section。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td>First</td></tr>',
      '<tr><td>Second</td></tr>',
      '<tr><td></td></tr>',
      '<tr><td>Fourth</td></tr></table>',
    ].join(''))[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_2.fileName, SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 1,
      },
      {
        evidenceImageFileNames: [SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 3,
      },
    ], images);
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    const sourceKey = getSourceColumnKey(0, 'Target');
    const indexes = findGeneratedColumnIndexes(validated.headers, sourceKey);
    const evidenceCells = [1, 3, 4].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[indexes.evidence!]!.cell.element;
    });
    const resultCells = [1, 2, 4].map(rowIndex => {
      return validated.model.rows[rowIndex].slots[indexes.result!]!.cell.element;
    });

    expect(evidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1))).toEqual([2, 1, 1]);
    expect(evidenceCells.map(cell => Array.from(cell.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`
    )).map(image => image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE)))).toEqual([
      [SCREEN_1.fileName],
      [],
      [SCREEN_2.fileName],
    ]);
    expect(resultCells.map(getResultImageIds)).toEqual([
      [SCREEN_1.fileName],
      [SCREEN_1.fileName],
      [SCREEN_2.fileName],
    ]);
    expect(validated.model.rows[2].slots[indexes.evidence!]!.owned).toBe(false);

    const imageId = getCopyTestImageId(SCREEN_1);
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId, instanceId: `${sourceKey}:1:${imageId}` },
      0,
      'Target'
    );
    const deletedIndexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    const deletedEvidenceCells = [1, 3, 4].map(rowIndex => {
      return deleted.table.model.rows[rowIndex].slots[deletedIndexes.evidence!]!.cell.element;
    });

    expect(deleted.removed).toBe(true);
    expect(deletedEvidenceCells.map(cell => Number(cell.getAttribute('rowspan') || 1)))
      .toEqual([2, 1, 1]);
    expect(deletedEvidenceCells[0].textContent?.trim()).toBe('');
    expect(deletedEvidenceCells[1].textContent?.trim()).toBe('');
    expect(getResultImageIds(deleted.table.model.rows[1]
      .slots[deletedIndexes.result!]!.cell.element)).toEqual([]);
    expect(getResultImageIds(deleted.table.model.rows[2]
      .slots[deletedIndexes.result!]!.cell.element)).toEqual([]);
    expect(deletedEvidenceCells[2].querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${SCREEN_2.fileName}"]`
    )).not.toBeNull();
    expect(deleted.table.model.rows[2].slots[deletedIndexes.evidence!]!.owned).toBe(false);
  });

  it('shares the section winner with a rowspan row whose legacy result has no direct Evidence', () => {
    /** 中间原子组没有直接命中图片，但连续非空 section 仍统一使用 Screen01。 */
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
    /** 中间原子组使用 section winner 渲染的 Result 单元格。 */
    const failedResultCell = validated.model.rows[2].slots[indexes.result!]!.cell.element;
    /** 整个连续 section 共用的 Evidence 单元格。 */
    const evidenceCell = validated.model.rows[1].slots[indexes.evidence!]!.cell.element;

    expect(failedResultCell.getAttribute('rowspan')).toBe('2');
    expect(failedResultCell.textContent).toContain('Failed:');
    expect(failedResultCell.textContent).toContain('Expected copy is missing.');
    expect(failedResultCell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).not.toBeNull();
    expect(getResultImageIds(failedResultCell)).toEqual([SCREEN_1.fileName]);
    expect(evidenceCell.getAttribute('rowspan')).toBe('4');
    expect(evidenceCell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    )).not.toBeNull();
    expect(validated.model.rows.slice(2, 5).every(row => {
      return row.slots[indexes.evidence!]!.owned === false;
    })).toBe(true);

    /** 模拟回写后重新 Import 的工作表格。 */
    const imported = parseCopyTestStorageTables(validated.workingHtml)[0];
    /** 删除 section 唯一图片后，整组内容清空但 Evidence rowspan 不拆分。 */
    const imageId = getCopyTestImageId(SCREEN_1);
    const deleted = deleteCopyTestEvidenceImage(
      imported,
      { imageId, instanceId: `${sourceKey}:1:${imageId}` },
      1,
      'Target'
    );

    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults).toEqual([]);
    expect(deleted.table.model.rows[2].slots[indexes.result!]!.cell.element.textContent?.trim()).toBe('');
    const deletedEvidence = deleted.table.model.rows[1].slots[indexes.evidence!]!.cell.element;
    expect(deletedEvidence.getAttribute('rowspan')).toBe('4');
    expect(deletedEvidence.textContent?.trim()).toBe('');
    expect(deleted.table.model.rows.slice(2, 5).every(row => {
      return row.slots[indexes.evidence!]!.owned === false;
    })).toBe(true);
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

  it('hydrates a singleton section and preserves its rowspan after reload deletion', () => {
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
    expect(deleted.validationResults).toEqual([]);
    expect(resultRoots).toHaveLength(0);
    expect(evidenceCards).toHaveLength(0);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_2.fileName);
    const indexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    const evidenceCell = deleted.table.model.rows[1].slots[indexes.evidence!]!.cell.element;
    expect(evidenceCell.getAttribute('rowspan')).toBe('2');
    expect(evidenceCell.textContent?.trim()).toBe('');
    expect(deleted.table.model.rows[2].slots[indexes.evidence!]!.owned).toBe(false);
  });

  it('keeps an unrelated Evidence section unchanged after reload singleton deletion', () => {
    /** 空行把两个包含 rowspan 原子组的 Evidence section 分开。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td rowspan="2">A1-2</td></tr>',
      '<tr></tr>',
      '<tr><td></td></tr>',
      '<tr><td rowspan="2">B1-2</td></tr>',
      '<tr></tr>',
      '<tr><td>B3</td></tr></table>',
    ].join(''))[0];
    /** 两个 section 分别使用 Screen02 和 Screen01。 */
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_2.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
        languageIssues: [],
        passed: true,
        rowIndex: 3,
      },
      {
        evidenceImageFileNames: [SCREEN_1.fileName],
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
    expect(deleted.imageStillUsed).toBe(false);
    expect(unaffectedSignatureAfter).toEqual(unaffectedSignatureBefore);
    expect(affectedResult.getAttribute('rowspan')).toBe('2');
    expect(affectedEvidence.getAttribute('rowspan')).toBe('2');
    expect(getResultImageIds(affectedResult)).toEqual([]);
    expect(affectedResult.textContent?.trim()).toBe('');
    expect(affectedEvidence.textContent?.trim()).toBe('');
    expect(deleted.table.workingHtml).toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_2.fileName);
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

  it('keeps source atoms and the four-row Evidence section stable after winner deletion', () => {
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
      [SCREEN_1.fileName],
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
    expect(deleted.removed).toBe(true);
    expect(deleted.imageStillUsed).toBe(false);
    expect(evidenceSlots).toEqual([
      { owned: true, rowSpan: 4 },
      { owned: false, rowSpan: 4 },
      { owned: false, rowSpan: 4 },
      { owned: false, rowSpan: 4 },
    ]);
    expect(buildCopyTestRowGroups(deleted.table, 1).map(group => group.rowSpan)).toEqual([1, 2, 1]);
    expect(resultCells.every(cell => cell.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    ) === null)).toBe(true);
    expect(resultCells.map(getResultImageIds)).toEqual([[], [], []]);
    expect(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)).toHaveLength(0);
    const evidenceCell = deleted.table.model.rows[1].slots[indexes.evidence!]!.cell.element;
    expect(evidenceCell.getAttribute('rowspan')).toBe('4');
    expect(evidenceCell.textContent?.trim()).toBe('');
    expect(deleted.table.workingHtml).not.toContain(SCREEN_1.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_2.fileName);
    expect(deleted.table.workingHtml).not.toContain(SCREEN_3.fileName);
    expect(deleted.validationResults).toEqual([]);
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

  it('removes retained status and issues when deleting the overridden singleton winner', () => {
    /** 单行失败结果先人工切换为 Passed，再删除唯一 Evidence。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    const results = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: ['Visible copy differs.'],
      passed: false,
      rowIndex: 0,
    }], images);
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    const sourceColumnKey = getSourceColumnKey(0, 'Target');
    const initialRoot = parseHtml(validated.workingHtml).querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )!;
    const screen1InstanceId = getResultImageInstanceId(initialRoot, SCREEN_1.fileName);

    /** 唯一 winner 先移动到 Passed，并保留可恢复的失败信息。 */
    const passed = setCopyTestResultStatus(validated, 0, 'Target', {
      imageId: SCREEN_1.fileName,
      instanceId: screen1InstanceId,
      passed: true,
      rowIndex: 0,
      sourceColumnKey,
    });
    /** 删除唯一 winner 后，Result 与保留错误必须一起清空。 */
    const deleted = deleteCopyTestEvidenceImage(
      passed.table,
      { imageId: SCREEN_1.fileName, instanceId: screen1InstanceId },
      0,
      'Target'
    );

    expect(passed.changed).toBe(true);
    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults).toEqual([]);
    expect(deleted.table.workingHtml).not.toContain('Passed:');
    expect(deleted.table.workingHtml).not.toContain('Failed:');
    expect(deleted.table.workingHtml).not.toContain('Visible copy differs.');
    expect(parseHtml(deleted.table.workingHtml).querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
  });

  it('chooses the coverage winner and clears the whole section after its deletion', () => {
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy 1</td></tr><tr><td>copy 2</td></tr></table>'
    )[0];
    const results = bindResultImages([
      {
        evidenceImageFileNames: [SCREEN_2.fileName],
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
    const winnerImageId = getCopyTestImageId(SCREEN_2);
    const initialDoc = parseHtml(validated.workingHtml);

    expect(Array.from(initialDoc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`))
      .map(card => card.querySelector('strong')?.textContent)).toEqual(['screen-b']);
    expect(Array.from(initialDoc.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`))
      .map(reference => reference.firstChild?.textContent)).toEqual(['screen-b', 'screen-b']);
    expect(validated.workingHtml).not.toContain(SCREEN_1.fileName);

    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: winnerImageId, instanceId: `${sourceKey}:1:${winnerImageId}` },
      0,
      'Target',
      buildSnapshot(results)
    );
    const doc = parseHtml(deleted.table.workingHtml);
    const evidenceCards = Array.from(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`));
    const resultReferences = Array.from(doc.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`));

    expect(deleted.removed).toBe(true);
    expect(deleted.validationResults).toEqual([]);
    expect(evidenceCards).toHaveLength(0);
    expect(resultReferences).toHaveLength(0);
    expect(deleted.table.workingHtml).not.toContain('Passed:');
    expect(doc.querySelectorAll(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    )).toHaveLength(0);
    const indexes = findGeneratedColumnIndexes(deleted.table.headers, sourceKey);
    const evidenceCell = deleted.table.model.rows[1].slots[indexes.evidence!]!.cell.element;
    expect(evidenceCell.getAttribute('rowspan')).toBe('2');
    expect(evidenceCell.textContent?.trim()).toBe('');
  });

  it('deletes the visible singleton from live DOM when the caller snapshot is stale', () => {
    /** 单行当前工作表格只引用 Screen01。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** 当前 working DOM 中真实存在的 singleton Evidence 关系。 */
    const currentResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 模拟错误记录 Screen02 的过期内存快照。 */
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

    /** live DOM 优先于过期快照，仍应删除当前界面中的 singleton。 */
    const deleted = deleteCopyTestEvidenceImage(
      validated,
      { imageId: firstImageId, instanceId: `${sourceKey}:1:${firstImageId}` },
      0,
      'Target',
      buildSnapshot(staleResults)
    );
    /** 删除后用于检查剩余文件名的文档。 */
    const doc = parseHtml(deleted.table.workingHtml);

    expect(deleted.removed).toBe(true);
    expect(doc.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${firstImageId}"]`
    )).toHaveLength(0);
    expect(Array.from(doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`))
      .map(card => card.querySelector('strong')?.textContent)).toEqual([]);
    expect(deleted.validationResults).toEqual([]);
  });

  it('falls back to an aligned singleton snapshot when live hydration lacks a target Result', () => {
    /** 两行属于同一个连续非空 Evidence section。 */
    const table = parseCopyTestStorageTables([
      '<table><tr><th>Target</th></tr>',
      '<tr><td>copy 1</td></tr><tr><td>copy 2</td></tr></table>',
    ].join(''))[0];
    /** 两行共享 Screen01，供 fallback 精确恢复完整 section。 */
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
    ], images);
    /** 完整校验结果写入后的工作表格。 */
    const validated = applyCopyTestValidationResults(table, results, 0, 'Target', images);
    /** 当前来源列的稳定 ownership key。 */
    const sourceKey = getSourceColumnKey(0, 'Target');
    /** 移除首行 Result、但保留其 Evidence 的局部不完整 DOM。 */
    const incomplete = removeManagedResultAtRow(validated, 1, sourceKey);
    /** 删除前共享 Evidence section 的结构。 */
    const indexes = findGeneratedColumnIndexes(incomplete.headers, sourceKey);
    const evidenceBefore = incomplete.model.rows[1].slots[indexes.evidence!]!.cell.element;
    expect(evidenceBefore.getAttribute('rowspan')).toBe('2');
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
    expect(deleted.validationResults).toEqual([]);
    const evidenceAfter = deleted.table.model.rows[1]
      .slots[deletedIndexes.evidence!]!.cell.element;
    expect(evidenceAfter.getAttribute('rowspan')).toBe('2');
    expect(evidenceAfter.textContent?.trim()).toBe('');
    expect(deleted.table.model.rows[2].slots[deletedIndexes.evidence!]!.owned).toBe(false);
  });

  it('fails closed when a stale target or mismatched fallback snapshot is not current', () => {
    /** 单行真实展示两张 Evidence 图片的来源表格。 */
    const table = parseCopyTestStorageTables(
      '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>'
    )[0];
    /** working DOM 当前真实拥有的 singleton 图片关系。 */
    const currentResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_1.fileName],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }], images);
    /** 指向另一个 singleton 的过期调用方关系。 */
    const mismatchedResults = bindResultImages([{
      evidenceImageFileNames: [SCREEN_2.fileName],
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
