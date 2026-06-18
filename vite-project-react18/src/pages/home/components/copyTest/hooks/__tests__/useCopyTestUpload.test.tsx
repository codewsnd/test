import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

const createPngFile = (name = 'screen.png') => new File(['abc'], name, { type: 'image/png' });

describe('useCopyTestUpload', () => {
  it('prepares, deduplicates, removes, resets, and reports upload errors', async () => {
    installFileReaderMock();
    hoisted.md5.mockReturnValue('md5-a');
    const { result } = renderHook(() => useCopyTestUpload());
    act(() => {
      result.current.prepareUploadImages([], false);
      result.current.prepareUploadImages([createPngFile()], true);
      result.current.prepareUploadImages([new File(['x'], 'bad.txt', { type: 'text/plain' })], false);
    });
    expect(hoisted.messageWarning).toHaveBeenCalledWith('Please upload image files only');
    await act(() => result.current.prepareUploadImages([createPngFile()], false));
    expect(result.current.uploadImages[0].md5).toBe('md5-a');
    hoisted.md5.mockImplementationOnce(() => {
      throw new Error('md5 failed');
    });
    await act(() => result.current.prepareUploadImages([createPngFile('broken.png')], false));
    expect(hoisted.messageError).toHaveBeenCalledWith('Failed to prepare images');
    act(() => {
      result.current.removeUploadImage('md5-a');
      result.current.resetUploadState();
    });
    expect(result.current.uploadTotalSize).toBe(0);
  });
});
