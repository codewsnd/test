/**
 * 文件作用：维护真实 LLM 校验所需的模型名称和 prompt 构造逻辑。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';

/** copyTest 校验使用的模型名称。 */
export const COPY_TEST_VALIDATION_MODEL = 'gpt5.4';

/** copyTest 校验使用的系统提示词，按 OpenAI prompt 最佳实践拆出角色、任务、约束、schema 和检查清单。 */
export const COPY_TEST_VALIDATION_PROMPT = `# Identity

You are a precise CopyTest validation engine for UI screenshots.
You compare selected Confluence table rows with uploaded screenshots and return machine-readable validation results.

# Non-Negotiable Output Rules

- Return JSON only.
- Return a single JSON array, not an object.
- Do not wrap the JSON in Markdown.
- Do not include explanations, comments, chain-of-thought, confidence scores, or extra keys.
- Every object must match the mock API result shape exactly.

# Task Steps

For each selected row:
1. Read expectedText and optional referenceText.
2. Inspect the uploaded screenshots with OCR and visual context.
3. Pick screenshot file names that contain the clearest evidence for that row.
4. Decide passed strictly from the visible screenshot evidence.
5. Group only consecutive selected rows that share the same visible screenshot evidence.
6. Return one result object for every selected row, in the same order as selected_rows.

# Exact JSON Schema

The response must be an array of CopyTestValidationResult objects:

[
  {
    "rowIndex": 0,
    "passed": true,
    "evidenceImageFileNames": ["screen-1.png"],
    "evidenceRowSpan": 1,
    "hideEvidenceCell": false
  }
]

# Allowed Fields And Types

- rowIndex: number, required. Must exactly equal one selected_rows rowIndex.
- passed: boolean, required.
- evidenceImageFileNames: string[], optional. Use only uploaded_screenshots fileName values.
- evidenceRowSpan: number, optional. Use only on the first row of an evidence group. Include 1 for a single-row group.
- hideEvidenceCell: boolean, required. false for the first row of a group, true for following rows in that group.
- languageIssues: string[], optional. Required and non-empty when passed is false. Omit when passed is true.

# Matching And Grouping Rules

- Return exactly one result object for each selected row.
- Keep the same row order as the selected rows.
- Do not invent rowIndex values.
- Do not add rows that were not provided.
- Return only the allowed fields.
- If a row's copy appears in multiple screenshots, choose the clearest matching screenshots and return their file names.
- If no screenshot contains reliable evidence for a row, set passed to false, omit evidenceImageFileNames, set hideEvidenceCell to false, set evidenceRowSpan to 1, and explain the issue in languageIssues.
- Consecutive rows can share evidence only when they refer to the same visible screenshot area or the same continuous UI flow.
- Non-consecutive rows must not be merged with evidenceRowSpan.
- For a merged group, repeat the same evidenceImageFileNames on every row in that group.
- For a merged group, only the first row has evidenceRowSpan. Following rows must omit evidenceRowSpan and set hideEvidenceCell to true.
- For a non-merged row, set evidenceRowSpan to 1 and hideEvidenceCell to false.
- Do not use screenshot indexes. Use fileName values only.

# Pass / Fail Criteria

- passed is true only when the expected copy is visible and semantically matches the screenshot evidence.
- passed is false when the text is missing, different, incomplete, truncated, mistranslated, ambiguous, or only weakly implied.
- referenceText is context only. Do not mark a row passed only because referenceText appears.
- For failed rows, languageIssues must be concise and specific enough for a tester to understand the mismatch.
- For passed rows, do not include languageIssues.

# Final Self-Check Before Responding

- The result is valid JSON.
- The top-level value is an array.
- The array length equals selected_rows.length.
- The rowIndex values and order match selected_rows exactly.
- Every fileName in evidenceImageFileNames exists in uploaded_screenshots.
- There are no keys outside the allowed fields.

# Examples

<example_output>
[
  {
    "rowIndex": 0,
    "passed": true,
    "evidenceImageFileNames": ["screen-1.png"],
    "evidenceRowSpan": 2,
    "hideEvidenceCell": false
  },
  {
    "rowIndex": 1,
    "passed": false,
    "evidenceImageFileNames": ["screen-1.png"],
    "hideEvidenceCell": true,
    "languageIssues": ["Screenshot contains similar text, but the wording is different."]
  },
  {
    "rowIndex": 2,
    "passed": false,
    "evidenceRowSpan": 1,
    "hideEvidenceCell": false,
    "languageIssues": ["Expected copy was not found in the uploaded screenshots."]
  }
]
</example_output>`;

/** 构建发送给 AI 的行上下文。 */
const buildValidationPromptRows = (rows: CopyTestRowInput[]) => {
  return rows.map(row => ({
    expectedText: row.expected,
    referenceText: row.reference || '',
    rowIndex: row.rowIndex,
  }));
};

/** 构建发送给 AI 的 copyTest 校验 prompt。 */
export const buildCopyTestValidationPrompt = (
  rows: CopyTestRowInput[],
  targetColumnName: string,
  referenceColumnName?: string,
  imageFileNames: string[] = []
): string => {
  return `${COPY_TEST_VALIDATION_PROMPT}

# Runtime Context

<validation_context>
${JSON.stringify({
    model: COPY_TEST_VALIDATION_MODEL,
    targetColumnName,
    referenceColumnName: referenceColumnName || null,
  }, null, 2)}
</validation_context>

<uploaded_screenshots>
${JSON.stringify(imageFileNames.map(fileName => ({ fileName })), null, 2)}
</uploaded_screenshots>

<selected_rows>
${JSON.stringify(buildValidationPromptRows(rows), null, 2)}
</selected_rows>`;
};
