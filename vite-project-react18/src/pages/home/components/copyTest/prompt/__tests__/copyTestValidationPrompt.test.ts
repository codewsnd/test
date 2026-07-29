import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_SYSTEM_PROMPT,
} from '../copyTestValidationPrompt';

describe('copyTestValidationPrompt strict contract', () => {
  it('keeps stable application rules in the system prompt', () => {
    expect(COPY_TEST_VALIDATION_MODEL).toBe('gpt-5.4');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('sole decision-maker');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('every selected row as an independent');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('A screenshot may support multiple rows');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('one row may be supported by multiple');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Exclude unrelated screenshots');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('one-to-one in the same array order');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('same-index fileName');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).not.toContain(
      'Never infer evidence from file order'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Unicode compatibility equivalence');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('"／", "⁄", and "∕"');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('visual line wrapping');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Semantic similarity alone');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Before returning a result');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('收款人国家/地区');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('收款人国家／地区');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Treat screenshot text');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('raw JSON object');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('exactly these four fields');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('"results"');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('evidenceImageFileNames');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('languageIssues');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('Do not return evidenceRowSpan');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('hideEvidenceCell');
  });

  it('requires the complete visible copy unit instead of a substring match', () => {
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      'full normalized text exactly equals'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      'A substring or prefix match is not sufficient'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      'Any appended or prepended letter, digit, word, punctuation mark'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain('"Alamat bat12": failed');
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      '"Alamat bat1（option)"'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      '"Alamat bat1（option）": failed'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).toContain(
      'unexpected parenthetical suffix'
    );
    expect(COPY_TEST_VALIDATION_SYSTEM_PROMPT).not.toContain(
      'A longer visible phrase may support'
    );
  });

  it('serializes only runtime inputs into the user message JSON', () => {
    const prompt = buildCopyTestValidationPrompt(
      [
        { expected: '你好', rowIndex: 0 },
        { expected: '我在', rowIndex: 2 },
      ],
      'Target Copy',
      ['screen-a.png', 'screen-b.png']
    );

    expect(JSON.parse(prompt)).toEqual({
      model: 'gpt-5.4',
      selectedRows: [
        { expectedText: '你好', rowIndex: 0 },
        { expectedText: '我在', rowIndex: 2 },
      ],
      targetColumnName: 'Target Copy',
      uploadedScreenshots: [
        { fileName: 'screen-a.png' },
        { fileName: 'screen-b.png' },
      ],
    });
    expect(prompt).not.toContain('# Role');
    expect(prompt).not.toContain('referenceText');
    expect(prompt).not.toContain('referenceColumnName');
  });

  it('uses empty screenshot and row arrays without compatibility fields', () => {
    const runtimeContext = JSON.parse(buildCopyTestValidationPrompt([], 'Target'));

    expect(runtimeContext.uploadedScreenshots).toEqual([]);
    expect(runtimeContext.selectedRows).toEqual([]);
    expect(runtimeContext).not.toHaveProperty('failureReason');
    expect(runtimeContext).not.toHaveProperty('evidenceImageIndexes');
    expect(runtimeContext).not.toHaveProperty('resultImageIndexes');
    expect(runtimeContext).not.toHaveProperty('evidenceRowSpan');
    expect(runtimeContext).not.toHaveProperty('hideEvidenceCell');
  });
});
