import { describe, expect, it } from 'vitest';
import {
  buildCopyTestValidationPrompt,
  COPY_TEST_MAX_OUTPUT_TOKENS,
  COPY_TEST_VALIDATION_MODEL,
  COPY_TEST_VALIDATION_SYSTEM_PROMPT,
} from '../copyTestValidationPrompt';

interface DecisionExampleEvidence {
  copyUnits?: string[];
  fileName: string;
  fullCopyUnit?: string;
}

interface DecisionExampleRowInput {
  evidenceGroupId: number;
  expectedText: string;
  rowIndex: number;
}

type DecisionExampleInput = {
  visualEvidence: DecisionExampleEvidence[];
} & (DecisionExampleRowInput | {
  selectedRows: DecisionExampleRowInput[];
});

interface DecisionExampleResult {
  evidenceImageFileNames: string[];
  languageIssues: string[];
  passed: boolean;
  rowIndex: number;
}

interface DecisionExampleOutput {
  results: DecisionExampleResult[];
}

interface GraphemeSegmenter {
  segment(value: string): Iterable<unknown>;
}

interface GraphemeSegmenterConstructor {
  new (
    locales?: string | string[],
    options?: { granularity: 'grapheme' }
  ): GraphemeSegmenter;
}

interface FriendlyIssueFragments {
  copy?: string;
  image?: string;
}

const FRIENDLY_REPLACEMENT_PATTERN = /^Expected '([^']+)', but the image shows '([^']+)'\.$/;
const FRIENDLY_MISSING_PATTERN = /^The image is missing '([^']+)'\.$/;
const FRIENDLY_EXTRA_PATTERN = /^The image has an extra '([^']+)'\.$/;
const FRIENDLY_GENERIC_ISSUES = new Set([
  'Part of the image is too unclear to read.',
  'Please upload an image to check this text.',
  'The expected text could not be found in the image.',
  'The image has an extra space.',
  'The image is missing a space.',
  'The text in the image is different from the expected text.',
]);

const countGraphemeClusters = (value: string): number => {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: GraphemeSegmenterConstructor;
  }).Segmenter;
  if (!Segmenter) {
    return Array.from(value).length;
  }
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length;
};

const readPromptSection = (sectionName: string): string => {
  const openingTag = `<${sectionName}>`;
  const closingTag = `</${sectionName}>`;
  return COPY_TEST_VALIDATION_SYSTEM_PROMPT.split(openingTag)[1]
    ?.split(closingTag)[0] || '';
};

const DECISION_EXAMPLES = readPromptSection('decision_examples');

const getDecisionExampleIds = (): string[] => {
  return Array.from(
    DECISION_EXAMPLES.matchAll(/^## (D\d{2}) —/gm),
    match => match[1]
  );
};

const getDecisionExample = (id: string): string => {
  const pattern = new RegExp(`## ${id} —[\\s\\S]*?(?=\\n## D\\d{2} —|$)`);
  return DECISION_EXAMPLES.match(pattern)?.[0] || '';
};

const readDecisionExampleLine = <T>(id: string, label: 'Input' | 'Output'): T => {
  const line = getDecisionExample(id)
    .split('\n')
    .find(candidate => candidate.startsWith(`${label}: `));
  return JSON.parse(line?.slice(`${label}: `.length) || '{}') as T;
};

const readDecisionExampleInput = (id: string): DecisionExampleInput => {
  return readDecisionExampleLine<DecisionExampleInput>(id, 'Input');
};

const readDecisionExampleOutput = (id: string): DecisionExampleOutput => {
  return readDecisionExampleLine<DecisionExampleOutput>(id, 'Output');
};

const getDecisionExampleRows = (input: DecisionExampleInput): DecisionExampleRowInput[] => {
  if ('selectedRows' in input) {
    return input.selectedRows;
  }
  return [input];
};

const getDecisionExampleRow = (
  input: DecisionExampleInput,
  rowIndex: number
): DecisionExampleRowInput => {
  const row = getDecisionExampleRows(input).find(candidate => {
    return candidate.rowIndex === rowIndex;
  });
  if (!row) {
    throw new Error(`Decision example is missing rowIndex ${rowIndex}`);
  }
  return row;
};

const getSelectedImageCopy = (
  input: DecisionExampleInput,
  result: DecisionExampleResult
): string | undefined => {
  const selectedFileName = result.evidenceImageFileNames[0];
  const selectedEvidence = input.visualEvidence.find(evidence => {
    return evidence.fileName === selectedFileName;
  });
  if (selectedEvidence?.fullCopyUnit) {
    return selectedEvidence.fullCopyUnit;
  }
  const rowPosition = getDecisionExampleRows(input).findIndex(row => {
    return row.rowIndex === result.rowIndex;
  });
  return selectedEvidence?.copyUnits?.[rowPosition];
};

const readFriendlyIssueFragments = (issue: string): FriendlyIssueFragments => {
  const replacementMatch = issue.match(FRIENDLY_REPLACEMENT_PATTERN);
  if (replacementMatch) {
    return { copy: replacementMatch[1], image: replacementMatch[2] };
  }
  const missingMatch = issue.match(FRIENDLY_MISSING_PATTERN);
  if (missingMatch) {
    return { copy: missingMatch[1] };
  }
  const extraMatch = issue.match(FRIENDLY_EXTRA_PATTERN);
  return extraMatch ? { image: extraMatch[1] } : {};
};

const assertSourceFragment = (fragment: string | undefined, source?: string): void => {
  if (!fragment) {
    return;
  }
  expect(source).toBeDefined();
  expect(source?.includes(fragment)).toBe(true);
  expect(fragment).not.toBe(source);
  expect(countGraphemeClusters(fragment)).toBeLessThanOrEqual(12);
};

const assertFriendlyIssue = (
  issue: string,
  copyText?: string,
  imageText?: string
): void => {
  const fragments = readFriendlyIssueFragments(issue);
  const hasFriendlyTemplate = Boolean(fragments.copy || fragments.image)
    || FRIENDLY_GENERIC_ISSUES.has(issue);

  expect(hasFriendlyTemplate).toBe(true);
  expect(issue).toMatch(/^[A-Z].+\.$/);
  expect(issue).not.toMatch(/\[[^\]]+\]/);
  expect(issue).not.toMatch(/\b(?:canonical|grapheme|hunk|occurrence)\b/i);
  expect(issue).not.toContain('Copy value');
  expect(issue).not.toContain('Image value');
  expect(issue).not.toContain('—');
  if (copyText) {
    expect(issue).not.toContain(copyText);
  }
  if (imageText) {
    expect(issue).not.toContain(imageText);
  }
  assertSourceFragment(fragments.copy, copyText);
  assertSourceFragment(fragments.image, imageText);
};

const assertFailedExampleResult = (
  input: DecisionExampleInput,
  result: DecisionExampleResult
): void => {
  const row = getDecisionExampleRow(input, result.rowIndex);
  const imageText = getSelectedImageCopy(input, result);

  expect(result.passed).toBe(false);
  expect(result.languageIssues.length).toBeGreaterThan(0);
  expect(new Set(result.languageIssues).size).toBe(result.languageIssues.length);
  result.languageIssues.forEach(issue => {
    assertFriendlyIssue(issue, row.expectedText, imageText);
  });
};

describe('copyTestValidationPrompt production contract', () => {
  it('uses GPT-5.6 Terra and serializes only runtime inputs', () => {
    expect(COPY_TEST_VALIDATION_MODEL).toBe('openai/gpt-5.6-terra');
    expect(COPY_TEST_MAX_OUTPUT_TOKENS).toBe(128_000);

    const prompt = buildCopyTestValidationPrompt(
      [
        { evidenceGroupId: 0, expected: '你好', rowIndex: 0 },
        { evidenceGroupId: 0, expected: '我在', rowIndex: 2 },
      ],
      'Target Copy',
      ['screen-a.png', 'screen-b.png']
    );

    expect(JSON.parse(prompt)).toEqual({
      selectedRows: [
        { evidenceGroupId: 0, expectedText: '你好', rowIndex: 0 },
        { evidenceGroupId: 0, expectedText: '我在', rowIndex: 2 },
      ],
      targetColumnName: 'Target Copy',
      uploadedScreenshots: [
        { fileName: 'screen-a.png' },
        { fileName: 'screen-b.png' },
      ],
    });
    expect(JSON.parse(buildCopyTestValidationPrompt([], 'Target'))).toEqual({
      selectedRows: [],
      targetColumnName: 'Target',
      uploadedScreenshots: [],
    });
  });

  it('keeps a lean stable prompt, immutable groups, and one Evidence winner', () => {
    const inputContract = readPromptSection('input_and_boundaries');
    const selectionContract = readPromptSection('group_screenshot_selection');
    const groupInput = readDecisionExampleInput('D01');
    const groupOutput = readDecisionExampleOutput('D01');
    const promptWordCount = COPY_TEST_VALIDATION_SYSTEM_PROMPT.trim().split(/\s+/).length;

    expect(promptWordCount).toBeLessThan(1_500);
    expect(inputContract).toMatch(/Rows sharing an evidenceGroupId are indivisible/i);
    expect(inputContract).toMatch(/Never create, split, merge, or renumber groups/i);
    expect(inputContract).toMatch(/application owns table structure/i);
    expect(inputContract).toMatch(/Never return or decide rowspan, merged cells/i);
    expect(selectionContract).toMatch(/every group row against every uploaded screenshot/i);
    expect(selectionContract).toMatch(/Earlier upload order.*final tie-break/i);
    expect(selectionContract).toMatch(/exactly one screenshot per evidenceGroupId/i);
    expect(selectionContract).toMatch(/singleton Evidence/i);
    expect(getDecisionExampleRows(groupInput)).toEqual([
      { evidenceGroupId: 7, expectedText: 'Email', rowIndex: 0 },
      { evidenceGroupId: 7, expectedText: 'Password', rowIndex: 1 },
    ]);
    expect(groupOutput.results).toEqual([
      {
        evidenceImageFileNames: ['complete.png'],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: ['complete.png'],
        languageIssues: ["Expected 'or', but the image shows 'ro'."],
        passed: false,
        rowIndex: 1,
      },
    ]);
  });

  it('treats slash variants and slash-adjacent whitespace as equivalent only', () => {
    const comparisonContract = readPromptSection('canonical_comparison');
    const equivalentSlash = readDecisionExampleOutput('D03').results[0];
    const missingSegment = readDecisionExampleOutput('D04').results[0];
    const extraEmptySegment = readDecisionExampleOutput('D07').results[0];

    expect(comparisonContract).toMatch(/Map only "\/", "／", "⁄", and "∕" to "\/"/i);
    expect(comparisonContract).toMatch(
      /remove the entire run of Unicode whitespace immediately before it and immediately after it/i
    );
    expect(comparisonContract).toMatch(/whitespace presence and position are meaningful/i);
    expect(comparisonContract).toMatch(/exact length of one whitespace run is not/i);
    expect(comparisonContract).toMatch(/Preserve slash count and empty segments/i);
    expect(comparisonContract).toContain('"XXX/XXX/XXX", "XXX / XXX / XXX", and "XXX/ XXX /XXX" are equal');
    expect(comparisonContract).toContain('"XXX//XXX/XXX"');
    expect(equivalentSlash).toEqual({
      evidenceImageFileNames: ['slash-spacing.png'],
      languageIssues: [],
      passed: true,
      rowIndex: 0,
    });
    expect(missingSegment).toEqual({
      evidenceImageFileNames: ['missing-segment.png'],
      languageIssues: [
        "The image is missing '/CCC'.",
      ],
      passed: false,
      rowIndex: 0,
    });
    expect(extraEmptySegment).toEqual({
      evidenceImageFileNames: ['extra-slash.png'],
      languageIssues: [
        "The image has an extra '/'.",
      ],
      passed: false,
      rowIndex: 0,
    });
  });

  it('returns every minimal difference as its own languageIssues element', () => {
    const failureContract = readPromptSection('failure_issues');
    const chineseMismatch = readDecisionExampleOutput('D02').results[0];
    const repeatedMismatch = readDecisionExampleOutput('D08').results[0];

    expect(failureContract).toMatch(/each distinct hunk.*separate languageIssues element/i);
    expect(failureContract).toMatch(/one issue to one difference/i);
    expect(failureContract).toMatch(/Copy text always comes from expectedText/i);
    expect(failureContract).toMatch(/image text always comes from lockedImageText/i);
    expect(failureContract).toMatch(/Remove all unchanged prefix, suffix, and inter-hunk context/i);
    expect(failureContract).toMatch(/each independently located unreadable region.*separate/i);
    expect(failureContract).toMatch(/Still return every independently verified readable hunk/i);
    expect(failureContract).toMatch(/Only when the complete unit cannot be segmented or aligned/i);
    expect(failureContract).toMatch(/locally unreadable glyph never suppresses other verified hunks/i);
    expect(failureContract).toMatch(/short English sentences written for a general user/i);
    expect(failureContract).toMatch(/same completed user-facing sentence.*return it only once/i);
    expect(failureContract).toMatch(/Never show bracketed placeholder tokens/i);
    expect(failureContract).not.toContain('Original:');
    expect(failureContract).not.toContain('Expected:');
    expect(failureContract).not.toContain('<Reliable location or edit type>');
    expect(failureContract).not.toContain('(occurrence N)');
    expect(failureContract).not.toContain(' | ');
    expect(chineseMismatch.languageIssues).toEqual([
      "Expected '输', but the image shows '輸'.",
      "Expected '信息', but the image shows '資料'.",
    ]);
    expect(readFriendlyIssueFragments(chineseMismatch.languageIssues[0])).toEqual({
      copy: '输',
      image: '輸',
    });
    expect(readFriendlyIssueFragments(chineseMismatch.languageIssues[1])).toEqual({
      copy: '信息',
      image: '資料',
    });
    expect(repeatedMismatch.languageIssues).toEqual([
      "Expected 'X', but the image shows 'Y'.",
    ]);
  });

  it('keeps Chinese glyphs and punctuation literal without inventing image text', () => {
    const visualContract = readPromptSection('visual_reading');
    const punctuationMismatch = readDecisionExampleOutput('D05').results[0];
    const unreadableChinese = readDecisionExampleOutput('D06').results[0];

    expect(visualContract).toMatch(/Read Han characters by visible glyph shape/i);
    expect(visualContract).toMatch(/Simplified and Traditional forms.*differ/i);
    expect(visualContract).toMatch(/Never invent a likely character/i);
    expect(visualContract).toMatch(/Treat punctuation as literal pixels/i);
    expect(visualContract).toMatch(/"\.", "．", "。", and "｡" differ/i);
    expect(punctuationMismatch.languageIssues).toEqual([
      "Expected '.', but the image shows '。'.",
    ]);
    expect(unreadableChinese.languageIssues).toEqual([
      'Part of the image is too unclear to read.',
    ]);
  });

  it('uses minimal raw fragments in plain user-facing sentences', () => {
    const failureContract = readPromptSection('failure_issues');

    expect(failureContract).toMatch(/at most 12 Unicode grapheme clusters/i);
    expect(failureContract).toMatch(/Never truncate/i);
    expect(failureContract).toMatch(/Never report whitespace removed by slash normalization/i);
    expect(failureContract).toMatch(/Do not include.*full source strings, unchanged context/i);
    expect(failureContract).toContain('Please upload an image to check this text.');
    expect(failureContract).toContain('The expected text could not be found in the image.');
    expect(failureContract).toContain('The text in the image is different from the expected text.');
    expect(countGraphemeClusters('e\u0301')).toBe(1);
    expect(countGraphemeClusters('🇨🇳')).toBe(1);
    expect(countGraphemeClusters('👩‍💻')).toBe(1);

    getDecisionExampleIds().forEach(id => {
      const input = readDecisionExampleInput(id);
      readDecisionExampleOutput(id).results.forEach(result => {
        if (result.passed) {
          expect(result.languageIssues).toEqual([]);
          return;
        }
        assertFailedExampleResult(input, result);
      });
    });
  });

  it('keeps every example on the exact four-field response schema', () => {
    const outputContract = readPromptSection('output_contract');
    const declaredFields = outputContract
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^- (rowIndex|passed|evidenceImageFileNames|languageIssues):/.test(line))
      .map(line => line.slice(2, line.indexOf(':')));

    expect(getDecisionExampleIds()).toEqual([
      'D01',
      'D02',
      'D03',
      'D04',
      'D05',
      'D06',
      'D07',
      'D08',
    ]);
    expect(outputContract).toMatch(/root object contains exactly one field: results/i);
    expect(outputContract).toMatch(/exactly these four fields/i);
    expect(outputContract).toMatch(/one or more unique strings/i);
    expect(outputContract).toMatch(/exactly one independently reportable difference per array element/i);
    expect(declaredFields).toEqual([
      'rowIndex',
      'passed',
      'evidenceImageFileNames',
      'languageIssues',
    ]);
    expect(outputContract).toMatch(/Never add fields.*group metadata, rowspan, evidenceRowSpan/i);

    getDecisionExampleIds().forEach(id => {
      const input = readDecisionExampleInput(id);
      const output = readDecisionExampleOutput(id);
      const rows = getDecisionExampleRows(input);
      const uploadedFileNames = input.visualEvidence.map(evidence => evidence.fileName);

      expect(Object.keys(output)).toEqual(['results']);
      expect(output.results).toHaveLength(rows.length);
      output.results.forEach(result => {
        const row = getDecisionExampleRow(input, result.rowIndex);

        expect(Object.keys(result)).toEqual([
          'rowIndex',
          'passed',
          'evidenceImageFileNames',
          'languageIssues',
        ]);
        expect(result).not.toHaveProperty('evidenceGroupId');
        expect(result).not.toHaveProperty('rowspan');
        expect(result.rowIndex).toBe(row.rowIndex);
        expect(result.evidenceImageFileNames).toHaveLength(1);
        expect(uploadedFileNames).toContain(result.evidenceImageFileNames[0]);
        if (result.passed) {
          expect(result.languageIssues).toEqual([]);
        } else {
          expect(result.languageIssues.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
