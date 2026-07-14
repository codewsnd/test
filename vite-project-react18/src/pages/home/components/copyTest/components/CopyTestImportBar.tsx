/**
 * 文件作用：渲染 Confluence URL 输入栏和导入按钮。
 */
import React from 'react';
import { Button, Form, Input, Space } from 'antd';

/** Confluence 导入栏的展示状态与交互回调。 */
interface CopyTestImportBarProps {
  /** 当前输入的 Confluence 页面 URL。 */
  confluenceUrl: string;
  /** 是否禁止编辑 URL。 */
  disabled: boolean;
  /** Import 失败时显示在 URL 输入框下方的提示文本。 */
  error?: string;
  /** 是否正在导入 Confluence 页面。 */
  loading: boolean;
  /** URL 输入变更时的回调。 */
  onConfluenceUrlChange: (value: string) => void;
  /** 点击导入按钮时的回调。 */
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
