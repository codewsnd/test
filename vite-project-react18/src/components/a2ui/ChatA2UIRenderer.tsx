import { useEffect, useMemo } from 'react';
import {
  MessageProcessor,
  type A2uiClientAction,
  type A2uiMessage
} from '@a2ui/web_core/v0_9';
import {
  A2uiSurface,
  basicCatalog,
  type ReactComponentImplementation
} from '@a2ui/react/v0_9';
import { genericCatalog } from './genericCatalog';
import { coffeeOrderCatalog } from './coffeeOrderCatalog';
import { testCaseCatalog } from './testCaseCatalog';

interface ChatA2UIRendererProps {
  messages: A2uiMessage[];
  onAction?: (action: A2uiClientAction) => void;
}

const catalogs = [basicCatalog, genericCatalog, coffeeOrderCatalog, testCaseCatalog];

export const ChatA2UIRenderer = ({ messages, onAction }: ChatA2UIRendererProps) => {
  const renderState = useMemo(() => {
    const processor = new MessageProcessor<ReactComponentImplementation>(
      catalogs,
      (action) => {
        onAction?.(action);
      }
    );

    try {
      processor.processMessages(messages);
      return {
        error: null,
        processor,
        surfaces: Array.from(processor.model.surfacesMap.values())
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to render A2UI payload.',
        processor,
        surfaces: []
      };
    }
  }, [messages, onAction]);

  useEffect(
    () => () => {
      renderState.processor.model.dispose();
    },
    [renderState.processor]
  );

  if (messages.length === 0) {
    return null;
  }

  if (renderState.error) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[13px] leading-6 text-red-700">
        {renderState.error}
      </div>
    );
  }

  return (
    <div className="my-1 mb-4 flex flex-col items-start gap-4">
      {renderState.surfaces.map((surface) => (
        <A2uiSurface key={surface.id} surface={surface} />
      ))}
    </div>
  );
};
