import { Converter } from 'opencc-js';

/**
 * 语言代码映射到标准 ISO 639 代码
 */
const LANGUAGE_MAPPING: Record<string, string> = {
  'tc': 'zh-Hant',  // 繁体中文
  'sc': 'zh-Hans',  // 简体中文
};

// 转换器函数类型
type ConverterFunc = (text: string) => string;

// 初始化 OpenCC 转换器
let simplifiedToTraditionalConverter: ConverterFunc | null = null;
let traditionalToSimplifiedConverter: ConverterFunc | null = null;
let simplifiedToHongKongConverter: ConverterFunc | null = null;

try {
  simplifiedToTraditionalConverter = Converter({ from: 'cn', to: 'tw' });
  traditionalToSimplifiedConverter = Converter({ from: 'tw', to: 'cn' });
  // 使用简体到香港繁体（粤语正字）的转换器
  simplifiedToHongKongConverter = Converter({ from: 'cn', to: 'hk' });
} catch (error) {
  console.warn('OpenCC converter initialization failed:', error);
}

/**
 * 粤语通用简体字白名单（这些字在粤语和普通话中都通用，无需检测）
 */
const CANTONESE_COMMON_SIMPLIFIED_CHARS = new Set<string>([
  // 代词
  '我', '你', '您', '他', '她', '它', '们', '自己', '大家',
  // 指示词
  '这', '那', '哪', '些', '里',
  // 连词
  '和', '与', '及', '而', '或', '但', '不过',
  // 介词
  '在', '从', '到', '于', '对', '向', '把', '被',
  // 助词
  '的', '了', '着', '过', '得', '地', '吗', '呢', '吧', '啊',
  // 动词（通用）
  '是', '有', '没', '无', '会', '能', '可以', '要', '想', '做', '说', '看',
  // 形容词（通用）
  '好', '多', '少', '大', '小', '新', '旧', '高', '低', '长', '短',
  // 时间相关
  '年', '月', '日', '时', '分', '秒', '今天', '明天', '昨天',
  // 数字
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万',
  // 常见字
  '人', '事', '物', '地方', '公司', '工作', '学习', '生活', '问题', '方法',
]);

/**
 * 获取语言显示名称
 * 语言代码如 hk_en, hk_tc, gl_en, fr, ja
 * 返回格式化后的语言显示名称，如 "English (hk_en)"，如果无法转换则返回原代码
 */
export const getLanguageDisplayName = (code: string): string => {
  // 提取语言部分 (如 hk_en -> en, hk_tc -> tc, ja -> ja)
  const parts = code.split('_');
  const languagePart = parts[parts.length - 1]?.toLowerCase();

  if (!languagePart) return code;

  // 处理特殊语言代码映射到标准 ISO 639 代码
  const localeCode = LANGUAGE_MAPPING[languagePart] || languagePart;

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    const languageName = displayNames.of(localeCode);
    return languageName ? `${languageName} (${code})` : code;
  } catch {
    return code;
  }
};

/**
 * 判断是否为简体中文
 */
export const isSimplifiedChinese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();
  const suffixMatch = langLower.match(/_(sc|tc|tw|cn|hant)$/)?.[1];

  if (suffixMatch) {
    return suffixMatch === 'sc' || suffixMatch === 'cn';
  }

  // 检查是否包含 sc 或 cn
  return langLower.includes('sc') || langLower.includes('cn') ||
         (langLower.includes('zh') && !langLower.includes('tw') &&
          !langLower.includes('hk') && !langLower.includes('hant') &&
          !langLower.includes('tc'));
};

/**
 * 判断是否为繁体中文（包括粤语）
 */
export const isTraditionalChinese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();
  const suffixMatch = langLower.match(/_(sc|tc|tw|cn|hant)$/)?.[1];

  if (suffixMatch) {
    return suffixMatch === 'tc' || suffixMatch === 'tw' || suffixMatch === 'hant';
  }

  return langLower.includes('tc') || langLower.includes('tw') ||
         langLower.includes('hk') || langLower.includes('hant');
};

/**
 * 判断是否为中文（简体或繁体）
 */
export const isChinese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();
  return langLower.startsWith('zh') || langLower.includes('chinese') ||
         langLower.includes('cn') || langLower.includes('tw') ||
         langLower.includes('hk') || langLower.includes('hant') ||
         langLower.includes('sc') || langLower.includes('tc');
};

/**
 * 判断是否为粤语（香港繁体）
 */
export const isCantonese = (languageCode: string): boolean => {
  const langLower = languageCode.toLowerCase();
  const suffixMatch = langLower.match(/_(sc|tc|tw|cn|hant)$/)?.[1];

  if (suffixMatch) {
    return suffixMatch === 'tc';
  }

  return langLower.includes('hk') || langLower === 'tc';
};

/**
 * 检测简体中文中的繁体字
 * 待检测文本
 * 返回检测到的繁体字数组
 */
export const detectTraditionalInSimplified = (text: string): string[] => {
  if (!text || !simplifiedToTraditionalConverter) return [];

  const traditionalChars: string[] = [];

  for (const char of text) {
    // 跳过非中文字符
    if (!/[\u4e00-\u9fff]/.test(char)) continue;

    // 尝试转换字符
    const converted = simplifiedToTraditionalConverter(char);

    // 如果转换后与原字符不同，且原字符不在常见简体字列表中，则可能是繁体
    if (converted !== char) {
      // 进一步验证：将繁体转回简体，如果结果与原字符不同，说明原字符确实是繁体
      if (traditionalToSimplifiedConverter) {
        const backToSimplified = traditionalToSimplifiedConverter(char);
        if (backToSimplified !== char) {
          traditionalChars.push(char);
        }
      }
    }
  }

  return [...new Set(traditionalChars)];
};

/**
 * 检测繁体中文中的简体字
 * 待检测文本
 * 语言代码，用于区分粤语和普通繁体中文
 * 返回检测到的简体字数组
 */
export const detectSimplifiedInTraditional = (text: string, languageCode?: string): string[] => {
  if (!text) return [];

  // 如果是粤语，使用专门的粤语简体字检测
  if (languageCode && isCantonese(languageCode)) {
    return detectSimplifiedInCantonese(text);
  }

  // 普通繁体中文的检测逻辑
  if (!traditionalToSimplifiedConverter) return [];

  const simplifiedChars: string[] = [];

  for (const char of text) {
    if (!/[\u4e00-\u9fff]/.test(char)) continue;

    const converted = traditionalToSimplifiedConverter(char);

    if (converted === char) {
      if (simplifiedToTraditionalConverter) {
        const toTraditional = simplifiedToTraditionalConverter(char);
        if (toTraditional !== char) {
          simplifiedChars.push(char);
        }
      }
    }
  }

  return [...new Set(simplifiedChars)];
};

/**
 * 检测粤语（香港繁体）中的违规简体字
 * 使用香港繁体转换器，并过滤通用简体字白名单
 * 待检测文本
 * 返回检测到的违规简体字数组
 */
export const detectSimplifiedInCantonese = (text: string): string[] => {
  if (!text || !simplifiedToHongKongConverter) return [];

  const simplifiedChars: string[] = [];

  for (const char of text) {
    // 跳过非中文字符
    if (!/[\u4e00-\u9fff]/.test(char)) continue;

    // 步骤1: 过滤通用简体字白名单
    if (CANTONESE_COMMON_SIMPLIFIED_CHARS.has(char)) {
      continue;
    }

    // 步骤2: 转换为香港繁体（粤语正字）
    const converted = simplifiedToHongKongConverter(char);

    // 调试：查看转换结果
    console.log(`Cantonese detect: "${char}" -> "${converted}"`);

    // 步骤3: 对比转换前后的文本
    if (converted !== char) {
      // 转换后不同，说明这个简体字在香港繁体中有对应的正字
      // 步骤4: 提取违规简体字
      simplifiedChars.push(char);
    }
  }

  return [...new Set(simplifiedChars)];
};

/**
 * 检测中文文本中的英文标点符号
 * 待检测文本
 * 返回检测到的英文标点符号数组
 */
export const detectEnglishPunctuationInChinese = (text: string): string[] => {
  if (!text) return [];

  // 英文标点符号的 Unicode 范围和常见标点
  const englishPunctuationPattern = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/g;

  // 全角中文标点符号（用于排除）
  const chinesePunctuationPattern = /[。！？；：""''（）【】《》、，]/g;

  const matches = text.match(englishPunctuationPattern) || [];
  const englishPunctuation: string[] = [];

  for (const char of matches) {
    // 检查是否在白名单上下文中（小数点、版本号等）
    const contextPattern = new RegExp(
      `(?:${getWhitelistPattern()})`.replace(/\\/g, '\\\\'),
      'g'
    );

    // 如果在白名单上下文中，跳过
    if (contextPattern.test(text)) {
      // 进一步检查这个标点是否在白名单上下文内
      const beforeChar = text[text.indexOf(char) - 1];
      const afterChar = text[text.indexOf(char) + 1];

      // 小数点：前后都是数字
      if (char === '.' && /\d/.test(beforeChar || '') && /\d/.test(afterChar || '')) {
        continue;
      }

      // 版本号：v1.0 格式
      if (char === '.' && beforeChar && /\d/.test(beforeChar)) {
        const versionMatch = text.substring(text.indexOf(char) - 2, text.indexOf(char) + 3);
        if (/v?\d+\.\d+/.test(versionMatch)) {
          continue;
        }
      }

      // ISO 日期：2024-01-01
      if (char === '-') {
        const dateMatch = text.substring(text.indexOf(char) - 4, text.indexOf(char) + 3);
        if (/\d{4}-\d{2}-\d{2}/.test(dateMatch)) {
          continue;
        }
      }
    }

    // 排除全角标点（虽然正则已经过滤，但再确认一次）
    if (!chinesePunctuationPattern.test(char)) {
      englishPunctuation.push(char);
    }
  }

  return [...new Set(englishPunctuation)];
};

/**
 * 白名单上下文模式（允许使用英文标点的情况）
 */
const getWhitelistPattern = (): string => {
  return [
    '\\d+\\.\\d+',           // 小数：1.23
    'v\\d+\\.\\d+',          // 版本号：v1.0
    '\\d{4}-\\d{2}-\\d{2}',  // ISO 日期：2024-01-01
    '[\\w.]+@[\\w.]+',       // Email
    'https?://[^\\s]+',      // URL
    '[A-Za-z]+:\\\\[^\\s]*',  // Windows 路径：C:\\Users
    '/[\\w/]+',              // Unix 路径：/path/to/file
    '[A-Z_][A-Z0-9_]*',      // 代码常量：API_KEY
  ].join('|');
};

/**
 * 检测文本质量问题
 * 待检测文本
 * 语言代码
 * 返回检测到的问题列表
 */
export const detectTextQualityIssues = (
  text: string,
  languageCode: string
): string[] => {
  const issues: string[] = [];

  if (!text) return issues;

  // 检测中文中的英文标点
  if (isChinese(languageCode)) {
    const englishPunctuations = detectEnglishPunctuationInChinese(text);
    if (englishPunctuations.length > 0) {
      const punctuationsStr = englishPunctuations.join(', ');
      issues.push(`Uses English punctuation: ${punctuationsStr}`);
    }
  }

  // 检测简体中文中的繁体字
  if (isSimplifiedChinese(languageCode)) {
    const traditionalChars = detectTraditionalInSimplified(text);
    if (traditionalChars.length > 0) {
      const charsStr = traditionalChars.join(', ');
      issues.push(`Contains Traditional Chinese characters: ${charsStr}`);
    }
  }

  // 检测繁体中文中的简体字（传递语言代码以区分粤语）
  if (isTraditionalChinese(languageCode)) {
    const simplifiedChars = detectSimplifiedInTraditional(text, languageCode);
    if (simplifiedChars.length > 0) {
      const charsStr = simplifiedChars.join(', ');
      issues.push(`Contains Simplified Chinese characters: ${charsStr}`);
    }
  }

  return issues;
};
