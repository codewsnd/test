/**
 * 文件作用：提供 Confluence URL 基础校验工具。
 */
/** URL 格式错误时显示在输入框下方的固定文案。 */
export const INVALID_CONFLUENCE_URL_ERROR = 'In valid URL format, Please enter a valid Http:// or https:// URL';

/** Confluence storage 没有有效表格时的固定文案。 */
export const NO_VALID_TABLE_ERROR = 'No valid table found';

/** 判断用户输入是否是可访问的 http/https URL。 */
export const isValidConfluenceUrl = (value: string): boolean => {
  try {
    /** 浏览器标准解析器生成的 URL 对象。 */
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
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
