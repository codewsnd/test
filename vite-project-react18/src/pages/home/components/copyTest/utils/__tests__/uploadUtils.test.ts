import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendUniqueImage,
  fileToMemoryImage,
  filesToMemoryImages,
  formatFileSize,
  getImageLimitError,
  getRawFilesTotalSize,
  getTotalImageSize,
  getUploadLimitError,
  isImageFile,
  readFileAsBase64,
} from '../uploadUtils';

vi.mock('uuid', () => ({ v7: () => 'uuid-value' }));
vi.mock('@/utils/fileUtils', () => ({ calculateFileMD5: (file: File) => `md5-${file.name}` }));

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

describe('uploadUtils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates files and converts unique memory images', async () => {
    installFileReaderMock();
    const pngFile = new File(['x'], 'screen.png', { type: 'image/png' });
    const txtFile = new File(['x'], 'note.txt', { type: 'text/plain' });
    expect(isImageFile(pngFile)).toBe(true);
    expect(isImageFile(new File(['x'], 'screen.webp', { type: '' }))).toBe(true);
    expect(isImageFile(txtFile)).toBe(false);
    expect(getTotalImageSize([{ size: 1 }, { size: 2 }])).toBe(3);
    expect(getRawFilesTotalSize([pngFile, txtFile])).toBe(2);
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB');
    expect(getUploadLimitError([txtFile])).toBe('Please upload image files only');
    expect(getUploadLimitError(Array.from({ length: 51 }, (_, index) => new File(['x'], `${index}.png`, { type: 'image/png' })))).toContain('no more');
    expect(getUploadLimitError([new File(['x'.repeat(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' })])).toContain('10 MB');
    expect(getUploadLimitError([pngFile])).toBeNull();
    expect(getImageLimitError(Array.from({ length: 51 }, () => ({ size: 1 })))).toContain('no more');
    expect(getImageLimitError([{ size: 11 * 1024 * 1024 }])).toContain('10 MB');
    expect(getImageLimitError([{ size: 1 }])).toBeNull();
    const uniqueImages = [{ base64: 'a', fileName: 'a.png', md5: '1', size: 1 }];
    appendUniqueImage(uniqueImages, new Set(['1']), { base64: 'b', fileName: 'b.png', md5: '1', size: 1 });
    appendUniqueImage(uniqueImages, new Set(['1']), { base64: 'c', fileName: 'c.png', md5: '2', size: 1 });
    expect(uniqueImages.map(image => image.fileName)).toEqual(['a.png', 'c.png']);
    expect(await readFileAsBase64(pngFile)).toBe('data:image/png;base64,QUJD');
    expect((await fileToMemoryImage(pngFile)).fileName).toBe('uuid-value.png');
    expect(await filesToMemoryImages([pngFile, pngFile])).toHaveLength(1);
  });

  it('uses an ASCII-only internal name for files whose original name contains Chinese', async () => {
    installFileReaderMock();
    const chineseFile = new File(['x'], '首页截图.png', { type: 'image/png' });
    const unicodeExtensionFile = new File(['x'], '截图.图片', { type: 'image/png' });

    const image = await fileToMemoryImage(chineseFile);
    const imageWithoutSafeExtension = await fileToMemoryImage(unicodeExtensionFile);

    expect(image).toEqual(expect.objectContaining({
      fileName: 'uuid-value.png',
      originalFileName: '首页截图.png',
    }));
    expect(image.fileName).toMatch(/^[\x20-\x7e]+$/);
    expect(imageWithoutSafeExtension.fileName).toBe('uuid-value');
  });
});
