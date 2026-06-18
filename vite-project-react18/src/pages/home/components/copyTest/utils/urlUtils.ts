/**
 * 文件作用：提供 Confluence URL 基础校验工具。
 */
/** 判断用户输入是否是可访问的 http/https URL。 */
export const isValidConfluenceUrl = (value: string): boolean => {
  try {

    /** 定义 url 常量。 */
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
