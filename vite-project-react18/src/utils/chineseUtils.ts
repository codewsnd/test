/**
 * 中文文本质量检测工具类
 * 用于检测中文文本中的英文标点符号和简繁体字混用问题
 */

import { tify, sify } from 'chinese-conv';
import type { LanguageCompareDifference, LanguageIssue } from '@/api/tool/languageComparePrompt';

/**
 * 英文标点白名单上下文模式
 * 这些模式允许在特定上下文中使用英文标点
 */
const PUNCTUATION_WHITELIST_PATTERNS = [
  { regex: /\d+\.\d+/g, description: '小数' },              // 1.23, 3.14
  { regex: /v\d+(\.\d+)+/gi, description: '版本号' },         // v1.0, v2.3.4
  { regex: /\d{4}-\d{2}-\d{2}/g, description: 'ISO 日期' },          // 2024-01-01
  { regex: /[\w.]+@[\w.]+/g, description: '邮箱地址' },        // user@example.com
  { regex: /https?:\/\/[^\s]+/gi, description: 'URL' },              // https://example.com
  { regex: /[A-Za-z]+:\\[^\s]*/g, description: 'Windows 路径' },     // C:\Users\file.txt
  { regex: /\/[\/\w.-]+/g, description: 'Unix 路径' },               // /path/to/file
  { regex: /API_KEY|[A-Z_][A-Z0-9_]*/g, description: '代码常量' }, // API_KEY, user_name
];

// ==================== 语言类型检测 ====================

/**
 * 判断语言代码是否为中文
 */
export const isChineseLanguage = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();
  return langLower.startsWith('zh') ||
         langLower.includes('chinese') ||
         langLower.includes('cn') ||
         langLower.includes('tw') ||
         langLower.includes('hk') ||
         langLower.includes('hant') ||
         langLower.includes('sc') ||
         langLower.includes('tc');
};

/**
 * 判断语言代码是否为简体中文
 * 优先级：后缀匹配 > 精确匹配 > 包含匹配（排除繁体关键词）
 * 支持：sc, cn, _sc, _cn, xx_sc, xx_cn, xx_xx_sc 等
 */
export const isSimplifiedChinese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();

  // 优先级1：后缀匹配（支持 xx_xx_sc 这种多层嵌套）
  const suffixMatch = langLower.match(/_(sc|cn)$/);
  if (suffixMatch) {
    return true;
  }

  // 优先级2：精确匹配
  if (langLower === 'sc' || langLower === 'cn') {
    return true;
  }

  // 优先级3：包含匹配，但必须排除繁体关键词
  // 例如：hk_sc 是简体，但 sc_tc 不是简体（是繁体，因为后缀是 tc）
  return (langLower.includes('sc') || langLower.includes('cn')) &&
         !langLower.includes('tc') &&
         !langLower.includes('tw') &&
         !langLower.includes('hk') &&
         !langLower.includes('hant');
};

/**
 * 判断语言代码是否为繁体中文（包括粤语）
 * 优先级：后缀匹配 > 精确匹配 > 包含匹配（排除简体后缀）
 * 支持：tc, tw, hk, hant, _tc, _tw, _hant, xx_tc, xx_tw, xx_xx_tc 等
 */
export const isTraditionalChinese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();

  // 优先级1：排除简体后缀（hk_sc, hk_cn 等是简体中文，不是繁体）
  if (langLower.match(/_(sc|cn)$/)) {
    return false;
  }

  // 优先级2：后缀匹配（支持 xx_xx_tc 这种多层嵌套）
  const suffixMatch = langLower.match(/_(tc|tw|hant)$/);
  if (suffixMatch) {
    return true;
  }

  // 优先级3：精确匹配
  if (langLower === 'tc' || langLower === 'tw' || langLower === 'hk') {
    return true;
  }

  // 优先级4：包含匹配
  return langLower.includes('tc') ||
         langLower.includes('tw') ||
         langLower.includes('hk') ||
         langLower.includes('hant');
};

/**
 * 判断语言代码是否为粤语（香港繁体）
 * 优先级：后缀匹配（_tc）> 精确匹配（tc）> hk 前缀匹配（排除简体后缀）
 */
export const isCantonese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();

  // 优先级1：后缀匹配 _tc（支持 xx_xx_tc）
  const suffixMatch = langLower.match(/_(tc)$/);
  if (suffixMatch) {
    return true;
  }

  // 优先级2：精确匹配 tc
  if (langLower === 'tc') {
    return true;
  }

  // 优先级3：hk 前缀匹配，但必须排除简体后缀（hk_sc 是简体，不是粤语）
  if (langLower.includes('hk')) {
    // 如果后缀是 _sc 或 _cn，则是简体中文，不是粤语
    if (langLower.match(/_(sc|cn)$/)) {
      return false;
    }
    return true;
  }

  return false;
};

// ==================== 标点符号检测 ====================

/**
 * 英文（ASCII）标点符号 Unicode 码点集合
 * 只包含有中文全角对应版本的符号
 * 以下符号没有中文版本，已移除：@ # $ % & * + - < = > ? ^ _ ` { | } ~ \
 */
const ENGLISH_PUNCTUATION_UNICODE = new Set<number>([
  0x0021, // ! → ！(U+FF01)
  0x0022, // " → ""(U+201C/U+201D)
  0x0027, // ' → ''(U+2018/U+2019)
  0x0028, // ( → （(U+FF08)
  0x0029, // ) → ）(U+FF09)
  0x002C, // , → ，(U+FF0C)
  0x002E, // . → 。(U+3002)
  0x003A, // : → ：(U+FF1A)
  0x003B, // ; → ；(U+FF1B)
  0x005B, // [ → ［(U+FF3B)
  0x005D, // ] → ］(U+FF3D)
]);

/**
 * 中文（全角）标点符号 Unicode 码点集合
 */
const CHINESE_PUNCTUATION_UNICODE = new Set<number>([
  0x3002, // 。 (U+3002)
  0x3001, // 、 (U+3001)
  0xFF01, // ！ (U+FF01)
  0xFF0C, // ， (U+FF0C)
  0xFF1A, // ： (U+FF1A)
  0xFF1B, // ； (U+FF1B)
  0xFF1F, // ？ (U+FF1F)
  0xFF08, // （ (U+FF08)
  0xFF09, // ） (U+FF09)
  0x201C, // " (U+201C)
  0x201D, // " (U+201D)
  0x2018, // ' (U+2018)
  0x2019, // ' (U+2019)
  0xFF3B, // ［ (U+FF3B)
  0xFF3D, // ］ (U+FF3D)
  0x300A, // 《 (U+300A)
  0x300B, // 》 (U+300B)
]);

/**
 * 使用 Unicode 码点判断字符是否为英文（ASCII）标点符号
 */
const isEnglishPunctuation = (char: string): boolean => {
  const codePoint = char.codePointAt(0) ?? 0;
  return ENGLISH_PUNCTUATION_UNICODE.has(codePoint);
};

/**
 * 使用 Unicode 码点判断字符是否为中文（全角）标点符号
 */
const isChinesePunctuation = (char: string): boolean => {
  const codePoint = char.codePointAt(0) ?? 0;
  return CHINESE_PUNCTUATION_UNICODE.has(codePoint);
};

/**
 * 检查位置是否在白名单上下文中
 */
const isInWhitelistContext = (text: string, position: number): boolean => {
  for (const pattern of PUNCTUATION_WHITELIST_PATTERNS) {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      if (match.index !== undefined &&
          position >= match.index &&
          position < match.index + match[0].length) {
        return true;
      }
    }
  }
  return false;
};

/**
 * 检测中文文本中的英文标点符号
 * @param text - 待检测文本
 * @returns 检测到的英文标点符号数组
 */
export const detectEnglishPunctuation = (text: string): string[] => {
  if (!text) return [];

  const detected: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 跳过非英文标点符号
    if (!isEnglishPunctuation(char)) {
      continue;
    }

    // 跳过白名单上下文中的标点
    if (isInWhitelistContext(text, i)) {
      continue;
    }

    // 跳过中文标点符号（防止误报）
    if (isChinesePunctuation(char)) {
      continue;
    }

    detected.push(char);
  }

  return [...new Set(detected)];
};

// ==================== 简繁体字检测 ====================

/**
 * 判断字符是否为中文字符（CJK 统一表意文字）
 * 使用 Unicode 范围：U+4E00 到 U+9FFF
 */
const isChineseCharacter = (char: string): boolean => {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint >= 0x4E00 && codePoint <= 0x9FFF;
};

/**
 * 判断单个字符是否为繁体字
 * 通过 chinese-conv 转换判断：如果简繁转换后字符改变，则可能是繁体字
 */
const isTraditionalChar = (char: string): boolean => {
  if (!isChineseCharacter(char)) {
    return false;
  }
  // 如果字符转换为简体后与原字符不同，说明原字符是繁体字
  const simplified = sify(char);
  return simplified !== char;
};

/**
 * 判断单个字符是否为简体字
 * 通过 chinese-conv 转换判断：如果简繁转换后字符改变，则可能是简体字
 */
const isSimplifiedChar = (char: string): boolean => {
  if (!isChineseCharacter(char)) {
    return false;
  }
  // 如果字符转换为繁体后与原字符不同，说明原字符是简体字
  const traditional = tify(char);
  return traditional !== char;
};

/**
 * 粤语特有字列表
 * 这些字是粤语区专用，chinese-conv/opencc-js 都无法识别
 * 在简体中文文本中不应出现
 */
const CANTONESE_ONLY_CHARS = new Set<string>([
  // 粤语特有字（简体中文中不应出现）
  '佢', // 他/她
  '喺', // 在
  '嚟', // 来
  '冇', // 没有
  '咪', // 不要
  '唔', // 不
  '咗', // 了（完成时态标记）
  '哂', // 全/都
  '啲', // 一些
  '乜', // 什么
  '嘅', // 的
  '噉', // 这样
  '咁', // 那么/这么
  '攰', // 累
  '睇', // 看
  '搵', // 找
  '攞', // 拿
  '畀', // 给
  '嗰', // 那
  '哋', // 们（复数后缀）
  '嘞', // 助词
  '啰', // 助词
  '啫', // 只/仅
  '係', // 是
  '瞓', // 睡
  '埋', // 连同
  '湊', // 凑合
  '勁', // 很/非常
  '識', // 懂/会
]);

/**
 * 判断字符是否为粤语特有字
 * chinese-conv/opencc-js 无法识别的粤语字
 */
const isCantoneseOnlyChar = (char: string): boolean => {
  return CANTONESE_ONLY_CHARS.has(char);
};

/**
 * 检测简体中文文本中的繁体字和粤语字
 * @param text - 待检测文本
 * @returns 检测到的繁体字数组
 */
export const detectTraditionalInSimplified = (text: string): string[] => {
  if (!text) return [];

  const detected: string[] = [];

  for (const char of text) {
    // 只检查中文字符
    if (!isChineseCharacter(char)) {
      continue;
    }

    // 1. 使用 chinese-conv 判断是否为繁体字
    if (isTraditionalChar(char)) {
      detected.push(char);
      continue;
    }

    // 2. 检查是否为粤语特有字（chinese-conv 无法识别）
    if (isCantoneseOnlyChar(char)) {
      detected.push(char);
    }
  }

  return [...new Set(detected)];
};

/**
 * 检测繁体中文文本中的简体字
 * @param text - 待检测文本
 * @param _languageCode - 语言代码（保留参数以兼容现有调用，不再需要白名单）
 * @returns 检测到的简体字数组
 */
export const detectSimplifiedInTraditional = (text: string, _languageCode: string): string[] => {
  if (!text) return [];

  const detected: string[] = [];

  for (const char of text) {
    // 只检查中文字符
    if (!isChineseCharacter(char)) {
      continue;
    }

    // 使用 chinese-conv 判断是否为简体字
    // 如果字符转换为繁体后与原字符不同，说明它是简体字
    // 如果转换后相同，说明在简繁中通用，不需要报警
    if (isSimplifiedChar(char)) {
      detected.push(char);
    }
  }

  return [...new Set(detected)];
};

// ==================== 统一检测接口 ====================

/**
 * 检测文本中的所有中文质量问题
 * @param text - 待检测文本
 * @param languageCode - 语言代码
 * @returns 质量问题原因数组（可追加到 AI 检测结果）
 */
export const detectChineseQualityIssues = (
  text: string,
  languageCode: string
): LanguageIssue[] => {
  const reasons: LanguageIssue[] = [];

  if (!text || !isChineseLanguage(languageCode)) {
    return reasons;
  }

  // 1. 检查英文标点符号
  const englishPunctuations = detectEnglishPunctuation(text);
  if (englishPunctuations.length > 0) {
    const punctuationsStr = englishPunctuations.map(p => `"${p}"`).join(', ');
    reasons.push({
      type: 'Punctuation',
      reason: `Uses English punctuation (${punctuationsStr})`,
    });
  }

  // 2. 检查简体中文中的繁体字
  if (isSimplifiedChinese(languageCode)) {
    const traditionalChars = detectTraditionalInSimplified(text);
    if (traditionalChars.length > 0) {
      const charsStr = traditionalChars.join(', ');
      reasons.push({
        type: 'Character',
        reason: `Contains Traditional Chinese characters (${charsStr})`,
      });
    }
  }

  // 3. 检查繁体中文中的简体字
  if (isTraditionalChinese(languageCode)) {
    const simplifiedChars = detectSimplifiedInTraditional(text, languageCode);
    if (simplifiedChars.length > 0) {
      const charsStr = simplifiedChars.join(', ');
      const langType = isCantonese(languageCode) ? 'Cantonese' : 'Traditional';
      reasons.push({
        type: 'Character',
        reason: `Contains Simplified Chinese characters in ${langType} text (${charsStr})`,
      });
    }
  }

  return reasons;
};

/**
 * 批量检测多行文本的中文质量问题
 * 用于增强 AI 检测结果，添加额外的中文特定检查
 * @param comparisonData - 包含 rowIndex 和 targetValue 的比较数据数组
 * @param languageCode - 语言代码
 * @returns rowIndex 到额外原因的映射
 */
export const detectChineseQualityIssuesForRows = (
  comparisonData: Array<{ rowIndex: number; targetValue: string }>,
  languageCode: string
): Map<number, LanguageIssue[]> => {
  const issuesMap = new Map<number, LanguageIssue[]>();

  if (!isChineseLanguage(languageCode)) {
    return issuesMap;
  }

  for (const row of comparisonData) {
    const reasons = detectChineseQualityIssues(row.targetValue, languageCode);
    if (reasons.length > 0) {
      issuesMap.set(row.rowIndex, reasons);
    }
  }

  return issuesMap;
};

/**
 * 合并 AI 检测的原因和中文工具检测的原因
 * @param aiDifferences - AI 检测到的差异
 * @param comparisonData - 原始比较数据
 * @param languageCode - 语言代码
 * @returns 包含额外原因的合并差异
 */
export const mergeChineseQualityIssues = (
  aiDifferences: LanguageCompareDifference[],
  comparisonData: Array<{ rowIndex: number; targetValue: string }>,
  languageCode: string
): LanguageCompareDifference[] => {
  // 获取中文工具检测到的额外问题
  const additionalIssues = detectChineseQualityIssuesForRows(comparisonData, languageCode);

  // 创建映射以便快速查找
  const aiDiffMap = new Map(
    aiDifferences.map(d => [d.rowIndex, d])
  );

  const mergedResult: LanguageCompareDifference[] = [];

  // 处理有 AI 检测问题的行
  for (const [rowIndex, diff] of aiDiffMap) {
    const additionalReasons = additionalIssues.get(rowIndex) || [];
    const allReasons = [...diff.reasons, ...additionalReasons];
    const dedupedReasons = Array.from(
      new Map(allReasons.map(reason => [`${reason.type}::${reason.reason}`, reason])).values()
    );
    mergedResult.push({
      rowIndex,
      targetValue: diff.targetValue,
      reasons: dedupedReasons,
    });
    additionalIssues.delete(rowIndex); // 移除已处理的条目
  }

  // 添加只有中文工具检测到问题的行（无 AI 问题）
  for (const [rowIndex, reasons] of additionalIssues) {
    const rowData = comparisonData.find(d => d.rowIndex === rowIndex);
    if (rowData) {
      mergedResult.push({
        rowIndex,
        targetValue: rowData.targetValue,
        reasons,
      });
    }
  }

  return mergedResult;
};
