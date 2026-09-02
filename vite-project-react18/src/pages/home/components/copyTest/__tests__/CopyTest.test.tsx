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
  /** 先后选择两个 Comparison Column 后累计的会话缓存。 */
  previewImages: [
    { base64: 'data:image/png;base64,QUxQSEE=', fileName: 'alpha.png' },
    { base64: 'data:image/png;base64,QkVUQQ==', fileName: 'beta.png' },
  ],
  controller: {
    canExportToConfluence: false,
    canUpload: false,
    canValidate: false,
    comparisonColumnLoading: false,
    confluenceUrl: '',
    deleteImageTarget: { imageId: 'img' } as { imageId: string } | null,
    exportConfirmOpen: false,
    exportLoading: false,
    handleCancelEvidenceImageDelete: vi.fn(),
    handleCancelExportToConfluence: vi.fn(),
    handleChooseImages: vi.fn(),
    handleClosePreviewImage: vi.fn(),
    handleCloseUploadModal: vi.fn(),
    handleComparisonColumnChange: vi.fn(),
    handleConfirmEvidenceImageDelete: vi.fn(),
    handleConfirmExportToConfluence: vi.fn(),
    handleConfluenceUrlChange: vi.fn(),
    handleEvidenceImageDelete: vi.fn(),
    handleEvidenceImagePreview: vi.fn(),
    handleResultStatusChange: vi.fn(),
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
        { base64: 'data:image/png;base64,QUxQSEE=', fileName: 'alpha.png' },
        { base64: 'data:image/png;base64,QkVUQQ==', fileName: 'beta.png' },
      ]),
      getCurrentValidationImages: vi.fn(() => []),
      revision: 1,
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
  Modal: ({ children, onCancel, onOk, open, title }: { children?: React.ReactNode; onCancel?: () => void; onOk?: () => void | Promise<void>; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>cancel-{title}</button><button onClick={onOk}>ok-{title}</button>{children}</section>
  ) : null,
}));

vi.mock('../components', () => ({
  CopyTestImportBar: () => <div>import-bar</div>,
  CopyTestLoadingBlock: ({ label }: { label?: string }) => (
    <div>{label || 'loading-block'}</div>
  ),
  CopyTestSelectors: ({ onExportFile, onExportToConfluence }: {
    /** 按格式触发本地文件导出的组件测试回调。 */
    onExportFile: (format: 'pdf' | 'word' | 'excel') => void;
    /** 打开 Confluence 受控导出确认框的回调。 */
    onExportToConfluence: () => void;
  }) => (
    <div>
      selectors
      <button onClick={() => onExportFile('pdf')}>export-pdf</button>
      <button onClick={() => onExportFile('word')}>export-word</button>
      <button onClick={() => onExportFile('excel')}>export-excel</button>
      <button onClick={onExportToConfluence}>export-confluence</button>
    </div>
  ),
  EvidenceImagePreview: () => <div>preview</div>,
  TablePreview: () => <div>table-preview</div>,
  UploadScreenshotModal: () => <div>upload-modal</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.exportCopyTestTable.mockReset();
  hoisted.exportCopyTestTable.mockResolvedValue({
    fileName: '20260722150405.pdf',
  });
  hoisted.controller.hasActiveImportedSession = true;
  hoisted.controller.importError = undefined;
  hoisted.controller.comparisonColumnLoading = false;
  hoisted.controller.exportConfirmOpen = false;
  hoisted.controller.exportLoading = false;
  hoisted.controller.importLoading = true;
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

  it('replaces the table preview with explicit attachment loading feedback', () => {
    hoisted.controller.importLoading = false;
    hoisted.controller.comparisonColumnLoading = true;

    render(<CopyTest open={true} />);

    expect(screen.getByText('Loading Test Evidence attachments...')).toBeTruthy();
    expect(screen.queryByText('table-preview')).toBeNull();
  });

  it.each(['pdf', 'word', 'excel'] as const)(
    'exports all cached Comparison Column images as %s',
    async format => {
      render(<CopyTest open={true} />);
      fireEvent.click(screen.getByText(`export-${format}`));

      await waitFor(() => {
        expect(hoisted.exportCopyTestTable).toHaveBeenCalledWith({
          format,
          images: hoisted.previewImages,
          tableHtml: '<table><tr><td>copy</td></tr></table>',
        });
      });
      expect(hoisted.controller.tableState.getCurrentPreviewImages).toHaveBeenCalled();
      expect(hoisted.controller.handleExportToConfluence).not.toHaveBeenCalled();
    }
  );

  it('routes Confluence export through the controlled confirmation modal', () => {
    const view = render(<CopyTest open={true} />);

    expect(screen.queryByText('Confirm export')).toBeNull();
    fireEvent.click(screen.getByText('export-confluence'));
    expect(hoisted.controller.handleExportToConfluence).toHaveBeenCalledTimes(1);

    hoisted.controller.exportConfirmOpen = true;
    view.rerender(<CopyTest open={true} />);
    expect(screen.getByText('Confirm export')).toBeTruthy();
    expect(screen.getByText(
      'This operation will update the table in your Confluence page. Are you sure you want to proceed?'
    )).toBeTruthy();

    fireEvent.click(screen.getByText('cancel-Confirm export'));
    fireEvent.click(screen.getByText('ok-Confirm export'));
    expect(hoisted.controller.handleCancelExportToConfluence).toHaveBeenCalledTimes(1);
    expect(hoisted.controller.handleConfirmExportToConfluence).toHaveBeenCalledTimes(1);
  });

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
