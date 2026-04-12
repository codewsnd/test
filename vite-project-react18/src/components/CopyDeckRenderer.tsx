import React from 'react';
import { Card } from 'antd';
import { FileTextOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAtom, useSetAtom } from 'jotai';
import { copyDeckSidebarVisibleAtom, showCopyDeckSidebarAtom } from '../pages/home/components/copyDeck/copyDeckAtom';

export const CopyDeckRenderer: React.FC = () => {
  const [copyDeckSidebarVisible] = useAtom(copyDeckSidebarVisibleAtom);
  const showCopyDeckSidebar = useSetAtom(showCopyDeckSidebarAtom);

  const isViewing = copyDeckSidebarVisible;

  return (
    <div className="my-4">
      {/* 欢迎标题 */}
      <h2>
        I can help you validate your copy deck against UI screenshots. Please launch the Copy validation to begin.
      </h2>

      {/* CopyDeck Card */}
      <Card
        className={`max-w-md cursor-pointer relative ${
          isViewing ? 'bg-gray-100' : 'bg-white'
        }`}
        hoverable={!isViewing}
        onClick={showCopyDeckSidebar}
      >
        <div className="flex gap-3 items-start">
          {/* 第一列：文件图标 */}
          <div className={`text-[16px] ${isViewing ? 'text-gray-500' : ''}`}>
            <FileTextOutlined />
          </div>

          {/* 第二列：文本内容 */}
          <div className="flex-1 flex flex-col gap-1">
            <div className={`text-base font-medium ${
              isViewing ? 'text-gray-500' : 'text-gray-800'
            }`}>
              Copy validation
            </div>
            <div className="text-sm text-gray-500">
              Agent solution
            </div>
          </div>
        </div>

        {/* 右下角箭头图标或Viewing状态 */}
        <div className="absolute right-4 bottom-4 text-sm text-gray-500 flex items-center gap-1.5">
          {isViewing ? (
            <>
              <span>Viewing</span>
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            </>
          ) : (
            <ArrowRightOutlined className="text-base" />
          )}
        </div>
      </Card>
    </div>
  );
};

export default CopyDeckRenderer;
