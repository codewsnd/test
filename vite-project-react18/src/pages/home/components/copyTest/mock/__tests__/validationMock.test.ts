import { aiChat, type AiChatRequest } from '@/api';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
} from '../../prompt/copyTestValidationPrompt';
import {
  buildMockCopyTestAiChatResponse,
  createMockCopyTestAiChat,
  mockCopyTestAiChat,
  resetCopyTestValidationMockSequence,
} from '../validationMock';

const buildRequest = (
  imageFileNames: string[] = ['screen-a.png', 'screen-b.png'],
  rows = [
    { evidenceGroupId: 0, expected: '你好', rowIndex: 0 },
    { evidenceGroupId: 0, expected: '我在', rowIndex: 1 },
  ]
): AiChatRequest => ({
  documents: [{ base64url: [], type: 'image' }],
  messages: [
    { content: 'stable rules', role: 'system' },
    {
      content: buildCopyTestValidationPrompt(rows, 'Target', imageFileNames),
      role: 'user',
    },
  ],
  modelName: COPY_TEST_VALIDATION_MODEL,
});

describe('validationMock aiChat boundary', () => {
  beforeEach(() => {
    resetCopyTestValidationMockSequence();
  });

  it('has the exact aiChat signature and returns its complete response envelope', () => {
    expectTypeOf(mockCopyTestAiChat).toEqualTypeOf(aiChat);
    expectTypeOf(createMockCopyTestAiChat({ sequenceIndex: 2 })).toEqualTypeOf(aiChat);

    const response = buildMockCopyTestAiChatResponse(buildRequest(), {
      now: () => new Date('2026-07-14T01:02:03.000Z'),
      random: () => 0.4,
    });
    const content = response.data?.content || '';

    expect(response).toEqual({
      success: true,
      data: {
        characterCount: content.length,
        content,
        modelName: COPY_TEST_VALIDATION_MODEL,
        timestamp: '2026-07-14T01:02:03.000Z',
      },
    });
    expect(JSON.parse(content)).toEqual({
      results: [
        {
          evidenceImageFileNames: ['screen-a.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen-a.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 1,
        },
      ],
    });
  });

  it('can create a failed row with one group-selected image', () => {
    const randomValues = [0, 0.99, 0.5];
    const random = vi.fn(() => randomValues.shift() || 0);
    const response = buildMockCopyTestAiChatResponse(
      buildRequest(
        ['screen-a.png', 'screen-b.png'],
        [{ evidenceGroupId: 4, expected: '吃饭', rowIndex: 4 }]
      ),
      {
        now: () => new Date('2026-07-14T00:00:00.000Z'),
        random,
      }
    );

    expect(JSON.parse(response.data?.content || '')).toEqual({
      results: [
        {
          evidenceImageFileNames: ['screen-a.png'],
          languageIssues: ['Screenshot contains related text, but the visible wording is different.'],
          passed: false,
          rowIndex: 4,
        },
      ],
    });
  });

  it('changes deterministic data across four successive default factory calls', async () => {
    const mockAiChat = createMockCopyTestAiChat({
      now: () => new Date('2026-07-14T00:00:00.000Z'),
    });
    const request = buildRequest(
      ['screen-a.png', 'screen-b.png'],
      [{ evidenceGroupId: 3, expected: 'copy', rowIndex: 3 }]
    );

    const first = JSON.parse((await mockAiChat(request)).data?.content || '');
    const second = JSON.parse((await mockAiChat(request)).data?.content || '');
    const third = JSON.parse((await mockAiChat(request)).data?.content || '');
    const fourth = JSON.parse((await mockAiChat(request)).data?.content || '');

    expect(first.results[0]).toEqual({
      evidenceImageFileNames: ['screen-a.png'],
      languageIssues: [],
      passed: true,
      rowIndex: 3,
    });
    expect(second.results[0]).toEqual({
      evidenceImageFileNames: ['screen-b.png'],
      languageIssues: [
        'Mock validation round 2: Expected copy was not found in the uploaded screenshots.',
      ],
      passed: false,
      rowIndex: 3,
    });
    expect(third.results[0]).toEqual({
      evidenceImageFileNames: ['screen-a.png'],
      languageIssues: [
        'Mock validation round 3: Screenshot contains related text, but the visible wording is different.',
      ],
      passed: false,
      rowIndex: 3,
    });
    expect(fourth.results[0]).toEqual({
      evidenceImageFileNames: ['screen-b.png'],
      languageIssues: [
        'Mock validation round 4: The expected copy is incomplete or truncated in the screenshot.',
      ],
      passed: false,
      rowIndex: 3,
    });
    expect(new Set([first, second, third, fourth].map(value => {
      return JSON.stringify(value);
    })).size).toBe(4);
  });

  it('keeps each round request-scoped and resets the default sequence', async () => {
    const requests = [
      buildRequest(['round-1.png'], [{ evidenceGroupId: 10, expected: 'one', rowIndex: 10 }]),
      buildRequest(
        ['round-2-a.png', 'round-2-b.png'],
        [{ evidenceGroupId: 20, expected: 'two', rowIndex: 20 }]
      ),
      buildRequest(
        ['round-3-a.png', 'round-3-b.png', 'round-3-c.png'],
        [
          { evidenceGroupId: 30, expected: 'three', rowIndex: 30 },
          { evidenceGroupId: 30, expected: 'three-b', rowIndex: 31 },
        ]
      ),
      buildRequest(['round-4.png'], [{ evidenceGroupId: 40, expected: 'four', rowIndex: 40 }]),
    ];

    const responses = [];
    for (const request of requests) {
      responses.push(await mockCopyTestAiChat(request));
    }
    const contents = responses.map(response => response.data?.content || '');
    const payloads = contents.map(content => JSON.parse(content));

    expect(payloads).toEqual([
      {
        results: [{
          evidenceImageFileNames: ['round-1.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 10,
        }],
      },
      {
        results: [{
          evidenceImageFileNames: ['round-2-b.png'],
          languageIssues: [
            'Mock validation round 2: Expected copy was not found in the uploaded screenshots.',
          ],
          passed: false,
          rowIndex: 20,
        }],
      },
      {
        results: [
          {
            evidenceImageFileNames: ['round-3-c.png'],
            languageIssues: [],
            passed: true,
            rowIndex: 30,
          },
          {
            evidenceImageFileNames: ['round-3-c.png'],
            languageIssues: [
              'Mock validation round 3: The expected copy is incomplete or truncated in the screenshot.',
            ],
            passed: false,
            rowIndex: 31,
          },
        ],
      },
      {
        results: [{
          evidenceImageFileNames: ['round-4.png'],
          languageIssues: [
            'Mock validation round 4: The expected copy is incomplete or truncated in the screenshot.',
          ],
          passed: false,
          rowIndex: 40,
        }],
      },
    ]);
    for (const payload of payloads) {
      expect(Object.keys(payload)).toEqual(['results']);
      for (const result of payload.results) {
        expect(Object.keys(result)).toEqual([
          'rowIndex',
          'passed',
          'evidenceImageFileNames',
          'languageIssues',
        ]);
      }
    }
    expect(new Set(contents).size).toBe(4);

    resetCopyTestValidationMockSequence();
    const resetResponse = await mockCopyTestAiChat(requests[0]);

    expect(resetResponse).toEqual(responses[0]);
  });

  it('locks one singleton winner across every group when row indexes are continuous', () => {
    const response = buildMockCopyTestAiChatResponse(
      buildRequest(
        ['screen-a.png', 'screen-b.png', 'screen-c.png', 'screen-d.png'],
        [
          { evidenceGroupId: 0, expected: 'first', rowIndex: 0 },
          { evidenceGroupId: 0, expected: 'second', rowIndex: 1 },
          { evidenceGroupId: 2, expected: 'third', rowIndex: 2 },
        ]
      ),
      { sequenceIndex: 0 }
    );
    const payload = JSON.parse(response.data?.content || '');
    const evidenceFileNames = payload.results.flatMap(
      (result: { evidenceImageFileNames: string[] }) => {
        return result.evidenceImageFileNames;
      }
    );

    expect(evidenceFileNames).toEqual([
      'screen-a.png',
      'screen-a.png',
      'screen-a.png',
    ]);
    expect(new Set(evidenceFileNames).size).toBe(1);
    for (const result of payload.results) {
      expect(result.evidenceImageFileNames).toHaveLength(1);
    }
  });

  it('selects one singleton winner per structural group across a row-index gap', () => {
    const response = buildMockCopyTestAiChatResponse(
      buildRequest(
        ['screen-a.png', 'screen-b.png', 'screen-c.png'],
        [
          { evidenceGroupId: 0, expected: 'first', rowIndex: 0 },
          { evidenceGroupId: 0, expected: 'second', rowIndex: 1 },
          { evidenceGroupId: 4, expected: 'fourth', rowIndex: 4 },
        ]
      ),
      { sequenceIndex: 0 }
    );
    const payload = JSON.parse(response.data?.content || '');

    expect(payload.results.map(
      (result: { evidenceImageFileNames: string[] }) => result.evidenceImageFileNames
    )).toEqual([
      ['screen-a.png'],
      ['screen-a.png'],
      ['screen-b.png'],
    ]);
  });

  it('uses empty Evidence and an accurate boundary issue when no screenshots exist', () => {
    const response = buildMockCopyTestAiChatResponse(
      buildRequest([], [{ evidenceGroupId: 7, expected: 'copy', rowIndex: 7 }]),
      {
        now: () => new Date('2026-07-14T00:00:00.000Z'),
        random: () => 0,
      }
    );

    expect(JSON.parse(response.data?.content || '')).toEqual({
      results: [
        {
          evidenceImageFileNames: [],
          languageIssues: ['No uploaded screenshot is available for validation.'],
          passed: false,
          rowIndex: 7,
        },
      ],
    });
  });

  it('always references a real uploaded screenshot even at the minimum random boundary', () => {
    const response = buildMockCopyTestAiChatResponse(
      buildRequest(
        ['screen-a.png', 'screen-b.png'],
        [{ evidenceGroupId: 3, expected: 'copy', rowIndex: 3 }]
      ),
      {
        now: () => new Date('2026-07-14T00:00:00.000Z'),
        random: () => 0,
      }
    );

    expect(JSON.parse(response.data?.content || '')).toEqual({
      results: [
        {
          evidenceImageFileNames: ['screen-a.png'],
          languageIssues: [],
          passed: true,
          rowIndex: 3,
        },
      ],
    });
  });

  it('keeps empty-result responses unique when calls share a fixed clock', async () => {
    const mockAiChat = createMockCopyTestAiChat({
      now: () => new Date('2026-07-14T00:00:00.000Z'),
    });
    const request = buildRequest([], []);

    const responses = await Promise.all([
      mockAiChat(request),
      mockAiChat(request),
      mockAiChat(request),
    ]);

    expect(responses.map(response => response.data?.content)).toEqual([
      '{"results":[]}',
      '{"results":[]}',
      '{"results":[]}',
    ]);
    expect(responses.map(response => response.data?.timestamp)).toEqual([
      '2026-07-14T00:00:00.000Z',
      '2026-07-14T00:00:00.001Z',
      '2026-07-14T00:00:00.002Z',
    ]);
    expect(new Set(responses.map(response => JSON.stringify(response))).size).toBe(3);
  });

  it('rejects requests without a valid runtime user message', () => {
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{ content: 'rules', role: 'system' }],
    })).toThrow('requires a user runtime message');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{ content: '{}', role: 'user' }],
    })).toThrow('invalid runtime JSON');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{
        content: JSON.stringify({
          selectedRows: [{ expectedText: 'copy', rowIndex: 0 }],
          targetColumnName: 'Target',
          uploadedScreenshots: [],
        }),
        role: 'user',
      }],
    })).toThrow('invalid runtime JSON');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{
        content: JSON.stringify({
          selectedRows: [{ evidenceGroupId: 0, expectedText: 'copy', rowIndex: -1 }],
          targetColumnName: 'Target',
          uploadedScreenshots: [],
        }),
        role: 'user',
      }],
    })).toThrow('invalid runtime JSON');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{
        content: JSON.stringify({
          selectedRows: [],
          targetColumnName: 'Target',
          uploadedScreenshots: [{ fileName: ' ' }],
        }),
        role: 'user',
      }],
    })).toThrow('invalid runtime JSON');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{
        content: JSON.stringify({
          selectedRows: [
            { evidenceGroupId: 1, expectedText: 'first', rowIndex: 1 },
            { evidenceGroupId: 1, expectedText: 'second', rowIndex: 1 },
          ],
          targetColumnName: 'Target',
          uploadedScreenshots: [],
        }),
        role: 'user',
      }],
    })).toThrow('invalid runtime JSON');
  });
});
