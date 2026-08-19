/**
 * 文件作用：在 latest storage 上按 raw range 只应用当前 Comparison Column 的双列补丁。
 */
import {
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
} from './tableConstants';
import { isValidCopyTestExportScope } from './copyTestExportScope';
import {
  normalizeLabel,
  parseSingleTable,
  type CopyTestCellModel,
  type CopyTestGeneratedColumnType,
  type CopyTestRowModel,
  type CopyTestTableModel,
} from './tableModel';
import {
  buildCopyTestRowGroups,
  getSourceColumnKey,
  type CopyTestWorkingTable,
} from './copyTestTableParser';
import {
  getRawRangeText,
  hasUnchangedNonTargetRaw,
  replaceRangesDescending,
  scanTopLevelTableRawRanges,
  type CopyTestRawCellRange,
  type CopyTestRawReplacement,
  type CopyTestRawTableRange,
} from './copyTestStoragePatch';

/** 当前列导出入参。 */
export interface BuildCurrentColumnExportStorageParams {
  /** 标记本次导出双列的唯一作用域值。 */
  exportScope: string;
  /** 执行导出前刚从 Confluence 读取的最新完整 storage。 */
  originalStorageHtml: string;
  /** 用户在导入快照中选择的 Comparison Column 下标。 */
  selectedColumnIndex: number;
  /** 用户在导入快照中选择的 Comparison Column 标题。 */
  selectedColumnLabel: string;
  /**
   * 本次允许导出的零基业务数据行；组内任一行命中时会整体导出来源 rowspan 原子组。
   * 省略时保留历史全行导出行为，调用方应在用户显式选择行时传入该字段。
   */
  selectedRowIndexes?: readonly number[];
  /** 包含导入快照和本地编辑结果的目标工作表。 */
  table: CopyTestWorkingTable;
}

/** 同时持有 DOM 模型和 raw range 的单张表视图。 */
interface RawTableView {
  /** 从当前 raw 表格解析出的 DOM 行列模型。 */
  model: CopyTestTableModel;
  /** 当前表格在完整 storage 顶层表格集合中的顺序。 */
  ordinal: number;
  /** rawTable 所属的完整 storage 字符串。 */
  raw: string;
  /** 当前表格在 raw 字符串中的绝对区间及直属行列。 */
  rawTable: CopyTestRawTableRange;
}

/** 非 managed source column 的稳定描述。 */
interface SourceColumnDescriptor {
  /** 规范化后的非 managed 来源列标题。 */
  label: string;
  /** 同名非 managed 标题中当前来源列的零基序号。 */
  occurrence: number;
}

/** 单元格 patch 构造所需上下文。 */
interface CellPatchContext {
  /** latest 表格每个逻辑表头位置的稳定身份。 */
  baseHeaderIdentities: string[];
  /** 作为补丁基础的 latest raw 表格视图。 */
  baseView: RawTableView;
  /** 临时写入目标双列单元格的本次导出作用域。 */
  exportScope: string;
  /** 当前双列已经收集的 raw 字符串替换操作。 */
  replacements: CopyTestRawReplacement[];
  /** 当前解析的物理行下标。 */
  rowIndex: number;
  /** 将 Result/Evidence 双列绑定到来源列的稳定键。 */
  sourceColumnKey: string;
  /** 当前解析的是 Result 还是 Evidence 单元格。 */
  type: CopyTestGeneratedColumnType;
  /** working 表格每个逻辑表头位置的稳定身份。 */
  workingHeaderIdentities: string[];
  /** 含本地校验结果的 working raw 表格视图。 */
  workingView: RawTableView;
}

/** 单个 row/type 在 base 与 working 中解析出的 cell/range。 */
interface ResolvedCellPatch {
  /** latest 表格中已有目标 owned cell 的 raw 区间。 */
  baseRawCell?: CopyTestRawCellRange;
  /** 期望写回 latest storage 的完整目标单元格 raw。 */
  desiredRaw: string;
}

/** 每个 Comparison Column 固定拥有的 Result 与 Evidence 类型顺序。 */
const COPY_TEST_GENERATED_TYPES: CopyTestGeneratedColumnType[] = [
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
];

/** 匹配 raw 单元格开标签前缀，用于注入导出作用域属性。 */
const RAW_CELL_OPENING_PATTERN = /^(\s*<(?:th|td)\b)/i;
/** 匹配已存在的导出作用域属性，确保重复导出时先替换旧值。 */
const EXPORT_SCOPE_ATTRIBUTE_PATTERN = new RegExp(
  `\\s${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
  'gi'
);

/** 规范参与冲突签名的可见文本。 */
const normalizeSignatureText = (value: string): string => {
  return normalizeLabel(value);
};

/** 只有同时存在有效 column-type 和 source-column-key 才视为 CopyTest-owned。 */
const isCompleteManagedCell = (cell: CopyTestCellModel): boolean => {
  return Boolean(cell.generatedType && cell.sourceColumnKey?.trim());
};

/** 判断单元格是否属于当前 source column 的指定生成类型。 */
const isTargetManagedCell = (
  cell: CopyTestCellModel,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): boolean => {
  return isCompleteManagedCell(cell)
    && cell.generatedType === type
    && cell.sourceColumnKey === sourceColumnKey;
};

/** 构建只包含 non-managed header、行数和 non-managed span 拓扑的定位签名。 */
const buildTableLocatorSignature = (model: CopyTestTableModel): string => {
  /** 保留原始顺序的全部非 managed 表头文本。 */
  const headerLabels = (model.rows[0]?.cells || [])
    .filter(
      /** 排除可由 CopyTest 重建的 managed 表头。 */
      cell => !isCompleteManagedCell(cell)
    )
    .map(
      /** 将保留表头转换为忽略空白差异的定位文本。 */
      cell => normalizeSignatureText(cell.text)
    );
  /** 各物理行非 managed 单元格的标签与合并拓扑。 */
  const spanTopology = model.rows.map(
    /** 为每个物理行保留不可重建单元格的合并形状。 */
    row => {
      return row.cells
        .filter(
          /** 排除当前或其他来源列的 managed 单元格。 */
          cell => !isCompleteManagedCell(cell)
        )
        .map(
          /** 用标签及横纵 span 表达单元格拓扑。 */
          cell => [cell.tagName, cell.colSpan, cell.rowSpan]
        );
    }
  );
  return JSON.stringify({
    headerLabels,
    rowCount: model.rows.length,
    spanTopology,
  });
};

/** 校验 DOM 行列与 raw scanner 结果可以一一对应。 */
const hasAlignedRawRows = (model: CopyTestTableModel, rawTable: CopyTestRawTableRange): boolean => {
  return model.rows.length === rawTable.rows.length
    && model.rows.every(
      /** 要求每个 DOM 行的直属单元格数与同下标 raw 行一致。 */
      (row, index) => row.cells.length === rawTable.rows[index]?.cells.length
    );
};

/** 创建单张 raw table 视图。 */
const createRawTableView = (
  raw: string,
  rawTable: CopyTestRawTableRange,
  ordinal: number
): RawTableView | null => {
  /** 从当前 raw table 区间独立解析出的表格快照。 */
  const parsed = parseSingleTable(getRawRangeText(raw, rawTable));
  if (!parsed || !hasAlignedRawRows(parsed.model, rawTable)) {
    return null;
  }
  return { model: parsed.model, ordinal, raw, rawTable };
};

/** 读取 storage 中全部可安全 patch 的顶层 table 视图。 */
const createStorageTableViews = (storageHtml: string): RawTableView[] => {
  return scanTopLevelTableRawRanges(storageHtml).flatMap(
    /** 只保留能在 DOM 模型与 raw 行列之间安全映射的顶层表格。 */
    (rawTable, ordinal) => {
      /** 当前顶层表格在 DOM 模型与 raw 行列均对齐时生成的视图。 */
      const view = createRawTableView(storageHtml, rawTable, ordinal);
      return view ? [view] : [];
    }
  );
};

/** 读取 workingHtml 中唯一的顶层 table。 */
const createWorkingTableView = (workingHtml: string): RawTableView | null => {
  /** working html 中扫描到的全部顶层 raw 表格。 */
  const rawTables = scanTopLevelTableRawRanges(workingHtml);
  if (rawTables.length !== 1) {
    return null;
  }
  return createRawTableView(workingHtml, rawTables[0], 0);
};

/** 让旧 index 对候选检查顺序有优先级，但不把它作为歧义时的猜测依据。 */
const prioritizeTableViews = (views: RawTableView[], oldIndex: number): RawTableView[] => {
  /** 与导入时表格顺序一致的候选视图。 */
  const preferred = views.find(
    /** 查找仍位于导入顺序的候选表格。 */
    view => view.ordinal === oldIndex
  );
  return preferred
    ? [preferred, ...views.filter(
      /** 将首选视图之外的候选保持原顺序追加。 */
      view => view !== preferred
    )]
    : views;
};

/** 在 latest storage 中按签名唯一定位目标表。 */
const locateLatestTable = (
  storageHtml: string,
  oldIndex: number,
  signature: string
): RawTableView | null => {
  /** latest storage 中与导入定位签名完全一致的候选表格。 */
  const matches = prioritizeTableViews(createStorageTableViews(storageHtml), oldIndex)
    .filter(
      /** 只保留不可重建内容与导入快照完全一致的表格。 */
      view => buildTableLocatorSignature(view.model) === signature
    );
  return matches.length === 1 ? matches[0] : null;
};

/** 读取 header 中所有 non-managed 逻辑列。 */
const getNonManagedHeaderColumns = (model: CopyTestTableModel): Array<{ index: number; label: string }> => {
  /** 用作列身份来源的第一行表头模型。 */
  const headerRow = model.rows[0];
  if (!headerRow) {
    return [];
  }
  return headerRow.slots.flatMap(
    /** 将每个非 managed 逻辑表头投影为列下标和规范文本。 */
    (slot, index) => {
      if (!slot || isCompleteManagedCell(slot.cell)) {
        return [];
      }
      return [{ index, label: normalizeSignatureText(slot.cell.text) }];
    }
  );
};

/** 从导入时的列选择构建不依赖 managed 列绝对位置的 source 描述。 */
const buildSourceColumnDescriptor = (
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): SourceColumnDescriptor | null => {
  /** 导入表格中按逻辑列顺序排列的非 managed 标题。 */
  const columns = getNonManagedHeaderColumns(model);
  /** 与用户选择的逻辑列下标一致的候选标题。 */
  const selected = columns.find(
    /** 按用户导入时选择的逻辑列下标定位标题。 */
    column => column.index === selectedColumnIndex
  );
  /** 去除空白差异后的用户选择标题。 */
  const label = normalizeSignatureText(selectedColumnLabel);
  if (!selected || selected.label !== label) {
    return null;
  }
  /** 当前标题在同名非 managed 来源列中的零基序号。 */
  const occurrence = columns
    .filter(
      /** 统计当前列之前标题文本相同的非 managed 列。 */
      column => column.index < selectedColumnIndex && column.label === label
    )
    .length;
  return { label, occurrence };
};

/** 在另一版本 table 中解析同一个 non-managed source column。 */
const resolveSourceColumnIndex = (
  model: CopyTestTableModel,
  descriptor: SourceColumnDescriptor
): number | undefined => {
  /** 当前表格中标题与导入描述一致的全部非 managed 来源列。 */
  const matches = getNonManagedHeaderColumns(model)
    .filter(
      /** 只保留规范标题与导入描述相同的来源列。 */
      column => column.label === descriptor.label
    );
  return matches[descriptor.occurrence]?.index;
};

/** 构建 source RowGroup 的文本、anchor 位置和 rowspan 签名。 */
const buildSourceRowGroupSignature = (
  model: CopyTestTableModel,
  columnIndex: number
): string | null => {
  /** 来源列中每个 owned anchor 的文本、位置和跨行签名。 */
  const groups: Array<{ anchorRowIndex: number; rowSpan: number; text: string }> = [];
  for (let rowIndex = 1; rowIndex < model.rows.length; rowIndex += 1) {
    /** 当前待纳入来源列签名的数据物理行。 */
    const row = model.rows[rowIndex];
    /** 当前数据行在来源逻辑列上的 slot。 */
    const slot = row.slots[columnIndex];
    if (!slot) {
      return null;
    }
    if (slot.owned) {
      groups.push({
        anchorRowIndex: row.index,
        rowSpan: slot.cell.rowSpan,
        text: normalizeSignatureText(slot.cell.text),
      });
    }
  }
  return JSON.stringify(groups);
};

/** 校验 latest 和 working 的 source column 均未偏离导入快照。 */
const hasStableSourceColumn = (
  originalModel: CopyTestTableModel,
  latestModel: CopyTestTableModel,
  workingModel: CopyTestTableModel,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): boolean => {
  /** 由导入快照中选择下标和标题确定的稳定来源列描述。 */
  const descriptor = buildSourceColumnDescriptor(originalModel, selectedColumnIndex, selectedColumnLabel);
  if (!descriptor) {
    return false;
  }
  /** latest 表格中与导入描述对应的来源列下标。 */
  const latestIndex = resolveSourceColumnIndex(latestModel, descriptor);
  /** working 表格中与导入描述对应的来源列下标。 */
  const workingIndex = resolveSourceColumnIndex(workingModel, descriptor);
  if (latestIndex === undefined || workingIndex === undefined) {
    return false;
  }
  /** 导入快照中来源列的文本及合并拓扑签名。 */
  const originalSignature = buildSourceRowGroupSignature(originalModel, selectedColumnIndex);
  return originalSignature !== null
    && originalSignature === buildSourceRowGroupSignature(latestModel, latestIndex)
    && originalSignature === buildSourceRowGroupSignature(workingModel, workingIndex);
};

/** 将一个来源 rowspan 原子组覆盖的全部物理行加入导出范围。 */
const addSelectedPhysicalRows = (
  selectedPhysicalRows: Set<number>,
  anchorRowIndex: number,
  rowSpan: number,
  rowCount: number
): void => {
  /** 原子组位于当前表格内的最后一个物理行后一位。 */
  const rowEnd = Math.min(anchorRowIndex + rowSpan, rowCount);
  for (let rowIndex = anchorRowIndex; rowIndex < rowEnd; rowIndex += 1) {
    selectedPhysicalRows.add(rowIndex);
  }
};

/** 将业务数据行选择规范为完整来源原子组对应的物理行集合。 */
const buildSelectedPhysicalRowIndexes = (
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  selectedRowIndexes?: readonly number[]
): Set<number> | undefined => {
  if (selectedRowIndexes === undefined) {
    return undefined;
  }
  /** 调用方显式选择的零基业务数据行。 */
  const selectedDataRows = new Set(selectedRowIndexes);
  /** 经来源 rowspan 原子组展开后的物理数据行。 */
  const selectedPhysicalRows = new Set<number>();
  buildCopyTestRowGroups({ headers: model.headers, model }, selectedColumnIndex).forEach(group => {
    /** 组内任一业务行被选中时，整个来源原子组都属于本次导出范围。 */
    const selected = group.dataRowIndexes.some(rowIndex => selectedDataRows.has(rowIndex));
    if (selected) {
      addSelectedPhysicalRows(selectedPhysicalRows, group.anchorRowIndex, group.rowSpan, model.rows.length);
    }
  });
  return selectedPhysicalRows;
};

/** 构建 logical header identity，用于缺失 owned cell 的稳定插入位置。 */
const buildHeaderColumnIdentities = (model: CopyTestTableModel): string[] => {
  /** 每个规范化非 managed 标题已经出现的次数。 */
  const occurrences = new Map<string, number>();
  return (model.rows[0]?.slots || []).map(
    /** 为每个逻辑表头位置构建可跨版本比较的身份。 */
    (slot, columnIndex) => {
      if (!slot) {
        return `hole:${columnIndex}`;
      }
      /** 覆盖当前逻辑表头位置的物理单元格。 */
      const cell = slot.cell;
      /** 当前逻辑位置相对物理单元格首列的偏移量。 */
      const slotOffset = columnIndex - cell.columnIndex;
      if (isCompleteManagedCell(cell)) {
        return `managed:${cell.generatedType}:${cell.sourceColumnKey}:${slotOffset}`;
      }
      /** 非 managed 表头用于跨版本匹配的规范文本。 */
      const label = normalizeSignatureText(cell.text);
      /** 同名表头在当前位置之前已经出现的次数。 */
      const occurrence = occurrences.get(label) || 0;
      occurrences.set(label, occurrence + 1);
      return `raw:${JSON.stringify(label)}:${occurrence}`;
    }
  );
};

/** 构建目标 owned header identity。 */
const buildTargetHeaderIdentity = (
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): string => {
  return `managed:${type}:${sourceColumnKey}:0`;
};

/** 读取某行某个 DOM cell 对应的 raw cell range。 */
const getCellRawRange = (
  view: RawTableView,
  rowIndex: number,
  cell: CopyTestCellModel
): CopyTestRawCellRange | undefined => {
  /** 当前下标对应的 DOM 行模型。 */
  const modelRow = view.model.rows[rowIndex];
  /** 当前下标对应的 raw 行区间。 */
  const rawRow = view.rawTable.rows[rowIndex];
  /** 目标 DOM 单元格在物理行单元格集合中的下标。 */
  const cellIndex = modelRow?.cells.indexOf(cell) ?? -1;
  return cellIndex >= 0 ? rawRow?.cells[cellIndex] : undefined;
};

/** 读取当前行属于指定 pair 的 owned cells。 */
const getTargetCells = (
  row: CopyTestRowModel | undefined,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): CopyTestCellModel[] => {
  return row?.cells.filter(
    /** 只保留 ownership 键和 Result/Evidence 类型都匹配的单元格。 */
    cell => isTargetManagedCell(cell, type, sourceColumnKey)
  ) || [];
};

/** 判断当前目标 Pair 单元格是否同时覆盖已选和未选数据行。 */
const crossesSelectedRowBoundary = (
  cell: CopyTestCellModel,
  selectedPhysicalRows: Set<number>,
  rowCount: number
): boolean => {
  /** 当前生成单元格覆盖范围内是否出现已选数据行。 */
  let hasSelectedRow = false;
  /** 当前生成单元格覆盖范围内是否出现未选数据行。 */
  let hasUnselectedRow = false;
  /** 当前单元格位于表格内的最后一个覆盖行后一位。 */
  const rowEnd = Math.min(cell.rowIndex + cell.rowSpan, rowCount);
  for (let rowIndex = Math.max(1, cell.rowIndex); rowIndex < rowEnd; rowIndex += 1) {
    if (selectedPhysicalRows.has(rowIndex)) {
      hasSelectedRow = true;
    } else {
      hasUnselectedRow = true;
    }
  }
  return hasSelectedRow && hasUnselectedRow;
};

/** 拒绝拆分跨越选择边界的 Result/Evidence 单元格，避免改写未选行。 */
const hasTargetCellCrossingSelection = (
  model: CopyTestTableModel,
  sourceColumnKey: string,
  selectedPhysicalRows: Set<number>
): boolean => {
  return model.rows.some(row => row.cells.some(cell => {
    /** 只检查当前来源 Pair 的严格 managed Result/Evidence 单元格。 */
    const targetCell = isCompleteManagedCell(cell)
      && cell.sourceColumnKey === sourceColumnKey
      && COPY_TEST_GENERATED_TYPES.includes(cell.generatedType!);
    return targetCell && crossesSelectedRowBoundary(cell, selectedPhysicalRows, model.rows.length);
  }));
};

/** 给当前导出 pair 的 raw cell 添加临时跨模块 scope marker。 */
const addExportScopeToRawCell = (rawCell: string, exportScope: string): string | null => {
  /** 移除旧 scope 后等待写入本次 scope 的单元格 raw。 */
  const withoutExistingScope = rawCell.replace(EXPORT_SCOPE_ATTRIBUTE_PATTERN, '');
  if (!RAW_CELL_OPENING_PATTERN.test(withoutExistingScope)) {
    return null;
  }
  return withoutExistingScope.replace(
    RAW_CELL_OPENING_PATTERN,
    `$1 ${COPY_TEST_EXPORT_SCOPE_ATTRIBUTE}="${exportScope}"`
  );
};

/** 从 working header 顺序计算 base row 中的插入 raw offset。 */
const findCellInsertionIndex = (
  baseView: RawTableView,
  rowIndex: number,
  baseIdentities: string[],
  workingIdentities: string[],
  targetIdentity: string
): number | null => {
  /** 目标 owned header 在 working 逻辑列顺序中的下标。 */
  const targetColumnIndex = workingIdentities.indexOf(targetIdentity);
  /** latest 表格中需要插入单元格的 DOM 行。 */
  const baseRow = baseView.model.rows[rowIndex];
  /** latest 表格中需要插入单元格的 raw 行区间。 */
  const rawRow = baseView.rawTable.rows[rowIndex];
  if (targetColumnIndex < 0 || !baseRow || !rawRow) {
    return null;
  }
  /** 目标列之后的 working 表头身份，用于寻找首个稳定右侧锚点。 */
  const followingIdentities = workingIdentities.slice(targetColumnIndex + 1);
  for (let identityIndex = 0; identityIndex < followingIdentities.length; identityIndex += 1) {
    /** 当前尝试作为插入右侧锚点的表头身份。 */
    const identity = followingIdentities[identityIndex];
    /** 当前身份在 latest 表头顺序中的逻辑列下标。 */
    const baseColumnIndex = baseIdentities.indexOf(identity);
    /** latest 行中覆盖该逻辑列且由真实单元格拥有的 slot。 */
    const slot = baseColumnIndex >= 0 ? baseRow.slots[baseColumnIndex] : undefined;
    if (!slot?.owned) {
      continue;
    }
    /** 右侧锚点物理单元格对应的 raw 区间。 */
    const rawCell = getCellRawRange(baseView, rowIndex, slot.cell);
    if (!rawCell) {
      return null;
    }
    return rawCell.start;
  }
  return rawRow.closeTagRange.start;
};

/** 单个 row/type 最多只能存在一个 owned cell。 */
const getSingleTargetCell = (
  row: CopyTestRowModel | undefined,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): { cell?: CopyTestCellModel } | null => {
  /** 当前行属于目标来源列和生成类型的 owned 单元格。 */
  const cells = getTargetCells(row, type, sourceColumnKey);
  return cells.length <= 1 ? { cell: cells[0] } : null;
};

/** 将可选 DOM cell 安全解析到 raw range。 */
const resolveOptionalCellRange = (
  view: RawTableView,
  rowIndex: number,
  cell?: CopyTestCellModel
): { range?: CopyTestRawCellRange } | null => {
  if (!cell) {
    return {};
  }
  /** 可选 DOM 单元格在当前 raw 行中对应的区间。 */
  const range = getCellRawRange(view, rowIndex, cell);
  return range ? { range } : null;
};

/** 解析一个 row/type 补丁；重复 owned cell 或 raw 对齐失败时拒绝导出。 */
const resolveCellPatch = (context: CellPatchContext): ResolvedCellPatch | null => {
  /** latest 当前行中唯一允许存在的目标 owned 单元格。 */
  const baseCell = getSingleTargetCell(
    context.baseView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  /** working 当前行中唯一允许存在的目标 owned 单元格。 */
  const workingCell = getSingleTargetCell(
    context.workingView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  if (!baseCell || !workingCell) {
    return null;
  }
  /** latest 目标单元格的可选 raw 区间。 */
  const baseRange = resolveOptionalCellRange(context.baseView, context.rowIndex, baseCell.cell);
  /** working 目标单元格的可选 raw 区间。 */
  const workingRange = resolveOptionalCellRange(context.workingView, context.rowIndex, workingCell.cell);
  if (!baseRange || !workingRange) {
    return null;
  }
  /** 写入本次 export scope 后的 working 目标单元格 raw。 */
  const desiredRaw = workingRange.range
    ? addExportScopeToRawCell(
      getRawRangeText(context.workingView.raw, workingRange.range),
      context.exportScope
    )
    : '';
  return desiredRaw === null ? null : { baseRawCell: baseRange.range, desiredRaw };
};

/** 在 base 不含当前 owned cell 时，构建稳定的零宽插入 patch。 */
const appendCellInsertion = (
  context: CellPatchContext,
  desiredRaw: string
): boolean => {
  /** 依据 working 表头顺序计算出的 latest raw 零宽插入点。 */
  const insertionIndex = findCellInsertionIndex(
    context.baseView,
    context.rowIndex,
    context.baseHeaderIdentities,
    context.workingHeaderIdentities,
    buildTargetHeaderIdentity(context.type, context.sourceColumnKey)
  );
  if (insertionIndex === null) {
    return false;
  }
  context.replacements.push({
    range: { end: insertionIndex, start: insertionIndex },
    replacement: desiredRaw,
  });
  return true;
};

/** 追加单个 row/type 的替换、删除或插入 patch。 */
const appendCellPatch = (context: CellPatchContext): boolean => {
  /** 当前物理行和生成类型解析出的最小单元格补丁。 */
  const patch = resolveCellPatch(context);
  if (!patch) {
    return false;
  }
  if (patch.baseRawCell) {
    /** latest 中目标 owned 单元格当前未经序列化变更的 raw。 */
    const currentRaw = getRawRangeText(context.baseView.raw, patch.baseRawCell);
    if (currentRaw !== patch.desiredRaw) {
      context.replacements.push({ range: patch.baseRawCell, replacement: patch.desiredRaw });
    }
    return true;
  }
  return patch.desiredRaw === '' || appendCellInsertion(context, patch.desiredRaw);
};

/** 从 working 单元格复制结构属性并清空全部 Result/Evidence 内容。 */
const buildEmptyPlaceholderRaw = (
  view: RawTableView,
  range: CopyTestRawCellRange,
  exportScope: string
): string | null => {
  /** 保留严格 ownership、rowspan 和 group-id 的原始开标签。 */
  const openTag = getRawRangeText(view.raw, range.openTagRange);
  /** 保留与原单元格标签类型一致的原始关闭标签。 */
  const closeTag = getRawRangeText(view.raw, range.closeTagRange);
  return addExportScopeToRawCell(`${openTag}${closeTag}`, exportScope);
};

/** 判断占位单元格的 rowspan 是否会覆盖 latest 中已有的同类型 owned cell。 */
const placeholderCrossesExistingCell = (
  context: CellPatchContext,
  workingCell: CopyTestCellModel
): boolean => {
  /** 占位单元格在表格范围内覆盖的最后一行后一位。 */
  const rowEnd = Math.min(
    workingCell.rowIndex + workingCell.rowSpan,
    context.baseView.model.rows.length
  );
  for (let rowIndex = workingCell.rowIndex + 1; rowIndex < rowEnd; rowIndex += 1) {
    if (getTargetCells(
      context.baseView.model.rows[rowIndex],
      context.type,
      context.sourceColumnKey
    ).length > 0) {
      return true;
    }
  }
  return false;
};

/** 未选行保留 latest 已有 cell；仅在缺失时补入无业务内容的结构占位。 */
const appendUnselectedCellPlaceholder = (context: CellPatchContext): boolean => {
  /** latest 当前行中唯一允许存在的目标 owned 单元格。 */
  const baseCell = getSingleTargetCell(
    context.baseView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  /** working 当前行中用于复制结构的唯一目标 owned 单元格。 */
  const workingCell = getSingleTargetCell(
    context.workingView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  if (!baseCell || !workingCell) {
    return false;
  }
  if (baseCell.cell || !workingCell.cell) {
    return true;
  }
  if (placeholderCrossesExistingCell(context, workingCell.cell)) {
    return false;
  }
  /** working 结构单元格对应的精确 raw 区间。 */
  const workingRange = getCellRawRange(
    context.workingView,
    context.rowIndex,
    workingCell.cell
  );
  if (!workingRange) {
    return false;
  }
  /** 清空内容但保留严格结构 metadata 的临时 scoped 占位单元格。 */
  const placeholderRaw = buildEmptyPlaceholderRaw(
    context.workingView,
    workingRange,
    context.exportScope
  );
  return placeholderRaw !== null && appendCellInsertion(context, placeholderRaw);
};

/** 构建当前 pair 在所有物理行上的 raw replacements。 */
const buildPairReplacements = (
  baseView: RawTableView,
  workingView: RawTableView,
  sourceColumnKey: string,
  exportScope: string,
  selectedPhysicalRows?: Set<number>
): CopyTestRawReplacement[] | null => {
  if (baseView.model.rows.length !== workingView.model.rows.length) {
    return null;
  }
  if (selectedPhysicalRows
    && (hasTargetCellCrossingSelection(baseView.model, sourceColumnKey, selectedPhysicalRows)
      || hasTargetCellCrossingSelection(workingView.model, sourceColumnKey, selectedPhysicalRows))) {
    return null;
  }
  /** 当前来源列双列在全部物理行上累计的 raw replacements。 */
  const replacements: CopyTestRawReplacement[] = [];
  /** latest 表头逻辑位置对应的稳定身份序列。 */
  const baseHeaderIdentities = buildHeaderColumnIdentities(baseView.model);
  /** working 表头逻辑位置对应的稳定身份序列。 */
  const workingHeaderIdentities = buildHeaderColumnIdentities(workingView.model);
  for (let rowIndex = 0; rowIndex < workingView.model.rows.length; rowIndex += 1) {
    /** 当前是否为显式选择范围外、只能补空结构占位的数据行。 */
    const unselectedDataRow = rowIndex > 0
      && Boolean(selectedPhysicalRows)
      && !selectedPhysicalRows?.has(rowIndex);
    for (let typeIndex = 0; typeIndex < COPY_TEST_GENERATED_TYPES.length; typeIndex += 1) {
      /** 当前物理行需要解析的 Result 或 Evidence 生成类型。 */
      const type = COPY_TEST_GENERATED_TYPES[typeIndex];
      /** 标记当前 row/type 是否成功追加或确认无需补丁。 */
      const context: CellPatchContext = {
        baseHeaderIdentities,
        baseView,
        exportScope,
        replacements,
        rowIndex,
        sourceColumnKey,
        type,
        workingHeaderIdentities,
        workingView,
      };
      const appended = unselectedDataRow
        ? appendUnselectedCellPlaceholder(context)
        : appendCellPatch(context);
      if (!appended) {
        return null;
      }
    }
  }
  return replacements;
};

/** 校验 patch 没有改变目标 table raw range 之外的任何字节。 */
const hasUnchangedStorageOutsideTable = (
  beforeRaw: string,
  beforeTable: CopyTestRawTableRange,
  afterRaw: string
): boolean => {
  /** raw patch 导致目标表格及其后续内容发生的总长度变化。 */
  const lengthDelta = afterRaw.length - beforeRaw.length;
  /** 修改后目标表格在完整 storage 中对应的新绝对区间。 */
  const afterRange = {
    end: beforeTable.end + lengthDelta,
    start: beforeTable.start,
  };
  return hasUnchangedNonTargetRaw(beforeRaw, [beforeTable], afterRaw, [afterRange]);
};

/** 构建只包含当前 Comparison Column 双列改动的完整 export storage。 */
export const buildCurrentColumnExportStorage = ({
  exportScope,
  originalStorageHtml,
  selectedColumnIndex,
  selectedColumnLabel,
  selectedRowIndexes,
  table,
}: BuildCurrentColumnExportStorageParams): string | null => {
  if (!isValidCopyTestExportScope(exportScope)) {
    return null;
  }
  /** 从导入快照重新解析的目标表格。 */
  const originalTable = parseSingleTable(table.originalHtml);
  /** 从本地 working html 解析且 raw 行列对齐的唯一表格视图。 */
  const workingView = createWorkingTableView(table.workingHtml);
  if (!originalTable || !workingView) {
    return null;
  }
  /** 由导入快照非 managed 内容和合并拓扑构成的表格定位签名。 */
  const locatorSignature = buildTableLocatorSignature(originalTable.model);
  if (buildTableLocatorSignature(workingView.model) !== locatorSignature) {
    return null;
  }
  /** 在 latest storage 中唯一匹配导入定位签名的目标表格。 */
  const latestView = locateLatestTable(originalStorageHtml, table.index, locatorSignature);
  if (!latestView) {
    return null;
  }
  if (!hasStableSourceColumn(
    originalTable.model,
    latestView.model,
    workingView.model,
    selectedColumnIndex,
    selectedColumnLabel
  )) {
    return null;
  }
  /** 将本次 Result/Evidence 双列绑定到 Comparison Column 的稳定键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 显式选择经来源 rowspan 展开后的物理行；未传入时沿用历史全行导出。 */
  const selectedPhysicalRows = buildSelectedPhysicalRowIndexes(
    originalTable.model,
    selectedColumnIndex,
    selectedRowIndexes
  );
  /** 在 latest 目标表格上应用当前双列所需的最小 raw replacements。 */
  const replacements = buildPairReplacements(
    latestView,
    workingView,
    sourceColumnKey,
    exportScope,
    selectedPhysicalRows
  );
  if (!replacements) {
    return null;
  }
  /** 从后向前应用目标双列补丁后的完整 latest storage。 */
  const patchedStorage = replaceRangesDescending(originalStorageHtml, replacements);
  return hasUnchangedStorageOutsideTable(originalStorageHtml, latestView.rawTable, patchedStorage)
    ? patchedStorage
    : null;
};
