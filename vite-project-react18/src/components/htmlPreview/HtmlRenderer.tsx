import React from 'react';
import { Card, Space, Spin, Typography } from 'antd';
import {
  CodeOutlined,
  EyeOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useSetAtom } from 'jotai';

import {
  htmlPreviewContentAtom,
  htmlPreviewLiveModeAtom,
  htmlPreviewTurnIdAtom,
  showHtmlPreviewSidebarAtom
} from '@/components/htmlPreview/htmlPreviewAtom';
import type { ConversationTurn } from '@/pages/home/components/chat/types';

interface HtmlRendererProps {
  blockKey: string;
  codeContent: string;
  expansionKey?: string;
  language: string;
  turn: ConversationTurn;
}

const getLineCount = (value: string) =>
  value ? value.replace(/\n$/, '').split('\n').length : 0;

const previewCardStyle = (isReady: boolean): React.CSSProperties => ({
  marginBottom: '0.5rem',
  borderRadius: 0,
  border: '1px solid #e5e5e5',
  boxShadow: 'none',
  cursor: isReady ? 'pointer' : 'not-allowed',
  opacity: isReady ? 1 : 0.72,
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
});

const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  blockKey,
  codeContent,
  language,
  turn
}) => {
  const showHtmlPreviewSidebar = useSetAtom(showHtmlPreviewSidebarAtom);
  const setHtmlPreviewTurnId = useSetAtom(htmlPreviewTurnIdAtom);
  const setHtmlPreviewContent = useSetAtom(htmlPreviewContentAtom);
  const setHtmlPreviewLiveMode = useSetAtom(htmlPreviewLiveModeAtom);
  const isAIResponseCompleted = turn.aiResponse.status === 'completed';
  const isAIResponseGenerating =
    turn.aiResponse.status === 'pending' || turn.aiResponse.status === 'streaming';
  const turnWithEditedCodeBlocks = turn as ConversationTurn & {
    editedCodeBlocks?: Record<string, string>;
  };
  const currentCodeContent = turnWithEditedCodeBlocks.editedCodeBlocks?.[blockKey] ?? codeContent;
  const isReady = isAIResponseCompleted && currentCodeContent.trim().length > 0;
  const statusText = isAIResponseGenerating ? 'loading...' : (isReady ? 'Ready to preview' : 'HTML unavailable');
  const lineCount = getLineCount(currentCodeContent);

  const handleOpenPreview = () => {
    if (!isReady) {
      return;
    }

    setHtmlPreviewTurnId(turn.id);
    setHtmlPreviewContent(currentCodeContent);
    setHtmlPreviewLiveMode(false);
    showHtmlPreviewSidebar();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isReady) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenPreview();
    }
  };

  return (
    <Card
      size="small"
      hoverable={isReady}
      style={previewCardStyle(isReady)}
      styles={{ body: { padding: 16 } }}
      onClick={handleOpenPreview}
      role={isReady ? 'button' : undefined}
      tabIndex={isReady ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-4">
        <Space size={12}>
          <div
            className="flex h-10 w-10 items-center justify-center"
            style={{
              background: isReady ? '#fff1f0' : '#f5f5f5',
              color: isReady ? '#cf1322' : '#8c8c8c',
              border: '1px solid #e5e5e5'
            }}
          >
            {isAIResponseGenerating ? <Spin size="small" /> : <FileTextOutlined />}
          </div>
          <div>
            <Typography.Text strong>HTML Preview</Typography.Text>
            <div className="text-xs text-gray-500">
              {language.toUpperCase()} · {lineCount} lines · {statusText}
            </div>
          </div>
        </Space>
        {isReady && (
          <Space size={8} className="text-gray-500">
            <EyeOutlined />
            <CodeOutlined />
          </Space>
        )}
      </div>
    </Card>
  );
};

export default HtmlRenderer;
