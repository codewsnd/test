import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CopyTest, {
  COPY_TEST_RENDERER_SCOPE_ATTRIBUTE,
  COPY_TEST_TRIGGER_CLASS_NAME,
} from '../CopyTest';

const hoisted = vi.hoisted(() => ({
  controller: {
    canExportToConfluence: false,
    canUpload: false,
    canValidate: false,
    confluenceUrl: '',
    deleteImageTarget: { imageId: 'img' },
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
    importBusy: false,
    importLoading: true,
    previewImage: null,
    tableState: {
      selectedColumnIndex: 1,
      selectedRowIndexes: [0],
      selectedTable: { headers: [], index: 0 },
      selectedTableIndex: 0,
      setSelectedRowIndexes: vi.fn(),
      tables: [{ headers: [], index: 0 }],
    },
    uploadBusy: false,
    uploadModalOpen: false,
    uploadState: { preparingUpload: false, uploadImages: [], uploadTotalSize: 0 },
    validationLoading: false,
  },
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
  Modal: ({ children, onCancel, onOk, open, title }: { children?: React.ReactNode; onCancel?: () => void; onOk?: () => void; open?: boolean; title?: string }) => open ? (
    <section><h2>{title}</h2><button onClick={onCancel}>cancel-{title}</button><button onClick={onOk}>ok-{title}</button>{children}</section>
  ) : null,
}));

vi.mock('../components', () => ({
  CopyTestImportBar: () => <div>import-bar</div>,
  CopyTestLoadingBlock: () => <div>loading-block</div>,
  CopyTestSelectors: () => <div>selectors</div>,
  EvidenceImagePreview: () => <div>preview</div>,
  TablePreview: () => <div>table-preview</div>,
  UploadScreenshotModal: () => <div>upload-modal</div>,
}));

describe('CopyTest', () => {
  it('renders controlled modal children and handles close/delete callbacks', () => {
    render(<CopyTest open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Copy Test')).toBeTruthy();
    expect(screen.getByText('import-bar')).toBeTruthy();
    expect(screen.getByText('loading-block')).toBeTruthy();
    expect(screen.getByText('selectors')).toBeTruthy();
    expect(screen.getByText('table-preview')).toBeTruthy();
    fireEvent.click(screen.getByText('ok-Delete screenshot?'));
    fireEvent.click(screen.getByText('cancel-Delete screenshot?'));
    fireEvent.click(screen.getByText('cancel-Copy Test'));
    expect(hoisted.controller.handleConfirmEvidenceImageDelete).toHaveBeenCalledTimes(1);
    expect(hoisted.controller.handleCancelEvidenceImageDelete).toHaveBeenCalledTimes(1);
    expect(hoisted.controller.handleMainClose).toHaveBeenCalledTimes(1);
  });

  it('opens uncontrolled modal from scoped trigger', () => {
    hoisted.controller.deleteImageTarget = null;
    hoisted.controller.importLoading = false;
    hoisted.controller.tableState = { ...hoisted.controller.tableState, selectedTable: undefined, tables: [] };
    const { container } = render(
      <div {...{ [COPY_TEST_RENDERER_SCOPE_ATTRIBUTE]: 'true' }}>
        <button className={COPY_TEST_TRIGGER_CLASS_NAME}>open copy test</button>
        <CopyTest />
      </div>
    );
    expect(screen.queryByText('Copy Test')).toBeNull();
    fireEvent.click(container.querySelector(`.${COPY_TEST_TRIGGER_CLASS_NAME}`) as Element);
    expect(screen.getByText('Copy Test')).toBeTruthy();
  });
});
