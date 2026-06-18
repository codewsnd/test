/**
 * 文件作用：渲染 Confluence URL 输入栏和导入按钮。
 */
import React from 'react';
import { Button, Input, Space } from 'antd';

/** 定义 CopyTestImportBarProps 的数据结构。 */
interface CopyTestImportBarProps {
  confluenceUrl: string;
  disabled: boolean;
  loading: boolean;
  onConfluenceUrlChange: (value: string) => void;
  onImport: () => void;
}

/** 渲染 CopyTestImportBar 组件。 */
export const CopyTestImportBar: React.FC<CopyTestImportBarProps> = ({
  confluenceUrl,
  disabled,
  loading,
  onConfluenceUrlChange,
  onImport,
}) => {
  return (
    <Space.Compact className="w-full">
      <Input
        value={confluenceUrl}
        onChange={event => onConfluenceUrlChange(event.target.value)}
        placeholder="Confluence URL"
        disabled={disabled}
      />
      <Button type="primary" onClick={onImport} loading={loading}>
        Import
      </Button>
    </Space.Compact>
  );
};
