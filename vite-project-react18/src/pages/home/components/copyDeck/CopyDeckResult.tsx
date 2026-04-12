import React from 'react';
import { Typography, Button, Space } from 'antd';
import { CheckCircleFilled, LinkOutlined } from '@ant-design/icons';
import { useAtom } from 'jotai';
import {
  copyDeckCurrentViewAtom,
  hideCopyDeckSidebarAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckShowUncomparedAtom,
  copyDeckSelectedRowsAtom,
  copyDeckConfluenceInfoAtom
} from './copyDeckAtom';

const { Title, Text, Link } = Typography;

export const CopyDeckResult: React.FC = () => {
  const [,setCurrentView] = useAtom(copyDeckCurrentViewAtom);
  const [,hideCopyDeckSidebar] = useAtom(hideCopyDeckSidebarAtom);
  const [confluenceInfo, setConfluenceInfo] = useAtom(copyDeckConfluenceInfoAtom);
  const [,setSelectedLanguage] = useAtom(copyDeckSelectedLanguageAtom);
  const [,setShowUncompared] = useAtom(copyDeckShowUncomparedAtom);
  const [,setSelectedRows] = useAtom(copyDeckSelectedRowsAtom);

  console.log('confluenceInfo', confluenceInfo);

  const handleClose = () => {
    hideCopyDeckSidebar();
  };

  const handleReturnToReview = () => {
    setCurrentView('table');
  };

  const handleStartNewReview = () => {
    // 重置所有状态
    setConfluenceInfo({ confluenceUrl: '', tableName: '', confluenceTitle: '', tableIndex: -1 });
    setSelectedLanguage('');
    setShowUncompared(false);
    setSelectedRows([]);
    // 返回输入页面
    setCurrentView('input');
  };

  return (
    <div className="p-6">
      <div className="flex gap-6">
        <div className="flex-shrink-0">
          <CheckCircleFilled className="text-green-500 text-5xl" />
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <Title level={3} className="!mb-0 !text-black">
            Success
          </Title>

          <div>
            <Text className="text-base">
              Your Items have been exported to Confluence. You can find them on the{' '}
              <Link
                href={confluenceInfo.confluenceUrl}
                target="_blank"
                className="font-bold text-black underline"
              >
                {confluenceInfo.confluenceTitle} <LinkOutlined />
              </Link>
            </Text>
          </div>

          <Text className="text-base">
            You can now return to the copy deck to continue reviewing, start a new copy review which will clear your current session, or close the feature.
          </Text>

          <Space className="mt-2">
            <Button onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleReturnToReview}>
              Return to review
            </Button>
            <Button onClick={handleStartNewReview}>
              Start new review
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default CopyDeckResult;
