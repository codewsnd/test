import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasConfluenceStorageChanged,
  mergeCopyTestExportImages,
  useCopyTestController,
} from '../useCopyTestController';

const hoisted = vi.hoisted(() => ({
  actionState: {
    canExportToConfluence: true,
    canUpload: true,
    canValidate: false,
    importBusy: false,
    uploadBusy: false,
  },
  messageWarning: vi.fn(),
  removeUploadImage: vi.fn(),
  sessionState: {
    originalStorageHtml: '',
    selectedColumnContext: null,
    selectedColumnHasExportableContent: true,
    selectedColumnIndex: 0,
    selectedRowIndexes: [0],
    selectedTable: { index: 0 },
  },
  uploadState: {
    preparingUpload: false,
    uploadImages: [{
      base64: 'data:image/png;base64,QUJD',
      fileName: 'screen.png',
      md5: 'screen-md5',
      size: 3,
    }],
  },
}));

vi.mock('antd', () => ({
  Modal: {
    confirm: (config: { onOk?: () => unknown }) => {
      config.onOk?.();
    },
  },
  message: {
    error: vi.fn(),
    success: vi.fn(),
    warning: hoisted.messageWarning,
  },
}));

vi.mock('ahooks', () => ({
  useRequest: () => ({ loading: false, runAsync: vi.fn() }),
}));

vi.mock('../../api/copyTestApi', () => ({
  copyTestAttachmentsApi: vi.fn(),
  copyTestStorageApi: vi.fn(),
  copyTestUploadApi: vi.fn(),
  copyTestValidationApi: vi.fn(),
}));

vi.mock('../../utils/copyTestActionState', () => ({
  buildCopyTestActionState: () => hoisted.actionState,
}));

vi.mock('../useCopyTestSession', () => ({
  useCopyTestSession: () => ({
    ...hoisted.sessionState,
    applyLoadedStorage: vi.fn(),
    applyValidationResults: vi.fn(),
    buildSelectedRowsForValidation: vi.fn(() => []),
    commitExportedStorage: vi.fn(),
    deleteEvidenceImage: vi.fn(() => ({ imageStillUsed: false, removed: false })),
    getCurrentValidationImages: vi.fn(() => []),
    handleComparisonColumnChange: vi.fn(),
    handleTableChange: vi.fn(),
    resetValidationSnapshots: vi.fn(),
    setSelectedRowIndexes: vi.fn(),
    tables: [],
  }),
}));

vi.mock('../useCopyTestUpload', () => ({
  useCopyTestUpload: () => ({
    ...hoisted.uploadState,
    prepareUploadImages: vi.fn(),
    removeUploadImage: hoisted.removeUploadImage,
    resetUploadState: vi.fn(),
    uploadTotalSize: 3,
  }),
}));

describe('useCopyTestController synchronous guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.sessionState.originalStorageHtml = '';
  });

  it('covers export storage and loaded URL guards', () => {
    const emptyStorageHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      emptyStorageHook.result.current.handleExportToConfluence();
    });
    expect(hoisted.messageWarning).toHaveBeenCalledWith('No Confluence storage to export');
    emptyStorageHook.unmount();

    hoisted.sessionState.originalStorageHtml = '<table></table>';
    const invalidUrlHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      invalidUrlHook.result.current.handleExportToConfluence();
    });
    expect(invalidUrlHook.result.current.importError).toBe(
      'In valid URL format, Please enter a valid Http:// or https:// URL'
    );
  });

  it('detects whether the raw Confluence storage changed', () => {
    expect(hasConfluenceStorageChanged('<table></table>', '<table></table>')).toBe(false);
    expect(hasConfluenceStorageChanged('<table></table>', '<table><tr></tr></table>')).toBe(true);
  });

  it('merges validated snapshots with new uploads and deduplicates by attachment file name', () => {
    const snapshotA = { base64: 'snapshot-a', fileName: 'a.png', md5: 'a-id' };
    const uploadB = { base64: 'upload-b', fileName: 'b.png', md5: 'b-id' };
    expect(mergeCopyTestExportImages([snapshotA], [uploadB])).toEqual([snapshotA, uploadB]);

    const replacedA = { base64: 'new-a', fileName: 'a.png', md5: 'new-a-id' };
    expect(mergeCopyTestExportImages([snapshotA], [replacedA])).toEqual([replacedA]);
  });

  it('removes an image that only exists in the current upload list', () => {
    hoisted.sessionState.originalStorageHtml = '<table></table>';
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleRemoveUploadImage('screen-md5');
    });

    expect(hoisted.removeUploadImage).toHaveBeenCalledWith('screen-md5');
  });
});
