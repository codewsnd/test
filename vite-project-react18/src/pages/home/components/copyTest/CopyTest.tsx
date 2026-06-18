/**
 * 文件作用：组装 CopyTest 弹窗、控制主要 UI 区域和确认弹窗。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import {
  CopyTestImportBar,
  CopyTestLoadingBlock,
  CopyTestSelectors,
  EvidenceImagePreview,
  TablePreview,
  UploadScreenshotModal,
} from './components';
import { useCopyTestController } from './hooks/useCopyTestController';
import type { CopyTestProps } from './types';

/** 定义 DELETE_EVIDENCE_IMAGE_CONFIRM_TITLE 常量。 */
const DELETE_EVIDENCE_IMAGE_CONFIRM_TITLE = 'Delete screenshot?';

/** 定义 DELETE_EVIDENCE_IMAGE_CONFIRM_CONTENT 常量。 */
const DELETE_EVIDENCE_IMAGE_CONFIRM_CONTENT = 'This screenshot will be removed from Test Evidence and the matching Test Result entries.';

/** 定义 COPY_TEST_MODAL_VIEWPORT_MARGIN 常量。 */
const COPY_TEST_MODAL_VIEWPORT_MARGIN = 20;

/** 定义 COPY_TEST_MODAL_WIDTH 常量。 */
const COPY_TEST_MODAL_WIDTH = `calc(100vw - ${COPY_TEST_MODAL_VIEWPORT_MARGIN * 2}px)`;

/** 定义 COPY_TEST_MODAL_HEIGHT 常量。 */
const COPY_TEST_MODAL_HEIGHT = `calc(100vh - ${COPY_TEST_MODAL_VIEWPORT_MARGIN * 2}px)`;

/** 定义 COPY_TEST_MODAL_OVERFLOW 常量。 */
const COPY_TEST_MODAL_OVERFLOW = 'hidden';

/** CopyTest 入口卡片唯一 className。 */
export const COPY_TEST_TRIGGER_CLASS_NAME = 'copy-test-modal-trigger';

/** CopyTest 入口和弹窗的作用域属性。 */
export const COPY_TEST_RENDERER_SCOPE_ATTRIBUTE = 'data-copy-test-renderer-scope';

/** 判断点击目标是否是当前 CopyTest 实例的入口。 */
const isScopedTriggerClick = (
  target: EventTarget | null,
  ownerElement: HTMLElement | null
): boolean => {
  if (!(target instanceof Element) || !ownerElement) {
    return false;
  }

  const scope = ownerElement.closest(`[${COPY_TEST_RENDERER_SCOPE_ATTRIBUTE}]`);
  const trigger = target.closest(`.${COPY_TEST_TRIGGER_CLASS_NAME}`);
  return Boolean(scope && trigger && scope.contains(trigger));
};

/** 渲染 CopyTest 组件。 */
export const CopyTest: React.FC<CopyTestProps> = ({ open, onClose }) => {

  /** 定义 ownerRef 常量。 */
  const ownerRef = useRef<HTMLSpanElement>(null);

  /** 定义 [internalOpen, setInternalOpen] 常量。 */
  const [internalOpen, setInternalOpen] = useState(false);

  /** 定义 controlled 常量。 */
  const controlled = open !== undefined;

  /** 定义 modalOpen 常量。 */
  const modalOpen = controlled ? Boolean(open) : internalOpen;

  /** 定义 controller 常量。 */
  const controller = useCopyTestController({
    onClose: () => {
      if (!controlled) {
        setInternalOpen(false);
      }
      onClose?.();
    },
  });

  /** 定义 { tableState, uploadState } 常量。 */
  const { tableState, uploadState } = controller;

  /** 处理入口点击打开弹窗。 */
  const handleDocumentClick = useCallback((event: MouseEvent): void => {
    if (controlled || !isScopedTriggerClick(event.target, ownerRef.current)) {
      return;
    }

    setInternalOpen(true);
  }, [controlled]);

  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [handleDocumentClick]);

  return (
    <>
      <span ref={ownerRef} hidden />
      <Modal
      title="Copy Test"
      open={modalOpen}
      onCancel={controller.handleMainClose}
      width={COPY_TEST_MODAL_WIDTH}
      style={{ top: COPY_TEST_MODAL_VIEWPORT_MARGIN, paddingBottom: 0 }}
      styles={{
        wrapper: {
          overflow: COPY_TEST_MODAL_OVERFLOW,
        },
        content: {
          display: 'flex',
          flexDirection: 'column',
          height: COPY_TEST_MODAL_HEIGHT,
          overflow: COPY_TEST_MODAL_OVERFLOW,
        },
        body: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: COPY_TEST_MODAL_OVERFLOW,
        },
      }}
      footer={null}
    >
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
        <CopyTestImportBar
          confluenceUrl={controller.confluenceUrl}
          disabled={controller.importBusy}
          loading={controller.importLoading}
          onConfluenceUrlChange={controller.handleConfluenceUrlChange}
          onImport={controller.handleLoadTables}
        />

        {controller.importLoading && <CopyTestLoadingBlock />}

        {tableState.tables.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <CopyTestSelectors
              canExportToConfluence={controller.canExportToConfluence}
              canUpload={controller.canUpload}
              exporting={controller.exportLoading}
              onChooseImages={controller.handleChooseImages}
              onComparisonColumnChange={controller.handleComparisonColumnChange}
              onExportToConfluence={controller.handleExportToConfluence}
              onTableChange={controller.handleTableChange}
              preparingUpload={uploadState.preparingUpload}
              processing={controller.validationLoading}
              selectedColumnIndex={tableState.selectedColumnIndex}
              selectedTable={tableState.selectedTable}
              selectedTableIndex={tableState.selectedTableIndex}
              tables={tableState.tables}
            />

            {tableState.selectedTable && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <TablePreview
                  disabled={controller.validationLoading}
                  selectedColumnIndex={tableState.selectedColumnIndex}
                  selectedRowIndexes={tableState.selectedRowIndexes}
                  table={tableState.selectedTable}
                  onEvidenceImageDelete={controller.handleEvidenceImageDelete}
                  onEvidenceImagePreview={controller.handleEvidenceImagePreview}
                  onSelectedRowIndexesChange={tableState.setSelectedRowIndexes}
                />
              </div>
            )}
          </div>
        )}

        <UploadScreenshotModal
          canValidate={controller.canValidate}
          onClose={controller.handleCloseUploadModal}
          onFilesSelected={controller.handleFilesSelected}
          onRemoveImage={controller.handleRemoveUploadImage}
          onValidate={controller.handleValidateClick}
          open={controller.uploadModalOpen}
          preparingUpload={uploadState.preparingUpload}
          processing={controller.validationLoading}
          uploadImages={uploadState.uploadImages}
          uploadTotalSize={uploadState.uploadTotalSize}
        />
        <EvidenceImagePreview
          previewImage={controller.previewImage}
          onClose={controller.handleClosePreviewImage}
        />
        <Modal
          title={DELETE_EVIDENCE_IMAGE_CONFIRM_TITLE}
          open={Boolean(controller.deleteImageTarget)}
          onCancel={controller.handleCancelEvidenceImageDelete}
          onOk={controller.handleConfirmEvidenceImageDelete}
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          centered
        >
          <p>{DELETE_EVIDENCE_IMAGE_CONFIRM_CONTENT}</p>
        </Modal>
      </div>
      </Modal>
    </>
  );
};

export default CopyTest;
