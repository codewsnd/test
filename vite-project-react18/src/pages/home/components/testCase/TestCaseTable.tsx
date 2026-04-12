import React from 'react';
import { Button, Table, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useAtom, useSetAtom } from 'jotai';
import { testCaseMarkdownTableAom, testCaseCurrentViewAtom } from './testCaseAtom';
import { convertMarkdownToAntdTableData } from '@/utils/markdownUtils';

const { Title } = Typography;

export const TestCaseTable: React.FC = () => {
  const [testCaseMarkdownTable] = useAtom(testCaseMarkdownTableAom);
  const setCurrentView = useSetAtom(testCaseCurrentViewAtom);

  const handleExportToJira = () => {
    setCurrentView('form');
  };

  return (
    <div className="p-4">
      {/* 第一行：标题和Export按钮 */}
      <div className="flex justify-between items-center mb-4">
        <Title level={3} className="!m-0">
          QA test case
        </Title>
        <Button
          onClick={handleExportToJira}
        >
          Export to Jira
          <ArrowRightOutlined />
        </Button>
      </div>

      {/* 第二行：表格 */}
      <Table
        {...convertMarkdownToAntdTableData(testCaseMarkdownTable)}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: true }}
      />
    </div>
  );
};

export default TestCaseTable;
