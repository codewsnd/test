/**
 * 文件作用：生成并校验 CopyTest 单次导出使用的短期 scope token。
 */
/** 只允许写入 HTML 属性的固定前缀和小写十六进制随机值。 */
const COPY_TEST_EXPORT_SCOPE_PATTERN = /^copytest-[0-9a-f]{32}$/;

/** 将随机字节编码为不含 HTML 特殊字符的 token 片段。 */
const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

/** 生成一个 128-bit 随机的单次导出 scope token。 */
export const createCopyTestExportScope = (): string => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `copytest-${toHex(bytes)}`;
};

/** 拒绝空值、布尔标记和任何可能破坏 HTML 属性的 token。 */
export const isValidCopyTestExportScope = (value: string): boolean => {
  return COPY_TEST_EXPORT_SCOPE_PATTERN.test(value);
};
