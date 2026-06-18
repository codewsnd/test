import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_PROMPT,
} from '../copyTestValidationPrompt';

describe('copyTestValidationPrompt', () => {
  it('builds strict JSON prompt with runtime rows and screenshot names', () => {
    expect(COPY_TEST_VALIDATION_MODEL).toBe('gpt5.4');
    expect(COPY_TEST_VALIDATION_PROMPT).toContain('Return JSON only');
    const prompt = buildCopyTestValidationPrompt(
      [{ expected: 'copy', reference: 'ref', rowIndex: 0 }],
      'Target',
      'Reference',
      ['screen-a.png']
    );
    expect(prompt).toContain('"expectedText": "copy"');
    expect(prompt).toContain('"fileName": "screen-a.png"');
    expect(prompt).toContain('"referenceColumnName": "Reference"');
  });
});
