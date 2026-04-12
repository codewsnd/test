import React, { useRef, useState } from 'react';
import { Button, Image, List, Modal, Space } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  copyDeckGroupTableDataAtom,
  copyDeckRenderTableDataAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckSelectedRowsAtom,
  copyDeckMessageAtom,
  getRowIndexByCustomId,
  findRowsByCustomGroup,
  getColumnIndexes,
  updateCellData,
  type CellInfo,
} from './copyDeckAtom';
import { calculateFileMD5 } from '@/utils/fileUtils';
import { groupedIntelligentMatchApi, singleTableIntelligentMatchApi } from '@/api/tool/copyDeckApi';


interface UploadedImage {
  fileName: string;
  base64: string;
  blob: Blob;
  md5: string;
  ocrContent?: string;
}

interface TempImage extends UploadedImage {
  id: string;
}

interface UploadScreenshotsModalProps {
  visible: boolean;
  onClose: () => void;
  initialFiles?: File[];
}

// ==================== Helper Functions ====================

/**
 * 验证并过滤有效的行（只验证是否在用户选择的行中）
 */
const filterValidRows = (
  rows: any[],
  selectedCustomIdSet: Set<string>,
  matchRowSet?: Set<string>
): any[] => {
  return rows.filter((row: any) => {
    const customIdStr = String(row.customId);

    if (!selectedCustomIdSet.has(customIdStr)) {
      console.warn(`Skipping customId ${customIdStr}: not in user selected rows`);
      return false;
    }

    if (matchRowSet && !matchRowSet.has(customIdStr)) {
      return false;
    }

    // 移除 matchRate > 0 的限制，允许所有行通过（包括 0% 匹配率）
    return true;
  });
};

/**
 * 解析 evidence 数组
 */
const parseEvidenceArray = (evidenceStr: string): any[] => {
  try {
    const parsed = JSON.parse(evidenceStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

/**
 * 解析 result 数组
 */
const parseResultArray = (resultStr: string): any[] => {
  try {
    const parsed = JSON.parse(resultStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

/**
 * 更新或添加数组项
 */
const upsertArrayItem = (array: any[], newItem: any, matchKey: string): any[] => {
  const existingIndex = array.findIndex((item: any) => item[matchKey] === newItem[matchKey]);

  if (existingIndex === -1) {
    return [...array, newItem];
  }

  const newArray = [...array];
  newArray[existingIndex] = newItem;
  return newArray;
};

/**
 * 更新 evidence 数据
 */
const updateEvidenceData = (
  renderTableData: CellInfo[][],
  rowIndex: number,
  columnIndex: number,
  matchedImage: UploadedImage
): CellInfo[][] => {
  const existingEvidenceStr = renderTableData[rowIndex][columnIndex].value || '';
  const existingEvidenceArray = parseEvidenceArray(existingEvidenceStr);

  const newItem = {
    fileName: matchedImage.fileName,
    base64: matchedImage.base64
  };

  const updatedArray = upsertArrayItem(existingEvidenceArray, newItem, 'fileName');

  return updateCellData(
    renderTableData,
    rowIndex,
    columnIndex,
    JSON.stringify(updatedArray)
  );
};

/**
 * 更新 result 数据
 */
const updateResultData = (
  renderTableData: CellInfo[][],
  rowIndex: number,
  columnIndex: number,
  fileName: string,
  rowResult: any
): CellInfo[][] => {
  const existingResultStr = renderTableData[rowIndex][columnIndex].value || '';
  const existingResultArray = parseResultArray(existingResultStr);

  const newResultItem: any = {
    fileName,
    passed: rowResult.passed
  };

  if (!rowResult.passed) {
    newResultItem.discrepancies = rowResult.discrepancies || [];
  }

  const updatedArray = upsertArrayItem(existingResultArray, newResultItem, 'fileName');

  return updateCellData(
    renderTableData,
    rowIndex,
    columnIndex,
    JSON.stringify(updatedArray)
  );
};

/**
 * 处理分组模式的单个组结果
 * 更新所有传入的 customId 的 evidence 和 result（包括 0% 匹配率的行）
 */
const processMultiTableGroupResult = (
  groupResult: any,
  finalImages: UploadedImage[],
  renderTableData: CellInfo[][],
  selectedLanguage: string,
  columnIndexes: any,
  selectedCustomIdSet: Set<string>
): CellInfo[][] => {
  if (!groupResult.rows || groupResult.rows.length === 0) {
    return renderTableData;
  }

  const validRows = filterValidRows(groupResult.rows, selectedCustomIdSet);
  if (validRows.length === 0) {
    return renderTableData;
  }

  let newRenderTableData = renderTableData;
  const matchedImage = finalImages.find(img => img.fileName === groupResult.fileName);

  if (!matchedImage) {
    console.warn(`Image ${groupResult.fileName} not found in uploaded images`);
    return renderTableData;
  }

  // 找到组的第一行索引（用于更新 Evidence）
  const firstRowCustomId = validRows[0].customId;
  const firstRowIndex = getRowIndexByCustomId(renderTableData, firstRowCustomId);

  if (firstRowIndex !== -1) {
    const currentCustomGroup = columnIndexes.customGroup !== -1
      ? (renderTableData[firstRowIndex][columnIndexes.customGroup].value || '').trim()
      : '';

    const groupFirstRowIndex = currentCustomGroup
      ? findRowsByCustomGroup(renderTableData, selectedLanguage, currentCustomGroup)[0]
      : firstRowIndex;

    // 更新 Evidence 列（组的第一行）
    if (groupFirstRowIndex !== -1 && columnIndexes.evidence !== -1) {
      newRenderTableData = updateEvidenceData(
        newRenderTableData,
        groupFirstRowIndex,
        columnIndexes.evidence,
        matchedImage
      );
    }
  }

  // 更新所有有效行的 result（包括 0% 匹配率的行）
  validRows.forEach((rowResult: any) => {
    const rowIndex = getRowIndexByCustomId(newRenderTableData, rowResult.customId);
    if (rowIndex !== -1 && columnIndexes.result !== -1) {
      newRenderTableData = updateResultData(
        newRenderTableData,
        rowIndex,
        columnIndexes.result,
        groupResult.fileName,
        rowResult
      );
    }
  });

  return newRenderTableData;
};

/**
 * 过滤出匹配成功的行（匹配率>0%且被用户勾选）
 */
const filterPassedRows = (
  groupResult: any,
  selectedCustomIdSet: Set<string>
): any[] => {
  return groupResult.rows.filter((row: any) => {
    const customIdStr = String(row.customId);
    return selectedCustomIdSet.has(customIdStr);
  });
};

/**
 * 查找某一行所属的原始合并组（向上或向下查找）
 * 返回合并组的起始索引和大小，如果不属于任何合并组则返回该行本身
 */
const findRowMergedGroup = (
  renderTableData: CellInfo[][],
  rowIndex: number,
  evidenceColIndex: number
): { startIndex: number; size: number } => {
  const evidenceCell = renderTableData[rowIndex][evidenceColIndex];

  if (evidenceCell.isSpanned) {
    // 当前行是被合并的行，向上查找第一行
    let idx = rowIndex - 1;
    while (idx > 0) {
      const cell = renderTableData[idx][evidenceColIndex];
      if (!cell.isSpanned) {
        return { startIndex: idx, size: cell.rowspan || 1 };
      }
      idx--;
    }
  } else if (evidenceCell.rowspan > 1) {
    // 当前行就是第一行，且有合并
    return { startIndex: rowIndex, size: evidenceCell.rowspan };
  }

  // 不属于任何合并组，返回单行
  return { startIndex: rowIndex, size: 1 };
};

/**
 * 收集所有匹配行所涉及的原始合并组
 * 返回所有唯一的合并组信息
 */
const collectAffectedMergedGroups = (
  renderTableData: CellInfo[][],
  passedRows: any[],
  evidenceColIndex: number,
  customIdColIndex: number
): Array<{ startIndex: number; size: number; rows: number[] }> => {
  const groupsMap = new Map<number, { startIndex: number; size: number; rows: number[] }>();

  passedRows.forEach((passedRow: any) => {
    const rowIndex = getRowIndexByCustomId(renderTableData, String(passedRow.customId));
    if (rowIndex === -1) return;

    const { startIndex, size } = findRowMergedGroup(renderTableData, rowIndex, evidenceColIndex);

    // 如果是单行，跳过
    if (size === 1) return;

    // 使用 startIndex 作为 key 去重
    if (!groupsMap.has(startIndex)) {
      const rows = Array.from({ length: size }, (_, i) => startIndex + i);
      groupsMap.set(startIndex, { startIndex, size, rows });
      console.log(`发现原始合并组: 起始行=${startIndex}, 大小=${size}, 行索引=[${rows.join(', ')}]`);
    }
  });

  return Array.from(groupsMap.values());
};

/**
 * 处理所有受影响的合并组，为未匹配的行重新分组
 */
const handleAllAffectedMergedGroups = (
  renderTableData: CellInfo[][],
  affectedGroups: Array<{ startIndex: number; size: number; rows: number[] }>,
  passedCustomIds: Set<string>,
  columnIndexes: any
): void => {
  affectedGroups.forEach(group => {
    console.log(`处理合并组: 起始行=${group.startIndex}, 大小=${group.size}`);

    // 保存原始 Evidence 数据
    const originalEvidenceData = renderTableData[group.startIndex][columnIndexes.evidence].value;

    // 保存每行的 Result 数据
    const originalResultDataByRow = new Map<number, string>();
    if (columnIndexes.result !== -1) {
      group.rows.forEach(rowIdx => {
        const resultData = renderTableData[rowIdx][columnIndexes.result].value || '';
        originalResultDataByRow.set(rowIdx, resultData);
      });
    }

    // 找出未匹配的行
    const unmatchedRows = group.rows.filter(rowIdx => {
      const customId = renderTableData[rowIdx][columnIndexes.customId].value;
      return !passedCustomIds.has(customId);
    });

    console.log(`未匹配的行索引: [${unmatchedRows.join(', ')}]`);

    if (unmatchedRows.length === 0) {
      console.log(`该组所有行都匹配了，无需重新分组`);
      return;
    }

    // 将未匹配的行按连续性分组
    const unmatchedGroups = groupConsecutiveRows(unmatchedRows);

    console.log(`未匹配行分为 ${unmatchedGroups.length} 个连续组:`, unmatchedGroups);

    // 为每个未匹配的连续组设置数据
    unmatchedGroups.forEach(unmatchedGroup => {
      const firstIdx = unmatchedGroup[0];

      // 设置第一行的 Evidence（带 rowspan）
      setUnmatchedGroupFirstRowEvidence(
        renderTableData,
        firstIdx,
        unmatchedGroup.length,
        originalEvidenceData,
        columnIndexes.evidence
      );

      // 设置第一行的 Result
      setUnmatchedGroupFirstRowResult(
        renderTableData,
        firstIdx,
        originalResultDataByRow,
        columnIndexes.result
      );

      // 设置其他行为 isSpanned
      setUnmatchedGroupOtherRows(
        renderTableData,
        unmatchedGroup,
        originalResultDataByRow,
        columnIndexes.evidence,
        columnIndexes.result
      );

      console.log(`未匹配组 [${unmatchedGroup.join(', ')}] 已重新分组，rowspan=${unmatchedGroup.length}`);
    });
  });
};

/**
 * 将连续的行索引分组
 */
const groupConsecutiveRows = (rowIndexes: number[]): number[][] => {
  const groups: number[][] = [];
  let currentGroup: number[] = [];

  rowIndexes.forEach((rowIdx, i) => {
    if (currentGroup.length === 0 || rowIdx === rowIndexes[i - 1] + 1) {
      currentGroup.push(rowIdx);
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [rowIdx];
    }
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

/**
 * 为未匹配组设置Evidence数据（第一行）
 */
const setUnmatchedGroupFirstRowEvidence = (
  renderTableData: CellInfo[][],
  firstIdx: number,
  groupSize: number,
  originalEvidenceData: string,
  evidenceColIndex: number
): void => {
  if (evidenceColIndex === -1) return;

  renderTableData[firstIdx][evidenceColIndex] = {
    ...renderTableData[firstIdx][evidenceColIndex],
    value: originalEvidenceData,
    rowspan: groupSize,
    isSpanned: false
  };
};

/**
 * 为未匹配组设置Result数据（第一行）
 */
const setUnmatchedGroupFirstRowResult = (
  renderTableData: CellInfo[][],
  firstIdx: number,
  originalResultDataByRow: Map<number, string>,
  resultColIndex: number
): void => {
  if (resultColIndex === -1) return;

  const ownResultData = originalResultDataByRow.get(firstIdx) || '';
  if (ownResultData) {
    renderTableData[firstIdx][resultColIndex] = {
      ...renderTableData[firstIdx][resultColIndex],
      value: ownResultData
    };
  }
};

/**
 * 为未匹配组设置其他行的数据
 */
const setUnmatchedGroupOtherRows = (
  renderTableData: CellInfo[][],
  group: number[],
  originalResultDataByRow: Map<number, string>,
  evidenceColIndex: number,
  resultColIndex: number
): void => {
  for (let i = 1; i < group.length; i++) {
    const rowIdx = group[i];

    // 设置 Evidence 为 isSpanned
    if (evidenceColIndex !== -1) {
      renderTableData[rowIdx][evidenceColIndex] = {
        ...renderTableData[rowIdx][evidenceColIndex],
        value: '',
        rowspan: 0,
        isSpanned: true
      };
    }

    // 为其他行设置自己的 Result 数据
    if (resultColIndex !== -1) {
      const ownResultData = originalResultDataByRow.get(rowIdx) || '';
      if (ownResultData) {
        renderTableData[rowIdx][resultColIndex] = {
          ...renderTableData[rowIdx][resultColIndex],
          value: ownResultData
        };
      }
    }
  }
};

/**
 * 清空匹配行的旧数据，并重置 rowspan 和 isSpanned
 */
const clearMatchedRowsData = (
  renderTableData: CellInfo[][],
  passedRows: any[],
  columnIndexes: any
): CellInfo[][] => {
  let newData = renderTableData;

  passedRows.forEach((rowResult: any) => {
    const customIdStr = String(rowResult.customId);
    const rowIndex = getRowIndexByCustomId(newData, customIdStr);

    if (rowIndex === -1) return;

    // 清空并重置 Result 列
    if (columnIndexes.result !== -1) {
      newData = updateCellData(newData, rowIndex, columnIndexes.result, '');
      newData[rowIndex][columnIndexes.result] = {
        ...newData[rowIndex][columnIndexes.result],
        rowspan: 1,
        isSpanned: false
      };
    }

    // 清空并重置 Evidence 列
    if (columnIndexes.evidence !== -1) {
      newData = updateCellData(newData, rowIndex, columnIndexes.evidence, '');
      newData[rowIndex][columnIndexes.evidence] = {
        ...newData[rowIndex][columnIndexes.evidence],
        rowspan: 1,
        isSpanned: false
      };
    }
  });

  return newData;
};

/**
 * 设置第一行的Evidence数据
 */
const setFirstRowEvidence = (
  renderTableData: CellInfo[][],
  firstRow: any,
  matchedImage: UploadedImage,
  passedRowsCount: number,
  columnIndexes: any
): CellInfo[][] => {
  const firstRowIndex = getRowIndexByCustomId(renderTableData, String(firstRow.customId));

  if (firstRowIndex === -1 || columnIndexes.evidence === -1) {
    return renderTableData;
  }

  const newEvidenceData = [{
    fileName: matchedImage.fileName,
    base64: matchedImage.base64
  }];

  let newData = updateCellData(
    renderTableData,
    firstRowIndex,
    columnIndexes.evidence,
    JSON.stringify(newEvidenceData)
  );

  newData[firstRowIndex][columnIndexes.evidence] = {
    ...newData[firstRowIndex][columnIndexes.evidence],
    rowspan: passedRowsCount,
    isSpanned: false
  };

  console.log(`匹配成功的第一行 (customId=${firstRow.customId}) Evidence 设置 rowspan=${passedRowsCount}`);

  return newData;
};

/**
 * 设置其他匹配行的Evidence为isSpanned
 */
const setOtherRowsEvidenceSpanned = (
  renderTableData: CellInfo[][],
  passedRows: any[],
  columnIndexes: any
): CellInfo[][] => {
  let newData = renderTableData;

  for (let i = 1; i < passedRows.length; i++) {
    const row = passedRows[i];
    const rowIndex = getRowIndexByCustomId(newData, String(row.customId));

    if (rowIndex !== -1 && columnIndexes.evidence !== -1) {
      newData[rowIndex][columnIndexes.evidence] = {
        ...newData[rowIndex][columnIndexes.evidence],
        value: '',
        rowspan: 0,
        isSpanned: true
      };

      console.log(`匹配成功的其他行 (customId=${row.customId}) Evidence 设置为 isSpanned`);
    }
  }

  return newData;
};

/**
 * 更新所有匹配行的Result数据
 */
const updateMatchedRowsResult = (
  renderTableData: CellInfo[][],
  passedRows: any[],
  matchedImage: UploadedImage,
  columnIndexes: any
): CellInfo[][] => {
  let newData = renderTableData;

  passedRows.forEach((rowResult: any) => {
    const customIdStr = String(rowResult.customId);
    const rowIndex = getRowIndexByCustomId(newData, customIdStr);

    if (rowIndex === -1) return;

    if (columnIndexes.result !== -1) {
      const newResultData = [{
        fileName: matchedImage.fileName,
        passed: rowResult.passed,
        discrepancies: rowResult.discrepancies || []
      }];

      newData = updateCellData(
        newData,
        rowIndex,
        columnIndexes.result,
        JSON.stringify(newResultData)
      );

      console.log(`customId=${customIdStr} 设置 Result (passed=${rowResult.passed})`);
    }
  });

  return newData;
};

/**
 * 处理单表模式的单个组结果
 * 智能合并和拆分逻辑：
 * 1. 只要匹配率 > 0% 就算匹配成功
 * 2. 收集所有匹配行涉及的原始合并组
 * 3. 为每个受影响的合并组中的未匹配行重新分组
 * 4. 将匹配的行合并为新组（使用 rowspan）
 * 5. 每个匹配行都更新 Result
 */
const processSingleTableGroupResult = (
  groupResult: any,
  finalImages: UploadedImage[],
  renderTableData: CellInfo[][],
  columnIndexes: any,
  selectedCustomIdSet: Set<string>,
  selectedLanguage: string
): CellInfo[][] => {
  console.log('=== 处理单表组结果 ===');
  console.log('groupResult:', groupResult);

  if (!groupResult.matchRow || groupResult.matchRow.length === 0) {
    console.log('没有匹配的行，跳过');
    return renderTableData;
  }

  const matchedImage = finalImages.find(img => img.fileName === groupResult.fileName);
  if (!matchedImage) {
    console.warn(`图片 ${groupResult.fileName} 未找到`);
    return renderTableData;
  }

  // 1. 过滤出匹配成功的行
  const passedRows = filterPassedRows(groupResult, selectedCustomIdSet);

  if (passedRows.length === 0) {
    console.log('没有匹配成功的行，跳过');
    return renderTableData;
  }

  console.log(`找到 ${passedRows.length} 个匹配成功的行:`, passedRows.map((r: any) => `${r.customId}(${r.matchRate})`));

  let newRenderTableData = renderTableData;
  const passedCustomIds = new Set(passedRows.map((r: any) => String(r.customId)));

  // 2. 收集所有匹配行涉及的原始合并组
  if (columnIndexes.evidence !== -1) {
    const affectedGroups = collectAffectedMergedGroups(
      newRenderTableData,
      passedRows,
      columnIndexes.evidence,
      columnIndexes.customId
    );

    console.log(`匹配行涉及 ${affectedGroups.length} 个原始合并组`);

    // 3. 处理所有受影响的合并组，为未匹配的行重新分组
    if (affectedGroups.length > 0) {
      handleAllAffectedMergedGroups(
        newRenderTableData,
        affectedGroups,
        passedCustomIds,
        columnIndexes
      );
    }
  }

  // 4-7. 更新匹配行的数据
  newRenderTableData = clearMatchedRowsData(newRenderTableData, passedRows, columnIndexes);
  newRenderTableData = setFirstRowEvidence(newRenderTableData, passedRows[0], matchedImage, passedRows.length, columnIndexes);
  newRenderTableData = setOtherRowsEvidenceSpanned(newRenderTableData, passedRows, columnIndexes);
  newRenderTableData = updateMatchedRowsResult(newRenderTableData, passedRows, matchedImage, columnIndexes);

  console.log('=== 单表组结果处理完成 ===');
  return newRenderTableData;
};

/**
 * 计算匹配统计
 */
const calculateMatchStatistics = (
  matchResult: any[],
  hasMultiTable: boolean
): { matchedFileNames: Set<string> } => {
  const matchedFileNames = new Set<string>();

  if (!Array.isArray(matchResult)) {
    return { matchedFileNames };
  }

  matchResult.forEach((groupResult: any) => {
    if (!groupResult.rows || !groupResult.fileName) {
      return;
    }

    // 只要有任何行（无论匹配率如何），都算作已匹配的图片
    if (groupResult.rows.length > 0) {
      matchedFileNames.add(groupResult.fileName);
    }
  });

  return { matchedFileNames };
};

export const UploadScreenshotsModal: React.FC<UploadScreenshotsModalProps> = ({
  visible,
  onClose,
  initialFiles = [],
}) => {
  const [renderTableData, setRenderTableData] = useAtom(copyDeckRenderTableDataAtom);
  const [selectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [selectedRows] = useAtom(copyDeckSelectedRowsAtom);
  const [tempImages, setTempImages] = useState<TempImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableGroups = useAtomValue(copyDeckGroupTableDataAtom);
  const setMessage = useSetAtom(copyDeckMessageAtom);

  // 处理初始文件
  React.useEffect(() => {
    if (visible && initialFiles.length > 0) {
      processInitialFiles(initialFiles);
    }
  }, [visible, initialFiles]);

  // 处理初始文件的函数
  const processInitialFiles = async (files: File[]) => {
    const newImages: TempImage[] = [];
    const existingMd5Set = new Set(tempImages.map(img => img.md5));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 只处理图片文件
      if (!file.type.startsWith('image/')) {
        continue;
      }

      try {
        // 计算 MD5
        const md5 = await calculateFileMD5(file);

        // 检查是否重复
        if (existingMd5Set.has(md5)) {
          continue;
        }

        // 转换为 base64
        const base64 = await fileToBase64(file);

        newImages.push({
          id: `${Date.now()}_${i}`,
          fileName: file.name,
          base64,
          blob: file,
          md5,
        });

        existingMd5Set.add(md5);
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
      }
    }

    if (newImages.length > 0) {
      setTempImages([...tempImages, ...newImages]);
    }
  };

  // 过滤出当前语言的选中行
  const currentLanguageSelectedRows = selectedRows.filter(row => row.language === selectedLanguage);

  const {
    loading: processing,
    run: runSmartMatch
  } = useRequest(
    async () => {
      if (!renderTableData || renderTableData.length === 0) {
        throw new Error('No table data available');
      }

      if (currentLanguageSelectedRows.length === 0) {
        throw new Error('No rows selected for current language');
      }

      // 移除 id 字段，只保留需要的字段
      const finalImages: UploadedImage[] = tempImages.map(({ id, ...rest }) => rest);

      // 准备勾选行的信息：customId 和 copy 值
      const [headerRow] = renderTableData;
      const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);

      const selectedRowsInfo = currentLanguageSelectedRows.map(row => {
        const rowIndex = getRowIndexByCustomId(renderTableData, row.customId);
        const copyValue = rowIndex !== -1 ? renderTableData[rowIndex][columnIndexes.copy].value || '' : '';
        return {
          customId: row.customId,
          copyValue: copyValue.trim(),
          groupName: row.groupName
        };
      });

      console.log('Start calling smart match API...');
      console.log('Image count:', finalImages.length);
      console.log('Selected row info:', selectedRowsInfo);

      const hasMultiTable = tableGroups.length >1;

      console.log('Match mode:', hasMultiTable ? 'Grouped mode' : 'Single table mode');

      let matchResult;

      if (hasMultiTable) {
        const uniqueGroups = [...new Set(selectedRowsInfo.map(row => row.groupName))];
        const groupedData = uniqueGroups.map(groupName => ({
          group: groupName === '' ? 'Default Group' : groupName,
          rows: selectedRowsInfo
            .filter(row => row.groupName === groupName)
            .map(row => ({
              customId: row.customId,
              copyValue: row.copyValue
            }))
        }));

        console.log('分组数据:', groupedData);

        matchResult = await groupedIntelligentMatchApi(
          finalImages.map(img => ({ base64: img.base64, fileName: img.fileName })),
          groupedData
        );
      } else {
        console.log('Single table mode - auto grouping match');
        console.log('Selected row info:', selectedRowsInfo);
        console.log('Selected customIds being sent to API:', selectedRowsInfo.map(r => r.customId));

        matchResult = await singleTableIntelligentMatchApi(
          finalImages.map(img => ({ base64: img.base64, fileName: img.fileName })),
          selectedRowsInfo.map(row => ({
            customId: row.customId,
            copyValue: row.copyValue
          }))
        );
      }

      console.log('API返回的matchResult:', matchResult);
      console.log('API返回的customIds:', matchResult?.map((g: any) => ({
        matchRow: g.matchRow,
        rowsCustomIds: g.rows?.map((r: any) => r.customId)
      })));

      if (!matchResult) {
        throw new Error('Smart match API call failed, please try again');
      }

      // 复制 renderTableData 进行修改
      let newRenderTableData = [...renderTableData];

      // 创建用户勾选的 customId 集合，用于验证 API 返回的数据
      const selectedCustomIdSet = new Set(
        currentLanguageSelectedRows.map(row => String(row.customId))
      );

      if (hasMultiTable) {
        // 处理分组模式的结果
        matchResult.forEach((groupResult: any) => {
          console.log(`Processing multi-table group: ${groupResult.group}, fileName: ${groupResult.fileName}`);
          console.log(`Group has ${groupResult.rows?.length || 0} rows to process`);
          console.log(`CustomIds in group:`, groupResult.rows?.map((r: any) => r.customId));

          newRenderTableData = processMultiTableGroupResult(
            groupResult,
            finalImages,
            newRenderTableData,
            selectedLanguage,
            columnIndexes,
            selectedCustomIdSet
          );
        });
      } else {
        console.log('Process single table mode result (auto grouping format):', matchResult);

        matchResult.forEach((groupResult: any) => {
          newRenderTableData = processSingleTableGroupResult(
            groupResult,
            finalImages,
            newRenderTableData,
            columnIndexes,
            selectedCustomIdSet,
            selectedLanguage
          );
        });
      }

      console.log('更新后的 renderTableData:', newRenderTableData);
      setRenderTableData(newRenderTableData);

      // 计算匹配结果统计
      const totalImages = tempImages.length;
      const { matchedFileNames } = calculateMatchStatistics(matchResult, hasMultiTable);
      const matchedImages = matchedFileNames.size;

      return { matchResult, totalImages, matchedImages };
    },
    {
      manual: true,
      onSuccess: (result) => {
        const { totalImages, matchedImages } = result || { totalImages: 0, matchedImages: 0 };

        if (matchedImages === 0) {
          // 没有任何匹配 → 警告框
          setMessage({
            type: 'warning',
            content: 'No matches found. None of the uploaded images could be matched. Please try uploading different images for validation.'
          });
        } else {
          // 有匹配 → 信息框
          setMessage({
            type: 'info',
            content: `Results updated. ${matchedImages} of ${totalImages} image${totalImages > 1 ? 's were' : ' was'} matched and added. You can now review the comparison in the table.`
          });
        }

        onClose();
        setTempImages([]);
      },
      onError: (error) => {
        console.error('Smart match failed:', error);
        setMessage({
          type: 'error',
          content: error.message || 'Smart match failed, please try again'
        });
      }
    }
  );

  // 删除图片功能（仅用于上传前删除tempImages中的图片）
  const handleDelete = (id: string) => {
    const newTempImages = tempImages.filter(img => img.id !== id);
    setTempImages(newTempImages);
  };

  // 文件转 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理文件上传
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const newImages: TempImage[] = [];
    const existingMd5Set = new Set(tempImages.map(img => img.md5));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 只处理图片文件
      if (!file.type.startsWith('image/')) {
        continue;
      }

      try {
        // 计算 MD5
        const md5 = await calculateFileMD5(file);

        // 检查是否重复
        if (existingMd5Set.has(md5)) {
          continue;
        }

        // 转换为 base64
        const base64 = await fileToBase64(file);

        newImages.push({
          id: `${Date.now()}_${i}`,
          fileName: file.name,
          base64,
          blob: file,
          md5,
        });

        existingMd5Set.add(md5);
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
      }
    }

    if (newImages.length > 0) {
      setTempImages([...tempImages, ...newImages]);
    }

    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 点击上传按钮
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleConfirm = () => {
    if (tempImages.length === 0) {
      setMessage({
        type: 'warning',
        content: 'Please upload images first'
      });
      return;
    }
    runSmartMatch();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
      <Modal
        title="Upload Screenshots"
        open={visible}
        onCancel={handleCancel}
        width={700}
        footer={
          <div className="flex flex-col">
            <div className="border-t border-gray-200 mb-4"></div>
            <div className="flex justify-start gap-2">
              <Button key="cancel" onClick={handleCancel} disabled={processing}>
                Cancel
              </Button>
              <Button
                className={'hsbcbtn'}
                key="confirm"
                type="primary"
                onClick={handleConfirm}
                disabled={tempImages.length === 0 || processing}
                loading={processing}
              >
                {processing ? 'Analyzing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Upload button */}
          <div className="flex justify-end">
            <Button
              icon={<UploadOutlined />}
              onClick={handleUploadClick}
            >
              Upload
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Image list */}
          {tempImages.length > 0 && (
            <List
              dataSource={tempImages}
              renderItem={(item) => (
                <List.Item
                  className="flex items-center justify-between"
                  extra={
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </Button>
                  }
                >
                  <Space size="middle">
                    <Image
                      src={item.base64}
                      alt={item.fileName}
                      width={60}
                      height={60}
                      style={{ objectFit: 'cover' }}
                      preview={false}
                    />
                    <span>{item.fileName}</span>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>
      </Modal>
  );
};

export default UploadScreenshotsModal;
