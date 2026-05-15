import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRetryUtil } from '../retryUtils';
import {
  createHtmlPreviewApi,
  createHtmlShareApi,
  getHtmlPreviewContentApi,
  getHtmlShareByPreviewApi,
  getHtmlShareContentApi,
  updateHtmlShareStatusApi,
} from '../conversationHtmlPreviewApi';

vi.mock('../retryUtils', () => ({
  ApiRetryUtil: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('conversationHtmlPreviewApi', () => {
  const springboot3BaseUrl = import.meta.env.VITE_API_SPRINGBOOT3_URL || 'http://localhost:8080';

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates HTML previews against Spring Boot 3 without adding staffId', async () => {
    const response = { id: 'preview-1', htmlContent: null };
    vi.mocked(ApiRetryUtil.post).mockResolvedValueOnce(response as never);

    await expect(
      createHtmlPreviewApi({
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        htmlContent: '<html></html>',
      })
    ).resolves.toBe(response);

    expect(ApiRetryUtil.post).toHaveBeenCalledWith(
      `${springboot3BaseUrl}/conversation/html/preview`,
      {
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        htmlContent: '<html></html>',
      },
      undefined,
      'Failed to create HTML preview'
    );
  });

  it('creates HTML shares through Spring Boot 3 without adding staffId', async () => {
    const response = { id: 'share-1', previewId: 'preview-1', enabled: true };
    vi.mocked(ApiRetryUtil.post).mockResolvedValueOnce(response as never);

    await expect(
      createHtmlShareApi({
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        htmlContent: '<html></html>',
      })
    ).resolves.toBe(response);

    expect(ApiRetryUtil.post).toHaveBeenCalledWith(
      `${springboot3BaseUrl}/conversation/html/preview/share`,
      {
        conversationId: 'conversation-1',
        turnId: 'turn-1',
        htmlContent: '<html></html>',
      },
      undefined,
      'Failed to create HTML share'
    );
  });

  it('uses Spring Boot 3 URLs for read and status endpoints', async () => {
    vi.mocked(ApiRetryUtil.get)
      .mockResolvedValueOnce({ id: 'preview-1' } as never)
      .mockResolvedValueOnce({ id: 'share-1' } as never)
      .mockResolvedValueOnce({ id: 'share-1' } as never);
    vi.mocked(ApiRetryUtil.put).mockResolvedValueOnce({ id: 'share-1', enabled: false } as never);

    await getHtmlPreviewContentApi('preview-1');
    await updateHtmlShareStatusApi('share-1', { enabled: false });
    await getHtmlShareContentApi('share-1');
    await getHtmlShareByPreviewApi('preview-1');

    expect(ApiRetryUtil.get).toHaveBeenNthCalledWith(
      1,
      `${springboot3BaseUrl}/conversation/html/preview/preview-1`,
      undefined,
      'Failed to get HTML preview'
    );
    expect(ApiRetryUtil.put).toHaveBeenCalledWith(
      `${springboot3BaseUrl}/conversation/html/preview/share/share-1/status`,
      { enabled: false },
      undefined,
      'Failed to update HTML share status'
    );
    expect(ApiRetryUtil.get).toHaveBeenNthCalledWith(
      2,
      `${springboot3BaseUrl}/conversation/html/preview/share/share-1`,
      undefined,
      'Failed to get HTML share'
    );
    expect(ApiRetryUtil.get).toHaveBeenNthCalledWith(
      3,
      `${springboot3BaseUrl}/conversation/html/preview/share/preview/preview-1`,
      undefined,
      'Failed to get HTML share status'
    );
  });
});
