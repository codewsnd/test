/**
 * 文件作用：渲染 Confluence URL 输入栏和导入按钮。
 */
import React from 'react';
import { Button, Form, Input, Space } from 'antd';

/** 定义 CopyTestImportBarProps 的数据结构。 */
interface CopyTestImportBarProps {
  confluenceUrl: string;
  disabled: boolean;
  error?: string;
  loading: boolean;
  onConfluenceUrlChange: (value: string) => void;
  onImport: () => void;
}

/** 渲染 CopyTestImportBar 组件。 */
export const CopyTestImportBar: React.FC<CopyTestImportBarProps> = ({
  confluenceUrl,
  disabled,
  error,
  loading,
  onConfluenceUrlChange,
  onImport,
}) => {
  return (
    <Form.Item
      className="mb-0 w-full"
      help={error}
      validateStatus={error ? 'error' : undefined}
    >
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
    </Form.Item>
  );
};
