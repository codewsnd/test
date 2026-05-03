import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { springboot3Api } from '@/api/axios';
import { getEmployeeId } from '@/utils/userUtils';
import {
  exportApi,
  getIssueLabels,
  listJiraIssueLabels,
  saveTestCaseStatistics,
} from '../testCaseApi';

vi.mock('@/api/axios', () => ({
  springboot3Api: {
    post: vi.fn(),
  },
}));

vi.mock('@/utils/userUtils', () => ({
  getEmployeeId: vi.fn(() => 'staff-1'),
}));

describe('testCaseApi', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns exported mock issues after the mocked delay', () => {
    vi.useFakeTimers();
    const result = exportApi();

    vi.runAllTimers();

    return result.then((issues) => {
      expect(issues).toEqual([
        { testCaseId: 'TC-001', description: 'https://www.baiud.com/PHP-123' },
        { testCaseId: 'TC-002', description: 'https://www.baiud.com/JAVA-123' },
      ]);
    });
  });

  it('saves statistics and returns issue labels after the mocked delay', () => {
    const payload = {
      staffId: 'staff-1',
      sessionId: 'session-1',
      generatedType: 'JIRA' as const,
      uploadMode: 'SINGLE' as const,
      totalGeneratedCount: 1,
      acceptedWithoutChangeCount: 1,
      acceptedWithChangeCount: 0,
      rejectedCount: 0,
    };
    const postResponse = { ok: true };

    vi.useFakeTimers();
    vi.mocked(springboot3Api.post).mockReturnValueOnce(postResponse as never);

    return saveTestCaseStatistics(payload)
      .then((result) => {
        expect(result).toBe(postResponse);
        expect(springboot3Api.post).toHaveBeenCalledWith('/test-case/statistics', payload);
        const labelsPromise = getIssueLabels();
        vi.runAllTimers();
        return labelsPromise;
      })
      .then((labels) => {
        expect(labels).toHaveLength(8);
        expect(labels[0]).toEqual({ value: 'bug', label: 'Bug' });
        expect(labels[7]).toEqual({ value: 'security', label: 'Security' });
      });
  });

  it('returns an empty label list when almType is missing', () => {
    return listJiraIssueLabels('', 'bug').then((labels) => {
      expect(labels).toEqual([]);
      expect(springboot3Api.post).not.toHaveBeenCalled();
    });
  });

  it('maps jira label results, handles non-array responses, and catches failures', () => {
    vi.mocked(springboot3Api.post)
      .mockReturnValueOnce(['bug', 'feature'] as never)
      .mockReturnValueOnce({ value: 'bug' } as never)
      .mockImplementationOnce(() => {
        throw new Error('query-fail');
      });

    return listJiraIssueLabels('jira', 'bu')
      .then((first) => {
        expect(first).toEqual([
          { label: 'bug', value: 'bug' },
          { label: 'feature', value: 'feature' },
        ]);
        expect(springboot3Api.post).toHaveBeenNthCalledWith(1, '/api/tolsquery/querylabels', {
          almType: 'jira',
          staffId: 'staff-1',
          query: 'bu',
        });
        expect(getEmployeeId).toHaveBeenCalledTimes(1);
        return listJiraIssueLabels('jira', 'xx');
      })
      .then((second) => {
        expect(second).toEqual([]);
        return listJiraIssueLabels('jira', 'err');
      })
      .then((third) => {
        expect(third).toEqual([]);
        expect(console.error).toHaveBeenCalledWith(
          'Failed to query jira issue labels:',
          expect.any(Error),
        );
      });
  });
});
