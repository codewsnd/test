/**
 * 文件作用：使用 iframe 渲染 CopyTest 表格预览，并承载行选择和 Evidence 图片事件。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Empty } from 'antd';
import {
  findGeneratedColumnIndexes,
  getSourceColumnKey,
} from '../table/copyTestTableParser';
import { parseTableModel } from '../table/tableModel';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
} from '../table/tableConstants';
import type { CopyTestEvidenceDeleteTarget, CopyTestEvidencePreviewInfo, CopyTestTableEntry } from '../types';

/** 定义 CopyTestTablePreviewProps 的数据结构。 */
interface CopyTestTablePreviewProps {
  disabled?: boolean;
  onEvidenceImageDelete: (target: CopyTestEvidenceDeleteTarget) => void;
  onEvidenceImagePreview: (previewInfo: CopyTestEvidencePreviewInfo) => void;
  onSelectedRowIndexesChange: (value: number[]) => void;
  selectedColumnIndex?: number;
  selectedRowIndexes: number[];
  table?: CopyTestTableEntry;
}

/** 定义 DELETE_BUTTON_ATTRIBUTE 常量。 */
const DELETE_BUTTON_ATTRIBUTE = 'data-copy-test-evidence-delete-button';

/** iframe 预览动作属性。 */
const PREVIEW_ACTION_ATTRIBUTE = 'data-copy-test-preview-action';

/** iframe 预览图片 ID 属性。 */
const PREVIEW_IMAGE_ID_ATTRIBUTE = 'data-copy-test-preview-image-id';

/** iframe 预览图片实例 ID 属性。 */
const PREVIEW_IMAGE_INSTANCE_ATTRIBUTE = 'data-copy-test-preview-image-instance-id';

/** iframe 预览图片 src 属性。 */
const PREVIEW_IMAGE_SRC_ATTRIBUTE = 'data-copy-test-preview-image-src';

/** iframe 预览图片 alt 属性。 */
const PREVIEW_IMAGE_ALT_ATTRIBUTE = 'data-copy-test-preview-image-alt';

/** iframe 预览中隐藏原始 Confluence 图片节点的属性。 */
const PREVIEW_STORAGE_IMAGE_ATTRIBUTE = 'data-copy-test-preview-storage-image';

/** storage 图片 base64 runtime 属性。 */
const STORAGE_IMAGE_SRC_ATTRIBUTE = 'data-copy-test-storage-image-src';

/** iframe 行选择 checkbox 属性。 */
const SELECTION_CHECKBOX_ATTRIBUTE = 'data-copy-test-selection-checkbox';

/** iframe 行选择 checkbox 对应行属性。 */
const SELECTION_ROW_INDEXES_ATTRIBUTE = 'data-copy-test-selection-row-indexes';

/** iframe 行选择列属性。 */
const SELECTION_COLUMN_ATTRIBUTE = 'data-copy-test-selection-column';

/** iframe 行选择全选属性。 */
const SELECTION_SELECT_ALL_ATTRIBUTE = 'data-copy-test-selection-all';

/** iframe postMessage 来源类型。 */
const PREVIEW_MESSAGE_TYPE = 'copy-test-preview-message';

/** DOM 布尔属性写入时使用的统一字符串值。 */
const DOM_TRUE_ATTRIBUTE_VALUE = 'true';

/** DOM disabled 属性名称，供 checkbox 和删除按钮共用。 */
const DISABLED_ATTRIBUTE = 'disabled';

/** iframe 预览里目标 table 的选择器。 */
const PREVIEW_TABLE_SELECTOR = 'table';

/** 定义 PREVIEW_DOCUMENT_STYLE 常量。 */
const PREVIEW_DOCUMENT_STYLE = `
  html,
  body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    color: #172b4d;
    font-family: Arial, sans-serif;
    font-size: 14px;
  }

  body {
    box-sizing: border-box;
  }

  .copy-test-preview-scroll-root {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: scroll;
    padding: 0;
    scrollbar-color: #6b7280 #e5e7eb;
    scrollbar-gutter: stable both-edges;
    scrollbar-width: auto;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-track {
    background: #e5e7eb;
    border-radius: 8px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-thumb {
    background: #6b7280;
    border: 3px solid #e5e7eb;
    border-radius: 8px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-thumb:hover {
    background: #4b5563;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }

  th,
  td {
    border: 1px solid #c1c7d0;
    max-width: 360px;
    padding: 7px 10px;
    vertical-align: top;
    white-space: pre-wrap;
    word-break: break-word;
  }

  th {
    background: #f4f5f7;
    font-weight: 600;
  }

  [${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}] {
    display: inline-flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    width: 120px;
    max-width: 100%;
    margin: 0 16px 12px 0;
    position: relative;
    vertical-align: top;
  }

  [${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"] {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
  }

  [${DELETE_BUTTON_ATTRIBUTE}] {
    position: absolute;
    right: 0;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #de350b;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    box-shadow: 0 1px 4px rgba(9, 30, 66, 0.2);
  }

  [${DELETE_BUTTON_ATTRIBUTE}] svg {
    width: 15px;
    height: 15px;
    pointer-events: none;
  }

  [${DELETE_BUTTON_ATTRIBUTE}][disabled] {
    cursor: not-allowed;
    opacity: 0.45;
  }

  ac\\:image,
  ac-image {
    display: none !important;
  }

  [${PREVIEW_STORAGE_IMAGE_ATTRIBUTE}] {
    display: none !important;
  }

  [${PREVIEW_ACTION_ATTRIBUTE}="preview"] {
    cursor: zoom-in;
    display: block;
    width: 120px;
    height: 180px;
    object-fit: contain;
  }

  [${SELECTION_COLUMN_ATTRIBUTE}] {
    box-sizing: border-box;
    width: 42px;
    min-width: 42px;
    max-width: 42px;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }

  [${SELECTION_CHECKBOX_ATTRIBUTE}] {
    accent-color: #172b4d;
    cursor: pointer;
    height: 16px;
    margin: 0;
    width: 16px;
  }

  [${SELECTION_CHECKBOX_ATTRIBUTE}][disabled] {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;

/** iframe 发给父页面的消息。 */
type PreviewFrameMessage =
  | {
    action: 'preview';
    alt: string;
    imageId: string;
    src: string;
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'delete';
    imageId: string;
    instanceId?: string;
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'selection';
    checked: boolean;
    rowIndexes: number[];
    type: typeof PREVIEW_MESSAGE_TYPE;
  };

/** iframe 图片预览 URL 缓存。 */
interface PreviewImageUrlBundle {
  urls: string[];
  urlsByKey: Record<string, string>;
}

/** 表格横向滚动条尺寸信息。 */
interface HorizontalScrollMetrics {
  contentWidth: number;
  scrollLeft: number;
  visible: boolean;
  viewportWidth: number;
}

/** 判断 iframe message 是否来自 CopyTest 预览。 */
const isPreviewFrameMessage = (data: unknown): data is PreviewFrameMessage => {
  return typeof data === 'object'
    && data !== null
    && (data as { type?: unknown }).type === PREVIEW_MESSAGE_TYPE;
};

/** 计算 iframe 预览中应该显示的列。 */
const getVisibleColumnIndexes = (
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): Set<number> | null => {
  if (selectedColumnIndex === undefined) {
    return null;
  }

  const selectedHeader = table.headers.find(header => header.index === selectedColumnIndex);
  if (!selectedHeader) {
    return null;
  }

  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedHeader.label);
  const generatedIndexes = findGeneratedColumnIndexes(table.headers, sourceColumnKey, selectedHeader.label);
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

/** 从 data url 创建 blob url。 */
const createObjectUrlFromDataUrl = (dataUrl: string): string | null => {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const binary = window.atob(match[2]);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: match[1] }));
};

/** 生成图片 URL key。 */
const getPreviewImageKey = (element: Element, index: number): string => {
  return element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)
    || element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE)
    || String(index);
};

/** 为 iframe 预览生成轻量图片 URL，避免 base64 进入 srcdoc。 */
const createPreviewImageUrlBundle = (tableHtml: string): PreviewImageUrlBundle => {
  const doc = document.implementation.createHTMLDocument('copy-test-preview-images');
  const urls: string[] = [];
  const urlsByKey: Record<string, string> = {};
  doc.body.innerHTML = tableHtml;
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE}]`).forEach((element, index) => {
    const objectUrl = createObjectUrlFromDataUrl(element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE) || '');
    if (!objectUrl) {
      return;
    }

    urls.push(objectUrl);
    urlsByKey[getPreviewImageKey(element, index)] = objectUrl;
  });
  return { urls, urlsByKey };
};

/** 读取当前列单元格是否有可校验内容。 */
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
  checked: boolean,
  disabled: boolean
): HTMLInputElement => {
  const checkbox = doc.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute(SELECTION_CHECKBOX_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
  checkbox.setAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE, JSON.stringify(rowIndexes));
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  if (checked) {
    checkbox.setAttribute('checked', 'checked');
  }
  if (disabled) {
    checkbox.setAttribute(DISABLED_ATTRIBUTE, DISABLED_ATTRIBUTE);
  }
  return checkbox;
};

/** 创建选择列表头单元格。 */
const createSelectionHeaderCell = (
  doc: Document,
  rowIndexes: number[],
  selectedRowIndexes: Set<number>
): HTMLTableCellElement => {
  const cell = doc.createElement('th');
  const selectedCount = rowIndexes.filter(rowIndex => selectedRowIndexes.has(rowIndex)).length;
  const checkbox = createSelectionCheckbox(
    doc,
    rowIndexes,
    rowIndexes.length > 0 && selectedCount === rowIndexes.length,
    rowIndexes.length === 0
  );
  checkbox.indeterminate = selectedCount > 0 && selectedCount < rowIndexes.length;
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
  selectedRowIndexes: Set<number>,
  selectable: boolean
): HTMLTableCellElement => {
  const dataRowIndex = rowIndex - 1;
  const cell = doc.createElement('td');
  const checkbox = createSelectionCheckbox(doc, [dataRowIndex], selectedRowIndexes.has(dataRowIndex), !selectable);
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
  selectedRowIndexes: number[],
  selectedColumnIndex?: number
): void => {
  if (selectedColumnIndex === undefined) {
    return;
  }

  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return;
  }

  const selectedRows = new Set(selectedRowIndexes);
  const selectableRows = getSelectableAnchorRowIndexes(table, selectedColumnIndex);
  const model = parseTableModel(tableElement);
  model.rows.forEach(row => {
    if (row.index === 0) {
      row.element.insertBefore(createSelectionHeaderCell(doc, selectableRows, selectedRows), row.element.firstChild);
      return;
    }

    const slot = row.slots[selectedColumnIndex];
    if (!slot?.owned) {
      return;
    }

    const selectable = hasSelectableCellText(table, row.index, selectedColumnIndex);
    const cell = createSelectionDataCell(doc, row.index, slot.cell.rowSpan, selectedRows, selectable);
    row.element.insertBefore(cell, row.element.firstChild);
  });
};

/** 隐藏非当前 Comparison Column 相关列。 */
const applyPreviewColumnVisibility = (
  doc: Document,
  table: CopyTestTableEntry,
  selectedColumnIndex?: number
): void => {
  const visibleColumnIndexes = getVisibleColumnIndexes(table, selectedColumnIndex);
  if (!visibleColumnIndexes) {
    return;
  }

  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return;
  }

  parseTableModel(tableElement).rows.forEach(row => {
    row.cells.forEach(cell => {
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

/** 移除 preview 中不应运行的外部脚本和事件属性。 */
const stripUnsafePreviewRuntime = (doc: Document): void => {
  doc.querySelectorAll('script').forEach(script => script.remove());
  doc.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      const attributeName = attribute.name.toLowerCase();
      if (attributeName.startsWith('on')) {
        element.removeAttribute(attribute.name);
      }
      if ((attributeName === 'href' || attributeName === 'src') && attribute.value.trim().toLowerCase().startsWith('javascript:')) {
        element.removeAttribute(attribute.name);
      }
    });
  });
};

/** 为 Confluence ac:image 补充浏览器可见的 img 预览节点。 */
const applyPreviewEvidenceImages = (doc: Document, previewImageUrls: Record<string, string>): void => {
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE}]`).forEach((element, index) => {
    if (element.tagName.toLowerCase() === 'img') {
      return;
    }

    const src = previewImageUrls[getPreviewImageKey(element, index)]
      || element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE)
      || '';
    if (!src) {
      return;
    }

    const image = doc.createElement('img');
    image.setAttribute(PREVIEW_ACTION_ATTRIBUTE, 'preview');
    image.setAttribute('src', src);
    image.setAttribute('alt', element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_ID_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '');
    image.setAttribute(PREVIEW_IMAGE_ALT_ATTRIBUTE, element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE) || '');
    element.setAttribute(PREVIEW_STORAGE_IMAGE_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    element.parentElement?.setAttribute(COPY_TEST_EVIDENCE_CARD_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    element.removeAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE);
    element.removeAttribute(STORAGE_IMAGE_SRC_ATTRIBUTE);
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
  const tableElement = doc.querySelector<HTMLTableElement>(PREVIEW_TABLE_SELECTOR);
  if (!tableElement) {
    return new Set();
  }

  const model = parseTableModel(tableElement);
  const evidenceColumnIndexes = new Set(model.headers
    .filter(header => header.generatedType === COPY_TEST_GENERATED_EVIDENCE_TYPE
      || header.label.startsWith(COPY_TEST_EVIDENCE_HEADER_PREFIX))
    .map(header => header.index));
  const cells = model.rows.flatMap(row => row.cells
    .filter(cell => evidenceColumnIndexes.has(cell.columnIndex) || isEvidenceColumnCell(cell.element))
    .map(cell => cell.element));
  return new Set(cells);
};

/** 判断 Evidence card 是否位于 Test Evidence 列。 */
const isCardInEvidenceColumn = (card: Element, evidenceCells: Set<Element>): boolean => {
  const cell = card.closest('td,th');
  return Boolean(cell && evidenceCells.has(cell));
};

/** 为 iframe 预览追加 Evidence 删除按钮。 */
const appendEvidenceDeleteButtons = (doc: Document, disabled: boolean): void => {
  const evidenceCells = getEvidenceColumnCells(doc);
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`).forEach(card => {
    if (!isCardInEvidenceColumn(card, evidenceCells) || card.querySelector(`[${DELETE_BUTTON_ATTRIBUTE}]`)) {
      return;
    }

    const image = card.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`);
    const button = doc.createElement('button');
    button.setAttribute(DELETE_BUTTON_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    button.setAttribute(PREVIEW_ACTION_ATTRIBUTE, 'delete');
    button.setAttribute(PREVIEW_IMAGE_ID_ATTRIBUTE, image?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '');
    button.setAttribute(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE, image?.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '');
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

/** 计算行选择变更后的下标。 */
const updateSelectedRowIndexes = (
  currentRowIndexes: number[],
  changedRowIndexes: number[],
  checked: boolean
): number[] => {
  const nextRows = new Set(currentRowIndexes);
  changedRowIndexes.forEach(rowIndex => {
    if (checked) {
      nextRows.add(rowIndex);
      return;
    }
    nextRows.delete(rowIndex);
  });
  return Array.from(nextRows).sort((left, right) => left - right);
};

/** 构建 iframe runtime 脚本。 */
const buildPreviewRuntimeScript = (): string => {
  return `
    (() => {
      const messageType = ${JSON.stringify(PREVIEW_MESSAGE_TYPE)};
      const actionAttribute = ${JSON.stringify(PREVIEW_ACTION_ATTRIBUTE)};
      const imageIdAttribute = ${JSON.stringify(PREVIEW_IMAGE_ID_ATTRIBUTE)};
      const imageInstanceAttribute = ${JSON.stringify(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE)};
      const imageSrcAttribute = ${JSON.stringify(PREVIEW_IMAGE_SRC_ATTRIBUTE)};
      const imageAltAttribute = ${JSON.stringify(PREVIEW_IMAGE_ALT_ATTRIBUTE)};
      const selectionCheckboxAttribute = ${JSON.stringify(SELECTION_CHECKBOX_ATTRIBUTE)};
      const selectionRowsAttribute = ${JSON.stringify(SELECTION_ROW_INDEXES_ATTRIBUTE)};
      const post = payload => window.parent.postMessage({ type: messageType, ...payload }, '*');
      const readImagePayload = element => ({
        imageId: element.getAttribute(imageIdAttribute) || '',
        instanceId: element.getAttribute(imageInstanceAttribute) || undefined,
        src: element.getAttribute(imageSrcAttribute) || element.getAttribute('src') || '',
        alt: element.getAttribute(imageAltAttribute) || '',
      });
      const readSelectionRows = element => {
        try {
          const value = JSON.parse(element.getAttribute(selectionRowsAttribute) || '[]');
          return Array.isArray(value) ? value.filter(Number.isFinite) : [];
        } catch (error) {
          return [];
        }
      };
      document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const actionElement = target?.closest('[' + actionAttribute + ']');
        if (!actionElement) {
          return;
        }
        event.preventDefault();
        const payload = readImagePayload(actionElement);
        if (actionElement.getAttribute(actionAttribute) === 'delete' && payload.imageId) {
          post({ action: 'delete', imageId: payload.imageId, instanceId: payload.instanceId });
        }
        if (actionElement.getAttribute(actionAttribute) === 'preview' && payload.imageId && payload.src) {
          post({ action: 'preview', imageId: payload.imageId, src: payload.src, alt: payload.alt });
        }
      });
      document.addEventListener('change', event => {
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target?.hasAttribute(selectionCheckboxAttribute)) {
          return;
        }
        post({ action: 'selection', checked: target.checked, rowIndexes: readSelectionRows(target) });
      });
    })();
  `;
};

/** 构建 iframe 的完整 HTML 文档。 */
const buildPreviewDocumentHtml = (
  table: CopyTestTableEntry,
  disabled: boolean,
  previewImageUrls: Record<string, string>,
  selectedRowIndexes: number[],
  selectedColumnIndex?: number
): string => {
  const doc = document.implementation.createHTMLDocument('copy-test-preview');
  doc.body.innerHTML = table.workingHtml;
  stripUnsafePreviewRuntime(doc);
  applyPreviewColumnVisibility(doc, table, selectedColumnIndex);
  applyPreviewRowSelection(doc, table, selectedRowIndexes, selectedColumnIndex);
  applyPreviewEvidenceImages(doc, previewImageUrls);
  appendEvidenceDeleteButtons(doc, disabled);
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<style>${PREVIEW_DOCUMENT_STYLE}</style>`,
    '</head>',
    `<body><div class="copy-test-preview-scroll-root">${doc.body.innerHTML}</div></body>`,
    `<script>${buildPreviewRuntimeScript()}</script>`,
    '</html>',
  ].join('');
};

/** 读取 iframe 内部表格滚动容器。 */
const getFrameScrollRoot = (iframe: HTMLIFrameElement | null): HTMLElement | null => {
  return iframe?.contentDocument?.querySelector<HTMLElement>('.copy-test-preview-scroll-root') || null;
};

/** 读取 iframe 内部表格实际宽度。 */
const getFrameTableScrollWidth = (iframe: HTMLIFrameElement | null): number => {
  const doc = iframe?.contentDocument;
  const scrollRoot = getFrameScrollRoot(iframe);
  const tableElement = doc?.querySelector<HTMLElement>(PREVIEW_TABLE_SELECTOR);
  return Math.max(scrollRoot?.scrollWidth || 0, tableElement?.scrollWidth || 0);
};

/** 限制数值范围。 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/** 渲染 iframe 表格预览组件。 */
export const TablePreview: React.FC<CopyTestTablePreviewProps> = ({
  disabled = false,
  onEvidenceImageDelete,
  onEvidenceImagePreview,
  onSelectedRowIndexesChange,
  selectedColumnIndex,
  selectedRowIndexes,
  table,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  const horizontalThumbRef = useRef<HTMLDivElement>(null);
  const horizontalDragStartRef = useRef({ clientX: 0, scrollLeft: 0 });
  const frameScrollCleanupRef = useRef<() => void>(() => {});
  const [draggingHorizontalScrollbar, setDraggingHorizontalScrollbar] = useState(false);
  const [horizontalScrollMetrics, setHorizontalScrollMetrics] = useState<HorizontalScrollMetrics>({
    contentWidth: 0,
    scrollLeft: 0,
    visible: false,
    viewportWidth: 0,
  });

  const previewImageUrlBundle = useMemo(
    () => createPreviewImageUrlBundle(table?.workingHtml || ''),
    [table?.workingHtml]
  );

  useEffect(() => {
    return () => {
      previewImageUrlBundle.urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewImageUrlBundle]);

  const previewHtml = useMemo(
    () => table
      ? buildPreviewDocumentHtml(
        table,
        disabled,
        previewImageUrlBundle.urlsByKey,
        selectedRowIndexes,
        selectedColumnIndex
      )
      : '',
    [disabled, previewImageUrlBundle, selectedColumnIndex, selectedRowIndexes, table]
  );

  /** 同步固定横向滚动条尺寸。 */
  const updateHorizontalScrollMetrics = useCallback((): void => {
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    if (!scrollRoot) {
      setHorizontalScrollMetrics({
        contentWidth: 0,
        scrollLeft: 0,
        visible: false,
        viewportWidth: 0,
      });
      return;
    }

    const contentWidth = getFrameTableScrollWidth(iframeRef.current);
    const viewportWidth = scrollRoot.clientWidth;
    const visible = contentWidth > viewportWidth + 1;
    setHorizontalScrollMetrics({
      contentWidth,
      scrollLeft: scrollRoot.scrollLeft,
      visible,
      viewportWidth,
    });
  }, []);

  /** 同步 iframe 表格和固定底部横向滚动条。 */
  const bindFrameScrollSync = useCallback((): (() => void) => {
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    if (!scrollRoot) {
      return () => {};
    }

    const handleFrameScroll = (): void => {
      setHorizontalScrollMetrics(previous => ({
        ...previous,
        scrollLeft: scrollRoot.scrollLeft,
      }));
    };
    scrollRoot.addEventListener('scroll', handleFrameScroll);
    return () => {
      scrollRoot.removeEventListener('scroll', handleFrameScroll);
    };
  }, []);

  /** iframe 加载后同步滚动条。 */
  const handleFrameLoad = useCallback((): void => {
    const syncScrollbar = (): void => {
      frameScrollCleanupRef.current();
      updateHorizontalScrollMetrics();
      frameScrollCleanupRef.current = bindFrameScrollSync();
    };
    syncScrollbar();
    window.requestAnimationFrame(syncScrollbar);
    window.setTimeout(syncScrollbar, 120);
  }, [bindFrameScrollSync, updateHorizontalScrollMetrics]);

  /** 处理固定底部滚动条滑块按下。 */
  const handleHorizontalThumbMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    horizontalDragStartRef.current = {
      clientX: event.clientX,
      scrollLeft: scrollRoot?.scrollLeft || 0,
    };
    setDraggingHorizontalScrollbar(true);
  }, []);

  /** 横向滚动条滑块宽度百分比。 */
  const horizontalThumbWidthPercent = horizontalScrollMetrics.visible
    ? Math.max(5, Math.min(100, (horizontalScrollMetrics.viewportWidth / horizontalScrollMetrics.contentWidth) * 100))
    : 100;

  /** 横向滚动条滑块位置百分比。 */
  const horizontalThumbLeftPercent = horizontalScrollMetrics.visible
    ? (horizontalScrollMetrics.scrollLeft / Math.max(1, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth))
      * (100 - horizontalThumbWidthPercent)
    : 0;

  useEffect(() => {
    if (!draggingHorizontalScrollbar) {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent): void => {
      const scrollRoot = getFrameScrollRoot(iframeRef.current);
      const track = horizontalTrackRef.current;
      const thumb = horizontalThumbRef.current;
      if (!scrollRoot || !track || !thumb) {
        return;
      }

      const maxScrollLeft = Math.max(0, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth);
      const maxThumbTravel = Math.max(1, track.clientWidth - thumb.offsetWidth);
      const deltaX = event.clientX - horizontalDragStartRef.current.clientX;
      const nextScrollLeft = horizontalDragStartRef.current.scrollLeft + (deltaX / maxThumbTravel) * maxScrollLeft;
      scrollRoot.scrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft);
      setHorizontalScrollMetrics(previous => ({
        ...previous,
        scrollLeft: scrollRoot.scrollLeft,
      }));
    };
    const handleMouseUp = (): void => {
      setDraggingHorizontalScrollbar(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingHorizontalScrollbar,
    horizontalScrollMetrics.contentWidth,
    horizontalScrollMetrics.viewportWidth,
  ]);

  useEffect(() => {
    updateHorizontalScrollMetrics();
  }, [previewHtml, updateHorizontalScrollMetrics]);

  useEffect(() => {
    window.addEventListener('resize', updateHorizontalScrollMetrics);
    return () => {
      window.removeEventListener('resize', updateHorizontalScrollMetrics);
    };
  }, [updateHorizontalScrollMetrics]);

  useEffect(() => {
    return () => {
      frameScrollCleanupRef.current();
      frameScrollCleanupRef.current = () => {};
    };
  }, [previewHtml]);

  useEffect(() => {
    const handleFrameMessage = (event: MessageEvent): void => {
      if (!isPreviewFrameMessage(event.data)) {
        return;
      }

      if (event.data.action === 'preview') {
        onEvidenceImagePreview({
          alt: event.data.alt,
          imageId: event.data.imageId,
          src: event.data.src,
        });
        return;
      }

      if (event.data.action === 'selection') {
        onSelectedRowIndexesChange(updateSelectedRowIndexes(
          selectedRowIndexes,
          event.data.rowIndexes,
          event.data.checked
        ));
        return;
      }

      onEvidenceImageDelete({
        imageId: event.data.imageId,
        instanceId: event.data.instanceId,
      });
    };

    window.addEventListener('message', handleFrameMessage);
    return () => {
      window.removeEventListener('message', handleFrameMessage);
    };
  }, [onEvidenceImageDelete, onEvidenceImagePreview, onSelectedRowIndexesChange, selectedRowIndexes]);

  if (!table) {
    return <Empty description="No table selected" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <style>
        {`
          .copy-test-fixed-horizontal-scrollbar {
            background: #f1f3f5;
            border-radius: 6px;
            height: 12px;
            margin-top: 3px;
            position: relative;
            user-select: none;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb {
            background: #9aa0a6;
            border-radius: 6px;
            bottom: 2px;
            cursor: grab;
            min-width: 48px;
            position: absolute;
            top: 2px;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb.is-dragging {
            cursor: grabbing;
          }

          .copy-test-fixed-horizontal-scrollbar-thumb:hover {
            background: #7d848c;
          }
        `}
      </style>
      <iframe
        ref={iframeRef}
        className="min-h-0 flex-1 w-full border-0"
        data-testid="copy-test-table-preview-iframe"
        onLoad={handleFrameLoad}
        srcDoc={previewHtml}
        title="CopyTest table preview"
      />
      <div
        ref={horizontalTrackRef}
        aria-label="Horizontal table scroll"
        aria-valuemax={Math.max(0, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth)}
        aria-valuemin={0}
        aria-valuenow={horizontalScrollMetrics.scrollLeft}
        className={`copy-test-fixed-horizontal-scrollbar shrink-0 ${
          horizontalScrollMetrics.visible ? 'block' : 'hidden'
        }`}
        role="scrollbar"
      >
        <div
          ref={horizontalThumbRef}
          className={`copy-test-fixed-horizontal-scrollbar-thumb ${
            draggingHorizontalScrollbar ? 'is-dragging' : ''
          }`}
          onMouseDown={handleHorizontalThumbMouseDown}
          style={{
            left: `${horizontalThumbLeftPercent}%`,
            width: `${horizontalThumbWidthPercent}%`,
          }}
        />
      </div>
    </div>
  );
};

export default TablePreview;
