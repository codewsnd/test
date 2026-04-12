/**
 * Markdown 消息渲染组件
 * 使用 @ant-design/x-markdown 渲染 Markdown 内容
 * 支持代码高亮、表格、列表等 Markdown 特性
 * 支持流式输出的打字机动画效果
 */
import React, { useState, useRef, useEffect } from 'react';
import { Bubble } from '@ant-design/x';
import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import XMarkdown from '@ant-design/x-markdown';
// import '@ant-design/x-markdown/themes/light.css';
import { hsbcChatTheme } from '@/styles/hsbcChat';

interface MarkdownMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  loading?: boolean; // 可选的加载状态
  streaming?: boolean; // 是否正在流式输出
}

/**
 * Markdown 消息气泡组件
 * 根据消息角色使用不同的样式和位置
 * AI 消息支持 Markdown 渲染和流式动画
 */
const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  id,
  content,
  role,
  loading = false,
  streaming = false
}) => {
  // 流式动画相关状态
  const [hasNextChunk, setHasNextChunk] = useState(false);
  const prevContentRef = useRef('');

  /**
   * 当内容更新时，标记是否有新内容
   */
  useEffect(() => {
    if (streaming && content !== prevContentRef.current) {
      prevContentRef.current = content;
      setHasNextChunk(true);
    } else if (!streaming) {
      setHasNextChunk(false);
    }
  }, [content, streaming]);

  return (
    <Bubble
      key={id}
      // 用户消息靠右，AI 消息靠左
      placement={role === 'user' ? 'end' : 'start'}
      // 显示对应的头像
      avatar={
        <Avatar
          icon={role === 'user' ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: role === 'user'
              ? hsbcChatTheme.token?.colorPrimary
              : hsbcChatTheme.token?.colorSuccess,
            borderRadius: hsbcChatTheme.components?.Avatar?.borderRadius,
          }}
        />
      }
      // 如果是加载状态，显示 loading 动画
      loading={loading}
      // 自定义消息气泡样式，使用汇丰主题色
      styles={{
        content: {
          background: role === 'user'
            ? hsbcChatTheme.token?.colorPrimary
            : '#F7F7F7',
          color: role === 'user' ? '#FFFFFF' : hsbcChatTheme.token?.colorTextBase,
          borderRadius: hsbcChatTheme.token?.borderRadius,
        },
      }}
      // 根据角色和内容渲染不同形式
      contentRender={
        loading
          ? undefined
          : role === 'assistant' && content
          ? () => (
              <XMarkdown
                streaming={{
                  enableAnimation: true,
                  hasNextChunk: streaming && hasNextChunk,
                  animationConfig: { fadeDuration: 400 },
                }}
              >
                {content}
              </XMarkdown>
            )
          : undefined
      }
      // 用户消息使用纯文本
      content={role === 'user' || loading ? content : undefined}
    />
  );
};

export default MarkdownMessage;
