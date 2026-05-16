import { useState } from "react";
import { Layout, Tabs } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useAtom } from 'jotai';
import ConversationHistoryCard from "./components/conversationHistory/ConversationHistoryCard";
import ChatArea from "./components/chat/ChatArea";
import { testCaseSidebarVisibleAtom, testCaseFullscreenAtom } from "@/pages/home/components/testCase/testCaseAtom";
import { TestCase } from "@/pages/home/components/testCase/TestCase";
import { copyDeckSidebarVisibleAtom, copyDeckFullscreenAtom } from "./components/copyDeck/copyDeckAtom";
import { CopyDeck } from "./components/copyDeck/CopyDeck";
import { htmlPreviewSidebarVisibleAtom, htmlPreviewFullscreenAtom } from "@/components/htmlPreview/htmlPreviewAtom";
import { HtmlPreview } from "@/components/htmlPreview/HtmlPreview";
import {activeConversationIdAtom} from "./components/conversationHistory/conversationHistoryAtom";

const { Sider, Content } = Layout;

// 主要的聊天应用组件
function ChatAppContent() {
  const [activeConversationId] = useAtom(activeConversationIdAtom);
  const [testCaseSidebarVisible] = useAtom(testCaseSidebarVisibleAtom);
  const [testCaseFullscreen] = useAtom(testCaseFullscreenAtom);
  const [copyDeckSidebarVisible] = useAtom(copyDeckSidebarVisibleAtom);
  const [copyDeckFullscreen] = useAtom(copyDeckFullscreenAtom);
  const [htmlPreviewSidebarVisible] = useAtom(htmlPreviewSidebarVisibleAtom);
  const [htmlPreviewFullscreen] = useAtom(htmlPreviewFullscreenAtom);

  // 本地管理主标签页状态
  const [activeMainTab, setActiveMainTab] = useState('conversation');
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  // 使用atoms中的chat区域管理逻辑来渲染ChatArea
  const renderActiveChatAreas = () => {
    const conversationId = activeConversationId;
    return (
      <div
        key={conversationId || 'new-conversation'}
        className="flex h-full flex-col"
      >
        <ChatArea conversationId={conversationId || undefined} />
      </div>
    );
  };

  // 主标签页配置
  const mainTabItems = [
    {
      key: 'conversation',
      label: <span>Conversation</span>,
      children: <ConversationHistoryCard />,
    },
  ];

  // 是否有全屏面板
  const hasFullscreenPanel = testCaseFullscreen || copyDeckFullscreen || htmlPreviewFullscreen;

  return (
    <Layout style={{ height: "100vh", position: "relative" }}>
      {isHistoryCollapsed && (
        <button
          type="button"
          onClick={() => setIsHistoryCollapsed(false)}
          aria-label="Expand conversation history"
          title="Expand conversation history"
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #d9d9d9",
            background: "#ffffff",
            color: "#262626",
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)"
          }}
        >
          <MenuUnfoldOutlined />
        </button>
      )}
      <Sider
        width={280}
        collapsed={isHistoryCollapsed}
        collapsedWidth={0}
        trigger={null}
        style={{
          background: "#ffffff",
          borderRight: "1px solid #f0f0f0"
        }}
        className="flex flex-col overflow-hidden p-4"
      >
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsHistoryCollapsed(true)}
              aria-label="Collapse conversation history"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                border: "1px solid #d9d9d9",
                background: "#ffffff",
                color: "#595959",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              <MenuFoldOutlined />
            </button>
          </div>
          <Tabs
            activeKey={activeMainTab}
            onChange={setActiveMainTab}
            items={mainTabItems}
            className="custom-tabs"
          />
        </div>
      </Sider>

      <Layout>
        <Content
          className="p-5"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {/* 聊天区域和右侧面板的容器 */}
          <div className="flex h-full gap-10">
            {/* 聊天区域 */}
            <div
              className="relative flex flex-1 flex-col"
              style={{ display: hasFullscreenPanel ? 'none' : 'flex', minWidth: 0 }}
            >
              {renderActiveChatAreas()}
            </div>

            {/* TestCase */}
            <div
              className={`h-full min-w-[300px] ${
                (testCaseSidebarVisible && !hasFullscreenPanel) || testCaseFullscreen ? 'flex' : 'hidden'
              } ${testCaseFullscreen ? 'flex-1' : 'flex-[2]'}`}
            >
              {(testCaseSidebarVisible || testCaseFullscreen) && <TestCase />}
            </div>

            {/* CopyDeck */}
            <div
              className={`h-full min-w-[300px] ${
                (copyDeckSidebarVisible && !hasFullscreenPanel) || copyDeckFullscreen ? 'flex' : 'hidden'
              } ${copyDeckFullscreen ? 'flex-1' : 'flex-[2]'}`}
            >
              {(copyDeckSidebarVisible || copyDeckFullscreen ) && <CopyDeck />}
            </div>

            {/* HtmlPreview */}
            <div
              className={`h-full min-w-[300px] ${
                (htmlPreviewSidebarVisible && !hasFullscreenPanel) || htmlPreviewFullscreen ? 'flex' : 'hidden'
              } ${htmlPreviewFullscreen ? 'flex-1' : 'flex-[1]'}`}
            >
              {(htmlPreviewSidebarVisible || htmlPreviewFullscreen) && <HtmlPreview />}
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

// 导出主组件 - 不再需要 Provider 包装
export default function ChatApp() {
  return <ChatAppContent />;
}
