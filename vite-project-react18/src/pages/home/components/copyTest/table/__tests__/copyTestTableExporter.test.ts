import { describe, expect, it } from 'vitest';
import { COPY_TEST_EXPORT_SCOPE_ATTRIBUTE } from '../tableConstants';
import { parseCopyTestStorageTables } from '../copyTestTableParser';
import {
  buildCurrentColumnExportStorage,
  replaceTableInStorage,
} from '../copyTestTableExporter';
import {
  hasUnchangedNonTargetRaw,
  scanTopLevelTableRawRanges,
} from '../copyTestStoragePatch';

const FRENCH_SOURCE_KEY = '1:French';
const GERMAN_SOURCE_KEY = '2:German';
const EXPORT_SCOPE_A = 'copytest-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EXPORT_SCOPE_B = 'copytest-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

interface TargetTableOptions {
  aEvidenceFirst?: string;
  aEvidenceRowSpan?: number;
  aEvidenceSecond?: string | null;
  aResult?: string;
  bResult?: string;
  foreignVersion?: string;
  includeA?: boolean;
  sourceRowSpan?: number;
  sourceText?: string;
}

interface AColumnOptions {
  aEvidenceFirst: string;
  aEvidenceRowSpan: number;
  aEvidenceSecond: string | null;
  aResult: string;
  includeA: boolean;
}

const buildOwnedAttributes = (type: 'result' | 'evidence', sourceColumnKey: string): string => {
  return `data-copy-test-column-type="${type}" data-copy-test-source-column-key="${sourceColumnKey}"`;
};

const buildOwnedHeader = (type: 'result' | 'evidence', sourceColumnKey: string, label: string): string => {
  return `<th ${buildOwnedAttributes(type, sourceColumnKey)}>${label}</th>`;
};

const buildOwnedCell = (
  type: 'result' | 'evidence',
  sourceColumnKey: string,
  content: string,
  rowSpan = 1
): string => {
  const rowSpanAttribute = rowSpan > 1 ? ` rowspan="${rowSpan}"` : '';
  return `<td${rowSpanAttribute} ${buildOwnedAttributes(type, sourceColumnKey)}>${content}</td>`;
};

const buildForeignCells = (version: string): string[] => {
  return [
    `<td data-human="manual-result-1">Manual French result 1 ${version}</td>`,
    `<td data-human="manual-evidence-1">Manual French evidence 1 ${version}</td>`,
    `<td data-human="manual-result-2">Manual French result 2 ${version}</td>`,
    `<td data-human="manual-evidence-2">Manual French evidence 2 ${version}</td>`,
  ];
};

const buildSourceCells = (sourceRowSpan: number, sourceText: string): {
  first: string;
  second: string;
} => {
  const rowSpanAttribute = sourceRowSpan > 1 ? ` rowspan="${sourceRowSpan}"` : '';
  return {
    first: `<td${rowSpanAttribute}>${sourceText}</td>`,
    second: sourceRowSpan > 1 ? '' : '<td>Au revoir</td>',
  };
};

const buildAColumns = (options: AColumnOptions): {
  firstCells: string;
  headers: string;
  secondCells: string;
} => {
  if (options.includeA === false) {
    return { firstCells: '', headers: '', secondCells: '' };
  }
  const firstCells = `${buildOwnedCell('result', FRENCH_SOURCE_KEY, `${options.aResult} 1`)}`
    + `${buildOwnedCell('evidence', FRENCH_SOURCE_KEY, options.aEvidenceFirst, options.aEvidenceRowSpan)}`;
  const secondEvidence = options.aEvidenceSecond === null
    ? ''
    : buildOwnedCell('evidence', FRENCH_SOURCE_KEY, options.aEvidenceSecond);
  return {
    firstCells,
    headers: `${buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Test Result - French')}`
      + `${buildOwnedHeader('evidence', FRENCH_SOURCE_KEY, 'Test Evidence - French')}`,
    secondCells: `${buildOwnedCell('result', FRENCH_SOURCE_KEY, `${options.aResult} 2`)}${secondEvidence}`,
  };
};

const buildTargetTable = ({
  aEvidenceFirst = 'A evidence first',
  aEvidenceRowSpan = 1,
  aEvidenceSecond = 'A evidence second',
  aResult = 'A result',
  bResult = 'B result',
  foreignVersion = 'imported',
  includeA = true,
  sourceRowSpan = 2,
  sourceText = 'Bonjour',
}: TargetTableOptions = {}): string => {
  const options = {
    aEvidenceFirst,
    aEvidenceRowSpan,
    aEvidenceSecond,
    aResult,
    includeA,
  };
  const foreignCells = buildForeignCells(foreignVersion);
  const sourceCells = buildSourceCells(sourceRowSpan, sourceText);
  const aColumns = buildAColumns(options);
  return [
    '<table data-table="target"><tbody>',
    '<tr><th>Reference</th><th>French</th><th>German</th>',
    '<th data-human="manual-result-header">Test Result - French</th>',
    '<th data-human="manual-evidence-header">Test Evidence - French</th>',
    aColumns.headers,
    buildOwnedHeader('result', GERMAN_SOURCE_KEY, 'Test Result - German'),
    buildOwnedHeader('evidence', GERMAN_SOURCE_KEY, 'Test Evidence - German'),
    '</tr>',
    `<tr><td>ref-1</td>${sourceCells.first}<td>Hallo 1</td>`,
    foreignCells[0],
    foreignCells[1],
    aColumns.firstCells,
    buildOwnedCell('result', GERMAN_SOURCE_KEY, `${bResult} 1`),
    buildOwnedCell('evidence', GERMAN_SOURCE_KEY, `${bResult} evidence 1`),
    '</tr>',
    `<tr><td>ref-2</td>${sourceCells.second}<td>Hallo 2</td>`,
    foreignCells[2],
    foreignCells[3],
    aColumns.secondCells,
    buildOwnedCell('result', GERMAN_SOURCE_KEY, `${bResult} 2`),
    buildOwnedCell('evidence', GERMAN_SOURCE_KEY, `${bResult} evidence 2`),
    '</tr>',
    '</tbody></table>',
  ].join('');
};

const buildSimpleTable = (name: string): string => {
  return `<table data-table="${name}"><tr><th>${name}</th></tr><tr><td>${name} value</td></tr></table>`;
};

const buildSameKeyOtherTable = (exportScope?: string): string => {
  const tableHtml = [
    '<table data-table="same-key-other">',
    '<tr><th>Other Reference</th><th>French</th>',
    buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Test Result - French'),
    buildOwnedHeader('evidence', FRENCH_SOURCE_KEY, 'Test Evidence - French'),
    '</tr>',
    '<tr><td>other ref</td><td>Autre</td>',
    buildOwnedCell('result', FRENCH_SOURCE_KEY, 'Other table result'),
    buildOwnedCell('evidence', FRENCH_SOURCE_KEY, 'Other table evidence'),
    '</tr></table>',
  ].join('');
  return exportScope
    ? tableHtml.split('data-copy-test-column-type=').join(
      `${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}="${exportScope}" data-copy-test-column-type=`
    )
    : tableHtml;
};

const buildPage = (tables: string[]): string => {
  return `<p>Page prefix</p>${tables.join('<p>Table separator</p>')}<p>Page suffix</p>`;
};

const createWorkingTable = (importStorage: string, workingTableHtml: string) => {
  const table = parseCopyTestStorageTables(importStorage)
    .find(item => item.headers.some(header => header.label === 'German'));
  if (!table) {
    throw new Error('Target fixture table was not parsed');
  }
  return { ...table, workingHtml: workingTableHtml };
};

const countText = (value: string, text: string): number => {
  return value.split(text).length - 1;
};

describe('copyTestTableExporter', () => {
  it('finds reordered Table3 and patches only owner A while preserving foreign, owner B, and other tables raw', () => {
    const importedTarget = buildTargetTable();
    const importStorage = buildPage([
      buildSimpleTable('Table1'),
      buildSameKeyOtherTable(),
      importedTarget,
      buildSimpleTable('Table4'),
    ]);
    const latestTarget = buildTargetTable({
      aEvidenceFirst: 'Latest A evidence 1',
      aEvidenceSecond: 'Latest A evidence 2',
      aResult: 'Latest A result',
      bResult: 'Latest B result',
      foreignVersion: 'latest',
    });
    const latestStorage = buildPage([
      buildSimpleTable('Table4'),
      latestTarget,
      buildSimpleTable('Table1'),
      buildSameKeyOtherTable(EXPORT_SCOPE_B),
    ]);
    const working = buildTargetTable({
      aEvidenceFirst: '<div data-copy-test-generated-content="evidence">New A grouped evidence</div>',
      aEvidenceRowSpan: 2,
      aEvidenceSecond: null,
      aResult: 'New A result',
      bResult: 'Imported B result',
      foreignVersion: 'imported',
    });
    const table = createWorkingTable(importStorage, working);
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latestStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      table,
    });

    expect(exported).not.toBeNull();
    const output = exported!;
    const beforeTables = scanTopLevelTableRawRanges(latestStorage);
    const afterTables = scanTopLevelTableRawRanges(output);
    expect(hasUnchangedNonTargetRaw(latestStorage, [beforeTables[1]], output, [afterTables[1]])).toBe(true);
    buildForeignCells('latest').forEach(cell => expect(output).toContain(cell));
    expect(output).toContain('New A result 1');
    expect(output).toContain('New A grouped evidence');
    expect(output).not.toContain('Latest A evidence 2');
    expect(output).toContain('Latest B result 1');
    expect(output).not.toContain('Imported B result 1');
    expect(output).toContain('Other table evidence');
    expect(countText(output, 'Test Result - French')).toBe(3);

    const scopedDocument = new DOMParser().parseFromString(output, 'text/html');
    const targetTable = scopedDocument.querySelector('[data-table="target"]');
    const scopedCells = Array.from(targetTable?.querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`) || []);
    expect(scopedCells).toHaveLength(5);
    expect(scopedCells.every(cell => cell.getAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE) === EXPORT_SCOPE_A)).toBe(true);
    expect(scopedCells.every(cell => cell.getAttribute('data-copy-test-source-column-key') === FRENCH_SOURCE_KEY)).toBe(true);
    const otherScopeCells = Array.from(
      scopedDocument.querySelector('[data-table="same-key-other"]')
        ?.querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`) || []
    );
    expect(otherScopeCells).toHaveLength(4);
    expect(otherScopeCells.every(cell => cell.getAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE) === EXPORT_SCOPE_B)).toBe(true);

    const repeated = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: output,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      table,
    });
    expect(repeated).toBe(output);
  });

  it('patches owner B without changing latest owner A', () => {
    const importedTarget = buildTargetTable();
    const importStorage = buildPage([buildSimpleTable('Table1'), importedTarget]);
    const latestTarget = buildTargetTable({
      aEvidenceFirst: 'Latest A evidence 1',
      aEvidenceSecond: 'Latest A evidence 2',
      aResult: 'Latest A result',
      bResult: 'Latest B result',
      foreignVersion: 'latest',
    });
    const latestStorage = buildPage([buildSimpleTable('Table1'), latestTarget]);
    const working = buildTargetTable({
      aResult: 'Imported A result',
      bResult: 'New B result',
      foreignVersion: 'imported',
    });
    const table = createWorkingTable(importStorage, working);
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_B,
      originalStorageHtml: latestStorage,
      selectedColumnIndex: 2,
      selectedColumnLabel: 'German',
      table,
    });

    expect(exported).toContain('New B result 1');
    expect(exported).toContain('Latest A result 1');
    expect(exported).not.toContain('Imported A result 1');
    const doc = new DOMParser().parseFromString(exported!, 'text/html');
    const scopedCells = Array.from(doc.querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`));
    expect(scopedCells.every(cell => cell.getAttribute('data-copy-test-source-column-key') === GERMAN_SOURCE_KEY)).toBe(true);
  });

  it('inserts a missing owned pair in logical order without adopting same-title foreign columns', () => {
    const importedTarget = buildTargetTable({ includeA: false });
    const importStorage = buildPage([buildSimpleTable('Table1'), importedTarget]);
    const latestStorage = buildPage([buildSimpleTable('Table1'), buildTargetTable({
      bResult: 'Latest B result',
      foreignVersion: 'latest',
      includeA: false,
    })]);
    const working = buildTargetTable({
      aResult: 'Inserted A result',
      bResult: 'Imported B result',
      foreignVersion: 'imported',
    });
    const table = createWorkingTable(importStorage, working);
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latestStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      table,
    });

    expect(exported).not.toBeNull();
    const output = exported!;
    buildForeignCells('latest').forEach(cell => expect(output).toContain(cell));
    const foreignHeaderIndex = output.indexOf('data-human="manual-result-header"');
    const ownedAHeaderIndex = output.indexOf(`data-copy-test-source-column-key="${FRENCH_SOURCE_KEY}"`);
    const ownedBHeaderIndex = output.indexOf(`data-copy-test-source-column-key="${GERMAN_SOURCE_KEY}"`);
    expect(foreignHeaderIndex).toBeLessThan(ownedAHeaderIndex);
    expect(ownedAHeaderIndex).toBeLessThan(ownedBHeaderIndex);
    expect(buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: output,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      table,
    })).toBe(output);
  });

  it('returns conflict for ambiguous table, changed source text or span, polluted working source, and invalid input', () => {
    const importedTarget = buildTargetTable();
    const importStorage = buildPage([buildSimpleTable('Table1'), importedTarget]);
    const table = createWorkingTable(importStorage, importedTarget);
    const buildExport = (storage: string, workingHtml = importedTarget) => {
      return buildCurrentColumnExportStorage({
        exportScope: EXPORT_SCOPE_A,
        originalStorageHtml: storage,
        selectedColumnIndex: 1,
        selectedColumnLabel: 'French',
        table: { ...table, workingHtml },
      });
    };

    expect(buildExport(buildPage([importedTarget, importedTarget]))).toBeNull();
    expect(buildExport(buildPage([buildTargetTable({ sourceText: 'Changed copy' })]))).toBeNull();
    expect(buildExport(buildPage([buildTargetTable({ sourceRowSpan: 1 })]))).toBeNull();
    expect(buildExport(importStorage, buildTargetTable({ sourceText: 'Changed in working' }))).toBeNull();
    expect(buildExport('<p>No table</p>')).toBeNull();
    expect(buildExport(importStorage, '<p>Invalid working table</p>')).toBeNull();
    expect(buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: importStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'Wrong label',
      table,
    })).toBeNull();
    expect(buildCurrentColumnExportStorage({
      exportScope: 'true',
      originalStorageHtml: importStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      table,
    })).toBeNull();

    const duplicateHeader = buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Duplicate Result');
    const duplicateOwnedWorking = importedTarget.replace('</tr>', `${duplicateHeader}</tr>`);
    expect(buildExport(importStorage, duplicateOwnedWorking)).toBeNull();
    expect(replaceTableInStorage('aa<table></table>zz', { end: 17, start: 2 }, '<table><tr /></table>'))
      .toBe('aa<table><tr /></table>zz');
  });
});
