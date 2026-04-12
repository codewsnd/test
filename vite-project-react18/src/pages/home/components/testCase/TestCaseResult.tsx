import React from 'react';
import { Button, Table } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useAtom } from 'jotai';
import { testCaseExportResultAtom } from './testCaseAtom';

interface TestCaseResultProps {
  onClose: () => void;
}

export const TestCaseResult: React.FC<TestCaseResultProps> = ({
  onClose
}) => {
  const [exportResult] = useAtom(testCaseExportResultAtom);

  // 转换导出结果为表格数据
  const tableColumns = [
    {
      title: 'Test Case ID',
      dataIndex: 'testCaseId',
      key: 'testCaseId',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (url: string) => {
        // 从URL中提取标签（最后一个/后面的部分）
        const label = url.split('/').pop() || url;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      },
    },
  ];

  const tableData = exportResult.map((item, index) => ({
    key: index,
    testCaseId: item.testCaseId,
    description: item.description,
  }));
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircleOutlined className="text-green-500 text-2xl"/>
        <span className="text-green-500 text-lg font-bold">Success</span>
      </div>

      <div className="ml-8"> {/* 24px图标 + 8px gap = 32px */}
        <div className="mb-4 text-base">
          Your test case have been successfully exported to Jira.
        </div>

        <div className="mb-4 text-base font-bold">
          Created Jira issues
        </div>

        <Table
          columns={tableColumns}
          dataSource={tableData}
          pagination={false}
          size="small"
          bordered
          className="mb-5"
        />

        <div>
          <Button type="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TestCaseResult;
