import { memo, useCallback, useDeferredValue } from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, message } from 'antd';
import type { A2uiClientAction } from '@a2ui/web_core/v0_9';

import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ChatA2UIRenderer } from '@/components/a2ui/ChatA2UIRenderer';
import { StatusCard } from './StatusCard';
import type { ConversationTurn } from './types';

interface ChatTurnCardProps {
  turn: ConversationTurn;
  onShowTestCase: (markdownTable: string) => void;
}

const normalizeToolName = (value?: string) => (value ?? '').trim().toLowerCase();

const hasCreateTestCaseToolCall = (turn: ConversationTurn) =>
  turn.processSteps?.some((step) => {
    const detailToolName = step.details?.find((detail) => detail.label === 'Tool')?.value;
    return (
      normalizeToolName(detailToolName) === 'createtestcase' ||
      normalizeToolName(step.content).includes('createtestcase')
    );
  }) ?? false;

const hasTestCaseMarkdownTable = (content: string) =>
  /\|\s*test case id\s*\|/i.test(content) &&
  /\|\s*test case description\s*\|/i.test(content);

const getActionContextString = (action: A2uiClientAction, key: string) => {
  const value = action.context?.[key];
  return typeof value === 'string' ? value : '';
};

const ChatTurnCardComponent = ({ turn, onShowTestCase }: ChatTurnCardProps) => {
  const isStreaming =
    turn.aiResponse.status === 'pending' || turn.aiResponse.status === 'streaming';
  const deferredContent = useDeferredValue(turn.aiResponse.content || '');
  const responseContent = isStreaming ? deferredContent : turn.aiResponse.content || '';
  const a2uiMessages = turn.a2uiMessages ?? [];
  const shouldShowExportToJira =
    turn.aiResponse.status === 'completed' &&
    hasTestCaseMarkdownTable(turn.aiResponse.content) &&
    hasCreateTestCaseToolCall(turn);
  const handleA2UIAction = useCallback((action: A2uiClientAction) => {
    const total = typeof action.context?.total === 'string' ? action.context.total : '$11.66';
    if (action.name === 'coffee_purchase') {
      message.success(`Purchase submitted for ${total}.`);
      return;
    }

    if (action.name === 'coffee_add_to_cart') {
      message.success('Coffee order added to cart.');
      return;
    }

    if (action.name === 'test_case_export_jira') {
      const markdownTable = getActionContextString(action, 'markdownTable');
      if (!markdownTable.trim()) {
        message.warning('No test case table is available to export.');
        return;
      }

      onShowTestCase(markdownTable);
      return;
    }

    if (action.name === 'test_case_copy_markdown') {
      const markdownTable = getActionContextString(action, 'markdownTable');
      if (!markdownTable.trim()) {
        message.warning('No test case markdown is available to copy.');
        return;
      }

      if (!navigator.clipboard) {
        message.error('Clipboard is not available in this browser.');
        return;
      }

      void navigator.clipboard.writeText(markdownTable)
        .then(() => {
          message.success('Test case markdown copied.');
        })
        .catch(() => {
          message.error('Unable to copy test case markdown.');
        });
      return;
    }

    message.info(`A2UI action: ${action.name}`);
  }, [onShowTestCase]);

  return (
    <div className="chat-turn">
      <Card className="chat-turn__request">
        <div className="chat-turn__content">
          <div className="chat-turn__body">
            <p className="chat-turn__user-text">{turn.userInput.content}</p>
          </div>
        </div>
      </Card>

      <StatusCard
        steps={turn.processSteps || []}
        responseStatus={turn.aiResponse.status}
      />

      <Card className="chat-turn__response">
        <div className="chat-turn__content">
          <div className="chat-turn__body">
            {a2uiMessages.length > 0 && (
              <ChatA2UIRenderer
                messages={a2uiMessages}
                onAction={handleA2UIAction}
              />
            )}

            {isStreaming ? (
              <div className="chat-turn__streaming">
                {responseContent && (
                  <MarkdownRenderer
                    turn={turn}
                    content={responseContent}
                  />
                )}
                <span className="chat-turn__cursor" />
              </div>
            ) : (
              <MarkdownRenderer
                turn={turn}
                content={responseContent}
                showExpandButton={true}
              />
            )}
          </div>

          {shouldShowExportToJira && (
            <div className="chat-turn__footer">
              <Button
                type="link"
                onClick={() => onShowTestCase(turn.aiResponse.content)}
                className="chat-turn__footer-button"
              >
                Export to Jira
                <ArrowRightOutlined />
              </Button>
            </div>
          )}

          {turn.aiResponse.status === 'error' && (
            <div className="chat-turn__error">
              {turn.aiResponse.errorMessage || '生成失败，请稍后重试。'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export const ChatTurnCard = memo(
  ChatTurnCardComponent,
  (prevProps, nextProps) =>
    prevProps.turn === nextProps.turn &&
    prevProps.onShowTestCase === nextProps.onShowTestCase
);
