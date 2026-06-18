/**
 * 文件作用：提供表格下拉选项展示文案工具。
 */
/** 生成 CopyTest 表格切换下拉框的固定编号标签。 */
export const getCopyTestTableOptionLabel = (table: { index: number }): string => {
  return `Table${table.index + 1}`;
};
