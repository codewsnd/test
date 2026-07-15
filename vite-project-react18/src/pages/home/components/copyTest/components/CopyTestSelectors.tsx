/**
 * 文件作用：渲染表格选择、Comparison Column 选择和操作按钮。
 */
import React from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { CloudUploadOutlined, UploadOutlined } from '@ant-design/icons';
import { isCopyTestGeneratedHeader } from '../table/copyTestTableParser';
import type { CopyTestHeader, CopyTestTableEntry } from '../types';
import { getCopyTestTableOptionLabel } from '../utils/tableOptionUtils';

/** Ant Design 文本组件的局部别名。 */
const { Text } = Typography;

/** 表格、对比列与后续操作区的入参。 */
interface CopyTestSelectorsProps {
  /** 是否允许将当前修改回写到 Confluence。 */
  canExportToConfluence: boolean;
  /** 是否允许为当前列选择截图。 */
  canUpload: boolean;
  /** 是否正在回写 Confluence。 */
  exporting: boolean;
  /** 打开截图选择流程的回调。 */
  onChooseImages: () => void;
  /** 更改或清空 Comparison Column 的回调。 */
  onComparisonColumnChange: (value?: number) => void;
  /** 开始回写 Confluence 的回调。 */
  onExportToConfluence: () => void;
  /** 切换当前表格的回调。 */
  onTableChange: (value: number) => void;
  /** 是否正在读取用户选择的截图。 */
  preparingUpload: boolean;
  /** 是否正在执行 AI 校验。 */
  processing: boolean;
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex?: number;
  /** 当前选中的解析表格。 */
  selectedTable?: CopyTestTableEntry;
  /** 当前选中表格的页面内序号。 */
  selectedTableIndex?: number;
  /** 从 Confluence storage 解析出的可选表格。 */
  tables: CopyTestTableEntry[];
}

/** 将解析表格转为表格下拉框选项。 */
const buildTableOptions = (tables: CopyTestTableEntry[]) => {
  return tables.map(table => ({
    value: table.index,
    label: getCopyTestTableOptionLabel(table),
  }));
};

/** 过滤空表头和生成列，构建 Comparison Column 选项。 */
const buildComparisonOptions = (headers: CopyTestHeader[]) => {
  /** 下拉框允许选择的非空来源表头。 */
  const selectableHeaders = headers.filter(
    header => header.label.trim() !== '' && !isCopyTestGeneratedHeader(header)
  );
  /** 每个原始表头文本在可选来源列中的出现次数。 */
  const headerLabelCounts = selectableHeaders.reduce((counts, header) => {
    counts.set(header.label, (counts.get(header.label) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  return selectableHeaders.map(header => ({
    value: header.index,
    label: (headerLabelCounts.get(header.label) || 0) > 1
      ? `${header.label} (Column ${header.index + 1})`
      : header.label,
  }));
};

/** 渲染 CopyTestActionButtons 组件。 */
const CopyTestActionButtons: React.FC<Pick<
  CopyTestSelectorsProps,
  | 'canExportToConfluence'
  | 'canUpload'
  | 'exporting'
  | 'onChooseImages'
  | 'onExportToConfluence'
  | 'preparingUpload'
  | 'selectedColumnIndex'
>> = ({
  canExportToConfluence,
  canUpload,
  exporting,
  onChooseImages,
  onExportToConfluence,
  preparingUpload,
  selectedColumnIndex,
}) => {
  if (selectedColumnIndex === undefined) {
    return null;
  }

  return (
    <>
      <Button
        icon={<UploadOutlined />}
        disabled={!canUpload}
        loading={preparingUpload}
        onClick={onChooseImages}
      >
        Upload Screenshot
      </Button>
      <Button
        icon={<CloudUploadOutlined />}
        disabled={!canExportToConfluence}
        loading={exporting}
        onClick={onExportToConfluence}
      >
        Export to Confluence
      </Button>
    </>
  );
};

/** 渲染 CopyTestSelectors 组件。 */
export const CopyTestSelectors: React.FC<CopyTestSelectorsProps> = ({
  canExportToConfluence,
  canUpload,
  exporting,
  onChooseImages,
  onComparisonColumnChange,
  onExportToConfluence,
  onTableChange,
  preparingUpload,
  processing,
  selectedColumnIndex,
  selectedTable,
  selectedTableIndex,
  tables,
}) => {
  return (
    <Space className="w-full" align="start">
      <div className="min-w-[260px]">
        <Text strong>Table</Text>
        <Select
          className="w-full mt-2"
          value={selectedTableIndex}
          onChange={onTableChange}
          disabled={processing}
          options={buildTableOptions(tables)}
        />
      </div>

      <div className="min-w-[420px] flex-1">
        <Text strong>Comparison Column</Text>
        <div className="mt-2 flex items-center gap-2">
          <Select
            className="min-w-[260px] flex-1"
            placeholder="Select comparison column"
            allowClear
            value={selectedColumnIndex}
            onChange={value => onComparisonColumnChange(value)}
            disabled={processing}
            options={buildComparisonOptions(selectedTable?.headers || [])}
          />
          <CopyTestActionButtons
            canExportToConfluence={canExportToConfluence}
            canUpload={canUpload}
            exporting={exporting}
            onChooseImages={onChooseImages}
            onExportToConfluence={onExportToConfluence}
            preparingUpload={preparingUpload}
            selectedColumnIndex={selectedColumnIndex}
          />
        </div>
      </div>
    </Space>
  );
};
