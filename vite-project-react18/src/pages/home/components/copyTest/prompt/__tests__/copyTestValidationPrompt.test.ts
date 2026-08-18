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

describe('copyTestValidationPrompt strict contract', () => {
  it('uses GPT-5.6 Terra and serializes only runtime inputs', () => {
    expect(COPY_TEST_VALIDATION_MODEL).toBe('gpt-5.6-terra');
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
        languageIssues: ["In the middle, use 'or' instead of 'ro'."],
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
        "At the beginning, use '输' instead of '輸'; near the end, use '信息' instead of '資料'.",
      ],
      passed: false,
      rowIndex: 0,
    });
    expect(unreadableResult).toMatchObject({
      evidenceImageFileNames: ['blurred-han.png'],
      languageIssues: ['A Chinese character in the target copy is too unclear to verify.'],
      passed: false,
    });
  });

  it('treats punctuation forms as exact visual characters', () => {
    const punctuationContract = readPromptSection('punctuation_and_spacing_rules');
    const normalizationContract = readPromptSection('allowed_normalization');
    const periodResult = readDecisionExampleOutput('D04').results[0];
    const commaResult = readDecisionExampleOutput('D05').results[0];
    const normalizedSlashResult = readDecisionExampleOutput('D06').results[0];
    const spacedSlashResult = readDecisionExampleOutput('D07').results[0];

    expect(punctuationContract).toMatch(/Punctuation is literal visual content/i);
    expect(punctuationContract).toMatch(/Distinguish ASCII, full-width, CJK, Arabic, and curly forms/i);
    expect(punctuationContract).toMatch(/keep "\.", "．", "。", and "｡" distinct/i);
    expect(punctuationContract).toMatch(/keep ",", "，", and "、" distinct/i);
    expect(punctuationContract).toMatch(/Language convention and expectedText are not visual evidence/i);
    expect(punctuationContract).toMatch(/mark the pair unreadable/i);
    expect(normalizationContract).toMatch(/Do not normalize any other punctuation/i);
    expect(periodResult.languageIssues).toEqual([
      "At the end, use '.' instead of '。'.",
    ]);
    expect(commaResult.languageIssues).toEqual([
      "In the middle, use '，' instead of '、'.",
    ]);
    expect(normalizedSlashResult).toMatchObject({ languageIssues: [], passed: true });
    expect(spacedSlashResult.languageIssues).toEqual([
      'Remove the spaces on both sides of the slash.',
    ]);
  });

  it('limits failures to minimal, traceable expected or observed fragments', () => {
    const roleContract = readPromptSection('role_and_goal');
    const failureContract = readPromptSection('failure_message_contract');
    const unreadableIssue = readDecisionExampleOutput('D03').results[0].languageIssues[0];

    expect(roleContract).toMatch(/passes if and only if/i);
    expect(roleContract).toMatch(/readable mismatch, an unreadable required detail, or a missing target fails/i);
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
    expect(failureContract).toMatch(/mapping is not unique, describe only the category and location/i);
    expect(failureContract).toMatch(
      /Never quote inferred, autocorrected, translated, normalized, or uncertain text/i
    );
    expect(failureContract).toMatch(/Never invent or fabricate a quoted difference/i);
    expect(failureContract).toMatch(/no longer than 12 Unicode grapheme clusters/i);
    expect(failureContract).toMatch(/Never truncate a longer hunk/i);
    expect(failureContract).toMatch(/longer or whole-unit hunk.*without quoting it/i);
    expect(failureContract).toMatch(
      /If any required part.*unreadable.*unreadable message and do not infer or quote edit hunks/i
    );
    expect(failureContract).toMatch(/Do not include.*full source strings, unchanged context/i);
    expect(unreadableIssue.match(/'[^']+'/g)).toBeNull();
    expect(countGraphemeClusters('e\u0301')).toBe(1);
    expect(countGraphemeClusters('🇨🇳')).toBe(1);
    expect(countGraphemeClusters('👩‍💻')).toBe(1);

    getDecisionExampleIds().forEach(id => {
      const input = readDecisionExampleInput(id);
      readDecisionExampleOutput(id).results.forEach(result => {
        if (result.passed) {
          return;
        }
        const row = getDecisionExampleRow(input, result.rowIndex);
        const issue = result.languageIssues[0];
        const observedCopy = getSelectedObservedCopy(input, result);
        const allowedLiteralSources = [row.expectedText, observedCopy].filter(
          (source): source is string => Boolean(source)
        );
        const quotedFragments = Array.from(issue.matchAll(/'([^']+)'/g), match => match[1]);

        expect(result.languageIssues).toHaveLength(1);
        expect(issue).not.toContain(row.expectedText);
        if (observedCopy) {
          expect(issue).not.toContain(observedCopy);
        }
        quotedFragments.forEach(fragment => {
          expect(fragment.length).toBeGreaterThan(0);
          expect(countGraphemeClusters(fragment)).toBeLessThanOrEqual(12);
          expect(allowedLiteralSources.some(source => source.includes(fragment))).toBe(true);
          expect(allowedLiteralSources).not.toContain(fragment);
        });
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
