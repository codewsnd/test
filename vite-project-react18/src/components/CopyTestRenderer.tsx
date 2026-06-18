import React from 'react';
import { Card } from 'antd';
import { CheckSquareOutlined, ArrowRightOutlined } from '@ant-design/icons';
import CopyTest, {
  COPY_TEST_RENDERER_SCOPE_ATTRIBUTE,
  COPY_TEST_TRIGGER_CLASS_NAME,
} from '@/pages/home/components/copyTest/CopyTest';

export const CopyTestRenderer: React.FC = () => {
  return (
    <div className="my-4" {...{ [COPY_TEST_RENDERER_SCOPE_ATTRIBUTE]: 'true' }}>
      <h2>
        I can help you validate copy deck content against UI screenshots and reference language.
      </h2>

      <Card
        className={`max-w-md cursor-pointer relative bg-white ${COPY_TEST_TRIGGER_CLASS_NAME}`}
        hoverable
      >
        <div className="flex gap-3 items-start">
          <div className="text-[16px]">
            <CheckSquareOutlined />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="text-base font-medium text-gray-800">
              Copy Test
            </div>
            <div className="text-sm text-gray-500">
              Confluence validation
            </div>
          </div>
        </div>
        <div className="absolute right-4 bottom-4 text-sm text-gray-500">
          <ArrowRightOutlined className="text-base" />
        </div>
      </Card>

      <CopyTest />
    </div>
  );
};

export default CopyTestRenderer;
