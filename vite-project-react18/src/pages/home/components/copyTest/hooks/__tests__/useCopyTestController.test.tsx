import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyTestController } from '../useCopyTestController';

const hoisted = vi.hoisted(() => ({
  attachmentsApi: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  requestLoading: false,
  storageApi: vi.fn(),
  uploadApi: vi.fn(),
  uuid: vi.fn(),
  validationApi: vi.fn(),
}));

vi.mock('antd', () => ({
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
vi.mock('uuid', () => ({ v7: hoisted.uuid }));
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

const storageHtml = '<table><tr><th>Reference</th><th>Target</th></tr><tr><td>Hello</td><td>你好</td></tr></table>';

/** 用于竞态测试的可控异步结果。 */
interface Deferred<T> {
  /** 测试主动完成的 Promise。 */
  promise: Promise<T>;
  /** 主动以指定结果完成 Promise。 */
  resolve: (value: T) => void;
}

/** 创建由测试精确控制完成顺序的 Promise。 */
const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

/** 用于确认陈旧响应没有覆盖新会话的第二份 storage。 */
const secondStorageHtml = '<table><tr><th>Reference B</th><th>Target B</th></tr><tr><td>World</td><td>世界</td></tr></table>';

/** Confluence 页面或鉴权信息无效时展示的统一导入失败提示。 */
const CONFLUENCE_IMPORT_ERROR = 'Failed to load Confluence tables. Please check whether your Confluence URL or Confluence token is correct.';

/** 包含严格托管 Evidence 附件引用的有效 storage。 */
const managedEvidenceStorage = [
  '<table><tr><th>Target</th><th data-copy-test-schema="2" data-copy-test-column-type="result"',
  ' data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target">Test Result - Target</th>',
  '<th data-copy-test-schema="2" data-copy-test-column-type="evidence"',
  ' data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target">Test Evidence - Target</th></tr>',
  '<tr><td>copy</td><td data-copy-test-schema="2" data-copy-test-column-type="result"',
  ' data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target"></td>',
  '<td data-copy-test-schema="2" data-copy-test-column-type="evidence"',
  ' data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target">',
  '<ac:image><ri:attachment ri:filename="screen.png" /></ac:image>',
  '</td></tr></table>',
].join('');

/** 包含两个严格来源 Pair 和一个非托管业务附件的竞态测试 storage。 */
const twoManagedPairsStorage = [
  '<table><tr><th>Alpha</th>',
  '<th data-copy-test-schema="2" data-copy-test-column-type="result" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha">Test Result - Alpha</th>',
  '<th data-copy-test-schema="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha">Test Evidence - Alpha</th>',
  '<th>Beta</th>',
  '<th data-copy-test-schema="2" data-copy-test-column-type="result" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta">Test Result - Beta</th>',
  '<th data-copy-test-schema="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta">Test Evidence - Beta</th></tr>',
  '<tr><td>alpha<ac:image><ri:attachment ri:filename="business.png" /></ac:image></td>',
  '<td data-copy-test-schema="2" data-copy-test-column-type="result" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha"></td>',
  '<td data-copy-test-schema="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha"><ac:image><ri:attachment ri:filename="alpha.png" /></ac:image></td>',
  '<td>beta</td>',
  '<td data-copy-test-schema="2" data-copy-test-column-type="result" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta"></td>',
  '<td data-copy-test-schema="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta"><ac:image><ri:attachment ri:filename="beta.png" /></ac:image></td>',
  '</tr></table>',
].join('');

/** Alpha Pair 的最小附件响应图片。 */
const alphaImage = { base64: 'data:image/png;base64,QUxQSEE=', fileName: 'alpha.png' };

/** Beta Pair 的最小附件响应图片。 */
const betaImage = { base64: 'data:image/png;base64,QkVUQQ==', fileName: 'beta.png' };

const installBrowserMocks = (): void => {
  class MockFileReader {
    onload: (() => void) | null = null;
    result = 'data:image/png;base64,QUJD';
    readAsDataURL(file: File): void {
      if (file.name === 'second.png') {
        this.result = 'data:image/png;base64,REVG';
      }
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
    hoisted.uuid.mockReturnValue('uuid-value');
    installBrowserMocks();
  });

  it('covers import, upload, validate, export, evidence delete, and close flows', async () => {
    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.validationApi.mockResolvedValue([{
      evidenceImageFileNames: ['uuid-value.png'],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    }]);
    hoisted.uploadApi.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { result } = renderHook(() => useCopyTestController({ onClose }));

    await act(() => result.current.handleLoadTables());
    expect(result.current.importError).toBe(
      'Invalid URL format, Please enter a valid Http:// or https:// URL'
    );
    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    expect(result.current.tableState.tables).toHaveLength(1);
    expect(hoisted.messageSuccess).not.toHaveBeenCalled();
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.handleChooseImages();
    });
    expect(result.current.uploadModalOpen).toBe(true);
    await act(() => result.current.handleFilesSelected([
      new File(['abc'], '首页截图.png', { type: 'image/png' }),
    ]));
    await act(() => result.current.handleValidateClick());
    expect(hoisted.validationApi).toHaveBeenCalledTimes(1);
    expect(hoisted.validationApi.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      fileName: 'uuid-value.png',
      originalFileName: '首页截图.png',
    }));
    act(() => {
      result.current.handleResultStatusChange({
        imageId: 'uuid-value.png',
        instanceId: '1:Target:1:uuid-value.png',
        passed: false,
        previewRevision: result.current.tableState.revision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    expect(result.current.tableState.selectedTable?.workingHtml).toContain('Failed:');
    act(() => {
      result.current.handleExportToConfluence();
    });
    expect(result.current.exportConfirmOpen).toBe(true);
    expect(hoisted.uploadApi).not.toHaveBeenCalled();
    await act(() => result.current.handleConfirmExportToConfluence());
    expect(hoisted.uploadApi).toHaveBeenCalled();
    expect(result.current.exportConfirmOpen).toBe(false);
    act(() => {
      result.current.handleEvidenceImageDelete({
        imageId: 'missing',
        instanceId: '1:Target:1:missing',
      });
      result.current.handleConfirmEvidenceImageDelete();
      result.current.handleCancelEvidenceImageDelete();
      result.current.handleEvidenceImagePreview({ alt: 'screen', imageId: 'id', src: 'src' });
      result.current.handleClosePreviewImage();
      result.current.handleRemoveUploadImage('md5-首页截图.png');
      result.current.handleCloseUploadModal();
      result.current.handleTableChange(0);
      result.current.handleMainClose();
    });
    expect(result.current.exportConfirmOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('imports only storage and requests the selected strict Evidence Pair', async () => {
    hoisted.storageApi.mockResolvedValue({ storage: twoManagedPairsStorage });
    hoisted.attachmentsApi.mockResolvedValue({ images: [alphaImage, betaImage] });
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    expect(hoisted.attachmentsApi).not.toHaveBeenCalled();

    await act(() => result.current.handleComparisonColumnChange(0));

    expect(hoisted.attachmentsApi).toHaveBeenCalledWith({
      confluenceUrl: 'http://wiki',
      fileNames: ['alpha.png'],
    });
    expect(result.current.tableState.getCurrentPreviewImages()).toEqual([alphaImage]);
  });

  it('does not request attachments when the selected Pair has no Evidence files', async () => {
    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    await act(() => result.current.handleComparisonColumnChange(1));

    expect(hoisted.attachmentsApi).not.toHaveBeenCalled();
    expect(result.current.comparisonColumnLoading).toBe(false);
  });

  it('keeps the latest column loading and discards an older attachment response', async () => {
    const alphaRequest = createDeferred<{ images: typeof alphaImage[] }>();
    const betaRequest = createDeferred<{ images: typeof betaImage[] }>();
    hoisted.storageApi.mockResolvedValue({ storage: twoManagedPairsStorage });
    hoisted.attachmentsApi
      .mockReturnValueOnce(alphaRequest.promise)
      .mockReturnValueOnce(betaRequest.promise);
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());

    let alphaPromise!: Promise<void>;
    act(() => {
      alphaPromise = result.current.handleComparisonColumnChange(0);
    });
    expect(result.current.comparisonColumnLoading).toBe(true);
    expect(result.current.canUpload).toBe(false);

    let betaPromise!: Promise<void>;
    act(() => {
      betaPromise = result.current.handleComparisonColumnChange(3);
    });
    expect(hoisted.attachmentsApi.mock.calls[1][0]).toEqual({
      confluenceUrl: 'http://wiki',
      fileNames: ['beta.png'],
    });

    await act(async () => {
      alphaRequest.resolve({ images: [alphaImage] });
      await alphaPromise;
    });
    expect(result.current.comparisonColumnLoading).toBe(true);
    expect(result.current.tableState.getCurrentPreviewImages()).toEqual([]);

    await act(async () => {
      betaRequest.resolve({ images: [betaImage] });
      await betaPromise;
    });
    expect(result.current.comparisonColumnLoading).toBe(false);
    expect(result.current.tableState.selectedColumnIndex).toBe(3);
    expect(result.current.tableState.getCurrentPreviewImages()).toEqual([betaImage]);
  });

  it('keeps only the latest batch winner even when its content repeats', async () => {
    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.uuid
      .mockReturnValueOnce('uuid-a')
      .mockReturnValueOnce('uuid-b')
      .mockReturnValueOnce('uuid-c');
    hoisted.validationApi
      .mockResolvedValueOnce([{
        evidenceImageFileNames: ['uuid-a.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }])
      .mockResolvedValueOnce([{
        evidenceImageFileNames: ['uuid-b.png'],
        languageIssues: ['Second screenshot differs.'],
        passed: false,
        rowIndex: 0,
      }])
      .mockResolvedValueOnce([{
        evidenceImageFileNames: ['uuid-c.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }]);
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    await act(() => result.current.handleFilesSelected([
      new File(['first'], 'first.png', { type: 'image/png' }),
    ]));
    await act(() => result.current.handleValidateClick());
    await act(() => result.current.handleFilesSelected([
      new File(['second'], 'second.png', { type: 'image/png' }),
    ]));
    await act(() => result.current.handleValidateClick());
    await act(() => result.current.handleFilesSelected([
      new File(['first'], 'first-copy.png', { type: 'image/png' }),
    ]));
    await act(() => result.current.handleValidateClick());

    expect(hoisted.validationApi).toHaveBeenCalledTimes(3);
    expect(hoisted.validationApi.mock.calls[1][0].map(
      (uploadedImage: { fileName: string }) => uploadedImage.fileName
    )).toEqual(['uuid-b.png']);
    expect(hoisted.validationApi.mock.calls[2][0].map(
      (uploadedImage: { fileName: string }) => uploadedImage.fileName
    )).toEqual(['uuid-c.png']);
    expect(result.current.tableState.selectedTable?.workingHtml).not.toContain('uuid-a.png');
    expect(result.current.tableState.selectedTable?.workingHtml).not.toContain('uuid-b.png');
    expect(result.current.tableState.selectedTable?.workingHtml).toContain('uuid-c.png');
    expect(result.current.tableState.getCurrentValidationImages().map(
      uploadedImage => uploadedImage.fileName
    )).toEqual(['uuid-c.png']);
  });

  it('locks Result status changes throughout Confluence export preparation', async () => {
    const firstExportRead = createDeferred<{ storage: string }>();
    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.uploadApi.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => result.current.handleLoadTables());
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.tableState.applyValidationResults([{
        evidenceImageFileNames: ['screen.png'],
        evidenceImages: [{
          base64: 'data:image/png;base64,QUJD',
          fileName: 'screen.png',
        }],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [{
        base64: 'data:image/png;base64,QUJD',
        fileName: 'screen.png',
      }], 1, 'Target', 0);
    });
    /** 先只打开受控确认框，不立即执行导出。 */
    act(() => {
      result.current.handleExportToConfluence();
    });
    expect(result.current.exportConfirmOpen).toBe(true);
    expect(result.current.exportLoading).toBe(false);

    /** 确认前的合法状态变化必须成为随后导出的最新快照。 */
    act(() => {
      result.current.handleResultStatusChange({
        imageId: 'screen.png',
        instanceId: '1:Target:1:screen.png',
        passed: false,
        previewRevision: result.current.tableState.revision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    expect(result.current.tableState.selectedTable?.workingHtml).toContain('Failed:');
    const revisionBeforeExport = result.current.tableState.revision;
    const workingHtmlBeforeExport = result.current.tableState.selectedTable?.workingHtml;

    hoisted.storageApi.mockReset();
    hoisted.storageApi
      .mockImplementationOnce(() => firstExportRead.promise)
      .mockResolvedValue({ storage: storageHtml });

    let exportPromise!: Promise<void>;
    act(() => {
      exportPromise = result.current.handleConfirmExportToConfluence();
    });
    /** 等待同步导出锁进入 storage 第一次读取。 */
    await act(() => Promise.resolve());
    expect(result.current.exportLoading).toBe(true);
    act(() => {
      result.current.handleResultStatusChange({
        imageId: 'screen.png',
        instanceId: '1:Target:1:screen.png',
        passed: true,
        previewRevision: revisionBeforeExport,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    expect(result.current.tableState.revision).toBe(revisionBeforeExport);
    expect(result.current.tableState.selectedTable?.workingHtml).toBe(workingHtmlBeforeExport);

    firstExportRead.resolve({ storage: storageHtml });
    await act(() => exportPromise);
    expect(result.current.exportLoading).toBe(false);
    expect(result.current.exportConfirmOpen).toBe(false);
    expect(hoisted.uploadApi).toHaveBeenCalledTimes(1);
    const uploadRequest = hoisted.uploadApi.mock.calls[0][0] as { storageHtml: string };
    expect(uploadRequest.storageHtml).toContain('Failed:');

    /** 导出临界区结束后，新版本身份的状态操作恢复可用。 */
    act(() => {
      result.current.handleResultStatusChange({
        imageId: 'screen.png',
        instanceId: '1:Target:1:screen.png',
        passed: true,
        previewRevision: result.current.tableState.revision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    expect(result.current.tableState.selectedTable?.workingHtml).toContain('Passed:');
  });

  it('covers busy guards and failing request branches', async () => {
    hoisted.requestLoading = true;
    const busyClose = vi.fn();
    const busyHook = renderHook(() => useCopyTestController({ onClose: busyClose }));
    act(() => {
      busyHook.result.current.handleConfluenceUrlChange('http://wiki');
      busyHook.result.current.handleChooseImages();
      busyHook.result.current.handleCloseUploadModal();
      busyHook.result.current.handleMainClose();
    });
    await act(() => busyHook.result.current.handleLoadTables());
    expect(hoisted.storageApi).not.toHaveBeenCalled();
    expect(busyHook.result.current.importError).toBeUndefined();
    expect(busyClose).not.toHaveBeenCalled();
    busyHook.unmount();

    hoisted.requestLoading = false;
    hoisted.storageApi.mockRejectedValueOnce(new Error('load failed'));
    const failingHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));
    act(() => {
      failingHook.result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => failingHook.result.current.handleLoadTables());
    expect(failingHook.result.current.importError).toBe(CONFLUENCE_IMPORT_ERROR);
    expect(hoisted.messageError).not.toHaveBeenCalled();
    failingHook.unmount();

    hoisted.storageApi.mockResolvedValue({ storage: '<p>No table</p>' });
    const emptyTableHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));
    act(() => {
      emptyTableHook.result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => emptyTableHook.result.current.handleLoadTables());
    expect(emptyTableHook.result.current.importError).toBe('No valid table found');
    expect(hoisted.messageError).not.toHaveBeenCalled();
    emptyTableHook.unmount();

    hoisted.storageApi.mockResolvedValue({ storage: managedEvidenceStorage });
    hoisted.attachmentsApi.mockRejectedValueOnce(new Error('attachment failed'));
    const attachmentHook = renderHook(() => useCopyTestController({ onClose: vi.fn() }));
    act(() => {
      attachmentHook.result.current.handleConfluenceUrlChange('http://wiki');
    });
    await act(() => attachmentHook.result.current.handleLoadTables());
    expect(hoisted.attachmentsApi).not.toHaveBeenCalled();
    await act(() => attachmentHook.result.current.handleComparisonColumnChange(0));
    expect(attachmentHook.result.current.importError).toBeUndefined();
    expect(hoisted.messageError).toHaveBeenCalledWith('Failed to load Test Evidence attachments.');
    attachmentHook.unmount();

    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
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
      validationHook.result.current.handleEvidenceImageDelete({
        imageId: 'missing',
        instanceId: '1:Target:1:missing',
      });
    });
    act(() => {
      validationHook.result.current.handleConfirmEvidenceImageDelete();
    });
    expect(hoisted.messageWarning).toHaveBeenCalledWith('Screenshot cannot be deleted from the current table');
  });

  it('invalidates the loaded workspace immediately when the URL input changes', async () => {
    hoisted.storageApi.mockResolvedValue({ storage: storageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-a');
    });
    await act(() => result.current.handleLoadTables());
    act(() => {
      result.current.handleComparisonColumnChange(1);
      result.current.handleChooseImages();
    });
    expect(result.current.hasActiveImportedSession).toBe(true);
    expect(result.current.tableState.tables).toHaveLength(1);

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-b');
    });

    expect(result.current.hasActiveImportedSession).toBe(false);
    expect(result.current.tableState.tables).toEqual([]);
    expect(result.current.tableState.selectedTable).toBeUndefined();
    expect(result.current.canUpload).toBe(false);
    expect(result.current.canValidate).toBe(false);
    expect(result.current.uploadModalOpen).toBe(false);
  });

  it('invalidates the old workspace while a same-URL refresh import is pending', async () => {
    const refreshRequest = createDeferred<{ storage: string }>();
    hoisted.storageApi
      .mockResolvedValueOnce({ storage: storageHtml })
      .mockReturnValueOnce(refreshRequest.promise);
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-a');
    });
    await act(() => result.current.handleLoadTables());
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    let importPromise!: Promise<void>;
    act(() => {
      importPromise = result.current.handleLoadTables();
    });
    expect(result.current.hasActiveImportedSession).toBe(false);
    expect(result.current.tableState.tables).toEqual([]);
    expect(result.current.canUpload).toBe(false);

    await act(async () => {
      refreshRequest.resolve({ storage: secondStorageHtml });
      await importPromise;
    });
    expect(result.current.hasActiveImportedSession).toBe(true);
    expect(result.current.tableState.originalStorageHtml).toBe(secondStorageHtml);
  });

  it('ignores an older import response that resolves after a newer URL session', async () => {
    const staleRequest = createDeferred<{ storage: string }>();
    hoisted.storageApi
      .mockReturnValueOnce(staleRequest.promise)
      .mockResolvedValueOnce({ storage: secondStorageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-a');
    });
    let staleImportPromise!: Promise<void>;
    act(() => {
      staleImportPromise = result.current.handleLoadTables();
    });
    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-b');
    });
    await act(() => result.current.handleLoadTables());
    expect(result.current.tableState.originalStorageHtml).toBe(secondStorageHtml);

    await act(async () => {
      staleRequest.resolve({ storage: storageHtml });
      await staleImportPromise;
    });
    expect(result.current.hasActiveImportedSession).toBe(true);
    expect(result.current.confluenceUrl).toBe('http://wiki/page-b');
    expect(result.current.tableState.originalStorageHtml).toBe(secondStorageHtml);
  });

  it('ignores a validation response after importing a different URL session', async () => {
    const staleValidation = createDeferred<Array<{
      evidenceImageFileNames: string[];
      languageIssues: never[];
      passed: boolean;
      rowIndex: number;
    }>>();
    hoisted.storageApi
      .mockResolvedValueOnce({ storage: storageHtml })
      .mockResolvedValueOnce({ storage: secondStorageHtml });
    hoisted.attachmentsApi.mockResolvedValue({ images: [] });
    hoisted.validationApi.mockReturnValueOnce(staleValidation.promise);
    const { result } = renderHook(() => useCopyTestController({ onClose: vi.fn() }));

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-a');
    });
    await act(() => result.current.handleLoadTables());
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    await act(() => result.current.handleFilesSelected([
      new File(['abc'], 'screen.png', { type: 'image/png' }),
    ]));
    let validationPromise!: Promise<void>;
    act(() => {
      validationPromise = result.current.handleValidateClick();
    });
    expect(result.current.validationLoading).toBe(true);
    expect(hoisted.storageApi).toHaveBeenCalledTimes(1);

    await act(() => result.current.handleLoadTables());
    expect(hoisted.storageApi).toHaveBeenCalledTimes(1);
    expect(result.current.validationLoading).toBe(true);

    act(() => {
      result.current.handleConfluenceUrlChange('http://wiki/page-b');
    });
    await act(() => result.current.handleLoadTables());
    await act(async () => {
      staleValidation.resolve([{
        evidenceImageFileNames: ['screen-uuid-value.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }]);
      await validationPromise;
    });

    expect(result.current.hasActiveImportedSession).toBe(true);
    expect(result.current.tableState.originalStorageHtml).toBe(secondStorageHtml);
    expect(result.current.tableState.selectedColumnIndex).toBeUndefined();
    expect(result.current.tableState.selectedColumnHasExportableContent).toBe(false);
    expect(result.current.validationLoading).toBe(false);
    expect(hoisted.messageSuccess).not.toHaveBeenCalled();
    expect(hoisted.messageError).not.toHaveBeenCalled();
  });
});
