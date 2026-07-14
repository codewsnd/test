import { describe, expect, it } from 'vitest';
import {
  buildCopyTestSpanGrid,
  projectCopyTestSourceColumn,
  type CopyTestGridCellInput,
} from '../copyTestGridModel';

/** 构造只包含网格落位所需字段的物理单元格输入。 */
const cell = (
  cellId: string,
  spans: Pick<CopyTestGridCellInput, 'colSpan' | 'rowSpan'> = {}
): CopyTestGridCellInput => ({ cellId, ...spans });

describe('copyTestGridModel', () => {
  it('把同时跨四行四列的来源单元格投影为一个不可拆分行组', () => {
    /** 包含 colspan 与 rowspan 组合场景的稠密网格。 */
    const grid = buildCopyTestSpanGrid([
      [cell('header-0'), cell('header-1'), cell('header-2'), cell('header-3'), cell('header-4')],
      [cell('row-1-context'), cell('shared-copy', { colSpan: 4, rowSpan: 4 })],
      [cell('row-2-context')],
      [cell('row-3-context')],
      [cell('row-4-context')],
    ]);

    expect(grid).toMatchObject({ columnCount: 5, rowCount: 5 });
    expect(grid.slots[1][1].cell).toBe(grid.slots[4][4].cell);
    expect(Object.keys(grid.slots[1][4])).toEqual(['cell']);
    expect(Object.keys(grid)).toEqual(['columnCount', 'rowCount', 'slots']);

    /** 第四个逻辑列按合并单元格边界得到的来源列投影。 */
    const projection = projectCopyTestSourceColumn(grid, {
      sourceColumnIndex: 4,
    });
    expect(projection).toEqual({
      groups: [{
        anchorRowIndex: 1,
        coveredRowIndexes: [1, 2, 3, 4],
        rowSpan: 4,
      }],
    });
  });

  it('保持多个普通来源行组的物理顺序并支持自定义数据起始行', () => {
    /** 包含两个连续普通数据行的二维网格。 */
    const grid = buildCopyTestSpanGrid([
      [cell('header-context'), cell('header-target')],
      [cell('context-1'), cell('target-1')],
      [cell('context-2'), cell('target-2')],
    ]);
    /** 从第一行开始得到的两个单行来源列组。 */
    const projection = projectCopyTestSourceColumn(grid, {
      firstDataRowIndex: 1,
      sourceColumnIndex: 1,
    });

    expect(projection.groups).toEqual([
      { anchorRowIndex: 1, coveredRowIndexes: [1], rowSpan: 1 },
      { anchorRowIndex: 2, coveredRowIndexes: [2], rowSpan: 1 },
    ]);
  });

  it('拒绝格式错误的网格与越界来源列投影', () => {
    expect(() => buildCopyTestSpanGrid([[cell('')]])).toThrow('cellId must not be empty');
    expect(() => buildCopyTestSpanGrid([[cell('a', { colSpan: 0 })]]))
      .toThrow('colSpan must be a positive integer');
    expect(() => buildCopyTestSpanGrid([[cell('a', { rowSpan: 2 })]]))
      .toThrow('rowspan exceeds the table row count');
    expect(() => buildCopyTestSpanGrid([[cell('same')], [cell('same')]]))
      .toThrow('Duplicate cellId');
    expect(() => buildCopyTestSpanGrid([
      [cell('header-a'), cell('header-b')],
      [cell('data-a')],
    ])).toThrow('has an uncovered slot');

    /** 表头单元格跨入数据区，用于覆盖投影边界校验。 */
    const grid = buildCopyTestSpanGrid([
      [cell('header-a', { rowSpan: 2 }), cell('header-b')],
      [cell('data-b')],
    ]);
    expect(() => projectCopyTestSourceColumn(grid, {
      sourceColumnIndex: 0,
    })).toThrow('crosses the data row boundary');
    expect(() => projectCopyTestSourceColumn(grid, {
      firstDataRowIndex: -1,
      sourceColumnIndex: 0,
    })).toThrow('firstDataRowIndex is outside the grid');
    expect(() => projectCopyTestSourceColumn(grid, {
      sourceColumnIndex: 2,
    })).toThrow('sourceColumnIndex is outside the grid');
  });
});
