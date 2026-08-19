import { describe, expect, it } from 'vitest';
import {
  buildCopyTestEvidenceSections,
  buildCopyTestRowsForValidation,
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getCopyTestColumnContext,
  getSelectableCopyTestRowIndexes,
  getSourceColumnKey,
  isCopyTestGeneratedHeader,
  normalizeCopyTestSelectedRowIndexes,
  parseCopyTestStorageTables,
  refreshWorkingTable,
} from '../copyTestTableParser';

const storageHtml = [
  '<table>',
  '<tr><th>Reference</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>hello</td><td rowspan="2">你好</td><td></td><td></td></tr>',
  '<tr><td>world</td></tr>',
  '<tr><td>submit</td><td>提交</td><td></td><td></td></tr>',
  '</table>',
].join('');

/** A 列第 2、3 个数据行合并的四行回归表格。 */
const middleMergedStorageHtml = [
  '<table><tr><th>ID</th><th>A</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td rowspan="2">copy 2 and 3</td></tr>',
  '<tr><td>3</td></tr>',
  '<tr><td>4</td><td>copy 4</td></tr>',
  '</table>',
].join('');

/** 两个非空块由内部空行分隔，且后段包含 rowspan 原子组的表格。 */
const blankSeparatedStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td>copy 2</td></tr>',
  '<tr><td>3</td><td>&nbsp;</td></tr>',
  '<tr><td>4</td><td rowspan="2">copy 4 and 5</td></tr>',
  '<tr><td>5</td></tr>',
  '<tr><td>6</td><td>copy 6</td></tr>',
  '</table>',
].join('');

/** 构建只有起始空行、尾行可选是否为空白的四行表格。 */
const buildLeadingBlankStorageHtml = (lastTargetHtml: string): string => {
  return [
    '<table><tr><th>ID</th><th>Target</th></tr>',
    '<tr><td>1</td><td><br /></td></tr>',
    '<tr><td>2</td><td>copy 2</td></tr>',
    '<tr><td>3</td><td>copy 3</td></tr>',
    `<tr><td>4</td><td>${lastTargetHtml}</td></tr>`,
    '</table>',
  ].join('');
};

/** 构建当前 source key 下的严格 managed 单元格。 */
const managedCell = (type: 'evidence' | 'result', content = '', extraAttributes = ''): string => {
  return `<td data-copy-test-column-type="${type}" data-copy-test-source-column-key="1:Target"`
    + ` data-copy-test-owner-id="1:Target" data-copy-test-schema="2"${extraAttributes}>${content}</td>`;
};

/** 无空行且前两个来源原子已持久化为同一 Evidence 组的表格。 */
const persistedNoBlankStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  `<tr><td>1</td><td>copy 1</td>${managedCell('result', '', ' data-copy-test-evidence-group-id="0"')}`,
  `${managedCell('evidence', '', ' rowspan="3"')}</tr>`,
  `<tr><td>2</td><td rowspan="2">copy 2 and 3</td>${managedCell(
    'result',
    '',
    ' rowspan="2" data-copy-test-evidence-group-id="0"'
  )}</tr>`,
  '<tr><td>3</td></tr>',
  `<tr><td>4</td><td>copy 4</td>${managedCell('result', '', ' data-copy-test-evidence-group-id="3"')}`,
  `${managedCell('evidence')}</tr></table>`,
].join('');

/** 前后空行包围 First/Second，Result metadata 企图将二者拆分的表格。 */
const splitBlankSectionStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Result - Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target" data-copy-test-owner-id="1:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  `<tr><td>1</td><td></td>${managedCell('result')}${managedCell('evidence')}</tr>`,
  `<tr><td>2</td><td>First</td>${managedCell('result', '', ' data-copy-test-evidence-group-id="1"')}${managedCell('evidence')}</tr>`,
  `<tr><td>3</td><td>Second</td>${managedCell('result', '', ' data-copy-test-evidence-group-id="2"')}${managedCell('evidence')}</tr>`,
  `<tr><td>4</td><td></td>${managedCell('result')}${managedCell('evidence')}</tr>`,
  `<tr><td>5</td><td>Fourth</td>${managedCell('result', '', ' data-copy-test-evidence-group-id="4"')}${managedCell('evidence')}</tr>`,
  '</table>',
].join('');

describe('copyTestTableParser', () => {
  it('builds working tables, contexts, generated indexes, and selected validation rows', () => {
    const tables = parseCopyTestStorageTables(storageHtml);
    const sourceKey = getSourceColumnKey(1, 'Target');
    expect(sourceKey).toBe('1:Target');
    expect(isCopyTestGeneratedHeader({ index: 9, label: 'Test Evidence - A' })).toBe(true);
    expect(findGeneratedColumnIndexes(tables[0].headers, sourceKey)).toEqual({
      evidence: 3,
      result: 2,
    });

    const context = getCopyTestColumnContext(tables[0], 1);
    expect(context?.rowGroups.map(group => group.dataRowIndexes)).toEqual([[0, 1], [2]]);
    expect(buildCopyTestRowGroups(tables[0], 1).map(group => group.rowSpan)).toEqual([2, 1]);
    expect(getSelectableCopyTestRowIndexes(tables[0], 1)).toEqual([0, 2]);
    expect(getSelectableCopyTestRowIndexes(undefined, 1)).toEqual([]);
    expect(getSelectableCopyTestRowIndexes(tables[0], undefined)).toEqual([]);
    expect(buildCopyTestRowsForValidation(tables[0], context, [0, 2])).toHaveLength(2);
    expect(buildCopyTestRowsForValidation(undefined, context, [0])).toEqual([]);
    expect(buildCopyTestRowsForValidation(tables[0], null, [0])).toEqual([]);
    expect(refreshWorkingTable(tables[0], '<p>bad</p>')).toBe(tables[0]);
    expect(getCopyTestColumnContext(tables[0], undefined)).toBeNull();
    expect(getCopyTestColumnContext(tables[0], 99)).toBeNull();
    expect(getSelectableCopyTestRowIndexes(tables[0], 99)).toEqual([]);
    expect(parseCopyTestStorageTables('<p>no table</p>')).toEqual([]);
    /** 仅含空表头但具备数据行的表格仍是可选择的有效表格。 */
    const blankHeaderTables = parseCopyTestStorageTables(
      '<table><tr><th><br /></th></tr><tr><td>value</td></tr></table>'
    );
    expect(blankHeaderTables).toHaveLength(1);
    expect(blankHeaderTables[0].headers).toEqual([
      expect.objectContaining({ index: 0, label: '' }),
    ]);
  });

  it('requires strict generated metadata and never claims title-only or foreign columns', () => {
    const table = parseCopyTestStorageTables(
      [
        '<table><tr><th>Target</th><th>Test Result - Target</th>',
        '<th data-copy-test-column-type="result" data-copy-test-source-column-key="foreign">Foreign result</th>',
        '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Owned evidence</th></tr>',
        '<tr><td>copy</td><td>manual result</td><td>foreign result</td><td></td></tr></table>',
      ].join('')
    )[0];
    const sourceKey = getSourceColumnKey(0, 'Target');

    expect(isCopyTestGeneratedHeader(table.headers[1])).toBe(true);
    expect(isCopyTestGeneratedHeader(table.headers[1])).toBe(true);
    expect(isCopyTestGeneratedHeader(table.headers[2])).toBe(false);
    expect(isCopyTestGeneratedHeader(table.headers[3])).toBe(true);
    expect(findGeneratedColumnIndexes(table.headers, sourceKey)).toEqual({
      evidence: 3,
      result: undefined,
    });
  });

  it('uses model fallback for hole tables and projection-boundary failures', () => {
    const holeTable = parseCopyTestStorageTables(
      '<table><tr><th>ID</th><th>Target</th></tr><tr><td>1</td></tr></table>'
    )[0];
    const crossingHeaderTable = parseCopyTestStorageTables(
      ['<table><tr><th>ID</th><th rowspan="2">Target</th></tr>', '<tr><td>1</td></tr></table>'].join('')
    )[0];

    expect(holeTable).toBeDefined();
    expect(holeTable.model.spanGrid).toBeUndefined();
    expect(buildCopyTestRowGroups(holeTable, 0).map(group => group.dataRowIndexes)).toEqual([[0]]);
    expect(buildCopyTestRowGroups(holeTable, 1)).toEqual([]);
    expect(crossingHeaderTable.model.spanGrid).toBeDefined();
    expect(buildCopyTestRowGroups(crossingHeaderTable, 1)).toEqual([]);
  });

  it('keeps each rowspan atom in its own Evidence section when the column has no blank row', () => {
    const table = parseCopyTestStorageTables(middleMergedStorageHtml)[0];
    const context = getCopyTestColumnContext(table, 1);

    expect(context?.rowGroups.map(group => group.dataRowIndexes)).toEqual([[0], [1, 2], [3]]);
    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([0, 1, 3]);
    expect(context?.evidenceSections.map(section => ({
      dataRowIndexes: section.dataRowIndexes,
      evidenceGroupId: section.evidenceGroupId,
      rowSpan: section.rowSpan,
    }))).toEqual([
      { dataRowIndexes: [0], evidenceGroupId: 0, rowSpan: 1 },
      { dataRowIndexes: [1], evidenceGroupId: 1, rowSpan: 2 },
      { dataRowIndexes: [3], evidenceGroupId: 3, rowSpan: 1 },
    ]);
    expect(getSelectableCopyTestRowIndexes(table, 1)).toEqual([0, 1, 3]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [2, 99])).toEqual([1]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [3, 2, 1, 99, 0, 2]))
      .toEqual([0, 1, 3]);
    expect(buildCopyTestRowsForValidation(table, context, [2, 3, 1])).toEqual([
      { evidenceGroupId: 1, expected: 'copy 2 and 3', rowIndex: 1 },
      { evidenceGroupId: 3, expected: 'copy 4', rowIndex: 3 },
    ]);
  });

  it('does not group when blank rows only occur at the outer edges', () => {
    const openTrailingTable = parseCopyTestStorageTables(
      buildLeadingBlankStorageHtml('copy 4')
    )[0];
    const closedTrailingTable = parseCopyTestStorageTables(
      buildLeadingBlankStorageHtml('<br />')
    )[0];
    const openContext = getCopyTestColumnContext(openTrailingTable, 1);
    const closedContext = getCopyTestColumnContext(closedTrailingTable, 1);

    expect(openContext?.rowGroups.map(group => group.evidenceGroupId)).toEqual([
      undefined,
      1,
      2,
      3,
    ]);
    expect(openContext?.evidenceSections.map(section => section.dataRowIndexes)).toEqual([
      [1],
      [2],
      [3],
    ]);
    expect(normalizeCopyTestSelectedRowIndexes(openContext?.rowGroups || [], [1]))
      .toEqual([1]);

    expect(closedContext?.rowGroups.map(group => group.evidenceGroupId)).toEqual([
      undefined,
      1,
      2,
      undefined,
    ]);
    expect(closedContext?.evidenceSections.map(section => section.dataRowIndexes)).toEqual([
      [1],
      [2],
    ]);
    expect(normalizeCopyTestSelectedRowIndexes(closedContext?.rowGroups || [], [2]))
      .toEqual([2]);
  });

  it('groups non-blank blocks separated by consecutive internal blank rows', () => {
    const table = parseCopyTestStorageTables([
      '<table><tr><th>ID</th><th>Target</th></tr>',
      '<tr><td>1</td><td rowspan="2">copy 1 and 2</td></tr>',
      '<tr><td>2</td></tr>',
      '<tr><td>3</td><td>copy 3</td></tr>',
      '<tr><td>4</td><td></td></tr>',
      '<tr><td>5</td><td><br /></td></tr>',
      '<tr><td>6</td><td>copy 6</td></tr>',
      '</table>',
    ].join(''))[0];
    const context = getCopyTestColumnContext(table, 1);

    expect(context?.rowGroups.map(group => ({
      dataRowIndexes: group.dataRowIndexes,
      evidenceGroupId: group.evidenceGroupId,
    }))).toEqual([
      { dataRowIndexes: [0, 1], evidenceGroupId: 0 },
      { dataRowIndexes: [2], evidenceGroupId: 0 },
      { dataRowIndexes: [3], evidenceGroupId: undefined },
      { dataRowIndexes: [4], evidenceGroupId: undefined },
      { dataRowIndexes: [5], evidenceGroupId: 5 },
    ]);
    expect(context?.evidenceSections.map(section => ({
      dataRowIndexes: section.dataRowIndexes,
      rowSpan: section.rowSpan,
    }))).toEqual([
      { dataRowIndexes: [0, 2], rowSpan: 3 },
      { dataRowIndexes: [5], rowSpan: 1 },
    ]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [1]))
      .toEqual([0, 2]);
  });

  it('groups every non-blank block when an internal blank separator exists', () => {
    const table = parseCopyTestStorageTables(blankSeparatedStorageHtml)[0];
    const context = getCopyTestColumnContext(table, 1);
    const sections = buildCopyTestEvidenceSections(table, 1);

    expect(buildCopyTestRowGroups(table, 1).map(group => ({
      dataRowIndexes: group.dataRowIndexes,
      evidenceGroupId: group.evidenceGroupId,
      rowSpan: group.rowSpan,
    }))).toEqual([
      { dataRowIndexes: [0], evidenceGroupId: 0, rowSpan: 1 },
      { dataRowIndexes: [1], evidenceGroupId: 0, rowSpan: 1 },
      { dataRowIndexes: [2], evidenceGroupId: undefined, rowSpan: 1 },
      { dataRowIndexes: [3, 4], evidenceGroupId: 3, rowSpan: 2 },
      { dataRowIndexes: [5], evidenceGroupId: 3, rowSpan: 1 },
    ]);
    expect(sections.map(section => ({
      anchorRowIndex: section.anchorRowIndex,
      dataRowIndexes: section.dataRowIndexes,
      evidenceGroupId: section.evidenceGroupId,
      rowSpan: section.rowSpan,
    }))).toEqual([
      { anchorRowIndex: 1, dataRowIndexes: [0, 1], evidenceGroupId: 0, rowSpan: 2 },
      { anchorRowIndex: 4, dataRowIndexes: [3, 5], evidenceGroupId: 3, rowSpan: 3 },
    ]);
    expect(context?.evidenceSections.map(section => section.evidenceGroupId)).toEqual([0, 3]);
    expect(getSelectableCopyTestRowIndexes(table, 1)).toEqual([0, 1, 3, 5]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [1])).toEqual([0, 1]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [4])).toEqual([3, 5]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [2])).toEqual([]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.rowGroups || [], [1, 4])).toEqual([0, 1, 3, 5]);
    expect(buildCopyTestRowsForValidation(table, context, [1])).toEqual([
      { evidenceGroupId: 0, expected: 'copy 1', rowIndex: 0 },
      { evidenceGroupId: 0, expected: 'copy 2', rowIndex: 1 },
    ]);
    expect(buildCopyTestRowsForValidation(table, context, [4])).toEqual([
      { evidenceGroupId: 3, expected: 'copy 4 and 5', rowIndex: 3 },
      { evidenceGroupId: 3, expected: 'copy 6', rowIndex: 5 },
    ]);
    expect(buildCopyTestRowsForValidation(table, context, [5])).toEqual([
      { evidenceGroupId: 3, expected: 'copy 4 and 5', rowIndex: 3 },
      { evidenceGroupId: 3, expected: 'copy 6', rowIndex: 5 },
    ]);
  });

  it('restores a persisted visual group without coupling selection or validation rows', () => {
    const table = parseCopyTestStorageTables(persistedNoBlankStorageHtml)[0];
    const context = getCopyTestColumnContext(table, 1);

    expect(buildCopyTestRowGroups(table, 1).map(group => group.evidenceGroupId)).toEqual([0, 0, 3]);
    expect(buildCopyTestEvidenceSections(table, 1).map(section => ({
      dataRowIndexes: section.dataRowIndexes,
      evidenceGroupId: section.evidenceGroupId,
      rowSpan: section.rowSpan,
    }))).toEqual([
      { dataRowIndexes: [0, 1], evidenceGroupId: 0, rowSpan: 3 },
      { dataRowIndexes: [3], evidenceGroupId: 3, rowSpan: 1 },
    ]);
    expect(context?.rowGroups.map(group => group.evidenceGroupId)).toEqual([0, 0, 3]);
    expect(context?.selectionRowGroups.map(group => group.evidenceGroupId)).toEqual([0, 1, 3]);
    expect(normalizeCopyTestSelectedRowIndexes(context?.selectionRowGroups || [], [2])).toEqual([1]);
    expect(buildCopyTestRowsForValidation(table, context, [2])).toEqual([
      { evidenceGroupId: 1, expected: 'copy 2 and 3', rowIndex: 1 },
    ]);
  });

  it('fills missing Result metadata only with the source atom base ID', () => {
    const trailingMissing = persistedNoBlankStorageHtml.replace(
      ' data-copy-test-evidence-group-id="3"',
      ''
    );
    const missingInsideDynamicGroup = persistedNoBlankStorageHtml.replace(
      ' rowspan="2" data-copy-test-evidence-group-id="0"',
      ' rowspan="2"'
    );
    const missingDynamicAnchor = persistedNoBlankStorageHtml.replace(
      ' data-copy-test-evidence-group-id="0"',
      ''
    );
    const missingInsideBlankBaseSection = splitBlankSectionStorageHtml
      .replace('data-copy-test-evidence-group-id="2"', 'data-copy-test-evidence-group-id="1"')
      .replace(' data-copy-test-evidence-group-id="1"', '');

    expect(buildCopyTestRowGroups(
      parseCopyTestStorageTables(trailingMissing)[0],
      1
    ).map(group => group.evidenceGroupId)).toEqual([0, 0, 3]);
    expect(buildCopyTestRowGroups(
      parseCopyTestStorageTables(missingInsideDynamicGroup)[0],
      1
    ).map(group => group.evidenceGroupId)).toEqual([0, 1, 3]);
    expect(buildCopyTestRowGroups(
      parseCopyTestStorageTables(missingDynamicAnchor)[0],
      1
    ).map(group => group.evidenceGroupId)).toEqual([0, 1, 3]);
    expect(buildCopyTestRowGroups(
      parseCopyTestStorageTables(missingInsideBlankBaseSection)[0],
      1
    ).map(group => group.evidenceGroupId)).toEqual([undefined, 1, 1, undefined, 4]);
  });

  it('fails closed for noncanonical, noncontiguous, split, and non-atomic Result metadata', () => {
    const noncanonical = persistedNoBlankStorageHtml.replace(
      'data-copy-test-evidence-group-id="0"',
      'data-copy-test-evidence-group-id="01"'
    );
    const noncontiguous = persistedNoBlankStorageHtml
      .replace(' rowspan="2" data-copy-test-evidence-group-id="0"', ' rowspan="2" data-copy-test-evidence-group-id="1"')
      .replace('data-copy-test-evidence-group-id="3"', 'data-copy-test-evidence-group-id="0"');
    const splitBlankSection = parseCopyTestStorageTables(splitBlankSectionStorageHtml)[0];
    const crossesBlank = parseCopyTestStorageTables(
      splitBlankSectionStorageHtml
        .replace('data-copy-test-evidence-group-id="2"', 'data-copy-test-evidence-group-id="1"')
        .replace('data-copy-test-evidence-group-id="4"', 'data-copy-test-evidence-group-id="1"')
    )[0];
    const nonAtomicResult = parseCopyTestStorageTables([
      '<table><tr><th>Target</th>',
      '<th data-copy-test-column-type="result" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Result - Target</th>',
      '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
      '<tr><td>A</td><td rowspan="2" data-copy-test-column-type="result" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2" data-copy-test-evidence-group-id="0"></td>',
      '<td rowspan="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2"></td></tr>',
      '<tr><td>B</td></tr></table>',
    ].join(''))[0];

    [noncanonical, noncontiguous].forEach(html => {
      const table = parseCopyTestStorageTables(html)[0];
      expect(buildCopyTestRowGroups(table, 1).map(group => group.evidenceGroupId)).toEqual([0, 1, 3]);
    });
    expect(buildCopyTestRowGroups(splitBlankSection, 1).map(group => group.evidenceGroupId))
      .toEqual([undefined, 1, 1, undefined, 4]);
    expect(buildCopyTestRowGroups(crossesBlank, 1).map(group => group.evidenceGroupId))
      .toEqual([undefined, 1, 1, undefined, 4]);
    expect(buildCopyTestRowGroups(nonAtomicResult, 0).map(group => group.evidenceGroupId))
      .toEqual([0, 1]);
  });
});
