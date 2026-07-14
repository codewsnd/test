import { describe, expect, it, vi } from 'vitest';
import {
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  copyTestValidationApi,
  parseCopyTestValidationResults,
  type CopyTestValidationResult,
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

const images = [
  { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' },
  { base64: 'data:image/png;base64,REVG', fileName: 'screen-b.png' },
];

const rows = [
  { expected: 'copy 1', rowIndex: 0 },
  { expected: 'copy 2', rowIndex: 1 },
  { expected: 'copy 3', rowIndex: 4 },
];

const buildValidResult = (
  overrides: Partial<CopyTestValidationResult> = {}
): CopyTestValidationResult => ({
  evidenceRowSpan: 1,
  hideEvidenceCell: false,
  passed: true,
  rowIndex: 0,
  ...overrides,
});

describe('copyTestApi strict validation contract', () => {
  it('calls adapters with data image URLs and the strict prompt request', () => {
    const validationContent = JSON.stringify([
      buildValidResult({ evidenceImageFileNames: ['screen-a.png'] }),
    ]);
    hoisted.axiosGet.mockReturnValue({ storage: '<table />' });
    hoisted.axiosPost.mockReturnValue({ images });
    hoisted.aiChat.mockReturnValue({ data: { content: validationContent } });
    const onProgress = vi.fn();

    void copyTestStorageApi('http://wiki');
    void copyTestAttachmentsApi({ confluenceUrl: 'http://wiki', fileNames: ['screen-a.png'] });
    void copyTestUploadApi({ confluenceUrl: 'http://wiki', images, storageHtml: '<table />' }, onProgress);
    hoisted.axiosPost.mock.calls[1][2].onUploadProgress({ loaded: 5, total: 10 });
    void copyTestValidationApi([images[0]], [rows[0]], 'Target');

    expect(hoisted.axiosGet).toHaveBeenCalledWith(expect.stringContaining('/storage'), {
      params: { confluenceUrl: 'http://wiki', staffId: 'staff-1' },
    });
    expect(hoisted.axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/getAttachments'),
      { confluenceUrl: 'http://wiki', fileNames: ['screen-a.png'], staffId: 'staff-1' }
    );
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(hoisted.aiChat).toHaveBeenCalledWith(expect.objectContaining({
      documents: [{ base64url: ['data:image/png;base64,QUJD'], type: 'image' }],
      messages: [expect.objectContaining({
        content: expect.not.stringContaining('reference'),
        role: 'user',
      })],
    }));
  });

  it('accepts only exact rows, uploaded image names, and explicit Evidence groups', () => {
    const content = JSON.stringify([
      {
        evidenceImageFileNames: ['screen-a.png'],
        evidenceRowSpan: 2,
        hideEvidenceCell: false,
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: ['screen-a.png'],
        hideEvidenceCell: true,
        languageIssues: ['Visible wording differs.'],
        passed: false,
        rowIndex: 1,
      },
      {
        evidenceRowSpan: 1,
        hideEvidenceCell: false,
        languageIssues: ['Expected copy is missing.'],
        passed: false,
        rowIndex: 4,
      },
    ]);

    expect(parseCopyTestValidationResults(content, images, rows)).toEqual(JSON.parse(content));
    expect(parseCopyTestValidationResults('[]', images, [])).toEqual([]);
  });

  it('rejects legacy wrappers, fallback fields, row repair, and malformed field types', () => {
    const twoRows = rows.slice(0, 2);
    const unsupportedFields = [
      'failureReason',
      'errorReason',
      'reason',
      'evidenceImageIndexes',
      'resultImageIndexes',
    ];
    unsupportedFields.forEach(fieldName => {
      const item = { ...buildValidResult(), [fieldName]: fieldName === 'reason' ? 'wrong' : [0] };
      expect(() => parseCopyTestValidationResults(JSON.stringify([item]), images, [rows[0]]))
        .toThrow('unsupported field');
    });

    const invalidCases: Array<{ content: string; requestedRows: typeof rows }> = [
      { content: '```json\n[]\n```', requestedRows: [] },
      { content: JSON.stringify({ results: [] }), requestedRows: [] },
      { content: JSON.stringify([buildValidResult()]), requestedRows: twoRows },
      {
        content: JSON.stringify([
          buildValidResult({ rowIndex: 1 }),
          buildValidResult({ rowIndex: 0 }),
        ]),
        requestedRows: twoRows,
      },
      { content: JSON.stringify([null]), requestedRows: [rows[0]] },
      {
        content: JSON.stringify([{ evidenceRowSpan: 1, hideEvidenceCell: false, passed: 'true', rowIndex: 0 }]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([{ evidenceRowSpan: 1, passed: true, rowIndex: 0 }]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ passed: false })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ languageIssues: ['not allowed'] })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ evidenceImageFileNames: ['unknown.png'] })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ evidenceImageFileNames: [] })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ evidenceRowSpan: 0 })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([{ hideEvidenceCell: false, passed: true, rowIndex: 0 }]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([{ hideEvidenceCell: true, passed: true, rowIndex: 0 }]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([
          buildValidResult({ evidenceImageFileNames: ['screen-a.png'], evidenceRowSpan: 2 }),
          buildValidResult({
            evidenceImageFileNames: ['screen-a.png'],
            evidenceRowSpan: 1,
            hideEvidenceCell: true,
            rowIndex: 1,
          }),
        ]),
        requestedRows: twoRows,
      },
      {
        content: JSON.stringify([
          buildValidResult({ evidenceImageFileNames: ['screen-a.png'], evidenceRowSpan: 2 }),
          {
            evidenceImageFileNames: ['screen-b.png'],
            hideEvidenceCell: true,
            passed: true,
            rowIndex: 1,
          },
        ]),
        requestedRows: twoRows,
      },
      {
        content: JSON.stringify([buildValidResult({ evidenceRowSpan: 2 })]),
        requestedRows: [rows[0]],
      },
      {
        content: JSON.stringify([buildValidResult({ rowIndex: 0.5 })]),
        requestedRows: [rows[0]],
      },
    ];

    invalidCases.forEach(({ content, requestedRows }) => {
      expect(() => parseCopyTestValidationResults(content, images, requestedRows)).toThrow();
    });
  });
});
