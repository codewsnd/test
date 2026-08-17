/**
 * 文件作用：把 working table HTML 转换为可交互的安全预览文档副本。
 */
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
} from '../../table/copyTestTableParser';
import {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../../constants';
import { parseTableModel } from '../../table/tableModel';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_RESULT_FAILED_GROUP_VALUE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_RESULT_PASSED_GROUP_VALUE,
  COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
} from '../../table/tableConstants';
import type { CopyTestTableEntry } from '../../types';
import {
  DELETE_BUTTON_ATTRIBUTE,
  DISABLED_ATTRIBUTE,
  DOM_TRUE_ATTRIBUTE_VALUE,
  FAILED_RESULT_LABEL,
  MARK_AS_FAILED_LINK_LABEL,
  MARK_AS_PASSED_LINK_LABEL,
  PASSED_RESULT_LABEL,
  PREVIEW_ACTION_ATTRIBUTE,
  PREVIEW_ALLOWED_LINK_PROTOCOLS,
  PREVIEW_ALLOWED_RESOURCE_PROTOCOLS,
  PREVIEW_COLUMN_ROLE_ATTRIBUTE,
  PREVIEW_DOCUMENT_STYLE,
  PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE,
  PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE,
  PREVIEW_HEADER_COLUMN_ROLE,
  PREVIEW_IMAGE_ALT_ATTRIBUTE,
  PREVIEW_IMAGE_ID_ATTRIBUTE,
  PREVIEW_IMAGE_INSTANCE_ATTRIBUTE,
  PREVIEW_RESERVED_RUNTIME_ATTRIBUTES,
  PREVIEW_SAFE_URL_BASE,
  PREVIEW_SELECTION_COLUMN_ROLE,
  PREVIEW_STORAGE_IMAGE_ATTRIBUTE,
  PREVIEW_TABLE_SELECTOR,
  PREVIEW_URL_ATTRIBUTE_NAMES,
  PUNCTUATION_REVIEW_THRESHOLD,
  PUNCTUATION_REVIEW_WARNING_ATTRIBUTE,
  PUNCTUATION_REVIEW_WARNING_TEXT,
  RESULT_STATUS_LINK_ATTRIBUTE,
  RESULT_STATUS_PASSED_ATTRIBUTE,
  RESULT_STATUS_ROW_INDEX_ATTRIBUTE,
  RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_COLUMN_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECTABLE_ATTRIBUTE,
  SELECTION_SELECT_ALL_ATTRIBUTE,
  UNICODE_PUNCTUATION_PATTERN,
  PREVIEW_SELECTION_COLUMN_WIDTH,
} from './tablePreviewConstants';
import { getPreviewImageKey } from './tablePreviewImages';
import { buildPreviewRuntimeScript } from './tablePreviewRuntime';

const getVisibleColumnIndexes = (
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): Set<number> | null => {
  if (selectedColumnIndex === undefined) {
    return null;
  }

  /** 当前 Comparison Column 对应的表头。 */
  const selectedHeader = table.headers.find(header => header.index === selectedColumnIndex);
  if (!selectedHeader) {
    return null;
  }

  /** 将原始列与其 Test 双列关联的稳定键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedHeader.label);
  /** 当前原始列拥有的 Test Result 和 Test Evidence 列下标。 */
  const generatedIndexes = findGeneratedColumnIndexes(table.headers, sourceColumnKey);
  return new Set([
    selectedColumnIndex,
    generatedIndexes.result,
    generatedIndexes.evidence,
  ].filter((columnIndex): columnIndex is number => columnIndex !== undefined));
};

/** 计算单元格横跨的可见列数量。 */
const getVisibleColSpan = (columnIndex: number, colSpan: number, visibleColumnIndexes: Set<number>): number => {
  return Array.from({ length: colSpan }, (_, offset) => columnIndex + offset)
    .filter(index => visibleColumnIndexes.has(index))
    .length;
};

/** 删除当前预览表直属的旧列宽定义，避免 Confluence colgroup 干扰固定列宽。 */
const removePreviewColumnGroups = (tableElement: HTMLTableElement): void => {
  Array.from(tableElement.children)
    .filter(child => child.tagName.toLowerCase() === 'colgroup')
    .forEach(columnGroup => columnGroup.remove());
};

/** 清除预览副本中的旧宽度约束，避免行内样式覆盖当前固定列宽。 */
const clearPreviewWidthConstraints = (
  element: HTMLElement,
  clearTableLayout = false
): void => {
  ['width', 'min-width', 'max-width'].forEach(propertyName => element.style.removeProperty(propertyName));
  if (clearTableLayout) {
    element.style.removeProperty('table-layout');
  }
  element.removeAttribute('width');
  if (!element.getAttribute('style')?.trim()) {
    element.removeAttribute('style');
  }
};

/** 单个预览列的角色与像素宽度。 */
interface PreviewColumnDefinition {
  /** 用于 CSS 和测试识别的列角色。 */
  role: string;
  /** 当前列的固定像素宽度。 */
  width: number;
}

/** 读取指定业务列对应的预览角色与宽度。 */
const getPreviewColumnDefinition = (
  table: CopyTestTableEntry,
  columnIndex: number
): PreviewColumnDefinition => {
  /** 当前逻辑列的表头信息。 */
  const header = table.headers.find(item => item.index === columnIndex);
  if (header?.generatedType === COPY_TEST_GENERATED_RESULT_TYPE) {
    return {
      role: COPY_TEST_GENERATED_RESULT_TYPE,
      width: COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
    };
  }
  if (header?.generatedType === COPY_TEST_GENERATED_EVIDENCE_TYPE) {
    return {
      role: COPY_TEST_GENERATED_EVIDENCE_TYPE,
      width: COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
    };
  }
  return {
    role: PREVIEW_HEADER_COLUMN_ROLE,
    width: COPY_TEST_PREVIEW_HEADER_WIDTH,
  };
};

/** 读取当前预览实际展示的业务逻辑列下标。 */
const getPreviewBusinessColumnIndexes = (
  table: CopyTestTableEntry,
  visibleColumnIndexes: Set<number> | null
): number[] => {
  if (visibleColumnIndexes) {
    return Array.from(visibleColumnIndexes).sort((left, right) => left - right);
  }
  return Array.from({ length: table.model.columnCount }, (_, columnIndex) => columnIndex);
};

/** 创建带固定宽度和角色标记的 col 元素。 */
const createPreviewColumnElement = (
  doc: Document,
  definition: PreviewColumnDefinition,
  equalBusinessColumns: boolean
): HTMLTableColElement => {
  /** 写入预览表 colgroup 的单列元素。 */
  const column = doc.createElement('col');
  column.setAttribute(PREVIEW_COLUMN_ROLE_ATTRIBUTE, definition.role);
  if (!equalBusinessColumns || definition.role === PREVIEW_SELECTION_COLUMN_ROLE) {
    column.setAttribute('width', String(definition.width));
  }
  return column;
};

/** 根据当前预览模式写入表格自身的宽度约束。 */
const applyPreviewTableWidth = (
  tableElement: HTMLTableElement,
  definitions: PreviewColumnDefinition[],
  equalBusinessColumns: boolean
): void => {
  if (equalBusinessColumns) {
    tableElement.setAttribute(PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    tableElement.style.width = '100%';
    tableElement.style.minWidth = '100%';
    tableElement.style.maxWidth = '100%';
    return;
  }

  /** 完整表格按各列固定宽度相加得到的总像素宽度。 */
  const tableWidth = definitions.reduce((total, definition) => total + definition.width, 0);
  tableElement.removeAttribute(PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE);
  tableElement.style.width = `${tableWidth}px`;
  tableElement.style.minWidth = `${tableWidth}px`;
  tableElement.style.maxWidth = `${tableWidth}px`;
};

/** 清除顶层预览单元格自带的行内宽度。 */
const clearPreviewCellWidths = (tableElement: HTMLTableElement): void => {
  tableElement.querySelectorAll<HTMLElement>('th, td').forEach(cell => {
    if (cell.closest(PREVIEW_TABLE_SELECTOR) === tableElement) {
      clearPreviewWidthConstraints(cell);
    }
  });
};

/** 为完整表格应用固定列宽，或为当前 Comparison Column 视图应用三列等分宽度。 */
const applyPreviewColumnWidths = (
  doc: Document,
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): void => {
  /** 需要重建 colgroup 的顶层预览表格。 */
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return;
  }

  /** 有效 Comparison Column 对应的来源列和 Test 双列集合。 */
  const visibleColumnIndexes = getVisibleColumnIndexes(table, selectedColumnIndex);
  /** 是否需要让来源列和 Test 双列等分预览剩余宽度。 */
  const equalBusinessColumns = visibleColumnIndexes !== null;
  /** 当前业务列按实际 DOM 展示顺序生成的宽度定义。 */
  const definitions = getPreviewBusinessColumnIndexes(table, visibleColumnIndexes)
    .map(columnIndex => getPreviewColumnDefinition(table, columnIndex));
  if (equalBusinessColumns) {
    definitions.unshift({
      role: PREVIEW_SELECTION_COLUMN_ROLE,
      width: PREVIEW_SELECTION_COLUMN_WIDTH,
    });
  }

  /** 替换 Confluence 原始列宽的新 colgroup。 */
  const columnGroup = doc.createElement('colgroup');
  definitions.forEach(definition => {
    columnGroup.appendChild(createPreviewColumnElement(doc, definition, equalBusinessColumns));
  });

  clearPreviewWidthConstraints(tableElement, true);
  clearPreviewCellWidths(tableElement);
  removePreviewColumnGroups(tableElement);
  tableElement.insertBefore(columnGroup, tableElement.firstChild);
  tableElement.setAttribute(PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  applyPreviewTableWidth(tableElement, definitions, equalBusinessColumns);
  tableElement.style.tableLayout = 'fixed';
};

/** 从 data url 创建 blob url。 */

const hasSelectableCellText = (
  table: CopyTestTableEntry,
  rowIndex: number,
  selectedColumnIndex: number
): boolean => {
  return table.model.rows[rowIndex]?.slots[selectedColumnIndex]?.cell.text.trim() !== '';
};

/** 读取当前列可选择的逻辑行首行。 */
const getSelectableAnchorRowIndexes = (
  table: CopyTestTableEntry,
  selectedColumnIndex: number
): number[] => {
  return table.model.rows.slice(1)
    .filter(row => row.slots[selectedColumnIndex]?.owned)
    .filter(row => hasSelectableCellText(table, row.index, selectedColumnIndex))
    .map(row => row.index - 1);
};

/** 创建选择列 checkbox。 */
const createSelectionCheckbox = (
  doc: Document,
  rowIndexes: number[],
  disabled: boolean
): HTMLInputElement => {
  /** 将要插入 iframe 表格的行选择框。 */
  const checkbox = doc.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute(SELECTION_CHECKBOX_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  checkbox.setAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE, JSON.stringify(rowIndexes));
  checkbox.setAttribute(SELECTION_SELECTABLE_ATTRIBUTE, String(!disabled));
  checkbox.disabled = disabled;
  if (disabled) {
    checkbox.setAttribute(DISABLED_ATTRIBUTE, DISABLED_ATTRIBUTE);
  }
  return checkbox;
};

/** 创建选择列表头单元格。 */
const createSelectionHeaderCell = (
  doc: Document,
  rowIndexes: number[]
): HTMLTableCellElement => {
  /** 容纳全选复选框的表头单元格。 */
  const cell = doc.createElement('th');
  /** 对当前列所有可选行生效的全选框。 */
  const checkbox = createSelectionCheckbox(
    doc,
    rowIndexes,
    rowIndexes.length === 0
  );
  checkbox.setAttribute(SELECTION_SELECT_ALL_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  cell.setAttribute(SELECTION_COLUMN_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  cell.appendChild(checkbox);
  return cell;
};

/** 创建选择列数据单元格。 */
const createSelectionDataCell = (
  doc: Document,
  rowIndex: number,
  rowSpan: number,
  selectable: boolean
): HTMLTableCellElement => {
  /** 排除表头后的业务数据行下标。 */
  const dataRowIndex = rowIndex - 1;
  /** 容纳单行选择框的数据单元格。 */
  const cell = doc.createElement('td');
  /** 当前逻辑行对应的选择框。 */
  const checkbox = createSelectionCheckbox(doc, [dataRowIndex], !selectable);
  cell.setAttribute(SELECTION_COLUMN_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  if (rowSpan > 1) {
    cell.setAttribute('rowspan', String(rowSpan));
  }
  cell.appendChild(checkbox);
  return cell;
};

/** 在 iframe 表格中插入当前 Comparison Column 的行选择列。 */
const applyPreviewRowSelection = (
  doc: Document,
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): void => {
  if (selectedColumnIndex === undefined) {
    return;
  }

  /** iframe 文档中需要增加选择列的顶层表格。 */
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return;
  }

  /** 当前 Comparison Column 中可选的逻辑行首行。 */
  const selectableRows = getSelectableAnchorRowIndexes(table, selectedColumnIndex);
  /** 排除嵌套表格后的顶层预览行。 */
  const previewRows = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tr'))
    .filter(row => row.closest('table') === tableElement);
  table.model.rows.forEach(row => {
    /** 当前模型行在预览 DOM 中的对应行。 */
    const previewRow = previewRows[row.index];
    if (!previewRow) {
      return;
    }
    if (row.index === 0) {
      previewRow.insertBefore(createSelectionHeaderCell(doc, selectableRows), previewRow.firstChild);
      return;
    }

    /** 当前逻辑行在 Comparison Column 中的网格槽位。 */
    const slot = row.slots[selectedColumnIndex];
    if (!slot?.owned) {
      return;
    }

    /** 当前逻辑行是否有可供校验的原始内容。 */
    const selectable = hasSelectableCellText(table, row.index, selectedColumnIndex);
    /** 与原始单元格合并范围对齐的选择单元格。 */
    const cell = createSelectionDataCell(doc, row.index, slot.cell.rowSpan, selectable);
    previewRow.insertBefore(cell, previewRow.firstChild);
  });
};

/** 隐藏非当前 Comparison Column 相关列。 */
const applyPreviewColumnVisibility = (
  doc: Document,
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): void => {
  /** 当前预览需要保留的原始列和 Test 双列下标。 */
  const visibleColumnIndexes = getVisibleColumnIndexes(table, selectedColumnIndex);
  if (!visibleColumnIndexes) {
    return;
  }

  /** iframe 文档中需要调整列可见性的顶层表格。 */
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return;
  }

  parseTableModel(tableElement).rows.forEach(row => {
    row.cells.forEach(cell => {
      /** 该单元格横跨范围内仍可见的逻辑列数。 */
      const visibleColSpan = getVisibleColSpan(cell.columnIndex, cell.colSpan, visibleColumnIndexes);
      if (visibleColSpan === 0) {
        cell.element.style.display = 'none';
        return;
      }

      if (visibleColSpan !== cell.colSpan) {
        cell.element.setAttribute('colspan', String(visibleColSpan));
      }
    });
  });
};

/** 判断 href 或 src 是否只使用预览允许的非执行型协议。 */
const isSafePreviewUrl = (attributeName: string, attributeValue: string): boolean => {
  /** 当前 URL 属性允许使用的协议集合。 */
  const allowedProtocols = attributeName === 'href'
    ? PREVIEW_ALLOWED_LINK_PROTOCOLS
    : PREVIEW_ALLOWED_RESOURCE_PROTOCOLS;
  try {
    /** 使用安全基准地址解析相对 URL 后得到的规范化协议。 */
    const protocol = new URL(attributeValue.trim(), PREVIEW_SAFE_URL_BASE).protocol.toLowerCase();
    return allowedProtocols.has(protocol);
  } catch {
    return false;
  }
};

/** 移除 preview 中不应运行的外部脚本、事件属性和非安全 URL。 */
const stripUnsafePreviewRuntime = (doc: Document): void => {
  doc.querySelectorAll('script').forEach(script => script.remove());
  doc.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      /** 用于不区分大小写安全校验的属性名。 */
      const attributeName = attribute.name.toLowerCase();
      if (PREVIEW_RESERVED_RUNTIME_ATTRIBUTES.has(attributeName)) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (attributeName.startsWith('on')) {
        element.removeAttribute(attribute.name);
      }
      if (PREVIEW_URL_ATTRIBUTE_NAMES.has(attributeName) && !isSafePreviewUrl(attributeName, attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
};

/** 为 Confluence ac:image 补充浏览器可见的 img 预览节点。 */
const applyPreviewEvidenceImages = (doc: Document, previewImageUrls: Record<string, string>): void => {
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`).forEach(element => {
    if (element.tagName.toLowerCase() === 'img') {
      return;
    }

    /** 当前 storage 图片节点的唯一实例 ID。 */
    const instanceId = getPreviewImageKey(element);
    /** 严格按图片实例 ID 获取的预览 URL。 */
    const src = previewImageUrls[instanceId] || '';
    if (!src) {
      return;
    }

    /** 替代 Confluence storage 节点的可见预览图片。 */
    const image = doc.createElement('img');
    image.setAttribute(PREVIEW_ACTION_ATTRIBUTE, 'preview');
    image.setAttribute('src', src);
    image.setAttribute('alt', element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_ID_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_ALT_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE) || '');
    element.setAttribute(PREVIEW_STORAGE_IMAGE_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    element.parentElement?.setAttribute(COPY_TEST_EVIDENCE_CARD_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    element.insertAdjacentElement('afterend', image);
  });
};

/** 判断单元格是否是 Test Evidence 列。 */
const isEvidenceColumnCell = (cell: Element): boolean => {
  return cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === COPY_TEST_GENERATED_EVIDENCE_TYPE
    || Boolean(cell.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`));
};

/** 读取 Test Evidence 列单元格集合。 */
const getEvidenceColumnCells = (doc: Document): Set<Element> => {
  /** iframe 文档中承载 Evidence 内容的顶层表格。 */
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return new Set();
  }

  /** 按 rowspan 和 colspan 展开后的预览表格模型。 */
  const model = parseTableModel(tableElement);
  /** 具有 CopyTest ownership metadata 的 Evidence 逻辑列下标。 */
  const evidenceColumnIndexes = new Set(model.headers
    .filter(header => header.generatedType === COPY_TEST_GENERATED_EVIDENCE_TYPE)
    .map(header => header.index));
  /** 所有属于 Test Evidence 列的实体单元格。 */
  const cells = model.rows.flatMap(row => row.cells
    .filter(cell => evidenceColumnIndexes.has(cell.columnIndex) || isEvidenceColumnCell(cell.element))
    .map(cell => cell.element));
  return new Set(cells);
};

/** 判断 Evidence card 是否位于 Test Evidence 列。 */
const isCardInEvidenceColumn = (card: Element, evidenceCells: Set<Element>): boolean => {
  /** Evidence card 实际所属的表格单元格。 */
  const cell = card.closest('td,th');
  return Boolean(cell && evidenceCells.has(cell));
};

/** 为 iframe 预览追加 Evidence 删除按钮。 */
const appendEvidenceDeleteButtons = (doc: Document, disabled: boolean): void => {
  /** 允许承载可删除图片的 Test Evidence 单元格。 */
  const evidenceCells = getEvidenceColumnCells(doc);
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`).forEach(card => {
    if (!isCardInEvidenceColumn(card, evidenceCells) || card.querySelector(`[${DELETE_BUTTON_ATTRIBUTE}]`)) {
      return;
    }

    /** Evidence card 内携带图片标识的 storage 节点。 */
    const image = card.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`);
    /** 图片附件的稳定 ID。 */
    const imageId = image?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
    /** 区分同一图片多次出现位置的实例 ID。 */
    const instanceId = image?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '';
    if (!imageId || !instanceId) {
      return;
    }
    /** 只作用于当前 Evidence 图片实例的删除按钮。 */
    const button = doc.createElement('button');
    button.setAttribute(DELETE_BUTTON_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    button.setAttribute(PREVIEW_ACTION_ATTRIBUTE, 'delete');
    button.setAttribute(PREVIEW_IMAGE_ID_ATTRIBUTE, imageId);
    button.setAttribute(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE, instanceId);
    button.setAttribute('type', 'button');
    if (disabled) {
      button.setAttribute(DISABLED_ATTRIBUTE, DISABLED_ATTRIBUTE);
    }
    button.setAttribute('aria-label', 'Delete evidence image');
    button.innerHTML = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M3 6h18" />',
      '<path d="M8 6V4h8v2" />',
      '<path d="M19 6l-1 14H6L5 6" />',
      '<path d="M10 11v6" />',
      '<path d="M14 11v6" />',
      '</svg>',
    ].join('');
    card.appendChild(button);
  });
};

/** 从旧 managed Result 根节点读取单分组状态。 */
const readPreviewLegacyResultPassedState = (resultRoot: Element): boolean | undefined => {
  /** 旧结构中由 Result 根节点直接拥有的状态强调文本。 */
  const status = Array.from(resultRoot.children).find(child => {
    return child.tagName.toLowerCase() === 'strong';
  });
  const statusLabel = status?.textContent?.trim();
  if (statusLabel === PASSED_RESULT_LABEL) {
    return true;
  }
  return statusLabel === FAILED_RESULT_LABEL ? false : undefined;
};

/** 读取一个 Screen 所属的新状态分组或旧根状态。 */
const readPreviewScreenPassedState = (
  screenItem: Element,
  resultRoot: Element
): boolean | undefined => {
  /** Screen 列表的直接所有者。 */
  const owner = screenItem.parentElement?.parentElement;
  if (owner === resultRoot) {
    return readPreviewLegacyResultPassedState(resultRoot);
  }
  if (owner?.parentElement !== resultRoot) {
    return undefined;
  }

  /** 新结构状态分组的持久属性值。 */
  const value = owner.getAttribute(COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE);
  if (value === COPY_TEST_RESULT_PASSED_GROUP_VALUE) {
    return true;
  }
  return value === COPY_TEST_RESULT_FAILED_GROUP_VALUE ? false : undefined;
};

/** 判断原始可见文案中的 Unicode 标点数量是否严格超过提示阈值。 */
const hasMoreThanPunctuationReviewThreshold = (sourceText: string): boolean => {
  /** 当前已识别的标点字符数量。 */
  let punctuationCount = 0;
  for (const character of sourceText) {
    if (!UNICODE_PUNCTUATION_PATTERN.test(character)) {
      continue;
    }
    punctuationCount += 1;
    if (punctuationCount > PUNCTUATION_REVIEW_THRESHOLD) {
      return true;
    }
  }
  return false;
};

/** 读取新分组或旧单状态结构中承载 Failed 信息的容器。 */
const getPreviewFailedResultContainer = (resultRoot: Element): Element | null => {
  /** 新结构中明确标记为 Failed 的直属状态分组。 */
  const failedGroup = Array.from(resultRoot.children).find(child => {
    return child.getAttribute(COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE)
      === COPY_TEST_RESULT_FAILED_GROUP_VALUE;
  });
  if (failedGroup) {
    return failedGroup;
  }
  return readPreviewLegacyResultPassedState(resultRoot) === false ? resultRoot : null;
};

/** 在 iframe 副本的 Failed 信息底部追加仅供系统预览的标点复核提示。 */
const appendPunctuationReviewWarning = (
  doc: Document,
  resultRoot: Element,
  sourceText: string
): void => {
  if (!hasMoreThanPunctuationReviewThreshold(sourceText)) {
    return;
  }

  /** 当前 Result 中真正承载 Failed 信息的预览容器。 */
  const failedContainer = getPreviewFailedResultContainer(resultRoot);
  if (
    !failedContainer
    || failedContainer.querySelector(`[${PUNCTUATION_REVIEW_WARNING_ATTRIBUTE}]`)
  ) {
    return;
  }

  /** 仅追加到 iframe 文档、不进入 workingHtml 的提示节点。 */
  const warning = doc.createElement('p');
  warning.setAttribute(PUNCTUATION_REVIEW_WARNING_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  warning.setAttribute('role', 'note');
  warning.textContent = PUNCTUATION_REVIEW_WARNING_TEXT;
  failedContainer.appendChild(warning);
};

/** 创建一个只向父页面发送明确 Screen 目标状态的蓝色链接。 */
const createResultStatusLink = (
  doc: Document,
  imageId: string,
  instanceId: string,
  rowIndex: number,
  sourceColumnKey: string,
  currentPassed: boolean,
  screenLabel: string
): HTMLAnchorElement => {
  /** 当前状态取反后得到的明确目标状态。 */
  const targetPassed = !currentPassed;
  /** 仅存在于 iframe 副本中的状态操作链接。 */
  const link = doc.createElement('a');
  link.setAttribute(RESULT_STATUS_LINK_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  link.setAttribute(PREVIEW_ACTION_ATTRIBUTE, 'set-result-status');
  link.setAttribute(RESULT_STATUS_ROW_INDEX_ATTRIBUTE, String(rowIndex));
  link.setAttribute(RESULT_STATUS_PASSED_ATTRIBUTE, String(targetPassed));
  link.setAttribute(RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE, sourceColumnKey);
  link.setAttribute(PREVIEW_IMAGE_ID_ATTRIBUTE, imageId);
  link.setAttribute(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE, instanceId);
  link.setAttribute('aria-disabled', DOM_TRUE_ATTRIBUTE_VALUE);
  link.setAttribute('href', '#');
  link.setAttribute('tabindex', '-1');
  /** 保持可见文本简洁，同时向读屏器说明链接只移动当前 Screen。 */
  const linkLabel = targetPassed
    ? MARK_AS_PASSED_LINK_LABEL
    : MARK_AS_FAILED_LINK_LABEL;
  link.setAttribute(
    'aria-label',
    `${linkLabel} for ${screenLabel}`
  );
  link.textContent = linkLabel;
  return link;
};

/** 读取 managed Result 新旧状态列表中的有效 Screen 条目。 */
const getPreviewResultScreenItems = (resultRoot: Element): HTMLLIElement[] => {
  return Array.from(
    resultRoot.querySelectorAll<HTMLLIElement>(
      `li[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
    )
  ).filter(item => {
    /** Screen 列表所有者必须是旧根节点或新状态分组。 */
    const owner = item.parentElement?.parentElement;
    return owner === resultRoot || owner?.parentElement === resultRoot;
  });
};

/** 读取 Screen 条目中位于错误信息列表之前的可见序号。 */
const readPreviewScreenLabel = (screenItem: Element): string => {
  /** Screen 条目的首个非空直属文本节点。 */
  const labelNode = Array.from(screenItem.childNodes).find(node => {
    return node.nodeType === Node.TEXT_NODE && node.textContent?.trim();
  });
  return labelNode?.textContent?.trim() || '';
};

/** 在 Screen 序号右侧、错误信息列表之前插入状态链接。 */
const appendResultStatusLinkToScreen = (
  doc: Document,
  screenItem: HTMLLIElement,
  rowIndex: number,
  sourceColumnKey: string,
  currentPassed: boolean
): void => {
  /** 当前 Screen 是否已拥有直属状态链接。 */
  const alreadyHasLink = Array.from(screenItem.children)
    .some(child => child.hasAttribute(RESULT_STATUS_LINK_ATTRIBUTE));
  if (alreadyHasLink) {
    return;
  }

  /** 当前 Screen 的可见序号，用于唯一化按钮的可访问名称。 */
  const screenLabel = readPreviewScreenLabel(screenItem);
  /** 当前 Screen 的稳定图片身份。 */
  const imageId = screenItem.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE)?.trim() || '';
  const instanceId = screenItem.getAttribute(
    COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE
  )?.trim() || '';
  if (!screenLabel || !imageId || !instanceId) {
    return;
  }

  /** Failed 状态下紧跟 Screen 序号的错误信息列表。 */
  const issueList = Array.from(screenItem.children)
    .find(child => child.tagName.toLowerCase() === 'ul');
  screenItem.insertBefore(
    createResultStatusLink(
      doc,
      imageId,
      instanceId,
      rowIndex,
      sourceColumnKey,
      currentPassed,
      screenLabel
    ),
    issueList || null
  );
};

/** 为当前 Comparison Column 的每个有效 Result 在各 Screen 序号右侧追加状态链接。 */
const appendResultStatusLinks = (
  doc: Document,
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): void => {
  if (selectedColumnIndex === undefined) {
    return;
  }

  /** 当前 Comparison Column 的稳定表头信息。 */
  const selectedHeader = table.headers.find(header => header.index === selectedColumnIndex);
  /** iframe 中尚未增加选择列的原始逻辑表格。 */
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!selectedHeader || !tableElement) {
    return;
  }

  /** 当前来源列及其生成双列共用的严格 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedHeader.label);
  /** 当前来源 Pair 对应的 Result 逻辑列下标。 */
  const resultColumnIndex = findGeneratedColumnIndexes(
    table.headers,
    sourceColumnKey
  ).result;
  if (resultColumnIndex === undefined) {
    return;
  }

  /** 按 rowspan 和 colspan 展开后的原始预览表格模型。 */
  const model = parseTableModel(tableElement);
  buildCopyTestRowGroups(table, selectedColumnIndex).forEach(group => {
    /** 当前来源原子组锚点对应的业务数据行下标。 */
    const rowIndex = group.dataRowIndexes[0];
    /** 当前 Result 列在来源锚点行直接拥有的单元格。 */
    const resultSlot = model.rows[group.anchorRowIndex]?.slots[resultColumnIndex];
    if (rowIndex === undefined || !resultSlot?.owned) {
      return;
    }

    /** Result 单元格内唯一可由 CopyTest 管理的内容根节点。 */
    const resultRoot = resultSlot.cell.element.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    );
    if (!resultRoot) {
      return;
    }

    /** 当前原始 Comparison Column 单元格在安全预览副本中的可见文案。 */
    const sourceText = model.rows[group.anchorRowIndex]
      ?.slots[selectedColumnIndex]
      ?.cell.text || '';
    getPreviewResultScreenItems(resultRoot).forEach(screenItem => {
      /** 按当前 Screen 自己所属分组读取状态。 */
      const currentPassed = readPreviewScreenPassedState(screenItem, resultRoot);
      if (currentPassed === undefined) {
        return;
      }
      appendResultStatusLinkToScreen(
        doc,
        screenItem,
        rowIndex,
        sourceColumnKey,
        currentPassed
      );
    });
    appendPunctuationReviewWarning(doc, resultRoot, sourceText);
  });
};

/** 计算行选择变更后的下标。 */

export const buildPreviewDocumentHtml = (
  table: CopyTestTableEntry,
  previewImageUrls: Record<string, string>,
  selectedColumnIndex: number | undefined
): string => {
  /** 用于安全改写预览表格的脱离 DOM 文档。 */
  const doc = document.implementation.createHTMLDocument('copy-test-preview');
  doc.body.innerHTML = table.workingHtml;
  stripUnsafePreviewRuntime(doc);
  /** 当前 Comparison Column 是否存在于当前表格。 */
  const hasSelectedComparisonColumn = selectedColumnIndex !== undefined
    && table.headers.some(header => header.index === selectedColumnIndex);
  if (hasSelectedComparisonColumn) {
    appendResultStatusLinks(doc, table, selectedColumnIndex);
  }
  applyPreviewColumnVisibility(doc, table, selectedColumnIndex);
  applyPreviewRowSelection(doc, table, selectedColumnIndex);
  applyPreviewColumnWidths(doc, table, selectedColumnIndex);
  applyPreviewEvidenceImages(doc, previewImageUrls);
  if (hasSelectedComparisonColumn) {
    appendEvidenceDeleteButtons(doc, false);
  }
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<style>${PREVIEW_DOCUMENT_STYLE}</style>`,
    '</head>',
    `<body><div class="copy-test-preview-scroll-root">${doc.body.innerHTML}</div></body>`,
    `<script>${buildPreviewRuntimeScript(table.index)}</script>`,
    '</html>',
  ].join('');
};
