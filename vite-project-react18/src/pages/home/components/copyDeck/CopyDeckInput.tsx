import React, { useMemo } from 'react';
import { Input, Button, Typography, Tooltip, Space, message, Select } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useAtom } from 'jotai';
import {
  copyDeckCurrentViewAtom,
  hideCopyDeckSidebarAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckRenderTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckTableImageAtom,
  copyDeckValuesArrayAtom,
  copyDeckConfluenceInfoAtom,
  copyDeckStorageHtmlAtom,
  copyDeckCurrentTableHtmlAtom,
} from './copyDeckAtom';
import { copyDeckStorageApi, getAttachmentsApi } from '@/api/tool/copyDeckApi';
import {
  getValidTablesCount,
  getTableByValidIndex,
  parseTableByValidIndex,
  extractLanguageCodesByValidIndex,
  extractExistingColumnsByValidIndex,
  filterTableDataByExistingColumns,
} from './utils/confluenceStorageUtils';

const { Text } = Typography;
const { Option } = Select;

// ==================== 辅助函数 ====================

// URL 格式验证函数
export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * 从表格HTML中提取所有图片文件名
 */
export const extractImageFileNames = (tableHtml: string): Set<string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(tableHtml, 'text/html');
  const table = doc.querySelector('table');
  const fileNamesSet = new Set<string>();

  if (!table) {
    return fileNamesSet;
  }

  const images = table.querySelectorAll('ac\\:image, image');
  images.forEach((img) => {
    const attachment = img.querySelector('ri\\:attachment, attachment');
    if (attachment) {
      const fileName = attachment.getAttribute('ri:filename');
      if (fileName) {
        fileNamesSet.add(fileName);
      }
    }
  });

  return fileNamesSet;
};

/**
 * 检查是否为 Test Evidence 列
 */
export const isTestEvidenceColumn = (headerValue: string): boolean => {
  const normalized = headerValue.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('testevidence|values=') ||
         normalized.includes('test evidence|values=');
};

/**
 * 填充单个 Evidence 数据的 base64
 */
export const fillEvidenceBase64 = (
  evidenceData: any[],
  fileNameToBase64Map: Map<string, string>
): void => {
  evidenceData.forEach((item: any) => {
    if (item.fileName && fileNameToBase64Map.has(item.fileName)) {
      if (!item.base64 || item.base64 === '') {
        item.base64 = fileNameToBase64Map.get(item.fileName);
      }
    }
  });
};

/**
 * 更新单个单元格的 Evidence 数据
 */
export const updateCellEvidence = (
  cell: any,
  fileNameToBase64Map: Map<string, string>
): string | null => {
  const cellValue = cell.value || '';
  if (!cellValue) {
    return null;
  }

  try {
    const evidenceData = JSON.parse(cellValue);
    if (Array.isArray(evidenceData)) {
      fillEvidenceBase64(evidenceData, fileNameToBase64Map);
      return JSON.stringify(evidenceData);
    }
  } catch (e) {
    // JSON解析失败，跳过
  }

  return null;
};

/**
 * 更新渲染数据中所有 Test Evidence 列的 base64 数据
 */
export const updateRenderDataWithBase64 = (
  renderData: any[][],
  fileNameToBase64Map: Map<string, string>
): any[][] => {
  const updatedRenderData = JSON.parse(JSON.stringify(renderData));
  const [headerRow, ...dataRows] = updatedRenderData;

  dataRows.forEach((row: any[], rowIndex: number) => {
    row.forEach((cell: any, colIndex: number) => {
      const headerValue = headerRow[colIndex].value || '';

      if (isTestEvidenceColumn(headerValue)) {
        const updatedValue = updateCellEvidence(cell, fileNameToBase64Map);
        if (updatedValue !== null) {
          updatedRenderData[rowIndex + 1][colIndex].value = updatedValue;
        }
      }
    });
  });

  return updatedRenderData;
};

export const CopyDeckInput: React.FC = () => {
  const [confluenceInfo, setConfluenceInfo] = useAtom(copyDeckConfluenceInfoAtom);
  const [currentView, setCurrentView] = useAtom(copyDeckCurrentViewAtom);
  const [,hideCopyDeckSidebar] = useAtom(hideCopyDeckSidebarAtom);
  const [,setRenderTableData] = useAtom(copyDeckRenderTableDataAtom);
  const [,setOriginalTableData] = useAtom(copyDeckOriginalTableDataAtom);
  const [,setTableImageAtom] = useAtom(copyDeckTableImageAtom);
  const [,setValuesArray] = useAtom(copyDeckValuesArrayAtom);
  const [,setSelectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [storageHtml, setStorageHtml] = useAtom(copyDeckStorageHtmlAtom);
  const [, setCurrentTableHtml] = useAtom(copyDeckCurrentTableHtmlAtom);

  // 预览表格的 HTML
  const [previewTableHtml, setPreviewTableHtml] = React.useState<string>('');

  // 获取 Storage HTML 并统计有效表格数量（包含 |values=xxx| 的表格）
  const {
    data: tableCount = 0,
    loading: tableLoading,
    error: tableError
  } = useRequest(
    async () => {
      const trimmedUrl = confluenceInfo.confluenceUrl.trim();

      // URL 为空或格式不正确时不发起请求
      if (!trimmedUrl || !isValidUrl(trimmedUrl)) {
        return 0;
      }

      // 只有在 input 视图时才调用 API
      if (currentView !== 'input') {
        return 0;
      }

      // 调用 storage API
      const response = await copyDeckStorageApi(trimmedUrl);
      const { storage, confluenceTitle } = response;

      setStorageHtml(storage);

      // 保存页面标题到 confluenceInfo
      setConfluenceInfo(prev => ({
        ...prev,
        confluenceTitle: confluenceTitle
      }));

      // 获取有效表格数量（必须包含 |values=xxx| 标记）
      const count = getValidTablesCount(storage);
      console.log('Valid tables found (with |values=xxx|):', count);

      return count;
    },
    {
      refreshDeps: [confluenceInfo.confluenceUrl, currentView],
      debounceWait: 300,
      onError: (error) => {
        console.error('Failed to fetch storage:', error);
        const trimmedUrl = confluenceInfo.confluenceUrl.trim();
        if (trimmedUrl && isValidUrl(trimmedUrl)) {
          message.error('Failed to fetch Confluence storage, please check if the URL is correct');
        }
      },
      onSuccess: (count) => {
        const trimmedUrl = confluenceInfo.confluenceUrl.trim();

        // URL 为空或格式不正确时不处理
        if (!trimmedUrl || !isValidUrl(trimmedUrl)) {
          return;
        }

        if (count > 0) {
          // 如果有表格，自动选择第一个（索引为 0）
          setConfluenceInfo(prev => ({
            ...prev,
            tableName: '0', // 使用索引作为 tableName
            tableIndex: 0
          }));
        } else {
          // 没有找到有效表格
          message.error('No valid table found (tables must contain |values=xxx| in header)');
          setConfluenceInfo(prev => ({
            ...prev,
            tableName: '',
            tableIndex: -1
          }));
        }
      }
    }
  );

  const {
    loading: importLoading,
    run: runImport
  } = useRequest(
    async () => {
      // tableName 现在存储的是表格索引（字符串格式）
      const tableIndex = parseInt(confluenceInfo.tableName || '0');

      if (isNaN(tableIndex) || tableIndex < 0) {
        throw new Error('Invalid table index');
      }

      // 根据有效索引获取表格信息
      const tableInfo = getTableByValidIndex(storageHtml, tableIndex);

      if (!tableInfo) {
        throw new Error('Table not found at index ' + tableIndex);
      }

      const { tableStr: tableHtml, index: actualTableIndex } = tableInfo;
      console.log('Found table at valid index:', tableIndex, 'actual index:', actualTableIndex);

      // 存储表格 HTML 到 atom
      setCurrentTableHtml(tableHtml);
      console.log('tableHtml', tableHtml);

      // 提取语言代码（根据有效索引）
      const languages = extractLanguageCodesByValidIndex(storageHtml, tableIndex);
      setValuesArray(languages);

      // 解析表格数据（根据有效索引）
      const renderData = parseTableByValidIndex(storageHtml, tableIndex);
      console.log('renderData (with edit columns):', renderData);

      if (renderData.length === 0) {
        throw new Error('Failed to parse table data');
      }

      // 存储解析后的表格数据
      setRenderTableData(renderData);

      // 提取 Confluence 中实际存在的列（根据有效索引）
      const existingColumns = extractExistingColumnsByValidIndex(storageHtml, tableIndex);
      console.log('Existing columns in Confluence:', existingColumns);

      // 深拷贝 renderData 并过滤，只保留 Confluence 中实际存在的列
      const deepCopyRenderData = JSON.parse(JSON.stringify(renderData));
      const filteredOriginalData = filterTableDataByExistingColumns(deepCopyRenderData, existingColumns);
      setOriginalTableData(filteredOriginalData);
      console.log('originalTableData filtered to existing columns:', filteredOriginalData);

      // 提取表格中的所有图片文件名
      const fileNamesSet = extractImageFileNames(tableHtml);
      console.log('Extracted image file names:', Array.from(fileNamesSet));

      // 如果找到了文件名，调用后端API获取base64数据
      if (fileNamesSet.size > 0) {
        try {
          const response = await getAttachmentsApi({
            confluenceUrl: confluenceInfo.confluenceUrl.trim(),
            fileNames: Array.from(fileNamesSet)
          });

          console.log('Fetched image base64 data:', response.images);

          // 设置TableImageAtom
          setTableImageAtom(response.images);

          // 创建fileName到base64的映射
          const fileNameToBase64Map = new Map<string, string>();
          response.images.forEach(img => {
            fileNameToBase64Map.set(img.fileName, img.base64);
          });

          // 更新renderData中的base64数据
          const updatedRenderData = updateRenderDataWithBase64(renderData, fileNameToBase64Map);

          // 更新renderTableData
          setRenderTableData(updatedRenderData);
          console.log('renderTableData updated with image base64 data');
        } catch (error) {
          console.error('Failed to fetch image base64 data:', error);
          message.warning('Failed to fetch image data from Confluence attachments');
        }
      }

      // 保存 Confluence 信息（使用实际的表格索引）
      setConfluenceInfo(prev => ({
        ...prev,
        confluenceUrl: prev.confluenceUrl.trim(),
        tableName: String(tableIndex),
        tableIndex: actualTableIndex // 保存实际索引，用于导出时定位
      }));

      // 设置默认选中的语言为第一个语言代码
      if (languages.length > 0) {
        setSelectedLanguage(languages[0]);
      } else {
        console.warn('CopyDeckInput - No language codes found');
      }

      console.log('Parsing completed - renderTableData:', renderData);
      console.log('Parsing completed - languages:', languages);

      // 切换到table视图
      setCurrentView('table');
      console.log('Switched to table view');
    },
    {
      manual: true,
      onError: (error) => {
        console.error('Import error:', error);
        message.error(`Import failed: ${error.message}`);
      }
    }
  );

  // 当 tableName 变化时，自动加载预览表格
  React.useEffect(() => {
    if (storageHtml && confluenceInfo.tableName) {
      const tableIndex = parseInt(confluenceInfo.tableName);
      if (!isNaN(tableIndex) && tableIndex >= 0) {
        const tableInfo = getTableByValidIndex(storageHtml, tableIndex);
        if (tableInfo) {
          setPreviewTableHtml(tableInfo.tableStr);
        } else {
          setPreviewTableHtml('');
        }
      }
    } else {
      setPreviewTableHtml('');
    }
  }, [confluenceInfo.tableName, storageHtml]);

  const handleConfluenceUrlChange = (value: string) => {
    setConfluenceInfo(prev => ({
      ...prev,
      confluenceUrl: value,
      tableName: '',
      tableIndex: -1
    }));
  };

  // 判断是否可以点击 Import 按钮
  const isImportDisabled = !confluenceInfo.confluenceUrl.trim() ||
                          importLoading ||
                          tableCount === 0;

  // 处理 Cancel 按钮
  const handleCancel = () => {
    hideCopyDeckSidebar();
  };

  // 处理 Import 按钮
  const handleImport = () => {
    if (isImportDisabled) return;

    // 验证 URL 格式
    const trimmedUrl = confluenceInfo.confluenceUrl.trim();
    if (!isValidUrl(trimmedUrl)) {
      message.error('Invalid URL format. Please enter a valid http:// or https:// URL');
      return;
    }

    runImport();
  };

  // 渲染 Table 选择组件（始终显示）
  const renderTableSelector = () => {
    return (
      <Select
        placeholder={
          tableLoading
            ? "Fetching tables..."
            : tableCount === 0
              ? "Please enter valid Confluence URL first"
              : "Please select a table"
        }
        value={confluenceInfo.tableName}
        onChange={(value) => {
          setConfluenceInfo(prev => ({
            ...prev,
            tableName: value,
            tableIndex: -1 // 实际索引会在 import 时设置
          }));
        }}
        className="w-full"
        loading={tableLoading}
        notFoundContent={
          tableError
            ? "Loading failed, please check if the URL is correct"
            : tableCount === 0
              ? "Please enter valid Confluence URL first"
              : "No tables found"
        }
        disabled={tableCount === 0 && !tableLoading}
        dropdownStyle={{ maxHeight: '80vh' }}
        optionLabelProp="label"
      >
        {Array.from({ length: tableCount }, (_, index) => (
          <Option
            key={index}
            value={String(index)}
            label={`Table ${index + 1}`}
          >
            Table {index + 1}
          </Option>
        ))}
      </Select>
    );
  };

  return (
    <div className="p-1">
      <p className={'text-[28px] mb-[24px] font-normal'}>
        Copy validation
      </p>

      <p className="text-[20px] mb-[8px] font-normal">
        Import copy deck from confluence
      </p>

      <div className="mb-2">
        <Space size={4} align="center">
          <Text strong>Confluence URL</Text>
          <Tooltip title="Enter the Confluence page URL, the system will automatically detect available tables">
            <QuestionCircleOutlined className="text-gray-500 text-sm" />
          </Tooltip>
        </Space>
      </div>

      <Input
        value={confluenceInfo.confluenceUrl}
        onChange={(e) => handleConfluenceUrlChange(e.target.value)}
        className="mb-4"
        disabled={tableLoading || importLoading}
        suffix={
          <Text type="secondary" className={`text-xs ${tableLoading ? 'opacity-100' : 'opacity-0'}`}>
            Loading...
          </Text>
        }
      />

      {/* Table 选择器一直显示 */}
      <>
        <div className="mb-2">
          <Space size={4} align="center">
            <Text strong>Table</Text>
            <Tooltip title="Select which table to import from the Confluence page">
              <QuestionCircleOutlined className="text-gray-500 text-sm" />
            </Tooltip>
          </Space>
        </div>

        <div className="mb-4">
          {renderTableSelector()}
        </div>

        {/* 表格预览区域 */}
        {previewTableHtml && (
          <>
            <div className="mb-2">
              <Space size={4} align="center">
                <Text strong>Preview</Text>
              </Space>
            </div>
            <div
              className="mb-6"
              style={{
                border: '1px solid #D7D8D6',
                borderRadius: '0',
                position: 'relative'
              }}
            >
              <style dangerouslySetInnerHTML={{ __html: `
                .copy-deck-preview-wrapper {
                  min-width: max-content;
                  transform-origin: top left;
                }

                @media (max-width: 768px) {
                  .copy-deck-preview-wrapper {
                    transform: scale(0.6);
                  }
                }

                @media (min-width: 769px) and (max-width: 1024px) {
                  .copy-deck-preview-wrapper {
                    transform: scale(0.75);
                  }
                }

                @media (min-width: 1025px) {
                  .copy-deck-preview-wrapper {
                    transform: scale(0.85);
                  }
                }

                .copy-deck-preview table {
                  width: auto;
                  min-width: 100%;
                  border-collapse: collapse;
                  background: white;
                  table-layout: auto;
                }
                .copy-deck-preview table th,
                .copy-deck-preview table td {
                  border: 1px solid #D7D8D6;
                  padding: 16px;
                  text-align: left;
                  font-size: 14px;
                  color: #333333;
                  white-space: nowrap;
                }
                .copy-deck-preview table th {
                  background-color: #EDEDED;
                  color: #333333;
                  font-weight: 600;
                  position: sticky;
                  top: 0;
                  z-index: 10;
                }

                /* 优化滚动条样式 */
                .copy-deck-preview-container::-webkit-scrollbar {
                  width: 8px;
                  height: 8px;
                }
                .copy-deck-preview-container::-webkit-scrollbar-track {
                  background: #f1f1f1;
                }
                .copy-deck-preview-container::-webkit-scrollbar-thumb {
                  background: #888;
                  border-radius: 4px;
                }
                .copy-deck-preview-container::-webkit-scrollbar-thumb:hover {
                  background: #555;
                }
              ` }} />
              <div
                className="copy-deck-preview-container"
                style={{
                  maxHeight: '300px',
                  overflow: 'auto'
                }}
              >
                <div className="copy-deck-preview-wrapper">
                  <div
                    className="copy-deck-preview"
                    dangerouslySetInnerHTML={{ __html: previewTableHtml }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </>

      <Space>
        <Button onClick={handleCancel} disabled={importLoading || tableLoading}>
          Cancel
        </Button>
        <Button
          className={'hsbcbtn'}
          type="primary"
          disabled={isImportDisabled || tableLoading}
          onClick={handleImport}
          loading={importLoading}
        >
          Import
        </Button>
      </Space>
    </div>
  );
};

export default CopyDeckInput;
