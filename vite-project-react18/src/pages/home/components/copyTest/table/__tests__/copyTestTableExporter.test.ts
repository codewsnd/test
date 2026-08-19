import { describe, expect, it } from 'vitest';
import {
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from '../tableConstants';
import { ensureCopyTestWorkingColumns } from '../copyTestTableEditor';
import { buildConfluenceStorageTableExportPayload } from '../copyTestTableImages';
import {
  parseCopyTestStorageTables,
  type CopyTestWorkingTable,
} from '../copyTestTableParser';
import { buildCurrentColumnExportStorage } from '../copyTestTableExporter';
import {
  getRawRangeText,
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
  return `data-copy-test-column-type="${type}" data-copy-test-source-column-key="${sourceColumnKey}" `
    + `${COPY_TEST_OWNER_ID_ATTRIBUTE}="${sourceColumnKey}" `
    + `${COPY_TEST_SCHEMA_ATTRIBUTE}="${COPY_TEST_SCHEMA_VERSION}"`;
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

/** 给 working 表格指定 Pair 的每个 owned 数据单元格写入可追踪测试内容。 */
const fillManagedPairCells = (
  table: CopyTestWorkingTable,
  sourceColumnKey: string,
  prefix: string
): CopyTestWorkingTable => {
  /** 从 working html 解析出的可编辑表格。 */
  const documentModel = new DOMParser().parseFromString(table.workingHtml, 'text/html');
  /** 当前测试表格的真实 DOM 根节点。 */
  const tableElement = documentModel.querySelector<HTMLTableElement>('table');
  if (!tableElement) {
    throw new Error('Working table was not parsed');
  }
  Array.from(tableElement.rows).slice(1).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach(cell => {
      const owner = cell.getAttribute('data-copy-test-source-column-key');
      const type = cell.getAttribute('data-copy-test-column-type');
      if (owner === sourceColumnKey && (type === 'result' || type === 'evidence')) {
        cell.textContent = `${prefix} ${type} ${rowIndex + 1}`;
      }
    });
  });
  return { ...table, workingHtml: tableElement.outerHTML };
};

/** 构建五行、两个可分别生成 Pair 的 Comparison Column。 */
const buildFiveRowTwoPairTable = (): string => {
  return [
    '<table data-table="two-partial-pairs"><tr><th>ID</th><th>French</th><th>German</th></tr>',
    ...Array.from({ length: 5 }, (_, index) => {
      const rowNumber = index + 1;
      return `<tr><td>${rowNumber}</td><td>French ${rowNumber}</td><td>German ${rowNumber}</td></tr>`;
    }),
    '</table>',
  ].join('');
};

/** 读取指定数据行和逻辑列上的 owned cell。 */
const getLogicalCell = (
  table: CopyTestWorkingTable,
  dataRowIndex: number,
  columnIndex: number
) => {
  /** 指定业务行和逻辑列中必须存在的 owned cell。 */
  const cell = table.model.rows[dataRowIndex + 1]?.slots[columnIndex]?.cell;
  if (!cell) {
    throw new Error(`Missing logical cell at row ${dataRowIndex}, column ${columnIndex}`);
  }
  return cell;
};

/** 构建两个普通来源行均已有 managed Pair 的选择范围测试表格。 */
const buildSelectedRowsTable = (
  firstResult: string,
  firstEvidence: string,
  secondResult: string,
  secondEvidence: string
): string => {
  return [
    '<table data-table="selected-rows"><tr><th>ID</th><th>French</th>',
    buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Test Result - French'),
    buildOwnedHeader('evidence', FRENCH_SOURCE_KEY, 'Test Evidence - French'),
    '</tr><tr><td>1</td><td>Bonjour</td>',
    buildOwnedCell('result', FRENCH_SOURCE_KEY, firstResult),
    buildOwnedCell('evidence', FRENCH_SOURCE_KEY, firstEvidence),
    '</tr><tr><td>2</td><td>Au revoir</td>',
    buildOwnedCell('result', FRENCH_SOURCE_KEY, secondResult),
    buildOwnedCell('evidence', FRENCH_SOURCE_KEY, secondEvidence),
    '</tr></table>',
  ].join('');
};

/** 构建尚未创建 managed Pair 的 latest 表格。 */
const buildRowsWithoutManagedPair = (): string => {
  return [
    '<table data-table="selected-rows"><tr><th>ID</th><th>French</th></tr>',
    '<tr><td>1</td><td>Bonjour</td></tr>',
    '<tr data-latest="must-remain-byte-identical"><td>2</td><td>Au revoir</td></tr>',
    '</table>',
  ].join('');
};

/** 构建首个来源原子组跨两行、尾行保持独立的选择范围测试表格。 */
const buildSelectedRowSpanTable = (
  groupedResult: string,
  groupedEvidence: string,
  trailingResult: string,
  trailingEvidence: string,
  evidenceRowSpan = 2
): string => {
  const trailingEvidenceCell = evidenceRowSpan > 2
    ? ''
    : buildOwnedCell('evidence', FRENCH_SOURCE_KEY, trailingEvidence);
  return [
    '<table data-table="selected-rowspan"><tr><th>ID</th><th>French</th>',
    buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Test Result - French'),
    buildOwnedHeader('evidence', FRENCH_SOURCE_KEY, 'Test Evidence - French'),
    '</tr><tr><td>1</td><td rowspan="2">Bonjour group</td>',
    buildOwnedCell('result', FRENCH_SOURCE_KEY, groupedResult, 2),
    buildOwnedCell('evidence', FRENCH_SOURCE_KEY, groupedEvidence, evidenceRowSpan),
    '</tr><tr><td>2</td></tr>',
    '<tr><td>3</td><td>Au revoir</td>',
    buildOwnedCell('result', FRENCH_SOURCE_KEY, trailingResult),
    trailingEvidenceCell,
    '</tr></table>',
  ].join('');
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

  it('patches only explicitly selected rows and preserves latest unselected Pair content', () => {
    const imported = buildSelectedRowsTable(
      'Imported selected result',
      'Imported selected evidence',
      'Imported unselected result',
      'Imported unselected evidence'
    );
    const latest = buildSelectedRowsTable(
      'Latest selected result',
      'Latest selected evidence',
      'Latest unselected result',
      'Latest unselected evidence'
    );
    const working = buildSelectedRowsTable(
      'Working selected result',
      'Working selected evidence',
      'Stale working unselected result',
      'Stale working unselected evidence'
    );
    const importedTable = parseCopyTestStorageTables(imported)[0];
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [0],
      table: { ...importedTable, workingHtml: working },
    });

    expect(exported).not.toBeNull();
    expect(exported).toContain('Working selected result');
    expect(exported).toContain('Working selected evidence');
    expect(exported).toContain('Latest unselected result');
    expect(exported).toContain('Latest unselected evidence');
    expect(exported).toContain(buildOwnedCell('result', FRENCH_SOURCE_KEY, 'Latest unselected result'));
    expect(exported).toContain(buildOwnedCell('evidence', FRENCH_SOURCE_KEY, 'Latest unselected evidence'));
    expect(exported).not.toContain('Stale working unselected result');
    expect(exported).not.toContain('Stale working unselected evidence');
    const documentModel = new DOMParser().parseFromString(exported!, 'text/html');
    expect(documentModel.querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`)).toHaveLength(4);
  });

  it('inserts empty managed placeholders without leaking unselected working content', () => {
    const latest = buildRowsWithoutManagedPair();
    const working = buildSelectedRowsTable(
      'Working selected result',
      'Working selected evidence',
      'Stale working unselected result',
      'Stale working unselected evidence'
    );
    const importedTable = parseCopyTestStorageTables(latest)[0];
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [0],
      table: { ...importedTable, workingHtml: working },
    });

    expect(exported).not.toBeNull();
    expect(exported).toContain('Working selected result');
    expect(exported).toContain('Working selected evidence');
    expect(exported).not.toContain('Stale working unselected result');
    expect(exported).not.toContain('Stale working unselected evidence');
    const documentModel = new DOMParser().parseFromString(exported!, 'text/html');
    const rows = documentModel.querySelectorAll('tr');
    expect(rows[0].children).toHaveLength(4);
    expect(rows[1].children).toHaveLength(4);
    expect(rows[2].children).toHaveLength(4);
    const placeholders = Array.from(rows[2].children).slice(2);
    expect(placeholders.map(cell => cell.textContent)).toEqual(['', '']);
    expect(placeholders.map(cell => cell.getAttribute('data-copy-test-source-column-key')))
      .toEqual([FRENCH_SOURCE_KEY, FRENCH_SOURCE_KEY]);
    expect(placeholders.map(cell => cell.getAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE)))
      .toEqual([EXPORT_SCOPE_A, EXPORT_SCOPE_A]);

    const payload = buildConfluenceStorageTableExportPayload(
      exported!,
      FRENCH_SOURCE_KEY,
      EXPORT_SCOPE_A
    );
    const finalDocument = new DOMParser().parseFromString(payload.storageHtml, 'text/html');
    const finalPlaceholders = Array.from(finalDocument.querySelectorAll('tr')[2].children).slice(2);
    expect(payload.images).toEqual([]);
    expect(finalPlaceholders.map(cell => cell.textContent)).toEqual(['', '']);
    expect(finalPlaceholders.every(cell => !cell.hasAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE)))
      .toBe(true);
  });

  it('preserves rowspan and group metadata on an empty unselected placeholder', () => {
    const latest = [
      '<table><tr><th>ID</th><th>French</th></tr>',
      '<tr><td>1</td><td rowspan="2">Bonjour group</td></tr>',
      '<tr><td>2</td></tr>',
      '<tr><td>3</td><td>Au revoir</td></tr></table>',
    ].join('');
    const working = [
      '<table><tr><th>ID</th><th>French</th>',
      buildOwnedHeader('result', FRENCH_SOURCE_KEY, 'Test Result - French'),
      buildOwnedHeader('evidence', FRENCH_SOURCE_KEY, 'Test Evidence - French'),
      '</tr><tr><td>1</td><td rowspan="2">Bonjour group</td>',
      `<td rowspan="2" data-copy-test-evidence-group-id="0" ${buildOwnedAttributes('result', FRENCH_SOURCE_KEY)}>Unselected result</td>`,
      buildOwnedCell('evidence', FRENCH_SOURCE_KEY, 'Unselected evidence', 2),
      '</tr><tr><td>2</td></tr><tr><td>3</td><td>Au revoir</td>',
      buildOwnedCell('result', FRENCH_SOURCE_KEY, 'Selected result'),
      buildOwnedCell('evidence', FRENCH_SOURCE_KEY, 'Selected evidence'),
      '</tr></table>',
    ].join('');
    const importedTable = parseCopyTestStorageTables(latest)[0];
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [2],
      table: { ...importedTable, workingHtml: working },
    });

    expect(exported).not.toBeNull();
    const payload = buildConfluenceStorageTableExportPayload(
      exported!,
      FRENCH_SOURCE_KEY,
      EXPORT_SCOPE_A
    );
    const documentModel = new DOMParser().parseFromString(payload.storageHtml, 'text/html');
    const firstDataCells = Array.from(documentModel.querySelectorAll('tr')[1].children);
    const resultPlaceholder = firstDataCells[2];
    const evidencePlaceholder = firstDataCells[3];
    expect(resultPlaceholder.textContent).toBe('');
    expect(resultPlaceholder.getAttribute('rowspan')).toBe('2');
    expect(resultPlaceholder.getAttribute('data-copy-test-evidence-group-id')).toBe('0');
    expect(evidencePlaceholder.textContent).toBe('');
    expect(evidencePlaceholder.getAttribute('rowspan')).toBe('2');
    expect(payload.storageHtml).not.toContain('Unselected result');
    expect(payload.storageHtml).not.toContain('Unselected evidence');
    expect(payload.images).toEqual([]);
  });

  it('keeps two partial Comparison Pairs in their own logical columns across exports', () => {
    const initialStorage = buildFiveRowTwoPairTable();
    const imported = parseCopyTestStorageTables(initialStorage)[0];
    const ensuredFrench = ensureCopyTestWorkingColumns(imported, 1, 'French');
    const workingFrench = fillManagedPairCells(ensuredFrench, FRENCH_SOURCE_KEY, 'French');
    const exportedFrench = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: initialStorage,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [0, 1, 2],
      table: workingFrench,
    });

    expect(exportedFrench).not.toBeNull();
    const frenchPayload = buildConfluenceStorageTableExportPayload(
      exportedFrench!,
      FRENCH_SOURCE_KEY,
      EXPORT_SCOPE_A
    );
    const committedFrench = parseCopyTestStorageTables(frenchPayload.storageHtml)[0];
    const sessionAfterFrench = {
      ...workingFrench,
      originalHtml: committedFrench.originalHtml,
    };
    const ensuredGerman = ensureCopyTestWorkingColumns(sessionAfterFrench, 2, 'German');
    const workingGerman = fillManagedPairCells(ensuredGerman, GERMAN_SOURCE_KEY, 'German');
    const exportedGerman = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_B,
      originalStorageHtml: frenchPayload.storageHtml,
      selectedColumnIndex: 2,
      selectedColumnLabel: 'German',
      selectedRowIndexes: [3, 4],
      table: workingGerman,
    });

    expect(exportedGerman).not.toBeNull();
    const germanPayload = buildConfluenceStorageTableExportPayload(
      exportedGerman!,
      GERMAN_SOURCE_KEY,
      EXPORT_SCOPE_B
    );
    const finalTable = parseCopyTestStorageTables(germanPayload.storageHtml)[0];
    expect(germanPayload.images).toEqual([]);
    expect(germanPayload.storageHtml).not.toContain('French result 4');
    expect(germanPayload.storageHtml).not.toContain('German result 1');

    for (let rowIndex = 0; rowIndex < 5; rowIndex += 1) {
      expect(getLogicalCell(finalTable, rowIndex, 3).sourceColumnKey).toBe(FRENCH_SOURCE_KEY);
      expect(getLogicalCell(finalTable, rowIndex, 4).sourceColumnKey).toBe(FRENCH_SOURCE_KEY);
      expect(getLogicalCell(finalTable, rowIndex, 5).sourceColumnKey).toBe(GERMAN_SOURCE_KEY);
      expect(getLogicalCell(finalTable, rowIndex, 6).sourceColumnKey).toBe(GERMAN_SOURCE_KEY);
    }
    expect(getLogicalCell(finalTable, 3, 3).text).toBe('');
    expect(getLogicalCell(finalTable, 3, 5).text).toBe('German result 4');
    expect(getLogicalCell(finalTable, 0, 3).text).toBe('French result 1');
    expect(getLogicalCell(finalTable, 0, 5).text).toBe('');

    const freshlyEnsuredFrench = ensureCopyTestWorkingColumns(finalTable, 1, 'French');
    expect(getLogicalCell(freshlyEnsuredFrench, 3, 3).sourceColumnKey).toBe(FRENCH_SOURCE_KEY);
    expect(getLogicalCell(freshlyEnsuredFrench, 3, 5).sourceColumnKey).toBe(GERMAN_SOURCE_KEY);
    expect(getLogicalCell(freshlyEnsuredFrench, 3, 5).text).toBe('German result 4');
  });

  it('treats an explicit empty selection as no data-row export', () => {
    const latest = buildSelectedRowsTable(
      'Latest first result',
      'Latest first evidence',
      'Latest second result',
      'Latest second evidence'
    );
    const working = buildSelectedRowsTable(
      'Stale working first result',
      'Stale working first evidence',
      'Stale working second result',
      'Stale working second evidence'
    );
    const importedTable = parseCopyTestStorageTables(latest)[0];
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [],
      table: { ...importedTable, workingHtml: working },
    });

    expect(exported).not.toBeNull();
    expect(exported).not.toContain('Stale working');
    const latestTable = scanTopLevelTableRawRanges(latest)[0];
    const exportedTable = scanTopLevelTableRawRanges(exported!)[0];
    latestTable.rows.slice(1).forEach((latestRow, index) => {
      expect(getRawRangeText(exported!, exportedTable.rows[index + 1])).toBe(
        getRawRangeText(latest, latestRow)
      );
    });
    expect(new DOMParser().parseFromString(exported!, 'text/html')
      .querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`)).toHaveLength(2);
  });

  it('expands a covered selected row to its complete source rowspan group', () => {
    const imported = buildSelectedRowSpanTable(
      'Imported grouped result',
      'Imported grouped evidence',
      'Imported trailing result',
      'Imported trailing evidence'
    );
    const latest = buildSelectedRowSpanTable(
      'Latest grouped result',
      'Latest grouped evidence',
      'Latest trailing result',
      'Latest trailing evidence'
    );
    const working = buildSelectedRowSpanTable(
      'Working grouped result',
      'Working grouped evidence',
      'Stale working trailing result',
      'Stale working trailing evidence'
    );
    const importedTable = parseCopyTestStorageTables(imported)[0];
    const exported = buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      /** 业务行 1 是 rowspan 原子组内被覆盖的第二个物理行。 */
      selectedRowIndexes: [1],
      table: { ...importedTable, workingHtml: working },
    });

    expect(exported).not.toBeNull();
    expect(exported).toContain('Working grouped result');
    expect(exported).toContain('Working grouped evidence');
    expect(exported).toContain('Latest trailing result');
    expect(exported).toContain('Latest trailing evidence');
    expect(exported).toContain(buildOwnedCell('result', FRENCH_SOURCE_KEY, 'Latest trailing result'));
    expect(exported).toContain(buildOwnedCell('evidence', FRENCH_SOURCE_KEY, 'Latest trailing evidence'));
    expect(exported).not.toContain('Stale working trailing result');
    expect(exported).not.toContain('Stale working trailing evidence');
    const documentModel = new DOMParser().parseFromString(exported!, 'text/html');
    const scopedCells = documentModel.querySelectorAll(`[${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}]`);
    expect(scopedCells).toHaveLength(4);
    expect(Array.from(scopedCells).filter(cell => cell.getAttribute('rowspan') === '2')).toHaveLength(2);
  });

  it('fails closed when a latest managed cell crosses the selected-row boundary', () => {
    const imported = buildSelectedRowSpanTable(
      'Imported grouped result',
      'Imported grouped evidence',
      'Imported trailing result',
      'Imported trailing evidence'
    );
    const latest = buildSelectedRowSpanTable(
      'Latest grouped result',
      'Latest shared evidence',
      'Latest trailing result',
      'Unused trailing evidence',
      3
    );
    const working = buildSelectedRowSpanTable(
      'Working grouped result',
      'Working grouped evidence',
      'Stale working trailing result',
      'Stale working trailing evidence'
    );
    const importedTable = parseCopyTestStorageTables(imported)[0];

    expect(buildCurrentColumnExportStorage({
      exportScope: EXPORT_SCOPE_A,
      originalStorageHtml: latest,
      selectedColumnIndex: 1,
      selectedColumnLabel: 'French',
      selectedRowIndexes: [0],
      table: { ...importedTable, workingHtml: working },
    })).toBeNull();
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
  });
});
