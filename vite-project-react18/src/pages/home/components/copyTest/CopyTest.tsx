/**
 * 文件作用：组装 CopyTest 弹窗、控制主要 UI 区域和确认弹窗。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { message, Modal } from 'antd';
import {
  CopyTestImportBar,
  CopyTestLoadingBlock,
  CopyTestSelectors,
  EvidenceImagePreview,
  TablePreview,
  UploadScreenshotModal,
} from './components';
import {
  exportCopyTestTable,
  type CopyTestFileExportFormat,
} from './export';
import { useCopyTestController } from './hooks/useCopyTestController';
import type { CopyTestProps } from './types';

/** Evidence 图片删除确认弹窗的标题。 */
const DELETE_EVIDENCE_IMAGE_CONFIRM_TITLE = 'Delete screenshot?';

/** Evidence 图片删除确认弹窗的风险提示。 */
const DELETE_EVIDENCE_IMAGE_CONFIRM_CONTENT = 'This screenshot will be removed from Test Evidence and the matching Test Result entries.';

/** Confluence 导出确认弹窗的标题。 */
const EXPORT_CONFIRM_TITLE = 'Confirm export';

/** Confluence 导出确认弹窗的风险提示。 */
const EXPORT_CONFIRM_CONTENT = 'This operation will update the table in your Confluence page. Are you sure you want to proceed?';

/** CopyTest 弹窗与视口四周保留的像素间距。 */
const COPY_TEST_MODAL_VIEWPORT_MARGIN = 20;

/** 扣除视口间距后的 CopyTest 弹窗宽度。 */
const COPY_TEST_MODAL_WIDTH = `calc(100vw - ${COPY_TEST_MODAL_VIEWPORT_MARGIN * 2}px)`;

/** 扣除视口间距后的 CopyTest 弹窗高度。 */
const COPY_TEST_MODAL_HEIGHT = `calc(100vh - ${COPY_TEST_MODAL_VIEWPORT_MARGIN * 2}px)`;

/** 弹窗各层容器共用的溢出策略。 */
const COPY_TEST_MODAL_OVERFLOW = 'hidden';

/** 本地文件导出失败时显示的统一提示。 */
const COPY_TEST_FILE_EXPORT_ERROR_MESSAGE = 'Failed to export the selected table';

/** Comparison Column 的已有 Evidence 附件加载说明。 */
const COPY_TEST_ATTACHMENT_LOADING_LABEL = 'Loading Test Evidence attachments...';

/** 点击后打开 CopyTest 弹窗的 className。 */
export const COPY_TEST_TRIGGER_CLASS_NAME = 'copy-test-modal-trigger';

/** 判断点击目标或其父元素是否绑定了 CopyTest 入口 className。 */
const isTriggerClick = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest(`.${COPY_TEST_TRIGGER_CLASS_NAME}`));
};

/** 非受控 CopyTest 实例的弹窗打开回调。 */
type CopyTestModalOpener = () => void;

/** 当前页面中可响应 className 入口的 CopyTest 实例。 */
const copyTestModalOpeners = new Set<CopyTestModalOpener>();

/** 将一次入口点击交给一个 CopyTest 实例，避免多个弹窗同时打开。 */
const handleCopyTestTriggerClick = (event: MouseEvent): void => {
  if (!isTriggerClick(event.target)) {
    return;
  }

  const openModal = copyTestModalOpeners.values().next().value;
  openModal?.();
};

/** 注册非受控 CopyTest 实例，所有实例共用一个 document 点击监听。 */
const subscribeToCopyTestTrigger = (openModal: CopyTestModalOpener): (() => void) => {
  copyTestModalOpeners.add(openModal);
  if (copyTestModalOpeners.size === 1) {
    document.addEventListener('click', handleCopyTestTriggerClick);
  }

  return () => {
    copyTestModalOpeners.delete(openModal);
    if (copyTestModalOpeners.size === 0) {
      document.removeEventListener('click', handleCopyTestTriggerClick);
    }
  };
};

/** 渲染 CopyTest 组件。 */
export const CopyTest: React.FC<CopyTestProps> = ({ open, onClose }) => {
  /** 非受控模式下的弹窗显示状态。 */
  const [internalOpen, setInternalOpen] = useState(false);

  /** 是否由外部 open 属性控制弹窗。 */
  const controlled = open !== undefined;

  /** 结合受控与非受控模式得到的最终显示状态。 */
  const modalOpen = controlled ? Boolean(open) : internalOpen;

  /** CopyTest 业务状态与用户操作控制器。 */
  const controller = useCopyTestController({
    onClose: () => {
      if (!controlled) {
        setInternalOpen(false);
      }
      onClose?.();
    },
  });

  /** 当前表格会话与上传流程状态。 */
  const { tableState, uploadState } = controller;

  /** PDF、Word 或 Excel 文件当前是否正在生成。 */
  const [fileExporting, setFileExporting] = useState(false);

  /** 当前完整工作表是否允许下载到本地文件。 */
  const canExportFile = Boolean(tableState.selectedTable)
    && !controller.importBusy
    && !controller.comparisonColumnLoading
    && !controller.validationLoading
    && !controller.exportLoading
    && !fileExporting;

  /** 仅在导入结果有效时展示已导入的表格工作区。 */
  const showTableWorkspace = controller.hasActiveImportedSession
    && !controller.importError
    && tableState.tables.length > 0;

  /** 打开当前非受控弹窗。 */
  const openFromTrigger = useCallback((): void => {
    setInternalOpen(true);
  }, []);

  /** 使用点击瞬间的 workingHtml 和当前 Evidence 图片下载选中表格。 */
  const handleExportFile = useCallback(async (
    format: CopyTestFileExportFormat
  ): Promise<void> => {
    /** 点击时锁定的当前选中工作表。 */
    const selectedTable = tableState.selectedTable;
    if (!selectedTable || fileExporting) {
      return;
    }

    setFileExporting(true);
    try {
      await exportCopyTestTable({
        format,
        images: tableState.getCurrentPreviewImages(),
        tableHtml: selectedTable.workingHtml,
      });
    } catch (error) {
      console.error('CopyTest file export failed:', error);
      message.error(COPY_TEST_FILE_EXPORT_ERROR_MESSAGE);
    } finally {
      setFileExporting(false);
    }
  }, [fileExporting, tableState]);

  useEffect(() => {
    if (controlled) {
      return undefined;
    }

    return subscribeToCopyTestTrigger(openFromTrigger);
  }, [controlled, openFromTrigger]);

  return (
    <Modal
      title="Confluence URL"
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
          error={controller.importError}
          loading={controller.importLoading}
          onConfluenceUrlChange={controller.handleConfluenceUrlChange}
          onImport={controller.handleLoadTables}
        />

        {controller.importLoading && <CopyTestLoadingBlock />}

        {showTableWorkspace && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <CopyTestSelectors
              canExportFile={canExportFile}
              canExportToConfluence={controller.canExportToConfluence}
              canUpload={controller.canUpload}
              comparisonColumnLoading={controller.comparisonColumnLoading}
              exporting={controller.exportLoading}
              fileExporting={fileExporting}
              onChooseImages={controller.handleChooseImages}
              onComparisonColumnChange={controller.handleComparisonColumnChange}
              onExportFile={handleExportFile}
              onExportToConfluence={controller.handleExportToConfluence}
              onTableChange={controller.handleTableChange}
              preparingUpload={uploadState.preparingUpload}
              processing={controller.validationLoading}
              selectedColumnIndex={tableState.selectedColumnIndex}
              selectedTable={tableState.selectedTable}
              selectedTableIndex={tableState.selectedTableIndex}
              tables={tableState.tables}
            />

            {controller.comparisonColumnLoading && (
              <CopyTestLoadingBlock label={COPY_TEST_ATTACHMENT_LOADING_LABEL} />
            )}

            {!controller.comparisonColumnLoading && tableState.selectedTable && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <TablePreview
                  disabled={controller.validationLoading || controller.comparisonColumnLoading}
                  images={tableState.getCurrentPreviewImages()}
                  selectedColumnIndex={tableState.selectedColumnIndex}
                  selectedRowIndexes={tableState.selectedRowIndexes}
                  table={tableState.selectedTable}
                  onEvidenceImageDelete={controller.handleEvidenceImageDelete}
                  onEvidenceImagePreview={controller.handleEvidenceImagePreview}
                  onResultStatusChange={controller.handleResultStatusChange}
                  onSelectedRowIndexesChange={tableState.setSelectedRowIndexes}
                  previewRevision={tableState.revision}
                  resultStatusDisabled={
                    controller.comparisonColumnLoading
                    || controller.exportLoading
                    || fileExporting
                  }
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
          title={EXPORT_CONFIRM_TITLE}
          open={controller.exportConfirmOpen}
          onCancel={controller.handleCancelExportToConfluence}
          onOk={controller.handleConfirmExportToConfluence}
          okText="Confirm"
          cancelText="Cancel"
          confirmLoading={controller.exportLoading}
        >
          <p>{EXPORT_CONFIRM_CONTENT}</p>
        </Modal>
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
  );
};

export default CopyTest;
