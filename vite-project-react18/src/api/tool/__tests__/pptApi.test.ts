import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/api/axios';
import { downloadPptFromBase64, generatePptApi } from '../pptApi';

vi.mock('@/api/axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('pptApi', () => {
  const backendBaseUrl = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081';

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('delegates ppt generation to axios.post', () => {
    const request = { font: 'Arial', pageCount: 3, title: 'Deck' };
    const response = { success: true, message: 'ok', fileName: 'deck.pptx' };

    vi.mocked(axios.post).mockResolvedValueOnce(response as never);

    return generatePptApi(request).then((result) => {
      expect(result).toBe(response);
      expect(axios.post).toHaveBeenCalledWith(`${backendBaseUrl}/api/ppt/generate`, request);
    });
  });

  it('downloads a ppt from base64 data', () => {
    const link = document.createElement('a');
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);
    const createObjectURL = vi.fn(() => 'blob:url');
    const revokeObjectURL = vi.fn();

    vi.stubGlobal('atob', vi.fn(() => 'AB'));
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    downloadPptFromBase64('QUI=', 'demo.pptx');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(link.href).toBe('blob:url');
    expect(link.download).toBe('demo.pptx');
    expect(appendSpy).toHaveBeenCalledWith(link);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(link);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('rethrows download errors after logging them', () => {
    const error = new Error('decode fail');

    vi.stubGlobal('atob', vi.fn(() => {
      throw error;
    }));

    expect(() => downloadPptFromBase64('bad', 'demo.pptx')).toThrow(error);
    expect(console.error).toHaveBeenCalledWith('下载 PPT 失败:', error);
  });
});
