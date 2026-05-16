import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRetryUtil } from '../retryUtils';
import { pageConversationsApi } from '../conversationHistoryApi';

vi.mock('../retryUtils', () => ({
  ApiRetryUtil: {
    get: vi.fn(),
  },
}));

describe('conversationHistoryApi', () => {
  const springboot3BaseUrl = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8082';

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the first page with default page and size query params', async () => {
    const response = { content: [] };
    vi.mocked(ApiRetryUtil.get).mockResolvedValueOnce(response as never);

    await expect(pageConversationsApi()).resolves.toBe(response);

    expect(ApiRetryUtil.get).toHaveBeenCalledWith(
      `${springboot3BaseUrl}/conversations/histories`,
      { params: { page: 1, size: 50 } },
      'Failed to fetch conversations page. Please refresh the page.'
    );
  });

  it('uses one-based page params when paging is provided', async () => {
    const response = { content: [] };
    vi.mocked(ApiRetryUtil.get).mockResolvedValueOnce(response as never);

    await expect(pageConversationsApi(2, 50, ' demo ')).resolves.toBe(response);

    expect(ApiRetryUtil.get).toHaveBeenCalledWith(
      `${springboot3BaseUrl}/conversations/histories`,
      { params: { page: 2, size: 50, search: 'demo' } },
      'Failed to fetch conversations page. Please refresh the page.'
    );
  });
});
