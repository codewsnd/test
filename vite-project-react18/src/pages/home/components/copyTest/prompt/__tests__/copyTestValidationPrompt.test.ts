import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_SYSTEM_PROMPT,
} from '../copyTestValidationPrompt';

const COMPACT_SYSTEM_PROMPT = COPY_TEST_VALIDATION_SYSTEM_PROMPT.replace(/\s+/g, ' ');
const DECISION_EXAMPLES = COPY_TEST_VALIDATION_SYSTEM_PROMPT
  .split('# Decision examples')[1]
  .split('# Output contract')[0];

const getDecisionExample = (id: string): string => {
  const pattern = new RegExp(`## ${id} —[\\s\\S]*?(?=\\n## D\\d{2} —|$)`);
  return DECISION_EXAMPLES.match(pattern)?.[0] || '';
};

const readDecisionExampleOutput = (id: string) => {
  const outputLine = getDecisionExample(id)
    .split('\n')
    .find(line => line.startsWith('Output: '));
  return JSON.parse(outputLine?.slice('Output: '.length) || '{}');
};

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
    const alamatExample = getDecisionExample('D04');
    const exactResult = readDecisionExampleOutput('D03').results[0];
    const alamatResult = readDecisionExampleOutput('D04').results[0];

    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /normalize\(literalTranscription\(full visible copy unit\)\) === normalize\(expectedText\)/i
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
    expect(exactResult).toEqual({
      evidenceImageFileNames: ['exact.png'],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    });
    expect(alamatResult.passed).toBe(false);
    expect(alamatResult.evidenceImageFileNames).toEqual([
      'digit.png',
      'option.png',
      'mixed-option.png',
      'full-option.png',
    ]);
    expect(alamatResult.languageIssues.join(' ')).toContain('Alamat bat12');
    expect(alamatResult.languageIssues.join(' ')).toContain('Alamat bat1 (option)');
    expect(alamatResult.languageIssues.join(' ')).toContain('Alamat bat1（option)');
    expect(alamatResult.languageIssues.join(' ')).toContain('Alamat bat1（option）');
  });

  it('uses glyph-faithful period transcription before decision normalization', () => {
    const periodExample = getDecisionExample('D05');

    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Evidence-first literal transcription/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/screenshot pixels at the highest available/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/small solid dot at the baseline/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/hollow ideographic full stop/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Do not classify punctuation from the language/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Never rewrite "\." as "。"/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /Do not mark the copy unreadable or fail solely for that ambiguity/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toContain('PERIOD_FAMILY_UNRESOLVED');
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /family membership, presence, character boundary, and count are reliable/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/For decision comparison only/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/does not alter or relabel literalTranscription/i);
    expect(periodExample).toContain('"expectedText":"付款成功。"');
    expect(periodExample).toContain('"fullCopyUnit":"付款成功."');
    expect(periodExample).toContain('small solid baseline dot; literal transcription is . not 。');
    expect(periodExample).toContain('despite Chinese surrounding text');
    expect(periodExample).toContain('hollow ring with visible center');
    expect(readDecisionExampleOutput('D05')).toEqual({
      results: [{
        evidenceImageFileNames: ['english-dot.png', 'ideographic-stop.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }],
    });
  });

  it('allows only the required visual normalization rules', () => {
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Unicode compatibility representations/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /except the slash and period families handled only by rules 2 and 3/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /Map "\/", "／", "⁄", and "∕" to the same slash/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toContain('".", "．", "。", "｡"');
    expect(COMPACT_SYSTEM_PROMPT).toMatch(
      /PERIOD_FAMILY_UNRESOLVED to the same canonical period/i
    );
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/one-for-one substitution/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Remove zero-width characters/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/non-breaking spaces to ordinary spaces/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Ignore layout-only line (?:wrap|break)/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/punctuation-count difference/i);
    expect(COMPACT_SYSTEM_PROMPT).toMatch(/Do not infer any unlisted OCR equivalence/i);
    expect(readDecisionExampleOutput('D01').results[0].passed).toBe(true);
    expect(readDecisionExampleOutput('D05').results[0].passed).toBe(true);
    expect(readDecisionExampleOutput('D06').results[0].passed).toBe(false);
    expect(readDecisionExampleOutput('D07').results[0].passed).toBe(false);
  });

  it('keeps extra, missing, and unreadable period decisions strict', () => {
    const extraPeriodResult = readDecisionExampleOutput('D06').results[0];
    const missingPeriodResult = readDecisionExampleOutput('D07').results[0];
    const unreadablePeriodResult = readDecisionExampleOutput('D10').results[0];

    expect(extraPeriodResult.passed).toBe(false);
    expect(extraPeriodResult.evidenceImageFileNames).toEqual(['extra-period.png']);
    expect(extraPeriodResult.languageIssues.join(' ')).toContain('Payment complete。');
    expect(extraPeriodResult.languageIssues.join(' ')).toContain(
      'unexpected final period-family glyph'
    );
    expect(missingPeriodResult.passed).toBe(false);
    expect(missingPeriodResult.evidenceImageFileNames).toEqual(['missing-period.png']);
    expect(missingPeriodResult.languageIssues.join(' ')).toContain(
      'missing one final period-family glyph'
    );
    expect(unreadablePeriodResult.passed).toBe(false);
    expect(unreadablePeriodResult.evidenceImageFileNames).toEqual(['blurred.png']);
    expect(unreadablePeriodResult.languageIssues.join(' ')).toContain(
      'unreadable and cannot be verified as a period-family glyph'
    );
  });

  it('uses standard normative examples with the exact response contract', () => {
    const exampleBlocks = DECISION_EXAMPLES
      .split('\n## ')
      .slice(1)
      .map(block => `## ${block}`);
    const exampleIds = exampleBlocks.map(
      block => block.match(/^## (D\d{2}) —/)?.[1]
    );

    expect(exampleBlocks).toHaveLength(10);
    expect(exampleIds).toEqual([
      'D01',
      'D02',
      'D03',
      'D04',
      'D05',
      'D06',
      'D07',
      'D08',
      'D09',
      'D10',
    ]);
    exampleBlocks.forEach(block => {
      const inputLine = block.split('\n').find(line => line.startsWith('Input: '));
      const outputLine = block.split('\n').find(line => line.startsWith('Output: '));
      const input = JSON.parse(inputLine?.slice('Input: '.length) || '{}');
      const output = JSON.parse(outputLine?.slice('Output: '.length) || '{}');
      const result = output.results[0];
      const inputFileNames = input.visualEvidence.map(
        (evidence: { fileName: string }) => evidence.fileName
      );
      const evidencePositions = result.evidenceImageFileNames.map(
        (fileName: string) => inputFileNames.indexOf(fileName)
      );

      expect(input).toHaveProperty('rowIndex', 0);
      expect(input).toHaveProperty('expectedText');
      expect(input).toHaveProperty('visualEvidence');
      expect(Object.keys(output)).toEqual(['results']);
      expect(output.results).toHaveLength(1);
      expect(Object.keys(output.results[0]).sort()).toEqual([
        'evidenceImageFileNames',
        'languageIssues',
        'passed',
        'rowIndex',
      ]);
      expect(result.rowIndex).toBe(input.rowIndex);
      expect(new Set(result.evidenceImageFileNames).size).toBe(
        result.evidenceImageFileNames.length
      );
      result.evidenceImageFileNames.forEach((fileName: string) => {
        expect(inputFileNames).toContain(fileName);
      });
      expect(evidencePositions).toEqual(
        [...evidencePositions].sort((left, right) => left - right)
      );
      if (result.passed) {
        expect(result.evidenceImageFileNames.length).toBeGreaterThan(0);
        expect(result.languageIssues).toEqual([]);
      } else {
        expect(result.languageIssues.length).toBeGreaterThan(0);
      }
    });
  });

  it('locks evidence, failure messages, and the exact output shape', () => {
    const outputContract = COPY_TEST_VALIDATION_SYSTEM_PROMPT.split(
      '# Output contract'
    )[1];
    const failedIssues = readDecisionExampleOutput('D04').results[0].languageIssues;
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
    expect(failedIssues.join(' ')).toContain('Alamat bat1');
    expect(failedIssues.join(' ')).toContain('Alamat bat12');
    expect(failedIssues.join(' ')).toContain("suffix '2'");
    expect(failedIssues.join(' ')).toContain('Alamat bat1 (option)');
    expect(failedIssues.join(' ')).toContain('Alamat bat1（option)');
    expect(failedIssues.join(' ')).toContain('Alamat bat1（option）');
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
