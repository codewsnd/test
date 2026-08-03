/**
 * 文件作用：使用 iframe 渲染 CopyTest 表格预览，并承载行选择和 Evidence 图片事件。
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Empty } from 'antd';
import type { CopyTestImage } from '../api/copyTestApi';
import {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../constants';
export {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../constants';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
} from '../table/copyTestTableParser';
import { parseTableModel } from '../table/tableModel';
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
} from '../table/tableConstants';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestEvidencePreviewInfo,
  CopyTestResultStatusUpdate,
  CopyTestTableEntry,
} from '../types';
import { getCopyTestImageId } from '../table/copyTestImageUtils';

/** iframe 表格预览的数据、交互状态与回调。 */
interface CopyTestTablePreviewProps {
  /** 是否禁止行选择、Evidence 删除和 Result 状态操作。 */
  disabled?: boolean;
  /** 用于将 storage 图片映射为本地预览 URL 的内存图片。 */
  images?: CopyTestImage[];
  /** 用户删除某个 Evidence 图片实例时的回调。 */
  onEvidenceImageDelete: (target: CopyTestEvidenceDeleteTarget) => void;
  /** 用户打开 Evidence 大图预览时的回调。 */
  onEvidenceImagePreview: (previewInfo: CopyTestEvidencePreviewInfo) => void;
  /** 用户人工移动单个 Result Screen 状态时的回调。 */
  onResultStatusChange: (update: CopyTestResultStatusUpdate) => void;
  /** 已选逻辑行下标变更时的回调。 */
  onSelectedRowIndexesChange: (value: number[]) => void;
  /** 当前 working table 内容版本，用于拒绝旧 iframe 的延迟状态消息。 */
  previewRevision: number;
  /** 是否仅禁止 Result 状态链接，不影响选择和 Evidence 操作。 */
  resultStatusDisabled?: boolean;
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex?: number;
  /** 当前已选中的数据行下标。 */
  selectedRowIndexes: number[];
  /** 需要预览的当前工作表格。 */
  table?: CopyTestTableEntry;
}

/** Evidence 删除按钮的 DOM 标记属性。 */
const DELETE_BUTTON_ATTRIBUTE = 'data-copy-test-evidence-delete-button';

/** 旧版 Result 状态按钮属性，仅用于清理导入 storage 中的历史运行时标记。 */
const LEGACY_RESULT_STATUS_BUTTON_ATTRIBUTE = 'data-copy-test-result-status-button';

/** Result 状态切换链接的 DOM 标记属性。 */
const RESULT_STATUS_LINK_ATTRIBUTE = 'data-copy-test-result-status-link';

/** Result 状态链接对应的业务数据行下标属性。 */
const RESULT_STATUS_ROW_INDEX_ATTRIBUTE = 'data-copy-test-result-status-row-index';

/** Result 状态链接对应的明确目标状态属性。 */
const RESULT_STATUS_PASSED_ATTRIBUTE = 'data-copy-test-result-status-passed';

/** Result 状态链接所属来源列键属性。 */
const RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE =
  'data-copy-test-result-status-source-column-key';

/** Result 当前状态使用的固定可见文本。 */
const PASSED_RESULT_LABEL = 'Passed:';

/** Result 当前失败状态使用的固定可见文本。 */
const FAILED_RESULT_LABEL = 'Failed:';

/** Passed Result 对应的人工切换链接文本。 */
const MARK_AS_FAILED_LINK_LABEL = 'Mark as Failed';

/** Failed Result 对应的人工切换链接文本。 */
const MARK_AS_PASSED_LINK_LABEL = 'Mark as Passed';

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

/** iframe 行选择 checkbox 属性。 */
const SELECTION_CHECKBOX_ATTRIBUTE = 'data-copy-test-selection-checkbox';

/** iframe 行选择 checkbox 对应行属性。 */
const SELECTION_ROW_INDEXES_ATTRIBUTE = 'data-copy-test-selection-row-indexes';

/** iframe 行选择列属性。 */
const SELECTION_COLUMN_ATTRIBUTE = 'data-copy-test-selection-column';

/** iframe 行选择全选属性。 */
const SELECTION_SELECT_ALL_ATTRIBUTE = 'data-copy-test-selection-all';

/** iframe checkbox 是否原本可选择。 */
const SELECTION_SELECTABLE_ATTRIBUTE = 'data-copy-test-selection-selectable';

/** iframe postMessage 来源类型。 */
const PREVIEW_MESSAGE_TYPE = 'copy-test-preview-message';

/** 父页面增量同步到 iframe 的状态消息类型。 */
const PREVIEW_STATE_MESSAGE_TYPE = 'copy-test-preview-state';

/** iframe 文档当前 working table 版本属性。 */
const PREVIEW_REVISION_ATTRIBUTE = 'data-copy-test-preview-revision';

/** DOM 布尔属性写入时使用的统一字符串值。 */
const DOM_TRUE_ATTRIBUTE_VALUE = 'true';

/** DOM disabled 属性名称，供 checkbox 和删除按钮共用。 */
const DISABLED_ATTRIBUTE = 'disabled';

/** 导入 storage 不得预置、只能由当前 iframe 构建流程生成的内部交互属性。 */
const PREVIEW_RESERVED_RUNTIME_ATTRIBUTES: ReadonlySet<string> = new Set([
  DELETE_BUTTON_ATTRIBUTE,
  PREVIEW_ACTION_ATTRIBUTE,
  PREVIEW_IMAGE_ALT_ATTRIBUTE,
  PREVIEW_IMAGE_ID_ATTRIBUTE,
  PREVIEW_IMAGE_INSTANCE_ATTRIBUTE,
  PREVIEW_IMAGE_SRC_ATTRIBUTE,
  PREVIEW_STORAGE_IMAGE_ATTRIBUTE,
  LEGACY_RESULT_STATUS_BUTTON_ATTRIBUTE,
  RESULT_STATUS_LINK_ATTRIBUTE,
  RESULT_STATUS_PASSED_ATTRIBUTE,
  RESULT_STATUS_ROW_INDEX_ATTRIBUTE,
  RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_COLUMN_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECTABLE_ATTRIBUTE,
  SELECTION_SELECT_ALL_ATTRIBUTE,
]);

/** iframe 预览里目标 table 的选择器。 */
const PREVIEW_TABLE_SELECTOR = 'table';

/** 解析相对预览 URL 时使用的固定安全基准地址。 */
const PREVIEW_SAFE_URL_BASE = 'https://copy-test.invalid/';

/** href 与 src 均允许使用的普通 Web 协议。 */
const PREVIEW_WEB_PROTOCOLS = ['http:', 'https:'] as const;

/** href 允许使用的非执行型协议集合。 */
const PREVIEW_ALLOWED_LINK_PROTOCOLS: ReadonlySet<string> = new Set([
  ...PREVIEW_WEB_PROTOCOLS,
  'mailto:',
  'tel:',
]);

/** src 允许使用的非执行型协议集合。 */
const PREVIEW_ALLOWED_RESOURCE_PROTOCOLS: ReadonlySet<string> = new Set(PREVIEW_WEB_PROTOCOLS);

/** 需要执行协议白名单校验的 URL 属性名。 */
const PREVIEW_URL_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set(['href', 'src']);

/** 标记预览表已应用固定 Header 列宽的属性。 */
const PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-fixed-width-table';

/** 标记预览表正使用三列等分布局的属性。 */
const PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-equal-width-table';

/** 标记预览 col 元素所属列类型的属性。 */
const PREVIEW_COLUMN_ROLE_ATTRIBUTE = 'data-copy-test-preview-column-role';

/** 普通 Header 列的预览角色。 */
const PREVIEW_HEADER_COLUMN_ROLE = 'header';

/** 行选择列的预览角色。 */
const PREVIEW_SELECTION_COLUMN_ROLE = 'selection';

/** iframe 行选择列固定占用的像素宽度。 */
const PREVIEW_SELECTION_COLUMN_WIDTH = 42;

/** 选中 Comparison Column 后三个业务列共同使用的响应式宽度。 */
const PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH = `calc((100% - ${PREVIEW_SELECTION_COLUMN_WIDTH}px) / 3)`;

/** 注入 iframe 文档的表格、选择框和 Evidence 样式。 */
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

  table[${PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"] {
    table-layout: fixed !important;
  }

  table[${PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"] {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_HEADER_COLUMN_ROLE}"] {
    width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"] {
    width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"] {
    width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"] {
    width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
    min-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
    max-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
  }

  table[${PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"]
    > colgroup > col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}]:not([${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"]) {
    width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    min-width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    max-width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
  }

  th,
  td {
    box-sizing: border-box;
    border: 1px solid #c1c7d0;
    max-width: none;
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

  [${RESULT_STATUS_LINK_ATTRIBUTE}] {
    margin-left: 8px;
    color: #0052cc;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: opacity 120ms ease;
    white-space: nowrap;
  }

  li[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]:hover > [${RESULT_STATUS_LINK_ATTRIBUTE}],
  li[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]:focus-within > [${RESULT_STATUS_LINK_ATTRIBUTE}] {
    opacity: 1;
    pointer-events: auto;
  }

  [${RESULT_STATUS_LINK_ATTRIBUTE}]:hover:not([aria-disabled="true"]),
  [${RESULT_STATUS_LINK_ATTRIBUTE}]:focus-visible:not([aria-disabled="true"]) {
    color: #0747a6;
  }

  [${RESULT_STATUS_LINK_ATTRIBUTE}][aria-disabled="true"] {
    color: #6b778c;
    cursor: not-allowed;
    text-decoration: none;
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
    width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
    min-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
    max-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
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
    instanceId: string;
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'selection';
    checked: boolean;
    rowIndexes: number[];
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'set-result-status';
    imageId: string;
    instanceId: string;
    passed: boolean;
    previewRevision: number;
    rowIndex: number;
    sourceColumnKey: string;
    tableIndex: number;
    type: typeof PREVIEW_MESSAGE_TYPE;
  };

/** iframe 图片预览 URL 缓存。 */
interface PreviewImageUrlBundle {
  /** 组件卸载或缓存更新时需要释放的 Blob URL。 */
  urls: string[];
  /** 按稳定图片 ID 索引的预览 URL。 */
  urlsByImageId: Record<string, string>;
}

/** 未提供内存图片时复用稳定空数组，避免无关重渲染重建 URL。 */
const EMPTY_PREVIEW_IMAGES: CopyTestImage[] = [];

/** 表格横向滚动条尺寸信息。 */
interface HorizontalScrollMetrics {
  /** iframe 表格的实际可滚动宽度。 */
  contentWidth: number;
  /** iframe 滚动容器当前的横向偏移。 */
  scrollLeft: number;
  /** 表格是否溢出并需要展示固定滚动条。 */
  visible: boolean;
  /** iframe 滚动容器的可见宽度。 */
  viewportWidth: number;
}

/** 固定横向滚动条一次拖拽的起点信息。 */
interface HorizontalDragStart {
  /** 按下滑块时指针的水平坐标。 */
  clientX: number;
  /** 当前表格可滚动的最大水平偏移。 */
  maxScrollLeft: number;
  /** 滑块在轨道内可移动的最大像素距离。 */
  maxThumbTravel: number;
  /** 按下滑块时 iframe 的水平滚动偏移。 */
  scrollLeft: number;
}

/** 判断 iframe message 是否来自 CopyTest 预览。 */
const isSelectionFrameMessage = (message: Record<string, unknown>): boolean => {
  return typeof message.checked === 'boolean'
    && Array.isArray(message.rowIndexes)
    && message.rowIndexes.every(Number.isFinite);
};

/** 判断 iframe message 是否是图片预览请求。 */
const isImagePreviewFrameMessage = (message: Record<string, unknown>): boolean => {
  return typeof message.imageId === 'string'
    && typeof message.src === 'string'
    && typeof message.alt === 'string';
};

/** 判断 iframe message 是否是图片删除请求。 */
const isImageDeleteFrameMessage = (message: Record<string, unknown>): boolean => {
  return typeof message.imageId === 'string'
    && typeof message.instanceId === 'string';
};

/** 判断 iframe message 是否是 Result 状态设置请求。 */
const isResultStatusFrameMessage = (message: Record<string, unknown>): boolean => {
  return Number.isInteger(message.rowIndex)
    && Number(message.rowIndex) >= 0
    && Number.isInteger(message.tableIndex)
    && Number(message.tableIndex) >= 0
    && Number.isInteger(message.previewRevision)
    && Number(message.previewRevision) >= 0
    && typeof message.imageId === 'string'
    && message.imageId.trim() !== ''
    && typeof message.instanceId === 'string'
    && message.instanceId.trim() !== ''
    && typeof message.passed === 'boolean'
    && typeof message.sourceColumnKey === 'string'
    && message.sourceColumnKey.trim() !== '';
};

/** 判断 iframe message 是否来自 CopyTest 预览。 */
const isPreviewFrameMessage = (data: unknown): data is PreviewFrameMessage => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  /** 便于按消息字段逐项校验的通用对象视图。 */
  const message = data as Record<string, unknown>;
  if (message.type !== PREVIEW_MESSAGE_TYPE || typeof message.action !== 'string') {
    return false;
  }
  if (message.action === 'selection') {
    return isSelectionFrameMessage(message);
  }
  if (message.action === 'preview') {
    return isImagePreviewFrameMessage(message);
  }
  if (message.action === 'delete') {
    return isImageDeleteFrameMessage(message);
  }
  return message.action === 'set-result-status' && isResultStatusFrameMessage(message);
};

/** 计算 iframe 预览中应该显示的列。 */
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
const createObjectUrlFromDataUrl = (dataUrl: string): string | null => {
  /** data URL 中的 MIME 类型和 base64 内容。 */
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  /** 从 base64 解码得到的二进制字符串。 */
  const binary = window.atob(match[2]);
  /** 用于构造 Blob 的字节数组。 */
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: match[1] }));
};

/** 读取当前 storage 图片的稳定实例标识。 */
const getPreviewImageKey = (element: Element): string => {
  return element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '';
};

/** 判断两批预览图片的文件身份与内容是否完全一致。 */
const arePreviewImagesEqual = (
  left: CopyTestImage[],
  right: CopyTestImage[]
): boolean => {
  return left.length === right.length && left.every((image, index) => {
    const otherImage = right[index];
    return image.fileName === otherImage.fileName
      && image.base64 === otherImage.base64;
  });
};

/** 跨 working table 状态更新复用内容未变化的图片数组。 */
const useStablePreviewImages = (images: CopyTestImage[]): CopyTestImage[] => {
  /** 最近一批内容不同的预览图片。 */
  const stableImagesRef = useRef(images);
  if (!arePreviewImagesEqual(stableImagesRef.current, images)) {
    stableImagesRef.current = images;
  }
  return stableImagesRef.current;
};

/** 为内存图片生成轻量 Blob URL，避免 base64 进入 srcdoc。 */
const createPreviewImageUrlBundle = (images: CopyTestImage[]): PreviewImageUrlBundle => {
  /** 生命周期结束时需要释放的 Blob URL。 */
  const urls: string[] = [];
  /** 同一内存图片只创建一次 Blob URL 的 ID 索引。 */
  const urlsByImageId = Object.create(null) as Record<string, string>;
  images.forEach(image => {
    /** 当前内存图片的稳定 ID。 */
    const imageId = getCopyTestImageId(image);
    if (urlsByImageId[imageId]) {
      return;
    }
    /** 供 iframe 加载的轻量 Blob URL。 */
    const objectUrl = createObjectUrlFromDataUrl(image.base64);
    if (objectUrl) {
      urls.push(objectUrl);
      urlsByImageId[imageId] = objectUrl;
    }
  });
  return { urls, urlsByImageId };
};

/** 将当前 storage 中的图片实例映射到已稳定复用的 Blob URL。 */
const mapPreviewImageUrlsByKey = (
  tableHtml: string,
  urlsByImageId: Record<string, string>
): Record<string, string> => {
  /** 仅用于扫描 storage 图片标记的脱离 DOM 文档。 */
  const doc = document.implementation.createHTMLDocument('copy-test-preview-images');
  /** 按图片实例标识索引的 Blob URL。 */
  const urlsByKey = Object.create(null) as Record<string, string>;
  doc.body.innerHTML = tableHtml;
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`).forEach(element => {
    /** storage 图片节点关联的内存图片 ID。 */
    const imageId = element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
    /** 当前 storage 图片节点的唯一实例 ID。 */
    const instanceId = getPreviewImageKey(element);
    /** 当前 storage 图片可用的 Blob URL。 */
    const objectUrl = urlsByImageId[imageId];
    if (!instanceId || !objectUrl) {
      return;
    }
    urlsByKey[instanceId] = objectUrl;
  });
  return urlsByKey;
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
  });
};

/** 计算行选择变更后的下标。 */
const updateSelectedRowIndexes = (
  currentRowIndexes: number[],
  changedRowIndexes: number[],
  checked: boolean
): number[] => {
  /** 使用 Set 去重后的下一批已选行。 */
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
const buildPreviewRuntimeScript = (tableIndex: number): string => {
  return `
    (() => {
      const messageType = ${JSON.stringify(PREVIEW_MESSAGE_TYPE)};
      const stateMessageType = ${JSON.stringify(PREVIEW_STATE_MESSAGE_TYPE)};
      const previewTableIndex = ${JSON.stringify(tableIndex)};
      const previewRevisionAttribute = ${JSON.stringify(PREVIEW_REVISION_ATTRIBUTE)};
      const actionAttribute = ${JSON.stringify(PREVIEW_ACTION_ATTRIBUTE)};
      const imageIdAttribute = ${JSON.stringify(PREVIEW_IMAGE_ID_ATTRIBUTE)};
      const imageInstanceAttribute = ${JSON.stringify(PREVIEW_IMAGE_INSTANCE_ATTRIBUTE)};
      const imageSrcAttribute = ${JSON.stringify(PREVIEW_IMAGE_SRC_ATTRIBUTE)};
      const imageAltAttribute = ${JSON.stringify(PREVIEW_IMAGE_ALT_ATTRIBUTE)};
      const selectionCheckboxAttribute = ${JSON.stringify(SELECTION_CHECKBOX_ATTRIBUTE)};
      const selectionRowsAttribute = ${JSON.stringify(SELECTION_ROW_INDEXES_ATTRIBUTE)};
      const selectionSelectAllAttribute = ${JSON.stringify(SELECTION_SELECT_ALL_ATTRIBUTE)};
      const selectionSelectableAttribute = ${JSON.stringify(SELECTION_SELECTABLE_ATTRIBUTE)};
      const deleteButtonAttribute = ${JSON.stringify(DELETE_BUTTON_ATTRIBUTE)};
      const resultStatusLinkAttribute = ${JSON.stringify(RESULT_STATUS_LINK_ATTRIBUTE)};
      const resultStatusRowIndexAttribute = ${JSON.stringify(RESULT_STATUS_ROW_INDEX_ATTRIBUTE)};
      const resultStatusPassedAttribute = ${JSON.stringify(RESULT_STATUS_PASSED_ATTRIBUTE)};
      const resultStatusSourceColumnKeyAttribute = ${JSON.stringify(
        RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE
      )};
      const parentOrigin = window.parent.location.origin;
      let disabled = false;
      let resultStatusDisabled = false;
      const post = payload => window.parent.postMessage(
        { type: messageType, ...payload },
        parentOrigin
      );
      const readImagePayload = element => ({
        imageId: element.getAttribute(imageIdAttribute) || '',
        instanceId: element.getAttribute(imageInstanceAttribute) || '',
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
      const readSelectionCheckboxes = () => Array.from(
        document.querySelectorAll('[' + selectionCheckboxAttribute + ']')
      );
      const readSelectedRows = () => {
        const selectedRows = new Set();
        readSelectionCheckboxes().forEach(checkbox => {
          if (checkbox.hasAttribute(selectionSelectAllAttribute) || !checkbox.checked) {
            return;
          }
          readSelectionRows(checkbox).forEach(rowIndex => selectedRows.add(rowIndex));
        });
        return selectedRows;
      };
      const syncSelection = selectedRows => {
        readSelectionCheckboxes().forEach(checkbox => {
          const rowIndexes = readSelectionRows(checkbox);
          const selectedCount = rowIndexes.filter(rowIndex => selectedRows.has(rowIndex)).length;
          checkbox.checked = rowIndexes.length > 0 && selectedCount === rowIndexes.length;
          checkbox.indeterminate = selectedCount > 0 && selectedCount < rowIndexes.length;
          checkbox.disabled = disabled || checkbox.getAttribute(selectionSelectableAttribute) !== 'true';
        });
      };
      const syncDisabledActions = () => {
        document.querySelectorAll('[' + deleteButtonAttribute + ']').forEach(button => {
          button.disabled = disabled;
        });
        document.querySelectorAll('[' + resultStatusLinkAttribute + ']').forEach(link => {
          const linkDisabled = disabled || resultStatusDisabled;
          link.setAttribute('aria-disabled', String(linkDisabled));
          link.setAttribute('tabindex', linkDisabled ? '-1' : '0');
        });
      };
      window.addEventListener('message', event => {
        const payload = event.data;
        if (
          event.origin !== parentOrigin
          || event.source !== window.parent
          || !payload
          || payload.type !== stateMessageType
        ) {
          return;
        }
        if (!Number.isInteger(payload.previewRevision) || payload.previewRevision < 0) {
          return;
        }
        const currentRevisionValue = document.documentElement.getAttribute(
          previewRevisionAttribute
        ) || '';
        const currentRevision = Number(currentRevisionValue);
        if (
          currentRevisionValue
          && Number.isInteger(currentRevision)
          && payload.previewRevision < currentRevision
        ) {
          return;
        }
        document.documentElement.setAttribute(
          previewRevisionAttribute,
          String(payload.previewRevision)
        );
        disabled = payload.disabled === true;
        resultStatusDisabled = payload.resultStatusDisabled === true;
        syncSelection(new Set(Array.isArray(payload.selectedRowIndexes) ? payload.selectedRowIndexes : []));
        syncDisabledActions();
      });
      document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        const actionElement = target?.closest('[' + actionAttribute + ']');
        if (!actionElement) {
          return;
        }
        event.preventDefault();
        const action = actionElement.getAttribute(actionAttribute);
        if (
          action === 'set-result-status'
          && actionElement.matches('a[' + resultStatusLinkAttribute + ']')
        ) {
          if (actionElement.getAttribute('aria-disabled') === 'true') {
            return;
          }
          const rowIndexValue = actionElement.getAttribute(resultStatusRowIndexAttribute) || '';
          const passedValue = actionElement.getAttribute(resultStatusPassedAttribute);
          const previewRevisionValue = document.documentElement.getAttribute(
            previewRevisionAttribute
          ) || '';
          const sourceColumnKey = actionElement.getAttribute(resultStatusSourceColumnKeyAttribute) || '';
          const rowIndex = Number(rowIndexValue);
          const previewRevision = Number(previewRevisionValue);
          const screenPayload = readImagePayload(actionElement);
          const passed = passedValue === 'true'
            ? true
            : passedValue === 'false'
              ? false
              : null;
          if (
            rowIndexValue
            && Number.isInteger(rowIndex)
            && rowIndex >= 0
            && previewRevisionValue
            && Number.isInteger(previewRevision)
            && previewRevision >= 0
            && passed !== null
            && sourceColumnKey
            && screenPayload.imageId
            && screenPayload.instanceId
          ) {
            post({
              action: 'set-result-status',
              imageId: screenPayload.imageId,
              instanceId: screenPayload.instanceId,
              passed,
              previewRevision,
              rowIndex,
              sourceColumnKey,
              tableIndex: previewTableIndex,
            });
          }
          return;
        }
        const payload = readImagePayload(actionElement);
        if (action === 'delete' && !disabled && payload.imageId && payload.instanceId) {
          post({ action: 'delete', imageId: payload.imageId, instanceId: payload.instanceId });
        }
        if (action === 'preview' && payload.imageId && payload.src) {
          post({ action: 'preview', imageId: payload.imageId, src: payload.src, alt: payload.alt });
        }
      });
      document.addEventListener('change', event => {
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target?.hasAttribute(selectionCheckboxAttribute)) {
          return;
        }
        const changedRowIndexes = readSelectionRows(target);
        const selectedRows = readSelectedRows();
        changedRowIndexes.forEach(rowIndex => {
          if (target.checked) {
            selectedRows.add(rowIndex);
          } else {
            selectedRows.delete(rowIndex);
          }
        });
        syncSelection(selectedRows);
        post({ action: 'selection', checked: target.checked, rowIndexes: changedRowIndexes });
      });
    })();
  `;
};

/** 构建 iframe 的完整 HTML 文档。 */
const buildPreviewDocumentHtml = (
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

/** 读取 iframe 内部表格滚动容器。 */
const getFrameScrollRoot = (iframe: HTMLIFrameElement | null): HTMLElement | null => {
  return iframe?.contentDocument?.querySelector<HTMLElement>('.copy-test-preview-scroll-root') || null;
};

/** 在不重载 iframe 文档的前提下替换表格内容，并保留当前滚动位置。 */
const replaceFramePreviewContent = (
  iframe: HTMLIFrameElement | null,
  previewHtml: string
): boolean => {
  /** 当前 iframe 中需要持续复用的滚动根节点。 */
  const currentScrollRoot = getFrameScrollRoot(iframe);
  if (!currentScrollRoot) {
    return false;
  }

  /** 从最新安全预览文档中提取待替换的表格内容。 */
  const nextDocument = new DOMParser().parseFromString(previewHtml, 'text/html');
  const nextScrollRoot = nextDocument.querySelector<HTMLElement>(
    '.copy-test-preview-scroll-root'
  );
  if (!nextScrollRoot) {
    return false;
  }

  /** 内容更新前锁定横向与纵向偏移，避免回到首行。 */
  const scrollLeft = currentScrollRoot.scrollLeft;
  const scrollTop = currentScrollRoot.scrollTop;
  currentScrollRoot.innerHTML = nextScrollRoot.innerHTML;
  currentScrollRoot.scrollLeft = scrollLeft;
  currentScrollRoot.scrollTop = scrollTop;
  return true;
};

/** 父页面需要同步写入 iframe 交互节点的轻量状态。 */
interface FramePreviewState {
  /** 是否禁用所有预览交互。 */
  disabled: boolean;
  /** 当前 working table 版本。 */
  previewRevision: number;
  /** 是否仅禁用 Result 状态链接。 */
  resultStatusDisabled: boolean;
  /** 当前选中的逻辑行下标。 */
  selectedRowIndexes: number[];
}

/** 从 iframe checkbox 读取其对应的逻辑行下标。 */
const readFrameSelectionRows = (checkbox: HTMLInputElement): number[] => {
  try {
    /** checkbox 属性中保存的逻辑行下标数组。 */
    const value = JSON.parse(
      checkbox.getAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE) || '[]'
    );
    return Array.isArray(value)
      ? value.filter(item => typeof item === 'number' && Number.isFinite(item))
      : [];
  } catch {
    return [];
  }
};

/** 同步 iframe 内所有行选择 checkbox 的受控状态。 */
const syncFrameSelectionState = (
  doc: Document,
  selectedRowIndexes: number[],
  disabled: boolean
): void => {
  /** 当前受控选择集合。 */
  const selectedRows = new Set(selectedRowIndexes);
  doc.querySelectorAll<HTMLInputElement>(
    `[${SELECTION_CHECKBOX_ATTRIBUTE}]`
  ).forEach(checkbox => {
    /** 当前 checkbox 代表的一个或多个逻辑行。 */
    const rowIndexes = readFrameSelectionRows(checkbox);
    const selectedCount = rowIndexes.filter(rowIndex => selectedRows.has(rowIndex)).length;
    checkbox.checked = rowIndexes.length > 0 && selectedCount === rowIndexes.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < rowIndexes.length;
    checkbox.disabled = disabled
      || checkbox.getAttribute(SELECTION_SELECTABLE_ATTRIBUTE) !== DOM_TRUE_ATTRIBUTE_VALUE;
  });
};

/** 同步 iframe 内 Evidence 删除和 Result 状态入口的禁用状态。 */
const syncFrameActionState = (
  doc: Document,
  disabled: boolean,
  resultStatusDisabled: boolean
): void => {
  doc.querySelectorAll<HTMLButtonElement>(
    `[${DELETE_BUTTON_ATTRIBUTE}]`
  ).forEach(button => {
    button.disabled = disabled;
  });
  doc.querySelectorAll<HTMLAnchorElement>(
    `[${RESULT_STATUS_LINK_ATTRIBUTE}]`
  ).forEach(link => {
    /** Result 链接同时受全局状态和导出状态约束。 */
    const linkDisabled = disabled || resultStatusDisabled;
    link.setAttribute('aria-disabled', String(linkDisabled));
    link.setAttribute('tabindex', linkDisabled ? '-1' : '0');
  });
};

/** 在浏览器绘制前直接恢复 iframe 新内容的受控交互状态。 */
const syncFramePreviewState = (
  iframe: HTMLIFrameElement | null,
  state: FramePreviewState
): void => {
  /** 当前可同步的 iframe 文档。 */
  const doc = iframe?.contentDocument;
  if (!doc) {
    return;
  }
  doc.documentElement.setAttribute(
    PREVIEW_REVISION_ATTRIBUTE,
    String(state.previewRevision)
  );
  syncFrameSelectionState(doc, state.selectedRowIndexes, state.disabled);
  syncFrameActionState(doc, state.disabled, state.resultStatusDisabled);
};

/** 读取 iframe 内部表格实际宽度。 */
const getFrameTableScrollWidth = (iframe: HTMLIFrameElement | null): number => {
  /** iframe 内部文档，未加载时为空。 */
  const doc = iframe?.contentDocument;
  /** iframe 内部纵向与横向滚动容器。 */
  const scrollRoot = getFrameScrollRoot(iframe);
  /** 用于读取真实宽度的预览表格。 */
  const tableElement = doc?.querySelector<HTMLElement>(PREVIEW_TABLE_SELECTOR);
  return Math.max(scrollRoot?.scrollWidth || 0, tableElement?.scrollWidth || 0);
};

/** 限制数值范围。 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/** 切换横向拖拽交互状态，不触发 React 渲染。 */
const setHorizontalDragInteraction = (
  iframe: HTMLIFrameElement | null,
  thumb: HTMLElement | null,
  dragging: boolean
): void => {
  thumb?.classList.toggle('is-dragging', dragging);
  if (iframe) {
    iframe.style.pointerEvents = dragging ? 'none' : '';
  }
};

/** 渲染 iframe 表格预览组件。 */
export const TablePreview: React.FC<CopyTestTablePreviewProps> = ({
  disabled = false,
  images = EMPTY_PREVIEW_IMAGES,
  onEvidenceImageDelete,
  onEvidenceImagePreview,
  onResultStatusChange,
  onSelectedRowIndexesChange,
  previewRevision,
  resultStatusDisabled = false,
  selectedColumnIndex,
  selectedRowIndexes,
  table,
}) => {
  /** 当前表格预览 iframe 的 DOM 引用。 */
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** 固定横向滚动条轨道的 DOM 引用。 */
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  /** 固定横向滚动条滑块的 DOM 引用。 */
  const horizontalThumbRef = useRef<HTMLDivElement>(null);
  /** 当前滑块拖拽所使用的起点快照。 */
  const horizontalDragStartRef = useRef<HorizontalDragStart>({
    clientX: 0,
    maxScrollLeft: 0,
    maxThumbTravel: 1,
    scrollLeft: 0,
  });
  /** 指针是否正在拖拽固定横向滚动条。 */
  const horizontalDraggingRef = useRef(false);
  /** 当前已排队的横向拖拽动画帧 ID。 */
  const horizontalDragFrameRef = useRef<number | null>(null);
  /** 高频 mousemove 事件中待消费的最新水平坐标。 */
  const pendingHorizontalDragClientXRef = useRef<number | null>(null);
  /** 解除 iframe scroll 事件监听的清理函数。 */
  const frameScrollCleanupRef = useRef<() => void>(() => {});
  /** 停止 iframe 尺寸监听的清理函数。 */
  const frameResizeCleanupRef = useRef<() => void>(() => {});
  /** 供 iframe message 处理器读取的最新已选行。 */
  const selectedRowIndexesRef = useRef(selectedRowIndexes);
  /** 供 iframe 状态同步读取的最新禁用状态。 */
  const disabledRef = useRef(disabled);
  /** 供 iframe 状态同步读取的最新 Result 状态禁用标记。 */
  const resultStatusDisabledRef = useRef(resultStatusDisabled);
  /** 供 iframe 状态同步读取的最新 working table 版本。 */
  const previewRevisionRef = useRef(previewRevision);
  /** 供 iframe message 校验读取的最新表格下标。 */
  const tableIndexRef = useRef(table?.index);
  /** 固定横向滚动条的尺寸与位置状态。 */
  const [horizontalScrollMetrics, setHorizontalScrollMetrics] = useState<HorizontalScrollMetrics>({
    contentWidth: 0,
    scrollLeft: 0,
    visible: false,
    viewportWidth: 0,
  });

  /** 状态更新前后内容一致的 Evidence 图片数组。 */
  const stablePreviewImages = useStablePreviewImages(images);
  /** 当前表格 Evidence 图片的 Blob URL 缓存。 */
  const previewImageUrlBundle = useMemo(
    () => createPreviewImageUrlBundle(stablePreviewImages),
    [stablePreviewImages]
  );

  useEffect(() => {
    return () => {
      previewImageUrlBundle.urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewImageUrlBundle]);

  /** 当前 working table 图片实例到稳定 Blob URL 的映射。 */
  const previewImageUrlsByKey = useMemo(
    () => mapPreviewImageUrlsByKey(
      table?.workingHtml || '',
      previewImageUrlBundle.urlsByImageId
    ),
    [previewImageUrlBundle.urlsByImageId, table?.workingHtml]
  );

  /** 完成安全改写后供 iframe 加载的整体 HTML。 */
  const previewHtml = useMemo(
    () => table
      ? buildPreviewDocumentHtml(
        table,
        previewImageUrlsByKey,
        selectedColumnIndex
      )
      : '',
    [previewImageUrlsByKey, selectedColumnIndex, table]
  );

  /** 只有切换表格或 Comparison Column 才允许更新 iframe 的完整 srcDoc。 */
  const previewDocumentKey = `${table?.index ?? 'empty'}:${selectedColumnIndex ?? 'all'}`;
  /** 同一预览上下文内冻结 srcDoc，working 内容改为在 iframe 内局部更新。 */
  const [previewDocument, setPreviewDocument] = useState(() => ({
    html: previewHtml,
    key: previewDocumentKey,
  }));
  /** 用于识别真实 srcDoc 上下文切换的上一文档快照。 */
  const previousPreviewDocumentRef = useRef({
    html: previewDocument.html,
    key: previewDocument.key,
  });
  /** iframe 当前实际已加载或已局部写入的最新内容。 */
  const lastAppliedPreviewDocumentRef = useRef({
    html: previewDocument.html,
    key: previewDocument.key,
  });
  if (previewDocument.key !== previewDocumentKey) {
    setPreviewDocument({
      html: previewHtml,
      key: previewDocumentKey,
    });
  }

  /** 将轻量交互状态增量同步到当前 iframe，不重建 srcDoc。 */
  const postPreviewState = useCallback((): void => {
    /** 当前受控 srcDoc iframe 的消息接收窗口。 */
    const previewWindow = iframeRef.current?.contentWindow;
    if (!previewWindow) {
      return;
    }
    /** srcDoc 继承父页面安全域，使用父页面的有效 origin，避免 iframe URL 返回 "null"。 */
    const targetOrigin = window.location.origin;
    previewWindow.postMessage({
      disabled: disabledRef.current,
      previewRevision: previewRevisionRef.current,
      resultStatusDisabled: resultStatusDisabledRef.current,
      selectedRowIndexes: selectedRowIndexesRef.current,
      type: PREVIEW_STATE_MESSAGE_TYPE,
    }, targetOrigin);
  }, []);

  /** 在绘制前同步 DOM 状态，并通知 iframe runtime 更新版本。 */
  const syncCurrentPreviewState = useCallback((): void => {
    syncFramePreviewState(iframeRef.current, {
      disabled: disabledRef.current,
      previewRevision: previewRevisionRef.current,
      resultStatusDisabled: resultStatusDisabledRef.current,
      selectedRowIndexes: selectedRowIndexesRef.current,
    });
    postPreviewState();
  }, [postPreviewState]);

  useLayoutEffect(() => {
    disabledRef.current = disabled;
    previewRevisionRef.current = previewRevision;
    resultStatusDisabledRef.current = resultStatusDisabled;
    selectedRowIndexesRef.current = selectedRowIndexes;
    tableIndexRef.current = table?.index;
    syncCurrentPreviewState();
  }, [
    disabled,
    previewRevision,
    resultStatusDisabled,
    selectedRowIndexes,
    syncCurrentPreviewState,
    table?.index,
  ]);

  /** 同步固定横向滚动条尺寸。 */
  const updateHorizontalScrollMetrics = useCallback((): void => {
    /** iframe 内部的表格滚动容器。 */
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

    /** 结合容器和表格读取的实际内容宽度。 */
    const contentWidth = getFrameTableScrollWidth(iframeRef.current);
    /** iframe 滚动容器的可见宽度。 */
    const viewportWidth = scrollRoot.clientWidth;
    /** 内容宽度是否超出可见区域。 */
    const visible = contentWidth > viewportWidth + 1;
    setHorizontalScrollMetrics({
      contentWidth,
      scrollLeft: scrollRoot.scrollLeft,
      visible,
      viewportWidth,
    });
  }, []);

  /** 将一次横向拖拽位置直接写入滚动 DOM，避免 mousemove 触发 React 渲染。 */
  const applyHorizontalDragPosition = useCallback((clientX: number): void => {
    /** iframe 内部的表格滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 固定横向滚动条的轨道节点。 */
    const track = horizontalTrackRef.current;
    /** 固定横向滚动条的滑块节点。 */
    const thumb = horizontalThumbRef.current;
    if (!scrollRoot || !track || !thumb) {
      return;
    }

    /** 按下滑块时记录的拖拽起点。 */
    const dragStart = horizontalDragStartRef.current;
    /** 指针相对拖拽起点的水平移动距离。 */
    const deltaX = clientX - dragStart.clientX;
    /** 按滑块移动比例换算的目标滚动偏移。 */
    const nextScrollLeft = dragStart.scrollLeft
      + (deltaX / dragStart.maxThumbTravel) * dragStart.maxScrollLeft;
    /** 约束在当前表格可滚动范围内的偏移。 */
    const scrollLeft = clamp(nextScrollLeft, 0, dragStart.maxScrollLeft);
    /** 滑块和表格当前的归一化滚动进度。 */
    const thumbProgress = dragStart.maxScrollLeft === 0
      ? 0
      : scrollLeft / dragStart.maxScrollLeft;
    scrollRoot.scrollLeft = scrollLeft;
    thumb.style.left = `${thumbProgress * 100}%`;
    thumb.style.transform = `translateX(-${thumbProgress * 100}%)`;
    track.setAttribute('aria-valuenow', String(scrollLeft));
  }, []);

  /** 取消尚未执行的横向拖拽动画帧。 */
  const cancelHorizontalDragFrame = useCallback((): void => {
    if (horizontalDragFrameRef.current !== null) {
      window.cancelAnimationFrame(horizontalDragFrameRef.current);
    }
    horizontalDragFrameRef.current = null;
  }, []);

  /** 消费鼠标事件队列中最新的横向拖拽位置。 */
  const applyPendingHorizontalDrag = useCallback((): void => {
    /** 下一动画帧需要应用的最新指针水平坐标。 */
    const clientX = pendingHorizontalDragClientXRef.current;
    pendingHorizontalDragClientXRef.current = null;
    if (clientX === null || !horizontalDraggingRef.current) {
      return;
    }
    applyHorizontalDragPosition(clientX);
  }, [applyHorizontalDragPosition]);

  /** 将高频 mousemove 合并到下一动画帧。 */
  const scheduleHorizontalDrag = useCallback((clientX: number): void => {
    pendingHorizontalDragClientXRef.current = clientX;
    if (horizontalDragFrameRef.current !== null) {
      return;
    }
    horizontalDragFrameRef.current = window.requestAnimationFrame(() => {
      horizontalDragFrameRef.current = null;
      applyPendingHorizontalDrag();
    });
  }, [applyPendingHorizontalDrag]);

  /** mouseup 前同步最后一条尚未绘制的 mousemove。 */
  const flushHorizontalDrag = useCallback((): void => {
    cancelHorizontalDragFrame();
    applyPendingHorizontalDrag();
  }, [applyPendingHorizontalDrag, cancelHorizontalDragFrame]);

  /** 同步 iframe 表格和固定底部横向滚动条。 */
  const bindFrameScrollSync = useCallback((): (() => void) => {
    /** 需要监听横向偏移的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    if (!scrollRoot) {
      return () => {};
    }

    /** 在非拖拽场景下将 iframe 滚动位置同步给滑块。 */
    const handleFrameScroll = (): void => {
      if (horizontalDraggingRef.current) {
        return;
      }
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

  /** 用 ResizeObserver 监听预览内容尺寸，避免重复延时同步。 */
  const bindFrameResizeSync = useCallback((): (() => void) => {
    /** 需要监听尺寸变化的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 需要监听实际内容宽度变化的预览表格。 */
    const tableElement = iframeRef.current?.contentDocument?.querySelector(PREVIEW_TABLE_SELECTOR);
    if (!scrollRoot || !tableElement || typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    /** 同时观察容器和表格的尺寸监听器。 */
    const observer = new ResizeObserver(updateHorizontalScrollMetrics);
    observer.observe(scrollRoot);
    observer.observe(tableElement);
    return () => {
      observer.disconnect();
    };
  }, [updateHorizontalScrollMetrics]);

  /** 将 working table 的最新内容局部写入现有 iframe，并刷新新表格的尺寸监听。 */
  const patchFramePreviewContent = useCallback((): void => {
    if (!replaceFramePreviewContent(iframeRef.current, previewHtml)) {
      return;
    }
    lastAppliedPreviewDocumentRef.current = {
      html: previewHtml,
      key: previewDocument.key,
    };
    frameResizeCleanupRef.current();
    syncCurrentPreviewState();
    updateHorizontalScrollMetrics();
    frameResizeCleanupRef.current = bindFrameResizeSync();
  }, [
    bindFrameResizeSync,
    previewDocument.key,
    previewHtml,
    syncCurrentPreviewState,
    updateHorizontalScrollMetrics,
  ]);

  useLayoutEffect(() => {
    const lastAppliedDocument = lastAppliedPreviewDocumentRef.current;
    if (
      lastAppliedDocument.key !== previewDocument.key
      || previewHtml === lastAppliedDocument.html
    ) {
      return;
    }
    patchFramePreviewContent();
  }, [patchFramePreviewContent, previewDocument.key, previewHtml]);

  /** iframe 加载后同步滚动条。 */
  const handleFrameLoad = useCallback((): void => {
    frameScrollCleanupRef.current();
    frameResizeCleanupRef.current();
    let appliedHtml = previewDocument.html;
    if (previewHtml !== previewDocument.html) {
      const replaced = replaceFramePreviewContent(iframeRef.current, previewHtml);
      if (replaced) {
        appliedHtml = previewHtml;
      }
    }
    lastAppliedPreviewDocumentRef.current = {
      html: appliedHtml,
      key: previewDocument.key,
    };
    syncCurrentPreviewState();
    updateHorizontalScrollMetrics();
    frameScrollCleanupRef.current = bindFrameScrollSync();
    frameResizeCleanupRef.current = bindFrameResizeSync();
  }, [
    bindFrameResizeSync,
    bindFrameScrollSync,
    previewDocument.html,
    previewDocument.key,
    previewHtml,
    syncCurrentPreviewState,
    updateHorizontalScrollMetrics,
  ]);

  /** 处理固定底部滚动条滑块按下。 */
  const handleHorizontalThumbMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    /** 拖拽操作要控制的 iframe 滚动容器。 */
    const scrollRoot = getFrameScrollRoot(iframeRef.current);
    /** 用于计算滑块可移动距离的轨道节点。 */
    const track = horizontalTrackRef.current;
    /** 用于计算实际宽度的滑块节点。 */
    const thumb = horizontalThumbRef.current;
    /** 拖拽开始时 iframe 滚动容器的可见宽度。 */
    const viewportWidth = scrollRoot?.clientWidth || 0;
    horizontalDragStartRef.current = {
      clientX: event.clientX,
      maxScrollLeft: Math.max(0, getFrameTableScrollWidth(iframeRef.current) - viewportWidth),
      maxThumbTravel: Math.max(1, (track?.clientWidth || 0) - (thumb?.offsetWidth || 0)),
      scrollLeft: scrollRoot?.scrollLeft || 0,
    };
    cancelHorizontalDragFrame();
    pendingHorizontalDragClientXRef.current = null;
    horizontalDraggingRef.current = true;
    setHorizontalDragInteraction(iframeRef.current, thumb, true);
  }, [cancelHorizontalDragFrame]);

  /** 横向滚动条滑块宽度百分比。 */
  const horizontalThumbWidthPercent = horizontalScrollMetrics.visible
    ? Math.max(5, Math.min(100, (horizontalScrollMetrics.viewportWidth / horizontalScrollMetrics.contentWidth) * 100))
    : 100;

  /** 横向滚动条滑块滚动进度。 */
  const horizontalThumbProgress = horizontalScrollMetrics.visible
    ? horizontalScrollMetrics.scrollLeft
      / Math.max(1, horizontalScrollMetrics.contentWidth - horizontalScrollMetrics.viewportWidth)
    : 0;

  useEffect(() => {
    /** 当前 iframe 节点，用于卸载时恢复鼠标交互。 */
    const horizontalIframe = iframeRef.current;
    /** 当前滑块节点，用于卸载时清理拖拽样式。 */
    const horizontalThumb = horizontalThumbRef.current;
    /** 将高频指针移动合并到下一动画帧。 */
    const handleMouseMove = (event: MouseEvent): void => {
      if (!horizontalDraggingRef.current) {
        return;
      }
      scheduleHorizontalDrag(event.clientX);
    };
    /** 结束拖拽并对齐 iframe 与滑块的最终位置。 */
    const handleMouseUp = (): void => {
      if (!horizontalDraggingRef.current) {
        return;
      }
      flushHorizontalDrag();
      horizontalDraggingRef.current = false;
      setHorizontalDragInteraction(iframeRef.current, horizontalThumbRef.current, false);
      updateHorizontalScrollMetrics();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
      horizontalDraggingRef.current = false;
      pendingHorizontalDragClientXRef.current = null;
      setHorizontalDragInteraction(horizontalIframe, horizontalThumb, false);
      cancelHorizontalDragFrame();
    };
  }, [
    cancelHorizontalDragFrame,
    flushHorizontalDrag,
    scheduleHorizontalDrag,
    updateHorizontalScrollMetrics,
  ]);

  useEffect(() => {
    window.addEventListener('resize', updateHorizontalScrollMetrics);
    return () => {
      window.removeEventListener('resize', updateHorizontalScrollMetrics);
    };
  }, [updateHorizontalScrollMetrics]);

  useLayoutEffect(() => {
    const previousDocument = previousPreviewDocumentRef.current;
    if (previousDocument.key === previewDocument.key) {
      return;
    }
    /** 当前 srcDoc 状态对应的稳定快照。 */
    const currentDocument = {
      html: previewDocument.html,
      key: previewDocument.key,
    };
    previousPreviewDocumentRef.current = currentDocument;
    if (previousDocument.html === previewDocument.html) {
      if (lastAppliedPreviewDocumentRef.current.html !== previewDocument.html) {
        patchFramePreviewContent();
      } else {
        lastAppliedPreviewDocumentRef.current = currentDocument;
      }
    } else {
      lastAppliedPreviewDocumentRef.current = currentDocument;
      frameScrollCleanupRef.current();
      frameResizeCleanupRef.current();
      frameScrollCleanupRef.current = () => {};
      frameResizeCleanupRef.current = () => {};
    }
    if (!horizontalDraggingRef.current) {
      return;
    }
    horizontalDraggingRef.current = false;
    pendingHorizontalDragClientXRef.current = null;
    setHorizontalDragInteraction(
      iframeRef.current,
      horizontalThumbRef.current,
      false
    );
    cancelHorizontalDragFrame();
  }, [
    cancelHorizontalDragFrame,
    patchFramePreviewContent,
    previewDocument.html,
    previewDocument.key,
  ]);

  useEffect(() => {
    /** 当前 iframe 节点，用于组件卸载时恢复鼠标交互。 */
    const horizontalIframe = iframeRef.current;
    /** 当前滑块节点，用于组件卸载时清理样式。 */
    const horizontalThumb = horizontalThumbRef.current;
    return () => {
      frameScrollCleanupRef.current();
      frameResizeCleanupRef.current();
      horizontalDraggingRef.current = false;
      pendingHorizontalDragClientXRef.current = null;
      setHorizontalDragInteraction(horizontalIframe, horizontalThumb, false);
      cancelHorizontalDragFrame();
      frameScrollCleanupRef.current = () => {};
      frameResizeCleanupRef.current = () => {};
    };
  }, [cancelHorizontalDragFrame]);

  useLayoutEffect(() => {
    /** 分发 iframe 内部行选择、图片预览、删除和 Result 状态事件。 */
    const handleFrameMessage = (event: MessageEvent): void => {
      if (
        event.origin !== window.location.origin
        || event.source !== iframeRef.current?.contentWindow
        || !isPreviewFrameMessage(event.data)
      ) {
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
          selectedRowIndexesRef.current,
          event.data.rowIndexes,
          event.data.checked
        ));
        return;
      }

      if (event.data.action === 'set-result-status') {
        if (
          disabledRef.current
          || resultStatusDisabledRef.current
          || event.data.tableIndex !== tableIndexRef.current
          || event.data.previewRevision !== previewRevisionRef.current
        ) {
          return;
        }
        onResultStatusChange({
          imageId: event.data.imageId,
          instanceId: event.data.instanceId,
          passed: event.data.passed,
          previewRevision: event.data.previewRevision,
          rowIndex: event.data.rowIndex,
          sourceColumnKey: event.data.sourceColumnKey,
          tableIndex: event.data.tableIndex,
        });
        return;
      }

      if (event.data.action === 'delete') {
        onEvidenceImageDelete({
          imageId: event.data.imageId,
          instanceId: event.data.instanceId,
        });
      }
    };

    window.addEventListener('message', handleFrameMessage);
    return () => {
      window.removeEventListener('message', handleFrameMessage);
    };
  }, [
    onEvidenceImageDelete,
    onEvidenceImagePreview,
    onResultStatusChange,
    onSelectedRowIndexesChange,
  ]);

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
        srcDoc={previewDocument.html}
        title="CopyTest table preview"
      />
      <div
        ref={horizontalTrackRef}
        aria-label="Horizontal table scroll"
        aria-orientation="horizontal"
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
          className="copy-test-fixed-horizontal-scrollbar-thumb"
          onMouseDown={handleHorizontalThumbMouseDown}
          style={{
            left: `${horizontalThumbProgress * 100}%`,
            transform: `translateX(-${horizontalThumbProgress * 100}%)`,
            width: `${horizontalThumbWidthPercent}%`,
          }}
        />
      </div>
    </div>
  );
};

export default TablePreview;
