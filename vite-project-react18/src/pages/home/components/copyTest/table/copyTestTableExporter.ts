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
  type CopyTestTableRange,
} from './tableModel';
import {
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
interface BuildCurrentColumnExportStorageParams {
  exportScope: string;
  originalStorageHtml: string;
  selectedColumnIndex: number;
  selectedColumnLabel: string;
  table: CopyTestWorkingTable;
}

/** 同时持有 DOM 模型和 raw range 的单张表视图。 */
interface RawTableView {
  model: CopyTestTableModel;
  ordinal: number;
  raw: string;
  rawTable: CopyTestRawTableRange;
}

/** 非 managed source column 的稳定描述。 */
interface SourceColumnDescriptor {
  label: string;
  occurrence: number;
}

/** 单元格 patch 构造所需上下文。 */
interface CellPatchContext {
  baseHeaderIdentities: string[];
  baseView: RawTableView;
  exportScope: string;
  replacements: CopyTestRawReplacement[];
  rowIndex: number;
  sourceColumnKey: string;
  type: CopyTestGeneratedColumnType;
  workingHeaderIdentities: string[];
  workingView: RawTableView;
}

/** 单个 row/type 在 base 与 working 中解析出的 cell/range。 */
interface ResolvedCellPatch {
  baseRawCell?: CopyTestRawCellRange;
  desiredRaw: string;
}

const COPY_TEST_GENERATED_TYPES: CopyTestGeneratedColumnType[] = [
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
];

const RAW_CELL_OPENING_PATTERN = /^(\s*<(?:th|td)\b)/i;
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
  const headerLabels = (model.rows[0]?.cells || [])
    .filter(cell => !isCompleteManagedCell(cell))
    .map(cell => normalizeSignatureText(cell.text));
  const spanTopology = model.rows.map(row => {
    return row.cells
      .filter(cell => !isCompleteManagedCell(cell))
      .map(cell => [cell.tagName, cell.colSpan, cell.rowSpan]);
  });
  return JSON.stringify({
    headerLabels,
    rowCount: model.rows.length,
    spanTopology,
  });
};

/** 校验 DOM 行列与 raw scanner 结果可以一一对应。 */
const hasAlignedRawRows = (model: CopyTestTableModel, rawTable: CopyTestRawTableRange): boolean => {
  return model.rows.length === rawTable.rows.length
    && model.rows.every((row, index) => row.cells.length === rawTable.rows[index]?.cells.length);
};

/** 创建单张 raw table 视图。 */
const createRawTableView = (
  raw: string,
  rawTable: CopyTestRawTableRange,
  ordinal: number
): RawTableView | null => {
  const parsed = parseSingleTable(getRawRangeText(raw, rawTable));
  if (!parsed || !hasAlignedRawRows(parsed.model, rawTable)) {
    return null;
  }
  return { model: parsed.model, ordinal, raw, rawTable };
};

/** 读取 storage 中全部可安全 patch 的顶层 table 视图。 */
const createStorageTableViews = (storageHtml: string): RawTableView[] => {
  return scanTopLevelTableRawRanges(storageHtml).flatMap((rawTable, ordinal) => {
    const view = createRawTableView(storageHtml, rawTable, ordinal);
    return view ? [view] : [];
  });
};

/** 读取 workingHtml 中唯一的顶层 table。 */
const createWorkingTableView = (workingHtml: string): RawTableView | null => {
  const rawTables = scanTopLevelTableRawRanges(workingHtml);
  if (rawTables.length !== 1) {
    return null;
  }
  return createRawTableView(workingHtml, rawTables[0], 0);
};

/** 让旧 index 对候选检查顺序有优先级，但不把它作为歧义时的猜测依据。 */
const prioritizeTableViews = (views: RawTableView[], oldIndex: number): RawTableView[] => {
  const preferred = views.find(view => view.ordinal === oldIndex);
  return preferred ? [preferred, ...views.filter(view => view !== preferred)] : views;
};

/** 在 latest storage 中按签名唯一定位目标表。 */
const locateLatestTable = (
  storageHtml: string,
  oldIndex: number,
  signature: string
): RawTableView | null => {
  const matches = prioritizeTableViews(createStorageTableViews(storageHtml), oldIndex)
    .filter(view => buildTableLocatorSignature(view.model) === signature);
  return matches.length === 1 ? matches[0] : null;
};

/** 读取 header 中所有 non-managed 逻辑列。 */
const getNonManagedHeaderColumns = (model: CopyTestTableModel): Array<{ index: number; label: string }> => {
  const headerRow = model.rows[0];
  if (!headerRow) {
    return [];
  }
  return headerRow.slots.flatMap((slot, index) => {
    if (!slot || isCompleteManagedCell(slot.cell)) {
      return [];
    }
    return [{ index, label: normalizeSignatureText(slot.cell.text) }];
  });
};

/** 从导入时的列选择构建不依赖 managed 列绝对位置的 source 描述。 */
const buildSourceColumnDescriptor = (
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): SourceColumnDescriptor | null => {
  const columns = getNonManagedHeaderColumns(model);
  const selected = columns.find(column => column.index === selectedColumnIndex);
  const label = normalizeSignatureText(selectedColumnLabel);
  if (!selected || selected.label !== label) {
    return null;
  }
  const occurrence = columns
    .filter(column => column.index < selectedColumnIndex && column.label === label)
    .length;
  return { label, occurrence };
};

/** 在另一版本 table 中解析同一个 non-managed source column。 */
const resolveSourceColumnIndex = (
  model: CopyTestTableModel,
  descriptor: SourceColumnDescriptor
): number | undefined => {
  const matches = getNonManagedHeaderColumns(model)
    .filter(column => column.label === descriptor.label);
  return matches[descriptor.occurrence]?.index;
};

/** 构建 source RowGroup 的文本、anchor 位置和 rowspan 签名。 */
const buildSourceRowGroupSignature = (
  model: CopyTestTableModel,
  columnIndex: number
): string | null => {
  const groups: Array<{ anchorRowIndex: number; rowSpan: number; text: string }> = [];
  for (const row of model.rows.slice(1)) {
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
  const descriptor = buildSourceColumnDescriptor(originalModel, selectedColumnIndex, selectedColumnLabel);
  if (!descriptor) {
    return false;
  }
  const latestIndex = resolveSourceColumnIndex(latestModel, descriptor);
  const workingIndex = resolveSourceColumnIndex(workingModel, descriptor);
  if (latestIndex === undefined || workingIndex === undefined) {
    return false;
  }
  const originalSignature = buildSourceRowGroupSignature(originalModel, selectedColumnIndex);
  return originalSignature !== null
    && originalSignature === buildSourceRowGroupSignature(latestModel, latestIndex)
    && originalSignature === buildSourceRowGroupSignature(workingModel, workingIndex);
};

/** 构建 logical header identity，用于缺失 owned cell 的稳定插入位置。 */
const buildHeaderColumnIdentities = (model: CopyTestTableModel): string[] => {
  const occurrences = new Map<string, number>();
  return (model.rows[0]?.slots || []).map((slot, columnIndex) => {
    if (!slot) {
      return `hole:${columnIndex}`;
    }
    const cell = slot.cell;
    const slotOffset = columnIndex - cell.columnIndex;
    if (isCompleteManagedCell(cell)) {
      return `managed:${cell.generatedType}:${cell.sourceColumnKey}:${slotOffset}`;
    }
    const label = normalizeSignatureText(cell.text);
    const occurrence = occurrences.get(label) || 0;
    occurrences.set(label, occurrence + 1);
    return `raw:${JSON.stringify(label)}:${occurrence}`;
  });
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
  const modelRow = view.model.rows[rowIndex];
  const rawRow = view.rawTable.rows[rowIndex];
  const cellIndex = modelRow?.cells.indexOf(cell) ?? -1;
  return cellIndex >= 0 ? rawRow?.cells[cellIndex] : undefined;
};

/** 读取当前行属于指定 pair 的 owned cells。 */
const getTargetCells = (
  row: CopyTestRowModel | undefined,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): CopyTestCellModel[] => {
  return row?.cells.filter(cell => isTargetManagedCell(cell, type, sourceColumnKey)) || [];
};

/** 给当前导出 pair 的 raw cell 添加临时跨模块 scope marker。 */
const addExportScopeToRawCell = (rawCell: string, exportScope: string): string | null => {
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
  const targetColumnIndex = workingIdentities.indexOf(targetIdentity);
  const baseRow = baseView.model.rows[rowIndex];
  const rawRow = baseView.rawTable.rows[rowIndex];
  if (targetColumnIndex < 0 || !baseRow || !rawRow) {
    return null;
  }
  for (const identity of workingIdentities.slice(targetColumnIndex + 1)) {
    const baseColumnIndex = baseIdentities.indexOf(identity);
    const slot = baseColumnIndex >= 0 ? baseRow.slots[baseColumnIndex] : undefined;
    if (!slot?.owned) {
      continue;
    }
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
  const range = getCellRawRange(view, rowIndex, cell);
  return range ? { range } : null;
};

/** 解析一个 row/type 补丁；重复 owned cell 或 raw 对齐失败时拒绝导出。 */
const resolveCellPatch = (context: CellPatchContext): ResolvedCellPatch | null => {
  const baseCell = getSingleTargetCell(
    context.baseView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  const workingCell = getSingleTargetCell(
    context.workingView.model.rows[context.rowIndex],
    context.type,
    context.sourceColumnKey
  );
  if (!baseCell || !workingCell) {
    return null;
  }
  const baseRange = resolveOptionalCellRange(context.baseView, context.rowIndex, baseCell.cell);
  const workingRange = resolveOptionalCellRange(context.workingView, context.rowIndex, workingCell.cell);
  if (!baseRange || !workingRange) {
    return null;
  }
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
  const patch = resolveCellPatch(context);
  if (!patch) {
    return false;
  }
  if (patch.baseRawCell) {
    const currentRaw = getRawRangeText(context.baseView.raw, patch.baseRawCell);
    if (currentRaw !== patch.desiredRaw) {
      context.replacements.push({ range: patch.baseRawCell, replacement: patch.desiredRaw });
    }
    return true;
  }
  return patch.desiredRaw === '' || appendCellInsertion(context, patch.desiredRaw);
};

/** 构建当前 pair 在所有物理行上的 raw replacements。 */
const buildPairReplacements = (
  baseView: RawTableView,
  workingView: RawTableView,
  sourceColumnKey: string,
  exportScope: string
): CopyTestRawReplacement[] | null => {
  if (baseView.model.rows.length !== workingView.model.rows.length) {
    return null;
  }
  const replacements: CopyTestRawReplacement[] = [];
  const baseHeaderIdentities = buildHeaderColumnIdentities(baseView.model);
  const workingHeaderIdentities = buildHeaderColumnIdentities(workingView.model);
  for (let rowIndex = 0; rowIndex < workingView.model.rows.length; rowIndex += 1) {
    for (const type of COPY_TEST_GENERATED_TYPES) {
      const appended = appendCellPatch({
        baseHeaderIdentities,
        baseView,
        exportScope,
        replacements,
        rowIndex,
        sourceColumnKey,
        type,
        workingHeaderIdentities,
        workingView,
      });
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
  const lengthDelta = afterRaw.length - beforeRaw.length;
  const afterRange = {
    end: beforeTable.end + lengthDelta,
    start: beforeTable.start,
  };
  return hasUnchangedNonTargetRaw(beforeRaw, [beforeTable], afterRaw, [afterRange]);
};

/** 替换 storage 中指定 table range。 */
export const replaceTableInStorage = (
  storageHtml: string,
  tableRange: CopyTestTableRange,
  tableHtml: string
): string => {
  return replaceRangesDescending(storageHtml, [{
    range: tableRange,
    replacement: tableHtml,
  }]);
};

/** 构建只包含当前 Comparison Column 双列改动的完整 export storage。 */
export const buildCurrentColumnExportStorage = ({
  exportScope,
  originalStorageHtml,
  selectedColumnIndex,
  selectedColumnLabel,
  table,
}: BuildCurrentColumnExportStorageParams): string | null => {
  if (!isValidCopyTestExportScope(exportScope)) {
    return null;
  }
  const originalTable = parseSingleTable(table.originalHtml);
  const workingView = createWorkingTableView(table.workingHtml);
  if (!originalTable || !workingView) {
    return null;
  }
  const locatorSignature = buildTableLocatorSignature(originalTable.model);
  if (buildTableLocatorSignature(workingView.model) !== locatorSignature) {
    return null;
  }
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
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  const replacements = buildPairReplacements(
    latestView,
    workingView,
    sourceColumnKey,
    exportScope
  );
  if (!replacements) {
    return null;
  }
  const patchedStorage = replaceRangesDescending(originalStorageHtml, replacements);
  return hasUnchangedStorageOutsideTable(originalStorageHtml, latestView.rawTable, patchedStorage)
    ? patchedStorage
    : null;
};
