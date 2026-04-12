import React from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {Button, Input, message, Space, Typography} from 'antd';
import {useAtom} from 'jotai';
import {
  CopyOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  createHtmlPreviewApi,
  createHtmlShareApi,
  getHtmlShareByPreviewApi,
  HtmlShareResponse,
  updateHtmlShareStatusApi,
} from '@/api/conversationHtmlPreviewApi';
import {htmlShareStateMapAtom} from '@/components/htmlPreview/htmlPreviewAtom';

dayjs.extend(utc);

interface HtmlSharePayload {
  shareKey?: string;
  previewId?: string | null;
  conversationId?: string | null;
  turnId?: string | null;
  htmlContent?: string | null;
}

interface HtmlShareProps {
  payload: HtmlSharePayload;
}

export const HtmlShare: React.FC<HtmlShareProps> = ({payload}) => {
  const [shareStateMap, setShareStateMap] = useAtom(htmlShareStateMapAtom);
  const [initializing, setInitializing] = React.useState(false);

  const stateKey = React.useMemo(() => {
    if (payload.shareKey) {
      return payload.shareKey;
    }
    if (payload.previewId) {
      return `preview:${payload.previewId}`;
    }
    return `conversation:${payload.conversationId ?? ''}:turn:${payload.turnId ?? ''}:html:${payload.htmlContent?.length ?? 0}`;
  }, [payload.shareKey, payload.previewId, payload.conversationId, payload.turnId, payload.htmlContent]);

  const shareState = shareStateMap[stateKey] ?? {actionLoading: null, shareInfo: null};
  const actionLoading = shareState.actionLoading;
  const shareInfo = shareState.shareInfo;

  const setShareState = React.useCallback((next: Partial<{actionLoading: 'enable' | 'disable' | null; shareInfo: HtmlShareResponse | null}>) => {
    setShareStateMap((prev) => {
      const nextMap = {
        ...prev,
        [stateKey]: {
          actionLoading: prev[stateKey]?.actionLoading ?? null,
          shareInfo: prev[stateKey]?.shareInfo ?? null,
          ...next,
        },
      };

      const previewId = next.shareInfo?.previewId;
      if (previewId) {
        const previewKey = `preview:${previewId}`;
        nextMap[previewKey] = {
          actionLoading: nextMap[previewKey]?.actionLoading ?? null,
          shareInfo: next.shareInfo,
        };

        for (const key of Object.keys(nextMap)) {
          if (key === stateKey || key === previewKey) {
            continue;
          }
          if (nextMap[key]?.shareInfo?.previewId === previewId) {
            nextMap[key] = {
              ...nextMap[key],
              shareInfo: next.shareInfo,
            };
          }
        }
      }

      return nextMap;
    });
  }, [setShareStateMap, stateKey]);


  const shareUrl = React.useMemo(() => {
    if (!shareInfo?.id) {
      return '';
    }
    return `${globalThis.location.origin}/htmlPreview/${shareInfo.id}`;
  }, [shareInfo?.id]);

  const isExpired = Boolean(shareInfo?.expired);
  const isSharingEnabled = Boolean(shareInfo?.enabled) && !isExpired;

  const expireText = React.useMemo(() => {
    if (!shareInfo?.expiresAt) {
      return '--';
    }
    return dayjs.utc(shareInfo.expiresAt).local().format('YYYY-MM-DD HH:mm:ss');
  }, [shareInfo?.expiresAt]);

  const handleEnableShare = async () => {
    setShareState({actionLoading: 'enable'});
    try {
      const response = await createHtmlShareApi({
        ...payload,
        previewId: shareInfo?.previewId ?? payload.previewId ?? undefined,
      });
      setShareState({shareInfo: response});
      message.success(isExpired ? 'Sharing re-enabled (valid for 7 days)' : 'Sharing enabled (valid for 7 days)');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error('Failed to enable share: ' + errorMessage);
    } finally {
      setShareState({actionLoading: null});
    }
  };

  const handleDisableShare = async () => {
    if (!shareInfo?.id) {
      message.warning('No share link available');
      return;
    }
    setShareState({actionLoading: 'disable'});
    try {
      const response = await updateHtmlShareStatusApi(shareInfo.id, {enabled: false});
      setShareState({shareInfo: response});
      message.success('Sharing stopped');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error('Failed to stop share: ' + errorMessage);
    } finally {
      setShareState({actionLoading: null});
    }
  };

  const handleToggleShare = () => {
    if (isSharingEnabled) {
      void handleDisableShare();
      return;
    }
    void handleEnableShare();
  };

  const handleCopy = async () => {
    if (!shareUrl || !isSharingEnabled) {
      message.warning(isExpired ? 'Share link expired, please re-enable sharing' : 'Please enable sharing first');
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success('Link copied to clipboard');
    } catch {
      message.error('Failed to copy link');
    }
  };

  React.useEffect(() => {
    let cancelled = false;

    const loadShareStatus = async () => {
      let previewId = payload.previewId ?? null;

      if (!previewId && payload.conversationId && payload.turnId && payload.htmlContent) {
        setInitializing(true);
        try {
          const preview = await createHtmlPreviewApi({
            conversationId: payload.conversationId,
            turnId: payload.turnId,
            htmlContent: payload.htmlContent,
          });
          previewId = preview.id;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (!cancelled) {
            message.error('Failed to resolve preview for sharing: ' + errorMessage);
          }
        } finally {
          if (!cancelled) {
            setInitializing(false);
          }
        }
      }

      if (!previewId || cancelled) {
        return;
      }

      setInitializing(true);
      try {
        const status = await getHtmlShareByPreviewApi(previewId);
        if (!cancelled) {
          setShareState({
            shareInfo: {
              ...status,
              previewId: status.previewId ?? previewId,
            },
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!cancelled) {
          message.error('Failed to query share status: ' + errorMessage);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void loadShareStatus();

    return () => {
      cancelled = true;
    };
  }, [payload.previewId, payload.conversationId, payload.turnId, payload.htmlContent, setShareState]);

  return (
    <div className="min-w-[340px]">
      <Space direction="vertical" className="w-full">
        <Button
          block
          type={isSharingEnabled ? 'default' : 'primary'}
          icon={isSharingEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={handleToggleShare}
          loading={actionLoading !== null || initializing}
          disabled={actionLoading !== null || initializing}
        >
          {isSharingEnabled ? 'Stop Sharing' : (isExpired ? 'Re-enable Sharing' : 'Start Sharing')}
        </Button>

        {shareInfo?.expiresAt && (
          <Typography.Text type={isExpired ? 'danger' : 'secondary'}>
            Expires At: {expireText}
          </Typography.Text>
        )}

        <Typography.Text type="secondary">Share Link</Typography.Text>
        <Input
          readOnly
          disabled
          value={shareUrl || 'Share link will be available after enabling'}
          prefix={<LinkOutlined />}
        />
        <Button
          block
          icon={<CopyOutlined />}
          onClick={handleCopy}
          disabled={!shareUrl || !isSharingEnabled || actionLoading !== null}
        >
          Copy Link
        </Button>
      </Space>
    </div>
  );
};

export default HtmlShare;
