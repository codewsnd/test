/**
 * 文件作用：提供表格下拉选项展示文案工具。
 */
/** 按过滤后列表下标生成 CopyTest 表格切换下拉框的连续编号标签。 */
export const getCopyTestTableOptionLabel = (displayIndex: number): string => {
  return `Table${displayIndex + 1}`;
};
