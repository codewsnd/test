import React from 'react';

/**
 * 将 Markdown 表格字符串转换为 Ant Design Table 组件所需的数据格式
 *
 * @param markdownTableStr - Markdown 格式的表格字符串
 * @returns 包含 columns 和 dataSource 的对象，用于 Ant Design Table 组件
 */
export const convertMarkdownToAntdTableData = (markdownTableStr: string) => {
  if (!markdownTableStr) return { columns: [], dataSource: [] };

  const lines = markdownTableStr.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return { columns: [], dataSource: [] };

  // Extract headers - 提取表头
  const headerLine = lines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

  // Extract data rows (skip separator line) - 提取数据行（跳过分隔符行）
  const dataRows = lines.slice(2);
  const dataSource = dataRows.map((row, rowIndex) => {
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    const rowData: any = { key: rowIndex };

    cells.forEach((cell, cellIndex) => {
      rowData[`col${cellIndex}`] = cell;
    });

    return rowData;
  });

  // 计算每列的最大宽度
  const columnWidths = headers.map((header, index) => {
    // 计算表头宽度
    const headerWidth = calculateTextWidth(header);
    // 计算该列所有数据的最大宽度
    const dataWidths = dataSource.map(row => calculateTextWidth(row[`col${index}`] || ''));
    const maxDataWidth = Math.max(...dataWidths, 0);
    // 返回表头和数据中的最大宽度
    return Math.max(headerWidth, maxDataWidth);
  });

  // Create columns for Ant Design Table - 创建 Ant Design Table 的列配置
  const columns = headers.map((header, index) => ({
    title: header,
    dataIndex: `col${index}`,
    key: `col${index}`,
    width: columnWidths[index],
    // 添加 render 函数，将 <br> 标签转换为实际换行显示
    render: (text: string) => {
      if (!text) return text;
      // 将 <br> 标签替换为换行符
      const content = String(text).replace(/<br>/gi, '\n');
      // 使用 pre-wrap 样式保留换行和空格
      return React.createElement('span', {
        style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
      }, content);
    },
  }));

  return { columns, dataSource };
};


/**
 * 判断给定的字符串是否是标准的 Markdown 表格格式
 *
 * @param markdownStr - 待检测的字符串
 * @param requiredHeaders - 可选参数，用于检测表头是否包含指定的字符串数组
 * @returns 如果是标准的 Markdown 表格格式则返回 true，否则返回 false
 */
export const isValidMarkdownTable = (markdownStr: string, requiredHeaders?: string[]): boolean => {
  if (!markdownStr || typeof markdownStr !== 'string') {
    return false;
  }

  const lines = markdownStr.trim().split('\n').filter(line => line.trim());

  // 至少需要 3 行：表头、分隔符、至少一行数据
  if (lines.length < 3) {
    return false;
  }

  // 检查第一行是否是表头格式（包含 | 分隔符）
  const headerLine = lines[0];
  if (!headerLine.includes('|')) {
    return false;
  }

  // 提取表头
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  if (headers.length === 0) {
    return false;
  }

  // 检查第二行是否是分隔符行（应该包含 --- 格式）
  const separatorLine = lines[1];
  const separatorCells = separatorLine.split('|').map(c => c.trim()).filter(c => c);

  // 分隔符行的单元格数量应该与表头一致
  if (separatorCells.length !== headers.length) {
    return false;
  }

  // 每个分隔符单元格应该包含至少3个连字符
  const isValidSeparator = separatorCells.every(cell => {
    const cleanCell = cell.replace(/:/g, ''); // 移除对齐符号
    return /^-{3,}$/.test(cleanCell.trim());
  });

  if (!isValidSeparator) {
    return false;
  }

  // 检查数据行格式
  const dataRows = lines.slice(2);
  const hasValidDataRows = dataRows.every(row => {
    if (!row.includes('|')) {
      return false;
    }
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    // 数据行的列数应该与表头一致（允许少一些列，但不能超过）
    return cells.length > 0 && cells.length <= headers.length;
  });

  if (!hasValidDataRows) {
    return false;
  }

  // 如果提供了 requiredHeaders 参数，检查表头是否包含所有必需的字符串
  if (requiredHeaders && Array.isArray(requiredHeaders)) {
    const headerLowerCase = headers.map(h => h.toLowerCase());
    const hasAllRequiredHeaders = requiredHeaders.every(required =>
      headerLowerCase.some(header => header.includes(required.toLowerCase()))
    );

    if (!hasAllRequiredHeaders) {
      return false;
    }
  }

  return true;
};


/**
 * 计算文本的显示宽度（考虑换行）
 */
const calculateTextWidth = (text: string): number => {
  if (!text) return 50;
  // 将 <br> 替换为换行符，然后按行分割
  const lines = String(text).replace(/<br>/gi, '\n').split('\n');
  // 找到最长的一行
  const maxLineLength = Math.max(...lines.map(line => line.length));
  // 基础宽度：每个字符约 8px，最小 100px，最大 600px
  return Math.min(Math.max(maxLineLength * 8 + 40, 100), 600);
};
