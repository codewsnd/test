import { describe, expect, it } from 'vitest';
import type { AiChatRequest } from '@/api';
import { buildCopyTestValidationPrompt } from '../../prompt/copyTestValidationPrompt';
import { buildMockCopyTestAiChatResponse, createMockCopyTestAiChat } from '../validationMock';
import type { CopyTestDisplayConfiguration } from '../../types';

const request = (mode: CopyTestDisplayConfiguration['evidenceMode']): AiChatRequest => ({
  messages: [{ role: 'user', content: buildCopyTestValidationPrompt([
    { rowIndex: 0, evidenceGroupId: 0, expected: 'First' },
    { rowIndex: 1, evidenceGroupId: 0, expected: 'Second' },
    { rowIndex: 3, evidenceGroupId: 3, expected: 'Third' },
  ], 'Target', ['a.png', 'b.png'], mode) }],
});

describe('configured validation mock scenarios', () => {
  it.each(['single', 'multiple'] as const)('%s produces matched pass/fail rows with the requested image limit', mode => {
    const response = buildMockCopyTestAiChatResponse(request(mode), { sequenceIndex: 0 });
    const { results } = JSON.parse(response.data!.content);
    expect(results.map((result: { passed: boolean }) => result.passed)).toEqual([true, false, true]);
    expect(results[0].evidenceImageFileNames).toEqual(mode === 'single' ? ['a.png'] : ['a.png', 'b.png']);
    expect(results[1].evidenceImageFileNames).toEqual(results[0].evidenceImageFileNames);
    expect(results[1].languageIssues).not.toEqual([]);
  });

  it('cycles through full, partial and no match without relying on filenames or pixels', async () => {
    const mock = createMockCopyTestAiChat();
    const full = await mock(request('multiple'));
    const partial = await mock(request('multiple'));
    const none = await mock(request('multiple'));
    const restarted = await mock(request('multiple'));
    expect(JSON.parse(full.data!.content).results[0].evidenceImageFileNames).toHaveLength(2);
    const partialResults = JSON.parse(partial.data!.content).results;
    expect(partialResults[0].evidenceImageFileNames).toEqual(['b.png']);
    expect(partialResults[1].evidenceImageFileNames).toEqual([]);
    expect(partialResults[2].evidenceImageFileNames).toEqual([]);
    expect(JSON.parse(none.data!.content).results).toEqual([0, 1, 3].map(rowIndex => ({
      rowIndex, passed: false, evidenceImageFileNames: [], languageIssues: ['No matching screenshot was found.'],
    })));
    expect(JSON.parse(restarted.data!.content).results[0].evidenceImageFileNames).toHaveLength(1);
  });

  it.each(['single', 'multiple'] as const)('%s changes consecutive business results through 18 rounds', async mode => {
    const mock = createMockCopyTestAiChat();
    let previous: string | undefined;
    for (let round = 0; round < 18; round += 1) {
      const response = await mock(request(mode));
      expect(response.data!.content).not.toBe(previous);
      previous = response.data!.content;
      const { results } = JSON.parse(previous);
      expect(results).toHaveLength(3);
      const sameGroupImages = results.slice(0, 2)
        .map((result: { evidenceImageFileNames: string[] }) => result.evidenceImageFileNames)
        .filter((names: string[]) => names.length > 0);
      sameGroupImages.forEach((names: string[]) => expect(names).toEqual(sameGroupImages[0]));
    }
  });

  it('rotates unmatched rows within a matched group across partial cycles', () => {
    const first = JSON.parse(buildMockCopyTestAiChatResponse(request('multiple'), { sequenceIndex: 1 }).data!.content).results;
    const next = JSON.parse(buildMockCopyTestAiChatResponse(request('multiple'), { sequenceIndex: 7 }).data!.content).results;
    expect(first[0].evidenceImageFileNames).not.toEqual([]);
    expect(first[1].evidenceImageFileNames).toEqual([]);
    expect(next[0].evidenceImageFileNames).toEqual([]);
    expect(next[1].evidenceImageFileNames).not.toEqual([]);
    expect(next[0].passed).toBe(false);
  });

  it.each([{ fileNames: ['a.png'] }, { fileNames: [] }])('keeps single-row responses different with images $fileNames', async ({ fileNames }) => {
    const mock = createMockCopyTestAiChat();
    const input: AiChatRequest = { messages: [{ role: 'user', content: buildCopyTestValidationPrompt([
      { rowIndex: 0, evidenceGroupId: 0, expected: 'Copy' },
    ], 'Target', fileNames, 'single') }] };
    let previous: string | undefined;
    for (let round = 0; round < 18; round += 1) {
      const response = await mock(input);
      expect(response.data!.content).not.toBe(previous);
      previous = response.data!.content;
    }
  });
});
