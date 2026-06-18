/**
 * 文件作用：从 original storage 出发，只导出当前 Comparison Column 的生成列补丁。
 */
import {
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
} from './tableConstants';
import {
  findTableRanges,
  parseSingleTable,
  toConfluenceStorageHtml,
  type CopyTestGeneratedColumnType,
  type CopyTestTableModel,
  type CopyTestTableRange,
} from './tableModel';
import { ensureCopyTestGeneratedColumns } from './copyTestTableEditor';
import {
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  type CopyTestWorkingTable,
} from './copyTestTableParser';

/** 当前列导出入参。 */
interface BuildCurrentColumnExportStorageParams {
  originalStorageHtml: string;
  selectedColumnIndex: number;
  selectedColumnLabel: string;
  table: CopyTestWorkingTable;
}

/** 替换 storage 中指定 table range。 */
export const replaceTableInStorage = (
  storageHtml: string,
  tableRange: CopyTestTableRange,
  tableHtml: string
): string => {
  return `${storageHtml.slice(0, tableRange.start)}${tableHtml}${storageHtml.slice(tableRange.end)}`;
};

/** 读取原始 storage 中的目标 table html。 */
const getOriginalTableHtml = (
  originalStorageHtml: string,
  table: CopyTestWorkingTable
): { html: string; range: CopyTestTableRange } | null => {
  const range = findTableRanges(originalStorageHtml)[table.index] || table.range;
  if (!range) {
    return null;
  }

  return {
    html: originalStorageHtml.slice(range.start, range.end),
    range,
  };
};

/** 读取受控内容。 */
const getManagedContentElements = (
  cell: Element | undefined,
  type: CopyTestGeneratedColumnType
): Element[] => {
  if (!cell) {
    return [];
  }

  const selector = `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${type}"]`;
  return cell.matches(selector) ? [cell] : Array.from(cell.querySelectorAll(selector));
};

/** 移除受控内容。 */
const removeManagedContent = (
  cell: Element,
  type: CopyTestGeneratedColumnType
): void => {
  getManagedContentElements(cell, type).forEach(element => element.remove());
};

/** 在目标 document 中重新创建受控内容，避免跨 document clone 丢失命名空间标签。 */
const cloneManagedContentIntoTargetDocument = (
  targetCell: Element,
  sourceContent: Element
): Element => {
  const wrapper = targetCell.ownerDocument.createElement('div');
  wrapper.innerHTML = sourceContent.outerHTML;
  return wrapper.firstElementChild || sourceContent.cloneNode(true) as Element;
};

/** 替换受控内容并保留人工内容。 */
const replaceManagedContent = (
  targetCell: Element,
  sourceCell: Element | undefined,
  type: CopyTestGeneratedColumnType
): void => {
  const sourceContents = getManagedContentElements(sourceCell, type);
  if (sourceContents.length === 0) {
    removeManagedContent(targetCell, type);
    return;
  }

  const targetContents = getManagedContentElements(targetCell, type);
  const clonedContent = cloneManagedContentIntoTargetDocument(targetCell, sourceContents[0]);
  if (targetContents.length > 0) {
    targetContents[0].replaceWith(clonedContent);
    targetContents.slice(1).forEach(element => element.remove());
    return;
  }

  if (targetCell.childNodes.length > 0) {
    targetCell.appendChild(targetCell.ownerDocument.createElement('br'));
  }
  targetCell.appendChild(clonedContent);
};

/** 应用单元格 rowspan。 */
const applyCellRowSpan = (cell: Element, rowSpan: number): void => {
  if (rowSpan > 1) {
    cell.setAttribute('rowspan', String(rowSpan));
    return;
  }

  cell.removeAttribute('rowspan');
};

/** 判断单元格是否是当前 source column 的生成单元格。 */
const isGeneratedCellForSource = (
  cell: { generatedType?: CopyTestGeneratedColumnType; sourceColumnKey?: string },
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): boolean => {
  return cell.generatedType === type && cell.sourceColumnKey === sourceColumnKey;
};

/** 移除某行里当前 source column 的生成单元格。 */
const removeGeneratedCellsInRow = (
  model: CopyTestTableModel,
  rowIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows[rowIndex]?.cells
    .filter(cell => isGeneratedCellForSource(cell, type, sourceColumnKey))
    .forEach(cell => cell.element.remove());
};

/** 移除被 rowspan 覆盖的生成单元格。 */
const removeCoveredGeneratedCells = (
  model: CopyTestTableModel,
  rowIndex: number,
  rowSpan: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  for (let offset = 1; offset < rowSpan; offset += 1) {
    removeGeneratedCellsInRow(model, rowIndex + offset, type, sourceColumnKey);
  }
};

/** 确保目标行有可写生成单元格。 */
const ensureWritableTargetCell = (
  model: CopyTestTableModel,
  tableElement: HTMLTableElement,
  rowIndex: number,
  columnIndex: number
): HTMLTableCellElement => {
  const slot = model.rows[rowIndex]?.slots[columnIndex];
  if (slot?.owned && slot.cell.element instanceof HTMLTableCellElement) {
    return slot.cell.element;
  }

  const row = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tr'))[rowIndex];
  const cell = tableElement.ownerDocument.createElement('td');
  const nextOwnedCell = model.rows[rowIndex]?.cells.find(item => item.columnIndex > columnIndex)?.element;
  row?.insertBefore(cell, nextOwnedCell || null);
  return cell;
};

/** 将一个生成列从 working table 复制到 original table。 */
const copyGeneratedColumnPatch = (
  baseModel: CopyTestTableModel,
  workingModel: CopyTestTableModel,
  baseColumnIndex: number,
  workingColumnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  workingModel.rows.slice(1).forEach(row => {
    const sourceSlot = row.slots[workingColumnIndex];
    if (!sourceSlot?.owned) {
      removeGeneratedCellsInRow(baseModel, row.index, type, sourceColumnKey);
      return;
    }

    const targetCell = ensureWritableTargetCell(baseModel, baseModel.table, row.index, baseColumnIndex);

    applyCellRowSpan(targetCell, sourceSlot.cell.rowSpan);
    replaceManagedContent(targetCell, sourceSlot.cell.element, type);
    removeCoveredGeneratedCells(baseModel, row.index, sourceSlot.cell.rowSpan, type, sourceColumnKey);
  });
};

/** 合并当前 source column 的两个生成列。 */
const mergeCurrentGeneratedColumns = (
  originalTableHtml: string,
  workingTableHtml: string,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): string => {
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  const baseEnsured = ensureCopyTestGeneratedColumns(originalTableHtml, selectedColumnIndex, selectedColumnLabel);
  const workingTable = parseSingleTable(workingTableHtml);
  if (!baseEnsured || !workingTable) {
    return originalTableHtml;
  }

  const baseTable = parseSingleTable(baseEnsured.html);
  if (!baseTable) {
    return originalTableHtml;
  }

  const baseIndexes = findGeneratedColumnIndexes(baseTable.headers, sourceColumnKey, selectedColumnLabel);
  const workingIndexes = findGeneratedColumnIndexes(workingTable.headers, sourceColumnKey, selectedColumnLabel);
  if (
    baseIndexes.result === undefined
    || baseIndexes.evidence === undefined
    || workingIndexes.result === undefined
    || workingIndexes.evidence === undefined
  ) {
    return originalTableHtml;
  }

  copyGeneratedColumnPatch(
    baseTable.model,
    workingTable.model,
    baseIndexes.result,
    workingIndexes.result,
    COPY_TEST_GENERATED_RESULT_TYPE,
    sourceColumnKey
  );
  copyGeneratedColumnPatch(
    baseTable.model,
    workingTable.model,
    baseIndexes.evidence,
    workingIndexes.evidence,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    sourceColumnKey
  );
  return toConfluenceStorageHtml(baseTable.model.table.outerHTML);
};

/** 构建只包含当前 Comparison Column 改动的完整 export storage。 */
export const buildCurrentColumnExportStorage = ({
  originalStorageHtml,
  selectedColumnIndex,
  selectedColumnLabel,
  table,
}: BuildCurrentColumnExportStorageParams): string | null => {
  const originalTable = getOriginalTableHtml(originalStorageHtml, table);
  if (!originalTable) {
    return null;
  }

  const mergedTableHtml = mergeCurrentGeneratedColumns(
    originalTable.html,
    table.workingHtml,
    selectedColumnIndex,
    selectedColumnLabel
  );
  const normalizedTableHtml = parseSingleTable(mergedTableHtml)?.html || mergedTableHtml;
  return replaceTableInStorage(originalStorageHtml, originalTable.range, normalizedTableHtml);
};
