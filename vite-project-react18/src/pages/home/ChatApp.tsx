import { useState } from "react";
import { Button, Layout, Tabs, Tooltip } from "antd";
import { DoubleLeftOutlined, DoubleRightOutlined } from "@ant-design/icons";
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
const HISTORY_SIDER_WIDTH = 320;

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
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

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
      <Sider
        width={HISTORY_SIDER_WIDTH}
        collapsedWidth={0}
        collapsed={historyCollapsed}
        trigger={null}
        theme="light"
        className="flex flex-col overflow-hidden bg-white"
        style={{
          padding: historyCollapsed ? 0 : 16,
          transition: "all 0.2s ease",
        }}
      >
        <div className="h-full flex-col" style={{ display: historyCollapsed ? "none" : "flex" }}>
          <Tabs
            activeKey={activeMainTab}
            onChange={setActiveMainTab}
            items={mainTabItems}
            className="custom-tabs"
          />
        </div>
      </Sider>
      <Tooltip title={historyCollapsed ? "展开历史" : "收起历史"} placement="right">
        <Button
          type="default"
          shape="circle"
          size="small"
          aria-label={historyCollapsed ? "展开聊天历史" : "收起聊天历史"}
          icon={historyCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
          onClick={() => setHistoryCollapsed((collapsed) => !collapsed)}
          style={{
            position: "absolute",
            top: "50%",
            left: historyCollapsed ? 12 : HISTORY_SIDER_WIDTH,
            transform: "translate(-50%, -50%)",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
            transition: "left 0.2s ease, box-shadow 0.2s ease",
          }}
        />
      </Tooltip>

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
