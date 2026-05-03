import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { springboot3BackendApi } from '@/api/axios';
import { aiChat } from '@/api';
import { message } from 'antd';
import { getEmployeeId } from '@/utils/userUtils';
import { mergeChineseQualityIssues } from '@/utils/chineseUtils';
import {
  copyDeckStorageApi,
  getAttachmentsApi,
  groupedIntelligentMatchApi,
  languageCompareApi,
  singleTableIntelligentMatchApi,
  uploadStorageApi,
} from '../copyDeckApi';

vi.mock('@/api/axios', () => ({
  springboot3BackendApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/api', () => ({
  aiChat: vi.fn(),
}));

vi.mock('@/utils/userUtils', () => ({
  getEmployeeId: vi.fn(() => 'staff-1'),
}));

vi.mock('@/utils/chineseUtils', () => ({
  mergeChineseQualityIssues: vi.fn((differences) => differences),
}));

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
  },
}));

describe('copyDeckApi', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('delegates storage, upload and attachment requests with staffId', () => {
    const storageResponse = { storage: '<p />', confluenceTitle: 'title' };
    const uploadResponse = { success: true, message: 'ok' };
    const attachmentResponse = { images: [{ fileName: 'a.png', base64: 'Zg==' }] };
    const uploadData = {
      confluenceUrl: 'https://page',
      storageHtml: '<p>body</p>',
      images: [{ fileName: 'a.png', base64: 'Zg==' }],
    };
    const attachmentData = {
      confluenceUrl: 'https://page',
      fileNames: ['a.png'],
    };

    vi.mocked(springboot3BackendApi.get).mockReturnValueOnce(storageResponse as never);
    vi.mocked(springboot3BackendApi.post)
      .mockReturnValueOnce(uploadResponse as never)
      .mockReturnValueOnce(attachmentResponse as never);

    return copyDeckStorageApi('https://page')
      .then((storage) => {
        expect(storage).toBe(storageResponse);
        expect(getEmployeeId).toHaveBeenCalledTimes(1);
        expect(springboot3BackendApi.get).toHaveBeenCalledWith(
          '/api/chatbycard/copydeck/storage',
          { params: { confluenceUrl: 'https://page', staffId: 'staff-1' } },
        );
        return uploadStorageApi(uploadData);
      })
      .then((upload) => {
        expect(upload).toBe(uploadResponse);
        expect(springboot3BackendApi.post).toHaveBeenNthCalledWith(
          1,
          '/api/chatbycard/copydeck/upload',
          { ...uploadData, staffId: 'staff-1' },
        );
        return getAttachmentsApi(attachmentData);
      })
      .then((attachments) => {
        expect(attachments).toBe(attachmentResponse);
        expect(getEmployeeId).toHaveBeenCalledTimes(3);
        expect(springboot3BackendApi.post).toHaveBeenNthCalledWith(
          2,
          '/api/chatbycard/copydeck/getAttachments',
          { ...attachmentData, staffId: 'staff-1' },
        );
      });
  });

  it('builds grouped intelligent match requests and parses markdown wrapped JSON', () => {
    const images = [
      { fileName: 'one.png', base64: 'data:image/png;base64,AAA' },
      { fileName: 'two.png', base64: 'BBB' },
    ];
    const groupedData = [
      {
        group: 'Login',
        rows: [{ customId: '1', copyValue: 'Username' }],
      },
    ];
    const parsed = [
      {
        fileName: 'one.png',
        ocrContent: 'Username',
        group: 'Login',
        rows: [{ customId: 1, copy: 'Username', matchRate: '100', passed: true }],
      },
    ];

    vi.mocked(aiChat).mockReturnValueOnce({
      data: { content: `\`\`\`json\n${JSON.stringify(parsed)}\n\`\`\`` },
    } as never);

    return groupedIntelligentMatchApi(images, groupedData).then((result) => {
      expect(result).toEqual(parsed);
      expect(aiChat).toHaveBeenCalledWith({
        modelName: 'gpt-4-all',
        documents: [{
          base64url: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB'],
          type: 'image',
        }],
        messages: [{
          role: 'user',
          content: expect.stringContaining('Match 1 groups to 2 images'),
        }],
      });
    });
  });

  it('returns null for grouped intelligent match invalid response, invalid json and request failure', () => {
    const images = [{ fileName: 'one.png', base64: 'AAA' }];
    const groupedData = [{ group: 'Login', rows: [{ customId: '1', copyValue: 'Username' }] }];
    const requestError = new Error('boom');

    vi.mocked(aiChat)
      .mockReturnValueOnce({} as never)
      .mockReturnValueOnce({ data: { content: 'not-json' } } as never)
      .mockImplementationOnce(() => {
        throw requestError;
      });

    return groupedIntelligentMatchApi(images, groupedData)
      .then((first) => {
        expect(first).toBeNull();
        return groupedIntelligentMatchApi(images, groupedData);
      })
      .then((second) => {
        expect(second).toBeNull();
        return groupedIntelligentMatchApi(images, groupedData);
      })
      .then((third) => {
        expect(third).toBeNull();
        expect(message.error).toHaveBeenCalledWith('API Call error, please try again.');
        expect(console.error).toHaveBeenCalled();
      });
  });

  it('groups single-table rows and returns parsed matches', () => {
    const images = [{ fileName: 'single.png', base64: 'CCC' }];
    const selectedRows = [
      { customId: '4', copyValue: 'Fourth' },
      { customId: '2', copyValue: 'Second' },
      { customId: '1', copyValue: 'First' },
    ];
    const parsed = [
      {
        matchRow: [1, 2],
        fileName: 'single.png',
        ocrContent: 'First Second',
        rows: [
          { customId: 1, copy: 'First', matchRate: '100', passed: true },
          { customId: 2, copy: 'Second', matchRate: '100', passed: true },
        ],
      },
    ];

    vi.mocked(aiChat).mockReturnValueOnce({
      data: { content: JSON.stringify(parsed) },
    } as never);

    return singleTableIntelligentMatchApi(images, selectedRows).then((result) => {
      expect(result).toEqual(parsed);
      expect(aiChat).toHaveBeenCalledWith({
        modelName: 'gpt-4-all',
        documents: [{
          base64url: ['data:image/png;base64,CCC'],
          type: 'image',
        }],
        messages: [{
          role: 'user',
          content: expect.stringContaining('"type": "consecutive"'),
        }],
      });
      expect(String(vi.mocked(aiChat).mock.calls[0]?.[0]?.messages?.[0]?.content)).toContain('"type": "individual"');
    });
  });

  it('returns null for single-table failures', () => {
    vi.mocked(aiChat).mockImplementationOnce(() => {
      throw new Error('single-fail');
    });

    return singleTableIntelligentMatchApi(
      [{ fileName: 'single.png', base64: 'CCC' }],
      [{ customId: '1', copyValue: 'First' }],
    ).then((result) => {
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Single table intelligent match API error:',
        expect.any(Error),
      );
    });
  });

  it('normalizes language compare issues and merges chinese quality differences', () => {
    const request = {
      referenceLanguage: 'en',
      selectedLanguage: 'zh-cn',
      comparisonData: [
        { rowIndex: 1, referenceValue: 'Save', targetValue: '保存' },
        { rowIndex: 2, referenceValue: 'Delete', targetValue: '删除' },
      ],
    };
    const merged = [{ rowIndex: 9, targetValue: '合并后', reasons: [{ type: 'Grammar', reason: 'ok' }] }];

    vi.mocked(aiChat).mockReturnValueOnce({
      data: {
        content: `\`\`\`json
${JSON.stringify([
  {
    rowIndex: 1,
    targetValue: '保存',
    reasons: [
      { type: ' semantic ', reason: ' semantic reason ' },
      { type: 'grammar', reason: 'grammar reason' },
      null,
      { type: 'grammar', reason: 1 },
    ],
  },
  {
    rowIndex: 2,
    targetValue: '删除',
    reasons: [
      { type: 'punctuation', reason: 'punctuation reason' },
      { type: 'character', reason: 'character reason' },
      { type: 'unknown', reason: 'skip' },
      { type: 'semantic', reason: '   ' },
      { type: 1, reason: 'bad' },
    ],
  },
  { rowIndex: 3, targetValue: 'x', reasons: [{ type: 'unknown', reason: 'skip' }] },
  { rowIndex: 1.2, targetValue: 'bad', reasons: [] },
  { rowIndex: 4, targetValue: 4, reasons: [] },
  { rowIndex: 5, targetValue: 'x', reasons: 'bad' },
  null,
])}
\`\`\``,
      },
    } as never);
    vi.mocked(mergeChineseQualityIssues).mockReturnValueOnce(merged as never);

    return languageCompareApi(request).then((result) => {
      expect(aiChat).toHaveBeenCalledWith({
        modelName: 'gpt-4-all',
        messages: [{
          role: 'user',
          content: expect.stringContaining('Analyze 2 text pairs'),
        }],
      });
      expect(mergeChineseQualityIssues).toHaveBeenCalledWith(
        [
          {
            rowIndex: 1,
            targetValue: '保存',
            reasons: [
              { type: 'Semantic', reason: 'semantic reason' },
              { type: 'Grammar', reason: 'grammar reason' },
            ],
          },
          {
            rowIndex: 2,
            targetValue: '删除',
            reasons: [
              { type: 'Punctuation', reason: 'punctuation reason' },
              { type: 'Character', reason: 'character reason' },
            ],
          },
        ],
        request.comparisonData,
        'zh-cn',
      );
      expect(result).toEqual({ differences: merged });
    });
  });

  it('returns merged empty language compare results for non-array payloads', () => {
    const request = {
      referenceLanguage: 'en',
      selectedLanguage: 'zh-cn',
      comparisonData: [{ rowIndex: 1, referenceValue: 'Save', targetValue: '保存' }],
    };

    vi.mocked(aiChat).mockReturnValueOnce({
      data: { content: '{}' },
    } as never);
    vi.mocked(mergeChineseQualityIssues).mockReturnValueOnce([] as never);

    return languageCompareApi(request).then((result) => {
      expect(mergeChineseQualityIssues).toHaveBeenCalledWith([], request.comparisonData, 'zh-cn');
      expect(result).toEqual({ differences: [] });
    });
  });

  it('returns null for language compare invalid response, parse failure and request failure', () => {
    const request = {
      referenceLanguage: 'en',
      selectedLanguage: 'zh-cn',
      comparisonData: [{ rowIndex: 1, referenceValue: 'Save', targetValue: '保存' }],
    };

    vi.mocked(aiChat)
      .mockReturnValueOnce({ data: {} } as never)
      .mockReturnValueOnce({ data: { content: 'invalid-json' } } as never)
      .mockImplementationOnce(() => {
        throw new Error('language-fail');
      });

    return languageCompareApi(request)
      .then((first) => {
        expect(first).toBeNull();
        return languageCompareApi(request);
      })
      .then((second) => {
        expect(second).toBeNull();
        return languageCompareApi(request);
      })
      .then((third) => {
        expect(third).toBeNull();
        expect(message.error).toHaveBeenCalledWith('Language comparison API error, please try again.');
        expect(console.error).toHaveBeenCalled();
      });
  });
});
