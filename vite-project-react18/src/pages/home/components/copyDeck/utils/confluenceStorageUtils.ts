import { parseFailedMarkerFromHtml } from './compareLanguage';

// ==================== 常量定义 ====================

/** Test Result 列标记 */
const TEST_RESULT_MARKER = 'testresult|values=';

/** Test Evidence 列标记 */
const TEST_EVIDENCE_MARKER = 'testevidence|values=';

/** Test Evidence 列标记（带空格） */
const TEST_EVIDENCE_ALT_MARKER = 'test evidence|values=';

/** Test Result 关键字 */
const TEST_RESULT_KEYWORD = 'testresult';

/** Test Evidence 关键字 */
const TEST_EVIDENCE_KEYWORD = 'testevidence';

// ==================== 接口定义 ====================

/**
 * 单元格信息接口
 */
export interface CellInfo {
  value: string;      // 单元格文本内容
  rowspan: number;    // 行跨度
  colspan: number;    // 列跨度
  isSpanned: boolean; // 是否被其他单元格合并（true表示这是被合并的空单元格）
  attributes?: Record<string, string>; // 原始 HTML 属性（style、class、bgcolor 等）
}

/**
 * 表格信息接口
 */
export interface TableInfo {
  title: string;      // 表格标题
  tableStr: string;   // 表格完整 HTML 字符串
  index: number;      // 表格索引（从0开始）
}

/**
 * 从元素中查找有效标题
 */
function findTitleFromElement(element: Element | null): string | null {
  if (!element) {
    return null;
  }

  const tagName = element.tagName.toLowerCase();
  const validTags = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  if (validTags.includes(tagName)) {
    const text = element.textContent?.trim() || '';
    if (text !== '') {
      return text;
    }
  }

  return null;
}

/**
 * 递归查找表格的标题
 * 规则：
 * 1. 从 table 的前一个兄弟元素开始查找
 * 2. 如果找到 <p><span><h1-h6> 且文本不为空，返回该文本
 * 3. 如果为空，继续找前一个兄弟元素
 * 4. 如果所有兄弟元素都找完了，从父元素的前一个兄弟元素开始查找
 * 5. 如果都找不到，返回空字符串
 */
function findTableTitle(table: HTMLTableElement): string {
  // 第一步：查找同级兄弟元素
  let current = table.previousElementSibling;

  while (current) {
    const title = findTitleFromElement(current);
    if (title !== null) {
      return title;
    }
    current = current.previousElementSibling;
  }

  // 第二步：查找父元素的兄弟元素
  let parent = table.parentElement;

  while (parent) {
    let parentSibling = parent.previousElementSibling;

    while (parentSibling) {
      const title = findTitleFromElement(parentSibling);
      if (title !== null) {
        return title;
      }
      parentSibling = parentSibling.previousElementSibling;
    }

    // 继续向上查找父元素的父元素
    parent = parent.parentElement;
  }

  return '';
}

/**
 * 检查表格是否包含 |values=xxx| 标记
 */
function hasValuesMarker(table: HTMLTableElement): boolean {
  const firstRow = table.querySelector('tr');
  if (!firstRow) {
    return false;
  }

  const headerText = firstRow.textContent || '';
  return headerText.includes('|values=');
}

/**
 * 解析 Confluence Storage HTML，提取所有符合条件的表格信息
 */
export function parseConfluenceTables(storageHtml: string): TableInfo[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(storageHtml, 'text/html');

  const tables = Array.from(doc.querySelectorAll('table'));
  const result: TableInfo[] = [];

  tables.forEach((table, index) => {
    // 检查表格 header 是否包含 |values=xxx|
    if (!hasValuesMarker(table)) {
      return; // 跳过不符合条件的表格
    }

    // 查找表格标题
    const title = findTableTitle(table);

    // 获取表格完整 HTML 字符串
    const tableStr = table.outerHTML;

    result.push({
      title,
      tableStr,
      index
    });
  });

  return result;
}

/**
 * 提取所有表格标题（仅标题列表）
 */
export function extractTableTitles(storageHtml: string): string[] {
  const tables = parseConfluenceTables(storageHtml);
  console.log('tables', tables);
  return tables.map(t => t.title);
}

/**
 * 根据标题查找表格
 */
export function findTableByTitle(storageHtml: string, tableName: string): TableInfo | null {
  const tables = parseConfluenceTables(storageHtml);
  return tables.find(t => t.title === tableName) || null;
}

/**
 * 提取表格的完整 HTML（用于后续渲染）
 */
export function extractTableHtml(storageHtml: string, tableName: string): string {
  const tableInfo = findTableByTitle(storageHtml, tableName);
  return tableInfo ? tableInfo.tableStr : '';
}


/**
 * 列信息接口
 */
interface ColumnInfo {
  type: 'result' | 'evidence' | 'normal';
  language?: string; // 对于 result/evidence 列，存储语言代码
}

/**
 * 确定单元格的列类型和语言
 */
function determineColumnInfo(cellText: string): ColumnInfo {
  const normalized = cellText.toLowerCase().replace(/\s+/g, '');

  // 匹配 |values=xxx| 格式来提取语言
  const match = cellText.match(/\|values=([^|]+)\|/);
  const language = match ? match[1].trim() : undefined;

  if (normalized.includes(TEST_RESULT_MARKER)) {
    return { type: 'result', language };
  }

  if (normalized.includes(TEST_EVIDENCE_MARKER) || normalized.includes(TEST_EVIDENCE_ALT_MARKER)) {
    return { type: 'evidence', language };
  }

  return { type: 'normal' };
}

/**
 * 解析表格头部，识别所有列的类型和语言
 */
function parseHeaderColumnTypes(headerRow: Element, maxColumns: number): ColumnInfo[] {
  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  const columnInfos: ColumnInfo[] = [];
  let headerColIndex = 0;

  headerCells.forEach(cell => {
    const colspan = parseInt(cell.getAttribute('colspan') || '1');
    const cellText = cell.textContent || '';
    const columnInfo = determineColumnInfo(cellText);

    // 为每个 colspan 的位置都标记类型
    for (let i = 0; i < colspan; i++) {
      if (headerColIndex + i < maxColumns) {
        columnInfos[headerColIndex + i] = columnInfo;
      }
    }

    headerColIndex += colspan;
  });

  return columnInfos;
}

/**
 * 提取单元格的HTML属性（排除 rowspan 和 colspan）
 */
function extractCellAttributes(cell: Element): Record<string, string> {
  const attributes: Record<string, string> = {};

  Array.from(cell.attributes).forEach(attr => {
    if (attr.name !== 'rowspan' && attr.name !== 'colspan') {
      attributes[attr.name] = attr.value;
    }
  });

  return attributes;
}

/**
 * 创建单元格信息对象
 */
function createCellInfo(
  content: string,
  rowspan: number,
  colspan: number,
  isFirstCell: boolean,
  attributes: Record<string, string>
): CellInfo {
  return {
    value: isFirstCell ? content : '',
    rowspan: isFirstCell ? rowspan : 0,
    colspan: isFirstCell ? colspan : 0,
    isSpanned: !isFirstCell,
    attributes: isFirstCell ? attributes : undefined
  };
}

/**
 * 填充合并单元格占用的所有位置
 */
function fillMergedCellPositions(
  cellMatrix: (CellInfo | null)[][],
  rowIndex: number,
  colIndex: number,
  rowspan: number,
  colspan: number,
  content: string,
  attributes: Record<string, string>,
  maxRows: number,
  maxColumns: number
): void {
  for (let r = 0; r < rowspan; r++) {
    for (let c = 0; c < colspan; c++) {
      const targetRow = rowIndex + r;
      const targetCol = colIndex + c;

      if (targetRow < maxRows && targetCol < maxColumns) {
        const isFirstCell = r === 0 && c === 0;
        cellMatrix[targetRow][targetCol] = createCellInfo(
          content,
          rowspan,
          colspan,
          isFirstCell,
          attributes
        );
      }
    }
  }
}

/**
 * 查找下一个未占用的列索引
 */
function findNextAvailableColumn(
  cellMatrix: (CellInfo | null)[][],
  rowIndex: number,
  startColIndex: number,
  maxColumns: number
): number {
  let colIndex = startColIndex;
  while (colIndex < maxColumns && cellMatrix[rowIndex][colIndex] !== null) {
    colIndex++;
  }
  return colIndex;
}

/**
 * 解析单个 Evidence 单元格的数据
 */
function parseEvidenceCellData(evidenceHtml: string): string[] {
  if (!evidenceHtml.includes('<ac:image')) {
    return [];
  }

  try {
    const evidenceData = parseTestEvidenceFromHtml(evidenceHtml);
    const parsed = JSON.parse(evidenceData);

    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => item.fileName).filter(Boolean);
    }
  } catch (e) {
    console.warn('Failed to parse evidence data:', e);
  }

  return [];
}

/**
 * 收集当前行物理存在的 Evidence 列数据
 */
function collectCurrentRowEvidenceData(
  cells: Element[],
  cellMatrix: (CellInfo | null)[][],
  columnInfos: ColumnInfo[],
  rowIndex: number,
  maxColumns: number
): Map<string, string[]> {
  const evidenceDataByLanguage = new Map<string, string[]>();
  let tempColIndex = 0;

  cells.forEach(cell => {
    tempColIndex = findNextAvailableColumn(cellMatrix, rowIndex, tempColIndex, maxColumns);

    if (tempColIndex < maxColumns) {
      const columnInfo = columnInfos[tempColIndex];

      if (columnInfo.type === 'evidence' && columnInfo.language) {
        const evidenceHtml = cell.innerHTML || '';
        const fileNames = parseEvidenceCellData(evidenceHtml);

        if (fileNames.length > 0) {
          evidenceDataByLanguage.set(columnInfo.language, fileNames);
          console.log(`收集 Evidence 数据，语言: ${columnInfo.language}, 文件数: ${fileNames.length}`);
        }
      }

      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      tempColIndex += colspan;
    }
  });

  return evidenceDataByLanguage;
}

/**
 * 从上一行的 cellMatrix 查找并解析 Evidence 数据
 */
function findEvidenceDataFromPreviousRows(
  cellMatrix: (CellInfo | null)[][],
  logicalColIdx: number,
  rowIndex: number
): string[] {
  for (let lookupRowIdx = rowIndex - 1; lookupRowIdx >= 0; lookupRowIdx--) {
    const lookupCell = cellMatrix[lookupRowIdx][logicalColIdx];

    if (lookupCell && !lookupCell.isSpanned && lookupCell.value) {
      try {
        const parsed = JSON.parse(lookupCell.value);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => item.fileName).filter(Boolean);
        }
      } catch (e) {
        console.warn('Failed to parse inherited evidence data:', e);
      }
      break;
    }
  }

  return [];
}

/**
 * 从上一行继承缺失的 Evidence 数据（处理 rowspan）
 */
function inheritMissingEvidenceData(
  evidenceDataByLanguage: Map<string, string[]>,
  cellMatrix: (CellInfo | null)[][],
  columnInfos: ColumnInfo[],
  rowIndex: number,
  maxColumns: number
): void {
  if (rowIndex === 0) {
    return;
  }

  for (let logicalColIdx = 0; logicalColIdx < maxColumns; logicalColIdx++) {
    const columnInfo = columnInfos[logicalColIdx];

    if (columnInfo.type === 'evidence' && columnInfo.language) {
      if (!evidenceDataByLanguage.has(columnInfo.language)) {
        const fileNames = findEvidenceDataFromPreviousRows(cellMatrix, logicalColIdx, rowIndex);

        if (fileNames.length > 0) {
          evidenceDataByLanguage.set(columnInfo.language, fileNames);
          console.log(`从上一行继承 Evidence 数据，语言: ${columnInfo.language}, 文件数: ${fileNames.length}`);
        }
      }
    }
  }
}

/**
 * 获取当前列对应的 Evidence 文件名列表
 */
function getEvidenceFileNamesForColumn(
  columnInfo: ColumnInfo,
  evidenceDataByLanguage: Map<string, string[]>
): string[] {
  if (columnInfo.type === 'result' && columnInfo.language) {
    return evidenceDataByLanguage.get(columnInfo.language) || [];
  }
  return [];
}

/**
 * 处理单个单元格并填充到矩阵
 */
function processSingleCell(
  cell: Element,
  cellMatrix: (CellInfo | null)[][],
  rowIndex: number,
  colIndex: number,
  columnInfo: ColumnInfo,
  evidenceDataByLanguage: Map<string, string[]>,
  maxRows: number,
  maxColumns: number
): void {
  const isTestResult = columnInfo.type === 'result';
  const isTestEvidence = columnInfo.type === 'evidence';
  const evidenceFileNames = getEvidenceFileNamesForColumn(columnInfo, evidenceDataByLanguage);

  const content = extractCellContent(cell, isTestResult, isTestEvidence, evidenceFileNames);
  const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
  const colspan = parseInt(cell.getAttribute('colspan') || '1');
  const attributes = extractCellAttributes(cell);

  fillMergedCellPositions(
    cellMatrix,
    rowIndex,
    colIndex,
    rowspan,
    colspan,
    content,
    attributes,
    maxRows,
    maxColumns
  );
}

/**
 * 处理单行的所有单元格
 */
function processRowCells(
  row: Element,
  rowIndex: number,
  cellMatrix: (CellInfo | null)[][],
  columnInfos: ColumnInfo[],
  maxColumns: number,
  maxRows: number
): void {
  const cells = Array.from(row.querySelectorAll('th, td'));

  // 第一步：收集当前行的 Evidence 数据
  const evidenceDataByLanguage = collectCurrentRowEvidenceData(
    cells,
    cellMatrix,
    columnInfos,
    rowIndex,
    maxColumns
  );

  // 第二步：从上一行继承缺失的 Evidence 数据
  inheritMissingEvidenceData(
    evidenceDataByLanguage,
    cellMatrix,
    columnInfos,
    rowIndex,
    maxColumns
  );

  // 第三步：处理所有单元格
  let colIndex = 0;

  cells.forEach(cell => {
    colIndex = findNextAvailableColumn(cellMatrix, rowIndex, colIndex, maxColumns);

    if (colIndex < maxColumns) {
      processSingleCell(
        cell,
        cellMatrix,
        rowIndex,
        colIndex,
        columnInfos[colIndex],
        evidenceDataByLanguage,
        maxRows,
        maxColumns
      );

      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      colIndex += colspan;
    }
  });
}

/**
 * 将矩阵转换为结果数组
 */
function convertMatrixToResult(
  cellMatrix: (CellInfo | null)[][],
  maxColumns: number
): CellInfo[][] {
  const result: CellInfo[][] = [];

  cellMatrix.forEach(row => {
    const rowData: CellInfo[] = [];
    for (let col = 0; col < maxColumns; col++) {
      const cellInfo = row[col] ?? { value: '', rowspan: 1, colspan: 1, isSpanned: false };
      rowData.push(cellInfo);
    }
    result.push(rowData);
  });

  return result;
}

/**
 * 解析表格为二维数组（处理 rowspan 和 colspan）
 * 返回包含完整单元格信息的二维数组
 */
function parseTableToMatrix(table: HTMLTableElement): CellInfo[][] {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) {
    return [];
  }

  const maxColumns = calculateMaxColumns(rows);
  const columnInfos = parseHeaderColumnTypes(rows[0], maxColumns);

  console.log('Column infos:', columnInfos);

  const cellMatrix: (CellInfo | null)[][] = rows.map(() => Array(maxColumns).fill(null));

  rows.forEach((row, rowIndex) => {
    processRowCells(row, rowIndex, cellMatrix, columnInfos, maxColumns, rows.length);
  });

  return convertMatrixToResult(cellMatrix, maxColumns);
}

/**
 * 计算表格的最大列数（考虑 colspan）
 */
function calculateMaxColumns(rows: Element[]): number {
  let maxCols = 0;

  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    let colCount = 0;

    cells.forEach(cell => {
      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      colCount += colspan;
    });

    maxCols = Math.max(maxCols, colCount);
  });

  return maxCols;
}

/**
 * 提取单元格内容
 * - 对于Test Result列：解析HTML并转换为JSON格式，使用提供的evidenceFileNames映射Screen编号到实际文件名
 * - 对于Test Evidence列：解析<ac:image>标签并转换为JSON格式
 * - 对于普通列：检查是否有 Failed 标记，如果有则解析，否则返回纯文本
 */
function extractCellContent(
  cell: Element,
  isTestResultColumn: boolean = false,
  isTestEvidenceColumn: boolean = false,
  evidenceFileNames: string[] = []
): string {
  const innerHTML = cell.innerHTML || '';

  // 如果只有 <br /> 标签，返回空字符串
  if (innerHTML.trim() === '<br>' || innerHTML.trim() === '') {
    return '';
  }

  // 检查是否为Test Result列（通过参数判断 + 包含<strong>和<ul>）
  if (isTestResultColumn && innerHTML.includes('<strong') && innerHTML.includes('<ul')) {
    if (evidenceFileNames.length > 0) {
      console.log(`处理 Test Result 列，使用 Evidence fileNames (${evidenceFileNames.length} 个文件):`, evidenceFileNames);
    }
    return parseTestResultFromHtml(innerHTML, evidenceFileNames);
  }

  // 检查是否为Test Evidence列（通过参数判断 + 包含<ac:image>）
  if (isTestEvidenceColumn && innerHTML.includes('<ac:image')) {
    return parseTestEvidenceFromHtml(innerHTML);
  }

  // 普通列：检查是否有 Failed 标记（Copy 列可能包含 Failed marker）
  if (innerHTML.includes('<strong') && innerHTML.includes('<ul')) {
    const failedParsed = parseFailedMarkerFromHtml(innerHTML);
    if (failedParsed) {
      console.log('检测到 Failed 标记，已解析:', failedParsed);
      return failedParsed;
    }
  }

  // 普通列：获取纯文本内容（不包含图片等元素）
  // 移除所有图片标签和其他媒体元素，只保留文本
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = innerHTML;

  // 移除图片标签
  tempDiv.querySelectorAll('ac\\:image, image, img').forEach(el => el.remove());

  // 获取纯文本
  let text = tempDiv.textContent?.trim() || '';
  return text;
}

/**
 * 将 Confluence Storage HTML 格式的 Test Result 转换为 JSON 数组
 *
 * <strong style="color: green;">Passed</strong><br/>
 * <ul>
 *   <li>Screen 01</li>
 *   <li>Screen 02</li>
 * </ul>
 * <strong style="color: red;">Failed</strong><br/>
 * <ul>
 *   <li>
 *     <span>Screen 03</span>
 *     <p>Found 2 discrepancies</p>
 *     <ul>
 *       <li>Mismatch 01
 *         <p>Expected</p>
 *         <p><strong>text1</strong></p>
 *         <p>Found</p>
 *         <p><strong>text2</strong></p>
 *       </li>
 *     </ul>
 *   </li>
 * </ul>
 *
 * @param htmlString Test Result 列的 HTML 字符串
 * @param evidenceFileNames Test Evidence 列的文件名数组（可选）
 * 输出格式（JSON字符串）：
 * "[{\"fileName\":\"image1.png\",\"passed\":true},{\"fileName\":\"image2.png\",\"passed\":true},{\"fileName\":\"image3.png\",\"passed\":false,\"discrepancies\":[{\"expected\":\"text1\",\"found\":\"text2\"}]}]"
 */
function parseTestResultFromHtml(htmlString: string, evidenceFileNames: string[] = []): string {
  try {
    console.log('=== parseTestResultFromHtml 开始解析 ===');
    console.log('输入的完整 HTML:', htmlString);
    console.log('Evidence 文件名列表:', evidenceFileNames);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    console.log('解析后的 body.innerHTML:', doc.body.innerHTML);

    const resultArray: Array<{
      fileName: string;
      passed: boolean;
      discrepancies?: Array<{ expected: string; found: string }>;
    }> = [];

    // 查找所有 <strong> 元素（Passed 和 Failed 标题）
    const strongElements = Array.from(doc.querySelectorAll('strong'));
    console.log('找到的 <strong> 元素数量:', strongElements.length);

    strongElements.forEach((strong, index) => {
      const text = strong.textContent?.trim().toLowerCase() || '';
      const outerHTML = strong.outerHTML;
      console.log(`Strong ${index}: text="${text}", outerHTML="${outerHTML}"`);

      // 判断是 Passed 还是 Failed
      if (text !== 'passed' && text !== 'failed') {
        console.log(`  跳过（不是 passed/failed）`);
        return; // 跳过不相关的 strong 元素
      }

      const isPassed = text === 'passed';
      console.log(`处理 ${isPassed ? 'Passed' : 'Failed'} 区块`);

      // 查找该 strong 元素后面的第一个 <ul> 元素
      let currentElement: Element | null = strong.nextElementSibling;
      let foundUl: Element | null = null;
      let searchSteps = 0;

      while (currentElement && searchSteps < 10) {
        const tagName = currentElement.tagName.toLowerCase();
        console.log(`  查找 <ul>，当前元素: <${tagName}>`);

        if (tagName === 'ul') {
          foundUl = currentElement;
          console.log(`  ✓ 找到 <ul>！`);
          break;
        }

        // 如果遇到下一个 strong，停止查找
        if (tagName === 'strong') {
          console.log(`  × 遇到下一个 <strong>，停止查找`);
          break;
        }

        currentElement = currentElement.nextElementSibling;
        searchSteps++;
      }

      if (!foundUl) {
        console.log(`${isPassed ? 'Passed' : 'Failed'} 区块没有找到对应的 <ul>，跳过`);
        return;
      }

      // 获取该 <ul> 的所有直接子 <li> 元素
      const listItems = Array.from(foundUl.children).filter(child => child.tagName.toLowerCase() === 'li');
      console.log(`找到 ${listItems.length} 个 <li> 元素`);

      listItems.forEach((li, liIndex) => {
        // 从 <li> 的文本内容中提取 Screen 编号
        const liText = li.textContent?.trim() || '';
        const screenMatch = liText.match(/Screen\s*(\d+)/i);

        let fileName: string;
        if (screenMatch) {
          // 提取到了 Screen 编号（从 1 开始）
          const screenIndex = parseInt(screenMatch[1]) - 1; // 转换为数组索引（从 0 开始）

          // 如果有 evidenceFileNames 且索引有效，使用真实文件名
          if (evidenceFileNames.length > 0 && screenIndex >= 0 && screenIndex < evidenceFileNames.length) {
            fileName = evidenceFileNames[screenIndex];
            console.log(`  Screen ${screenMatch[1]} → fileName: ${fileName}`);
          } else {
            // 否则使用 Screen 编号生成文件名
            const screenNumber = String(screenIndex + 1).padStart(2, '0');
            fileName = `Screen${screenNumber}.png`;
            console.log(`  未找到对应的 Evidence 文件名，使用默认: ${fileName}`);
          }
        } else {
          // 如果没有匹配到 Screen 编号，使用顺序编号
          const screenNumber = String(resultArray.length + 1).padStart(2, '0');
          fileName = `Screen${screenNumber}.png`;
          console.log(`  未找到 Screen 编号，使用默认: ${fileName}`);
        }

        const resultItem: any = {
          fileName: fileName,
          passed: isPassed
        };

        console.log(`  添加项: ${fileName}, passed=${isPassed}`);

        // 检查是否有内嵌的 <ul>（表示有 discrepancies）
        const innerUl = li.querySelector('ul');
        if (innerUl && !isPassed) {
          // 解析 discrepancies
          const discrepancies: Array<{ expected: string; found: string }> = [];
          const mismatchItems = Array.from(innerUl.children).filter(child => child.tagName.toLowerCase() === 'li');

          mismatchItems.forEach((mismatchLi) => {
            // 查找所有 <p> 标签
            const paragraphs = Array.from(mismatchLi.querySelectorAll('p'));

            let expected = '';
            let found = '';

            // 遍历 <p> 标签，寻找 Expected 和 Found
            for (let i = 0; i < paragraphs.length; i++) {
              const p = paragraphs[i];
              const text = p.textContent?.trim().toLowerCase() || '';

              if (text === 'expected' && i + 1 < paragraphs.length) {
                // 下一个 <p> 包含 expected 值
                const nextP = paragraphs[i + 1];
                const strong = nextP.querySelector('strong');
                expected = strong?.textContent?.trim() || '';
              } else if (text === 'found' && i + 1 < paragraphs.length) {
                // 下一个 <p> 包含 found 值
                const nextP = paragraphs[i + 1];
                const strong = nextP.querySelector('strong');
                found = strong?.textContent?.trim() || '';
              }
            }

            if (expected || found) {
              discrepancies.push({ expected, found });
            }
          });

          if (discrepancies.length > 0) {
            resultItem.discrepancies = discrepancies;
            console.log(`    发现 ${discrepancies.length} 个 discrepancies`);
          }
        }

        resultArray.push(resultItem);
      });
    });

    console.log('=== 解析完成，结果数组 ===');
    console.log(JSON.stringify(resultArray, null, 2));

    return JSON.stringify(resultArray);
  } catch (error) {
    console.error('解析 Test Result HTML 失败:', error);
    return '[]';
  }
}

/**
 * 将 Confluence Storage HTML 格式的 Test Evidence 转换为 JSON 数组
 *
 * 输入格式（HTML）：
 * <ac:image ac:width="100" ac:height="200">
 *   <ri:attachment ri:filename="image1.png"></ri:attachment>
 * </ac:image>
 * <br/>
 * <ac:image ac:width="100" ac:height="200">
 *   <ri:attachment ri:filename="image2.png"></ri:attachment>
 * </ac:image>
 *
 * 输出格式（JSON字符串）：
 * "[{\"fileName\":\"image1.png\",\"base64\":\"\"},{\"fileName\":\"image2.png\",\"base64\":\"\"}]"
 */
function parseTestEvidenceFromHtml(htmlString: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 查找所有 <ac:image> 标签
    const images = doc.querySelectorAll('ac\\:image, image');

    if (images.length === 0) {
      return '[]';
    }

    const evidenceArray: Array<{
      fileName: string;
      base64: string;
    }> = [];

    images.forEach((img) => {
      // 查找 ri:attachment 子元素
      const attachment = img.querySelector('ri\\:attachment, attachment');
      if (attachment) {
        const fileName = attachment.getAttribute('ri:filename') || attachment.getAttribute('filename');
        if (fileName) {
          evidenceArray.push({
            fileName: fileName,
            base64: '' // 初始为空，后续会通过API填充
          });
        }
      }
    });

    return JSON.stringify(evidenceArray);
  } catch (error) {
    console.error('解析 Test Evidence HTML 失败:', error);
    return '[]';
  }
}

/**
 * 规范化字符串（移除空格、中英文标点、转小写）
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s\-_/]/g, '') // 移除空格、横杠、下划线、斜杠
    .replace(/[，。、：；！？（）【】]/g, ''); // 移除中文标点
}

/**
 * 查找 "Screen name/Snagit ID" 列的索引
 */
function findScreenNameColumnIndex(headerRow: CellInfo[]): number {
  const target = normalizeString('Screen name/Snagit ID');

  return headerRow.findIndex(cell => {
    const normalized = normalizeString(cell.value);
    return normalized === target ||
           normalized === normalizeString('screenname') ||
           normalized === normalizeString('snagitid');
  });
}

/**
 * 查找所有包含 |values=xxx| 的列索引（排除 Test Result 和 Test Evidence）
 */
function findValuesColumnIndexes(headerRow: CellInfo[]): number[] {
  const indexes: number[] = [];

  headerRow.forEach((cell, index) => {
    if (cell.value.includes('|values=')) {
      const normalized = cell.value.toLowerCase().replace(/\s+/g, '');
      if (!normalized.includes('testresult') &&
          !normalized.includes('testevidence')) {
        indexes.push(index);
      }
    }
  });

  return indexes;
}

/**
 * 检查一行是否是分组起始行
 * 条件：Screen name 列有值 且 所有 |values=xxx| 列为空
 */
function isGroupStartRow(row: CellInfo[], screenNameIndex: number, valuesIndexes: number[]): boolean {
  if (screenNameIndex === -1) {
    return false;
  }

  // Screen name 列必须有值
  const screenNameHasValue = row[screenNameIndex].value.trim() !== '';
  if (!screenNameHasValue) {
    return false;
  }

  // 所有 |values=xxx| 列必须为空
  const allValuesEmpty = valuesIndexes.every(idx => row[idx].value.trim() === '');

  return allValuesEmpty;
}

/**
 * 查找所有分组区间
 * 规则：分组起始行本身不包含在分组中，从起始行的下一行开始到下一个起始行之前
 * @returns 分组区间数组，每个元素是 [startIndex, endIndex]
 */
function findGroups(dataRows: CellInfo[][], screenNameIndex: number, valuesIndexes: number[]): Array<[number, number]> {
  const groups: Array<[number, number]> = [];

  // 找到所有起始行的索引
  const startRowIndexes: number[] = [];
  dataRows.forEach((row, index) => {
    if (isGroupStartRow(row, screenNameIndex, valuesIndexes)) {
      startRowIndexes.push(index);
    }
  });

  if (startRowIndexes.length === 0) {
    return groups;
  }

  // 为每个起始行创建分组（从起始行的下一行开始）
  startRowIndexes.forEach((startIdx, i) => {
    const groupStart = startIdx + 1; // 从起始行的下一行开始

    // 确定分组结束位置
    let groupEnd: number;
    if (i < startRowIndexes.length - 1) {
      // 不是最后一个起始行，结束于下一个起始行之前
      groupEnd = startRowIndexes[i + 1] - 1;
    } else {
      // 最后一个起始行，结束于表格末尾
      groupEnd = dataRows.length - 1;
    }

    // 只有当分组包含至少一行时才添加
    if (groupStart <= groupEnd) {
      groups.push([groupStart, groupEnd]);
    }
  });

  return groups;
}

/**
 * 添加自定义列（COPYDECK_CUSTOM_ID、Test Result、Test Evidence）
 */
function addCustomColumns(matrix: CellInfo[][]): CellInfo[][] {
  if (matrix.length === 0) {
    return matrix;
  }

  const [headerRow, ...dataRows] = matrix;

  // 1. 提取所有语言代码（排除 Test Result 和 Test Evidence）
  const languages: string[] = [];
  headerRow.forEach(cell => {
    const match = cell.value.match(/\|values=([^|]+)\|/);
    if (match) {
      const language = match[1].trim();
      const normalized = cell.value.toLowerCase().replace(/\s+/g, '');

      // 排除 Test Result 和 Test Evidence
      if (!normalized.includes(TEST_RESULT_KEYWORD) &&
          !normalized.includes(TEST_EVIDENCE_KEYWORD)) {
        if (!languages.includes(language)) {
          languages.push(language);
        }
      }
    }
  });

  // 2. 检查每个语言是否已有 Test Result 和 Test Evidence 列
  const columnsToAdd: Array<{ language: string; type: 'result' | 'evidence' }> = [];

  languages.forEach(language => {
    // 检查是否已有 Test Result 列
    const hasResultColumn = headerRow.some(cell => {
      const normalized = cell.value.toLowerCase().replace(/\s+/g, '');
      return normalized.includes(`${TEST_RESULT_MARKER}${language.toLowerCase()}|`);
    });

    if (!hasResultColumn) {
      columnsToAdd.push({ language, type: 'result' });
    }

    // 检查是否已有 Test Evidence 列
    const hasEvidenceColumn = headerRow.some(cell => {
      const normalized = cell.value.toLowerCase().replace(/\s+/g, '');
      return normalized.includes(`${TEST_EVIDENCE_MARKER}${language.toLowerCase()}|`) ||
             normalized.includes(`${TEST_EVIDENCE_ALT_MARKER}${language.toLowerCase()}|`);
    });

    if (!hasEvidenceColumn) {
      columnsToAdd.push({ language, type: 'evidence' });
    }
  });

  // 3. 添加列到矩阵
  const newMatrix: CellInfo[][] = [];

  // 处理 header 行
  const newHeaderRow: CellInfo[] = [
    { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
    ...headerRow
  ];

  // 检查是否存在 Screen name 列（在原始 header 中检查）
  const hasScreenNameColumn = findScreenNameColumnIndex(headerRow) !== -1;

  if (hasScreenNameColumn) {
    // 在 COPYDECK_CUSTOM_ID 之后插入 COPYDECK_CUSTOM_GROUP
    newHeaderRow.splice(1, 0, {
      value: 'COPYDECK_CUSTOM_GROUP',
      rowspan: 1,
      colspan: 1,
      isSpanned: false
    });
  }

  // 添加缺失的 Test Result 和 Test Evidence 列
  columnsToAdd.forEach(({ language, type }) => {
    const columnName = type === 'result'
      ? `Test Result|values=${language}|`
      : `Test Evidence|values=${language}|`;

    newHeaderRow.push({
      value: columnName,
      rowspan: 1,
      colspan: 1,
      isSpanned: false
    });
  });

  newMatrix.push(newHeaderRow);

  // 处理数据行
  dataRows.forEach((row, index) => {
    const newRow: CellInfo[] = [
      { value: String(index), rowspan: 1, colspan: 1, isSpanned: false }, // COPYDECK_CUSTOM_ID 从 0 开始
    ];

    // 如果有 Screen name 列，添加 COPYDECK_CUSTOM_GROUP 列（初始为空）
    if (hasScreenNameColumn) {
      newRow.push({
        value: '',
        rowspan: 1,
        colspan: 1,
        isSpanned: false
      });
    }

    // 添加原始数据列
    newRow.push(...row);

    // 为新添加的 Test Result 和 Test Evidence 列添加空单元格
    columnsToAdd.forEach(() => {
      newRow.push({
        value: '',
        rowspan: 1,
        colspan: 1,
        isSpanned: false
      });
    });

    newMatrix.push(newRow);
  });

  // 4. 处理 Test Evidence 列的合并（如果存在 Screen name 列）
  mergeTestEvidenceByGroups(newMatrix, newHeaderRow, languages);

  return newMatrix;
}

/**
 * 根据分组合并 Test Evidence 列，并填充 COPYDECK_CUSTOM_GROUP
 */
function mergeTestEvidenceByGroups(
  matrix: CellInfo[][],
  headerRow: CellInfo[],
  languages: string[]
): void {
  if (matrix.length <= 1) {
    return;
  }

  const [, ...dataRows] = matrix;

  // 查找 Screen name 列索引
  const screenNameIndex = findScreenNameColumnIndex(headerRow);
  if (screenNameIndex === -1) {
    return; // 没有 Screen name 列，不需要合并
  }

  // 查找 COPYDECK_CUSTOM_GROUP 列索引
  const customGroupIndex = headerRow.findIndex(cell =>
    cell.value === 'COPYDECK_CUSTOM_GROUP'
  );

  // 查找所有 |values=xxx| 列的索引
  const valuesIndexes = findValuesColumnIndexes(headerRow);

  // 查找所有分组区间
  const groups = findGroups(dataRows, screenNameIndex, valuesIndexes);

  if (groups.length === 0) {
    return;
  }

  // 查找所有 Test Evidence 列的索引
  const evidenceColumnIndexes: number[] = [];
  languages.forEach(language => {
    const index = headerRow.findIndex(cell => {
      const normalized = cell.value.toLowerCase().replace(/\s+/g, '');
      return normalized.includes(`${TEST_EVIDENCE_MARKER}${language.toLowerCase()}|`) ||
             normalized.includes(`${TEST_EVIDENCE_ALT_MARKER}${language.toLowerCase()}|`);
    });
    if (index !== -1) {
      evidenceColumnIndexes.push(index);
    }
  });

  // 对每个分组进行处理
  groups.forEach(([start, end]) => {
    const groupLength = end - start + 1;

    // 获取起始行（分组的上一行）的 Screen name 值
    const startRowIndex = start - 1; // 起始行在分组的前一行
    const screenNameValue = startRowIndex >= 0
      ? dataRows[startRowIndex][screenNameIndex]?.value || ''
      : '';

    // 1. 填充 COPYDECK_CUSTOM_GROUP 列
    if (customGroupIndex !== -1 && screenNameValue) {
      for (let i = start; i <= end; i++) {
        matrix[i + 1][customGroupIndex] = {
          ...matrix[i + 1][customGroupIndex],
          value: screenNameValue
        };
      }
    }

    // 2. 合并 Test Evidence 列
    evidenceColumnIndexes.forEach(colIndex => {
      // 第一行：设置 rowspan
      matrix[start + 1][colIndex] = {
        ...matrix[start + 1][colIndex],
        rowspan: groupLength,
        isSpanned: false
      };

      // 其他行：设置为 isSpanned（从 start + 1 开始，不包括第一行）
      for (let i = start + 1; i <= end; i++) {
        matrix[i + 1][colIndex] = {
          ...matrix[i + 1][colIndex],
          rowspan: 0,
          isSpanned: true
        };
      }
    });
  });
}

/**
 * 解析 Confluence Storage HTML 为二维数组（添加编辑所需的列）
 */
export function parseConfluenceStorageToTable(
  storageHtml: string,
  tableName: string
): CellInfo[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(storageHtml, 'text/html');

  // 查找所有符合条件的表格
  const tables = Array.from(doc.querySelectorAll('table'));

  for (const table of tables) {
    if (!hasValuesMarker(table)) {
      continue;
    }

    const title = findTableTitle(table);
    if (title === tableName) {
      const matrix = parseTableToMatrix(table);

      if (matrix.length === 0) {
        return [];
      }

      // 添加自定义列
      return addCustomColumns(matrix);
    }
  }

  console.error(`未找到表格: ${tableName}`);
  return [];
}

/**
 * 提取表格中实际存在的所有列名（规范化为小写无空格）
 */
export function extractExistingColumns(storageHtml: string, tableName: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(storageHtml, 'text/html');

  const tables = Array.from(doc.querySelectorAll('table'));

  for (const table of tables) {
    if (!hasValuesMarker(table)) {
      continue;
    }

    const title = findTableTitle(table);
    if (title !== tableName) {
      continue;
    }

    const headerRow = table.querySelector('tr');
    if (!headerRow) {
      return [];
    }

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));

    // 返回规范化的列名（小写、去空格）
    return headerCells.map(cell => {
      const text = cell.textContent || '';
      return text.trim().toLowerCase().replace(/\s+/g, '');
    });
  }

  return [];
}

/**
 * 过滤 renderTableData，只保留 Confluence 中实际存在的列
 */
export function filterTableDataByExistingColumns(
  tableData: CellInfo[][],
  existingColumns: string[]
): CellInfo[][] {
  if (tableData.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = tableData;

  // 规范化 existingColumns 为 Set（已经是小写无空格）
  const existingColumnsSet = new Set(existingColumns);

  // 找出要保留的列索引
  const columnsToKeep: number[] = [];

  headerRow.forEach((cell, index) => {
    const columnValue = cell.value;

    // 保留 COPYDECK_CUSTOM_ID 和 COPYDECK_CUSTOM_GROUP 列
    if (columnValue === 'COPYDECK_CUSTOM_ID' || columnValue === 'COPYDECK_CUSTOM_GROUP') {
      columnsToKeep.push(index);
      return;
    }

    // 检查该列是否在 Confluence 中实际存在
    const normalized = columnValue.trim().toLowerCase().replace(/\s+/g, '');

    // 只使用完全匹配，避免误匹配（例如 "testresult|values=hk_en|" 包含 "en|values=hk_en|"）
    if (existingColumnsSet.has(normalized)) {
      columnsToKeep.push(index);
    }
  });

  console.log('=== filterTableDataByExistingColumns ===');
  console.log('existingColumns:', existingColumns);
  console.log('columnsToKeep:', columnsToKeep);
  console.log('保留的列名:', columnsToKeep.map(i => headerRow[i].value));

  // 过滤所有行，只保留选定的列
  const filteredData: CellInfo[][] = [];

  // 过滤 header 行
  filteredData.push(columnsToKeep.map(i => headerRow[i]));

  // 过滤数据行
  dataRows.forEach(row => {
    filteredData.push(columnsToKeep.map(i => row[i]));
  });

  return filteredData;
}

/**
 * 提取表格中包含 |values=xxx| 的语言代码
 */
export function extractLanguageCodes(storageHtml: string, tableName: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(storageHtml, 'text/html');

  const tables = Array.from(doc.querySelectorAll('table'));

  for (const table of tables) {
    if (!hasValuesMarker(table)) {
      continue;
    }

    const title = findTableTitle(table);
    if (title !== tableName) {
      continue;
    }

    const languages: string[] = [];
    const headerRow = table.querySelector('tr');
    if (!headerRow) {
      return [];
    }

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));

    headerCells.forEach(cell => {
      const text = cell.textContent || '';
      // 匹配 |values=xxx| 格式
      const match = text.match(/\|values=([^|]+)\|/);
      if (match) {
        const language = match[1].trim();
        if (!languages.includes(language)) {
          languages.push(language);
        }
      }
    });

    return languages;
  }

  return [];
}

/**
 * 从表格前面的元素中查找标题（只查找同级兄弟元素）
 */
function findTableTitleFromSiblings(table: Element): string {
  let current = table.previousElementSibling;

  while (current) {
    const tagName = current.tagName?.toLowerCase();
    if (['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      const text = current.textContent?.trim() || '';
      if (text !== '') {
        return text;
      }
    }
    current = current.previousElementSibling;
  }

  return '';
}

/**
 * 更新语言Map中的列信息
 */
function updateLanguageMapEntry(
  languageMap: Map<string, { hasResult: boolean; hasEvidence: boolean }>,
  language: string,
  isResult: boolean,
  isEvidence: boolean
): void {
  if (!languageMap.has(language)) {
    languageMap.set(language, { hasResult: false, hasEvidence: false });
  }

  const entry = languageMap.get(language)!;
  if (isResult) {
    entry.hasResult = true;
  }
  if (isEvidence) {
    entry.hasEvidence = true;
  }
}

/**
 * 处理单个表头单元格，提取语言信息
 */
function processHeaderCellForLanguage(
  cell: Element,
  languageMap: Map<string, { hasResult: boolean; hasEvidence: boolean }>
): void {
  const text = cell.textContent || '';
  const normalized = text.toLowerCase().replace(/\s+/g, '');

  // 匹配 |values=xxx| 格式
  const match = text.match(/\|values=([^|]+)\|/);
  if (!match) {
    return;
  }

  const language = match[1].trim();
  const isResult = normalized.includes(TEST_RESULT_MARKER);
  const isEvidence = normalized.includes(TEST_EVIDENCE_MARKER) ||
                     normalized.includes(TEST_EVIDENCE_ALT_MARKER);

  if (isResult || isEvidence) {
    updateLanguageMapEntry(languageMap, language, isResult, isEvidence);
  }
}

/**
 * 解析表格头部，提取语言列信息
 */
function parseLanguageColumnsFromHeader(
  headerRow: Element
): Map<string, { hasResult: boolean; hasEvidence: boolean }> {
  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  const languageMap = new Map<string, { hasResult: boolean; hasEvidence: boolean }>();

  headerCells.forEach(cell => {
    processHeaderCellForLanguage(cell, languageMap);
  });

  return languageMap;
}

/**
 * 提取 Confluence 中原本存在的 Test Result 和 Test Evidence 列的语言信息
 */
export function extractOriginalTestColumns(storageHtml: string, tableName: string): Array<{
  language: string;
  hasResult: boolean;
  hasEvidence: boolean;
}> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(storageHtml, 'text/html');

  const tables = Array.from(doc.querySelectorAll('table'));

  for (const table of tables) {
    if (!hasValuesMarker(table)) {
      continue;
    }

    const title = findTableTitleFromSiblings(table);
    if (title !== tableName) {
      continue;
    }

    const headerRow = table.querySelector('tr');
    if (!headerRow) {
      return [];
    }

    const languageMap = parseLanguageColumnsFromHeader(headerRow);

    // 转换为数组返回
    return Array.from(languageMap.entries()).map(([language, info]) => ({
      language,
      hasResult: info.hasResult,
      hasEvidence: info.hasEvidence
    }));
  }

  return [];
}

// ==================== Confluence Storage Export Utilities ====================

/**
 * 修复 HTML 中的空元素标签为 Confluence Storage Format 要求的自闭合格式
 * Confluence 要求所有空元素（void elements）必须使用自闭合标签
 */
export function fixVoidElements(html: string): string {
  // Confluence Storage Format 中常见的需要自闭合的空元素
  const voidElements = ['br', 'col', 'hr', 'img', 'input', 'link', 'meta', 'area', 'base', 'embed', 'param', 'source', 'track', 'wbr'];

  let fixedHtml = html;

  voidElements.forEach(tag => {
    // 1. 先替换 <tag ...></tag> 形式（包括中间有空格或换行的情况）
    const openClosePattern = new RegExp(`<${tag}([^>]*)>\\s*<\\/${tag}\\s*>`, 'gi');
    fixedHtml = fixedHtml.replace(openClosePattern, `<${tag}$1/>`);

    // 2. 替换单独的 <tag> 或 <tag ...> 为自闭合标签（确保不重复处理已经是自闭合的）
    // 匹配: <tag> 或 <tag attr="value"> 但不匹配 <tag ... />
    const openOnlyPattern = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
    fixedHtml = fixedHtml.replace(openOnlyPattern, (match) => {
      // 如果已经是自闭合的（以 /> 结尾），直接返回
      if (match.endsWith('/>')) {
        return match;
      }
      // 否则，将 > 替换为 />
      return match.slice(0, -1) + '/>';
    });

    // 3. 删除任何剩余的闭合标签 </tag>
    const closePattern = new RegExp(`<\\/${tag}\\s*>`, 'gi');
    fixedHtml = fixedHtml.replace(closePattern, '');
  });

  return fixedHtml;
}

/**
 * 判断列是否为 Test Result 列
 */
export function isTestResultColumn(headerValue: string): boolean {
  const normalized = headerValue.toLowerCase().replace(/\s+/g, '');
  return normalized.includes(TEST_RESULT_MARKER);
}

/**
 * 判断列是否为 Test Evidence 列
 */
export function isTestEvidenceColumn(headerValue: string): boolean {
  const normalized = headerValue.toLowerCase().replace(/\s+/g, '');
  return normalized.includes(TEST_EVIDENCE_MARKER) || normalized.includes(TEST_EVIDENCE_ALT_MARKER);
}

/**
 * 从列标题中提取语言代码
 */
export function extractLanguageFromHeader(headerValue: string): string | null {
  const match = headerValue.match(/\|values=([^|]+)\|/);
  return match ? match[1] : null;
}

/**
 * 将 Test Result JSON 数组转换为 Confluence Storage HTML 格式
 */
export function formatTestResultToHtml(jsonStr: string, doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();

  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length === 0) {
      fragment.appendChild(doc.createElement('br'));
      return fragment;
    }

    // 根据 passed 状态分组
    const passedItems: any[] = [];
    const failedItems: any[] = [];

    data.forEach((item: any) => {
      if (item.fileName) {
        if (item.passed === true) {
          passedItems.push(item);
        } else if (item.passed === false) {
          failedItems.push(item);
        }
      }
    });

    // 辅助函数：渲染列表项
    const renderItems = (items: any[], parentUl: HTMLUListElement) => {
      items.forEach((item) => {
        const li = doc.createElement('li');

        // 根据 fileName 在完整 data 数组中的索引来计算 Screen 编号
        const actualIndex = data.findIndex((d: any) => d.fileName === item.fileName);
        const screenNumber = actualIndex !== -1
          ? String(actualIndex + 1).padStart(2, '0')
          : '00';

        // 检查是否有 discrepancies
        if (item.discrepancies && Array.isArray(item.discrepancies) && item.discrepancies.length > 0) {
          // 有 discrepancies，创建详细格式
          const span = doc.createElement('span');
          span.textContent = `Screen ${screenNumber}`;
          li.appendChild(span);

          // 添加 "Found X discrepancies" 段落
          const discrepancyCount = item.discrepancies.length;
          const countP = doc.createElement('p');
          countP.textContent = `Found ${discrepancyCount} discrepanc${discrepancyCount > 1 ? 'ies' : 'y'}`;
          li.appendChild(countP);

          // 创建内层 <ul> 显示每个 mismatch
          const innerUl = doc.createElement('ul');

          item.discrepancies.forEach((disc: any, discIndex: number) => {
            const discLi = doc.createElement('li');
            discLi.textContent = `Mismatch ${String(discIndex + 1).padStart(2, '0')}`;

            // Expected
            const expectedLabel = doc.createElement('p');
            expectedLabel.textContent = 'Expected';
            discLi.appendChild(expectedLabel);

            const expectedValue = doc.createElement('p');
            const expectedStrong = doc.createElement('strong');
            expectedStrong.textContent = disc.expected || '';
            expectedValue.appendChild(expectedStrong);
            discLi.appendChild(expectedValue);

            // Found
            const foundLabel = doc.createElement('p');
            foundLabel.textContent = 'Found';
            discLi.appendChild(foundLabel);

            const foundValue = doc.createElement('p');
            const foundStrong = doc.createElement('strong');
            foundStrong.textContent = disc.found || '';
            foundValue.appendChild(foundStrong);
            discLi.appendChild(foundValue);

            innerUl.appendChild(discLi);
          });

          li.appendChild(innerUl);
        } else {
          // 没有 discrepancies，简单格式
          li.textContent = `Screen ${screenNumber}`;
        }

        parentUl.appendChild(li);
      });
    };

    // 渲染 Passed 区块
    if (passedItems.length > 0) {
      // Passed 标题 (绿色)
      const passedStrong = doc.createElement('strong');
      passedStrong.textContent = 'Passed';
      passedStrong.setAttribute('style', 'color: green;');
      fragment.appendChild(passedStrong);

      // 换行
      fragment.appendChild(doc.createElement('br'));

      // Passed 列表
      const passedUl = doc.createElement('ul');
      renderItems(passedItems, passedUl);
      fragment.appendChild(passedUl);
    }

    // 渲染 Failed 区块
    if (failedItems.length > 0) {
      // Failed 标题 (红色)
      const failedStrong = doc.createElement('strong');
      failedStrong.textContent = 'Failed';
      failedStrong.setAttribute('style', 'color: red;');
      fragment.appendChild(failedStrong);

      // 换行
      fragment.appendChild(doc.createElement('br'));

      // Failed 列表
      const failedUl = doc.createElement('ul');
      renderItems(failedItems, failedUl);
      fragment.appendChild(failedUl);
    }
  } catch {
    // 如果解析失败，直接使用原始文本
    fragment.appendChild(doc.createTextNode(jsonStr));
  }

  return fragment;
}

/**
 * 解析 Test Evidence JSON 并生成 Confluence 图片格式
 */
export function formatTestEvidence(jsonStr: string, doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();

  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length === 0) {
      fragment.appendChild(doc.createElement('br'));
      return fragment;
    }

    // 为每个图片创建 <ac:image> 标签
    data.forEach((item: any, index: number) => {
      if (!item.fileName) {
        return;
      }

      // 创建 "Screen 0x" 粗体文本
      const screenNumber = String(index + 1).padStart(2, '0');
      const strong = doc.createElement('strong');
      strong.textContent = `Screen ${screenNumber}`;
      fragment.appendChild(strong);

      // 添加换行
      fragment.appendChild(doc.createElement('br'));

      // 创建 <ac:image> 标签，并设置宽高
      const acImage = doc.createElement('ac:image');
      acImage.setAttribute('ac:width', '100');
      acImage.setAttribute('ac:height', '200');

      // 创建 <ri:attachment> 标签
      const riAttachment = doc.createElement('ri:attachment');
      riAttachment.setAttribute('ri:filename', item.fileName);

      acImage.appendChild(riAttachment);
      fragment.appendChild(acImage);

      // 如果不是最后一个，添加换行
      if (index < data.length - 1) {
        fragment.appendChild(doc.createElement('br'));
      }
    });
  } catch {
    // 如果解析失败，直接使用原始文本
    fragment.appendChild(doc.createTextNode(jsonStr));
  }

  return fragment;
}

/**
 * 替换 Storage HTML 中指定索引的表格
 */
export function replaceTableInStorage(fullStorageHtml: string, tableIndex: number, newTableHtml: string): string {
  console.log(`=== replaceTableInStorage 被调用 ===`);
  console.log(`tableIndex: ${tableIndex}`);
  console.log(`newTableHtml (前200字符):`, newTableHtml.substring(0, 200));
  console.log(`fullStorageHtml 原始长度:`, fullStorageHtml.length);

  const parser = new DOMParser();
  const doc = parser.parseFromString(fullStorageHtml, 'text/html');

  // 查找所有表格
  const tables = Array.from(doc.querySelectorAll('table'));

  console.log(`Total tables in fullStorageHtml: ${tables.length}`);

  if (tableIndex < 0 || tableIndex >= tables.length) {
    throw new Error(`Invalid table index: ${tableIndex}, total tables: ${tables.length}`);
  }

  const targetTable = tables[tableIndex];
  console.log(`将要替换的表格索引: ${tableIndex}`);

  // 解析新表格
  const newTableDoc = parser.parseFromString(newTableHtml, 'text/html');
  const newTable = newTableDoc.querySelector('table');

  if (!newTable) {
    throw new Error('Invalid new table HTML');
  }

  // 替换表格
  targetTable.replaceWith(newTable);

  // 序列化回 HTML
  let updatedStorageHtml = doc.body.innerHTML;

  // 修复 void elements
  updatedStorageHtml = fixVoidElements(updatedStorageHtml);

  console.log(`替换完成，新 HTML 长度: ${updatedStorageHtml.length} (原始: ${fullStorageHtml.length})`);

  return updatedStorageHtml;
}

/**
 * 获取所有符合条件的表格数量（必须包含 |values=xxx| 标记）
 */
export function getValidTablesCount(storageHtml: string): number {
  const tables = parseConfluenceTables(storageHtml);
  return tables.length;
}

/**
 * 根据索引获取表格信息（只计算包含 |values=xxx| 的表格）
 * @param tableIndex 有效表格的索引（从0开始，只计算包含 |values=xxx| 的表格）
 */
export function getTableByValidIndex(storageHtml: string, tableIndex: number): TableInfo | null {
  const tables = parseConfluenceTables(storageHtml);

  if (tableIndex < 0 || tableIndex >= tables.length) {
    return null;
  }

  return tables[tableIndex];
}

/**
 * 根据有效索引解析表格为二维数组（只计算包含 |values=xxx| 的表格）
 * @param tableIndex 有效表格的索引（从0开始，只计算包含 |values=xxx| 的表格）
 */
export function parseTableByValidIndex(
  storageHtml: string,
  tableIndex: number
): CellInfo[][] {
  const tableInfo = getTableByValidIndex(storageHtml, tableIndex);

  if (!tableInfo) {
    console.error(`Invalid table index: ${tableIndex}`);
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(tableInfo.tableStr, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    return [];
  }

  const matrix = parseTableToMatrix(table);

  if (matrix.length === 0) {
    return [];
  }

  // 添加自定义列
  return addCustomColumns(matrix);
}

/**
 * 根据有效索引提取语言代码（只计算包含 |values=xxx| 的表格）
 * @param tableIndex 有效表格的索引（从0开始，只计算包含 |values=xxx| 的表格）
 */
export function extractLanguageCodesByValidIndex(storageHtml: string, tableIndex: number): string[] {
  const tableInfo = getTableByValidIndex(storageHtml, tableIndex);

  if (!tableInfo) {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(tableInfo.tableStr, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    return [];
  }

  const languages: string[] = [];
  const headerRow = table.querySelector('tr');

  if (!headerRow) {
    return [];
  }

  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));

  headerCells.forEach(cell => {
    const text = cell.textContent || '';
    // 匹配 |values=xxx| 格式
    const match = text.match(/\|values=([^|]+)\|/);
    if (match) {
      const language = match[1].trim();
      if (!languages.includes(language)) {
        languages.push(language);
      }
    }
  });

  return languages;
}

/**
 * 根据有效索引提取现有列（只计算包含 |values=xxx| 的表格）
 * @param tableIndex 有效表格的索引（从0开始，只计算包含 |values=xxx| 的表格）
 */
export function extractExistingColumnsByValidIndex(storageHtml: string, tableIndex: number): string[] {
  const tableInfo = getTableByValidIndex(storageHtml, tableIndex);

  if (!tableInfo) {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(tableInfo.tableStr, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    return [];
  }

  const headerRow = table.querySelector('tr');

  if (!headerRow) {
    return [];
  }

  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));

  // 返回规范化的列名（小写、去空格）
  return headerCells.map(cell => {
    const text = cell.textContent || '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  });
}
