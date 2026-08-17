/**
 * 文件作用：渲染 CopyTest 导入过程中的加载占位。
 */
import React from 'react';
import { Spin } from 'antd';

/** CopyTest 加载占位入参。 */
interface CopyTestLoadingBlockProps {
  /** 当前异步阶段的明确说明。 */
  label?: string;
}

/** 默认的 Confluence storage 加载说明。 */
const DEFAULT_LOADING_LABEL = 'Loading Confluence tables...';

/** 渲染 CopyTestLoadingBlock 组件。 */
export const CopyTestLoadingBlock: React.FC<CopyTestLoadingBlockProps> = ({
  label = DEFAULT_LOADING_LABEL,
}) => {
  return (
    <div className="py-8 text-center" role="status" aria-live="polite">
      <Spin />
      <div className="mt-2">{label}</div>
    </div>
  );
};
