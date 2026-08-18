import { describe, expect, it } from 'vitest';
import {
  applyCopyTestValidationResults,
  bindResultImages,
  ensureCopyTestWorkingColumns,
} from '../copyTestTableEditor';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSelectableCopyTestRowIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
} from '../copyTestTableParser';
import { parseHtml } from '../tableModel';

/** 构造与真实压力页相同 rowspan 拓扑的脱敏表格。 */
const buildGroupedTable = (prefix: string, spans: number[], emptyLastGroup = false): string => {
  const rows = spans.flatMap((rowSpan, groupIndex) => {
    return Array.from({ length: rowSpan }, (_, offset) => {
      const rowId = `<td>${prefix}-${groupIndex + 1}-${offset + 1}</td>`;
      if (offset > 0) {
        return `<tr>${rowId}</tr>`;
      }

      const target = emptyLastGroup && groupIndex === spans.length - 1 ? '<br />' : `copy-${groupIndex + 1}`;
      return [
        '<tr>',
        rowId,
        `<td rowspan="${rowSpan}">context-${groupIndex + 1}</td>`,
        `<td rowspan="${rowSpan}">${target}</td>`,
        '</tr>',
      ].join('');
    });
  });
  return [
    '<table><tr><th>Row ID</th><th>Context</th><th>Target</th></tr>',
    ...rows,
    '</table>',
  ].join('');
};

const IMAGE = { base64: 'data:image/png;base64,QUJD', fileName: 'screen.png' };

describe('copyTest merged Confluence fixture', () => {
  it('keeps the four real-page row-group topologies and excludes empty source groups from selection', () => {
    const storage = [
      buildGroupedTable('T1', [4, 4, 3, 4, 4, 3, 4, 4, 3], true),
      buildGroupedTable('T2', [2, 3, 4, 2, 3, 4, 2, 3]),
      buildGroupedTable('T3', [3, 4, 2, 3, 4, 2, 3, 4], true),
      buildGroupedTable('T4', [3, 2, 4, 3, 2, 4, 3, 2, 4, 3], true),
    ].join('');
    const tables = parseCopyTestStorageTables(storage);

    expect(tables).toHaveLength(4);
    expect(tables.map(table => table.model.rows.length - 1)).toEqual([33, 23, 25, 30]);
    expect(tables.map(table => buildCopyTestRowGroups(table, 2).length)).toEqual([9, 8, 8, 10]);
    expect(tables.map(table => getSelectableCopyTestRowIndexes(table, 2).length)).toEqual([8, 8, 7, 9]);
  });

  it('projects a cell anchored in another column across the selected Target as one four-row unit', () => {
    const storage = [
      '<table><tr><th>Row</th><th>Module</th><th>Feature</th><th>Reference</th><th>Target</th></tr>',
      '<tr><td>1</td><td colspan="4" rowspan="4">combined source and target copy</td></tr>',
      '<tr><td>2</td></tr><tr><td>3</td></tr><tr><td>4</td></tr></table>',
    ].join('');
    const table = parseCopyTestStorageTables(storage)[0];
    const groups = buildCopyTestRowGroups(table, 4);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ dataRowIndexes: [0, 1, 2, 3], rowSpan: 4 });
    const validated = applyCopyTestValidationResults(
      ensureCopyTestWorkingColumns(table, 4, 'Target'),
      bindResultImages([{
        evidenceImageFileNames: ['screen.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [IMAGE]),
      4,
      'Target',
      [IMAGE]
    );
    const sourceKey = getSourceColumnKey(4, 'Target');
    const indexes = findGeneratedColumnIndexes(validated.headers, sourceKey);

    expect(validated.model.rows[1].slots[indexes.result!]?.cell.rowSpan).toBe(4);
    expect(validated.model.rows[1].slots[indexes.evidence!]?.cell.rowSpan).toBe(4);
    expect(validated.model.rows[2].slots[indexes.result!]?.owned).toBe(false);
    expect(validated.model.rows[2].slots[indexes.evidence!]?.owned).toBe(false);
  });

  it('merges adjacent no-blank source atoms that choose the same current winner', () => {
    const table = parseCopyTestStorageTables(buildGroupedTable('GROUP', [3, 2]))[0];
    const validated = applyCopyTestValidationResults(
      ensureCopyTestWorkingColumns(table, 2, 'Target'),
      bindResultImages([
        {
          evidenceImageFileNames: ['screen.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 3,
        },
      ], [IMAGE]),
      2,
      'Target',
      [IMAGE]
    );
    const sourceKey = getSourceColumnKey(2, 'Target');
    const indexes = findGeneratedColumnIndexes(validated.headers, sourceKey);

    expect(validated.model.rows[1].slots[indexes.result!]?.cell.rowSpan).toBe(3);
    expect(validated.model.rows[4].slots[indexes.result!]?.cell.rowSpan).toBe(2);
    expect(validated.model.rows[1].slots[indexes.evidence!]?.cell.rowSpan).toBe(5);
    expect(validated.model.rows[4].slots[indexes.evidence!]?.owned).toBe(false);
    const evidenceRoots = parseHtml(validated.workingHtml).querySelectorAll(
      '[data-copy-test-generated-content="evidence"]'
    );
    expect(evidenceRoots).toHaveLength(1);
    expect(Array.from(evidenceRoots).every(root => {
      return root.querySelectorAll('[data-copy-test-evidence-image-id]').length === 1;
    })).toBe(true);
  });

  it('never adopts title-only foreign Test columns when creating an owned pair', () => {
    const foreignResult = '<td rowspan="2"><strong>manual FR result</strong></td>';
    const foreignEvidence = '<td rowspan="2"><em>manual FR evidence</em></td>';
    const storage = [
      '<table><tr><th>Row</th><th>Target FR</th>',
      '<th>Test Result - Target FR</th><th>Test Evidence - Target FR</th>',
      '<th>Target HK</th></tr>',
      `<tr><td>1</td><td rowspan="2">FR</td>${foreignResult}${foreignEvidence}<td rowspan="2">HK</td></tr>`,
      '<tr><td>2</td></tr></table>',
    ].join('');
    const table = parseCopyTestStorageTables(storage)[0];
    const nextTable = ensureCopyTestWorkingColumns(table, 4, 'Target HK');
    const sourceKey = getSourceColumnKey(4, 'Target HK');
    const indexes = findGeneratedColumnIndexes(nextTable.headers, sourceKey);

    expect(nextTable.headers[2].generatedType).toBeUndefined();
    expect(nextTable.headers[3].generatedType).toBeUndefined();
    expect(indexes).toEqual({ evidence: 6, result: 5 });
    expect(nextTable.workingHtml).toContain(foreignResult);
    expect(nextTable.workingHtml).toContain(foreignEvidence);
    expect(nextTable.workingHtml).toContain('data-copy-test-schema="2"');
  });
});
