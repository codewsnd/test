import React, { useState, useEffect, useMemo } from 'react';
import { Collapse } from 'antd';
import { useAtom } from 'jotai';
import statusWarningSvg from '@/assets/statusWarning.svg';
import electricitySvg from '@/assets/electricity.svg';
import clearSvg from '@/assets/clear.svg';
import chevronDownSvg from '@/assets/chevronDown.svg';
import chevronUpSvg from '@/assets/chevronUp.svg';
import {
  copyDeckRenderTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckExpandFailedPanelsAtom,
  copyDeckMessageAtom,
  getColumnIndexes,
  getRowIndexByCustomId,
  updateCellData,
} from './copyDeckAtom';
import { parseFailedMarker, type CopyDeckIssueType } from './utils/compareLanguage';

interface CopyValueRendererProps {
  text: string;        // 单元格的完整值，可能包含 "Failed: <json reasons>"
  customId: string;     // 用于定位行
  groupName: string;    // 分组名称
}

export const CopyValueRenderer: React.FC<CopyValueRendererProps> = ({
  text,
  customId,
  groupName: _groupName
}) => {
  void _groupName;
  const [renderTableData, setRenderTableData] = useAtom(copyDeckRenderTableDataAtom);
  const [originalTableData, setOriginalTableData] = useAtom(copyDeckOriginalTableDataAtom);
  const [selectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [failedPanelsControl] = useAtom(copyDeckExpandFailedPanelsAtom);
  const [, setMessage] = useAtom(copyDeckMessageAtom);
  const [localActiveKey, setLocalActiveKey] = useState<string[]>([]);

  // 解析单元格值
  const { originalValue, hasFailed, reasons } = parseFailedMarker(text);
  const groupedReasons = useMemo(() => {
    const issueTypeOrder: CopyDeckIssueType[] = ['Semantic', 'Grammar', 'Punctuation', 'Character'];
    const issuesByType = new Map<CopyDeckIssueType, string[]>();

    reasons.forEach(issue => {
      if (!issuesByType.has(issue.type)) {
        issuesByType.set(issue.type, []);
      }
      const issueList = issuesByType.get(issue.type);
      if (issueList) {
        issueList.push(issue.reason);
      }
    });

    return issueTypeOrder
      .map(type => ({
        type,
        reasons: issuesByType.get(type) || [],
      }))
      .filter(group => group.reasons.length > 0);
  }, [reasons]);

  // 同步全局状态到本地状态
  useEffect(() => {
    setLocalActiveKey(failedPanelsControl.expanded ? ['failed-reasons'] : []);
  }, [failedPanelsControl.expanded, failedPanelsControl.version]);

  // 处理展开/收起变化
  const handleCollapseChange = (keys: string | string[]) => {
    const activeKeys = Array.isArray(keys) ? keys : [keys];
    setLocalActiveKey(activeKeys);
  };

  // 处理 Dismiss suggestion 点击
  const handleDismissSuggestions = () => {
    if (!renderTableData || renderTableData.length === 0 || !originalTableData || originalTableData.length === 0) {
      return;
    }

    const [headerRow] = renderTableData;
    const columnIndexes = getColumnIndexes(headerRow, selectedLanguage);
    const rowIndex = getRowIndexByCustomId(renderTableData, customId);

    if (rowIndex === -1 || columnIndexes.copy === -1) {
      return;
    }

    const dismissLanguage = selectedLanguage;
    const previousRenderValue = renderTableData[rowIndex][columnIndexes.copy].value;
    const previousOriginalValue = originalTableData[rowIndex][columnIndexes.copy].value;

    // 移除 "Failed: <json reasons>" 部分，只保留原始值
    const newRenderTableData = updateCellData(
      renderTableData,
      rowIndex,
      columnIndexes.copy,
      originalValue
    );

    // 同时更新 originalTableData
    const newOriginalTableData = updateCellData(
      originalTableData,
      rowIndex,
      columnIndexes.copy,
      originalValue
    );

    setRenderTableData(newRenderTableData);
    setOriginalTableData(newOriginalTableData);

    setMessage({
      type: 'info',
      content: 'Suggestion dismissed.',
      actionText: 'Undo',
      onAction: () => {
        setRenderTableData((prevTableData) => {
          if (!prevTableData || prevTableData.length === 0) {
            return prevTableData;
          }

          const [prevHeaderRow] = prevTableData;
          const prevColumnIndexes = getColumnIndexes(prevHeaderRow, dismissLanguage);
          const prevRowIndex = getRowIndexByCustomId(prevTableData, customId);

          if (prevRowIndex === -1 || prevColumnIndexes.copy === -1) {
            return prevTableData;
          }

          return updateCellData(
            prevTableData,
            prevRowIndex,
            prevColumnIndexes.copy,
            previousRenderValue
          );
        });

        setOriginalTableData((prevTableData) => {
          if (!prevTableData || prevTableData.length === 0) {
            return prevTableData;
          }

          const [prevHeaderRow] = prevTableData;
          const prevColumnIndexes = getColumnIndexes(prevHeaderRow, dismissLanguage);
          const prevRowIndex = getRowIndexByCustomId(prevTableData, customId);

          if (prevRowIndex === -1 || prevColumnIndexes.copy === -1) {
            return prevTableData;
          }

          return updateCellData(
            prevTableData,
            prevRowIndex,
            prevColumnIndexes.copy,
            previousOriginalValue
          );
        });

        setMessage(null);
      }
    });
  };

  // 空值处理
  if (!originalValue && !hasFailed) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div className="text-sm">
      {/* 原始值 */}
      <div className="whitespace-pre-wrap">{originalValue}</div>

      {/* 失败标记 */}
      {hasFailed && reasons.length > 0 && (
        <div className="mt-10 copy-value-renderer__failed">
          <div className="inline-flex items-center px-2 py-1 border border-solid
           border-[#767676] rounded-none mb-4">
            <img src={electricitySvg} alt="" className="w-[14px] h-[14px] ml-0.5" />
            <span className="text-[12px] font-medium text-black ml-1">AI</span>
            <span className="text-[12px] font-light text-[#333] ml-1">Analysis</span>
          </div>
          <div className="flex items-center mb-4">
            <img src={statusWarningSvg} alt="" className="w-[18px] h-[18px] mr-2" />
            <span className="text-[14px] font-normal">Definition discrepancy</span>
          </div>
          <>
            <style>{`
              .copy-value-renderer__failed .ant-collapse-header {
                align-items: center !important;
                padding-top: 0 !important;
                padding-left: 0 !important;
              }
              .copy-value-renderer__failed .ant-collapse-expand-icon {
                display: flex !important;
                align-items: center !important;
              }
              .copy-value-renderer__failed .ant-collapse-header-text {
                display: flex !important;
                align-items: center !important;
              }
              .copy-value-renderer__failed .ant-collapse-content-box {
                padding-top: 4px !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                padding-bottom: 0 !important;
              }
            `}</style>
            <Collapse
              size="small"
              ghost
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
                  key: 'failed-reasons',
                  label: (
                    <div className="flex items-center">
                      <span className="text-[12px] font-medium">{reasons.length} suggestions identified</span>
                    </div>
                  ),
                  children: (
                    <>
                      <div className="mt-[4px] space-y-3">
                        {groupedReasons.map(group => (
                          <div key={group.type}>
                            <div className="mb-1 text-[12px] font-medium">{group.type}</div>
                            <ul className="m-0 pl-6 list-disc">
                              {group.reasons.map((reason, index) => (
                                <li key={`${group.type}-${index}`} className="text-[12px] font-[350]">
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div
                        className="flex items-center mt-4 cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={handleDismissSuggestions}
                      >
                        <img src={clearSvg} alt="" className="w-[14px] h-[14px] mr-2" />
                        <span className="text-[12px] font-medium">Dismiss suggestion</span>
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </>
        </div>
      )}
    </div>
  );
};

export default CopyValueRenderer;
