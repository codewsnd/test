const FENCED_CODE_BLOCK_PATTERN = /^\s*```/;
const HTML_DOCUMENT_PATTERN = /(?:<!doctype\s+html|<html[\s>])/i;
const COMPLETE_HTML_TAG_PATTERN = /^<[a-z][\w:-]*(?:\s|>|\/>)[\s\S]*<\/[a-z][\w:-]*>\s*$/i;
const HTML_FENCE_TOKEN_PATTERN = /(```|~~~)[ \t]*(html|htm|xhtml)\b/i;

type HtmlCodeBlockSection = {
  code: string;
  language: string;
  openerStart: number;
  openerEnd: number;
  end: number;
};

export const isHtmlCodeContent = (value: string) => {
  const trimmedValue = value.trim();
  return HTML_DOCUMENT_PATTERN.test(trimmedValue) || COMPLETE_HTML_TAG_PATTERN.test(trimmedValue);
};

export const isHtmlLanguage = (language: string) =>
  ['html', 'htm', 'xhtml'].includes(language.toLowerCase());

const createClosingFencePattern = (fence: string) => {
  const marker = fence.startsWith('~') ? '~' : '`';
  return new RegExp(`\\r?\\n {0,3}${marker}{3,}[ \\t]*(?=\\r?\\n|$)`, 'g');
};

const trimHtmlCodeBoundaries = (value: string) => {
  const withoutBoundaryNewlines = value.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  return /^\s*</.test(withoutBoundaryNewlines)
    ? withoutBoundaryNewlines.trimStart()
    : withoutBoundaryNewlines;
};

const findNextHtmlFenceOpen = (value: string, startIndex: number) => {
  const match = HTML_FENCE_TOKEN_PATTERN.exec(value.slice(startIndex));
  if (!match || match.index === undefined) {
    return null;
  }

  const openerStart = startIndex + match.index;
  let openerEnd = openerStart + match[0].length;
  const remainingAfterLanguage = value.slice(openerEnd);
  const plainLineBreak = /^[^\S\r\n]*\r?\n/.exec(remainingAfterLanguage);
  const metadataLine = /^[^\S\r\n]+[^\r\n]*\r?\n/.exec(remainingAfterLanguage);

  if (plainLineBreak) {
    openerEnd += plainLineBreak[0].length;
  } else if (metadataLine && !/^\s*</.test(metadataLine[0])) {
    openerEnd += metadataLine[0].length;
  }

  return {
    fence: match[1],
    language: match[2].toLowerCase(),
    openerStart,
    openerEnd,
  };
};

const extractHtmlCodeBlockSections = (value: string): HtmlCodeBlockSection[] => {
  const sections: HtmlCodeBlockSection[] = [];
  let searchIndex = 0;

  while (searchIndex < value.length) {
    const open = findNextHtmlFenceOpen(value, searchIndex);
    if (!open) {
      break;
    }

    const closingPattern = createClosingFencePattern(open.fence);
    closingPattern.lastIndex = open.openerEnd;
    const closingMatch = closingPattern.exec(value);
    const inlineClosingIndex = closingMatch ? -1 : value.indexOf(open.fence, open.openerEnd);
    const hasInlineClosingFence = inlineClosingIndex >= 0;
    const codeEnd = closingMatch
      ? closingMatch.index
      : (hasInlineClosingFence ? inlineClosingIndex : value.length);
    const sectionEnd = closingMatch
      ? closingMatch.index + closingMatch[0].length
      : (hasInlineClosingFence ? inlineClosingIndex + open.fence.length : value.length);

    sections.push({
      code: trimHtmlCodeBoundaries(value.slice(open.openerEnd, codeEnd)),
      language: open.language,
      openerStart: open.openerStart,
      openerEnd: open.openerEnd,
      end: sectionEnd,
    });
    searchIndex = sectionEnd;
  }

  return sections;
};

const appendMarkdownFenceBoundary = (value: string) => {
  if (!value) {
    return value;
  }
  return /\n[ \t]*$/.test(value) ? value : `${value.trimEnd()}\n\n`;
};

export const extractHtmlCodeBlocks = (value: string) =>
  extractHtmlCodeBlockSections(value).map((section) => section.code);

export const stripHtmlFenceIfPresent = (value: string) => {
  const section = extractHtmlCodeBlockSections(value)[0];
  if (!section) {
    return value;
  }

  const contentBeforeFence = value.slice(0, section.openerStart).trim();
  return contentBeforeFence && isHtmlCodeContent(contentBeforeFence)
    ? value
    : section.code;
};

export const normalizeMarkdownContent = (value: string) => {
  const htmlSections = extractHtmlCodeBlockSections(value);
  if (htmlSections.length > 0) {
    let normalizedContent = '';
    let cursor = 0;

    htmlSections.forEach((section) => {
      normalizedContent += value.slice(cursor, section.openerStart);
      normalizedContent = appendMarkdownFenceBoundary(normalizedContent);
      normalizedContent += `\`\`\`${section.language}\n${section.code.trimEnd()}\n\`\`\``;
      cursor = section.end;
    });

    return normalizedContent + value.slice(cursor);
  }

  if (!isHtmlCodeContent(value) || FENCED_CODE_BLOCK_PATTERN.test(value)) {
    return value;
  }

  return `\`\`\`html\n${value.trimEnd()}\n\`\`\``;
};
