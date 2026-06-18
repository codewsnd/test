/**
 * 文件作用：渲染 CopyTest 导入过程中的加载占位。
 */
import React from 'react';
import { Spin } from 'antd';

/** 渲染 CopyTestLoadingBlock 组件。 */
export const CopyTestLoadingBlock: React.FC = () => {
  return (
    <div className="py-8 text-center">
      <Spin />
    </div>
  );
};
