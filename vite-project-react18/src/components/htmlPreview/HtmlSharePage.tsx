import React from 'react';
import {Alert, ConfigProvider, Empty, Result, Spin} from 'antd';
import {WarningOutlined} from '@ant-design/icons';
import {useRequest} from 'ahooks';
import {useParams} from 'react-router';
import dayjs from 'dayjs';
import {getHtmlShareContentApi} from '@/api/conversationHtmlPreviewApi';
import type {HtmlShareResponse} from '@/api/conversationHtmlPreviewApi';
import testCaseTheme from '@/styles/style';

export const HtmlSharePage: React.FC = () => {
  const {id} = useParams<{ id: string }>();

  const {loading, data, error} = useRequest(
    async () => {
      if (!id) {
        return null;
      }
      return await getHtmlShareContentApi(id);
    },
    {
      ready: !!id,
      refreshDeps: [id],
    }
  );

  const renderSecurityWarning = (previewData: HtmlShareResponse | null) => {
    const renderBlockedTip = (alertNode: React.ReactNode) => (
      <div style={{maxWidth: 860}}>
        <div style={{marginBottom: 8, color: '#8c8c8c', fontSize: 12}}>
          Inline preview is restricted by security policy. Please download and run the content in a local environment if needed.
        </div>
        {alertNode}
      </div>
    );

    if (previewData?.hasXss) {
      return (
        renderBlockedTip(
          <Alert
            message="Security Warning"
            description="This content contains potential security risks (XSS) and cannot be displayed."
            type="error"
            showIcon
            icon={<WarningOutlined />}
          />
        )
      );
    }

    if (previewData?.hasExternalReferences) {
      return (
        renderBlockedTip(
          <Alert
            message="Security Warning"
            description="This content contains external references and cannot be displayed."
            type="warning"
            showIcon
            icon={<WarningOutlined />}
          />
        )
      );
    }

    return null;
  };

  if (!id) {
    return <Result status="404" title="Invalid share link" subTitle="Missing share id." />;
  }

  const securityWarning = renderSecurityWarning(data ?? null);

  if (loading) {
    return (
      <ConfigProvider theme={testCaseTheme}>
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
          <Spin size="large" />
          <div className="text-gray-400">Loading shared page...</div>
        </div>
      </ConfigProvider>
    );
  }

  if (error) {
    return (
      <ConfigProvider theme={testCaseTheme}>
        <div className="flex h-screen w-screen items-center justify-center p-4">
          <Result
            status="error"
            title="Failed to load shared page"
            subTitle={error.message}
          />
        </div>
      </ConfigProvider>
    );
  }

  if (securityWarning) {
    return (
      <ConfigProvider theme={testCaseTheme}>
        <div className="flex h-screen w-screen items-center justify-center p-4">
          {securityWarning}
        </div>
      </ConfigProvider>
    );
  }

  if (data && (!data.enabled || data.expired)) {
    return (
      <ConfigProvider theme={testCaseTheme}>
        <div className="flex h-screen w-screen items-center justify-center p-4">
          <Result
            status="warning"
            title={data.expired ? 'Share link expired' : 'Sharing is disabled'}
            subTitle={
              data.expiresAt
                ? `Expires at ${dayjs(data.expiresAt).format('YYYY-MM-DD HH:mm:ss')}. Please re-enable sharing.`
                : 'Please re-enable sharing.'
            }
          />
        </div>
      </ConfigProvider>
    );
  }

  if (data?.htmlContent) {
    return (
      <iframe
        srcDoc={data.htmlContent}
        title="Shared HTML Preview"
        className="h-screen w-screen border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-pointer-lock"
      />
    );
  }

  return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Empty description="No shared content" />
      </div>
  );
};

export default HtmlSharePage;
