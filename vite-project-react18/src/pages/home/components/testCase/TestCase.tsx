import React from 'react';
import {
  Card,
  Button,
  Space,
  ConfigProvider,
} from 'antd';
import {
  CloseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CopyOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import {useAtom, useSetAtom} from 'jotai';
import {
  hideTestCaseSidebarAtom,
  toggleTestCaseFullscreenAtom,
  testCaseFullscreenAtom,
  testCaseStreamingDataAtom,
  testCaseCurrentViewAtom
} from './testCaseAtom';
import TestCaseResult from './TestCaseResult';
import TestCaseTable from './TestCaseTable';
import TestCaseForm from './TestCaseForm';
import { testCaseTheme } from '../../../../styles/style';

export const TestCase: React.FC = () => {
  const hideTestCaseSidebar = useSetAtom(hideTestCaseSidebarAtom);
  const toggleFullscreen = useSetAtom(toggleTestCaseFullscreenAtom);
  const [isFullscreen] = useAtom(testCaseFullscreenAtom);
  const [streamingData, setStreamingData] = useAtom(testCaseStreamingDataAtom);
  const [currentView, setCurrentView] = useAtom(testCaseCurrentViewAtom);

  const handleClose = () => {
    setCurrentView('form');
    setStreamingData('');
    hideTestCaseSidebar();
  };

  return (
    <ConfigProvider theme={testCaseTheme}>
      <Card
        title="Test Case"
        style={{
          width: '100%', height: '100%', padding: '16px',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative'
        }}
        extra={
          <Space>
            {currentView === 'table' && (
              <>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  title="复制"
                />
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  title="下载"
                />
              </>
            )}
            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>}
              onClick={toggleFullscreen}
            />
            <Button
              type="text"
              icon={<CloseOutlined/>}
              onClick={hideTestCaseSidebar}
              title="关闭"
            />
          </Space>
        }
      >
        {currentView === 'form' && (
          <TestCaseForm />
        )}

        {currentView === 'result' && (
          <TestCaseResult
            streamingData={streamingData}
            onClose={handleClose}
          />
        )}

        {currentView === 'table' && (
          <TestCaseTable />
        )}
      </Card>
    </ConfigProvider>
  );
};

export default TestCase;
