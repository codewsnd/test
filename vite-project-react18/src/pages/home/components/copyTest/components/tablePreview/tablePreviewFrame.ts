/**
 * 文件作用：校验 iframe 消息，并同步父页面受控状态、滚动位置和拖拽状态。
 */
import {
  DELETE_BUTTON_ATTRIBUTE,
  DOM_TRUE_ATTRIBUTE_VALUE,
  PREVIEW_MESSAGE_TYPE,
  PREVIEW_REVISION_ATTRIBUTE,
  PREVIEW_TABLE_SELECTOR,
  RESULT_STATUS_LINK_ATTRIBUTE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECTABLE_ATTRIBUTE,
} from './tablePreviewConstants';
import type { PreviewFrameMessage } from './tablePreviewTypes';

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
export const isPreviewFrameMessage = (data: unknown): data is PreviewFrameMessage => {
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

export const updateSelectedRowIndexes = (
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

/** 读取 iframe 内部表格滚动容器。 */
export const getFrameScrollRoot = (iframe: HTMLIFrameElement | null): HTMLElement | null => {
  return iframe?.contentDocument?.querySelector<HTMLElement>('.copy-test-preview-scroll-root') || null;
};

/** 在不重载 iframe 文档的前提下替换表格内容，并保留当前滚动位置。 */
export const replaceFramePreviewContent = (
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
export const syncFramePreviewState = (
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
export const getFrameTableScrollWidth = (iframe: HTMLIFrameElement | null): number => {
  /** iframe 内部文档，未加载时为空。 */
  const doc = iframe?.contentDocument;
  /** iframe 内部纵向与横向滚动容器。 */
  const scrollRoot = getFrameScrollRoot(iframe);
  /** 用于读取真实宽度的预览表格。 */
  const tableElement = doc?.querySelector<HTMLElement>(PREVIEW_TABLE_SELECTOR);
  return Math.max(scrollRoot?.scrollWidth || 0, tableElement?.scrollWidth || 0);
};

/** 限制数值范围。 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/** 切换横向拖拽交互状态，不触发 React 渲染。 */
export const setHorizontalDragInteraction = (
  iframe: HTMLIFrameElement | null,
  thumb: HTMLElement | null,
  dragging: boolean
): void => {
  thumb?.classList.toggle('is-dragging', dragging);
  if (iframe) {
    iframe.style.pointerEvents = dragging ? 'none' : '';
  }
};

