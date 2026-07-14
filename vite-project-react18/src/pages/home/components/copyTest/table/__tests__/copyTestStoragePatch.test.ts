import { describe, expect, it } from 'vitest';
import {
  getNonTargetRawSegments,
  getRawRangeText,
  hasUnchangedNonTargetRaw,
  replaceRangesDescending,
  scanTopLevelTableRawRanges,
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
