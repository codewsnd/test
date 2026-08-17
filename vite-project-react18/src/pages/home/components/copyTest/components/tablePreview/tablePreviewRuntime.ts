/**
 * 文件作用：构建注入 srcDoc 的轻量 iframe 交互 runtime，保持消息协议与父页面隔离。
 */
import {
  DELETE_BUTTON_ATTRIBUTE,
  PREVIEW_ACTION_ATTRIBUTE,
  PREVIEW_IMAGE_ALT_ATTRIBUTE,
  PREVIEW_IMAGE_ID_ATTRIBUTE,
  PREVIEW_IMAGE_INSTANCE_ATTRIBUTE,
  PREVIEW_IMAGE_SRC_ATTRIBUTE,
  PREVIEW_MESSAGE_TYPE,
  PREVIEW_REVISION_ATTRIBUTE,
  PREVIEW_STATE_MESSAGE_TYPE,
  RESULT_STATUS_LINK_ATTRIBUTE,
  RESULT_STATUS_PASSED_ATTRIBUTE,
  RESULT_STATUS_ROW_INDEX_ATTRIBUTE,
  RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECTABLE_ATTRIBUTE,
  SELECTION_SELECT_ALL_ATTRIBUTE,
} from './tablePreviewConstants';

export const buildPreviewRuntimeScript = (tableIndex: number): string => {
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

