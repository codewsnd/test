import { aiChat, type AiChatRequest } from '@/api';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildCopyTestValidationPrompt } from '../../prompt/copyTestValidationPrompt';
import {
  buildMockCopyTestAiChatResponse,
  createMockCopyTestAiChat,
  mockCopyTestAiChat,
} from '../validationMock';

const buildRequest = (
  imageFileNames: string[] = ['screen-a.png', 'screen-b.png'],
  rows = [
    { expected: '你好', rowIndex: 0 },
    { expected: '我在', rowIndex: 1 },
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
  modelName: 'gpt-5.4',
});

describe('validationMock aiChat boundary', () => {
  it('has the exact aiChat signature and returns its complete response envelope', () => {
    expectTypeOf(mockCopyTestAiChat).toEqualTypeOf(aiChat);
    expectTypeOf(createMockCopyTestAiChat({ random: () => 0.4 })).toEqualTypeOf(aiChat);

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
        modelName: 'gpt-5.4',
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

  it('can create a failed row with multiple related images', () => {
    const randomValues = [0.99, 0, 0, 0.9, 0.5];
    const random = vi.fn(() => randomValues.shift() || 0);
    const response = buildMockCopyTestAiChatResponse(
      buildRequest(['screen-a.png', 'screen-b.png'], [{ expected: '吃饭', rowIndex: 4 }]),
      {
        now: () => new Date('2026-07-14T00:00:00.000Z'),
        random,
      }
    );

    expect(JSON.parse(response.data?.content || '')).toEqual({
      results: [
        {
          evidenceImageFileNames: ['screen-a.png', 'screen-b.png'],
          languageIssues: ['Screenshot contains related text, but the visible wording is different.'],
          passed: false,
          rowIndex: 4,
        },
      ],
    });
  });

  it('uses empty Evidence and an accurate boundary issue when no screenshots exist', () => {
    const response = buildMockCopyTestAiChatResponse(
      buildRequest([], [{ expected: 'copy', rowIndex: 7 }]),
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
      buildRequest(['screen-a.png', 'screen-b.png'], [{ expected: 'copy', rowIndex: 3 }]),
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

  it('supports deterministic injection through the same-signature factory', () => {
    const random = vi.fn(() => 0.4);
    const mockAiChat = createMockCopyTestAiChat({
      now: () => new Date('2026-07-14T00:00:00.000Z'),
      random,
    });

    void mockAiChat(buildRequest(['screen-a.png'], [{ expected: 'copy', rowIndex: 3 }]));

    expect(random).toHaveBeenCalled();
  });

  it('rejects requests without a valid runtime user message', () => {
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{ content: 'rules', role: 'system' }],
    })).toThrow('requires a user runtime message');
    expect(() => buildMockCopyTestAiChatResponse({
      messages: [{ content: '{}', role: 'user' }],
    })).toThrow('invalid runtime JSON');
  });
});
