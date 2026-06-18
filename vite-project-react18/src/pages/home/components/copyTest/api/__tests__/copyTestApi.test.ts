import { describe, expect, it, vi } from 'vitest';
import {
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  copyTestValidationApi,
} from '../copyTestApi';

const hoisted = vi.hoisted(() => ({
  aiChat: vi.fn(),
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock('@/api/axios', () => ({
  default: {
    get: hoisted.axiosGet,
    post: hoisted.axiosPost,
  },
}));

vi.mock('@/api', () => ({
  aiChat: hoisted.aiChat,
}));

vi.mock('@/utils/userUtils', () => ({
  getEmployeeId: () => 'staff-1',
}));

const image = { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' };

describe('copyTestApi', () => {
  it('calls storage, upload, attachment, and validation APIs with normalized model results', async () => {
    hoisted.axiosGet.mockReturnValue({ confluenceTitle: 'Title', storage: '<table />' });
    hoisted.axiosPost.mockReturnValue({ images: [image] });
    hoisted.aiChat.mockReturnValue({
      data: {
        content: JSON.stringify([
          {
            evidenceImageFileNames: ['screen-a.png', 'unknown.png'],
            evidenceRowSpan: 1,
            hideEvidenceCell: false,
            passed: true,
            rowIndex: 0,
          },
        ]),
      },
    });

    await copyTestStorageApi('http://wiki').then(response => expect(response.storage).toBe('<table />'));
    await copyTestAttachmentsApi({ confluenceUrl: 'http://wiki', fileNames: ['screen-a.png'] })
      .then(response => expect(response.images).toEqual([image]));
    await copyTestUploadApi({ confluenceUrl: 'http://wiki', images: [image], storageHtml: '<table />' }, percent => {
      expect(percent).toBe(50);
    });
    hoisted.axiosPost.mock.calls[1][2].onUploadProgress({ loaded: 5, total: 10 });

    await copyTestValidationApi([image], [
      { expected: 'copy', reference: 'ref', rowIndex: 0 },
      { expected: 'missing', rowIndex: 1 },
    ], 'Target', 'Reference').then(results => expect(results).toEqual([
      {
        evidenceImageFileNames: ['screen-a.png'],
        evidenceRowSpan: 1,
        hideEvidenceCell: false,
        languageIssues: undefined,
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceRowSpan: 1,
        hideEvidenceCell: false,
        languageIssues: ['AI validation did not return this selected row.'],
        passed: false,
        rowIndex: 1,
      },
    ]));

    hoisted.aiChat.mockReturnValueOnce({
      data: {
        content: [
          '```json',
          JSON.stringify({
            results: [{
              evidenceImageIndexes: [0, 'bad', 99],
              errorReason: 'Wrong language',
              hideEvidenceCell: false,
              passed: false,
              resultImageIndexes: [0],
              rowIndex: 0,
            }],
          }),
          '```',
        ].join('\n'),
      },
    });
    await copyTestValidationApi([image], [{ expected: 'copy', rowIndex: 0 }], 'Target').then(results => {
      expect(results[0].evidenceImageFileNames).toEqual(['screen-a.png']);
      expect(results[0].languageIssues).toEqual(['Wrong language']);
    });
    hoisted.aiChat.mockReturnValueOnce({ data: { content: '' } });
    await copyTestValidationApi([image], [{ expected: 'copy', rowIndex: 0 }], 'Target').catch(error => {
      expect((error as Error).message).toBe('AI validation returned empty content');
    });
  });
});
