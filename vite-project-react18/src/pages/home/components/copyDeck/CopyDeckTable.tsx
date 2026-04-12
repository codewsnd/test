import React, { useMemo, useState, useRef } from 'react';
import { Typography, Button, Checkbox, Table, Tabs, message, Modal, ConfigProvider, Tooltip } from 'antd';
import { EditOutlined, UploadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useAtom } from 'jotai';
import { useRequest } from 'ahooks';
import { copyDeckTableTheme } from './copyDeckTableTheme';
import foundComparisonSvg from '@/assets/foundComparison.svg';
import {
  copyDeckCurrentViewAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckShowUncomparedAtom,
  hideCopyDeckSidebarAtom,
  copyDeckRenderTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckValuesArrayAtom,
  copyDeckConfluenceInfoAtom,
  copyDeckSelectedRowsAtom,
  copyDeckGroupTableDataAtom,
  copyDeckStorageHtmlAtom,
  copyDeckExpandFailedPanelsAtom,
  getRowIndexByCustomId,
  parseEvidenceData,
  getColumnIndexes,
  parseResultJSON,
  updateResultJSON,
  updateCellData,
  type SelectedRow,
} from './copyDeckAtom';
import {
  fixVoidElements,
  isTestResultColumn,
  isTestEvidenceColumn,
  formatTestResultToHtml,
  formatTestEvidence,
  replaceTableInStorage,
  extractOriginalTestColumns,
  type CellInfo,
} from './utils/confluenceStorageUtils';
import {
  findResultColumnIndex,
  findEvidenceColumnIndex,
  processLanguageForExistingColumns,
  processLanguageForNewColumns,
} from './utils/exportUtils';
import { languageCompareApi } from '@/api/tool/copyDeckApi';
import {
  extractComparisonData,
  applyComparisonResults,
  updateCopyColumnFailedMarkersInConfluence,
} from './utils/compareLanguage';


// 辅助函数：格式化 Test Result
const formatTestResult = (jsonStr: string, doc: Document): DocumentFragment => {
  return formatTestResultToHtml(jsonStr, doc);
};
import { uploadStorageApi } from '@/api/tool/copyDeckApi';
import { getLanguageDisplayName } from '@/utils/languageUtils';
import UploadScreenshotsModal from './UploadScreenshotsModal';
import { TestEvidenceRenderer } from './TestEvidenceRenderer';
import { CheckResultRenderer } from './CheckResultRenderer';
import { CopyValueRenderer } from './CopyValueRenderer';

const { Title, Text } = Typography;

export const CopyDeckTable: React.FC = () => {
  const [confluenceInfo] = useAtom(copyDeckConfluenceInfoAtom);
  const [renderTableData, setRenderTableData] = useAtom(copyDeckRenderTableDataAtom);
  const [originalTableData, setOriginalTableData] = useAtom(copyDeckOriginalTableDataAtom);
  const [valuesArray] = useAtom(copyDeckValuesArrayAtom);
  const [, setCurrentView] = useAtom(copyDeckCurrentViewAtom);
  const [selectedLanguage, setSelectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [showUncompared, setShowUncompared] = useAtom(copyDeckShowUncomparedAtom);
  const [selectedRows, setSelectedRows] = useAtom(copyDeckSelectedRowsAtom);
  const [, hideCopyDeckSidebar] = useAtom(hideCopyDeckSidebarAtom);
  const [groupTableData] = useAtom(copyDeckGroupTableDataAtom);
  const [storageHtml, setStorageHtml] = useAtom(copyDeckStorageHtmlAtom);
  const [, setExpandFailedPanels] = useAtom(copyDeckExpandFailedPanelsAtom);

  console.log('tableGroups', groupTableData);
  console.log('renderTableData', renderTableData);
  console.log('originalTableData:', originalTableData);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [preUploadedFiles, setPreUploadedFiles] = useState<File[]>([]);
  const [comparing, setComparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== 辅助函数：处理表格列渲染 ====================

  /**
   * 应用单元格属性
   */
  const applyCellAttributes = (
    cellElement: HTMLElement,
    attributes?: Record<string, string>
  ): void => {
    if (attributes) {
      Object.entries(attributes).forEach(([name, value]) => {
        cellElement.setAttribute(name, value);
      });
    }
  };

  /**
   * 设置单元格的 rowspan/colspan
   */
  const setCellSpan = (
    cellElement: HTMLElement,
    rowspan: number,
    colspan: number
  ): void => {
    if (rowspan > 1) {
      cellElement.setAttribute('rowspan', String(rowspan));
    }
    if (colspan > 1) {
      cellElement.setAttribute('colspan', String(colspan));
    }
  };

  /**
   * 渲染表头单元格内容
   */
  const renderHeaderCellContent = (
    cellElement: HTMLElement,
    headerValue: string,
    doc: Document
  ): void => {
    if (isTestResultColumn(headerValue)) {
      const match = headerValue.match(/(Test Result)(.*)/i);
      if (match) {
        cellElement.appendChild(doc.createTextNode(match[1]));
        cellElement.appendChild(doc.createElement('br'));
        cellElement.appendChild(doc.createTextNode(match[2]));
      } else {
        cellElement.textContent = headerValue;
      }
    } else if (isTestEvidenceColumn(headerValue)) {
      const match = headerValue.match(/(Test Evidence)(.*)/i);
      if (match) {
        cellElement.appendChild(doc.createTextNode(match[1]));
        cellElement.appendChild(doc.createElement('br'));
        cellElement.appendChild(doc.createTextNode(match[2]));
      } else {
        cellElement.textContent = headerValue;
      }
    } else {
      cellElement.textContent = headerValue;
    }
  };

  /**
   * 收集 Evidence 数据中的图片信息
   */
  const collectEvidenceImages = (
    cellData: CellInfo,
    imageSet: Set<string>
  ): void => {
    try {
      const evidenceData = JSON.parse(cellData.value);
      if (Array.isArray(evidenceData)) {
        evidenceData.forEach((item: any) => {
          if (item.fileName && item.base64) {
            imageSet.add(JSON.stringify({ fileName: item.fileName, base64: item.base64 }));
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse evidence data:', e);
    }
  };

  /**
   * 渲染数据单元格内容
   */
  const renderDataCellContent = (
    cellElement: HTMLElement,
    cellData: CellInfo,
    columnType: 'result' | 'evidence',
    doc: Document,
    imageSet: Set<string>
  ): void => {
    if (columnType === 'result') {
      if (cellData.value) {
        const formatted = formatTestResult(cellData.value, doc);
        cellElement.appendChild(formatted);
      } else {
        cellElement.appendChild(doc.createElement('br'));
      }
    } else if (columnType === 'evidence') {
      if (cellData.value) {
        const formatted = formatTestEvidence(cellData.value, doc);
        cellElement.appendChild(formatted);
        collectEvidenceImages(cellData, imageSet);
      } else {
        cellElement.appendChild(doc.createElement('br'));
      }
    }
  };

  /**
   * 处理表头行的单元格
   */
  const processHeaderCell = (
    headerCell: CellInfo,
    doc: Document
  ): HTMLElement => {
    const cellElement = doc.createElement('th');
    applyCellAttributes(cellElement, headerCell.attributes);
    setCellSpan(cellElement, headerCell.rowspan, headerCell.colspan);
    renderHeaderCellContent(cellElement, headerCell.value, doc);
    return cellElement;
  };

  /**
   * 处理数据行的单元格
   */
  const processDataCell = (
    headerCell: CellInfo,
    columnType: 'result' | 'evidence',
    rowIndex: number,
    updatedOriginalTableData: CellInfo[][],
    updatedOriginalHeaderRow: CellInfo[],
    doc: Document,
    imageSet: Set<string>
  ): HTMLElement | null => {
    const cellElement = doc.createElement('td');
    const dataRowIndex = rowIndex - 1;
    const originalDataRowIndex = dataRowIndex + 1;

    if (originalDataRowIndex >= updatedOriginalTableData.length) {
      if (!cellElement.hasChildNodes()) {
        cellElement.appendChild(doc.createElement('br'));
      }
      return cellElement;
    }

    const originalDataRow = updatedOriginalTableData[originalDataRowIndex];
    const columnIndex = updatedOriginalHeaderRow.findIndex(h => h.value === headerCell.value);

    if (columnIndex === -1 || !originalDataRow[columnIndex]) {
      if (!cellElement.hasChildNodes()) {
        cellElement.appendChild(doc.createElement('br'));
      }
      return cellElement;
    }

    const cellData = originalDataRow[columnIndex];

    applyCellAttributes(cellElement, cellData.attributes);

    // 处理 isSpanned - 被合并的单元格不添加到 DOM
    if (cellData.isSpanned) {
      return null;
    }

    setCellSpan(cellElement, cellData.rowspan, cellData.colspan);
    renderDataCellContent(cellElement, cellData, columnType, doc, imageSet);

    if (!cellElement.hasChildNodes()) {
      cellElement.appendChild(doc.createElement('br'));
    }

    return cellElement;
  };

  /**
   * 为行添加新列
   */
  const addNewColumnsToRow = (
    row: Element,
    rowIndex: number,
    newColumnsData: Array<{ headerCell: CellInfo; columnType: 'result' | 'evidence'; language: string }>,
    updatedOriginalTableData: CellInfo[][],
    updatedOriginalHeaderRow: CellInfo[],
    doc: Document,
    imageSet: Set<string>
  ): void => {
    const isHeaderRow = rowIndex === 0 || row.parentElement?.tagName.toLowerCase() === 'thead';

    newColumnsData.forEach(({ headerCell, columnType }) => {
      let cellElement: HTMLElement | null;

      if (isHeaderRow) {
        cellElement = processHeaderCell(headerCell, doc);
      } else {
        cellElement = processDataCell(
          headerCell,
          columnType,
          rowIndex,
          updatedOriginalTableData,
          updatedOriginalHeaderRow,
          doc,
          imageSet
        );
      }

      if (cellElement) {
        row.appendChild(cellElement);
      }
    });
  };


  /**
   * 导出：
   * 1. 先将 renderTableData 的勾选数据合并到 originalTableData
   * 2. 找到 storageHtml 中对应索引的 <table>
   * 3. 删除该 <table> 中所有的 Test Result 和 Test Evidence 列
   * 4. 根据更新后的 originalTableData 构建新的 Test Result 和 Test Evidence 列
   * 5. 追加到 <table> 的末尾
   * 6. 替换回完整的 storageHtml
   */
  const convertToConfluenceStorage = (): {
    html: string;
    images: Array<{ fileName: string; base64: string }>;
    exportTableData: CellInfo[][];
  } => {
    if (!storageHtml || !confluenceInfo.tableName || originalTableData.length === 0 || renderTableData.length === 0) {
      throw new Error('Missing required data for export');
    }

    console.log('=== 开始新的导出逻辑 ===');
    console.log('selectedRows:', selectedRows);

    // 步骤 0: 获取 Confluence 中原本存在的 Test Result 和 Test Evidence 列信息
    const originalTestColumns = extractOriginalTestColumns(storageHtml, confluenceInfo.tableName);
    console.log('Confluence 中原本存在的 Test 列:', originalTestColumns);

    // 创建一个 Map 方便快速查找
    const originalTestColumnsMap = new Map<string, { hasResult: boolean; hasEvidence: boolean }>();
    originalTestColumns.forEach(col => {
      originalTestColumnsMap.set(col.language.toLowerCase(), {
        hasResult: col.hasResult,
        hasEvidence: col.hasEvidence
      });
    });

    // 步骤 1: 先将 renderTableData 的勾选数据合并到 originalTableData
    const updatedOriginalTableData: CellInfo[][] = JSON.parse(JSON.stringify(originalTableData));
    const [originalHeaderRow] = updatedOriginalTableData;
    const [renderHeaderRow] = renderTableData;

    const renderCustomIdColIndex = renderHeaderRow.findIndex(h => h.value === 'COPYDECK_CUSTOM_ID');
    const originalCustomIdColIndex = originalHeaderRow.findIndex(h => h.value === 'COPYDECK_CUSTOM_ID');

    if (renderCustomIdColIndex === -1 || originalCustomIdColIndex === -1) {
      throw new Error('COPYDECK_CUSTOM_ID column not found');
    }

    const selectedLanguages = [...new Set(selectedRows.map(row => row.language))];
    console.log('Selected languages:', selectedLanguages);

    // 判断是否为单表模式
    const isSingleTableMode = groupTableData.length === 1;
    console.log('Export mode:', isSingleTableMode ? 'Single table' : 'Multi table');

    // 对每个勾选的语言进行处理
    selectedLanguages.forEach(language => {
      console.log(`\n=== 合并语言数据: ${language} ===`);

      // 检查该语言在 Confluence 原始表格中是否存在 Test 列
      const originalInfo = originalTestColumnsMap.get(language.toLowerCase());
      const languageExistsInConfluence = originalInfo !== undefined;

      console.log(`语言 ${language} 在 Confluence 中是否存在: ${languageExistsInConfluence}`);
      if (originalInfo) {
        console.log(`  - hasResult: ${originalInfo.hasResult}, hasEvidence: ${originalInfo.hasEvidence}`);
      }

      // 判断是否需要创建新列还是更新已有列
      const originalResultColIndex = findResultColumnIndex(originalHeaderRow, language);
      const originalEvidenceColIndex = findEvidenceColumnIndex(originalHeaderRow, language);
      const columnsExistInOriginal = originalResultColIndex !== -1 && originalEvidenceColIndex !== -1;

      console.log(`列是否存在于 originalTableData: ${columnsExistInOriginal}`);
      console.log(`  - originalResultColIndex: ${originalResultColIndex}`);
      console.log(`  - originalEvidenceColIndex: ${originalEvidenceColIndex}`);

      if (columnsExistInOriginal) {
        // 情况A：列在 originalTableData 中存在
        console.log(`语言 ${language} 的列已存在于 originalTableData`);
        processLanguageForExistingColumns(
          language,
          isSingleTableMode,
          updatedOriginalTableData,
          renderTableData,
          selectedRows,
          originalHeaderRow,
          renderHeaderRow
        );
      } else {
        // 情况B：列在 originalTableData 中不存在，需要追加新列
        console.log(`语言 ${language} 的列不存在于 originalTableData，追加新列`);
        processLanguageForNewColumns(
          language,
          isSingleTableMode,
          updatedOriginalTableData,
          renderTableData,
          selectedRows,
          renderHeaderRow
        );
      }
    });

    console.log('=== originalTableData 合并完成 ===');
    console.log('Updated originalTableData header:', updatedOriginalTableData[0]?.map(h => h.value).slice(0, 10));
    console.log('Updated originalTableData first data row:', updatedOriginalTableData[1]);

    // 步骤 2: 根据保存的 tableIndex 直接定位表格
    console.log('使用保存的 tableIndex:', confluenceInfo.tableIndex);

    if (confluenceInfo.tableIndex === -1) {
      throw new Error('Table index not found. Please re-import the table.');
    }

    // 解析 storageHtml
    const parser = new DOMParser();
    const doc = parser.parseFromString(storageHtml, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));

    console.log(`Total tables in storage: ${tables.length}`);
    console.log(`Target table index: ${confluenceInfo.tableIndex}`);

    if (confluenceInfo.tableIndex < 0 || confluenceInfo.tableIndex >= tables.length) {
      throw new Error(`Invalid table index: ${confluenceInfo.tableIndex}, total tables: ${tables.length}`);
    }

    const targetTable = tables[confluenceInfo.tableIndex];
    console.log(`✓ 使用索引 ${confluenceInfo.tableIndex} 定位到目标表格`);
    console.log(`Target table first row text:`, targetTable.querySelector('tr')?.textContent?.substring(0, 100));

    // 2. 删除 <table> 中所有的 Test Result 和 Test Evidence 列
    const headerRow = targetTable.querySelector('thead tr, tr:first-child');
    const allRows = Array.from(targetTable.querySelectorAll('tr'));

    if (!headerRow) {
      throw new Error('Table header row not found');
    }

    // 找出要删除的列索引（所有 Test Result 和 Test Evidence 列）
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

    // 从后往前删除列（避免索引变化）
    columnsToDelete.reverse().forEach(colIndex => {
      allRows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        if (cells[colIndex]) {
          cells[colIndex].remove();
        }
      });
    });

    console.log('Deleted all Test Result/Evidence columns');

    // 3. 更新 Copy 列（语言列）的 Failed 标记到 Confluence 表格
    updateCopyColumnFailedMarkersInConfluence(
      updatedOriginalTableData,
      selectedRows,
      originalCustomIdColIndex,
      allRows,
      doc
    );

    // 4. 收集图片信息并准备新的列数据
    const imageSet = new Set<string>();
    const [updatedOriginalHeaderRow] = updatedOriginalTableData;

    // 4. 根据 updatedOriginalTableData 构建所有 Test Result 和 Test Evidence 列
    const newColumnsData: Array<{
      headerCell: CellInfo;
      columnType: 'result' | 'evidence';
      language: string;
    }> = [];

    // 遍历 updatedOriginalTableData 的 header，找出所有 Test 列
    updatedOriginalHeaderRow.forEach((headerCell, index) => {
      const normalized = headerCell.value.toLowerCase().replace(/\s+/g, '');

      if (normalized.includes('testresult|values=')) {
        // 提取语言代码
        const match = headerCell.value.match(/\|values=([^|]+)\|/);
        const language = match ? match[1].trim() : '';

        newColumnsData.push({
          headerCell,
          columnType: 'result',
          language
        });

        console.log(`添加 Test Result 列: ${language}`);
      } else if (normalized.includes('testevidence|values=') || normalized.includes('test evidence|values=')) {
        // 提取语言代码
        const match = headerCell.value.match(/\|values=([^|]+)\|/);
        const language = match ? match[1].trim() : '';

        newColumnsData.push({
          headerCell,
          columnType: 'evidence',
          language
        });

        console.log(`添加 Test Evidence 列: ${language}`);
      }
    });

    console.log('New columns to add:', newColumnsData.length);

    // 5. 将新列添加到表格
    allRows.forEach((row, rowIndex) => {
      addNewColumnsToRow(
        row,
        rowIndex,
        newColumnsData,
        updatedOriginalTableData,
        updatedOriginalHeaderRow,
        doc,
        imageSet
      );
    });

    // 5. 生成最终的 HTML - 只获取修改后的 table 元素
    let modifiedTableHtml = targetTable.outerHTML;
    modifiedTableHtml = fixVoidElements(modifiedTableHtml);

    console.log('Modified table HTML (first 500 chars):', modifiedTableHtml.substring(0, 500));

    // 7. 使用 replaceTableInStorage 替换回完整的 storageHtml（使用保存的 tableIndex）
    const updatedStorageHtml = replaceTableInStorage(storageHtml, confluenceInfo.tableIndex, modifiedTableHtml);

    const images = Array.from(imageSet).map(s => JSON.parse(s)) as Array<{ fileName: string; base64: string }>;

    console.log('Export completed, images:', images.length);

    return {
      html: updatedStorageHtml,
      images,
      exportTableData: updatedOriginalTableData // 返回 updatedOriginalTableData
    };
  };

  // 导出到 Confluence
  const { loading: exporting, run: runExport } = useRequest(
    async () => {
      if (selectedRows.length === 0) {
        throw new Error('Please select rows to export first');
      }

      try {
        // 1. 生成修改后的完整 storage HTML 和图片数据
        // 注意：convertToConfluenceStorage() 内部已经完成了表格替换，返回的是完整的 updatedStorageHtml
        console.log('=== 开始调用 convertToConfluenceStorage ===');
        const { html: updatedStorageHtml, images, exportTableData } = convertToConfluenceStorage();
        console.log('=== convertToConfluenceStorage 调用成功 ===');
        console.log('=== Updated Storage HTML ===');
        console.log(updatedStorageHtml);
        console.log('=== Generated Images ===');
        console.log(images);
        console.log('================================');

        // 4. 调用后端 API 上传（包含图片数据）
        console.log('=== 准备上传到 Confluence ===');
        console.log('准备上传的 updatedStorageHtml 长度:', updatedStorageHtml.length);

        console.log('=== 开始调用 uploadStorageApi ===');
        const response = await uploadStorageApi({
          confluenceUrl: confluenceInfo.confluenceUrl,
          storageHtml: updatedStorageHtml,
          images: images
        });

        setOriginalTableData(exportTableData);

        message.success('Export successful!');

        // 导出成功后，将 exportTableData 同步回 originalTableData
        // 这样下次导出时，未勾选的行会保留这次导出的最新值
        console.log('=== 同步 exportTableData 到 originalTableData ===');
        setOriginalTableData(exportTableData);

        // 导出成功后，将 updatedStorageHtml 同步回 storageHtml
        // 这样下次导出时，storageHtml 会包含本次添加的列
        console.log('=== 同步 updatedStorageHtml 到 storageHtml ===');
        setStorageHtml(updatedStorageHtml);

        // 切换到结果视图
        setCurrentView('result');
      } catch (error: any) {
        console.error('Export error:', error);
        throw error;
      }
    },
    {
      manual: true,
      onSuccess: () => {
        // 清空选中的行
        setSelectedRows([]);
      },
      onError: (error) => {
        console.error('Export failed:', error);
        message.error(error.message || 'Export failed, please try again');
      }
    }
  );


  // 处理行选择
  const handleRowSelection = (groupIndex: number, selectedKeys: React.Key[]) => {
    const currentGroup = groupTableData[groupIndex];
    if (!currentGroup) {
      return;
    }

    // 获取该组第一行的 customGroup 值作为 groupName
    const groupName = currentGroup[0]?.customGroup || '';

    // 创建当前组所有行的 customId 集合
    const currentGroupCustomIds = new Set(currentGroup.map(row => row.customId));

    // 移除当前组的旧选择（通过检查 customId 是否在当前组中）
    const otherRowsData = selectedRows.filter(row =>
      row.language !== selectedLanguage || !currentGroupCustomIds.has(row.customId)
    );

    // 添加新选择的行
    const newRowsData: SelectedRow[] = selectedKeys.map(key => {
      const row = currentGroup.find(r => r.customId === key);
      return {
        customId: row?.customId || String(key),
        language: selectedLanguage,
        groupName: groupName
      };
    });

    // 合并数据并去重（防止万一出现重复）
    const combined = [...otherRowsData, ...newRowsData];
    const seen = new Set<string>();
    const deduped = combined.filter(row => {
      const key = `${row.language}-${row.customId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    setSelectedRows(deduped);
  };

  // 获取当前选中的行keys
  const getSelectedRowKeys = (groupIndex: number): React.Key[] => {
    const currentGroup = groupTableData[groupIndex];
    if (!currentGroup || currentGroup.length === 0) {
      return [];
    }

    // 创建当前组所有行的 customId 集合
    const currentGroupCustomIds = new Set(currentGroup.map(row => row.customId));

    // 返回属于当前语言且在当前组中的选中行
    return selectedRows
      .filter(row => row.language === selectedLanguage && currentGroupCustomIds.has(row.customId))
      .map(row => row.customId);
  };

  // 生成tabs配置
  const tabItems = useMemo(() => {
    return valuesArray.map(languageCode => ({
      key: languageCode,
      label: getLanguageDisplayName(languageCode),
    }));
  }, [valuesArray]);

  // 返回编辑视图
  const handleEdit = () => {
    Modal.confirm({
      title: 'Confirm change data source?',
      icon: null,
      content: 'Changing the Confluence URL or table name will discard all current progres, this action cannot be undone.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbsbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="border-t border-gray-200 mb-4"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        // 清空所有表格相关的 atom
        setRenderTableData([]);
        setOriginalTableData([]);
        setStorageHtml('');
        setSelectedRows([]);
        setSelectedLanguage('');
        setShowUncompared(false);

        // 跳转到编辑视图
        setCurrentView('input');
      },
    });
  };

  // 处理取消操作
  const handleCancel = () => {
    Modal.confirm({
      title: 'Confirm exit',
      icon: null,
      content: 'Your progress will be lost. Are you sure you want to leave this screen?',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbsbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="border-t border-gray-200 mb-4"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        // 清空所有表格相关的 atom
        setRenderTableData([]);
        setOriginalTableData([]);
        setStorageHtml('');
        setSelectedRows([]);
        setSelectedLanguage('');
        setShowUncompared(false);

        // 关闭侧边栏
        hideCopyDeckSidebar();
      },
    });
  };

  // 处理导出操作
  const handleExport = () => {
    if (selectedRows.length === 0) {
      message.warning('Please select rows to export first');
      return;
    }

    Modal.confirm({
      title: 'Confirm export',
      icon: null,
      content: 'This operation will update the table in your Confluence page and add the corresponding Test Result and Test Evidence columns. Are you sure you want to proceed?',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbsbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="border-t border-gray-200 mb-4"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        runExport();
      },
    });
  };

  // 处理图片删除
  const handleImageDelete = (customId: string, imageIndex: number) => {
    if (!renderTableData || renderTableData.length === 0) {
      return;
    }

    // 弹出确认对话框
    Modal.confirm({
      title: 'Confirm deletion',
      icon: null,
      content: 'Are you sure you want to delete? This action cannot be undone.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbsbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="border-t border-gray-200 mb-4"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        // 用户确认删除，执行删除逻辑
        performImageDelete(customId, imageIndex);
      },
    });
  };

  // 实际执行图片删除的逻辑
  const performImageDelete = (customId: string, imageIndex: number) => {
    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);

    if (columnIndexes.evidence === -1 || columnIndexes.customId === -1) {
      return;
    }

    const rowIndex = getRowIndexByCustomId(renderTableData, customId);
    if (rowIndex === -1) {
      return;
    }

    // 解析evidence数据
    const evidenceArray = parseEvidenceData(renderTableData[rowIndex][columnIndexes.evidence].value);
    if (imageIndex < 0 || imageIndex >= evidenceArray.length) {
      return;
    }

    // 获取要删除的图片信息
    const deletedImage = evidenceArray[imageIndex];
    console.log('=== 删除图片 ===');
    console.log('imageIndex:', imageIndex);
    console.log('deletedImage:', deletedImage);
    console.log('deletedImage.fileName:', deletedImage?.fileName);

    // 删除指定索引的图片
    evidenceArray.splice(imageIndex, 1);

    // 更新 evidence 列
    let newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.evidence,
      JSON.stringify(evidenceArray)
    );

    // 更新 Result 列
    if (columnIndexes.result !== -1) {
      // 找到所有与当前行共享 Evidence 的行（通过 rowspan 和 isSpanned）
      const evidenceCell = renderTableData[rowIndex][columnIndexes.evidence];
      let rowsToUpdate: number[] = [];

      if (evidenceCell.isSpanned) {
        // 如果当前行是 isSpanned（被合并的行），向上查找第一行
        let firstRowIndex = rowIndex - 1;
        while (firstRowIndex > 0) {
          const cell = renderTableData[firstRowIndex][columnIndexes.evidence];
          if (!cell.isSpanned) {
            // 找到第一行，获取其 rowspan
            const rowspan = cell.rowspan || 1;
            // 包括第一行和所有被合并的行
            rowsToUpdate = Array.from({ length: rowspan }, (_, i) => firstRowIndex + i);
            break;
          }
          firstRowIndex--;
        }
      } else {
        // 如果当前行是第一行，根据 rowspan 找到所有合并的行
        const rowspan = evidenceCell.rowspan || 1;
        rowsToUpdate = Array.from({ length: rowspan }, (_, i) => rowIndex + i);
      }

      console.log(`需要更新 Result 的行索引:`, rowsToUpdate);

      // 更新所有合并行的 Result 数据
      rowsToUpdate.forEach(updateRowIndex => {
        const currentResultData = newRenderTableData[updateRowIndex][columnIndexes.result].value;
        const isAllImagesDeleted = evidenceArray.length === 0;

        console.log(`=== 更新 Result（行索引：${updateRowIndex}）===`);
        console.log('currentResultData:', currentResultData);

        try {
          const parsed = JSON.parse(currentResultData);

          // 检查是否为新格式（数组格式）
          if (Array.isArray(parsed)) {
            console.log('Result 是新格式（数组）:', parsed);

            // 新格式：[{fileName, passed, discrepancies}]
            // 过滤掉被删除的图片
            const updatedResult = parsed.filter((item: any) => {
              const shouldKeep = item.fileName !== deletedImage.fileName;
              console.log(`检查 fileName: ${item.fileName}, 删除的: ${deletedImage.fileName}, 保留: ${shouldKeep}`);
              return shouldKeep;
            });

            console.log('过滤后的 Result:', updatedResult);

            if (isAllImagesDeleted || updatedResult.length === 0) {
              console.log('所有图片已删除，清空 Result');
              newRenderTableData = updateCellData(newRenderTableData, updateRowIndex, columnIndexes.result, '');
            } else {
              console.log('更新 Result 为:', JSON.stringify(updatedResult));
              newRenderTableData = updateCellData(
                newRenderTableData,
                updateRowIndex,
                columnIndexes.result,
                JSON.stringify(updatedResult)
              );
            }
          } else {
            // 旧格式：{"PASS":[],"FAILED":[]}
            const resultJSON = parseResultJSON(currentResultData);
            const updatedResult = updateResultJSON(resultJSON, 'remove', {
              filename: deletedImage.fileName,
              displayName: deletedImage.displayName
            });

            if (isAllImagesDeleted) {
              newRenderTableData = updateCellData(newRenderTableData, updateRowIndex, columnIndexes.result, '');
            } else {
              newRenderTableData = updateCellData(
                newRenderTableData,
                updateRowIndex,
                columnIndexes.result,
                JSON.stringify(updatedResult)
              );
            }
          }
        } catch {
          // 不是JSON格式
          if (isAllImagesDeleted) {
            newRenderTableData = updateCellData(newRenderTableData, updateRowIndex, columnIndexes.result, '');
          }
        }
      });
    }

    setRenderTableData(newRenderTableData);
  };

  // 获取当前选中的行总数
  const totalSelectedRows = selectedRows.filter(row => row.language === selectedLanguage).length;

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setPreUploadedFiles(Array.from(files));
      setUploadModalVisible(true);
    }
    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 点击上传按钮
  const handleUploadScreenshot = () => {
    fileInputRef.current?.click();
  };

  // 关闭 Modal 时清空预上传的文件
  const handleCloseModal = () => {
    setUploadModalVisible(false);
    setPreUploadedFiles([]);
  };

  // 生成表格列配置
  const getTableColumns = (currentGroup: any[]) => {
    const columns: any[] = [];

    // 获取组名 - 使用第一行的 customGroup 值
    const groupName = currentGroup.length > 0 && currentGroup[0]?.customGroup?.trim()
      ? currentGroup[0].customGroup.trim()
      : '';

    // Copy 列
    columns.push({
      title: `Copy`,
      dataIndex: 'copy',
      key: 'copy',
      width: '33%',
      render: (_text: string, record: any) => (
        <CopyValueRenderer
          text={record.copy || ''}
          customId={record.customId}
          groupName={groupName}
        />
      ),
    });

    // Check Result 列 - 特殊渲染规则：如果是字符串则直接渲染字符串
    columns.push({
      title: `Check Result`,
      dataIndex: 'result',
      key: 'result',
      width: '33%',
      render: (text: string, record: any) => {
        const resultText = record.result || '';

        // 检查是否为JSON格式
        try {
          JSON.parse(resultText);

          // 获取正确的 evidence 数据
          // 如果当前行的 Evidence 是 isSpanned（被合并），需要向上查找第一行
          let evidenceData = record.evidence || '';

          // 检查当前行的 evidenceCell 是否为 isSpanned
          if (record.evidenceCell && record.evidenceCell.isSpanned) {
            // 向上查找第一行（isSpanned=false 的行）
            const currentIndex = currentGroup.findIndex(r => r.customId === record.customId);
            if (currentIndex > 0) {
              // 从当前行向前查找
              for (let i = currentIndex - 1; i >= 0; i--) {
                const prevRow = currentGroup[i];
                if (prevRow.evidenceCell && !prevRow.evidenceCell.isSpanned) {
                  // 找到第一行，使用它的 evidence
                  evidenceData = prevRow.evidence || '';
                  break;
                }
              }
            }
          }

          // 如果是JSON，使用 CheckResultRenderer，并传递 evidence 数据
          return (
            <CheckResultRenderer
              text={resultText}
              evidenceData={evidenceData}
              customId={record.customId}
            />
          );
        } catch {
          // 如果是字符串，直接渲染
          return <Text className="text-sm">{resultText}</Text>;
        }
      },
    });

    // Test Evidence 列 - 根据 CellInfo 中的 rowspan 和 isSpanned 属性进行合并
    columns.push({
      title: `Test Evidence`,
      dataIndex: 'evidence',
      key: 'evidence',
      width: '33%',
      onCell: (record: any) => {
        // 使用 CellInfo 对象中的 rowspan 和 isSpanned 属性
        if (record.evidenceCell) {
          const { rowspan, isSpanned } = record.evidenceCell;

          // 如果被合并（isSpanned=true），隐藏单元格
          if (isSpanned) {
            return { rowSpan: 0 };
          }

          // 如果有合并（rowspan > 1），显示合并的单元格
          if (rowspan > 1) {
            return { rowSpan: rowspan };
          }
        }

        // 默认情况：不合并
        return {};
      },
      render: (_text: string, record: any) => {
        return (
          <TestEvidenceRenderer
            text={record.evidence || ''}
            onDeleteImage={(imageIndex) => {
              handleImageDelete(record.customId, imageIndex);
            }}
          />
        );
      },
    });

    return columns;
  };


  // 处理 Compare 按钮点击
  const handleCompare = async () => {
    // Extract comparison data - now returns an object with comparisonData, referenceLanguageCode, targetLanguageCode
    const {
      comparisonData,
      referenceLanguageCode,
      targetLanguageCode
    } = extractComparisonData(originalTableData, selectedLanguage);

    if (!referenceLanguageCode) {
      message.error('Reference language (gl or en) not found');
      return;
    }

    if (comparisonData.length === 0) {
      message.warning('No data to compare');
      return;
    }

    // 每次执行 Check definition 都重置为默认折叠
    setExpandFailedPanels((prev) => ({
      expanded: false,
      version: prev.version + 1
    }));
    setComparing(true);

    try {
      const response = await languageCompareApi({
        referenceLanguage: referenceLanguageCode,
        selectedLanguage: targetLanguageCode || selectedLanguage,
        comparisonData: comparisonData
      });

      if (response && response.differences.length > 0) {
        const differences = response.differences;

        // Update both originalTableData and renderTableData to trigger re-render
        const updatedOriginalData = applyComparisonResults(
          originalTableData,
          selectedLanguage,
          differences
        );
        setOriginalTableData(updatedOriginalData);

        // Also update renderTableData to trigger table re-render
        const updatedRenderData = applyComparisonResults(
          renderTableData,
          selectedLanguage,
          differences
        );
        setRenderTableData(updatedRenderData);

        message.success(`Found ${differences.length} rows with issues`);
      } else {
        message.success('All checks passed!');
      }
    } catch (error) {
      console.error('Compare error:', error);
      message.error('Comparison failed, please try again');
    } finally {
      setComparing(false);
    }
  };

  return (
    <ConfigProvider theme={copyDeckTableTheme}>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto p-1">
          <p className={'text-[28px] mb-[24px]'}>
            Copy validation
          </p>

        <div className="flex justify-between items-center mb-4">
          <Text strong className="text-base">Copy deck</Text>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            Edit
          </Button>
        </div>

        <div className="flex items-start gap-10 mb-6">
          <div className="flex flex-col flex-[1]">
            <Text type="secondary" className="text-xs mb-2">Confluence page</Text>
            <Text className="text-sm font-medium mb-1">
              {confluenceInfo.confluenceTitle}
            </Text>
            <Text
              ellipsis={{ tooltip: confluenceInfo.confluenceUrl }}
              className="text-sm text-gray-600"
            >
              {confluenceInfo.confluenceUrl}
            </Text>
          </div>

          {/*<div className="flex flex-col flex-[1]">*/}
          {/*  <Text type="secondary" className="text-xs mb-2">Table name</Text>*/}
          {/*  <Text className="text-sm">*/}
          {/*    {confluenceInfo.tableName}*/}
          {/*  </Text>*/}
          {/*</div>*/}
        </div>

        <div className="flex items-center justify-between">
          <Tabs
            activeKey={selectedLanguage}
            onChange={(key) => setSelectedLanguage(key)}
            items={tabItems}
          />

          <Checkbox
            checked={showUncompared}
            onChange={(e) => setShowUncompared(e.target.checked)}
          >
            Show un-compared items
          </Checkbox>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <Button
            icon={<UploadOutlined />}
            onClick={handleUploadScreenshot}
            disabled={totalSelectedRows === 0}
          >
            Upload screenshot
          </Button>
          {!selectedLanguage.includes('gl') && !selectedLanguage.includes('en') &&
              <div className="flex items-center gap-4">
                <div
                    className="inline-flex items-center cursor-pointer text-[16px] font-medium"
                    onClick={comparing ? undefined : handleCompare}
                >
                  {comparing ? (
                    <span className="inline-block w-[18px] h-[18px] mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <img
                      src={foundComparisonSvg}
                      alt=""
                      className="w-[18px] h-[18px] mr-2"
                    />
                  )}
                  <span>Check definition</span>
                  <Tooltip title="Compare localized copy with the Global English copy to identiy linguistic and formatting suggestions.">
                    <QuestionCircleOutlined className="text-gray-400 hover:text-gray-600 ml-1 w-[18px] h-[18px]" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-4">
                  <div
                      className="inline-flex items-center cursor-pointer text-[16px] font-medium underline"
                      onClick={() =>
                        setExpandFailedPanels((prev) => ({
                          expanded: true,
                          version: prev.version + 1
                        }))
                      }
                  >
                    <span>Expand all</span>
                  </div>
                  <div
                      className="inline-flex items-center cursor-pointer text-[16px] font-medium underline"
                      onClick={() =>
                        setExpandFailedPanels((prev) => ({
                          expanded: false,
                          version: prev.version + 1
                        }))
                      }
                  >
                    <span>Collapse all</span>
                  </div>
                </div>
              </div>
          }
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>


        {/* 渲染分组表格 */}
        {groupTableData.map((group, groupIndex) => {
          // 获取组名 - 使用第一行的 customGroup 值
          const groupName = group.length > 0 && group[0]?.customGroup?.trim()
            ? group[0].customGroup.trim()
            : '';

          // 判断是否应该显示组标题（customGroup 有值时显示）
          const shouldShowGroupTitle = groupName !== '';

          return (
            <div key={groupIndex} className="mb-6">
              {shouldShowGroupTitle && (
                <Title level={5} className="!mb-3">
                  {groupName}
                </Title>
              )}
              <Table
                columns={getTableColumns(group)}
                dataSource={group}
                pagination={false}
                size="small"
                bordered={false}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: getSelectedRowKeys(groupIndex),
                  onChange: (selectedKeys) => handleRowSelection(groupIndex, selectedKeys),
                }}
                rowKey={(record) => record.customId}
                scroll={{ x: true }}
                rowClassName="align-top"
              />
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center">
        <Text strong style={{ color: 'black' }}>
          {selectedRows.length === 0
            ? '0 items selected'
            : selectedRows.length === 1
            ? '1 item selected'
            : `${selectedRows.length} items selected`}
        </Text>

        <div className="flex gap-3">
          <Button onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            className={'hsbcbtn'}
            type="primary"
            disabled={selectedRows.length === 0}
            loading={exporting}
            onClick={handleExport}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Upload Screenshots Modal */}
      <UploadScreenshotsModal
        visible={uploadModalVisible}
        onClose={handleCloseModal}
        initialFiles={preUploadedFiles}
      />
    </div>
    </ConfigProvider>
  );
};

export default CopyDeckTable;
