/**
 * 文件作用：渲染表格选择、Comparison Column 选择和操作按钮。
 */
import React from 'react';
import { Button, Dropdown, Select, Space, Typography } from 'antd';
import { CloudUploadOutlined, UploadOutlined } from '@ant-design/icons';
import {
  getSourceColumnDisplayLabel,
  isCopyTestGeneratedHeader,
} from '../table/copyTestTableParser';
import type { CopyTestFileExportFormat } from '../export';
import type { CopyTestHeader, CopyTestTableEntry } from '../types';
import { getCopyTestTableOptionLabel } from '../utils/tableOptionUtils';

/** Ant Design 文本组件的局部别名。 */
const { Text } = Typography;

/** 表格、对比列与后续操作区的入参。 */
interface CopyTestSelectorsProps {
  /** 是否允许下载当前选中的完整表格。 */
  canExportFile: boolean;
  /** 是否允许将当前修改回写到 Confluence。 */
  canExportToConfluence: boolean;
  /** 是否允许为当前列选择截图。 */
  canUpload: boolean;
  /** 是否正在回写 Confluence。 */
  exporting: boolean;
  /** 是否正在生成 PDF、Word 或 Excel 文件。 */
  fileExporting: boolean;
  /** 打开截图选择流程的回调。 */
  onChooseImages: () => void;
  /** 更改或清空 Comparison Column 的回调。 */
  onComparisonColumnChange: (value?: number) => void;
  /** 开始回写 Confluence 的回调。 */
  onExportToConfluence: () => void;
  /** 按用户选择的格式下载当前完整表格。 */
  onExportFile: (format: CopyTestFileExportFormat) => void;
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
  return tables.map((table, displayIndex) => ({
    value: table.index,
    label: getCopyTestTableOptionLabel(displayIndex),
  }));
};

/** 过滤生成列并构建 Comparison Column 选项。 */
const buildComparisonOptions = (headers: CopyTestHeader[]) => {
  /** 下拉框允许选择的来源表头，空表头仍保留原始逻辑列。 */
  const selectableHeaders = headers.filter(
    header => !isCopyTestGeneratedHeader(header)
  );
  /** 每个来源表头及其只用于界面展示的标签。 */
  const labeledHeaders = selectableHeaders.map(header => ({
    header,
    label: getSourceColumnDisplayLabel(header.index, header.label),
  }));
  /** 每个展示标签在可选来源列中的出现次数。 */
  const headerLabelCounts = labeledHeaders.reduce((counts, item) => {
    counts.set(item.label, (counts.get(item.label) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  return labeledHeaders.map(item => ({
    value: item.header.index,
    label: (headerLabelCounts.get(item.label) || 0) > 1 && item.header.label.trim() !== ''
      ? `${item.label} (Column ${item.header.index + 1})`
      : item.label,
  }));
};

/** 渲染 CopyTestActionButtons 组件。 */
const CopyTestActionButtons: React.FC<Pick<
  CopyTestSelectorsProps,
  | 'canExportFile'
  | 'canExportToConfluence'
  | 'canUpload'
  | 'exporting'
  | 'fileExporting'
  | 'onChooseImages'
  | 'onExportFile'
  | 'onExportToConfluence'
  | 'preparingUpload'
  | 'selectedColumnIndex'
  | 'selectedTable'
>> = ({
  canExportFile,
  canExportToConfluence,
  canUpload,
  exporting,
  fileExporting,
  onChooseImages,
  onExportFile,
  onExportToConfluence,
  preparingUpload,
  selectedColumnIndex,
  selectedTable,
}) => {
  if (!selectedTable) {
    return null;
  }

  /** 为指定本地文件格式创建无参数菜单点击回调。 */
  const createFileExportHandler = (format: CopyTestFileExportFormat): (() => void) => {
    return () => onExportFile(format);
  };

  return (
    <>
      {selectedColumnIndex !== undefined && (
        <Button
          icon={<UploadOutlined />}
          disabled={!canUpload}
          loading={preparingUpload}
          onClick={onChooseImages}
        >
          Upload Screenshot
        </Button>
      )}
      <Dropdown
        menu={{
          items: [
            {
              key: 'confluence',
              label: 'Confluence',
              disabled: !canExportToConfluence || fileExporting,
              onClick: onExportToConfluence,
            },
            {
              key: 'pdf',
              label: 'PDF',
              disabled: !canExportFile,
              onClick: createFileExportHandler('pdf'),
            },
            {
              key: 'word',
              label: 'Word',
              disabled: !canExportFile,
              onClick: createFileExportHandler('word'),
            },
            {
              key: 'excel',
              label: 'Excel',
              disabled: !canExportFile,
              onClick: createFileExportHandler('excel'),
            },
          ],
        }}
        trigger={['hover']}
      >
        <Button
          icon={<CloudUploadOutlined />}
          disabled={exporting || fileExporting || (!canExportToConfluence && !canExportFile)}
          loading={exporting || fileExporting}
        >
          Export
        </Button>
      </Dropdown>
    </>
  );
};

/** 渲染 CopyTestSelectors 组件。 */
export const CopyTestSelectors: React.FC<CopyTestSelectorsProps> = ({
  canExportFile,
  canExportToConfluence,
  canUpload,
  exporting,
  fileExporting,
  onChooseImages,
  onComparisonColumnChange,
  onExportFile,
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
            canExportFile={canExportFile}
            canExportToConfluence={canExportToConfluence}
            canUpload={canUpload}
            exporting={exporting}
            fileExporting={fileExporting}
            onChooseImages={onChooseImages}
            onExportFile={onExportFile}
            onExportToConfluence={onExportToConfluence}
            preparingUpload={preparingUpload}
            selectedColumnIndex={selectedColumnIndex}
            selectedTable={selectedTable}
          />
        </div>
      </div>
    </Space>
  );
};
