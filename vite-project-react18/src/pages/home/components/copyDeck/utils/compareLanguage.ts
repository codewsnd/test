import type { CellInfo } from './confluenceStorageUtils';
import type { LanguageCompareDifference, LanguageIssue, LanguageIssueType } from '@/api/tool/languageComparePrompt';

// ==================== 类型定义 ====================

/** 语言比较结果接口 */
export type LanguageCompareResult = LanguageCompareDifference;
export type CopyDeckIssueType = Capitalize<LanguageIssueType>;
export interface CopyDeckLanguageIssue {
  type: CopyDeckIssueType;
  reason: string;
}

/** 选中的行信息 */
export interface SelectedRow {
  customId: string;
  language: string;
  groupName: string;
}

// ==================== 辅助函数 ====================

/** 检查列头是否为 Test Result 或 Test Evidence 列（忽略大小写和空格） */
function isTestColumn(headerValue: string): boolean {
  const normalized = headerValue.toLowerCase().replace(/[\s\u3000]/g, '');
  return normalized.includes('testresult') || normalized.includes('testevidence');
}

/** 在表头中查找指定语言的列索引，支持 |language|, |xxx_language|, |language_xxx| 格式，排除 Test 列 */
export function findLanguageColumnIndex(
  headerRow: CellInfo[],
  language: string
): number {
  const normalizedLanguage = language.toLowerCase().trim();

  return headerRow.findIndex(cell => {
    const value = cell.value;

    // 先排除 Test Result 和 Test Evidence 列
    if (isTestColumn(value)) {
      return false;
    }

    // 检查是否包含 |values=...| 模式
    const match = value.match(/\|values=([^|]+)\|/);
    if (!match) {
      return false;
    }

    const columnLanguage = match[1].trim().toLowerCase();

    // 支持精确匹配、前缀匹配、后缀匹配
    return columnLanguage === normalizedLanguage ||
           columnLanguage.endsWith('_' + normalizedLanguage) ||
           columnLanguage.startsWith(normalizedLanguage + '_');
  });
}

/** 查找参考语言列（gl 或 en）的索引，优先 gl > en */
export function findReferenceLanguageColumnIndex(headerRow: CellInfo[]): number {
  const glIndex = findLanguageColumnIndex(headerRow, 'gl');
  if (glIndex !== -1) {
    return glIndex;
  }

  const enIndex = findLanguageColumnIndex(headerRow, 'en');
  if (enIndex !== -1) {
    return enIndex;
  }

  return -1;
}

/** 从表头获取参考语言代码（如 "gl", "xxx_gl", "gl_xxx"） */
export function getReferenceLanguageCode(headerRow: CellInfo[]): string | null {
  const glIndex = findLanguageColumnIndex(headerRow, 'gl');
  if (glIndex !== -1) {
    const match = headerRow[glIndex].value.match(/\|values=([^|]+)\|/);
    if (match) {
      return match[1].trim();
    }
  }

  const enIndex = findLanguageColumnIndex(headerRow, 'en');
  if (enIndex !== -1) {
    const match = headerRow[enIndex].value.match(/\|values=([^|]+)\|/);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/** 从表头获取指定语言的实际语言代码（如 "zh", "xxx_zh", "zh_xxx"） */
export function getActualLanguageCode(
  headerRow: CellInfo[],
  language: string
): string | null {
  const index = findLanguageColumnIndex(headerRow, language);
  if (index !== -1) {
    const match = headerRow[index].value.match(/\|values=([^|]+)\|/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// ==================== Failed 标记处理 ====================

const FAILED_MARKER = ' Failed:';
const CONFLUENCE_ISSUE_TITLE = 'Definition discrepancy';
const ISSUE_TYPE_ORDER: CopyDeckIssueType[] = ['Semantic', 'Grammar', 'Punctuation', 'Character'];
type LowercaseIssueType = 'semantic' | 'grammar' | 'punctuation' | 'character';
const ISSUE_TYPE_MAP: Record<LowercaseIssueType, CopyDeckIssueType> = {
  semantic: 'Semantic',
  grammar: 'Grammar',
  punctuation: 'Punctuation',
  character: 'Character',
};
const VALID_ISSUE_TYPES: ReadonlySet<CopyDeckIssueType> = new Set(['Semantic', 'Grammar', 'Punctuation', 'Character']);

const toCopyDeckIssueType = (type: string): CopyDeckIssueType | null => {
  const normalized = type.trim();
  if (normalized.length === 0) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'semantic' || lower === 'grammar' || lower === 'punctuation' || lower === 'character') {
    return ISSUE_TYPE_MAP[lower];
  }

  const maybeTitleCase = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` as CopyDeckIssueType;
  if (VALID_ISSUE_TYPES.has(maybeTitleCase)) {
    return maybeTitleCase;
  }

  return null;
};

const toCopyDeckIssue = (issue: LanguageIssue): CopyDeckLanguageIssue | null => {
  const mappedType = toCopyDeckIssueType(issue.type);
  if (!mappedType) {
    return null;
  }

  const reason = issue.reason?.trim();
  if (!reason) {
    return null;
  }

  return {
    type: mappedType,
    reason,
  };
};

const isCopyDeckLanguageIssue = (item: unknown): item is CopyDeckLanguageIssue => {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const type = (item as { type?: unknown }).type;
  const reason = (item as { reason?: unknown }).reason;
  return typeof type === 'string' && VALID_ISSUE_TYPES.has(type as CopyDeckIssueType) && typeof reason === 'string' && reason.trim() !== '';
};

const parseIssuesFromMarker = (reasonsText: string): CopyDeckLanguageIssue[] => {
  if (!reasonsText) {
    return [];
  }

  try {
    const parsed = JSON.parse(reasonsText);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): CopyDeckLanguageIssue | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const typeRaw = (item as { type?: unknown }).type;
        const reasonRaw = (item as { reason?: unknown }).reason;
        if (typeof typeRaw !== 'string' || typeof reasonRaw !== 'string') {
          return null;
        }

        const normalizedType = toCopyDeckIssueType(typeRaw);
        if (!normalizedType) {
          return null;
        }

        const reason = reasonRaw.trim();
        if (!reason) {
          return null;
        }

        return {
          type: normalizedType,
          reason,
        };
      })
      .filter((item): item is CopyDeckLanguageIssue => item !== null && isCopyDeckLanguageIssue(item));
  } catch {
    return [];
  }
};

const serializeIssuesForMarker = (reasons: CopyDeckLanguageIssue[]): string => JSON.stringify(reasons);

const groupIssuesByType = (reasons: CopyDeckLanguageIssue[]): Array<{ type: CopyDeckIssueType; reasons: string[] }> => {
  const issuesByType = new Map<CopyDeckIssueType, string[]>();
  reasons.forEach(issue => {
    if (!issuesByType.has(issue.type)) {
      issuesByType.set(issue.type, []);
    }
    const issueList = issuesByType.get(issue.type);
    if (issueList) {
      issueList.push(issue.reason);
    }
  });

  return ISSUE_TYPE_ORDER
    .map(type => ({
      type,
      reasons: issuesByType.get(type) || [],
    }))
    .filter(group => group.reasons.length > 0);
};

/** 移除单元格值中的 "Failed: <json>" 后缀，返回原始值 */
export function stripFailedMarker(value: string): string {
  if (!value) {
    return '';
  }

  const failedIndex = value.lastIndexOf(FAILED_MARKER);
  if (failedIndex === -1) {
    return value;
  }

  return value.substring(0, failedIndex).trim();
}

/** 解析单元格值中的 "Failed: <json>"，返回原始值和结构化原因列表 */
export function parseFailedMarker(value: string): { originalValue: string; hasFailed: boolean; reasons: CopyDeckLanguageIssue[] } {
  if (!value) {
    return { originalValue: '', hasFailed: false, reasons: [] };
  }

  const failedIndex = value.lastIndexOf(FAILED_MARKER);
  if (failedIndex === -1) {
    return { originalValue: value, hasFailed: false, reasons: [] };
  }

  const originalValue = value.substring(0, failedIndex).trim();
  const reasonsText = value.substring(failedIndex + FAILED_MARKER.length).trim();
  const reasons = parseIssuesFromMarker(reasonsText);

  return { originalValue, hasFailed: reasons.length > 0, reasons };
}

/** 将 Failed 标记格式化为 Confluence HTML，使用 DOM 元素创建 */
export function formatFailedMarkerAsHtml(value: string, doc: Document): DocumentFragment | null {
  const { originalValue, hasFailed, reasons } = parseFailedMarker(value);

  if (!hasFailed || reasons.length === 0) {
    return null;
  }

  const fragment = doc.createDocumentFragment();

  if (originalValue) {
    fragment.appendChild(doc.createTextNode(originalValue));
  }
  fragment.appendChild(doc.createElement('br'));

  const issueStrong = doc.createElement('strong');
  issueStrong.textContent = CONFLUENCE_ISSUE_TITLE;
  issueStrong.setAttribute('style', 'color: red;');
  fragment.appendChild(issueStrong);

  fragment.appendChild(doc.createElement('br'));

  const groupedReasons = groupIssuesByType(reasons);
  groupedReasons.forEach(group => {
    const typeStrong = doc.createElement('strong');
    typeStrong.textContent = group.type.toLowerCase();
    fragment.appendChild(typeStrong);
    fragment.appendChild(doc.createElement('br'));

    const ul = doc.createElement('ul');
    group.reasons.forEach(reason => {
      const li = doc.createElement('li');
      li.textContent = reason;
      ul.appendChild(li);
    });
    fragment.appendChild(ul);
  });

  return fragment;
}

/** 解析 Confluence Storage HTML 格式的 Definition discrepancy 标记为文本格式 */
export function parseFailedMarkerFromHtml(htmlString: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 查找 <strong>Definition discrepancy</strong>
    const strongElements = Array.from(doc.querySelectorAll('strong'));
    const failedStrong = strongElements.find(strong => {
      const text = strong.textContent?.trim().toLowerCase() || '';
      return text === CONFLUENCE_ISSUE_TITLE.toLowerCase();
    });

    if (!failedStrong) {
      return null;
    }

    // 解析 Definition discrepancy 后面的类型分组和原因列表
    let currentElement: Element | null = failedStrong.nextElementSibling;
    let currentType: CopyDeckIssueType | null = null;
    const reasons: CopyDeckLanguageIssue[] = [];

    while (currentElement) {
      const tagName = currentElement.tagName.toLowerCase();
      if (tagName === 'strong' || tagName === 'p' || tagName === 'div') {
        const headingText = currentElement.textContent?.trim() || '';
        const issueType = toCopyDeckIssueType(headingText);
        if (issueType) {
          currentType = issueType;
        }
        currentElement = currentElement.nextElementSibling;
        continue;
      }

      if (tagName === 'ul') {
        const listItems = Array.from(currentElement.children).filter(child => child.tagName.toLowerCase() === 'li');
        listItems.forEach(li => {
          const text = li.textContent?.trim() || '';
          if (!text) {
            return;
          }

          if (currentType) {
            reasons.push({
              type: currentType,
              reason: text,
            });
            return;
          }

          const match = text.match(/^\[(Semantic|Grammar|Punctuation|Character)]\s*(.+)$/);
          if (match) {
            reasons.push({
              type: match[1] as CopyDeckIssueType,
              reason: match[2].trim(),
            });
          }
        });
      }

      currentElement = currentElement.nextElementSibling;
    }

    if (reasons.length === 0) {
      return null;
    }

    // 获取原始值（克隆节点并移除 Definition discrepancy 及之后的内容）
    const bodyClone = doc.body.cloneNode(true) as HTMLElement;
    const failedStrongInClone = bodyClone.querySelectorAll('strong');
    const failedStrongToRemove = Array.from(failedStrongInClone).find(strong => {
      const text = strong.textContent?.trim().toLowerCase() || '';
      return text === CONFLUENCE_ISSUE_TITLE.toLowerCase();
    });

    if (failedStrongToRemove) {
      let current: Node | null = failedStrongToRemove;
      while (current) {
        const next: Node | null = current.nextSibling;
        current.parentNode?.removeChild(current);
        current = next;
      }
    }

    let originalValue = bodyClone.textContent?.trim() || '';
    originalValue = originalValue.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

    return `${originalValue}${FAILED_MARKER} ${serializeIssuesForMarker(reasons)}`;
  } catch {
    return null;
  }
}

// ==================== 语言比较数据提取 ====================

/** 从 originalTableData 提取比较数据，清理已有的 Failed 标记 */
export function extractComparisonData(
  originalTableData: CellInfo[][],
  selectedLanguage: string
): {
  comparisonData: Array<{ rowIndex: number; referenceValue: string; targetValue: string }>;
  referenceLanguageCode: string | null;
  targetLanguageCode: string | null;
} {
  if (originalTableData.length === 0) {
    return { comparisonData: [], referenceLanguageCode: null, targetLanguageCode: null };
  }

  const [headerRow, ...dataRows] = originalTableData;

  const targetColumnIndex = findLanguageColumnIndex(headerRow, selectedLanguage);
  if (targetColumnIndex === -1) {
    console.error(`Target language column not found for: ${selectedLanguage}`);
    return { comparisonData: [], referenceLanguageCode: null, targetLanguageCode: null };
  }

  const referenceColumnIndex = findReferenceLanguageColumnIndex(headerRow);
  if (referenceColumnIndex === -1) {
    console.error('Reference language column (gl or en) not found');
    return { comparisonData: [], referenceLanguageCode: null, targetLanguageCode: null };
  }

  const referenceLanguageCode = getReferenceLanguageCode(headerRow);
  const targetLanguageCode = getActualLanguageCode(headerRow, selectedLanguage);

  const comparisonData: Array<{ rowIndex: number; referenceValue: string; targetValue: string }> = [];

  dataRows.forEach((row, index) => {
    const referenceValue = row[referenceColumnIndex]?.value || '';
    const targetValue = row[targetColumnIndex]?.value || '';

    const cleanedReferenceValue = stripFailedMarker(referenceValue);
    const cleanedTargetValue = stripFailedMarker(targetValue);

    if (cleanedReferenceValue.trim() !== '' && cleanedTargetValue.trim() !== '') {
      comparisonData.push({
        rowIndex: index,
        referenceValue: cleanedReferenceValue.trim(),
        targetValue: cleanedTargetValue.trim()
      });
    }
  });

  console.log('=== 语言比较数据提取 ===');
  console.log(`表格总行数: ${dataRows.length}`);
  console.log(`提取了 ${comparisonData.length} 对比较数据`);
  console.log(`参考列索引: ${referenceColumnIndex}, 代码: ${referenceLanguageCode}`);
  console.log(`目标列索引: ${targetColumnIndex}, 代码: ${targetLanguageCode}`);
  console.log(`选择的语言: ${selectedLanguage}`);

  if (comparisonData.length > 0) {
    console.log('前 3 对数据:');
    comparisonData.slice(0, 3).forEach(pair => {
      console.log(`  行 ${pair.rowIndex}: "${pair.referenceValue}" <-> "${pair.targetValue}"`);
    });
  }
  console.log('=====================================');

  return { comparisonData, referenceLanguageCode, targetLanguageCode };
}

// ==================== 比较结果应用 ====================

/** 将比较结果应用到 originalTableData，替换现有的 Failed 标记 */
export function applyComparisonResults(
  originalTableData: CellInfo[][],
  selectedLanguage: string,
  differences: LanguageCompareResult[]
): CellInfo[][] {
  if (differences.length === 0) {
    console.log('未发现差异，返回原始数据');
    return originalTableData;
  }

  const updatedData: CellInfo[][] = structuredClone(originalTableData);
  const [headerRow, ...dataRows] = updatedData;

  const targetColumnIndex = findLanguageColumnIndex(headerRow, selectedLanguage);
  if (targetColumnIndex === -1) {
    console.error(`Target language column not found for: ${selectedLanguage}`);
    return originalTableData;
  }

  let modifiedCount = 0;

  differences.forEach(diff => {
    const rowIndex = diff.rowIndex;
    if (rowIndex >= 0 && rowIndex < dataRows.length) {
      const cell = dataRows[rowIndex][targetColumnIndex];
      const originalValue = stripFailedMarker(cell.value);
      const reasons = diff.reasons || [];
      const normalizedReasons = reasons
        .map(toCopyDeckIssue)
        .filter((issue): issue is CopyDeckLanguageIssue => issue !== null);

      if (normalizedReasons.length === 0) {
        return;
      }

      const reasonsText = serializeIssuesForMarker(normalizedReasons);
      cell.value = `${originalValue}${FAILED_MARKER} ${reasonsText}`;
      modifiedCount++;
    }
  });

  console.log(`已标记 ${modifiedCount} 个单元格`);
  return updatedData;
}

// ==================== Confluence 导出：更新 Copy 列 ====================

/** 更新 Confluence 表格中 Copy 列的 Failed 标记（保留原有图片） */
export function updateCopyColumnFailedMarkersInConfluence(
  updatedOriginalTableData: CellInfo[][],
  selectedRows: SelectedRow[],
  originalCustomIdColIndex: number,
  allRows: Element[],
  doc: Document
): number {
  console.log('=== 更新 Copy 列的 Failed 标记到 Confluence ===');

  // 创建选中行的映射表
  const selectedCustomIdsMap = new Map<string, string>();
  selectedRows.forEach(row => {
    selectedCustomIdsMap.set(row.customId, row.language);
  });

  // 在 Confluence 表格的 headerRow 中查找语言列索引
  const confluenceHeaderRow = allRows[0];
  const confluenceHeaderCells = Array.from(confluenceHeaderRow.querySelectorAll('th, td'));
  const confluenceLanguageColumnIndexes = new Map<string, number>();

  confluenceHeaderCells.forEach((cell, index) => {
    const text = cell.textContent || '';
    const normalized = text.toLowerCase().replace(/\s+/g, '');

    // 跳过 Test 列
    if (normalized.includes('testresult') ||
        normalized.includes('testevidence') ||
        normalized.includes('test evidence')) {
      return;
    }

    const match = text.match(/\|values=([^|]+)\|/);
    if (match) {
      const language = match[1].trim();
      confluenceLanguageColumnIndexes.set(language.toLowerCase(), index);
      console.log(`Confluence 表格 - 找到语言列: ${language} at index ${index}`);
    }
  });

  // 在 originalTableData 的 headerRow 中查找语言列索引
  const [originalHeaderRow] = updatedOriginalTableData;
  const originalLanguageColumnIndexes = new Map<string, number>();

  originalHeaderRow.forEach((headerCell, index) => {
    const normalized = headerCell.value.toLowerCase().replace(/\s+/g, '');

    if (normalized.includes('testresult') ||
        normalized.includes('testevidence') ||
        normalized.includes('test evidence') ||
        headerCell.value === 'COPYDECK_CUSTOM_ID' ||
        headerCell.value === 'COPYDECK_CUSTOM_GROUP') {
      return;
    }

    const match = headerCell.value.match(/\|values=([^|]+)\|/);
    if (match) {
      const language = match[1].trim();
      originalLanguageColumnIndexes.set(language.toLowerCase(), index);
      console.log(`originalTableData - 找到语言列: ${language} at index ${index}`);
    }
  });

  console.log('Confluence 语言列索引:', Array.from(confluenceLanguageColumnIndexes.entries()));
  console.log('originalTableData 语言列索引:', Array.from(originalLanguageColumnIndexes.entries()));

  // 遍历数据行并更新
  let updatedCopyCellsCount = 0;

  for (let rowIdx = 1; rowIdx < updatedOriginalTableData.length; rowIdx++) {
    const row = updatedOriginalTableData[rowIdx];
    const customId = row[originalCustomIdColIndex]?.value;

    if (!customId) {
      continue;
    }

    const selectedLanguage = selectedCustomIdsMap.get(customId);
    if (!selectedLanguage) {
      continue;
    }

    const confluenceColIndex = confluenceLanguageColumnIndexes.get(selectedLanguage.toLowerCase());
    if (confluenceColIndex === undefined) {
      console.warn(`语言 ${selectedLanguage} 在 Confluence 表格中未找到列索引`);
      continue;
    }

    const originalColIndex = originalLanguageColumnIndexes.get(selectedLanguage.toLowerCase());
    if (originalColIndex === undefined) {
      console.warn(`语言 ${selectedLanguage} 在 originalTableData 中未找到列索引`);
      continue;
    }

    const copyCellValue = row[originalColIndex]?.value || '';

    console.log(`行 ${rowIdx} (customId=${customId}), 语言=${selectedLanguage}, originalColIndex=${originalColIndex}, confluenceColIndex=${confluenceColIndex}, 值="${copyCellValue}"`);

    const { originalValue } = parseFailedMarker(copyCellValue);
    const failedFragment = formatFailedMarkerAsHtml(copyCellValue, doc);

    const confluenceRow = allRows[rowIdx];
    if (confluenceRow) {
      const cells = Array.from(confluenceRow.querySelectorAll('td'));
      if (cells[confluenceColIndex]) {
        const cell = cells[confluenceColIndex];
        console.log(`✓ 更新行 ${rowIdx} (customId=${customId}) 的 Confluence Copy 列单元格 (索引: ${confluenceColIndex})`);

        // 保留原有图片元素
        const images = Array.from(cell.querySelectorAll(String.raw`ac\:image`));
        console.log(`  保留 ${images.length} 个图片元素`);

        // 清空并重新填充
        cell.innerHTML = '';

        if (failedFragment) {
          // 有 Failed：文字 + Failed + 图片
          cell.appendChild(failedFragment);
        } else {
          // 没有 Failed：只显示原始值 + 图片
          const textNode = doc.createTextNode(originalValue);
          cell.appendChild(textNode);
        }
        images.forEach(img => cell.appendChild(img));

        updatedCopyCellsCount++;
      }
    }
  }

  console.log(`更新了 ${updatedCopyCellsCount} 个 Copy 列单元格`);
  console.log('=== Copy 列更新完成 ===');

  return updatedCopyCellsCount;
}
