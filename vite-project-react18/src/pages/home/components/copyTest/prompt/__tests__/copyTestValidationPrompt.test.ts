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
  expected: DifferenceSide;
  original: DifferenceSide;
}

const countGraphemeClusters = (value: string): number => {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: GraphemeSegmenterConstructor;
  }).Segmenter;
  if (!Segmenter) {
    return Array.from(value).length;
  }
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length;
};

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

const DIFFERENCE_PAIR_PATTERN = /Original: (?:'([^']+)'|(\[[a-z ]+\])); Expected: (?:'([^']+)'|(\[[a-z ]+\]))/g;

const READABLE_MISMATCH_EXAMPLE_IDS = ['D01', 'D02', 'D04', 'D05', 'D06', 'D07', 'D08'];

const CANONICAL_SAFE_ISSUES = [
  'At the unreadable Chinese character — Original: [unreadable]; Expected: [corresponding fragment unavailable]',
  'At the unreadable punctuation — Original: [unreadable]; Expected: [corresponding fragment unavailable]',
  'Target copy — Original: [not found]; Expected: [whole unit omitted]',
  'Target copy — Original: [no screenshot]; Expected: [not evaluated]',
  'Whole unit — Original: [whole unit omitted]; Expected: [whole unit omitted]',
];

const readDifferencePairs = (issue: string): DifferencePair[] => {
  return Array.from(issue.matchAll(DIFFERENCE_PAIR_PATTERN), match => ({
    expected: { literal: match[3], token: match[4] },
    original: { literal: match[1], token: match[2] },
  }));
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

const getSelectedObservedCopy = (
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

const assertReadableMismatchResult = (
  input: DecisionExampleInput,
  result: DecisionExampleResult
): void => {
  const row = getDecisionExampleRow(input, result.rowIndex);
  const issue = result.languageIssues[0];
  const observedCopy = getSelectedObservedCopy(input, result);
  const differencePairs = readDifferencePairs(issue);

  expect(result.passed).toBe(false);
  expect(result.languageIssues).toHaveLength(1);
  expect(differencePairs.length).toBeGreaterThan(0);
  expect(issue.match(/Original:/g) || []).toHaveLength(differencePairs.length);
  expect(issue.match(/Expected:/g) || []).toHaveLength(differencePairs.length);
  expect(issue).not.toContain(row.expectedText);
  if (observedCopy) {
    expect(issue).not.toContain(observedCopy);
  }
  differencePairs.forEach(pair => {
    assertDifferenceSide(pair.original, observedCopy);
    assertDifferenceSide(pair.expected, row.expectedText);
  });
};

const assertCanonicalSafeIssue = (issue: string): void => {
  const differencePairs = readDifferencePairs(issue);

  expect(differencePairs).toHaveLength(1);
  expect(issue.match(/Original:/g) || []).toHaveLength(1);
  expect(issue.match(/Expected:/g) || []).toHaveLength(1);
  expect(issue).not.toMatch(/'[^']+'/);
  expect(SAFE_DIFFERENCE_TOKENS).toContain(differencePairs[0].original.token);
  expect(SAFE_DIFFERENCE_TOKENS).toContain(differencePairs[0].expected.token);
};

describe('copyTestValidationPrompt strict contract', () => {
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

  it('keeps application groups indivisible and selects one shared screenshot per group', () => {
    const inputContract = readPromptSection('input_contract');
    const selectionContract = readPromptSection('group_screenshot_selection');
    const groupInput = readDecisionExampleInput('D01');
    const groupOutput = readDecisionExampleOutput('D01');

    expect(inputContract).toMatch(/same evidenceGroupId are indivisible/i);
    expect(inputContract).toMatch(/Never create, split, merge, or renumber groups/i);
    expect(inputContract).toMatch(/application owns table structure/i);
    expect(inputContract).toMatch(/Never return or decide rowspan, merged cells/i);
    expect(selectionContract).toMatch(/every group row against every uploaded screenshot/i);
    expect(selectionContract).toMatch(/Earlier upload order.*final tie-break/i);
    expect(selectionContract).toMatch(/exactly one screenshot per evidenceGroupId/i);
    expect(selectionContract).toMatch(/single Evidence item for every row in the group/i);
    expect(selectionContract).toMatch(/With no uploads, return no Evidence/i);
    expect(getDecisionExampleRows(groupInput)).toEqual([
      { evidenceGroupId: 7, expectedText: 'Email', rowIndex: 0 },
      { evidenceGroupId: 7, expectedText: 'Password', rowIndex: 1 },
    ]);
    expect(groupInput.visualEvidence).toEqual([
      { copyUnits: ['Email'], fileName: 'partial.png' },
      { copyUnits: ['Email', 'Passwrod'], fileName: 'complete.png' },
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
        languageIssues: ["In the middle — Original: 'ro'; Expected: 'or'"],
        passed: false,
        rowIndex: 1,
      },
    ]);
    groupOutput.results.forEach(result => {
      expect(Object.keys(result).sort()).toEqual([
        'evidenceImageFileNames',
        'languageIssues',
        'passed',
        'rowIndex',
      ]);
    });
  });

  it('compares Simplified and Traditional Chinese by readable glyphs without guessing', () => {
    const chineseContract = readPromptSection('chinese_glyph_rules');
    const scriptMismatchResult = readDecisionExampleOutput('D02').results[0];
    const unreadableResult = readDecisionExampleOutput('D03').results[0];

    expect(chineseContract).toMatch(/exact visible glyph sequence, not by meaning/i);
    expect(chineseContract).toMatch(/Simplified and Traditional forms are different characters/i);
    expect(chineseContract).toMatch(/Never convert between them/i);
    expect(chineseContract).toMatch(/must come from a glyph that is actually readable/i);
    expect(chineseContract).toMatch(/Never invent a likely Traditional\/Simplified counterpart/i);
    expect(chineseContract).toMatch(/do not quote a guessed glyph/i);
    expect(chineseContract).toMatch(/Identical visible strings pass/i);
    expect(scriptMismatchResult).toEqual({
      evidenceImageFileNames: ['traditional.png'],
      languageIssues: [
        "At the beginning — Original: '輸'; Expected: '输' | Near the end — Original: '資料'; Expected: '信息'",
      ],
      passed: false,
      rowIndex: 0,
    });
    expect(unreadableResult).toMatchObject({
      evidenceImageFileNames: ['blurred-han.png'],
      languageIssues: [
        'At the unreadable Chinese character — Original: [unreadable]; Expected: [corresponding fragment unavailable]',
      ],
      passed: false,
    });
  });

  it('treats punctuation forms as exact visual characters', () => {
    const punctuationContract = readPromptSection('punctuation_and_spacing_rules');
    const normalizationContract = readPromptSection('allowed_normalization');
    const periodResult = readDecisionExampleOutput('D04').results[0];
    const commaResult = readDecisionExampleOutput('D05').results[0];
    const missingPunctuationResult = readDecisionExampleOutput('D06').results[0];
    const spacedSlashResult = readDecisionExampleOutput('D07').results[0];

    expect(punctuationContract).toMatch(/Punctuation is literal visual content/i);
    expect(punctuationContract).toMatch(/Distinguish ASCII, full-width, CJK, Arabic, and curly forms/i);
    expect(punctuationContract).toMatch(/keep "\.", "．", "。", and "｡" distinct/i);
    expect(punctuationContract).toMatch(/keep ",", "，", and "、" distinct/i);
    expect(punctuationContract).toMatch(/Language convention and expectedText are not visual evidence/i);
    expect(punctuationContract).toMatch(/mark the pair unreadable/i);
    expect(normalizationContract).toMatch(/Do not normalize any other punctuation/i);
    expect(periodResult.languageIssues).toEqual([
      "At the end — Original: '。'; Expected: '.'",
    ]);
    expect(commaResult.languageIssues).toEqual([
      "In the middle — Original: '、'; Expected: '，'",
    ]);
    expect(missingPunctuationResult.languageIssues).toEqual([
      "At the end — Original: [empty]; Expected: '。'",
    ]);
    expect(spacedSlashResult.languageIssues).toEqual([
      'Before the slash — Original: [one space]; Expected: [no space] | After the slash — Original: [one space]; Expected: [no space]',
    ]);
  });

  it('defines minimal raw-hunk pairs and safe fallback tokens for every failure', () => {
    const roleContract = readPromptSection('role_and_goal');
    const failureContract = readPromptSection('failure_message_contract');

    expect(roleContract).toMatch(/passes if and only if/i);
    expect(roleContract).toMatch(/readable mismatch, an unreadable required detail, or a missing target fails/i);
    expect(failureContract).toMatch(/Every failure must present Original before Expected/i);
    expect(failureContract).toMatch(/Original always means the screenshot's locked visible side/i);
    expect(failureContract).toMatch(/Expected always means the expectedText side/i);
    expect(failureContract).toMatch(/Only when the complete copy unit is readable/i);
    expect(failureContract).toMatch(/shortest contiguous edit hunks/i);
    expect(failureContract).toMatch(
      /mapping from every normalized span back to its corresponding raw expectedText and lockedVisibleText spans/i
    );
    expect(failureContract).toMatch(/Remove every unchanged prefix, suffix, and inter-edit context/i);
    expect(failureContract).toMatch(
      /quoted expected fragment.*exact raw span mapped from that edit hunk in expectedText/i
    );
    expect(failureContract).toMatch(
      /quoted visible fragment.*exact raw span mapped from that edit hunk in the locked pixel transcription/i
    );
    expect(failureContract).toMatch(/coincidental occurrence elsewhere.*not valid provenance/i);
    expect(failureContract).toMatch(/raw mapping is not unique, use \[fragment omitted\]/i);
    expect(failureContract).toMatch(
      /Never quote inferred, autocorrected, translated, normalized, or uncertain text/i
    );
    expect(failureContract).toMatch(/Never invent or fabricate a quoted difference/i);
    expect(failureContract).toMatch(/no longer than 12 Unicode grapheme clusters/i);
    expect(failureContract).toMatch(/Never truncate a longer hunk/i);
    expect(failureContract).toMatch(/\[fragment omitted\] for a long or non-unique raw span/i);
    expect(failureContract).toMatch(/\[whole unit omitted\].*complete copy unit/i);
    expect(failureContract).toMatch(/Original: <originalSide>; Expected: <expectedSide>/i);
    expect(failureContract).toMatch(/multiple disjoint hunks.*join clauses with " \| "/i);
    expect(failureContract).toMatch(/absent side uses \[empty\]/i);
    expect(failureContract).toMatch(/whitespace-only boundary hunk.*\[one space\].*\[no space\]/i);
    expect(failureContract).toMatch(
      /If any required part.*unreadable, use \[unreadable\] for Original and do not infer a visible hunk/i
    );
    expect(failureContract).toMatch(
      /Quote Expected only when.*raw span is uniquely aligned.*otherwise use \[corresponding fragment unavailable\]/i
    );
    SAFE_DIFFERENCE_TOKENS.forEach(token => {
      expect(failureContract).toContain(token);
    });
    expect(failureContract).toMatch(/Every failed issue must contain both "Original:" and "Expected:"/i);
    expect(failureContract).toMatch(/Do not include.*full source strings, unchanged context/i);
    expect(countGraphemeClusters('e\u0301')).toBe(1);
    expect(countGraphemeClusters('🇨🇳')).toBe(1);
    expect(countGraphemeClusters('👩‍💻')).toBe(1);

    CANONICAL_SAFE_ISSUES.forEach(issue => {
      expect(failureContract).toContain(`"${issue}"`);
      assertCanonicalSafeIssue(issue);
    });
  });

  it('formats readable substitutions, multiple hunks, insertions, and deletions as raw pairs', () => {
    const groupMismatch = readDecisionExampleOutput('D01').results[1];
    const chineseMismatch = readDecisionExampleOutput('D02').results[0];
    const periodMismatch = readDecisionExampleOutput('D04').results[0];
    const commaMismatch = readDecisionExampleOutput('D05').results[0];
    const insertion = readDecisionExampleOutput('D06').results[0];
    const spacingMismatch = readDecisionExampleOutput('D07').results[0];
    const deletion = readDecisionExampleOutput('D08').results[0];

    expect(readDifferencePairs(groupMismatch.languageIssues[0])).toEqual([{
      expected: { literal: 'or', token: undefined },
      original: { literal: 'ro', token: undefined },
    }]);
    expect(readDifferencePairs(chineseMismatch.languageIssues[0])).toEqual([
      {
        expected: { literal: '输', token: undefined },
        original: { literal: '輸', token: undefined },
      },
      {
        expected: { literal: '信息', token: undefined },
        original: { literal: '資料', token: undefined },
      },
    ]);
    expect(chineseMismatch.languageIssues[0]).toContain(' | ');
    expect(readDifferencePairs(periodMismatch.languageIssues[0])).toEqual([{
      expected: { literal: '.', token: undefined },
      original: { literal: '。', token: undefined },
    }]);
    expect(readDifferencePairs(commaMismatch.languageIssues[0])).toEqual([{
      expected: { literal: '，', token: undefined },
      original: { literal: '、', token: undefined },
    }]);
    expect(readDifferencePairs(insertion.languageIssues[0])).toEqual([{
      expected: { literal: '。', token: undefined },
      original: { literal: undefined, token: '[empty]' },
    }]);
    expect(readDifferencePairs(spacingMismatch.languageIssues[0])).toEqual([
      {
        expected: { literal: undefined, token: '[no space]' },
        original: { literal: undefined, token: '[one space]' },
      },
      {
        expected: { literal: undefined, token: '[no space]' },
        original: { literal: undefined, token: '[one space]' },
      },
    ]);
    expect(readDifferencePairs(deletion.languageIssues[0])).toEqual([{
      expected: { literal: undefined, token: '[empty]' },
      original: { literal: '2', token: undefined },
    }]);

    READABLE_MISMATCH_EXAMPLE_IDS.forEach(id => {
      const input = readDecisionExampleInput(id);
      readDecisionExampleOutput(id).results.forEach(result => {
        if (result.passed) {
          return;
        }
        assertReadableMismatchResult(input, result);
      });
    });

    getDecisionExampleIds().forEach(id => {
      readDecisionExampleOutput(id).results.forEach(result => {
        if (result.passed) {
          return;
        }
        const issue = result.languageIssues[0];
        expect(issue).toContain('Original:');
        expect(issue).toContain('Expected:');
        expect(readDifferencePairs(issue).length).toBeGreaterThan(0);
      });
    });
  });

  it('keeps every example on the four-field response schema without group or rowspan output', () => {
    const outputContract = readPromptSection('output_contract');
    const declaredFields = outputContract
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^- (rowIndex|passed|evidenceImageFileNames|languageIssues):/.test(line))
      .map(line => line.slice(2, line.indexOf(':')));

    expect(getDecisionExampleIds()).toEqual(expect.arrayContaining([
      'D01',
      'D02',
      'D03',
      'D04',
      'D05',
      'D06',
      'D07',
      'D08',
    ]));
    expect(outputContract).toMatch(/root object contains exactly one field: results/i);
    expect(outputContract).toMatch(/exactly these four fields/i);
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

        expect(Object.keys(result).sort()).toEqual([
          'evidenceImageFileNames',
          'languageIssues',
          'passed',
          'rowIndex',
        ]);
        expect(result).not.toHaveProperty('evidenceGroupId');
        expect(result).not.toHaveProperty('rowspan');
        expect(result).not.toHaveProperty('evidenceRowSpan');
        expect(result.rowIndex).toBe(row.rowIndex);
        expect(result.evidenceImageFileNames).toHaveLength(1);
        expect(uploadedFileNames).toContain(result.evidenceImageFileNames[0]);
        expect(result.languageIssues).toHaveLength(result.passed ? 0 : 1);
      });
    });
  });
});
