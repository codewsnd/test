import { describe, expect, it } from 'vitest';
import {
  deleteOwnedRawRange,
  getNonTargetRawSegments,
  getRawRangeText,
  hasUnchangedNonTargetRaw,
  insertRawCellBeforeRowClosingTag,
  replaceOwnedRawRange,
  replaceRangesDescending,
  scanTopLevelTableRawRanges,
  type CopyTestRawCellRange,
  type CopyTestRawTableRange,
} from '../copyTestStoragePatch';

const OWNED_CELL = '<td data-copy-test-column-type="result" data-copy-test-source-column-key="1:B"><div data-copy-test-generated-content="result">Old</div></td>';
const FOREIGN_CELL = '<td data-owner="human"><strong>Test Result - French</strong></td>';
const NESTED_TABLE = '<table data-name="nested"><tr><td>Nested cell</td></tr></table>';
const TARGET_TABLE = [
  '<table data-name="target"><tbody>',
  '<tr data-row="header"><th>A</th><th>B<ac:structured-macro ac:name="x>y"><ac:parameter ac:name="p">value</ac:parameter></ac:structured-macro></th></tr>',
  '<tr data-row="data"><td rowspan="2">Business<ac:image><ri:attachment ri:filename="screen.png" /></ac:image>',
  NESTED_TABLE,
  '</td>',
  OWNED_CELL,
  FOREIGN_CELL,
  '</tr>',
  '<tr data-row="continued"><td>Tail</td><td>Foreign tail</td></tr>',
  '</tbody></table>',
].join('');
const OTHER_TABLE = '<table data-name="other"><tr><th>Other</th></tr><tr><td>Untouched</td></tr></table>';
const STORAGE = [
  '<p>Before</p>',
  '<!-- <table><tr><td>Comment fake</td></tr></table> -->',
  '<![CDATA[<table><tr><td>CDATA fake</td></tr></table>]]>',
  TARGET_TABLE,
  '<p>Between</p>',
  OTHER_TABLE,
  '<p>After</p>',
].join('');

const findCell = (table: CopyTestRawTableRange, raw: string, content: string): CopyTestRawCellRange => {
  const cell = table.rows.flatMap(row => row.cells)
    .find(item => getRawRangeText(raw, item).includes(content));
  if (!cell) {
    throw new Error(`Missing fixture cell: ${content}`);
  }
  return cell;
};

describe('copyTestStoragePatch', () => {
  it('scans top-level table, row, and cell raw ranges while preserving nested markup', () => {
    const tables = scanTopLevelTableRawRanges(`${STORAGE}<table /><table><tr><td>Incomplete`);

    expect(tables).toHaveLength(2);
    expect(getRawRangeText(STORAGE, tables[0])).toBe(TARGET_TABLE);
    expect(getRawRangeText(STORAGE, tables[1])).toBe(OTHER_TABLE);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[1].cells).toHaveLength(3);
    expect(getRawRangeText(STORAGE, tables[0].rows[1].cells[0])).toContain(NESTED_TABLE);
    expect(tables[0].rows[1].cells.some(cell => getRawRangeText(STORAGE, cell) === '<td>Nested cell</td>')).toBe(false);
    expect(getRawRangeText(STORAGE, tables[0].rows[0].cells[1])).toContain('ac:name="x>y"');
  });

  it('inserts only before the selected row closing tag and keeps repeated insertion idempotent', () => {
    const beforeTables = scanTopLevelTableRawRanges(STORAGE);
    const selectedRow = beforeTables[0].rows[1];
    const insertedCell = '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:B">Evidence</td>';
    const patched = insertRawCellBeforeRowClosingTag(STORAGE, selectedRow, insertedCell);
    const afterTables = scanTopLevelTableRawRanges(patched);

    expect(afterTables[0].rows[1].cells).toHaveLength(4);
    expect(getRawRangeText(patched, afterTables[0].rows[1])).toContain(`${insertedCell}</tr>`);
    expect(patched).toContain(FOREIGN_CELL);
    expect(hasUnchangedNonTargetRaw(STORAGE, [beforeTables[0]], patched, [afterTables[0]])).toBe(true);

    const repeated = insertRawCellBeforeRowClosingTag(patched, afterTables[0].rows[1], insertedCell);
    expect(repeated).toBe(patched);
    expect(() => insertRawCellBeforeRowClosingTag(STORAGE, selectedRow, '<div>not a cell</div>')).toThrow('th or td');
    expect(() => insertRawCellBeforeRowClosingTag(`${STORAGE}x`, {
      ...selectedRow,
      closeTagRange: { end: selectedRow.closeTagRange.end + 1, start: selectedRow.closeTagRange.start },
    }, insertedCell)).toThrow('stale');
  });

  it('replaces and deletes only an exact CopyTest-owned range while preserving foreign cells', () => {
    const table = scanTopLevelTableRawRanges(STORAGE)[0];
    const ownedCell = findCell(table, STORAGE, 'data-copy-test-column-type="result"');
    const replacement = '<td data-copy-test-column-type="result" data-copy-test-source-column-key="1:B"><div data-copy-test-generated-content="result">New</div></td>';
    const replaced = replaceOwnedRawRange(STORAGE, {
      expectedRaw: getRawRangeText(STORAGE, ownedCell),
      range: ownedCell,
    }, replacement);
    const replacedTable = scanTopLevelTableRawRanges(replaced)[0];
    const replacedCell = findCell(replacedTable, replaced, 'data-copy-test-column-type="result"');

    expect(replaced).toContain(replacement);
    expect(replaced).toContain(FOREIGN_CELL);
    expect(replaceOwnedRawRange(replaced, {
      expectedRaw: getRawRangeText(replaced, replacedCell),
      range: replacedCell,
    }, replacement)).toBe(replaced);

    const deleted = deleteOwnedRawRange(STORAGE, {
      expectedRaw: getRawRangeText(STORAGE, ownedCell),
      range: ownedCell,
    });
    expect(deleted).not.toContain(OWNED_CELL);
    expect(deleted).toContain(FOREIGN_CELL);

    const foreignCell = findCell(table, STORAGE, 'data-owner="human"');
    expect(() => deleteOwnedRawRange(STORAGE, {
      expectedRaw: getRawRangeText(STORAGE, foreignCell),
      range: foreignCell,
    })).toThrow('not marked');
    expect(() => deleteOwnedRawRange(STORAGE, {
      expectedRaw: `${getRawRangeText(STORAGE, ownedCell)} stale`,
      range: ownedCell,
    })).toThrow('no longer matches');
  });

  it('applies descending replacements and detects non-target byte changes', () => {
    expect(replaceRangesDescending('0123456789', [
      { range: { end: 3, start: 1 }, replacement: 'AA' },
      { range: { end: 9, start: 7 }, replacement: 'BB' },
    ])).toBe('0AA3456BB9');
    expect(replaceRangesDescending('abc', [])).toBe('abc');
    expect(() => replaceRangesDescending('abc', [
      { range: { end: 2, start: 0 }, replacement: '' },
      { range: { end: 3, start: 1 }, replacement: '' },
    ])).toThrow('must not overlap');
    expect(() => getRawRangeText('abc', { end: 4, start: 0 })).toThrow('outside');

    const beforeTable = scanTopLevelTableRawRanges(STORAGE)[0];
    const changedOutside = `changed${STORAGE}`;
    const afterTable = scanTopLevelTableRawRanges(changedOutside)[0];
    expect(hasUnchangedNonTargetRaw(STORAGE, [beforeTable], changedOutside, [afterTable])).toBe(false);
    expect(getNonTargetRawSegments('abc', [])).toEqual(['abc']);
  });
});
