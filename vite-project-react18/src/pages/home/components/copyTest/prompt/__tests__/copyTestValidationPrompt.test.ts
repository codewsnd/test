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

interface DifferenceSide {
  literal?: string;
  token?: string;
}

interface DifferencePair {
  copy: DifferenceSide;
  image: DifferenceSide;
}

const SAFE_DIFFERENCE_TOKENS = new Set([
  '[corresponding fragment unavailable]',
  '[empty]',
  '[fragment omitted]',
  '[no screenshot]',
  '[no space]',
  '[not found]',
  '[not evaluated]',
  '[one space]',
  '[unreadable]',
  '[whole unit omitted]',
]);

const DIFFERENCE_PAIR_PATTERN = /^Copy value (?:'([^']+)'|(\[[a-z ]+\])) differs from Image value (?:'([^']+)'|(\[[a-z ]+\]))(?: \(occurrence \d+\))?\.$/g;

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

const readDifferencePairs = (issue: string): DifferencePair[] => {
  return Array.from(issue.matchAll(DIFFERENCE_PAIR_PATTERN), match => ({
    copy: { literal: match[1], token: match[2] },
    image: { literal: match[3], token: match[4] },
  }));
};

const assertDifferenceSide = (side: DifferenceSide, rawSource?: string): void => {
  if (side.literal) {
    expect(rawSource).toBeDefined();
    expect(rawSource?.includes(side.literal)).toBe(true);
    expect(side.literal).not.toBe(rawSource);
    expect(countGraphemeClusters(side.literal)).toBeLessThanOrEqual(12);
    return;
  }
  expect(SAFE_DIFFERENCE_TOKENS).toContain(side.token);
};

const assertMinimalIssue = (
  issue: string,
  copyText?: string,
  imageText?: string
): void => {
  const differencePairs = readDifferencePairs(issue);

  expect(differencePairs).toHaveLength(1);
  expect(issue.match(/Copy value/g) || []).toHaveLength(1);
  expect(issue.match(/Image value/g) || []).toHaveLength(1);
  expect(issue).toMatch(/^Copy value /);
  expect(issue).not.toContain(' — ');
  expect(issue).not.toContain(' | ');
  if (copyText) {
    expect(issue).not.toContain(copyText);
  }
  if (imageText) {
    expect(issue).not.toContain(imageText);
  }
  assertDifferenceSide(differencePairs[0].copy, copyText);
  assertDifferenceSide(differencePairs[0].image, imageText);
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
    assertMinimalIssue(issue, row.expectedText, imageText);
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
        languageIssues: ["Copy value 'or' differs from Image value 'ro'."],
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
        "Copy value '/CCC' differs from Image value [empty].",
      ],
      passed: false,
      rowIndex: 0,
    });
    expect(extraEmptySegment).toEqual({
      evidenceImageFileNames: ['extra-slash.png'],
      languageIssues: [
        "Copy value [empty] differs from Image value '/'.",
      ],
      passed: false,
      rowIndex: 0,
    });
  });

  it('returns every minimal difference as its own languageIssues element', () => {
    const failureContract = readPromptSection('failure_issues');
    const chineseMismatch = readDecisionExampleOutput('D02').results[0];

    expect(failureContract).toMatch(/every hunk.*separate languageIssues array element/i);
    expect(failureContract).toMatch(/Never combine multiple hunks into one string/i);
    expect(failureContract).toMatch(/Each element describes exactly one hunk/i);
    expect(failureContract).toMatch(/Copy always means expectedText/i);
    expect(failureContract).toMatch(/Image always means the locked transcription/i);
    expect(failureContract).toMatch(/Remove all unchanged prefix, suffix, and inter-hunk context/i);
    expect(failureContract).toMatch(/each independently located unreadable region.*separate/i);
    expect(failureContract).toMatch(/Still return every independently verified readable hunk/i);
    expect(failureContract).toMatch(/Only when the complete unit cannot be segmented or aligned/i);
    expect(failureContract).toMatch(/locally unreadable glyph never suppresses other verified hunks/i);
    expect(failureContract).toMatch(/Every failed issue starts with "Copy value"/i);
    expect(failureContract).toMatch(/Do not add a location or edit-type prefix/i);
    expect(failureContract).toMatch(/append " \(occurrence N\)" immediately before the final period/i);
    expect(failureContract).not.toContain('Original:');
    expect(failureContract).not.toContain('Expected:');
    expect(failureContract).not.toContain('<Reliable location or edit type>');
    expect(failureContract).not.toContain(' | ');
    expect(chineseMismatch.languageIssues).toEqual([
      "Copy value '输' differs from Image value '輸'.",
      "Copy value '信息' differs from Image value '資料'.",
    ]);
    expect(readDifferencePairs(chineseMismatch.languageIssues[0])).toEqual([{
      copy: { literal: '输', token: undefined },
      image: { literal: '輸', token: undefined },
    }]);
    expect(readDifferencePairs(chineseMismatch.languageIssues[1])).toEqual([{
      copy: { literal: '信息', token: undefined },
      image: { literal: '資料', token: undefined },
    }]);
    expect(readDifferencePairs(
      "Copy value 'x' differs from Image value 'y' (occurrence 2)."
    )).toEqual([{
      copy: { literal: 'x', token: undefined },
      image: { literal: 'y', token: undefined },
    }]);
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
      "Copy value '.' differs from Image value '。'.",
    ]);
    expect(unreadableChinese.languageIssues).toEqual([
      'Copy value [corresponding fragment unavailable] differs from Image value [unreadable].',
    ]);
  });

  it('uses only minimal raw fragments or safe fallback tokens', () => {
    const failureContract = readPromptSection('failure_issues');

    expect(failureContract).toMatch(/at most 12 Unicode grapheme clusters/i);
    expect(failureContract).toMatch(/Never truncate/i);
    expect(failureContract).toMatch(/Never report whitespace removed by slash normalization/i);
    expect(failureContract).toMatch(/Do not include.*full source strings, unchanged context/i);
    SAFE_DIFFERENCE_TOKENS.forEach(token => {
      expect(failureContract).toContain(token);
    });
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
    ]);
    expect(outputContract).toMatch(/root object contains exactly one field: results/i);
    expect(outputContract).toMatch(/exactly these four fields/i);
    expect(outputContract).toMatch(/one or more unique strings/i);
    expect(outputContract).toMatch(/exactly one independently reportable minimal hunk per array element/i);
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
