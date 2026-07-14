/**
 * 文件作用：用纯数据模型构建支持 rowspan/colspan 的二维表格网格，并投影来源列原子行组。
 */

/** 构建网格时使用的物理单元格输入。 */
export interface CopyTestGridCellInput {
  cellId: string;
  colSpan?: number;
  rowSpan?: number;
  text?: string;
}

/** 单元格在二维逻辑网格中覆盖的闭区间。 */
export interface CellRegion {
  cellId: string;
  colEnd: number;
  colSpan: number;
  colStart: number;
  rowEnd: number;
  rowSpan: number;
  rowStart: number;
  text: string;
}

/** 二维网格中的单个逻辑 slot。 */
export interface CopyTestGridSlot {
  cell: CellRegion;
  colIndex: number;
  colOffset: number;
  isCellAnchor: boolean;
  isColumnAnchor: boolean;
  isRowAnchor: boolean;
  rowIndex: number;
  rowOffset: number;
}

/** 支持跨行、跨列单元格的稠密二维网格。 */
export interface CopyTestSpanGrid {
  columnCount: number;
  regions: readonly CellRegion[];
  rowCount: number;
  slots: readonly (readonly CopyTestGridSlot[])[];
}

/** 来源列中不可拆分的逻辑行组。 */
export interface RowGroup {
  anchorRowIndex: number;
  cell: CellRegion;
  cellId: string;
  coveredRowIndexes: readonly number[];
  groupId: string;
  horizontallyShared: boolean;
  rowEnd: number;
  rowSpan: number;
  rowStart: number;
  selectable: boolean;
  sourceColumnId: string;
  sourceColumnIndex: number;
  tableId: string;
  text: string;
}

/** 来源列投影。每个数据行通过 groupByRow 指向所属原子组。 */
export interface SourceProjection {
  firstDataRowIndex: number;
  groupByRow: readonly (RowGroup | undefined)[];
  groups: readonly RowGroup[];
  sourceColumnId: string;
  sourceColumnIndex: number;
  tableId: string;
}

/** 来源列投影入参。 */
export interface SourceProjectionOptions {
  firstDataRowIndex?: number;
  sourceColumnId: string;
  sourceColumnIndex: number;
  tableId: string;
}

/** 网格构建期间允许存在空洞的 slot 行。 */
type SparseSlotRow = Array<CopyTestGridSlot | undefined>;

/** 读取并校验正整数 span。 */
const readSpan = (value: number | undefined, fieldName: 'colSpan' | 'rowSpan'): number => {
  const span = value ?? 1;
  if (!Number.isInteger(span) || span < 1) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return span;
};

/** 校验并登记单元格 ID。 */
const registerCellId = (cellId: string, cellIds: Set<string>): void => {
  if (cellId.trim() === '') {
    throw new Error('cellId must not be empty');
  }
  if (cellIds.has(cellId)) {
    throw new Error(`Duplicate cellId: ${cellId}`);
  }
  cellIds.add(cellId);
};

/** 判断当前行的一段逻辑列是否均未被已有 rowspan 占用。 */
const isColumnRangeFree = (
  row: SparseSlotRow,
  colStart: number,
  colSpan: number
): boolean => {
  for (let offset = 0; offset < colSpan; offset += 1) {
    if (row[colStart + offset]) {
      return false;
    }
  }
  return true;
};

/** 查找一个物理单元格在当前行可落位的首个逻辑列。 */
const findAvailableColumn = (
  row: SparseSlotRow,
  startColumn: number,
  colSpan: number
): number => {
  let candidate = startColumn;
  while (!isColumnRangeFree(row, candidate, colSpan)) {
    candidate += 1;
  }
  return candidate;
};

/** 创建单元格覆盖区域。 */
const createCellRegion = (
  input: CopyTestGridCellInput,
  rowStart: number,
  colStart: number,
  rowCount: number
): CellRegion => {
  const colSpan = readSpan(input.colSpan, 'colSpan');
  const rowSpan = readSpan(input.rowSpan, 'rowSpan');
  const rowEnd = rowStart + rowSpan - 1;
  if (rowEnd >= rowCount) {
    throw new Error(`Cell ${input.cellId} rowspan exceeds the table row count`);
  }
  return {
    cellId: input.cellId,
    colEnd: colStart + colSpan - 1,
    colSpan,
    colStart,
    rowEnd,
    rowSpan,
    rowStart,
    text: input.text || '',
  };
};

/** 为指定坐标创建指向同一 CellRegion 的 slot。 */
const createGridSlot = (
  cell: CellRegion,
  rowIndex: number,
  colIndex: number
): CopyTestGridSlot => {
  const isRowAnchor = rowIndex === cell.rowStart;
  const isColumnAnchor = colIndex === cell.colStart;
  return {
    cell,
    colIndex,
    colOffset: colIndex - cell.colStart,
    isCellAnchor: isRowAnchor && isColumnAnchor,
    isColumnAnchor,
    isRowAnchor,
    rowIndex,
    rowOffset: rowIndex - cell.rowStart,
  };
};

/** 将一个 CellRegion 填入它覆盖的每个二维 slot。 */
const fillRegionSlots = (rows: SparseSlotRow[], cell: CellRegion): void => {
  for (let rowIndex = cell.rowStart; rowIndex <= cell.rowEnd; rowIndex += 1) {
    for (let colIndex = cell.colStart; colIndex <= cell.colEnd; colIndex += 1) {
      if (rows[rowIndex][colIndex]) {
        throw new Error(`Cell ${cell.cellId} overlaps an occupied grid slot`);
      }
      rows[rowIndex][colIndex] = createGridSlot(cell, rowIndex, colIndex);
    }
  }
};

/** 将一个物理行的单元格依次放入二维网格。 */
const placeRowCells = (
  inputs: readonly CopyTestGridCellInput[],
  rowIndex: number,
  rows: SparseSlotRow[],
  regions: CellRegion[],
  cellIds: Set<string>
): void => {
  let nextColumn = 0;
  inputs.forEach(input => {
    registerCellId(input.cellId, cellIds);
    const colSpan = readSpan(input.colSpan, 'colSpan');
    const colStart = findAvailableColumn(rows[rowIndex], nextColumn, colSpan);
    const cell = createCellRegion(input, rowIndex, colStart, rows.length);
    fillRegionSlots(rows, cell);
    regions.push(cell);
    nextColumn = cell.colEnd + 1;
  });
};

/** 读取网格最大逻辑列数。 */
const getColumnCount = (rows: SparseSlotRow[]): number => {
  return rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
};

/** 将构建期间的稀疏行转换为每个 slot 都有覆盖单元格的稠密行。 */
const toDenseRows = (
  rows: SparseSlotRow[],
  columnCount: number
): CopyTestGridSlot[][] => {
  return rows.map((row, rowIndex) => {
    return Array.from({ length: columnCount }, (_, colIndex) => {
      const slot = row[colIndex];
      if (!slot) {
        throw new Error(`Grid row ${rowIndex} has an uncovered slot at column ${colIndex}`);
      }
      return slot;
    });
  });
};

/** 从物理行单元格构建纯 TypeScript 二维 span 网格。 */
export const buildCopyTestSpanGrid = (
  inputRows: readonly (readonly CopyTestGridCellInput[])[]
): CopyTestSpanGrid => {
  const rows: SparseSlotRow[] = Array.from({ length: inputRows.length }, () => []);
  const regions: CellRegion[] = [];
  const cellIds = new Set<string>();
  inputRows.forEach((inputs, rowIndex) => {
    placeRowCells(inputs, rowIndex, rows, regions, cellIds);
  });
  const columnCount = getColumnCount(rows);
  return {
    columnCount,
    regions,
    rowCount: rows.length,
    slots: toDenseRows(rows, columnCount),
  };
};

/** 安全读取一个二维逻辑 slot。 */
export const getCopyTestGridSlot = (
  grid: CopyTestSpanGrid,
  rowIndex: number,
  colIndex: number
): CopyTestGridSlot | undefined => {
  return grid.slots[rowIndex]?.[colIndex];
};

/** 构造同时包含 table/source/cell 身份的稳定组 ID。 */
export const buildCopyTestRowGroupId = (
  tableId: string,
  sourceColumnId: string,
  cellId: string
): string => {
  return [tableId, sourceColumnId, cellId].map(encodeURIComponent).join('/');
};

/** 校验来源列投影入参。 */
const validateProjectionOptions = (
  grid: CopyTestSpanGrid,
  options: SourceProjectionOptions,
  firstDataRowIndex: number
): void => {
  if (options.tableId.trim() === '' || options.sourceColumnId.trim() === '') {
    throw new Error('tableId and sourceColumnId must not be empty');
  }
  if (!Number.isInteger(options.sourceColumnIndex)
    || options.sourceColumnIndex < 0
    || options.sourceColumnIndex >= grid.columnCount) {
    throw new Error('sourceColumnIndex is outside the grid');
  }
  if (!Number.isInteger(firstDataRowIndex)
    || firstDataRowIndex < 0
    || firstDataRowIndex > grid.rowCount) {
    throw new Error('firstDataRowIndex is outside the grid');
  }
};

/** 从来源列覆盖单元格创建一个不可拆分逻辑组。 */
const createRowGroup = (
  cell: CellRegion,
  options: SourceProjectionOptions
): RowGroup => {
  return {
    anchorRowIndex: cell.rowStart,
    cell,
    cellId: cell.cellId,
    coveredRowIndexes: Array.from(
      { length: cell.rowSpan },
      (_, offset) => cell.rowStart + offset
    ),
    groupId: buildCopyTestRowGroupId(options.tableId, options.sourceColumnId, cell.cellId),
    horizontallyShared: cell.colSpan > 1,
    rowEnd: cell.rowEnd,
    rowSpan: cell.rowSpan,
    rowStart: cell.rowStart,
    selectable: cell.text.trim() !== '',
    sourceColumnId: options.sourceColumnId,
    sourceColumnIndex: options.sourceColumnIndex,
    tableId: options.tableId,
    text: cell.text,
  };
};

/** 为每个物理数据行建立到原子组的反向投影。 */
const buildGroupByRow = (
  rowCount: number,
  groups: readonly RowGroup[]
): Array<RowGroup | undefined> => {
  const groupByRow: Array<RowGroup | undefined> = Array.from({ length: rowCount });
  groups.forEach(group => {
    group.coveredRowIndexes.forEach(rowIndex => {
      groupByRow[rowIndex] = group;
    });
  });
  return groupByRow;
};

/** 将一个来源逻辑列投影为按 rowspan 不可拆分的有序行组。 */
export const projectCopyTestSourceColumn = (
  grid: CopyTestSpanGrid,
  options: SourceProjectionOptions
): SourceProjection => {
  const firstDataRowIndex = options.firstDataRowIndex ?? 1;
  validateProjectionOptions(grid, options, firstDataRowIndex);
  const groups: RowGroup[] = [];
  let rowIndex = firstDataRowIndex;
  while (rowIndex < grid.rowCount) {
    const cell = grid.slots[rowIndex][options.sourceColumnIndex].cell;
    if (cell.rowStart !== rowIndex) {
      throw new Error(`Source cell ${cell.cellId} crosses the data row boundary`);
    }
    const group = createRowGroup(cell, options);
    groups.push(group);
    rowIndex = group.rowEnd + 1;
  }
  return {
    firstDataRowIndex,
    groupByRow: buildGroupByRow(grid.rowCount, groups),
    groups,
    sourceColumnId: options.sourceColumnId,
    sourceColumnIndex: options.sourceColumnIndex,
    tableId: options.tableId,
  };
};
