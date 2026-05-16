import { memo, useDeferredValue } from 'react';
import { Card } from 'antd';

import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { StatusCard } from './StatusCard';
import type { ConversationTurn } from './types';

interface ChatTurnCardProps {
  turn: ConversationTurn;
}

const ChatTurnCardComponent = ({ turn }: ChatTurnCardProps) => {
  const isStreaming =
    turn.aiResponse.status === 'pending' || turn.aiResponse.status === 'streaming';
  const deferredContent = useDeferredValue(turn.aiResponse.content || '');
  const responseContent = isStreaming ? deferredContent : turn.aiResponse.content || '';

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
          </div>

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
    prevProps.turn === nextProps.turn
);
