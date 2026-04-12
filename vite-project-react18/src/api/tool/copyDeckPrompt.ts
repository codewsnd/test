/**
 * Build prompt for multi-table grouped matching
 */
export const buildGroupedMatchPrompt = (
  images: Array<{ fileName: string }>,
  groupedData: Array<{
    group: string;
    rows: Array<{ customId: string; copyValue: string }>;
  }>
): string => {
  // Build groups info with JSON - Convert customId to number for easier calculation
  const groupsJSON = groupedData.map((group) => ({
    group: group.group,
    rows: group.rows.map(row => ({
      customId: Number(row.customId),
      copyValue: row.copyValue
    }))
  }));

  const imagesJSON = images.map((img, index) => ({
    id: index + 1,
    fileName: img.fileName
  }));

  return `You are an expert OCR and text matching system. Your task is to match text groups to screenshots and verify each text item.

### INPUT DATA
"""
${JSON.stringify({ groups: groupsJSON, images: imagesJSON }, null, 2)}
"""

### TASK
Match ${groupedData.length} groups to ${images.length} images. Note:
- Multiple groups may match the same image (many-to-one is allowed)
- Each group should find its best matching image
- For each group:
  1. Perform OCR on all images
  2. Find the best matching image based on text content
  3. Extract the actual text found in OCR for each row's copyValue
  4. Determine if text matches exactly (passed = true/false)
  5. If not exact match, provide discrepancies

### MATCHING RULES

For each row's copyValue:
1. Search for the text in OCR content (case-sensitive, exact match)
2. **passed = true**: if copyValue is found exactly as-is in OCR
3. **passed = false**: if text differs or not found
4. When passed = false, provide discrepancies array with the actual text found

### CRITICAL: OCR COMMON ERRORS

OCR often misrecognizes similar-looking characters. Be aware of these patterns:
- **0 (zero) ↔ O (letter O)**
- **1 (one) ↔ l (lowercase L) ↔ I (capital i)**
- **5 ↔ S**
- **8 ↔ B**
- **6 ↔ G**
- **2 ↔ Z**

Important: Even if OCR has these errors, **passed = false** (only exact match → passed=true).
But you MUST identify the actual OCR text and build granular discrepancies.

### EXTRACTING discrepancies (CRITICAL)

When passed = false, you MUST perform granular difference analysis:

**Step 1: Find the most similar text in OCR**
- Locate the text segment in OCR that most closely matches the copyValue
- Use fuzzy matching, check for OCR errors (0/O, 1/l/I, etc.)
- Extract the actual text found in OCR

**Step 2: Identify specific differences**
- Compare the expected (copyValue) vs found (OCR text) word by word or character by character
- Break down into individual difference points
- Each difference should be a separate discrepancy object

**Step 3: Build discrepancies array**
- For each difference found, create: {"expected": "part from copyValue", "found": "part from OCR"}
- If a word/phrase is completely missing → found: ""
- If a word/phrase exists in OCR but not in copyValue → expected: ""

**Examples of granular difference extraction:**

Example 1: Word-level differences
- copyValue: "我在北京看风景"
- OCR text: "我在上海吃外卖"
- discrepancies: [
    {"expected": "北京", "found": "上海"},
    {"expected": "看风景", "found": "吃外卖"}
  ]

Example 2: Character-level OCR errors
- copyValue: "User ID: 305"
- OCR text: "User ID: 3O5"
- discrepancies: [{"expected": "0", "found": "O"}]

Example 3: Typo differences
- copyValue: "Submit Button"
- OCR text: "Submitt Buttn"
- discrepancies: [
    {"expected": "Submit", "found": "Submitt"},
    {"expected": "Button", "found": "Buttn"}
  ]

Example 4: Missing text
- copyValue: "Login and Register"
- OCR text: "Login"
- discrepancies: [{"expected": "and Register", "found": ""}]

Example 5: Extra text in OCR
- copyValue: "Home"
- OCR text: "Home Page Navigation"
- discrepancies: [{"expected": "", "found": "Page Navigation"}]

Example 6: Text completely absent
- copyValue: "Cancel"
- OCR text: (completely different, no similar text found)
- discrepancies: [{"expected": "Cancel", "found": ""}]

**DO NOT return the entire string as one discrepancy - break it down into specific differences!**

### OUTPUT FORMAT

Return a JSON array with all matched groups.

Schema:
\`\`\`json
[{
  "fileName": string,
  "ocrContent": string,
  "group": string,
  "rows": [{
    "customId": number,
    "copy": string,
    "passed": boolean,
    "discrepancies": [{"expected": string, "found": string}]
  }]
}]
\`\`\`

Requirements:
- fileName must be one of: ${images.map(img => img.fileName).join(', ')}
- copy: the original copyValue from input
- passed: true only if exact match found in OCR, false otherwise
- discrepancies: MUST be present when passed=false, omit when passed=true
- discrepancies: array of granular differences, each with:
  - expected: the specific part from copyValue that differs
  - found: the corresponding part from OCR (or "" if missing)

### EXAMPLES

Example 1: Perfect Match
"""
Input:
  Group "Login Form"
  rows: [
    {customId: 1, copyValue: "Username"},
    {customId: 2, copyValue: "Password"}
  ]

OCR from image1.png: "Please enter your Username and Password to continue"

Output:
{
  "fileName": "image1.png",
  "ocrContent": "Please enter your Username and Password to continue",
  "group": "Login Form",
  "rows": [
    {"customId": 1, "copy": "Username", "passed": true},
    {"customId": 2, "copy": "Password", "passed": true}
  ]
}
"""

Example 2: Partial Match with OCR Errors
"""
Input:
  Group "Buttons"
  rows: [
    {customId: 5, copyValue: "Submit Form"},
    {customId: 6, copyValue: "User ID: 305"}
  ]

OCR from image2.png: "Click Submitt Form to proceed. User ID: 3O5 is active."

Analysis:
- "Submit Form": Found "Submitt Form" (typo: Submit → Submitt)
- "User ID: 305": Found "User ID: 3O5" (OCR error: 0 → O)

Output:
{
  "fileName": "image2.png",
  "ocrContent": "Click Submitt Form to proceed. User ID: 3O5 is active.",
  "group": "Buttons",
  "rows": [
    {
      "customId": 5,
      "copy": "Submit Form",
      "passed": false,
      "discrepancies": [{"expected": "Submit", "found": "Submitt"}]
    },
    {
      "customId": 6,
      "copy": "User ID: 305",
      "passed": false,
      "discrepancies": [{"expected": "0", "found": "O"}]
    }
  ]
}

Note: Each discrepancy shows the specific part that differs, not the entire string.
"""

Example 3: Text Not Found
"""
Input:
  Group "Navigation"
  rows: [
    {customId: 7, copyValue: "Home"},
    {customId: 8, copyValue: "About"}
  ]

OCR from all images: Neither "Home" nor "About" found anywhere

Output:
{
  "fileName": "image1.png",
  "ocrContent": "[OCR content from best matching image]",
  "group": "Navigation",
  "rows": [
    {
      "customId": 7,
      "copy": "Home",
      "passed": false,
      "discrepancies": [{"expected": "Home", "found": ""}]
    },
    {
      "customId": 8,
      "copy": "About",
      "passed": false,
      "discrepancies": [{"expected": "About", "found": ""}]
    }
  ]
}
"""

Example 4: Multiple Groups Match Same Image
"""
Input:
  Group "Header": [{customId: 1, copyValue: "Logo"}]
  Group "Footer": [{customId: 10, copyValue: "Copyright"}]

OCR from image1.png: "Company Logo ... Copyright 2024"

Output:
[
  {
    "fileName": "image1.png",
    "ocrContent": "Company Logo ... Copyright 2024",
    "group": "Header",
    "rows": [
      {"customId": 1, "copy": "Logo", "passed": true}
    ]
  },
  {
    "fileName": "image1.png",
    "ocrContent": "Company Logo ... Copyright 2024",
    "group": "Footer",
    "rows": [
      {"customId": 10, "copy": "Copyright", "passed": true}
    ]
  }
]

Note: Both groups matched the same image, which is allowed.
"""

Return only the JSON array, no markdown code blocks or additional text.`;
};

/**
 * Build prompt for single-table auto-grouping match
 * IMPORTANT: customId values are numbers representing sequential row positions
 */
export const buildSingleTableMatchPrompt = (
  images: Array<{ fileName: string }>,
  consecutiveGroups: Array<Array<{ customId: string; copyValue: string }>>
): string => {
  // Build groups info with JSON - Convert customId to number for easier calculation
  const groupsJSON = consecutiveGroups.map((group) => ({
    type: group.length > 1 ? 'consecutive' : 'individual',
    customIds: group.map(r => Number(r.customId)),
    rows: group.map(row => ({
      customId: Number(row.customId),
      copyValue: row.copyValue
    }))
  }));

  const imagesJSON = images.map((img, index) => ({
    id: index + 1,
    fileName: img.fileName
  }));

  const totalRows = consecutiveGroups.reduce((sum, g) => sum + g.length, 0);

  return `You are an expert OCR and text matching system. Your task is to match UI screenshot text to expected row data based on sequential position.

### CRITICAL CONSTRAINT - CONSECUTIVE RULE

matchRow arrays MUST contain ONLY mathematically consecutive numbers (n, n+1, n+2, ...).

- ✓ VALID: [1], [1,2,3], [5,6]
- ✗ INVALID: [1,3], [2,5], [1,2,5]

**Mathematical Definition**: For array [a, b, c, ...], consecutive means b = a+1, c = b+1, etc.

If you find non-consecutive matches, you MUST split into separate objects:
- Found 3 and 5 → Return [{"matchRow":[3], ...}, {"matchRow":[5], ...}]
- Found 1,2 and 5 → Return [{"matchRow":[1,2], ...}, {"matchRow":[5], ...}]

### INPUT DATA
"""
${JSON.stringify({ groups: groupsJSON, images: imagesJSON, totalRows }, null, 2)}
"""

### KEY CONCEPTS
- **customId** = sequential row position (1, 2, 3, ...)
- **totalRows** = ${totalRows} (your output must collectively cover ALL these rows)
- Consecutive customIds (1,2,3) likely appear together in same screenshot
- Use spatial proximity and sequential order to find best matches
- Each result's matchRow determines UI rowspan (e.g., [1,2] → rowspan=2)

### STEP-BY-STEP PROCESS

**Step 1: OCR Extraction**
- Extract complete text from all ${images.length} images
- Maintain spatial order (top to bottom, left to right)

**Step 2: Match Groups to Images**
- For each group, find the best matching image
- Consider: text presence, sequential order, spatial proximity
- Select image with highest combined match score

**Step 3: Build matchRow (CRITICAL)**
- Include ALL customIds that appear in the group
- VALIDATE: Ensure matchRow contains ONLY consecutive numbers
- If non-consecutive (e.g., found 1,2,5), SPLIT into separate results:
  * Result 1: {"matchRow": [1,2], ...}
  * Result 2: {"matchRow": [5], ...}

**Step 4: Extract Found Text and Determine Pass/Fail**
- For each customId in matchRow, find the text in OCR
- **passed = true**: if exact match found
- **passed = false**: if text differs or not found
- When passed = false, provide discrepancies with the actual text found

### CRITICAL: OCR COMMON ERRORS

OCR often misrecognizes similar-looking characters. Be aware of these patterns:
- **0 (zero) ↔ O (letter O)**
- **1 (one) ↔ l (lowercase L) ↔ I (capital i)**
- **5 ↔ S**
- **8 ↔ B**
- **6 ↔ G**
- **2 ↔ Z**

Important: Even if OCR has these errors, **passed = false** (only exact match → passed=true).
But you MUST identify the actual OCR text and build granular discrepancies.

### EXTRACTING discrepancies (CRITICAL)

When passed = false, you MUST perform granular difference analysis:

**Step 1: Find the most similar text in OCR**
- Locate the text segment in OCR that most closely matches the copyValue
- Use fuzzy matching, check for OCR errors (0/O, 1/l/I, etc.)
- Extract the actual text found in OCR

**Step 2: Identify specific differences**
- Compare the expected (copyValue) vs found (OCR text) word by word or character by character
- Break down into individual difference points
- Each difference should be a separate discrepancy object

**Step 3: Build discrepancies array**
- For each difference found, create: {"expected": "part from copyValue", "found": "part from OCR"}
- If a word/phrase is completely missing → found: ""
- If a word/phrase exists in OCR but not in copyValue → expected: ""

**Examples of granular difference extraction:**

Example 1: Word-level differences
- copyValue: "我在北京看风景"
- OCR text: "我在上海吃外卖"
- discrepancies: [
    {"expected": "北京", "found": "上海"},
    {"expected": "看风景", "found": "吃外卖"}
  ]

Example 2: Character-level OCR errors
- copyValue: "User ID: 305"
- OCR text: "User ID: 3O5"
- discrepancies: [{"expected": "0", "found": "O"}]

Example 3: Typo differences
- copyValue: "Submit Button"
- OCR text: "Submitt Buttn"
- discrepancies: [
    {"expected": "Submit", "found": "Submitt"},
    {"expected": "Button", "found": "Buttn"}
  ]

Example 4: Missing text
- copyValue: "Login and Register"
- OCR text: "Login"
- discrepancies: [{"expected": "and Register", "found": ""}]

Example 5: Extra text in OCR
- copyValue: "Home"
- OCR text: "Home Page Navigation"
- discrepancies: [{"expected": "", "found": "Page Navigation"}]

Example 6: Text completely absent
- copyValue: "Cancel"
- OCR text: (completely different, no similar text found)
- discrepancies: [{"expected": "Cancel", "found": ""}]

**DO NOT return the entire string as one discrepancy - break it down into specific differences!**

**Step 5: Validate and Return**
- Run validation algorithm (see below)
- May return MORE than ${consecutiveGroups.length} results (due to splits)
- Verify that all ${totalRows} customIds appear in at least one result

### OUTPUT FORMAT

Return JSON array. May contain MORE than ${consecutiveGroups.length} objects if splits needed.

Schema:
\`\`\`json
[{
  "matchRow": number[],
  "fileName": string,
  "ocrContent": string,
  "rows": [{
    "customId": number,
    "copy": string,
    "passed": boolean,
    "discrepancies": [{"expected": string, "found": string}]
  }]
}]
\`\`\`

Requirements:
- matchRow: MUST be mathematically consecutive (b = a+1, c = b+1, ...)
- fileName: Must be one of: ${images.map(img => img.fileName).join(', ')}
- rows: Same customIds as matchRow, return ALL rows
- copy: the original copyValue from input
- passed: true only if exact match found in OCR, false otherwise
- discrepancies: MUST be present when passed=false, omit when passed=true
- discrepancies: array of granular differences, each with:
  - expected: the specific part from copyValue that differs
  - found: the corresponding part from OCR (or "" if missing)

### VALIDATION RULES

When processing results, ensure:
1. Split non-consecutive matchRows into separate objects
2. Each matchRow must contain only consecutive numbers
3. matchRow and rows must have matching customIds
4. All ${totalRows} customIds must be covered across all results

### EXAMPLES

Example 1: Non-Consecutive Split (MOST IMPORTANT)
"""
Input: Found customIds 1, 2, and 5 in image1.png
OCR: "Username Password ... Sign up"

Step 1: Extract found text
  - customId 1 "Username": exact match found
  - customId 2 "Password": exact match found
  - customId 5 "Sign up": exact match found

Step 2: Initial matchRow
  matchRow: [1, 2, 5]

Step 3: Validation fails (5 ≠ 2+1)
  Split at index 2

Step 4: Correct output (TWO separate results)
[
  {
    "matchRow": [1, 2],
    "fileName": "image1.png",
    "ocrContent": "Username Password ... Sign up",
    "rows": [
      {"customId": 1, "copy": "Username", "passed": true},
      {"customId": 2, "copy": "Password", "passed": true}
    ]
  },
  {
    "matchRow": [5],
    "fileName": "image1.png",
    "ocrContent": "Username Password ... Sign up",
    "rows": [
      {"customId": 5, "copy": "Sign up", "passed": true}
    ]
  }
]
"""

Example 2: Consecutive Match
"""
Input: Found customIds 1, 2 in image1.png
OCR: "Please enter your Username and Password"

Validation: 2 = 1+1 ✓ (consecutive)

Output:
{
  "matchRow": [1, 2],
  "fileName": "image1.png",
  "ocrContent": "Please enter your Username and Password",
  "rows": [
    {"customId": 1, "copy": "Username", "passed": true},
    {"customId": 2, "copy": "Password", "passed": true}
  ]
}
"""

Example 3: Partial Match with OCR Errors
"""
Input: Found customIds 3, 4 in image2.png
OCR: "Click Submitt Form now. Verification Code: 1O1 is active."

Data:
  - customId 3, copyValue: "Submit Form"
  - customId 4, copyValue: "Verification Code: 101"

Extraction:
  - customId 3 "Submit Form": found "Submitt Form" (typo: Submit → Submitt)
  - customId 4 "Verification Code: 101": found "Verification Code: 1O1" (OCR error: middle 0 → O)

Validation: 4 = 3+1 ✓ (consecutive)

Output:
{
  "matchRow": [3, 4],
  "fileName": "image2.png",
  "ocrContent": "Click Submitt Form now. Verification Code: 1O1 is active.",
  "rows": [
    {
      "customId": 3,
      "copy": "Submit Form",
      "passed": false,
      "discrepancies": [{"expected": "Submit", "found": "Submitt"}]
    },
    {
      "customId": 4,
      "copy": "Verification Code: 101",
      "passed": false,
      "discrepancies": [{"expected": "0", "found": "O"}]
    }
  ]
}

Note: Each discrepancy identifies the specific character/word that differs.
"""

Example 4: Text Not Found
"""
Input: Group [7,8,9], none found in any image

Output:
{
  "matchRow": [7, 8, 9],
  "fileName": "image1.png",
  "ocrContent": "[OCR content from best matching image]",
  "rows": [
    {
      "customId": 7,
      "copy": "Home",
      "passed": false,
      "discrepancies": [{"expected": "Home", "found": ""}]
    },
    {
      "customId": 8,
      "copy": "About",
      "passed": false,
      "discrepancies": [{"expected": "About", "found": ""}]
    },
    {
      "customId": 9,
      "copy": "Contact",
      "passed": false,
      "discrepancies": [{"expected": "Contact", "found": ""}]
    }
  ]
}

Note: Return all rows even if text not found.
"""

### FINAL VALIDATION CHECKLIST

Before returning, verify EVERY result:
1. ✓ Each matchRow is consecutive: ID[i+1] = ID[i] + 1
2. ✓ Non-consecutive matches are split into separate objects
3. ✓ matchRow and rows contain identical customIds
4. ✓ No matchRow is empty (len >= 1)
5. ✓ All ${totalRows} customIds are covered across results
6. ✓ Return ALL rows (even if not found, use passed=false with discrepancies)
7. ✓ discrepancies field: MUST be present when passed=false, omit when passed=true
8. ✓ discrepancies: Each difference should be granular (specific part, not entire string)

Common mistakes to AVOID:
- ✗ [1,3] is INVALID → Must split into [1] and [3]
- ✗ [2,4,5] is INVALID → Must split into [2] and [4,5]
- ✗ [1,2,5] is INVALID → Must split into [1,2] and [5]
- ✗ {"matchRow": []} → Never return empty matchRow
- ✗ Missing rows where text not found → Include them with passed=false and discrepancies
- ✗ Returning entire string in discrepancy → Break into specific differences
  Example WRONG: [{"expected": "Submit Form", "found": "Submitt Form"}]
  Example CORRECT: [{"expected": "Submit", "found": "Submitt"}]

Return only valid JSON array, no markdown code blocks or additional text.`;
};
