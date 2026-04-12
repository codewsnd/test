import * as XLSX from 'xlsx';

/**
 * Excel 导入配置
 */
export interface ExcelImportConfig {
  /** 必需的表头列表 */
  requiredHeaders?: string[];
  /** 是否严格匹配表头：true: 完全匹配, false: 包含匹配 */
  strictMatch?: boolean;
  /** 工作表索引，默认: 0 (第一个工作表) */
  sheetIndex?: number;
}

/**
 * Excel 导入结果
 */
export interface ExcelImportResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** Markdown 格式的表格数据 */
  markdown?: string;
  /** 表头列表 */
  headers?: string[];
  /** 数据行列表 */
  rows?: string[][];
}

/**
 * 验证表头是否包含所有必需列表
 * @param headers - 实际表头数组
 * @param requiredHeaders - 必需的表头列表数组
 * @param strictMatch - 是否严格匹配：true: 完全匹配, false: 包含匹配
 * @returns 验证结果对象
 */
export const validateHeaders = (
  headers: string[],
  requiredHeaders: string[],
  strictMatch: boolean = false
): { valid: boolean; missing?: string[] } => {
  if (!requiredHeaders || requiredHeaders.length === 0) {
    return { valid: true };
  }

  const headerLowerCase = headers.map(h => h.toLowerCase().trim());
  const missing: string[] = [];

  for (const required of requiredHeaders) {
    const requiredLower = required.toLowerCase().trim();
    const found = strictMatch
      ? headerLowerCase.includes(requiredLower)
      : headerLowerCase.some(h => h.includes(requiredLower));

    if (!found) {
      missing.push(required);
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
};

/**
 * 将表格数据转换为 Markdown 格式
 * @param headers - 表头数组
 * @param rows - 数据行数组
 * @returns Markdown 格式的表格字符串
 */
export const convertToMarkdown = (headers: string[], rows: string[][]): string => {
  // 处理单元格内容，将换行符替换为 <br> 标签，避免破坏 Markdown 表格格式
  const sanitizeCell = (cell: any): string => {
    if (cell === null || cell === undefined) {
      return '';
    }
    const cellStr = String(cell);
    // 将所有类型的换行符（\n, \r\n, \r）替换为 <br> 标签
    return cellStr.replace(/\r\n|\r|\n/g, '<br>');
  };

  // 处理表头
  const sanitizedHeaders = headers.map(h => sanitizeCell(h));
  let markdown = '| ' + sanitizedHeaders.join(' | ') + ' |\n';
  markdown += '| ' + sanitizedHeaders.map(() => '---').join(' | ') + ' |\n';

  rows.forEach(row => {
    // 确保每行的列数与表头一致
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    // 处理每个单元格的内容，将换行符转换为 <br>
    const sanitizedRow = paddedRow.slice(0, headers.length).map(cell => sanitizeCell(cell));
    markdown += '| ' + sanitizedRow.join(' | ') + ' |\n';
  });
  return markdown;
};

/**
 * 从 Excel 文件导入数据
 * @param file - Excel 文件对象
 * @param config - 导入配置（可选）
 * @returns Promise<ExcelImportResult> 导入结果
 */
export const importFromExcel = (
  file: File,
  config: ExcelImportConfig = {}
): Promise<ExcelImportResult> => {
  return new Promise((resolve) => {
    const {
      requiredHeaders = [],
      strictMatch = false,
      sheetIndex = 0,
    } = config;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({
            success: false,
            error: 'Failed to read file data',
          });
          return;
        }

        // 解析 Excel 文件
        const workbook = XLSX.read(data, { type: 'array' });

        // 检查工作表是否存在
        if (sheetIndex >= workbook.SheetNames.length) {
          resolve({
            success: false,
            error: `Sheet index ${sheetIndex} not found. File has ${workbook.SheetNames.length} sheet(s).`,
          });
          return;
        }

        const sheetName = workbook.SheetNames[sheetIndex];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        // 检查是否有数据
        if (jsonData.length === 0) {
          resolve({
            success: false,
            error: 'Excel file is empty',
          });
          return;
        }

        // 提取表头和数据行
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as string[][];

        // 验证表头
        if (requiredHeaders.length > 0) {
          const validation = validateHeaders(headers, requiredHeaders, strictMatch);
          if (!validation.valid) {
            resolve({
              success: false,
              error: `Missing required headers: ${validation.missing?.join(', ')}`,
              headers,
              rows,
            });
            return;
          }
        }

        // 转换为 Markdown 格式
        const markdown = convertToMarkdown(headers, rows);

        resolve({
          success: true,
          markdown,
          headers,
          rows,
        });
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        resolve({
          success: false,
          error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read file',
      });
    };

    reader.readAsArrayBuffer(file);
  });
};


