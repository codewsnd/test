import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from '@/api/axios';
import { GET_TOOL_LIST } from '@/api/tool/api';
import { getAllToolsApi, getAllToolsApi2 } from '../toolApi';

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('toolApi', () => {
  it('returns the local tool list after the mocked delay', () => {
    vi.useFakeTimers();
    const result = getAllToolsApi();

    vi.runAllTimers();

    return result.then((tools) => {
      expect(tools).toHaveLength(9);
      expect(tools[0].tool_name).toBe('python_data_analysis');
      expect(tools[8].is_hidden_in_tool).toBe(true);
    });
  });

  it('delegates getAllToolsApi2 to axios.get', () => {
    const response = [{ id: 1 }];

    vi.mocked(axios.get).mockReturnValueOnce(response as never);

    return getAllToolsApi2().then((result) => {
      expect(axios.get).toHaveBeenCalledWith(`${GET_TOOL_LIST}?usecache=false`);
      expect(result).toBe(response);
    });
  });
});
