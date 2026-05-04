import React from 'react';
import {Alert, Button, Card, ConfigProvider, Dropdown, message, Popover, Space, Spin} from 'antd';
import type {MenuProps} from 'antd';
import {
  CloseOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {useAtom, useSetAtom} from 'jotai';
import {useRequest} from 'ahooks';
import {
  hideHtmlPreviewSidebarAtom,
  htmlPreviewContentAtom,
  htmlPreviewFullscreenAtom,
  htmlPreviewLiveModeAtom,
  htmlPreviewTurnIdAtom,
  toggleHtmlPreviewFullscreenAtom,
} from './htmlPreviewAtom';
import {activeConversationIdAtom} from "@/pages/home/components/conversationHistory/conversationHistoryAtom";
import {createHtmlPreviewApi, getHtmlPreviewContentApi} from '@/api/conversationHtmlPreviewApi';
import type {HtmlPreviewResponse} from '@/api/conversationHtmlPreviewApi';
import testCaseTheme from "@/styles/style";
import {HtmlShare} from "@/components/htmlPreview/HtmlShare";
import {downloadHtmlFile, downloadPngFromIframe} from '@/utils/downloadUtils';
import {checkHtmlPreviewSecurity} from './htmlPreviewSecurityUtils';

type SecurityWarningData = Pick<
  HtmlPreviewResponse,
  'hasXss' | 'xssContent' | 'hasExternalReferences' | 'externalReferencesContent'
>;

export const HtmlPreview: React.FC = () => {
  const hideHtmlPreviewSidebar = useSetAtom(hideHtmlPreviewSidebarAtom);
  const toggleFullscreen = useSetAtom(toggleHtmlPreviewFullscreenAtom);
  const [isFullscreen] = useAtom(htmlPreviewFullscreenAtom);
  const [iframeKey, setIframeKey] = React.useState(0);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [htmlPreviewTurnId] = useAtom(htmlPreviewTurnIdAtom);
  const [htmlPreviewContent] = useAtom(htmlPreviewContentAtom);
  const [isHtmlPreviewLiveMode] = useAtom(htmlPreviewLiveModeAtom);
  const [activeConversationId] = useAtom(activeConversationIdAtom);
  const iconStyle: React.CSSProperties = {width: 18, height: 18, fontSize: 18};

  // 保存上一次成功加载的预览数据，避免加载时显示空白
  const [lastPreviewData, setLastPreviewData] = React.useState<HtmlPreviewResponse | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = React.useState(false);

  // 第一步：创建预览，获取 ID
  const { loading: creatingLoading, data: createResponse } = useRequest(
    async () => {
      return await createHtmlPreviewApi({
        conversationId: activeConversationId!,
        turnId: htmlPreviewTurnId!,
        htmlContent: htmlPreviewContent!,
      });
    },
    {
      ready: !isHtmlPreviewLiveMode && !!(htmlPreviewContent && htmlPreviewTurnId),
      refreshDeps: [htmlPreviewContent, htmlPreviewTurnId],
    }
  );

  // 第二步：根据 ID 获取完整预览数据（包含 htmlContent）
  const { loading: fetchingLoading, data: previewData } = useRequest(
    async () => {
      if (!createResponse?.id) return null;
      return await getHtmlPreviewContentApi(createResponse.id);
    },
    {
      ready: !isHtmlPreviewLiveMode && !!createResponse?.id,
      refreshDeps: [createResponse?.id],
      onSuccess: (data) => {
        if (data?.htmlContent) {
          setLastPreviewData(data);
          setHasLoadedOnce(true);
        }
      },
    }
  );

  const loading = creatingLoading || fetchingLoading;
  const currentData = previewData ?? lastPreviewData;
  const currentRenderableHtmlContent = isHtmlPreviewLiveMode
    ? htmlPreviewContent
    : (loading && hasLoadedOnce && lastPreviewData?.htmlContent ? lastPreviewData.htmlContent : currentData?.htmlContent);
  const sharePreviewId = isHtmlPreviewLiveMode ? null : (previewData?.id ?? lastPreviewData?.id ?? createResponse?.id ?? null);
  const liveModeSecurityData = React.useMemo(() => {
    if (!isHtmlPreviewLiveMode || !htmlPreviewContent) {
      return null;
    }
    return checkHtmlPreviewSecurity(htmlPreviewContent);
  }, [isHtmlPreviewLiveMode, htmlPreviewContent]);

  React.useEffect(() => {
    setSharePopoverOpen(false);
  }, [sharePreviewId]);

  // 刷新 iframe
  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const resolveCurrentRenderedHtml = () => {
    const iframeDocument = iframeRef.current?.contentDocument;
    if (iframeDocument?.documentElement) {
      return `<!DOCTYPE html>\n${iframeDocument.documentElement.outerHTML}`;
    }
    return currentRenderableHtmlContent;
  };

  const handleDownloadHtml = () => {
    const htmlContentToDownload = resolveCurrentRenderedHtml();
    if (!htmlContentToDownload) {
      message.warning('No preview content available for download');
      return;
    }
    downloadHtmlFile(htmlContentToDownload);
  };

  const handleDownloadPng = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.documentElement) {
      message.warning('No rendered preview page available for image download');
      return;
    }

    try {
      await downloadPngFromIframe(iframe);
    } catch (error) {
      console.error('Failed to download PNG from HTML preview', error);
      message.error('Failed to download image from preview');
    }
  };

  const downloadMenu: MenuProps = {
    items: [
      {
        key: 'download-html',
        label: 'Download HTML',
        disabled: !currentRenderableHtmlContent,
      },
      {
        key: 'download-png',
        label: 'Download PNG',
        disabled: !currentRenderableHtmlContent,
      },
    ],
    onClick: ({key}) => {
      if (key === 'download-html') {
        handleDownloadHtml();
      }
      if (key === 'download-png') {
        void handleDownloadPng();
      }
    },
  };

  // 渲染安全警告提示
  const renderSecurityWarning = (data: SecurityWarningData | null) => {
    const renderBlockedTip = (alertNode: React.ReactNode) => (
      <div className="m-4 max-w-[860px]">
        <div style={{marginBottom: 8, color: '#8c8c8c', fontSize: 12}}>
          Inline preview is restricted by security policy. Please download and run the content in a local environment if needed.
        </div>
        {alertNode}
      </div>
    );

    if (data?.hasXss) {
      const description = data.xssContent
        ? <div style={{ whiteSpace: 'pre-line' }}>{data.xssContent}</div>
        : 'This content contains potential security risks (XSS) and cannot be displayed.';
      return (
        renderBlockedTip(
          <Alert
            message="Security Warning"
            description={description}
            type="error"
            showIcon
            icon={<WarningOutlined style={iconStyle} />}
          />
        )
      );
    }
    if (data?.hasExternalReferences) {
      const description = data.externalReferencesContent
        ? <div style={{ whiteSpace: 'pre-line' }}>{data.externalReferencesContent}</div>
        : 'This content contains external references and cannot be displayed.';
      return (
        renderBlockedTip(
          <Alert
            message="Security Warning"
            description={description}
            type="error"
            showIcon
            icon={<WarningOutlined style={iconStyle} />}
          />
        )
      );
    }
    return null;
  };

  // 渲染内容区域
  const renderContent = () => {
    if (isHtmlPreviewLiveMode) {
      if (!htmlPreviewContent) {
        return (
          <div className="flex h-full items-center justify-center text-gray-400">
            No preview data
          </div>
        );
      }

      const liveModeSecurityWarning = renderSecurityWarning(liveModeSecurityData);
      if (liveModeSecurityWarning) {
        return (
          <div className="flex h-full items-center justify-center">
            {liveModeSecurityWarning}
          </div>
        );
      }

      return (
        <iframe
          ref={iframeRef}
          key={iframeKey}
          srcDoc={htmlPreviewContent}
          title="HTML Preview"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
        />
      );
    }

    // 首次加载时显示 loading
    if (loading && !hasLoadedOnce) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <Spin size="large" />
          <div className="text-gray-400">Loading preview...</div>
        </div>
      );
    }

    // 加载中且有旧数据时，显示旧内容（避免空白）
    if (loading && hasLoadedOnce && lastPreviewData?.htmlContent) {
      return (
        <div className="relative h-full w-full">
          {/* 背景显示旧内容 */}
          <iframe
            ref={iframeRef}
            key={iframeKey}
            srcDoc={lastPreviewData.htmlContent}
            title="HTML Preview"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
          />
          {/* 顶部显示加载指示器 */}
          <div className="absolute top-4 right-4 z-10">
            <Spin size="small" />
          </div>
        </div>
      );
    }

    const securityWarning = renderSecurityWarning(currentData);
    if (securityWarning) {
      return (
        <div className="flex h-full items-center justify-center">
          {securityWarning}
        </div>
      );
    }

    if (currentData?.htmlContent) {
      return (
        <iframe
          ref={iframeRef}
          key={iframeKey}
          srcDoc={currentData.htmlContent}
          title="HTML Preview"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        No preview data
      </div>
    );
  };

  return (
    <ConfigProvider theme={testCaseTheme}>
      <Card
        title="HTML Preview"
        className="relative h-full w-full overflow-hidden p-4"
        extra={
          <Space>
            {!isHtmlPreviewLiveMode && (
              <Popover
                trigger="click"
                placement="bottomRight"
                open={sharePopoverOpen}
                onOpenChange={setSharePopoverOpen}
                content={
                  <HtmlShare
                    payload={{
                      shareKey: `sidebar:${activeConversationId ?? ''}:${htmlPreviewTurnId ?? ''}`,
                      previewId: sharePreviewId,
                      conversationId: activeConversationId ?? null,
                      turnId: htmlPreviewTurnId ?? null,
                      htmlContent: htmlPreviewContent ?? null,
                    }}
                  />
                }
              >
                <Button
                  type="text"
                  icon={<ShareAltOutlined style={iconStyle} />}
                  title="Share"
                />
              </Popover>
            )}
            <Dropdown menu={downloadMenu} trigger={['click']}>
              <Button
                type="text"
                icon={<DownloadOutlined style={iconStyle} />}
                title="Download"
              />
            </Dropdown>
            <Button
              type="text"
              icon={<ReloadOutlined style={iconStyle} />}
              onClick={handleRefresh}
              title="Refresh"
            />
            <Button
              type="text"
              icon={
                isFullscreen
                  ? <FullscreenExitOutlined style={iconStyle} />
                  : <FullscreenOutlined style={iconStyle} />
              }
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            />
            <Button
              type="text"
              icon={<CloseOutlined style={iconStyle} />}
              onClick={hideHtmlPreviewSidebar}
              title="Close"
            />
          </Space>
        }
        styles={{ body: { height: 'calc(100% - 60px)', padding: 0 } }}
      >
        {renderContent()}
      </Card>
    </ConfigProvider>
  );
};

export default HtmlPreview;
