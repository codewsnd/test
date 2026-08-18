import { describe, expect, it, vi } from 'vitest';
import {
  buildCopyTestValidationRequest,
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  parseCopyTestValidationResponse,
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
  { base64: 'data:image/png;base64,R0hJ', fileName: 'screen-c.png' },
];

const rows = [
  { evidenceGroupId: 0, expected: '你好', rowIndex: 0 },
  { evidenceGroupId: 0, expected: '我在', rowIndex: 1 },
  { evidenceGroupId: 4, expected: '吃饭', rowIndex: 4 },
];

const buildValidResult = (
  overrides: Partial<CopyTestValidationResult> = {}
): CopyTestValidationResult => ({
  evidenceImageFileNames: ['screen-a.png'],
  languageIssues: [],
  passed: true,
  rowIndex: 0,
  ...overrides,
});

const buildContent = (results: unknown[]): string => {
  return JSON.stringify({ results });
};

describe('copyTestApi strict validation contract', () => {
  it('calls adapters and silences only Confluence import requests', () => {
    hoisted.axiosGet.mockReturnValue({ storage: '<table />' });
    hoisted.axiosPost.mockReturnValue({ images });
    const onProgress = vi.fn();

    void copyTestStorageApi('http://wiki');
    void copyTestAttachmentsApi({ confluenceUrl: 'http://wiki', fileNames: ['screen-a.png'] });
    void copyTestUploadApi(
      { confluenceUrl: 'http://wiki', images, storageHtml: '<table />' },
      onProgress
    );
    hoisted.axiosPost.mock.calls[1][2].onUploadProgress({ loaded: 5, total: 10 });
    hoisted.axiosPost.mock.calls[1][2].onUploadProgress({ loaded: 5 });

    expect(hoisted.axiosGet).toHaveBeenCalledWith(expect.stringContaining('/storage'), {
      params: { confluenceUrl: 'http://wiki', staffId: 'staff-1' },
      skipError: true,
    });
    expect(hoisted.axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/getAttachments'),
      { confluenceUrl: 'http://wiki', fileNames: ['screen-a.png'], staffId: 'staff-1' },
      { skipError: true }
    );
    expect(hoisted.axiosPost.mock.calls[1][2]).not.toEqual(
      expect.objectContaining({ skipError: true })
    );
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(50);

    /** 用于核对 system/user 消息分离契约的校验请求。 */
    const request = buildCopyTestValidationRequest([images[0]], [rows[0]], 'Target');
    expect(request.modelName).toBe('gpt-5.4');
    expect(request.documents).toEqual([
      { base64url: ['data:image/png;base64,QUJD'], type: 'image' },
    ]);
    expect(request.messages).toHaveLength(2);
    expect(request.messages[0]).toEqual(expect.objectContaining({
      content: expect.stringContaining('Do not decide table merges'),
      role: 'system',
    }));
    expect(JSON.parse(request.messages[1].content)).toEqual({
      selectedRows: [{ evidenceGroupId: 0, expectedText: '你好', rowIndex: 0 }],
      targetColumnName: 'Target',
      uploadedScreenshots: [{ fileName: 'screen-a.png' }],
    });
    expect(request.messages[1].role).toBe('user');
  });

  it('accepts one shared image per group and excludes an unrelated screenshot', () => {
    const content = buildContent([
      buildValidResult({ rowIndex: 0 }),
      buildValidResult({ rowIndex: 1 }),
      buildValidResult({
        evidenceImageFileNames: ['screen-b.png'],
        rowIndex: 4,
      }),
    ]);

    expect(parseCopyTestValidationResults(content, images, rows)).toEqual([
      buildValidResult({ rowIndex: 0 }),
      buildValidResult({ rowIndex: 1 }),
      buildValidResult({
        evidenceImageFileNames: ['screen-b.png'],
        rowIndex: 4,
      }),
    ]);
    expect(content).not.toContain('screen-c.png');
    expect(parseCopyTestValidationResults(buildContent([]), images, [])).toEqual([]);
  });

  it('accepts failed singleton Evidence and allows empty Evidence only without uploads', () => {
    const results = [
      buildValidResult({
        evidenceImageFileNames: ['screen-b.png'],
        languageIssues: ['Visible wording differs.'],
        passed: false,
      }),
    ];
    const content = buildContent(results);
    const response = {
      success: true,
      data: {
        characterCount: content.length,
        content,
        modelName: 'gpt-5.4',
        timestamp: '2026-07-14T00:00:00.000Z',
      },
    };

    expect(parseCopyTestValidationResponse(response, images, [rows[0]])).toEqual(results);
    expect(parseCopyTestValidationResults(buildContent([{
      evidenceImageFileNames: [],
      languageIssues: ['Expected copy is missing.'],
      passed: false,
      rowIndex: 0,
    }]), [], [rows[0]])[0].evidenceImageFileNames).toEqual([]);
  });

  it('rejects response failures and empty aiChat content', () => {
    expect(() => parseCopyTestValidationResponse(
      { error: 'service unavailable', success: false },
      images,
      rows
    )).toThrow('service unavailable');
    expect(() => parseCopyTestValidationResponse(
      { success: false },
      images,
      rows
    )).toThrow('AI validation request failed');
    expect(() => parseCopyTestValidationResponse(
      { success: true },
      images,
      rows
    )).toThrow('AI validation returned empty content');
    expect(() => parseCopyTestValidationResponse(
      {
        data: {
          characterCount: 0,
          content: '   ',
          modelName: 'gpt-5.4',
          timestamp: '',
        },
        success: true,
      },
      images,
      rows
    )).toThrow('AI validation returned empty content');
  });

  it('rejects legacy structures, extra fields, missing fields, and malformed roots', () => {
    const unsupportedFields = [
      'evidenceRowSpan',
      'hideEvidenceCell',
      'failureReason',
      'evidenceImageIndexes',
    ];
    unsupportedFields.forEach(fieldName => {
      const item = { ...buildValidResult(), [fieldName]: fieldName === 'hideEvidenceCell' ? false : 1 };
      expect(() => parseCopyTestValidationResults(
        buildContent([item]),
        images,
        [rows[0]]
      )).toThrow('unsupported field');
    });

    const invalidContents = [
      '```json\n{"results":[]}\n```',
      '[]',
      JSON.stringify({ results: [], version: 1 }),
      JSON.stringify({}),
      JSON.stringify({ results: null }),
      buildContent([null]),
      buildContent([{
        evidenceImageFileNames: ['screen-a.png'],
        languageIssues: [],
        passed: true,
      }]),
    ];
    invalidContents.forEach(content => {
      expect(() => parseCopyTestValidationResults(content, images, [])).toThrow();
    });
  });

  it('rejects malformed field values, duplicate strings, and unknown images', () => {
    const invalidItems = [
      { ...buildValidResult(), rowIndex: -1 },
      { ...buildValidResult(), rowIndex: 0.5 },
      { ...buildValidResult(), passed: 'true' },
      { ...buildValidResult(), evidenceImageFileNames: 'screen-a.png' },
      { ...buildValidResult(), evidenceImageFileNames: [''] },
      { ...buildValidResult(), evidenceImageFileNames: ['screen-a.png', 'screen-a.png'] },
      { ...buildValidResult(), evidenceImageFileNames: ['unknown.png'] },
      { ...buildValidResult(), languageIssues: 'wrong' },
      { ...buildValidResult(), languageIssues: [' '] },
      {
        ...buildValidResult({ languageIssues: ['same'], passed: false }),
        languageIssues: ['same', 'same'],
      },
    ];
    invalidItems.forEach(item => {
      expect(() => parseCopyTestValidationResults(
        buildContent([item]),
        images,
        [rows[0]]
      )).toThrow();
    });
  });

  it('rejects multiple, empty, or inconsistent Evidence when screenshots were uploaded', () => {
    expect(() => parseCopyTestValidationResults(buildContent([
      buildValidResult({ evidenceImageFileNames: ['screen-a.png', 'screen-b.png'] }),
    ]), images, [rows[0]])).toThrow('exactly one Evidence image');

    expect(() => parseCopyTestValidationResults(buildContent([
      buildValidResult({
        evidenceImageFileNames: [],
        languageIssues: ['Expected copy is missing.'],
        passed: false,
      }),
    ]), images, [rows[0]])).toThrow('exactly one Evidence image');

    expect(() => parseCopyTestValidationResults(buildContent([
      buildValidResult({ rowIndex: 0 }),
      buildValidResult({ evidenceImageFileNames: ['screen-b.png'], rowIndex: 1 }),
    ]), images, rows.slice(0, 2))).toThrow('must share one Evidence image');
  });

  it('rejects invalid app-owned Evidence group identifiers', () => {
    expect(() => parseCopyTestValidationResults(
      buildContent([buildValidResult()]),
      images,
      [{ evidenceGroupId: -1, expected: 'copy', rowIndex: 0 }]
    )).toThrow('evidenceGroupId');
  });

  it('rejects inconsistent pass semantics, missing rows, reordered rows, and duplicates', () => {
    const semanticCases = [
      buildValidResult({ evidenceImageFileNames: [] }),
      buildValidResult({ languageIssues: ['Not allowed.'] }),
      buildValidResult({ evidenceImageFileNames: [], languageIssues: [], passed: false }),
    ];
    semanticCases.forEach(item => {
      expect(() => parseCopyTestValidationResults(
        buildContent([item]),
        images,
        [rows[0]]
      )).toThrow();
    });

    expect(() => parseCopyTestValidationResults(
      buildContent([buildValidResult()]),
      images,
      rows.slice(0, 2)
    )).toThrow('result count');
    expect(() => parseCopyTestValidationResults(
      buildContent([
        buildValidResult({ rowIndex: 1 }),
        buildValidResult({ rowIndex: 0 }),
      ]),
      images,
      rows.slice(0, 2)
    )).toThrow('requested row order');
    expect(() => parseCopyTestValidationResults(
      buildContent([
        buildValidResult({ rowIndex: 0 }),
        buildValidResult({ rowIndex: 0 }),
      ]),
      images,
      [rows[0], rows[0]]
    )).toThrow('must be unique');
  });
});
