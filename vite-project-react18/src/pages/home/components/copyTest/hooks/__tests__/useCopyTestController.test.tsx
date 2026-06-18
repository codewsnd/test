import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyTestController } from '../useCopyTestController';

const hoisted = vi.hoisted(() => ({
  attachmentsApi: vi.fn(),
  confirm: vi.fn((config: { onOk?: () => void }) => {
    config.onOk?.();
  }),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  requestLoading: false,
  storageApi: vi.fn(),
  uploadApi: vi.fn(),
  validationApi: vi.fn(),
}));

vi.mock('antd', () => ({
  Modal: { confirm: hoisted.confirm },
  message: {
    error: hoisted.messageError,
    success: hoisted.messageSuccess,
    warning: hoisted.messageWarning,
  },
}));

vi.mock('ahooks', () => ({
  useRequest: (service: (...args: unknown[]) => unknown) => ({
    loading: hoisted.requestLoading,
    runAsync: (...args: unknown[]) => service(...args),
  }),
}));

vi.mock('@/utils/fileUtils', () => ({ calculateFileMD5: (file: File) => `md5-${file.name}` }));
vi.mock('uuid', () => ({ v7: () => 'uuid-value' }));
vi.mock('../../api/copyTestApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../api/copyTestApi')>();
  return {
    ...actual,
    copyTestAttachmentsApi: hoisted.attachmentsApi,
    copyTestStorageApi: hoisted.storageApi,
    copyTestUploadApi: hoisted.uploadApi,
    copyTestValidationApi: hoisted.validationApi,
  };
});

const storageHtml = '<table><tr><th>Reference|values=hk_en|</th><th>Target</th></tr><tr><td>Hello</td><td>你好</td></tr></table>';

const installBrowserMocks = (): void => {
  class MockFileReader {
    onload: (() => void) | null = null;
    result = 'data:image/png;base64,QUJD';
    readAsDataURL(): void {
      this.onload?.();
    }
  }
  vi.stubGlobal('FileReader', MockFileReader);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
};

describe('useCopyTestController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.requestLoading = false;
    installBrowserMocks();
  });

  it('covers import, upload, validate, export, evidence delete, and close flows', async () => {
    hoisted.storageApi.mockResolvedValue({ confluenceTitle: 'Title', storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.validationApi.mockResolvedValue([{ evidenceImageFileNames: ['screen-uuid-value.png'], passed: true, rowIndex: 0 }]);
    hoisted.uploadApi.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { result } = renderHook(() => useCopyTestController({ onClose }));

    await act(() => result.current.handleLoadTables());
    expect(hoisted.messageError).toHaveBeenCalledWith('Please enter a valid Confluence URL');
    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    expect(result.current.tableState.tables).toHaveLength(1);
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.handleChooseImages();
    });
    expect(result.current.uploadModalOpen).toBe(true);
    await act(() => result.current.handleFilesSelected([new File(['abc'], 'screen.png', { type: 'image/png' })]));
    await act(() => result.current.handleValidateClick());
    expect(hoisted.validationApi).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.handleExportToConfluence();
    });
    await act(() => Promise.resolve());
    expect(hoisted.confirm).toHaveBeenCalled();
    expect(hoisted.uploadApi).toHaveBeenCalled();
    act(() => {
      result.current.handleEvidenceImageDelete({ imageId: 'missing' });
      result.current.handleConfirmEvidenceImageDelete();
      result.current.handleCancelEvidenceImageDelete();
      result.current.handleEvidenceImagePreview({ alt: 'screen', imageId: 'id', src: 'src' });
      result.current.handleClosePreviewImage();
      result.current.handleRemoveUploadImage('md5-screen.png');
      result.current.handleCloseUploadModal();
      result.current.handleTableChange(0);
      result.current.handleMainClose();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('covers busy guards and failing request branches', async () => {
    hoisted.requestLoading = true;
    const busyClose = vi.fn();
    const busyHook = renderHook(() => useCopyTestController({ onClose: busyClose }));
    act(() => {
      busyHook.result.current.handleChooseImages();
      busyHook.result.current.handleCloseUploadModal();
      busyHook.result.current.handleMainClose();
    });
    expect(busyClose).not.toHaveBeenCalled();
    busyHook.unmount();

    hoisted.requestLoading = false;
    hoisted.storageApi.mockRejectedValueOnce(new Error('load failed'));
    const failingHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));
    act(() => {
      failingHook.result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => failingHook.result.current.handleLoadTables());
    expect(hoisted.messageError).toHaveBeenCalledWith('Failed to load Confluence tables');

    hoisted.storageApi.mockResolvedValue({ confluenceTitle: 'Title', storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.validationApi.mockRejectedValueOnce(new Error('validate failed'));
    const validationHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));
    act(() => {
      validationHook.result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => validationHook.result.current.handleLoadTables());
    act(() => {
      validationHook.result.current.handleComparisonColumnChange(1);
      validationHook.result.current.handleExportToConfluence();
    });
    await act(() => validationHook.result.current.handleValidateClick());
    await act(() => validationHook.result.current.handleFilesSelected([new File(['abc'], 'screen.png', { type: 'image/png' })]));
    await act(() => validationHook.result.current.handleValidateClick());
    expect(hoisted.messageError).toHaveBeenCalledWith('Copy test validation failed');
    act(() => {
      validationHook.result.current.handleConfirmEvidenceImageDelete();
      validationHook.result.current.handleEvidenceImagePreview({ alt: 'screen', imageId: 'missing', src: 'src' });
      validationHook.result.current.handleEvidenceImageDelete({ imageId: 'missing' });
    });
    act(() => {
      validationHook.result.current.handleConfirmEvidenceImageDelete();
    });
    expect(hoisted.messageWarning).toHaveBeenCalledWith('Screenshot cannot be deleted from the current table');
  });
});
