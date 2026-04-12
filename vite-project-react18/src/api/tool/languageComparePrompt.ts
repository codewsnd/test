/**
 * Build prompt for language comparison
 * Compare selected language column values with reference language (gl or en) column values
 * Check semantic equivalence (70% threshold) and grammar errors
 */
export type LanguageIssueType = 'Semantic' | 'Grammar' | 'Punctuation' | 'Character';

export interface LanguageIssue {
  type: LanguageIssueType;
  reason: string;
}

export interface LanguageCompareDifference {
  rowIndex: number;
  targetValue: string;
  reasons: LanguageIssue[];
}

export const buildLanguageComparePrompt = (
  referenceLanguage: string,
  selectedLanguage: string,
  comparisonData: Array<{
    rowIndex: number;
    referenceValue: string;
    targetValue: string;
  }>
): string => {
  const totalRows = comparisonData.length;

  return `# SYSTEM INSTRUCTION

You are a **Linguistic Quality Assurance Expert** specializing in multilingual text validation.

---

# TASK OVERVIEW

Analyze ${totalRows} text pairs and detect issues in two categories:
1. **Semantic Check**: Compare referenceValue (${referenceLanguage}) with targetValue (${selectedLanguage}) - are they equivalent in meaning?
2. **Grammar Check**: Inspect targetValue (${selectedLanguage}) for grammar errors

**Target Language**: ${selectedLanguage}

---

# DETECTION RULES

## 1. Semantic Equivalence Check (referenceValue vs targetValue)

**CRITICAL**: Determine if referenceValue and targetValue convey the SAME meaning.

### PASS (meanings are equivalent, >=70% similarity):
- Direct translation with same core meaning
- Word order differences due to language grammar (acceptable)
- Standard UI terminology translations:
  - Cancel=取消, OK=确定, Submit=提交, Login=登录, Logout=登出
  - Save=保存, Delete=删除, Edit=编辑, Add=添加, Remove=移除
  - Confirm=确认, Close=关闭, Back=返回, Next=下一步, Previous=上一步
- Synonym substitutions with identical intent
- Abbreviation expansions (OK=确定, Yes=是)

### FAIL - Add semantic issue to reasons (similarity <70%):
- Antonyms: Submit vs 取消, Add vs 删除, Enable vs 禁用
- Opposite actions: Upload vs 下载, Import vs 导出, Open vs 关闭
- Different concepts: Login vs 注册, Settings vs 帮助
- Mismatched entities: User vs 用户名, Email vs 电话
- Incompatible actions: Save vs 打印, Copy vs 粘贴
- **Any case where referenceValue and targetValue have different or opposite meanings**

## 2. Grammar Check (targetValue only)

**CRITICAL**: Detect grammar errors in targetValue text.
**IMPORTANT**: Ignore punctuation style differences. Do NOT report punctuation-only issues.

### Common Grammar Errors to Detect:
- **Subject-verb disagreement**: e.g., "He are", "They is"
- **Tense inconsistency**: e.g., "He go to school yesterday"
- **Missing articles**: e.g., "I have car" (should be "a car")
- **Wrong word order**: e.g., "House big red" instead of "Big red house"
- **Incorrect prepositions**: e.g., "Look on" instead of "Look at"
- **Double negatives**: e.g., "I don't have nothing"
- **Sentence fragments**: e.g., "Because I went there." (incomplete thought)
- **Wrong verb forms**: e.g., "I have went", "He don't know"

### Language-Specific Grammar Rules:
- **English**: Check subject-verb agreement, proper tense usage, article usage
- **Chinese (中文)**: Check measure words (个/只/条), word order (时间-地点-主语-动词-宾语), particle usage (的/地/得)
- **Japanese (日本語)**: Check particle usage (は/が/を/に), verb conjugation
- **Korean (한국어)**: Check particle usage (이/가/을/를), honorifics
- **French**: Check gender agreement, verb conjugation
- **German**: Check case system, gender agreement, verb placement
- **Spanish**: Check gender agreement, verb conjugation
- **Other languages**: Apply grammar rules specific to the language

### Grammar Error Examples:
- English: "He don't knows" → "Subject-verb disagreement"
- English: "I have seen him yesterday" → "Tense inconsistency (have seen → saw)"
- Chinese: "我吃了一个饭" → "Wrong measure word (个 → 口)"
- French: "Le table" → "Gender agreement (table is feminine, use La)"

---

# EXECUTION STEPS

For EACH row in input data:

1. **Extract** rowIndex, referenceValue, targetValue
2. **Semantic Check**: Compare referenceValue and targetValue
   - Estimate semantic similarity percentage
   - If similarity <70% → Add one reason object: {"type":"Semantic","reason":"..."}
3. **Grammar Check**: Analyze targetValue for grammar errors
   - Ignore punctuation symbols/styles (e.g., "." vs "。", "," vs "，")
   - For each grammar error found → Add one reason object: {"type":"Grammar","reason":"..."}
4. **Output Decision**:
   - If reasons[] is empty → EXCLUDE this row from output
   - If reasons[] is not empty → INCLUDE this row in output

---

# CONSTRAINTS

- Process ALL ${totalRows} rows
- Return ONLY rows with issues (reasons[] not empty)
- reasons must be an array of objects: {"type":"Semantic"|"Grammar"|"Punctuation"|"Character","reason":"<english text>"}
- type must use Title Case exactly: Semantic, Grammar, Punctuation, Character
- Maximum 5 reasons per row
- Each reason maximum 25 words
- Never output punctuation-only grammar reasons
- Forbidden example: "Mixed punctuation: uses period '.' instead of Chinese '。'"
- DO NOT suggest corrections
- DO NOT alter rowIndex or targetValue values
- Return RAW JSON array only (no markdown wrapper)

---

# OUTPUT FORMAT

\`\`\`json
[
  {
    "rowIndex": <number>,
    "targetValue": "<string>",
    "reasons": [
      {"type": "Semantic", "reason": "<english text>"},
      {"type": "Grammar", "reason": "<english text>"}
    ]
  }
]
\`\`\`

---

# EXAMPLES

**Example 1: PASS - Correct translation (excluded from output)**
Input: referenceValue="Cancel", targetValue="取消"
Output: [] (empty array, row excluded)

**Example 2: Different meaning**
Input: referenceValue="Submit", targetValue="取消"
Output:
\`\`\`json
[{
  "rowIndex": 1,
  "targetValue": "取消",
  "reasons": [
    {"type": "Semantic", "reason": "The action meaning differs from the reference text."}
  ]
}]
\`\`\`

**Example 3: Grammar error in English**
Input: referenceValue="确认", targetValue="Confirm button is work"
Output:
\`\`\`json
[{
  "rowIndex": 2,
  "targetValue": "Confirm button is work",
  "reasons": [
    {"type": "Grammar", "reason": "Subject-verb disagreement in the verb phrase."}
  ]
}]
\`\`\`

**Example 4: Grammar error in Chinese**
Input: referenceValue="Add item", targetValue="添加一个项目了"
Output:
\`\`\`json
[{
  "rowIndex": 3,
  "targetValue": "添加一个项目了",
  "reasons": [
    {"type": "Grammar", "reason": "Unnecessary particle usage for a simple action label."}
  ]
}]
\`\`\`

**Example 5: Multiple issues**
Input: referenceValue="Remove item", targetValue="删除物品了, and clean"
Output:
\`\`\`json
[{
  "rowIndex": 4,
  "targetValue": "删除物品了, and clean",
  "reasons": [
    {"type": "Semantic", "reason": "The phrase meaning does not fully match the reference action."},
    {"type": "Grammar", "reason": "Mixed-language and sentence-structure error detected."}
  ]
}]
\`\`\`

**Example 6: Grammar error in French**
Input: referenceValue="The table", targetValue="Le table"
Output:
\`\`\`json
[{
  "rowIndex": 5,
  "targetValue": "Le table",
  "reasons": [
    {"type": "Grammar", "reason": "Gender agreement mismatch for the noun phrase."}
  ]
}]
\`\`\`

**Example 7: Desired semantic format**
Input: referenceValue="Access to the app", targetValue="读取内存"
Output:
\`\`\`json
[{
  "rowIndex": 6,
  "targetValue": "读取内存",
  "reasons": [
    {"type": "Semantic", "reason": "The phrase <b>'Access to the app'</b> meaning different with <b>'读取内存'</b>."}
  ]
}]
\`\`\`

---

# INPUT DATA

\`\`\`json
${JSON.stringify(comparisonData, null, 2)}
\`\`\`

**Execute the audit and return ONLY rows with issues.**`;
};
