import { CellInfo } from '../copyDeckAtom';

// ==================== 类型定义 ====================

export interface OriginalTestColumnsInfo {
  language: string;
  hasResult: boolean;
  hasEvidence: boolean;
}

export interface ColumnIndexes {
  renderCustomId: number;
  originalCustomId: number;
  renderResult: number;
  renderEvidence: number;
  originalResult: number;
  originalEvidence: number;
}

export interface SelectedRow {
  customId: string;
  language: string;
  groupName: string;
}

export interface NewColumnData {
  headerCell: CellInfo;
  columnType: 'result' | 'evidence';
  language: string;
}

// ==================== 辅助函数：索引查找 ====================

/**
 * 查找 COPYDECK_CUSTOM_ID 列索引
 */
export const findCustomIdColumnIndex = (headerRow: CellInfo[]): number => {
  return headerRow.findIndex(h => h.value === 'COPYDECK_CUSTOM_ID');
};

/**
 * 查找指定语言的 Test Result 列索引
 */
export const findResultColumnIndex = (headerRow: CellInfo[], language: string): number => {
  return headerRow.findIndex(h => {
    const normalized = h.value.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(`testresult|values=${language.toLowerCase()}|`);
  });
};

/**
 * 查找指定语言的 Test Evidence 列索引
 */
export const findEvidenceColumnIndex = (headerRow: CellInfo[], language: string): number => {
  return headerRow.findIndex(h => {
    const normalized = h.value.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(`testevidence|values=${language.toLowerCase()}|`) ||
           normalized.includes(`test evidence|values=${language.toLowerCase()}|`);
  });
};

/**
 * 查找行索引（通过 customId）
 */
export const findRowIndexByCustomId = (
  tableData: CellInfo[][],
  customIdColIndex: number,
  customId: string
): number => {
  return tableData.findIndex((row, idx) =>
    idx > 0 && row[customIdColIndex].value === customId
  );
};

// ==================== 辅助函数：单元格操作 ====================

/**
 * 复制单元格数据（包括所有属性）
 */
export const copyCellData = (sourceCell: CellInfo): CellInfo => {
  return {
    value: sourceCell.value,
    rowspan: sourceCell.rowspan,
    colspan: sourceCell.colspan,
    isSpanned: sourceCell.isSpanned,
    attributes: sourceCell.attributes
  };
};

/**
 * 创建空单元格
 */
export const createEmptyCell = (): CellInfo => {
  return {
    value: '',
    rowspan: 1,
    colspan: 1,
    isSpanned: false
  };
};

/**
 * 复制单元格但清空 value
 */
export const copyCellWithoutValue = (sourceCell: CellInfo): CellInfo => {
  return {
    value: '',
    rowspan: sourceCell.rowspan,
    colspan: sourceCell.colspan,
    isSpanned: sourceCell.isSpanned,
    attributes: sourceCell.attributes
  };
};

// ==================== 辅助函数：合并单元格处理 ====================

/**
 * 向上查找合并组的第一行
 */
export const findMergedGroupFirstRow = (
  renderTableData: CellInfo[][],
  startRowIndex: number,
  evidenceColIndex: number,
  customIdColIndex: number
): string | null => {
  let firstRowIndex = startRowIndex - 1;

  while (firstRowIndex > 0) {
    const evidenceCell = renderTableData[firstRowIndex][evidenceColIndex];
    if (!evidenceCell.isSpanned) {
      return renderTableData[firstRowIndex][customIdColIndex].value;
    }
    firstRowIndex--;
  }

  return null;
};

// ==================== 核心函数：单表模式处理 ====================

/**
 * 单表模式：更新已存在的列
 */
export const updateExistingColumnsInSingleTableMode = (
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  columnIndexes: ColumnIndexes
): void => {
  for (let rowIdx = 1; rowIdx < updatedOriginalTableData.length; rowIdx++) {
    const currentRowCustomId = updatedOriginalTableData[rowIdx][columnIndexes.originalCustomId].value;

    const renderRowIndex = findRowIndexByCustomId(
      renderTableData,
      columnIndexes.renderCustomId,
      currentRowCustomId
    );

    if (renderRowIndex === -1) {
      console.warn(`customId=${currentRowCustomId} 在 renderTableData 中找不到，跳过`);
      continue;
    }

    // 复制 Test Result
    const renderResultCell = renderTableData[renderRowIndex][columnIndexes.renderResult];
    updatedOriginalTableData[rowIdx][columnIndexes.originalResult] = copyCellData(renderResultCell);

    // 复制 Test Evidence
    const renderEvidenceCell = renderTableData[renderRowIndex][columnIndexes.renderEvidence];
    updatedOriginalTableData[rowIdx][columnIndexes.originalEvidence] = copyCellData(renderEvidenceCell);

    console.log(`复制行 customId=${currentRowCustomId} 的 Test 列数据`);
  }
};

/**
 * 单表模式：追加新列
 */
export const appendNewColumnsInSingleTableMode = (
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  renderResultColIndex: number,
  renderEvidenceColIndex: number,
  customIdIndexes: { render: number; original: number }
): void => {
  for (let rowIdx = 1; rowIdx < updatedOriginalTableData.length; rowIdx++) {
    const currentRowCustomId = updatedOriginalTableData[rowIdx][customIdIndexes.original].value;

    const renderRowIndex = findRowIndexByCustomId(
      renderTableData,
      customIdIndexes.render,
      currentRowCustomId
    );

    if (renderRowIndex === -1) {
      updatedOriginalTableData[rowIdx].push(createEmptyCell());
      updatedOriginalTableData[rowIdx].push(createEmptyCell());
      continue;
    }

    const renderResultCell = renderTableData[renderRowIndex][renderResultColIndex];
    const renderEvidenceCell = renderTableData[renderRowIndex][renderEvidenceColIndex];

    updatedOriginalTableData[rowIdx].push(copyCellData(renderResultCell));
    updatedOriginalTableData[rowIdx].push(copyCellData(renderEvidenceCell));

    console.log(`复制行 customId=${currentRowCustomId} 的新列数据`);
  }
};

// ==================== 核心函数：多表模式处理 ====================

/**
 * 收集需要更新的行（处理合并单元格）
 */
export const collectRowsToUpdate = (
  selectedRows: SelectedRow[],
  language: string,
  renderTableData: CellInfo[][],
  renderCustomIdColIndex: number,
  renderEvidenceColIndex: number
): Set<string> => {
  const rowsToUpdate = new Set<string>();

  selectedRows
    .filter(row => row.language === language)
    .forEach(selectedRow => {
      const { customId } = selectedRow;

      const renderRowIndex = findRowIndexByCustomId(
        renderTableData,
        renderCustomIdColIndex,
        customId
      );

      if (renderRowIndex === -1) {
        console.warn(`customId=${customId} 在 renderTableData 中找不到`);
        return;
      }

      const renderEvidenceCell = renderTableData[renderRowIndex][renderEvidenceColIndex];

      if (renderEvidenceCell.isSpanned) {
        console.log(`customId=${customId} 的 Test Evidence 是被合并的单元格，向上查找第一行`);
        const firstRowCustomId = findMergedGroupFirstRow(
          renderTableData,
          renderRowIndex,
          renderEvidenceColIndex,
          renderCustomIdColIndex
        );
        if (firstRowCustomId) {
          rowsToUpdate.add(firstRowCustomId);
        }
      } else {
        rowsToUpdate.add(customId);
      }

      rowsToUpdate.add(customId);
    });

  return rowsToUpdate;
};

/**
 * 多表模式：更新已存在的列
 */
export const updateExistingColumnsInMultiTableMode = (
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  rowsToUpdate: Set<string>,
  columnIndexes: ColumnIndexes
): void => {
  rowsToUpdate.forEach(customId => {
    const renderRowIndex = findRowIndexByCustomId(
      renderTableData,
      columnIndexes.renderCustomId,
      customId
    );

    const originalRowIndex = findRowIndexByCustomId(
      updatedOriginalTableData,
      columnIndexes.originalCustomId,
      customId
    );

    if (renderRowIndex === -1 || originalRowIndex === -1) {
      console.warn(`customId=${customId} 找不到对应行`);
      return;
    }

    // 更新 Test Result
    updatedOriginalTableData[originalRowIndex][columnIndexes.originalResult] = {
      ...updatedOriginalTableData[originalRowIndex][columnIndexes.originalResult],
      value: renderTableData[renderRowIndex][columnIndexes.renderResult].value
    };

    // 更新 Test Evidence
    const renderEvidenceCell = renderTableData[renderRowIndex][columnIndexes.renderEvidence];
    updatedOriginalTableData[originalRowIndex][columnIndexes.originalEvidence] = {
      ...updatedOriginalTableData[originalRowIndex][columnIndexes.originalEvidence],
      value: renderEvidenceCell.value,
      rowspan: renderEvidenceCell.rowspan,
      isSpanned: renderEvidenceCell.isSpanned
    };

    console.log(`Updated row customId=${customId}`);
  });
};

/**
 * 多表模式：追加新列的所有行
 */
export const appendNewColumnsInMultiTableMode = (
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  rowsToUpdate: Set<string>,
  renderResultColIndex: number,
  renderEvidenceColIndex: number,
  customIdIndexes: { render: number; original: number }
): void => {
  for (let rowIdx = 1; rowIdx < updatedOriginalTableData.length; rowIdx++) {
    const currentRowCustomId = updatedOriginalTableData[rowIdx][customIdIndexes.original].value;

    const renderRowIndex = findRowIndexByCustomId(
      renderTableData,
      customIdIndexes.render,
      currentRowCustomId
    );

    if (renderRowIndex === -1) {
      updatedOriginalTableData[rowIdx].push(createEmptyCell());
      updatedOriginalTableData[rowIdx].push(createEmptyCell());
      continue;
    }

    const shouldUpdate = rowsToUpdate.has(currentRowCustomId);
    const renderResultCell = renderTableData[renderRowIndex][renderResultColIndex];
    const renderEvidenceCell = renderTableData[renderRowIndex][renderEvidenceColIndex];

    if (shouldUpdate) {
      updatedOriginalTableData[rowIdx].push(copyCellData(renderResultCell));
      updatedOriginalTableData[rowIdx].push(copyCellData(renderEvidenceCell));
    } else {
      updatedOriginalTableData[rowIdx].push(copyCellWithoutValue(renderResultCell));
      updatedOriginalTableData[rowIdx].push(copyCellWithoutValue(renderEvidenceCell));
    }
  }
};

// ==================== 核心函数：列管理 ====================

/**
 * 查找模板列索引（用于复制属性）
 */
export const findTemplateColumnIndex = (headerRow: CellInfo[]): number => {
  for (let i = headerRow.length - 1; i >= 0; i--) {
    const normalized = headerRow[i].value.toLowerCase().replace(/\s+/g, '');
    const isTestColumn = normalized.includes('testresult|values=') ||
                        normalized.includes('testevidence|values=') ||
                        normalized.includes('test evidence|values=');

    if (!isTestColumn &&
        headerRow[i].value !== 'COPYDECK_CUSTOM_ID' &&
        headerRow[i].value !== 'COPYDECK_CUSTOM_GROUP') {
      return i;
    }
  }
  return -1;
};

/**
 * 创建新列的 header cell
 */
export const createHeaderCell = (
  templateCell: CellInfo | null,
  headerValue: string
): CellInfo => {
  if (templateCell) {
    return {
      ...templateCell,
      value: headerValue
    };
  }

  return {
    value: headerValue,
    rowspan: 1,
    colspan: 1,
    isSpanned: false
  };
};

/**
 * 追加列 header
 */
export const appendColumnHeaders = (
  updatedOriginalTableData: CellInfo[][],
  renderHeaderRow: CellInfo[],
  renderResultColIndex: number,
  renderEvidenceColIndex: number,
  templateColIndex: number
): void => {
  const templateCell = templateColIndex !== -1
    ? updatedOriginalTableData[0][templateColIndex]
    : null;

  const resultHeaderCell = createHeaderCell(
    templateCell,
    renderHeaderRow[renderResultColIndex].value
  );

  const evidenceHeaderCell = createHeaderCell(
    templateCell,
    renderHeaderRow[renderEvidenceColIndex].value
  );

  updatedOriginalTableData[0].push(resultHeaderCell);
  updatedOriginalTableData[0].push(evidenceHeaderCell);
};

// ==================== DOM 操作函数 ====================

/**
 * 查找并删除表格中的 Test 列
 */
export const deleteTestColumnsFromTable = (table: Element): number[] => {
  const headerRow = table.querySelector('thead tr, tr:first-child');
  const allRows = Array.from(table.querySelectorAll('tr'));

  if (!headerRow) {
    throw new Error('Table header row not found');
  }

  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  const columnsToDelete: number[] = [];

  headerCells.forEach((cell, index) => {
    const text = cell.textContent?.toLowerCase().replace(/\s+/g, '') || '';
    if (text.includes('testresult|values=') ||
        text.includes('testevidence|values=') ||
        text.includes('test evidence|values=')) {
      columnsToDelete.push(index);
    }
  });

  console.log('Columns to delete (all Test Result/Evidence):', columnsToDelete);

  // 从后往前删除列
  columnsToDelete.reverse().forEach(colIndex => {
    allRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells[colIndex]) {
        cells[colIndex].remove();
      }
    });
  });

  return columnsToDelete;
};

/**
 * 从 header 中提取新列数据
 */
export const extractNewColumnsData = (headerRow: CellInfo[]): NewColumnData[] => {
  const newColumnsData: NewColumnData[] = [];

  headerRow.forEach((headerCell) => {
    const normalized = headerCell.value.toLowerCase().replace(/\s+/g, '');
    const match = headerCell.value.match(/\|values=([^|]+)\|/);
    const language = match ? match[1].trim() : '';

    if (normalized.includes('testresult|values=')) {
      newColumnsData.push({
        headerCell,
        columnType: 'result',
        language
      });
    } else if (normalized.includes('testevidence|values=') ||
               normalized.includes('test evidence|values=')) {
      newColumnsData.push({
        headerCell,
        columnType: 'evidence',
        language
      });
    }
  });

  return newColumnsData;
};

// ==================== 高层函数：语言处理 ====================

/**
 * 处理单个语言的列更新（已存在的列）
 */
export const processLanguageForExistingColumns = (
  language: string,
  isSingleTableMode: boolean,
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  selectedRows: SelectedRow[],
  originalHeaderRow: CellInfo[],
  renderHeaderRow: CellInfo[]
): void => {
  const renderCustomIdColIndex = findCustomIdColumnIndex(renderHeaderRow);
  const originalCustomIdColIndex = findCustomIdColumnIndex(originalHeaderRow);

  const originalResultColIndex = findResultColumnIndex(originalHeaderRow, language);
  const originalEvidenceColIndex = findEvidenceColumnIndex(originalHeaderRow, language);
  const renderResultColIndex = findResultColumnIndex(renderHeaderRow, language);
  const renderEvidenceColIndex = findEvidenceColumnIndex(renderHeaderRow, language);

  if (renderResultColIndex === -1 || renderEvidenceColIndex === -1) {
    console.warn(`语言 ${language} 在 renderTableData 中找不到对应的列，跳过`);
    return;
  }

  const columnIndexes: ColumnIndexes = {
    renderCustomId: renderCustomIdColIndex,
    originalCustomId: originalCustomIdColIndex,
    renderResult: renderResultColIndex,
    renderEvidence: renderEvidenceColIndex,
    originalResult: originalResultColIndex,
    originalEvidence: originalEvidenceColIndex
  };

  if (isSingleTableMode) {
    console.log('单表模式：直接复制整列');
    updateExistingColumnsInSingleTableMode(
      updatedOriginalTableData,
      renderTableData,
      columnIndexes
    );
  } else {
    console.log('多表模式：选择性更新勾选的行');
    const rowsToUpdate = collectRowsToUpdate(
      selectedRows,
      language,
      renderTableData,
      renderCustomIdColIndex,
      renderEvidenceColIndex
    );

    updateExistingColumnsInMultiTableMode(
      updatedOriginalTableData,
      renderTableData,
      rowsToUpdate,
      columnIndexes
    );
  }
};

/**
 * 处理单个语言的列追加（新列）
 */
export const processLanguageForNewColumns = (
  language: string,
  isSingleTableMode: boolean,
  updatedOriginalTableData: CellInfo[][],
  renderTableData: CellInfo[][],
  selectedRows: SelectedRow[],
  renderHeaderRow: CellInfo[]
): void => {
  const renderCustomIdColIndex = findCustomIdColumnIndex(renderHeaderRow);
  const originalCustomIdColIndex = findCustomIdColumnIndex(updatedOriginalTableData[0]);

  const renderResultColIndex = findResultColumnIndex(renderHeaderRow, language);
  const renderEvidenceColIndex = findEvidenceColumnIndex(renderHeaderRow, language);

  if (renderResultColIndex === -1 || renderEvidenceColIndex === -1) {
    console.warn(`语言 ${language} 在 renderTableData 中找不到对应的列，跳过`);
    return;
  }

  // 查找模板列并追加 header
  const templateColIndex = findTemplateColumnIndex(updatedOriginalTableData[0]);
  appendColumnHeaders(
    updatedOriginalTableData,
    renderHeaderRow,
    renderResultColIndex,
    renderEvidenceColIndex,
    templateColIndex
  );

  console.log(`追加了 Test Result 和 Test Evidence 列`);

  if (isSingleTableMode) {
    console.log('单表模式：直接复制整列');
    appendNewColumnsInSingleTableMode(
      updatedOriginalTableData,
      renderTableData,
      renderResultColIndex,
      renderEvidenceColIndex,
      { render: renderCustomIdColIndex, original: originalCustomIdColIndex }
    );
  } else {
    console.log('多表模式：选择性更新勾选的行');
    const rowsToUpdate = collectRowsToUpdate(
      selectedRows,
      language,
      renderTableData,
      renderCustomIdColIndex,
      renderEvidenceColIndex
    );

    appendNewColumnsInMultiTableMode(
      updatedOriginalTableData,
      renderTableData,
      rowsToUpdate,
      renderResultColIndex,
      renderEvidenceColIndex,
      { render: renderCustomIdColIndex, original: originalCustomIdColIndex }
    );
  }
};
