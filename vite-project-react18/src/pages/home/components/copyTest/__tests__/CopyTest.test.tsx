import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CopyTest, {
  COPY_TEST_TRIGGER_CLASS_NAME,
} from '../CopyTest';

/** CopyTest 主弹窗标题。 */
const CONFLUENCE_URL_TITLE = 'Confluence URL';

const hoisted = vi.hoisted(() => ({
  /** CopyTest 本地文件导出门面的测试替身。 */
  exportCopyTestTable: vi.fn(),
  /** 当前 workingHtml 实际引用的最小 Evidence 图片。 */
  previewImage: { base64: 'data:image/png;base64,QUJD', fileName: 'screen.png' },
  controller: {
    canExportToConfluence: false,
    canUpload: false,
    canValidate: false,
    confluenceUrl: '',
    deleteImageTarget: { imageId: 'img' } as { imageId: string } | null,
    exportLoading: false,
    handleCancelEvidenceImageDelete: vi.fn(),
    handleChooseImages: vi.fn(),
    handleClosePreviewImage: vi.fn(),
    handleCloseUploadModal: vi.fn(),
    handleComparisonColumnChange: vi.fn(),
    handleConfirmEvidenceImageDelete: vi.fn(),
    handleConfluenceUrlChange: vi.fn(),
    handleEvidenceImageDelete: vi.fn(),
    handleEvidenceImagePreview: vi.fn(),
    handleExportToConfluence: vi.fn(),
    handleFilesSelected: vi.fn(),
    handleLoadTables: vi.fn(),
    handleMainClose: vi.fn(),
    handleRemoveUploadImage: vi.fn(),
    handleTableChange: vi.fn(),
    handleValidateClick: vi.fn(),
    hasActiveImportedSession: true,
    importBusy: false,
    importError: undefined as string | undefined,
    importLoading: true,
    previewImage: null,
    tableState: {
      getCurrentPreviewImages: vi.fn(() => [
        { base64: 'data:image/png;base64,QUJD', fileName: 'screen.png' },
      ]),
      getCurrentValidationImages: vi.fn(() => []),
      selectedColumnIndex: 1,
      selectedRowIndexes: [0],
      selectedTable: {
        headers: [],
        index: 0,
        workingHtml: '<table><tr><td>copy</td></tr></table>',
      } as { headers: never[]; index: number; workingHtml: string } | undefined,
      selectedTableIndex: 0,
      setSelectedRowIndexes: vi.fn(),
      tables: [{ headers: [], index: 0 }],
    },
    uploadModalOpen: false,
    uploadState: { preparingUpload: false, uploadImages: [], uploadTotalSize: 0 },
    validationLoading: false,
  },
}));

vi.mock('../export', () => ({
  exportCopyTestTable: hoisted.exportCopyTestTable,
}));

vi.mock('../hooks/useCopyTestController', () => ({
  useCopyTestController: ({ onClose }: { onClose: () => void }) => ({
    ...hoisted.controller,
    handleMainClose: () => {
      hoisted.controller.handleMainClose();
      onClose();
    },
  }),
}));

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
  Modal: ({ children, onCancel, onOk, open, title }: { children?: React.ReactNode; onCancel?: () => void; onOk?: () => void; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>cancel-{title}</button><button onClick={onOk}>ok-{title}</button>{children}</section>
  ) : null,
}));

vi.mock('../components', () => ({
  CopyTestImportBar: () => <div>import-bar</div>,
  CopyTestLoadingBlock: () => <div>loading-block</div>,
  CopyTestSelectors: ({ onExportFile }: {
    /** 按格式触发本地文件导出的组件测试回调。 */
    onExportFile: (format: 'pdf' | 'word' | 'excel') => void;
  }) => (
    <div>
      selectors
      <button onClick={() => onExportFile('pdf')}>export-pdf</button>
      <button onClick={() => onExportFile('word')}>export-word</button>
      <button onClick={() => onExportFile('excel')}>export-excel</button>
    </div>
  ),
  EvidenceImagePreview: () => <div>preview</div>,
  TablePreview: () => <div>table-preview</div>,
  UploadScreenshotModal: () => <div>upload-modal</div>,
}));

beforeEach(() => {
  hoisted.exportCopyTestTable.mockReset();
  hoisted.exportCopyTestTable.mockResolvedValue({
    fileName: '20260722150405.pdf',
  });
  hoisted.controller.hasActiveImportedSession = true;
  hoisted.controller.importError = undefined;
});

describe('CopyTest', () => {
  it('renders controlled modal children and handles close/delete callbacks', () => {
    render(<CopyTest open={true} onClose={vi.fn()} />);
    expect(screen.getByText(CONFLUENCE_URL_TITLE)).toBeTruthy();
    expect(screen.getByText('import-bar')).toBeTruthy();
    expect(screen.getByText('loading-block')).toBeTruthy();
    expect(screen.getByText('selectors')).toBeTruthy();
    expect(screen.getByText('table-preview')).toBeTruthy();
    fireEvent.click(screen.getByText('ok-Delete screenshot?'));
    fireEvent.click(screen.getByText('cancel-Delete screenshot?'));
    fireEvent.click(screen.getByText(`cancel-${CONFLUENCE_URL_TITLE}`));
    expect(hoisted.controller.handleConfirmEvidenceImageDelete).toHaveBeenCalledTimes(1);
    expect(hoisted.controller.handleCancelEvidenceImageDelete).toHaveBeenCalledTimes(1);
    expect(hoisted.controller.handleMainClose).toHaveBeenCalledTimes(1);
  });

  it('hides the imported table workspace while the URL input has an error', () => {
    hoisted.controller.importError = 'No valid table found';
    render(<CopyTest open={true} />);
    expect(screen.getByText('import-bar')).toBeTruthy();
    expect(screen.queryByText('selectors')).toBeNull();
    expect(screen.queryByText('table-preview')).toBeNull();
  });

  it('hides the stale table workspace when the input no longer has an active imported session', () => {
    hoisted.controller.hasActiveImportedSession = false;
    render(<CopyTest open={true} />);
    expect(screen.getByText('import-bar')).toBeTruthy();
    expect(screen.queryByText('selectors')).toBeNull();
    expect(screen.queryByText('table-preview')).toBeNull();
  });

  it.each(['pdf', 'word', 'excel'] as const)(
    'exports the selected working table and current preview images as %s',
    async format => {
      render(<CopyTest open={true} />);
      fireEvent.click(screen.getByText(`export-${format}`));

      await waitFor(() => {
        expect(hoisted.exportCopyTestTable).toHaveBeenCalledWith({
          format,
          images: [hoisted.previewImage],
          tableHtml: '<table><tr><td>copy</td></tr></table>',
        });
      });
      expect(hoisted.controller.handleExportToConfluence).not.toHaveBeenCalled();
    }
  );

  it('opens one uncontrolled modal from class triggers in any DOM position', () => {
    hoisted.controller.deleteImageTarget = null;
    hoisted.controller.importLoading = false;
    hoisted.controller.tableState = { ...hoisted.controller.tableState, selectedTable: undefined, tables: [] };
    const onClose = vi.fn();
    render(
      <div>
        <button>unrelated action</button>
        <button className={COPY_TEST_TRIGGER_CLASS_NAME}>open from button</button>
        <CopyTest onClose={onClose} />
        <div className={COPY_TEST_TRIGGER_CLASS_NAME}>
          <span>open from nested child</span>
        </div>
        <CopyTest onClose={onClose} />
      </div>
    );
    expect(screen.queryByText(CONFLUENCE_URL_TITLE)).toBeNull();
    fireEvent.click(screen.getByText('unrelated action'));
    expect(screen.queryByText(CONFLUENCE_URL_TITLE)).toBeNull();
    fireEvent.click(screen.getByText('open from button'));
    expect(screen.queryAllByText(CONFLUENCE_URL_TITLE)).toHaveLength(1);
    fireEvent.click(screen.getByText(`cancel-${CONFLUENCE_URL_TITLE}`));
    expect(screen.queryByText(CONFLUENCE_URL_TITLE)).toBeNull();
    fireEvent.click(screen.getByText('open from nested child'));
    expect(screen.queryAllByText(CONFLUENCE_URL_TITLE)).toHaveLength(1);
    fireEvent.click(screen.getByText(`cancel-${CONFLUENCE_URL_TITLE}`));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
