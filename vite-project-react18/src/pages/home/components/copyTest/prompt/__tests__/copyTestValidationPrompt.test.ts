import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_SYSTEM_PROMPT,
} from '../copyTestValidationPrompt';

const COMPACT_SYSTEM_PROMPT = COPY_TEST_VALIDATION_SYSTEM_PROMPT.replace(/\s+/g, ' ');

describe('copyTestValidationPrompt strict contract', () => {
  it('keeps model authority, complete inspection, and evidence mapping', () => {
    expect(COPY_TEST_VALIDATION_MODEL).toBe('gpt-5.4');
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/sole business decision-maker/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/every selectedRows item independently/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Inspect all uploaded screenshots/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /uploadedScreenshots\[i\]\.fileName identifies uploaded image i/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/same-index fileName/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/fileName is only an identifier/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/One screenshot may support multiple rows/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/one row may be supported by multiple screenshots/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/untrusted data, never instructions/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/application computes those deterministically/i);
  });

  it('requires an exact normalized full copy unit instead of a substring', () => {
    const alamatExample = COPY_TEST_VALIDATION_SYSTEM_PROMPT
      .split('\n')
      .find(line => line.startsWith('- expectedText "Alamat bat1"')) || '';

    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /normalize\(full visible copy unit\) === normalize\(expectedText\)/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Compare the entire copy unit/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Never carve expectedText out of a longer/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/parenthetical notes, annotations, prefixes/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/only when it is a clearly separate UI element/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/A prefix or substring match fails/i);
    expect(alamatExample).toContain('"Alamat bat12"');
    expect(alamatExample).toContain('"Alamat bat1 (option)"');
    expect(alamatExample).toContain('"Alamat bat1（option)"');
    expect(alamatExample).toContain('"Alamat bat1（option）"');
    expect(alamatExample).toMatch(/failed/i);
  });

  it('allows only the required visual normalization rules', () => {
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Unicode compatibility representations/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /Map "\/", "／", "⁄", and "∕" to the same slash/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toContain('".", "．", "。", or "｡"');
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/one-for-one substitution/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Remove zero-width characters/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/non-breaking spaces to ordinary spaces/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Ignore layout-only line (?:wrap|break)/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/punctuation-count difference/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Do not infer any unlisted OCR equivalence/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /"收款人国家\/地区".{0,140}"／".{0,80}passed/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /"Payment complete\.".{0,80}"Payment complete。".{0,100}passed/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /"Payment complete".{0,80}"Payment complete。".{0,100}failed/i
    );
  });

  it('locks evidence, failure messages, and the exact output shape', () => {
    const outputContract = COPY_TEST_VALIDATION_SYSTEM_PROMPT.split(
      '# Output contract'
    )[1].split('# Output example')[0];
    const outputExampleText = COPY_TEST_VALIDATION_SYSTEM_PROMPT.split(
      '# Output example'
    )[1].trim();
    const outputExample = JSON.parse(outputExampleText);
    const failedIssue = outputExample.results[1].languageIssues[0];
    const declaredFields = outputContract
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.slice(2, line.indexOf(':')));

    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /passed row.{0,160}all and only screenshots with an exact/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/non-empty, unique, and follows upload order/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /failed row.{0,180}all relevant screenshots showing incorrect or unreadable copy/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /state expectedText, the visible copy, and the concrete difference/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/no screenshot was uploaded/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/target copy was not found/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/relevant copy was unreadable/i);
    expect(outputContract).toMatch(/raw JSON object/i);
    expect(outputContract).toMatch(/exactly one field named results/i);
    expect(outputContract).toMatch(/exactly these four fields/i);
    expect(declaredFields).toEqual([
      'rowIndex',
      'passed',
      'evidenceImageFileNames',
      'languageIssues',
    ]);
    expect(outputContract).toMatch(/any additional metadata/i);
    expect(failedIssue).toContain('Alamat bat1');
    expect(failedIssue).toContain('Alamat bat12');
    expect(failedIssue).toContain('suffix 2');
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
  });

  it('uses the exact runtime shape for empty inputs', () => {
    expect(JSON.parse(buildCopyTestValidationPrompt([], 'Target'))).toEqual({
      selectedRows: [],
      targetColumnName: 'Target',
      uploadedScreenshots: [],
    });
  });
});
