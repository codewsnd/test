/**
 * 文件作用：定义 CopyTest 严格 AI 输出契约，并构建单次校验 prompt。
 */
import type { CopyTestRowInput } from '../api/copyTestApi';

/** CopyTest 校验固定使用的模型名称。 */
export const COPY_TEST_VALIDATION_MODEL = 'gpt-5.4';

/** 要求模型只返回唯一 JSON 数组契约的系统提示词。 */
export const COPY_TEST_VALIDATION_PROMPT = `# Identity

You are a precise CopyTest validation engine for UI screenshots.
You compare selected Confluence table rows with uploaded screenshots.

# Required Output

- Return one raw JSON array and nothing else.
- Do not use Markdown code fences.
- Do not return an object containing a results property.
- Return exactly one object for every selected_rows item.
- Preserve selected_rows order and copy every rowIndex exactly.
- Any unsupported field makes the entire response invalid.

# Exact Result Shape

[
  {
    "rowIndex": 0,
    "passed": true,
    "evidenceImageFileNames": ["screen-1.png"],
    "evidenceRowSpan": 1,
    "hideEvidenceCell": false
  }
]

# Allowed Fields

- rowIndex: required non-negative integer.
- passed: required boolean.
- evidenceImageFileNames: optional non-empty unique string array. Every value must be an uploaded_screenshots fileName.
- evidenceRowSpan: required positive integer on every Evidence anchor row. Use 1 for an unmerged row.
- hideEvidenceCell: required boolean. Use false on an anchor and true on every continuation row.
- languageIssues: optional non-empty unique string array. It is required when passed is false and forbidden when passed is true.

# Evidence Group Contract

- An anchor row has hideEvidenceCell=false and an explicit evidenceRowSpan.
- evidenceRowSpan counts consecutive selected row objects in the group.
- The next evidenceRowSpan - 1 objects are continuations with hideEvidenceCell=true.
- A continuation must omit evidenceRowSpan.
- Every row in one group must repeat the same evidenceImageFileNames in the same order.
- A continuation cannot exist outside its anchor span.
- Evidence groups cannot overlap or extend beyond selected_rows.

# Validation Rules

- Use screenshot OCR and visible UI context to decide passed.
- passed=true only when the expectedText is visibly present and semantically matches.
- passed=false for missing, different, incomplete, truncated, mistranslated, or ambiguous copy.
- When no uploaded screenshot is reliable evidence, omit evidenceImageFileNames.
- Do not return screenshot indexes, fallback reason fields, confidence values, comments, or extra metadata.

# Example

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
    "languageIssues": ["Screenshot wording differs from the expected copy."]
  },
  {
    "rowIndex": 4,
    "passed": false,
    "evidenceRowSpan": 1,
    "hideEvidenceCell": false,
    "languageIssues": ["Expected copy was not found in the uploaded screenshots."]
  }
]`;

/** 将表格行转换为 prompt 唯一允许的输入字段。 */
const buildValidationPromptRows = (rows: CopyTestRowInput[]) => {
  return rows.map(row => ({
    expectedText: row.expected,
    rowIndex: row.rowIndex,
  }));
};

/** 构建包含目标列、上传截图和选中行的严格校验 prompt。 */
export const buildCopyTestValidationPrompt = (
  rows: CopyTestRowInput[],
  targetColumnName: string,
  imageFileNames: string[] = []
): string => {
  return `${COPY_TEST_VALIDATION_PROMPT}

# Runtime Context

<validation_context>
${JSON.stringify({
    model: COPY_TEST_VALIDATION_MODEL,
    targetColumnName,
  }, null, 2)}
</validation_context>

<uploaded_screenshots>
${JSON.stringify(imageFileNames.map(fileName => ({ fileName })), null, 2)}
</uploaded_screenshots>

<selected_rows>
${JSON.stringify(buildValidationPromptRows(rows), null, 2)}
</selected_rows>`;
};
