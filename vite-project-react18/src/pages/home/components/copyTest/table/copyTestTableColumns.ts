/**
 * 文件作用：维护 CopyTest managed 生成列的 ownership、创建与 rowspan 结构。
 */
import {
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from './tableConstants';
import {
  getGeneratedColumnLabel,
  parseHtml,
  parseTableModel,
  toConfluenceStorageHtml,
  type CopyTestCellModel,
  type CopyTestGeneratedColumnType,
  type CopyTestTableModel,
} from './tableModel';
import {
  buildCopyTestEvidenceSections,
  findGeneratedColumnIndexes,
  getSourceColumnDisplayLabel,
  getSourceColumnKey,
  refreshWorkingTable,
  type CopyTestWorkingTable,
} from './copyTestTableParser';

/** 表格标签名。 */
const TABLE_TAG_NAME = 'table';

/** 数据行起始下标。 */
const FIRST_DATA_ROW_INDEX = 1;

/** 生成列上下文。 */
export interface GeneratedColumnContext {
  /** 当前 Comparison Column 的 Evidence 列下标。 */
  evidenceColumnIndex: number;
  /** 包含生成列的最新表格模型。 */
  model: CopyTestTableModel;
  /** 当前 Comparison Column 的 Result 列下标。 */
  resultColumnIndex: number;
  /** 两个生成列共同使用的 ownership 键。 */
  sourceColumnKey: string;
  /** 承载生成列修改的真实表格元素。 */
  tableElement: HTMLTableElement;
}

/** 应用生成列 metadata。 */
const applyGeneratedMetadata = (cell: Element, type: CopyTestGeneratedColumnType, sourceColumnKey: string): void => {
  cell.setAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE, type);
  cell.setAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE, sourceColumnKey);
  cell.setAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE, sourceColumnKey);
  cell.setAttribute(COPY_TEST_SCHEMA_ATTRIBUTE, COPY_TEST_SCHEMA_VERSION);
};

/** 应用单元格 rowspan。 */
export const applyCellRowSpan = (cell: Element, rowSpan: number): void => {
  if (rowSpan > 1) {
    cell.setAttribute('rowspan', String(rowSpan));
    return;
  }

  cell.removeAttribute('rowspan');
};

/** 判断生成单元格是否属于当前 source column。 */
export const isGeneratedCellForSource = (
  cell: CopyTestCellModel,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): boolean => {
  return cell.generatedType === type && cell.sourceColumnKey === sourceColumnKey;
};

/** 移除某一行里当前 source column 的生成单元格。 */
const removeGeneratedCellsInRow = (
  model: CopyTestTableModel,
  rowIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows[rowIndex]?.cells
    .filter(
      /** 只选择类型和 ownership 均属于当前来源列的生成单元格。 */
      cell => isGeneratedCellForSource(cell, type, sourceColumnKey)
    )
    .forEach(
      /** 从真实 DOM 行中移除命中的生成单元格。 */
      cell => cell.element.remove()
    );
};

/** 移除被 rowspan 覆盖的当前 source column 生成单元格。 */
export const removeCoveredGeneratedCells = (
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

/** 读取源列单元格的 rowspan。 */
const getSourceRowSpan = (model: CopyTestTableModel, rowIndex: number, selectedColumnIndex: number): number => {
  /** 当前物理行在来源逻辑列上的槽位。 */
  const slot = model.rows[rowIndex]?.slots[selectedColumnIndex];
  return slot?.owned ? slot.cell.rowSpan : 1;
};

/** 判断当前行是否被源列 rowspan 覆盖。 */
const isCoveredBySourceRowSpan = (
  model: CopyTestTableModel,
  rowIndex: number,
  selectedColumnIndex: number
): boolean => {
  /** 当前物理行在来源逻辑列上的槽位。 */
  const slot = model.rows[rowIndex]?.slots[selectedColumnIndex];
  return Boolean(slot && !slot.owned);
};

/** 创建生成列单元格。 */
const createGeneratedCell = (
  doc: Document,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string,
  text?: string
): HTMLTableCellElement => {
  /** 表头行创建 th，数据行创建 td 的新生成单元格。 */
  const cell = doc.createElement(text ? 'th' : 'td');
  applyGeneratedMetadata(cell, type, sourceColumnKey);
  if (text) {
    cell.textContent = text;
  }
  return cell;
};

/** 追加一整列生成列。 */
const appendGeneratedColumn = (
  doc: Document,
  model: CopyTestTableModel,
  type: CopyTestGeneratedColumnType,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  sourceColumnKey: string
): void => {
  /** 当前来源列用于生成双列表头的可辨识展示名。 */
  const sourceColumnDisplayLabel = getSourceColumnDisplayLabel(selectedColumnIndex, selectedColumnLabel);
  model.rows.forEach(
    /** 在表头及每个来源行组锚点末尾追加生成单元格。 */
    ({ element: row, index: rowIndex }) => {
      if (rowIndex > 0 && isCoveredBySourceRowSpan(model, rowIndex, selectedColumnIndex)) {
        return;
      }

      /** 仅表头行需要生成列标题。 */
      const label = rowIndex === 0 ? getGeneratedColumnLabel(type, sourceColumnDisplayLabel) : undefined;
      /** 当前行待追加的 Result 或 Evidence 单元格。 */
      const cell = createGeneratedCell(doc, type, sourceColumnKey, label);
      applyCellRowSpan(cell, rowIndex > 0 ? getSourceRowSpan(model, rowIndex, selectedColumnIndex) : 1);
      row.appendChild(cell);
    }
  );
};

/** 同步已有 managed 生成列的表头，修正历史空来源表头产生的不可区分标题。 */
const syncGeneratedColumnHeaderLabel = (
  model: CopyTestTableModel,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): void => {
  /** 表头行中直接拥有当前生成列的逻辑槽位。 */
  const headerSlot = model.rows[0]?.slots[columnIndex];
  if (!headerSlot?.owned) {
    return;
  }

  /** 当前来源列用于生成双列表头的可辨识展示名。 */
  const sourceColumnDisplayLabel = getSourceColumnDisplayLabel(selectedColumnIndex, selectedColumnLabel);
  headerSlot.cell.element.textContent = getGeneratedColumnLabel(type, sourceColumnDisplayLabel);
};

/** 给已有生成列补齐 metadata。 */
const applyGeneratedMetadataToColumn = (
  model: CopyTestTableModel,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.forEach(
    /** 为该逻辑列中每个直接拥有的单元格刷新严格 ownership 元数据。 */
    row => {
      /** 当前物理行在目标生成逻辑列上的槽位。 */
      const slot = row.slots[columnIndex];
      if (slot?.owned) {
        applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
      }
    }
  );
};

/** 确保指定行有可写入的生成列单元格。 */
export const ensureWritableGeneratedCell = (
  doc: Document,
  model: CopyTestTableModel,
  rowIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): HTMLTableCellElement => {
  /** 当前行目标生成逻辑列已有的槽位。 */
  const slot = model.rows[rowIndex]?.slots[columnIndex];
  if (slot?.owned && slot.cell.element instanceof HTMLTableCellElement) {
    applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
    return slot.cell.element;
  }

  /** 需要补入生成单元格的结构化物理行。 */
  const modelRow = model.rows[rowIndex];
  /** 对应的真实 DOM 行元素。 */
  const row = modelRow?.element;
  /** 当前来源列新建的可写数据单元格。 */
  const cell = doc.createElement('td');
  /** 目标逻辑列右侧首个由当前物理行直接拥有的 DOM 单元格。 */
  const nextOwnedCell = modelRow?.cells.find(
    /** 保持原逻辑列顺序，将新单元格插入右侧邻居之前。 */
    item => item.columnIndex > columnIndex
  )?.element;
  applyGeneratedMetadata(cell, type, sourceColumnKey);
  row?.insertBefore(cell, nextOwnedCell || null);
  return cell;
};

/** 同步生成列的基础 rowspan。 */
export const syncGeneratedColumnSpans = (
  doc: Document,
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.slice(FIRST_DATA_ROW_INDEX).forEach(
    /** 逐个数据物理行同步生成列与来源列的纵向覆盖范围。 */
    row => {
      if (isCoveredBySourceRowSpan(model, row.index, selectedColumnIndex)) {
        removeGeneratedCellsInRow(model, row.index, type, sourceColumnKey);
        return;
      }

      /** 来源单元格从当前锚点开始覆盖的物理行数。 */
      const rowSpan = getSourceRowSpan(model, row.index, selectedColumnIndex);
      /** 与来源行组锚点对齐的可写生成单元格。 */
      const cell = ensureWritableGeneratedCell(doc, model, row.index, columnIndex, type, sourceColumnKey);
      applyCellRowSpan(cell, rowSpan);
      removeCoveredGeneratedCells(model, row.index, rowSpan, type, sourceColumnKey);
    }
  );
};

/** 将 Evidence 列投影为空行分隔的永久 section rowspan。 */
const syncEvidenceSectionSpans = (
  doc: Document,
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  evidenceColumnIndex: number,
  sourceColumnKey: string
): void => {
  /** 当前所选列中全部连续非空 Evidence section。 */
  const sections = buildCopyTestEvidenceSections(
    { headers: model.headers, model },
    selectedColumnIndex
  );
  sections.forEach(section => {
    /** section 首行对应的可写 Evidence 单元格。 */
    const cell = ensureWritableGeneratedCell(
      doc,
      model,
      section.anchorRowIndex,
      evidenceColumnIndex,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      sourceColumnKey
    );
    /** section 内除首行外已有的 Evidence 单元格，内容必须迁移后再移除。 */
    const coveredCells = section.rowGroups.slice(1).flatMap(rowGroup => {
      /** 当前来源原子组锚点直接拥有的 Evidence 单元格。 */
      const slot = model.rows[rowGroup.anchorRowIndex]?.slots[evidenceColumnIndex];
      return slot?.owned && isGeneratedCellForSource(
        slot.cell,
        COPY_TEST_GENERATED_EVIDENCE_TYPE,
        sourceColumnKey
      ) ? [slot.cell.element] : [];
    });
    coveredCells.forEach(coveredCell => {
      /** 待迁移节点快照，避免移动过程中修改 live NodeList。 */
      const childNodes = Array.from(coveredCell.childNodes);
      if (cell.childNodes.length > 0 && childNodes.length > 0) {
        cell.appendChild(doc.createElement('br'));
      }
      childNodes.forEach(childNode => cell.appendChild(childNode));
    });
    applyCellRowSpan(cell, section.rowSpan);
    removeCoveredGeneratedCells(
      model,
      section.anchorRowIndex,
      section.rowSpan,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      sourceColumnKey
    );
  });
};

/** 确保当前 Comparison Column 的 Result/Evidence 两列存在。 */
export const ensureCopyTestGeneratedColumns = (
  tableHtml: string,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): { context: GeneratedColumnContext; html: string } | null => {
  /** 当前工作表格片段解析得到的可编辑 DOM。 */
  const doc = parseHtml(tableHtml);
  /** 工作片段中的目标表格根元素。 */
  const tableElement = doc.querySelector<HTMLTableElement>(TABLE_TAG_NAME);
  if (!tableElement) {
    return null;
  }

  /** 当前 Comparison Column 的稳定 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 追加缺失列之前的表格结构模型。 */
  const initialModel = parseTableModel(tableElement);
  /** 当前严格 schema 下已存在的 Result/Evidence 列下标。 */
  const initialIndexes = findGeneratedColumnIndexes(initialModel.headers, sourceColumnKey);
  /** 本次是否需要新建 Result 列。 */
  const resultColumnCreated = initialIndexes.result === undefined;
  /** 本次是否需要新建 Evidence 列。 */
  const evidenceColumnCreated = initialIndexes.evidence === undefined;
  if (resultColumnCreated) {
    appendGeneratedColumn(
      doc,
      initialModel,
      COPY_TEST_GENERATED_RESULT_TYPE,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey
    );
  }
  if (evidenceColumnCreated) {
    appendGeneratedColumn(
      doc,
      initialModel,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey
    );
  }

  /** 补齐缺失列后重新解析的表格模型。 */
  const model = parseTableModel(tableElement);
  /** 补齐后当前来源列的严格 Result/Evidence 下标。 */
  const indexes = findGeneratedColumnIndexes(model.headers, sourceColumnKey);
  if (indexes.result === undefined || indexes.evidence === undefined) {
    return null;
  }

  applyGeneratedMetadataToColumn(model, indexes.result, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey);
  applyGeneratedMetadataToColumn(model, indexes.evidence, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey);
  syncGeneratedColumnHeaderLabel(
    model,
    indexes.result,
    COPY_TEST_GENERATED_RESULT_TYPE,
    selectedColumnIndex,
    selectedColumnLabel
  );
  syncGeneratedColumnHeaderLabel(
    model,
    indexes.evidence,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    selectedColumnIndex,
    selectedColumnLabel
  );
  if (resultColumnCreated) {
    syncGeneratedColumnSpans(
      doc,
      model,
      selectedColumnIndex,
      indexes.result,
      COPY_TEST_GENERATED_RESULT_TYPE,
      sourceColumnKey
    );
  }
  /** Evidence 先恢复来源原子跨度，确保历史 Pair 的空行边界也拥有独立单元格。 */
  syncGeneratedColumnSpans(
    doc,
    model,
    selectedColumnIndex,
    indexes.evidence,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    sourceColumnKey
  );
  /** 原子恢复可能新建单元格，因此必须基于最新模型投影永久 section。 */
  syncEvidenceSectionSpans(
    doc,
    parseTableModel(tableElement),
    selectedColumnIndex,
    indexes.evidence,
    sourceColumnKey
  );

  /** 完成 metadata 与 rowspan 同步后的最终模型。 */
  const syncedModel = parseTableModel(tableElement);
  return {
    context: {
      evidenceColumnIndex: indexes.evidence,
      model: syncedModel,
      resultColumnIndex: indexes.result,
      sourceColumnKey,
      tableElement,
    },
    html: toConfluenceStorageHtml(tableElement.outerHTML),
  };
};

/** 确保当前列生成列并返回新工作表格。 */
export const ensureCopyTestWorkingColumns = (
  table: CopyTestWorkingTable,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable => {
  /** 当前来源列双列补齐后的编辑结果；无有效 table 时为空。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  return ensured ? refreshWorkingTable(table, ensured.html) : table;
};
