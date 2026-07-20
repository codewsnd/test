import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyTestUpload } from '../useCopyTestUpload';

const hoisted = vi.hoisted(() => ({
  md5: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
}));

vi.mock('@/utils/fileUtils', () => ({ calculateFileMD5: hoisted.md5 }));
vi.mock('antd', () => ({ message: { error: hoisted.messageError, warning: hoisted.messageWarning } }));
vi.mock('uuid', () => ({ v7: () => 'uuid-value' }));

const installFileReaderMock = (): void => {
  class MockFileReader {
    onload: (() => void) | null = null;
    result = 'data:image/png;base64,QUJD';
    readAsDataURL(): void {
      this.onload?.();
    }
  }
  vi.stubGlobal('FileReader', MockFileReader);
};

/** 创建一张最小 PNG 测试文件。 */
const createPngFile = (name = 'screen.png') => new File(['abc'], name, { type: 'image/png' });

/** 创建由测试显式完成的 MD5 Promise。 */
const createDeferredMd5 = () => {
  /** 完成 MD5 Promise 的函数。 */
  let resolveMd5 = (value: string): void => {
    void value;
  };
  /** 等待测试提供摘要值的 Promise。 */
  const promise = new Promise<string>(resolve => {
    resolveMd5 = resolve;
  });
  return { promise, resolve: resolveMd5 };
};

describe('useCopyTestUpload', () => {
  beforeEach(() => {
    hoisted.md5.mockReset();
    hoisted.messageError.mockReset();
    hoisted.messageWarning.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepares, deduplicates, removes, resets, and reports upload errors', async () => {
    installFileReaderMock();
    hoisted.md5.mockResolvedValue('md5-a');
    const { result } = renderHook(() => useCopyTestUpload());
    act(() => {
      result.current.prepareUploadImages([], false);
      result.current.prepareUploadImages([createPngFile()], true);
      result.current.prepareUploadImages([new File(['x'], 'bad.txt', { type: 'text/plain' })], false);
    });
    expect(hoisted.messageWarning).toHaveBeenCalledWith('Please upload image files only');
    await act(() => result.current.prepareUploadImages([createPngFile()], false));
    expect(result.current.uploadImages[0].md5).toBe('md5-a');
    hoisted.md5.mockRejectedValueOnce(new Error('md5 failed'));
    await act(() => result.current.prepareUploadImages([createPngFile('broken.png')], false));
    expect(hoisted.messageError).toHaveBeenCalledWith('Failed to prepare images');
    act(() => {
      result.current.removeUploadImage('md5-a');
      result.current.resetUploadState();
    });
    expect(result.current.uploadTotalSize).toBe(0);
  });

  it('merges prepared images against the latest list without restoring a removed image', async () => {
    installFileReaderMock();
    hoisted.md5.mockResolvedValueOnce('md5-a');
    const { result } = renderHook(() => useCopyTestUpload());

    await act(() => result.current.prepareUploadImages([createPngFile('a.png')], false));
    expect(result.current.uploadImages.map(image => image.md5)).toEqual(['md5-a']);

    /** 控制第二张图片何时完成摘要计算。 */
    const pendingMd5 = createDeferredMd5();
    hoisted.md5.mockReturnValueOnce(pendingMd5.promise);
    /** 等待第二张图片完成准备的任务。 */
    let pendingPreparation = Promise.resolve();
    act(() => {
      pendingPreparation = result.current.prepareUploadImages([createPngFile('b.png')], false);
    });
    expect(result.current.preparingUpload).toBe(true);

    act(() => {
      result.current.removeUploadImage('md5-a');
    });
    expect(result.current.uploadImages).toEqual([]);

    await act(async () => {
      pendingMd5.resolve('md5-b');
      await pendingPreparation;
    });
    expect(result.current.uploadImages.map(image => image.md5)).toEqual(['md5-b']);
    expect(result.current.preparingUpload).toBe(false);
  });

  it('discards an unfinished preparation after upload state is reset', async () => {
    installFileReaderMock();
    /** 控制待取消图片何时完成摘要计算。 */
    const pendingMd5 = createDeferredMd5();
    hoisted.md5.mockReturnValueOnce(pendingMd5.promise);
    const { result } = renderHook(() => useCopyTestUpload());
    /** 重置前仍在运行的图片准备任务。 */
    let pendingPreparation = Promise.resolve();

    act(() => {
      pendingPreparation = result.current.prepareUploadImages([createPngFile()], false);
    });
    expect(result.current.preparingUpload).toBe(true);
    act(() => {
      result.current.resetUploadState();
    });

    await act(async () => {
      pendingMd5.resolve('stale-md5');
      await pendingPreparation;
    });
    expect(result.current.uploadImages).toEqual([]);
    expect(result.current.preparingUpload).toBe(false);
  });
});
