/**
 * 文件作用：渲染表格选择、Comparison Column 选择和操作按钮。
 */
import React from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { CloudUploadOutlined, UploadOutlined } from '@ant-design/icons';
import { isCopyTestGeneratedHeader } from '../table/copyTestTableParser';
import type { CopyTestHeader, CopyTestTableEntry } from '../types';
import { getCopyTestTableOptionLabel } from '../utils/tableOptionUtils';

/** 定义 { Text } 常量。 */
const { Text } = Typography;

/** 定义 CopyTestSelectorsProps 的数据结构。 */
interface CopyTestSelectorsProps {
  canExportToConfluence: boolean;
  canUpload: boolean;
  exporting: boolean;
  onChooseImages: () => void;
  onComparisonColumnChange: (value?: number) => void;
  onExportToConfluence: () => void;
  onTableChange: (value: number) => void;
  preparingUpload: boolean;
  processing: boolean;
  selectedColumnIndex?: number;
  selectedTable?: CopyTestTableEntry;
  selectedTableIndex?: number;
  tables: CopyTestTableEntry[];
}

/** 处理 buildTableOptions 辅助逻辑。 */
const buildTableOptions = (tables: CopyTestTableEntry[]) => {
  return tables.map(table => ({
    value: table.index,
    label: getCopyTestTableOptionLabel(table),
  }));
};

/** 处理 buildComparisonOptions 辅助逻辑。 */
const buildComparisonOptions = (headers: CopyTestHeader[]) => {
  return headers.filter(header => !isCopyTestGeneratedHeader(header)).map(header => ({
    value: header.index,
    label: header.label,
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
