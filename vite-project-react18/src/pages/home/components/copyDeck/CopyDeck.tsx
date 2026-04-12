import React, { useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Alert,
  Modal,
} from 'antd';
import {
  CloseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { useAtom } from 'jotai';
import {
  hideCopyDeckSidebarAtom,
  toggleCopyDeckFullscreenAtom,
  copyDeckFullscreenAtom,
  copyDeckCurrentViewAtom,
  copyDeckMessageAtom,
} from './copyDeckAtom';
import CopyDeckInput from './CopyDeckInput';
import CopyDeckTable from './CopyDeckTable';
import CopyDeckResult from './CopyDeckResult';

export const CopyDeck: React.FC = () => {
  const [,hideCopyDeckSidebar] = useAtom(hideCopyDeckSidebarAtom);
  const [,toggleFullscreen] = useAtom(toggleCopyDeckFullscreenAtom);
  const [isFullscreen] = useAtom(copyDeckFullscreenAtom);
  const [currentView] = useAtom(copyDeckCurrentViewAtom);
  const [message, setMessage] = useAtom(copyDeckMessageAtom);

  console.log('CopyDeck - currentView:', currentView);

  // 4秒后自动清除消息
  useEffect(() => {
    if (message) {
      const timeout = message.actionText ? 8000 : 4000;
      const timer = setTimeout(() => {
        setMessage(null);
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [message, setMessage]);

  // 处理关闭按钮
  const handleClose = () => {
    Modal.confirm({
      title: 'Confirm exit',
      icon: null,
      content: 'Your progress will be lost. Are you sure you want to leave this screen?',
      okText: 'Confirm',
      cancelText: 'Cancel',
      okButtonProps: { className: 'hsbsbtn' },
      footer: (_, { OkBtn, CancelBtn }) => (
        <div className="flex flex-col">
          <div className="border-t border-gray-200 mb-4"></div>
          <div className="flex justify-start gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      ),
      onOk: () => {
        hideCopyDeckSidebar();
      },
    });
  };

  return (
    <Card
      title="Agent solution"
      className="w-full h-full overflow-hidden relative flex flex-col"
      styles={{ body: { height: 0, flex: 1, display: 'flex', flexDirection: 'column' } }}
      extra={
        <Space>
          <Button
            type="text"
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit' : 'Full Screen'}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleClose}
            title="Close"
          />
        </Space>
      }
    >
      {/* 消息通知 */}
      {message && (
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <div style={{
            minWidth: '288px',
            maxWidth: '500px',
          }}>
            <Alert
              message={(
                <div className="flex items-center gap-2">
                  <span>{message.content}</span>
                  {message.actionText && message.onAction && (
                    <button
                      type="button"
                      className="bg-transparent border-0 p-0 underline cursor-pointer text-inherit"
                      onClick={() => message.onAction?.()}
                    >
                      {message.actionText}
                    </button>
                  )}
                </div>
              )}
              type={message.type}
              showIcon
              closable
              onClose={() => setMessage(null)}
            />
          </div>
        </div>
      )}

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 根据当前视图显示不同的组件 */}
        {currentView === 'input' && <CopyDeckInput />}
        {currentView === 'table' && <CopyDeckTable />}
        {currentView === 'result' && <CopyDeckResult />}
      </div>
    </Card>
  );
};

export default CopyDeck;
