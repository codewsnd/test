import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_PROMPT,
} from '../copyTestValidationPrompt';

describe('copyTestValidationPrompt strict contract', () => {
  it('contains only the raw-array schema and current runtime inputs', () => {
    const prompt = buildCopyTestValidationPrompt(
      [{ expected: 'Save changes', rowIndex: 3 }],
      'Target Copy',
      ['screen-a.png']
    );

    expect(COPY_TEST_VALIDATION_MODEL).toBe('gpt5.4');
    expect(COPY_TEST_VALIDATION_PROMPT).toContain('Return one raw JSON array');
    expect(COPY_TEST_VALIDATION_PROMPT).toContain('A continuation must omit evidenceRowSpan');
    expect(prompt).toContain('"expectedText": "Save changes"');
    expect(prompt).toContain('"rowIndex": 3');
    expect(prompt).toContain('"targetColumnName": "Target Copy"');
    expect(prompt).toContain('"fileName": "screen-a.png"');
    expect(prompt).not.toContain('referenceText');
    expect(prompt).not.toContain('referenceColumnName');
  });

  it('uses empty screenshot and row arrays without adding compatibility fields', () => {
    const prompt = buildCopyTestValidationPrompt([], 'Target');

    expect(prompt).toContain('<uploaded_screenshots>\n[]\n</uploaded_screenshots>');
    expect(prompt).toContain('<selected_rows>\n[]\n</selected_rows>');
    expect(prompt).not.toContain('failureReason');
    expect(prompt).not.toContain('evidenceImageIndexes');
    expect(prompt).not.toContain('resultImageIndexes');
  });
});
