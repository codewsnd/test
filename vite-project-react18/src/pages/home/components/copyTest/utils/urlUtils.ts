/**
 * 文件作用：提供 Confluence URL 基础校验工具。
 */
/** URL 格式错误时显示在输入框下方的固定文案。 */
export const INVALID_CONFLUENCE_URL_ERROR = 'Invalid URL format, Please enter a valid Http:// or https:// URL';

/** Confluence storage 没有有效表格时的固定文案。 */
export const NO_VALID_TABLE_ERROR = 'No valid table found';

/** Confluence URL 必须显式使用的 HTTP(S) 协议前缀。 */
const HTTP_URL_PREFIX_PATTERN = /^https?:\/\//i;

/** 用于识别输入中全部 HTTP(S) 协议片段，避免把多条 URL 当作一条路径。 */
const HTTP_URL_PROTOCOL_PATTERN = /https?:\/\//gi;

/** 原始 URL 中不允许出现的空白字符。 */
const URL_WHITESPACE_PATTERN = /\s/;

/** URL 标准不允许直接出现且浏览器可能自动转义的危险字符。 */
const INVALID_URL_CHARACTER_PATTERN = /[<>{}\\^`|"]/;

/** 不完整的百分号编码，例如 %、%A 或 %ZZ。 */
const INVALID_PERCENT_ENCODING_PATTERN = /%(?![0-9a-f]{2})/i;

/** 普通域名或内网主机名中单个标签允许的格式。 */
const HOSTNAME_LABEL_PATTERN = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/i;

/** DNS hostname 去除可选结尾点后的最大长度。 */
const MAX_HOSTNAME_LENGTH = 253;

/** 判断输入是否只包含一个位于开头的 HTTP(S) 协议。 */
const hasSingleHttpUrlPrefix = (value: string): boolean => {
  const protocolMatches = value.match(HTTP_URL_PROTOCOL_PATTERN) || [];
  return HTTP_URL_PREFIX_PATTERN.test(value) && protocolMatches.length === 1;
};

/** 判断 URL 是否包含 ASCII 控制字符。 */
const hasControlCharacter = (value: string): boolean => {
  return Array.from(value).some(character => {
    const characterCode = character.charCodeAt(0);
    return characterCode <= 31 || characterCode === 127;
  });
};

/** 判断原始 URL 是否含有浏览器可能静默修正的非法内容。 */
const hasValidRawUrlSyntax = (value: string): boolean => {
  return !URL_WHITESPACE_PATTERN.test(value)
    && !hasControlCharacter(value)
    && !INVALID_URL_CHARACTER_PATTERN.test(value)
    && !INVALID_PERCENT_ENCODING_PATTERN.test(value);
};

/** 判断普通域名、IPv4、IPv6 或内网单标签主机名是否合法。 */
const hasValidHostname = (hostname: string): boolean => {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return true;
  }

  /** 完整域名允许使用一个结尾点表示 DNS 根。 */
  const normalizedHostname = hostname.endsWith('.')
    ? hostname.slice(0, -1)
    : hostname;
  if (normalizedHostname === '' || normalizedHostname.length > MAX_HOSTNAME_LENGTH) {
    return false;
  }

  return normalizedHostname.split('.').every(label => HOSTNAME_LABEL_PATTERN.test(label));
};

/** 判断原始 authority 是否使用了没有端口号的结尾冒号。 */
const hasEmptyPort = (value: string): boolean => {
  /** 去除协议后、路径或查询参数前的原始 authority。 */
  const authority = value.slice(value.indexOf('//') + 2).split(/[/?#]/, 1)[0];
  return authority.endsWith(':');
};

/** 判断用户输入是否是可访问的 http/https URL。 */
export const isValidConfluenceUrl = (value: string): boolean => {
  if (!hasSingleHttpUrlPrefix(value) || !hasValidRawUrlSyntax(value) || hasEmptyPort(value)) {
    return false;
  }

  try {
    /** 浏览器标准解析器生成的 URL 对象。 */
    const url = new URL(value);
    const usesHttpProtocol = url.protocol === 'http:' || url.protocol === 'https:';
    return usesHttpProtocol && hasValidHostname(url.hostname);
  } catch {
    return false;
  }
};

/** 读取 URL 输入框需要显示的格式错误。 */
export const getConfluenceUrlError = (value: string): string | undefined => {
  return isValidConfluenceUrl(value.trim()) ? undefined : INVALID_CONFLUENCE_URL_ERROR;
};

/** 读取 Confluence storage 解析结果需要显示的无表格错误。 */
export const getConfluenceTableError = (tableCount: number): string | undefined => {
  return tableCount > 0 ? undefined : NO_VALID_TABLE_ERROR;
};
