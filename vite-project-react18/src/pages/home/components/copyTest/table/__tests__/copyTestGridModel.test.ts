import { describe, expect, it } from 'vitest';
import {
  buildCopyTestRowGroupId,
  buildCopyTestSpanGrid,
  getCopyTestGridSlot,
  projectCopyTestSourceColumn,
  type CopyTestGridCellInput,
} from '../copyTestGridModel';

const cell = (
  cellId: string,
  text: string,
  spans: Pick<CopyTestGridCellInput, 'colSpan' | 'rowSpan'> = {}
): CopyTestGridCellInput => ({ cellId, text, ...spans });

describe('copyTestGridModel', () => {
  it('projects a colspan 4 and rowspan 4 cell covering the selected fourth column as one atomic group', () => {
    const grid = buildCopyTestSpanGrid([
      [cell('header-0', 'Context'), cell('header-1', 'A'), cell('header-2', 'B'), cell('header-3', 'C'), cell('header-4', 'Target')],
      [cell('row-1-context', 'context 1'), cell('shared-copy', 'Shared target copy', { colSpan: 4, rowSpan: 4 })],
      [cell('row-2-context', 'context 2')],
      [cell('row-3-context', 'context 3')],
      [cell('row-4-context', 'context 4')],
    ]);

    expect(grid).toMatchObject({ columnCount: 5, rowCount: 5 });
    expect(grid.slots[1][1].cell).toBe(grid.slots[4][4].cell);
    expect(grid.slots[1][4]).toMatchObject({
      colOffset: 3,
      isCellAnchor: false,
      isColumnAnchor: false,
      isRowAnchor: true,
      rowOffset: 0,
    });
    expect(grid.slots[4][4]).toMatchObject({
      colOffset: 3,
      isRowAnchor: false,
      rowOffset: 3,
    });

    const projection = projectCopyTestSourceColumn(grid, {
      sourceColumnId: 'target-column',
      sourceColumnIndex: 4,
      tableId: 'table-3',
    });
    expect(projection.groups).toHaveLength(1);
    expect(projection.groups[0]).toMatchObject({
      anchorRowIndex: 1,
      cellId: 'shared-copy',
      coveredRowIndexes: [1, 2, 3, 4],
      groupId: 'table-3/target-column/shared-copy',
      horizontallyShared: true,
      rowEnd: 4,
      rowSpan: 4,
      rowStart: 1,
      selectable: true,
      text: 'Shared target copy',
    });
    expect(projection.groupByRow[1]).toBe(projection.groups[0]);
    expect(projection.groupByRow[4]).toBe(projection.groups[0]);
    expect(projection.groupByRow[0]).toBeUndefined();
    expect(getCopyTestGridSlot(grid, 99, 4)).toBeUndefined();
  });

  it('keeps source groups ordered and marks whitespace-only copy as unselectable', () => {
    const grid = buildCopyTestSpanGrid([
      [cell('header-context', 'Context'), cell('header-target', 'Target')],
      [cell('context-1', 'one'), cell('target-empty', '   ')],
      [cell('context-2', 'two'), cell('target-filled', 'copy')],
    ]);
    const projection = projectCopyTestSourceColumn(grid, {
      firstDataRowIndex: 1,
      sourceColumnId: 'source/A B',
      sourceColumnIndex: 1,
      tableId: 'table/1',
    });

    expect(projection.groups.map(group => ({
      groupId: group.groupId,
      selectable: group.selectable,
    }))).toEqual([
      { groupId: 'table%2F1/source%2FA%20B/target-empty', selectable: false },
      { groupId: 'table%2F1/source%2FA%20B/target-filled', selectable: true },
    ]);
    expect(buildCopyTestRowGroupId('table/1', 'source/A B', 'cell/2'))
      .toBe('table%2F1/source%2FA%20B/cell%2F2');
  });

  it('rejects malformed grids and invalid source projections', () => {
    expect(() => buildCopyTestSpanGrid([[cell('', 'copy')]])).toThrow('cellId must not be empty');
    expect(() => buildCopyTestSpanGrid([[cell('a', 'copy', { colSpan: 0 })]]))
      .toThrow('colSpan must be a positive integer');
    expect(() => buildCopyTestSpanGrid([[cell('a', 'copy', { rowSpan: 2 })]]))
      .toThrow('rowspan exceeds the table row count');
    expect(() => buildCopyTestSpanGrid([[cell('same', 'one')], [cell('same', 'two')]]))
      .toThrow('Duplicate cellId');
    expect(() => buildCopyTestSpanGrid([
      [cell('header-a', 'A'), cell('header-b', 'B')],
      [cell('data-a', 'A')],
    ])).toThrow('has an uncovered slot');

    const grid = buildCopyTestSpanGrid([
      [cell('header-a', 'A', { rowSpan: 2 }), cell('header-b', 'B')],
      [cell('data-b', 'copy')],
    ]);
    expect(() => projectCopyTestSourceColumn(grid, {
      sourceColumnId: 'source-a',
      sourceColumnIndex: 0,
      tableId: 'table-a',
    })).toThrow('crosses the data row boundary');
    expect(() => projectCopyTestSourceColumn(grid, {
      firstDataRowIndex: -1,
      sourceColumnId: 'source-a',
      sourceColumnIndex: 0,
      tableId: 'table-a',
    })).toThrow('firstDataRowIndex is outside the grid');
    expect(() => projectCopyTestSourceColumn(grid, {
      sourceColumnId: 'source-a',
      sourceColumnIndex: 2,
      tableId: 'table-a',
    })).toThrow('sourceColumnIndex is outside the grid');
    expect(() => projectCopyTestSourceColumn(grid, {
      sourceColumnId: '',
      sourceColumnIndex: 1,
      tableId: 'table-a',
    })).toThrow('tableId and sourceColumnId must not be empty');
  });
});
