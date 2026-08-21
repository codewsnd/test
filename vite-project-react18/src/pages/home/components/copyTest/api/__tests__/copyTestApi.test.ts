import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCopyTestValidationRequest,
  copyTestAttachmentsApi,
  copyTestStorageApi,
  copyTestUploadApi,
  copyTestValidationApi,
  parseCopyTestValidationResponse,
  parseCopyTestValidationResults,
  type CopyTestValidationResult,
} from '../copyTestApi';
import {
  COPY_TEST_MAX_LANGUAGE_ISSUE_CHARACTERS,
  COPY_TEST_MAX_LANGUAGE_ISSUES_PER_ROW,
  COPY_TEST_MAX_OUTPUT_TOKENS,
  COPY_TEST_VALIDATION_MODEL,
} from '../../prompt/copyTestValidationPrompt';

const hoisted = vi.hoisted(() => ({
  aiChat: vi.fn(),
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
  mockCopyTestAiChat: vi.fn(),
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

vi.mock('../../mock/validationMock', () => ({
  mockCopyTestAiChat: hoisted.mockCopyTestAiChat,
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

const buildAiResponse = (results: unknown[]) => {
  const content = buildContent(results);
  return {
    data: {
      characterCount: content.length,
      content,
      modelName: COPY_TEST_VALIDATION_MODEL,
      timestamp: '2026-07-14T00:00:00.000Z',
    },
    success: true,
  };
};

describe('copyTestApi validation parsing and request contract', () => {
  beforeEach(() => {
    hoisted.aiChat.mockReset();
    hoisted.axiosGet.mockReset();
    hoisted.axiosPost.mockReset();
    hoisted.mockCopyTestAiChat.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(request.modelName).toBe(COPY_TEST_VALIDATION_MODEL);
    expect(request.maxTokens).toBe(COPY_TEST_MAX_OUTPUT_TOKENS);
    expect(request.documents).toEqual([
      { base64url: ['data:image/png;base64,QUJD'], type: 'image' },
    ]);
    expect(request.messages).toHaveLength(2);
    expect(request.messages[0]).toEqual(expect.objectContaining({
      content: expect.stringContaining('Never return or decide rowspan'),
      role: 'system',
    }));
    expect(JSON.parse(request.messages[1].content)).toEqual({
      maxLanguageIssueCharacters: COPY_TEST_MAX_LANGUAGE_ISSUE_CHARACTERS,
      maxLanguageIssuesPerRow: COPY_TEST_MAX_LANGUAGE_ISSUES_PER_ROW,
      outputTokenLimit: COPY_TEST_MAX_OUTPUT_TOKENS,
      requiredResultCount: 1,
      requiredRowIndexes: [0],
      selectedRows: [{ evidenceGroupId: 0, expectedText: '你好', rowIndex: 0 }],
      targetColumnName: 'Target',
      uploadedScreenshots: [{ fileName: 'screen-a.png' }],
    });
    expect(request.messages[1].role).toBe('user');
  });

  it('parses valid result objects and an empty result set', () => {
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
    expect(parseCopyTestValidationResults(buildContent([]), images, [])).toEqual([]);
  });

  it('accepts one issue per mismatch and empty Evidence without uploads', () => {
    const results = [
      buildValidResult({
        evidenceImageFileNames: ['screen-b.png'],
        languageIssues: [
          "Expected '输', but the image shows '輸'.",
          "Expected '信息', but the image shows '資料'.",
        ],
        passed: false,
      }),
    ];
    const content = buildContent(results);
    const response = {
      success: true,
      data: {
        characterCount: content.length,
        content,
        modelName: COPY_TEST_VALIDATION_MODEL,
        timestamp: '2026-07-14T00:00:00.000Z',
      },
    };

    expect(parseCopyTestValidationResponse(response, images, [rows[0]])).toEqual(results);
    expect(parseCopyTestValidationResults(buildContent([{
      evidenceImageFileNames: [],
      languageIssues: ['Please upload an image to check this text.'],
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
    )).toThrow('AI validation returned invalid content: the response is empty');
    expect(() => parseCopyTestValidationResponse(
      {
        data: {
          characterCount: 0,
          content: '   ',
          modelName: COPY_TEST_VALIDATION_MODEL,
          timestamp: '',
        },
        success: true,
      },
      images,
      rows
    )).toThrow('AI validation returned invalid content: the response is empty');
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
      'Result: {"results":[]}',
      '{"results":[]} Done.',
      '{"results":[]}{"results":[]}',
      '**Result**\n{"results":[]}',
      '{"results":[',
      '{"results":[]',
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
    expect(parseCopyTestValidationResults(' \n{"results":[]} \n', [], [])).toEqual([]);
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
      {
        ...buildValidResult({ passed: false }),
        languageIssues: Array.from(
          { length: COPY_TEST_MAX_LANGUAGE_ISSUES_PER_ROW + 1 },
          (_, index) => `issue-${index}`
        ),
      },
      {
        ...buildValidResult({ passed: false }),
        languageIssues: ['x'.repeat(COPY_TEST_MAX_LANGUAGE_ISSUE_CHARACTERS + 1)],
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

  it('rejects invalid app-owned Evidence group identifiers', () => {
    expect(() => parseCopyTestValidationResults(
      buildContent([buildValidResult()]),
      images,
      [{ evidenceGroupId: -1, expected: 'copy', rowIndex: 0 }]
    )).toThrow('evidenceGroupId');
  });

  it('rejects inconsistent pass semantics', () => {
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
  });

  it('accepts an incomplete result set without an automatic second request', async () => {
    vi.useFakeTimers();
    const requestedRows = [0, 1, 2, 3].map(rowIndex => ({
      evidenceGroupId: rowIndex,
      expected: `Copy ${rowIndex + 1}`,
      rowIndex,
    }));
    const partialResults = [0, 1, 2].map(rowIndex => {
      return buildValidResult({ rowIndex });
    });
    hoisted.mockCopyTestAiChat.mockResolvedValueOnce(
      buildAiResponse(partialResults)
    );

    const validation = copyTestValidationApi([images[0]], requestedRows, 'Target');
    await vi.runAllTimersAsync();

    await expect(validation).resolves.toEqual(partialResults);
    expect(hoisted.mockCopyTestAiChat).toHaveBeenCalledTimes(1);
  });

  it('rejects truncated JSON without an automatic second request', async () => {
    vi.useFakeTimers();
    hoisted.mockCopyTestAiChat.mockResolvedValueOnce({
      data: {
        characterCount: 12,
        content: '{"results":[',
        modelName: COPY_TEST_VALIDATION_MODEL,
        timestamp: '2026-07-14T00:00:00.000Z',
      },
      success: true,
    });

    const validation = copyTestValidationApi([images[0]], [rows[0]], 'Target');
    const assertion = expect(validation).rejects.toThrow(
      'AI validation returned invalid content: the response is not raw JSON'
    );

    await vi.runAllTimersAsync();
    await assertion;

    expect(hoisted.mockCopyTestAiChat).toHaveBeenCalledTimes(1);
  });

  it('does not retry request failures', async () => {
    vi.useFakeTimers();
    hoisted.mockCopyTestAiChat.mockResolvedValue({
      error: 'service unavailable',
      success: false,
    });
    const failedRequest = copyTestValidationApi(
      [images[0]],
      [rows[0]],
      'Target'
    );
    const failedRequestAssertion = expect(failedRequest).rejects.toThrow(
      'service unavailable'
    );

    await vi.runAllTimersAsync();
    await failedRequestAssertion;
    expect(hoisted.mockCopyTestAiChat).toHaveBeenCalledTimes(1);
  });
});
