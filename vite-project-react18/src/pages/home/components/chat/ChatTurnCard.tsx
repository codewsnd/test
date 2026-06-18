import { memo, useDeferredValue } from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';

import CopyTestRenderer from '@/components/CopyTestRenderer';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
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

const hasCopyTestResultUpdaterToolCall = (turn: ConversationTurn) =>
  turn.processSteps?.some((step) => {
    const detailToolName = step.details?.find((detail) => detail.label === 'Tool')?.value;
    return (
      normalizeToolName(detailToolName) === 'copytestresultupdater' ||
      normalizeToolName(step.content).includes('copytestresultupdater')
    );
  }) ?? false;

const hasCopyTestLauncherBlock = (content: string) => {
  return /```(?:copydeck|copytest)\b/i.test(content);
};

const ChatTurnCardComponent = ({ turn, onShowTestCase }: ChatTurnCardProps) => {
  const isStreaming =
    turn.aiResponse.status === 'pending' || turn.aiResponse.status === 'streaming';
  const deferredContent = useDeferredValue(turn.aiResponse.content || '');
  const responseContent = isStreaming ? deferredContent : turn.aiResponse.content || '';
  const shouldShowExportToJira =
    turn.aiResponse.status === 'completed' &&
    Boolean(turn.aiResponse.content) &&
    hasCreateTestCaseToolCall(turn);
  const shouldShowCopyTestFallback =
    turn.aiResponse.status === 'completed' &&
    hasCopyTestResultUpdaterToolCall(turn) &&
    !hasCopyTestLauncherBlock(responseContent);

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

            {shouldShowCopyTestFallback && <CopyTestRenderer />}
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
