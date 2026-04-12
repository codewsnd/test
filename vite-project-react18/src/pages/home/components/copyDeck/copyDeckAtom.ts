import { atom } from 'jotai';
import type { ReactNode } from 'react';
import type { CellInfo } from './utils/confluenceStorageUtils';

// 重新导出 CellInfo 类型
export type { CellInfo };

// ==================== 类型定义 ====================

export interface ColumnIndexes {
  customId: number;
  customGroup: number;
  copy: number;
  result: number;
  evidence: number;
}

export interface ImageData {
  fileName: string;
  base64: string;
}

export interface CheckResultItem {
  filename: string;
  displayName?: string;
  diff?: string;
}

export interface CheckResultJSON {
  PASS: CheckResultItem[];
  FAILED: CheckResultItem[];
}

export type ResultOperation = 'add' | 'remove';

export interface OperationImageData {
  filename: string;
  displayName?: string;
  diff?: string;
  type?: 'PASS' | 'FAILED';
}

// ==================== 基础状态 Atoms ====================

/** CopyDeck 侧边栏显示状态 */
export const copyDeckSidebarVisibleAtom = atom<boolean>(false);

/** CopyDeck 全屏状态 */
export const copyDeckFullscreenAtom = atom<boolean>(false);

/** CopyDeck 当前视图状态 */
export const copyDeckCurrentViewAtom = atom<'input' | 'table' | 'result'>('input');

/** CopyDeck 消息通知状态 */
export interface CopyDeckMessage {
  type: 'success' | 'info' | 'warning' | 'error';
  content: ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export const copyDeckMessageAtom = atom<CopyDeckMessage | null>(null);

// ==================== Confluence 信息 ====================

export interface ConfluenceInfo {
  confluenceUrl: string;
  tableName: string;
  confluenceTitle: string;
  tableIndex: number; // 表格在 storage HTML 中的索引
}

export const copyDeckConfluenceInfoAtom = atom<ConfluenceInfo>({
  confluenceUrl: '',
  tableName: '',
  confluenceTitle: '',
  tableIndex: -1
});

// ==================== 核心数据 Atoms ====================

/** Confluence Storage HTML（完整的页面 storage） */
export const copyDeckStorageHtmlAtom = atom<string>('');

/** 当前选中表格的 HTML */
export const copyDeckCurrentTableHtmlAtom = atom<string>('');

/** 完整的表格数据（从后端返回的 renderTableData） */
export const copyDeckRenderTableDataAtom = atom<CellInfo[][]>([]);

/** 原始表格数据（深拷贝的 renderTableData，不受后续修改影响） */
export const copyDeckOriginalTableDataAtom = atom<CellInfo[][]>([]);

/** 表格图片数据（从 Confluence 附件中获取的图片 base64 数据） */
export interface TableImageData {
  fileName: string;
  base64: string;
}

export const copyDeckTableImageAtom = atom<TableImageData[]>([]);

/** 语言代码数组（从后端返回的 valuesArray） */
export const copyDeckValuesArrayAtom = atom<string[]>([]);

// ==================== Table 页面状态 ====================

/** 当前选中的语言 */
export const copyDeckSelectedLanguageAtom = atom<string>('');

/** 是否显示未比较的项 */
export const copyDeckShowUncomparedAtom = atom<boolean>(false);

/** 是否展开所有 Failed 面板 */
export interface CopyDeckFailedPanelsControl {
  expanded: boolean;
  version: number;
}

export const copyDeckExpandFailedPanelsAtom = atom<CopyDeckFailedPanelsControl>({
  expanded: false,
  version: 0
});

/** 选中的行（使用 COPYDECK_CUSTOM_ID 作为标识） */
export interface SelectedRow {
  customId: string;     // COPYDECK_CUSTOM_ID
  language: string;     // 当前语言
  groupName: string;    // 分组名称
}

export const copyDeckSelectedRowsAtom = atom<SelectedRow[]>([]);

// ==================== 辅助函数 - 列索引查找 ====================

/** 查找 COPYDECK_CUSTOM_ID 列索引 */
const findCustomIdColumnIndex = (headerRow: CellInfo[]): number =>
  headerRow.findIndex(h => h.value.includes('COPYDECK_CUSTOM_ID'));

/** 查找 COPYDECK_CUSTOM_GROUP 列索引（不区分语言，用于 Screen name 分组） */
const findCustomGroupColumnIndex = (headerRow: CellInfo[], language: string): number => {
  // 优先查找新的 COPYDECK_CUSTOM_GROUP 列（用于 Screen name 分组）
  const customGroupIndex = headerRow.findIndex(h => h.value === 'COPYDECK_CUSTOM_GROUP');
  if (customGroupIndex !== -1) {
    return customGroupIndex;
  }

  // 如果没有找到，查找旧的语言特定的 COPYDECK_CUSTOM_GROUP 列（兼容旧数据）
  return headerRow.findIndex(h => h.value.includes(`COPYDECK_CUSTOM_GROUP|values=${language}|`));
};

/** 查找特定语言的 Copy 列索引 */
const findCopyColumnIndex = (headerRow: CellInfo[], language: string): number =>
  headerRow.findIndex(h => {
    const hasLanguage = h.value.includes(`|values=${language}|`);
    const notResult = !h.value.toLowerCase().includes('testresult');
    const notEvidence = !h.value.toLowerCase().includes('evidence') && !h.value.toLowerCase().includes('test evidence');
    const notCustom = !h.value.toLowerCase().includes('copydeck_custom');
    return hasLanguage && notResult && notEvidence && notCustom;
  });

/** 查找特定语言的 Test Result 列索引 */
const findResultColumnIndex = (headerRow: CellInfo[], language: string): number =>
  headerRow.findIndex(h => {
    const normalized = h.value.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(`testresult|values=${language.toLowerCase()}|`);
  });

/** 查找特定语言的 Test Evidence 列索引 */
const findEvidenceColumnIndex = (headerRow: CellInfo[], language: string): number =>
  headerRow.findIndex(h => {
    const normalized = h.value.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(`testevidence|values=${language.toLowerCase()}|`) ||
           normalized.includes(`test evidence|values=${language.toLowerCase()}|`);
  });

/** 一次性获取所有列索引 */
export const getColumnIndexes = (headerRow: CellInfo[], language: string): ColumnIndexes => ({
  customId: findCustomIdColumnIndex(headerRow),
  customGroup: findCustomGroupColumnIndex(headerRow, language),
  copy: findCopyColumnIndex(headerRow, language),
  result: findResultColumnIndex(headerRow, language),
  evidence: findEvidenceColumnIndex(headerRow, language)
});

// ==================== 辅助函数 - JSON 解析 ====================

/** 安全解析 JSON，失败返回默认值 */
const safeJSONParse = <T>(jsonString: string, defaultValue: T): T => {
  if (!jsonString?.trim()) {
    return defaultValue;
  }
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

/** 解析 Test Evidence JSON 数据 */
export const parseEvidenceData = (evidenceString: string): ImageData[] => {
  const parsed = safeJSONParse<any>(evidenceString, null);
  return Array.isArray(parsed) ? parsed : [];
};

/**
 * 解析 Test Result JSON 数据 (始终返回有效的对象)
 * 支持新格式 [{fileName, passed}] 和旧格式 {PASS: [], FAILED: []}
 */
export const parseResultJSON = (resultString: string): CheckResultJSON => {
  const parsed = safeJSONParse<any>(resultString, null);

  // 新格式：数组格式 [{fileName, passed, discrepancies}]
  if (Array.isArray(parsed)) {
    const passItems: CheckResultItem[] = [];
    const failedItems: CheckResultItem[] = [];

    parsed.forEach((item: any) => {
      const resultItem: CheckResultItem = {
        filename: item.fileName || '',
        displayName: item.displayName,
        diff: item.discrepancies ? JSON.stringify(item.discrepancies) : undefined
      };

      if (item.passed === true) {
        passItems.push(resultItem);
      } else if (item.passed === false) {
        failedItems.push(resultItem);
      }
    });

    return { PASS: passItems, FAILED: failedItems };
  }

  // 旧格式：{PASS: [], FAILED: []}
  if (parsed && typeof parsed === 'object' && ('PASS' in parsed || 'FAILED' in parsed)) {
    return {
      PASS: parsed.PASS || [],
      FAILED: parsed.FAILED || []
    };
  }

  return { PASS: [], FAILED: [] };
};


// ==================== 辅助函数 - 数据查询 ====================

/** 通过 COPYDECK_CUSTOM_ID 获取在 renderTableData 中的行索引（包含 header） */
export const getRowIndexByCustomId = (
  renderTableData: CellInfo[][],
  customId: string
): number => {
  if (!renderTableData || renderTableData.length === 0 || !customId) {
    return -1;
  }

  const [headerRow, ...dataRows] = renderTableData;
  const customIdColumnIndex = findCustomIdColumnIndex(headerRow);

  if (customIdColumnIndex === -1) {
    return -1;
  }

  const dataRowIndex = dataRows.findIndex(row => row[customIdColumnIndex].value == customId);
  return dataRowIndex === -1 ? -1 : dataRowIndex + 1;
};

/** 查找相同 customGroup 的所有行在 renderTableData 中的索引（包含 header 行） */
export const findRowsByCustomGroup = (
  renderTableData: CellInfo[][],
  language: string,
  customGroup: string
): number[] => {
  if (!renderTableData || renderTableData.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = renderTableData;
  const columnIndexes = getColumnIndexes(headerRow, language);

  if (columnIndexes.customGroup === -1) {
    return [];
  }

  return dataRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => (row[columnIndexes.customGroup].value || '').trim() === customGroup.trim())
    .map(({ index }) => index + 1); // +1 因为包含 header 行
};

// ==================== 辅助函数 - 数据更新 ====================

/** 更新 renderTableData 中某一行某一列的数据（返回新的数组） */
export const updateCellData = (
  renderTableData: CellInfo[][],
  rowIndex: number,
  columnIndex: number,
  newValue: string
): CellInfo[][] => {
  const newData = [...renderTableData];
  newData[rowIndex] = [...newData[rowIndex]];
  newData[rowIndex][columnIndex] = {
    ...newData[rowIndex][columnIndex],
    value: newValue
  };
  return newData;
};

/** 添加/删除 Test Result 项 */
export const updateResultJSON = (
  resultJSON: CheckResultJSON,
  operation: ResultOperation,
  imageData: OperationImageData
): CheckResultJSON => {
  const newResult = {
    PASS: [...resultJSON.PASS],
    FAILED: [...resultJSON.FAILED]
  };

  if (operation === 'add') {
    const item: CheckResultItem = {
      filename: imageData.filename,
      displayName: imageData.displayName,
      ...(imageData.diff && { diff: imageData.diff })
    };

    (imageData.type === 'FAILED' ? newResult.FAILED : newResult.PASS).push(item);
  } else {
    // 删除项（从 PASS 和 FAILED 中移除）
    const shouldKeep = (item: CheckResultItem) =>
      item.filename !== imageData.filename && item.displayName !== imageData.displayName;

    newResult.PASS = newResult.PASS.filter(shouldKeep);
    newResult.FAILED = newResult.FAILED.filter(shouldKeep);
  }

  return newResult;
};

// ==================== 表格行数据处理 ====================

/** 表格行数据接口 */
interface TableRow {
  customId: string;
  customGroup: string;
  copy: string;
  result: string;
  evidence: string;
  evidenceCell?: CellInfo; // 保存原始的 CellInfo 对象，用于获取 rowspan 和 isSpanned
}

/** 从 renderTableData 中提取特定语言的行数据 */
const extractRowsForLanguage = (
  renderTableData: CellInfo[][],
  language: string
): TableRow[] => {
  if (!renderTableData || renderTableData.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = renderTableData;
  const columnIndexes = getColumnIndexes(headerRow, language);

  if (columnIndexes.customId === -1 || columnIndexes.copy === -1) {
    return [];
  }

  return dataRows
    .map(row => ({
      customId: row[columnIndexes.customId].value || '',
      customGroup: columnIndexes.customGroup !== -1 ? row[columnIndexes.customGroup].value || '' : '',
      copy: row[columnIndexes.copy].value || '',
      result: columnIndexes.result !== -1 ? row[columnIndexes.result].value || '' : '',
      evidence: columnIndexes.evidence !== -1 ? row[columnIndexes.evidence].value || '' : '',
      evidenceCell: columnIndexes.evidence !== -1 ? row[columnIndexes.evidence] : undefined // 保存原始的 CellInfo
    }))
    .filter(row => row.copy.trim() !== ''); // 只保留有 copy 内容的行
};

/** 根据 customGroup 将行数据分组为二维数组 */
const groupRowsByCustomGroup = (rows: TableRow[]): TableRow[][] => {
  if (rows.length === 0) {
    return [];
  }

  const groupMap = new Map<string, TableRow[]>();
  const groupOrder: string[] = [];
  const seenGroups = new Set<string>();

  rows.forEach(row => {
    // 使用 customGroup 值作为分组键（包括空字符串）
    const groupKey = row.customGroup.trim();

    // 如果是新的分组，记录顺序
    if (!seenGroups.has(groupKey)) {
      seenGroups.add(groupKey);
      groupOrder.push(groupKey);
    }

    // 添加到对应的分组中
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(row);
  });

  // 返回二维数组，保持顺序
  return groupOrder.map(groupName => groupMap.get(groupName) || []);
};

/** 过滤未比较的分组（evidence 为空的分组） */
const filterUncomparedGroups = (groups: TableRow[][]): TableRow[][] => {
  return groups.map(group => {
    // 检查是否为单表模式（整个组的customGroup都为空）
    const isSingleTableMode = group.every(row => row.customGroup.trim() === '');

    if (isSingleTableMode) {
      // 单表模式：根据 evidence 的 rowspan 来过滤每一行
      const filteredRows = group.filter(row => {
        if (!row.evidenceCell) {
          // 如果没有 evidenceCell，保留
          return true;
        }

        const { isSpanned } = row.evidenceCell;

        if (isSpanned) {
          // 如果是被合并的行，向上查找第一行
          const currentIndex = group.findIndex(r => r.customId === row.customId);
          if (currentIndex > 0) {
            for (let i = currentIndex - 1; i >= 0; i--) {
              const prevRow = group[i];
              if (prevRow.evidenceCell && !prevRow.evidenceCell.isSpanned) {
                // 找到第一行，检查它的 evidence 是否为空
                const trimmedValue = (prevRow.evidence || '').trim();
                return trimmedValue === '' || trimmedValue === '[]';
              }
            }
          }
          // 找不到第一行，保留
          return true;
        } else {
          // 如果不是被合并的行，检查自己的 evidence 是否为空
          const trimmedValue = (row.evidence || '').trim();
          return trimmedValue === '' || trimmedValue === '[]';
        }
      });

      return filteredRows;
    } else {
      // 多表模式：检查组的第一个非 isSpanned 行的 evidence
      const firstNonSpannedRow = group.find(row =>
        row.evidenceCell && !row.evidenceCell.isSpanned
      );

      const rowToCheck = firstNonSpannedRow || group[0];

      if (!rowToCheck) {
        return [];
      }

      const trimmedValue = (rowToCheck.evidence || '').trim();
      if (trimmedValue === '' || trimmedValue === '[]') {
        return group; // 保留整个组
      } else {
        return []; // 过滤掉整个组
      }
    }
  }).filter(group => group.length > 0); // 移除空组
};

// ==================== 派生 Atoms ====================

/** 基于选择的语言筛选的表格数据 */
export const copyDeckLanguageTableDataAtom = atom<TableRow[]>((get) => {
  const renderTableData = get(copyDeckRenderTableDataAtom);
  const selectedLanguage = get(copyDeckSelectedLanguageAtom);

  if (!selectedLanguage || !renderTableData || renderTableData.length === 0) {
    return [];
  }

  return extractRowsForLanguage(renderTableData, selectedLanguage);
});

/** 基于 COPYDECK_CUSTOM_GROUP 分组的二维数组 */
export const copyDeckGroupTableDataAtom = atom<TableRow[][]>((get) => {
  const languageTableData = get(copyDeckLanguageTableDataAtom);
  const showUncompared = get(copyDeckShowUncomparedAtom);

  if (languageTableData.length === 0) {
    return [];
  }

  let groups = groupRowsByCustomGroup(languageTableData);

  // 如果勾选了"显示未比较的项"，进行过滤
  if (showUncompared) {
    groups = filterUncomparedGroups(groups);
  }

  return groups;
});

// ==================== 副作用 Atoms ====================

export const showCopyDeckSidebarAtom = atom(
  null,
  (get, set) => {
    const isVisible = get(copyDeckSidebarVisibleAtom);
    if (isVisible) {
      return;
    }

    set(copyDeckSidebarVisibleAtom, true);
    set(copyDeckFullscreenAtom, false);
    set(copyDeckCurrentViewAtom, 'input');
  }
);

export const hideCopyDeckSidebarAtom = atom(
  null,
  (_get, set) => {
    set(copyDeckSidebarVisibleAtom, false);
    set(copyDeckFullscreenAtom, false);
    set(copyDeckCurrentViewAtom, 'input');
    set(copyDeckConfluenceInfoAtom, { confluenceUrl: '', tableName: '', title: '' });
    set(copyDeckStorageHtmlAtom, '');
    set(copyDeckCurrentTableHtmlAtom, '');
    set(copyDeckRenderTableDataAtom, []);
    set(copyDeckOriginalTableDataAtom, []);
    set(copyDeckTableImageAtom, []);
    set(copyDeckValuesArrayAtom, []);
    set(copyDeckSelectedLanguageAtom, '');
    set(copyDeckShowUncomparedAtom, false);
    set(copyDeckSelectedRowsAtom, []);
  }
);

export const toggleCopyDeckFullscreenAtom = atom(
  null,
  (get, set) => {
    const isFullscreen = get(copyDeckFullscreenAtom);
    set(copyDeckFullscreenAtom, !isFullscreen);
    if (!isFullscreen) {
      set(copyDeckSidebarVisibleAtom, true);
    }
  }
);
