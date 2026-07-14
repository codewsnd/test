/**
 * 文件作用：用纯数据模型构建支持 rowspan/colspan 的二维表格网格，并投影来源列原子行组。
 */

/** 构建二维网格所需的物理单元格输入。 */
export interface CopyTestGridCellInput {
  /** 用于检测空值和重复单元格的稳定标识。 */
  cellId: string;
  /** 单元格横向覆盖的逻辑列数，缺省时为一列。 */
  colSpan?: number;
  /** 单元格纵向覆盖的逻辑行数，缺省时为一行。 */
  rowSpan?: number;
}

/** 物理单元格在二维逻辑网格中覆盖的闭区间。 */
export interface CellRegion {
  /** 对应输入物理单元格的稳定标识。 */
  cellId: string;
  /** 单元格覆盖的最后一个逻辑列下标。 */
  colEnd: number;
  /** 单元格覆盖的第一个逻辑列下标。 */
  colStart: number;
  /** 单元格覆盖的最后一个逻辑行下标。 */
  rowEnd: number;
  /** 单元格纵向覆盖的逻辑行数。 */
  rowSpan: number;
  /** 单元格覆盖的第一个逻辑行下标。 */
  rowStart: number;
}

/** 二维网格中的单个逻辑位置。 */
export interface CopyTestGridSlot {
  /** 覆盖当前位置的物理单元格区域。 */
  cell: CellRegion;
}

/** 支持跨行、跨列单元格的稠密二维网格。 */
export interface CopyTestSpanGrid {
  /** 网格包含的逻辑列总数。 */
  columnCount: number;
  /** 网格包含的物理行总数。 */
  rowCount: number;
  /** 按逻辑行列下标访问覆盖单元格的稠密矩阵。 */
  slots: readonly (readonly CopyTestGridSlot[])[];
}

/** 来源列中必须作为整体处理的不可拆分逻辑行组。 */
export interface RowGroup {
  /** 行组在表格中的首个物理行下标。 */
  anchorRowIndex: number;
  /** 行组覆盖的全部连续物理行下标。 */
  coveredRowIndexes: readonly number[];
  /** 行组覆盖的物理行数。 */
  rowSpan: number;
}

/** 来源列按 rowspan 投影后的有序逻辑行组集合。 */
export interface SourceProjection {
  /** 从上到下排列且互不拆分的来源列行组。 */
  groups: readonly RowGroup[];
}

/** 来源列投影所需的网格坐标参数。 */
export interface SourceProjectionOptions {
  /** 首个数据行下标，缺省时跳过第零行表头。 */
  firstDataRowIndex?: number;
  /** 需要投影的来源逻辑列下标。 */
  sourceColumnIndex: number;
}

/** 网格构建期间允许存在空洞的逻辑行。 */
type SparseSlotRow = Array<CopyTestGridSlot | undefined>;

/** 读取 span，并拒绝零、负数或非整数。 */
const readSpan = (value: number | undefined, fieldName: 'colSpan' | 'rowSpan'): number => {
  /** 未声明 span 的普通单元格默认只覆盖一个位置。 */
  const span = value ?? 1;
  if (!Number.isInteger(span) || span < 1) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return span;
};

/** 校验物理单元格标识，并登记到当前表格的去重集合。 */
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

/** 查找物理单元格在当前行可以完整落位的首个逻辑列。 */
const findAvailableColumn = (
  row: SparseSlotRow,
  startColumn: number,
  colSpan: number
): number => {
  /** 从上一物理单元格之后开始探测，避免重复扫描已确认区域。 */
  let candidate = startColumn;
  while (!isColumnRangeFree(row, candidate, colSpan)) {
    candidate += 1;
  }
  return candidate;
};

/** 根据物理单元格及其落位坐标创建逻辑覆盖区域。 */
const createCellRegion = (
  input: CopyTestGridCellInput,
  rowStart: number,
  colStart: number,
  rowCount: number
): CellRegion => {
  /** 规范化后的横向覆盖列数。 */
  const colSpan = readSpan(input.colSpan, 'colSpan');
  /** 规范化后的纵向覆盖行数。 */
  const rowSpan = readSpan(input.rowSpan, 'rowSpan');
  /** 当前区域覆盖的最后一个物理行下标。 */
  const rowEnd = rowStart + rowSpan - 1;
  if (rowEnd >= rowCount) {
    throw new Error(`Cell ${input.cellId} rowspan exceeds the table row count`);
  }
  return {
    cellId: input.cellId,
    colEnd: colStart + colSpan - 1,
    colStart,
    rowEnd,
    rowSpan,
    rowStart,
  };
};

/** 将一个物理单元格区域写入其覆盖的全部逻辑位置。 */
const fillRegionSlots = (rows: SparseSlotRow[], cell: CellRegion): void => {
  for (let rowIndex = cell.rowStart; rowIndex <= cell.rowEnd; rowIndex += 1) {
    for (let colIndex = cell.colStart; colIndex <= cell.colEnd; colIndex += 1) {
      if (rows[rowIndex][colIndex]) {
        throw new Error(`Cell ${cell.cellId} overlaps an occupied grid slot`);
      }
      rows[rowIndex][colIndex] = { cell };
    }
  }
};

/** 将一行物理单元格按原始顺序放入二维逻辑网格。 */
const placeRowCells = (
  inputs: readonly CopyTestGridCellInput[],
  rowIndex: number,
  rows: SparseSlotRow[],
  cellIds: Set<string>
): void => {
  /** 下一单元格开始查找空闲区间的逻辑列下标。 */
  let nextColumn = 0;
  for (let inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
    /** 当前物理行中待落位的单元格。 */
    const input = inputs[inputIndex];
    registerCellId(input.cellId, cellIds);
    /** 当前单元格需要连续占用的逻辑列数。 */
    const colSpan = readSpan(input.colSpan, 'colSpan');
    /** 避开已有 rowspan 后得到的首个可用逻辑列。 */
    const colStart = findAvailableColumn(rows[rowIndex], nextColumn, colSpan);
    /** 当前物理单元格在逻辑网格中的覆盖区域。 */
    const cell = createCellRegion(input, rowIndex, colStart, rows.length);
    fillRegionSlots(rows, cell);
    nextColumn = cell.colEnd + 1;
  }
};

/** 读取全部逻辑行中的最大列数。 */
const getColumnCount = (rows: SparseSlotRow[]): number => {
  /** 已扫描逻辑行中的最大长度。 */
  let maximum = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    maximum = Math.max(maximum, rows[rowIndex].length);
  }
  return maximum;
};

/** 将构建期稀疏行转换为每个位置均有覆盖单元格的稠密行。 */
const toDenseRows = (
  rows: SparseSlotRow[],
  columnCount: number
): CopyTestGridSlot[][] => {
  /** 校验并收集后的稠密逻辑行。 */
  const denseRows: CopyTestGridSlot[][] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    /** 当前物理行对应的稠密逻辑位置集合。 */
    const denseRow: CopyTestGridSlot[] = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      /** 当前位置由普通单元格或跨行跨列单元格提供的引用。 */
      const slot = rows[rowIndex][colIndex];
      if (!slot) {
        throw new Error(`Grid row ${rowIndex} has an uncovered slot at column ${colIndex}`);
      }
      denseRow.push(slot);
    }
    denseRows.push(denseRow);
  }
  return denseRows;
};

/** 从物理行单元格构建支持 rowspan 与 colspan 的稠密二维网格。 */
export const buildCopyTestSpanGrid = (
  inputRows: readonly (readonly CopyTestGridCellInput[])[]
): CopyTestSpanGrid => {
  /** 与输入物理行一一对应的构建期稀疏逻辑行。 */
  const rows: SparseSlotRow[] = [];
  for (let rowIndex = 0; rowIndex < inputRows.length; rowIndex += 1) {
    rows.push([]);
  }
  /** 用于拒绝同一表格中重复物理单元格标识的集合。 */
  const cellIds = new Set<string>();
  for (let rowIndex = 0; rowIndex < inputRows.length; rowIndex += 1) {
    placeRowCells(inputRows[rowIndex], rowIndex, rows, cellIds);
  }
  /** 完成全部物理单元格落位后的逻辑列总数。 */
  const columnCount = getColumnCount(rows);
  return {
    columnCount,
    rowCount: rows.length,
    slots: toDenseRows(rows, columnCount),
  };
};

/** 校验来源列下标和首个数据行是否位于网格范围内。 */
const validateProjectionOptions = (
  grid: CopyTestSpanGrid,
  options: SourceProjectionOptions,
  firstDataRowIndex: number
): void => {
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

/** 生成物理单元格纵向覆盖的全部连续行下标。 */
const getCoveredRowIndexes = (cell: CellRegion): number[] => {
  /** 按从上到下顺序收集的物理行下标。 */
  const coveredRowIndexes: number[] = [];
  for (let rowIndex = cell.rowStart; rowIndex <= cell.rowEnd; rowIndex += 1) {
    coveredRowIndexes.push(rowIndex);
  }
  return coveredRowIndexes;
};

/** 从来源列单元格创建一个不可拆分的逻辑行组。 */
const createRowGroup = (cell: CellRegion): RowGroup => {
  return {
    anchorRowIndex: cell.rowStart,
    coveredRowIndexes: getCoveredRowIndexes(cell),
    rowSpan: cell.rowSpan,
  };
};

/** 将来源逻辑列投影为按 rowspan 不可拆分且从上到下有序的行组。 */
export const projectCopyTestSourceColumn = (
  grid: CopyTestSpanGrid,
  options: SourceProjectionOptions
): SourceProjection => {
  /** 未指定时跳过第零行表头，从第一行数据开始投影。 */
  const firstDataRowIndex = options.firstDataRowIndex ?? 1;
  validateProjectionOptions(grid, options, firstDataRowIndex);
  /** 当前来源列中已识别的不可拆分逻辑行组。 */
  const groups: RowGroup[] = [];
  /** 下一次需要读取的来源列物理行下标。 */
  let rowIndex = firstDataRowIndex;
  while (rowIndex < grid.rowCount) {
    /** 覆盖当前来源列位置的物理单元格区域。 */
    const cell = grid.slots[rowIndex][options.sourceColumnIndex].cell;
    if (cell.rowStart !== rowIndex) {
      throw new Error(`Source cell ${cell.cellId} crosses the data row boundary`);
    }
    /** 当前单元格对应的不可拆分逻辑行组。 */
    const group = createRowGroup(cell);
    groups.push(group);
    rowIndex = cell.rowEnd + 1;
  }
  return { groups };
};
