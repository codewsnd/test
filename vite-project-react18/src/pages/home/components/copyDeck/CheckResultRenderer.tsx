import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircleOutlined, ExclamationCircleOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { Collapse, Button } from 'antd';
import { useAtom } from 'jotai';
import chevronDownSvg from '@/assets/chevronDown.svg';
import chevronUpSvg from '@/assets/chevronUp.svg';
import {
  copyDeckRenderTableDataAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckExpandFailedPanelsAtom,
  getColumnIndexes,
  getRowIndexByCustomId,
  updateCellData,
} from './copyDeckAtom';

interface CheckResultRendererProps {
  text: string;
  evidenceData?: string; // 用于获取图片索引
  customId: string; // 用于定位行
}

interface ResultItem {
  fileName: string;
  passed: boolean;
  discrepancies?: Array<{
    expected: string;
    found: string;
  }>;
}

// 解析新的结果格式
const parseNewResultFormat = (text: string): ResultItem[] | null => {
  if (!text || text.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed as ResultItem[];
    }
  } catch (error) {
    console.log('Failed to parse new result format:', error);
  }
  return null;
};

// 解析 evidence 数据获取文件名到索引的映射
const getFileNameToIndexMap = (evidenceData?: string): Map<string, number> => {
  const map = new Map<string, number>();

  if (!evidenceData) {
    return map;
  }

  try {
    const parsed = JSON.parse(evidenceData);
    if (Array.isArray(parsed)) {
      parsed.forEach((item, index) => {
        if (item && item.fileName) {
          map.set(item.fileName, index);
        }
      });
    }
  } catch (error) {
    console.log('Failed to parse evidence data:', error);
  }

  return map;
};

// 渲染成功结果
const renderPassedResult = (
  items: ResultItem[],
  fileNameToIndexMap: Map<string, number>,
  onDeleteClick: () => void,
  onResetClick: () => void
) => {
  const [isHovered, setIsHovered] = useState(false);
  const passedItems = items.filter(item => item.passed);
  if (passedItems.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center mb-1 justify-between">
        <div className="flex items-center">
          <CheckCircleOutlined className="text-green-500 mr-2" />
          <strong>Passed</strong>
        </div>

        <div className="flex gap-0" style={{ visibility: isHovered ? 'visible' : 'hidden' }}>
          <Button
            type="text"
            size="small"
            onClick={onDeleteClick}
            className="text-xs h-6"
            icon={<DeleteOutlined />}
          >
            Delete
          </Button>
          <Button
            type="text"
            size="small"
            onClick={onResetClick}
            className="text-xs h-6"
            icon={<SwapOutlined />}
          >
            Set to Failed
          </Button>
        </div>
      </div>

      <ul className="m-0 pl-6 list-disc">
        {passedItems.map((item, index) => {
          const imageIndex = fileNameToIndexMap.get(item.fileName) ?? 0;
          const screenName = `Screen ${String(imageIndex + 1).padStart(2, '0')}`;
          return (
            <li key={index} className="mb-0.5">
              {screenName}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// 渲染失败结果
const renderFailedResult = (
  items: ResultItem[],
  fileNameToIndexMap: Map<string, number>,
  onDeleteClick: () => void,
  onResetClick: () => void,
  localActiveKey: string[],
  handleCollapseChange: (keys: string | string[]) => void
) => {
  const [isHovered, setIsHovered] = useState(false);
  const failedItems = items.filter(item => !item.passed);
  if (failedItems.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        .copydeck-discrepancy-collapse .ant-collapse-header {
          position: relative !important;
          padding-top: 0 !important;
          padding-right: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 0 !important;
        }
        .copydeck-discrepancy-collapse .ant-collapse-expand-icon {
          position: absolute !important;
          left: -22px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          margin: 0 !important;
        }
        .copydeck-discrepancy-collapse .ant-collapse-header-text {
          margin-inline-start: 0 !important;
        }
        .copydeck-discrepancy-collapse .ant-collapse-content-box {
          padding-top: 4px !important;
          padding-right: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 0 !important;
        }
      `}</style>

      <div className="flex items-center mb-1 justify-between">
        <div className="flex items-center">
          <ExclamationCircleOutlined className="text-red-500 mr-2" />
          <strong>Failed</strong>
        </div>

        <div className="flex gap-0" style={{ visibility: isHovered ? 'visible' : 'hidden' }}>
          <Button
            type="text"
            size="small"
            onClick={onDeleteClick}
            className="text-xs h-6"
            icon={<DeleteOutlined />}
          >
            Delete
          </Button>
          <Button
            type="text"
            size="small"
            onClick={onResetClick}
            className="text-xs h-6"
            icon={<SwapOutlined />}
          >
            Set to Passed
          </Button>
        </div>
      </div>

      <ul className="m-0 pl-6 list-disc">
        {failedItems.map((item, index) => {
          const imageIndex = fileNameToIndexMap.get(item.fileName) ?? 0;
          const screenName = `Screen ${String(imageIndex + 1).padStart(2, '0')}`;
          const discrepancies = item.discrepancies || [];
          const hasDiscrepancies = discrepancies.length > 0;

          return (
            <li key={index} className="mb-1">
              {screenName}

              {hasDiscrepancies && (
                <div className="mt-5">
                  <Collapse
                    size="small"
                    ghost
                    className="copydeck-discrepancy-collapse"
                    activeKey={localActiveKey}
                    onChange={handleCollapseChange}
                    expandIcon={({ isActive }) => (
                      <img
                        src={isActive ? chevronUpSvg : chevronDownSvg}
                        alt=""
                        className="w-[18px] h-[18px]"
                      />
                    )}
                    items={[
                      {
                        key: `discrepancies-${index}`,
                        label: (
                          <span className="text-xs text-gray-600">
                            Found {discrepancies.length} discrepanc{discrepancies.length > 1 ? 'ies' : 'y'}
                          </span>
                        ),
                        children: (
                          <ul className="m-0 pl-7 list-disc">
                            {discrepancies.map((discrepancy, discIndex) => (
                              <li key={discIndex} className="mb-2">
                                <div>Mismatch {String(discIndex + 1).padStart(2, '0')}</div>
                                <div>Expected</div>
                                <div className={'font-bold'}>{discrepancy.expected}</div>
                                <div className={'mt-2'}>Found in picture</div>
                                <div className={'font-bold'}>{discrepancy.found}</div>
                              </li>
                            ))}
                          </ul>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const CheckResultRenderer: React.FC<CheckResultRendererProps> = ({
  text,
  evidenceData,
  customId
}) => {
  const [renderTableData, setRenderTableData] = useAtom(copyDeckRenderTableDataAtom);
  const [selectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [failedPanelsControl] = useAtom(copyDeckExpandFailedPanelsAtom);
  const [localActiveKey, setLocalActiveKey] = useState<string[]>([]);

  const newFormatResult = useMemo(() => {
    if (!text || text.trim() === '') {
      return null;
    }
    return parseNewResultFormat(text);
  }, [text]);
  const fileNameToIndexMap = useMemo(() => getFileNameToIndexMap(evidenceData), [evidenceData]);
  const allActiveKeys = useMemo(() => {
    if (!newFormatResult) {
      return [] as string[];
    }
    const failedItems = newFormatResult.filter(item => !item.passed);
    return failedItems
      .map((item, index) => item.discrepancies && item.discrepancies.length > 0 ? `discrepancies-${index}` : null)
      .filter(Boolean) as string[];
  }, [newFormatResult]);

  // 同步全局状态到本地状态
  useEffect(() => {
    setLocalActiveKey(failedPanelsControl.expanded ? allActiveKeys : []);
  }, [failedPanelsControl.expanded, failedPanelsControl.version, allActiveKeys]);

  // 空值处理
  if (!text || text.trim() === '') {
    return null;
  }

  // 尝试解析新的结果格式
  if (!newFormatResult) {
    return (
      <div className="text-xs text-gray-600">
        {text}
      </div>
    );
  }

  // 处理展开/收起变化
  const handleCollapseChange = (keys: string | string[]) => {
    const activeKeys = Array.isArray(keys) ? keys : [keys];
    setLocalActiveKey(activeKeys);
  };

  // 处理 Delete Passed
  const handleDeletePassed = () => {
    if (!renderTableData || renderTableData.length === 0) {
      return;
    }

    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);
    const rowIndex = getRowIndexByCustomId(renderTableData, customId);

    if (rowIndex === -1 || columnIndexes.result === -1) {
      return;
    }

    // 过滤掉所有 passed 的项
    const updatedResult = newFormatResult.filter(item => !item.passed);
    const newValue = updatedResult.length > 0 ? JSON.stringify(updatedResult) : '';

    const newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.result,
      newValue
    );

    setRenderTableData(newRenderTableData);
  };

  // 处理 Reset Passed to Failed
  const handleResetPassedToFailed = () => {
    if (!renderTableData || renderTableData.length === 0) {
      return;
    }

    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);
    const rowIndex = getRowIndexByCustomId(renderTableData, customId);

    if (rowIndex === -1 || columnIndexes.result === -1) {
      return;
    }

    // 将所有 passed 的项改为 failed，并清空 discrepancies
    const updatedResult = newFormatResult.map(item => {
      if (item.passed) {
        return {
          fileName: item.fileName,
          passed: false,
        };
      }
      return item;
    });

    const newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.result,
      JSON.stringify(updatedResult)
    );

    setRenderTableData(newRenderTableData);
  };

  // 处理 Delete Failed
  const handleDeleteFailed = () => {
    if (!renderTableData || renderTableData.length === 0) {
      return;
    }

    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);
    const rowIndex = getRowIndexByCustomId(renderTableData, customId);

    if (rowIndex === -1 || columnIndexes.result === -1) {
      return;
    }

    // 过滤掉所有 failed 的项
    const updatedResult = newFormatResult.filter(item => item.passed);
    const newValue = updatedResult.length > 0 ? JSON.stringify(updatedResult) : '';

    const newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.result,
      newValue
    );

    setRenderTableData(newRenderTableData);
  };

  // 处理 Reset Failed to Passed
  const handleResetFailedToPassed = () => {
    if (!renderTableData || renderTableData.length === 0) {
      return;
    }

    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);
    const rowIndex = getRowIndexByCustomId(renderTableData, customId);

    if (rowIndex === -1 || columnIndexes.result === -1) {
      return;
    }

    // 将所有 failed 的项改为 passed，并清空 discrepancies
    const updatedResult = newFormatResult.map(item => {
      if (!item.passed) {
        return {
          fileName: item.fileName,
          passed: true,
        };
      }
      return item;
    });

    const newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.result,
      JSON.stringify(updatedResult)
    );

    setRenderTableData(newRenderTableData);
  };

  return (
    <div>
      {renderPassedResult(newFormatResult, fileNameToIndexMap, handleDeletePassed, handleResetPassedToFailed)}
      {renderFailedResult(newFormatResult, fileNameToIndexMap, handleDeleteFailed, handleResetFailedToPassed, localActiveKey, handleCollapseChange)}
    </div>
  );
};
