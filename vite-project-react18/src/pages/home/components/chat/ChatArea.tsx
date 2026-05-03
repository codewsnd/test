import { startTransition, useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Spin, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAtom, useSetAtom } from 'jotai';
import { useRequest } from 'ahooks';
import { fetchEventSource } from '@microsoft/fetch-event-source';

import { API_BASE_URLS } from '@/api/axios';
import { getAgentsApi } from '@/api/agentApi';
import {
  getConversationDetailApi,
  type ConversationHistory
} from '@/api/conversationHistoryApi';
import { showTestCaseSidebarAtom } from '@/pages/home/components/testCase/testCaseAtom';
import { MyRepository } from './dataCenter';
import { ChatTurnCard } from './ChatTurnCard';
import { StepsManager } from './StepsManager';
import type {
  AiResponseStatus,
  ConversationState,
  ConversationTurn,
  ProcessStepDetail,
  SessionEventPayload,
  StatusEventPayload
} from './types';
import {
  conversationHistoriesAtom,
  createConversationHistoryAtom,
  generateConversationTitleAtom,
  setConversationStateAtom
} from '../conversationHistory/conversationHistoryAtom';
import './chatArea.css';

interface ChatAreaProps {
  conversationId?: string;
}

type HistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ToolCallEventData = {
  toolName?: string;
  toolCallId?: string;
  params?: string;
  toolname?: string;
  timestamp?: string;
};

type ToolResultEventData = {
  toolName?: string;
  toolCallId?: string;
  result?: string;
  'tool-result'?: string;
  timestamp?: string;
};

type StreamMessageEventData = {
  output?: {
    text?: string | null;
  };
  metadata?: {
    sessionId?: string;
    chunkIndex?: number;
    partial?: boolean;
    createdAt?: string;
  };
};

type DoneEventData = {
  done?: boolean;
  sessionId?: string;
  requestId?: string;
  conversationId?: string;
  chunkCount?: number;
  characterCount?: number;
  completedAt?: string;
};

type ErrorEventData = {
  error?: string;
  sessionId?: string;
  requestId?: string;
  conversationId?: string;
  timestamp?: string;
};

type StreamBuffer = {
  chunks: string[];
  timeoutId: number | null;
};

type PendingToolState = {
  stack: string[];
  byCallId: Map<string, string>;
};

const EMPTY_CONVERSATION_STATE: ConversationState = {
  turns: [],
  currentTurnId: undefined
};

const STEP_KEYS = {
  request: 'request',
  response: 'response',
  completion: 'completion'
} as const;

const TOOL_STEP_PREFIX = 'tool';
const STREAM_FLUSH_INTERVAL = 40;

const truncateText = (value: string, maxLength: number = 140) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

const parseEventData = <T,>(rawData: string): T | null => {
  if (!rawData.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawData) as T;
  } catch (error) {
    console.error('Failed to parse SSE event payload:', error, rawData);
    return null;
  }
};

const buildHistoryMessages = (turns: ConversationTurn[], userMessage: string): HistoryMessage[] => {
  const historyMessages = turns.flatMap<HistoryMessage>((turn) => {
    const messages: HistoryMessage[] = [];

    if (turn.userInput?.content) {
      messages.push({
        role: 'user',
        content: turn.userInput.content
      });
    }

    if (turn.aiResponse?.content && turn.aiResponse.status === 'completed') {
      messages.push({
        role: 'assistant',
        content: turn.aiResponse.content
      });
    }

    return messages;
  });

  historyMessages.push({
    role: 'user',
    content: userMessage
  });

  return historyMessages;
};

const joinDetails = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(' · ');

const formatStructuredValue = (value?: string) => {
  if (!value?.trim()) {
    return undefined;
  }

  const trimmedValue = value.trim();

  try {
    return JSON.stringify(JSON.parse(trimmedValue), null, 2);
  } catch {
    return trimmedValue;
  }
};

const formatEventTimestamp = (timestamp?: string) => {
  if (!timestamp?.trim()) {
    return undefined;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
};

const buildToolStepDetails = ({
  toolName,
  toolCallId,
  input,
  output,
  timestamp
}: {
  toolName: string;
  toolCallId?: string;
  input?: string;
  output?: string;
  timestamp?: string;
}): ProcessStepDetail[] => {
  const details: ProcessStepDetail[] = [{ label: 'Tool', value: toolName }];
  const formattedTimestamp = formatEventTimestamp(timestamp);

  if (toolCallId) {
    details.push({ label: 'Call ID', value: toolCallId });
  }

  if (formattedTimestamp) {
    details.push({ label: 'Time', value: formattedTimestamp });
  }

  if (input) {
    details.push({ label: 'Input', value: input });
  }

  if (output) {
    details.push({ label: 'Output', value: output });
  }

  return details;
};

const describeSession = (payload?: SessionEventPayload) =>
  payload
    ? joinDetails(
        payload.resumed === undefined
          ? undefined
          : payload.resumed
            ? '已复用内存会话'
            : '已创建新会话',
        payload.modelName ? `模型 ${payload.modelName}` : undefined,
        payload.sessionId ? `Session ${payload.sessionId}` : undefined
      )
    : undefined;

export default function ChatArea({ conversationId }: ChatAreaProps) {
  const [conversationHistories] = useAtom(conversationHistoriesAtom);
  const setConversationHistories = useSetAtom(conversationHistoriesAtom);
  const createConversationHistory = useSetAtom(createConversationHistoryAtom);
  const setConversationState = useSetAtom(setConversationStateAtom);
  const generateConversationTitle = useSetAtom(generateConversationTitleAtom);
  const showTestCaseSidebar = useSetAtom(showTestCaseSidebarAtom);

  const [localConversationId, setLocalConversationId] = useState<string | null>(conversationId ?? null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [isRepositoryVisible, setIsRepositoryVisible] = useState(false);

  const activeConversationId = conversationId ?? localConversationId;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<AbortController | null>(null);
  const stepManagersRef = useRef<Map<string, StepsManager>>(new Map());
  const pendingToolStepsRef = useRef<Map<string, PendingToolState>>(new Map());
  const resolvedTurnsRef = useRef<Set<string>>(new Set());
  const turnStatusRef = useRef<Map<string, { status: AiResponseStatus; contentLength: number }>>(new Map());
  const streamBuffersRef = useRef<Map<string, StreamBuffer>>(new Map());
  const turnSessionsRef = useRef<Map<string, SessionEventPayload>>(new Map());

  useEffect(() => {
    setLocalConversationId(conversationId ?? null);
  }, [conversationId]);

  const conversationHistory = activeConversationId
    ? conversationHistories.find((item) => item.id === activeConversationId)
    : undefined;
  const conversationState = conversationHistory?.conversationState ?? EMPTY_CONVERSATION_STATE;
  const { data: agents = [], loading: loadingAgents } = useRequest(getAgentsApi);
  const selectedAgent =
    agents.find((agent) => String(agent.id) === selectedAgentId) ??
    (conversationState.agentId
      ? agents.find((agent) => String(agent.id) === conversationState.agentId)
      : undefined);
  const latestTurn = conversationState.turns[conversationState.turns.length - 1];
  const latestTurnContentLength = latestTurn?.aiResponse.content.length ?? 0;
  const latestTurnStepCount = latestTurn?.processSteps?.length ?? 0;
  const isConversationReady = !conversationId || !!conversationHistory?.conversationState;
  const needLoadConversationDetail = Boolean(conversationId && !conversationHistory?.conversationState);
  const isAgentSelected = Boolean(selectedAgentId);

  useEffect(() => {
    if (conversationHistory?.conversationState?.agentId) {
      setSelectedAgentId(conversationHistory.conversationState.agentId);
      return;
    }

    if (conversationId) {
      setSelectedAgentId(undefined);
    }
  }, [conversationHistory?.conversationState?.agentId, conversationId]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  };

  const updateConversation = (
    conversationHistoryId: string,
    updater: ConversationState | ((prevState: ConversationState) => ConversationState),
    isDone: boolean = false
  ) => {
    setConversationState(updater, conversationHistoryId, isDone);
  };

  const createNewTurn = (
    userInputContent: string,
    turnIndex: number,
    conversationHistoryId: string
  ): ConversationTurn => ({
    id: `turn_${Date.now()}_${turnIndex}_${Math.random().toString(36).substring(2, 6)}`,
    turnIndex,
    timestamp: new Date(),
    conversationHistoryId,
    userInput: { content: userInputContent },
    aiResponse: {
      content: '',
      errorMessage: undefined,
      status: 'pending',
      timestamp: new Date()
    },
    processSteps: []
  });

  const markTurnResolved = (turnId: string) => {
    if (resolvedTurnsRef.current.has(turnId)) {
      return false;
    }

    resolvedTurnsRef.current.add(turnId);
    return true;
  };

  const createTurnStepsManager = (turnId: string, conversationHistoryId: string) => {
    const manager = new StepsManager((steps) => {
      updateConversation(
        conversationHistoryId,
        (prevState) => ({
          ...prevState,
          turns: prevState.turns.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  processSteps: steps
                }
              : turn
          )
        }),
        false
      );
    });

    stepManagersRef.current.set(turnId, manager);
    return manager;
  };

  const getTurnStepsManager = (turnId: string) => stepManagersRef.current.get(turnId);

  const clearStreamBuffer = (turnId: string) => {
    const buffer = streamBuffersRef.current.get(turnId);
    if (!buffer) {
      return '';
    }

    if (buffer.timeoutId !== null) {
      window.clearTimeout(buffer.timeoutId);
    }

    const delta = buffer.chunks.join('');
    buffer.chunks = [];
    buffer.timeoutId = null;
    return delta;
  };

  const releaseTurnResources = (turnId: string) => {
    clearStreamBuffer(turnId);
    stepManagersRef.current.delete(turnId);
    pendingToolStepsRef.current.delete(turnId);
    turnStatusRef.current.delete(turnId);
    streamBuffersRef.current.delete(turnId);
    turnSessionsRef.current.delete(turnId);
  };

  const pushPendingToolStep = (turnId: string, stepKey: string) => {
    const state = pendingToolStepsRef.current.get(turnId) ?? {
      stack: [],
      byCallId: new Map<string, string>()
    };
    state.stack.push(stepKey);
    pendingToolStepsRef.current.set(turnId, state);
  };

  const bindPendingToolCallId = (turnId: string, toolCallId: string | undefined, stepKey: string) => {
    if (!toolCallId) {
      return;
    }

    const state = pendingToolStepsRef.current.get(turnId) ?? {
      stack: [],
      byCallId: new Map<string, string>()
    };
    state.byCallId.set(toolCallId, stepKey);
    pendingToolStepsRef.current.set(turnId, state);
  };

  const resolvePendingToolStep = (turnId: string, toolCallId?: string) => {
    const state = pendingToolStepsRef.current.get(turnId);
    if (!state) {
      return undefined;
    }

    let stepKey: string | undefined;

    if (toolCallId) {
      stepKey = state.byCallId.get(toolCallId);
      if (stepKey) {
        state.byCallId.delete(toolCallId);
        state.stack = state.stack.filter((value) => value !== stepKey);
      }
    }

    if (!stepKey) {
      stepKey = state.stack.pop();
    }

    if (state.stack.length === 0 && state.byCallId.size === 0) {
      pendingToolStepsRef.current.delete(turnId);
    } else {
      pendingToolStepsRef.current.set(turnId, state);
    }

    return stepKey;
  };

  const initializeTurnSteps = (turnId: string, conversationHistoryId: string) => {
    const manager = createTurnStepsManager(turnId, conversationHistoryId);

    manager.upsertStep('接收请求', '请求已经发出，正在等待服务端建立执行上下文。', {
      key: STEP_KEYS.request,
      status: 'processing'
    });
    manager.upsertStep('分析上下文', '会话建立后会开始整理历史消息并准备生成回答。', {
      key: STEP_KEYS.response,
      status: 'waiting'
    });
    manager.upsertStep('整理输出', '内容返回完成后会进行收尾并结束本轮对话。', {
      key: STEP_KEYS.completion,
      status: 'waiting'
    });

    return manager;
  };

  const applySessionEvent = (turnId: string, payload: SessionEventPayload) => {
    turnSessionsRef.current.set(turnId, payload);

    const manager = getTurnStepsManager(turnId);
    if (!manager) {
      return;
    }

    manager.updateStep(STEP_KEYS.request, {
      content: '连接会话',
      tooltip: describeSession(payload) || '会话已建立。'
    });
  };

  const applyStatusEvent = (turnId: string, payload: StatusEventPayload) => {
    const manager = getTurnStepsManager(turnId);
    if (!manager || !payload.stage) {
      return;
    }

    const sessionDetail = describeSession(turnSessionsRef.current.get(turnId));

    switch (payload.stage) {
      case 'accepted':
        manager.updateStep(STEP_KEYS.request, {
          status: 'processing',
          content: '接收请求',
          tooltip: joinDetails('请求已被服务端接收。', sessionDetail)
        });
        break;

      case 'session-ready':
        manager.updateStep(STEP_KEYS.request, {
          status: 'completed',
          content: '连接会话',
          tooltip: joinDetails('会话上下文已经准备完成。', sessionDetail)
        });
        break;

      case 'generating':
        manager.updateStep(STEP_KEYS.response, {
          status: 'processing',
          content: '分析上下文',
          tooltip: '正在整理历史消息并准备生成回答。'
        });
        break;

      case 'responding':
        manager.updateStep(STEP_KEYS.response, {
          status: 'processing',
          content: '生成回复',
          tooltip: '模型已开始返回内容。'
        });
        break;

      case 'tool-running':
        manager.updateStep(STEP_KEYS.response, {
          status: 'processing',
          content: '调用工具',
          tooltip: '外部工具正在执行。'
        });
        break;

      case 'tool-completed':
        manager.updateStep(STEP_KEYS.response, {
          status: 'processing',
          content: '整合工具结果',
          tooltip: '工具结果已经返回，正在继续整理答案。'
        });
        break;

      case 'finalizing':
        manager.updateStep(STEP_KEYS.response, {
          status: 'completed',
          content: '生成回复',
          tooltip: '主体内容已经返回完成。'
        });
        manager.updateStep(STEP_KEYS.completion, {
          status: 'processing',
          content: '整理输出',
          tooltip: '正在进行收尾处理。'
        });
        break;

      case 'completed':
        manager.updateStep(STEP_KEYS.completion, {
          status: 'completed',
          content: '整理输出',
          tooltip: '本轮回复已经完成。'
        });
        break;

      case 'failed':
        manager.errorStep(STEP_KEYS.request, payload.detail);
        manager.errorStep(STEP_KEYS.response, payload.detail);
        manager.errorStep(STEP_KEYS.completion, payload.detail);
        manager.settleUnfinishedSteps('error', payload.detail);
        break;

      default:
        break;
    }
  };

  const flushBufferedDelta = (turnId: string, conversationHistoryId: string) => {
    const delta = clearStreamBuffer(turnId);
    if (!delta) {
      return;
    }

    const currentSnapshot = turnStatusRef.current.get(turnId);
    turnStatusRef.current.set(turnId, {
      status: 'streaming',
      contentLength: (currentSnapshot?.contentLength ?? 0) + delta.length
    });

    startTransition(() => {
      updateConversation(
        conversationHistoryId,
        (prevState) => ({
          ...prevState,
          turns: prevState.turns.map((turn) =>
            turn.id === turnId
                ? {
                    ...turn,
                    aiResponse: {
                      ...turn.aiResponse,
                      content: (turn.aiResponse.content || '') + delta,
                      errorMessage: undefined,
                      status: 'streaming' as const
                    }
                  }
              : turn
          ),
          currentTurnId: turnId
        }),
        false
      );
    });
  };

  const bufferStreamDelta = (turnId: string, conversationHistoryId: string, deltaContent: string) => {
    const existing = streamBuffersRef.current.get(turnId);
    const buffer = existing ?? {
      chunks: [],
      timeoutId: null
    };

    buffer.chunks.push(deltaContent);

    if (buffer.timeoutId === null) {
      buffer.timeoutId = window.setTimeout(() => {
        flushBufferedDelta(turnId, conversationHistoryId);
      }, STREAM_FLUSH_INTERVAL);
    }

    streamBuffersRef.current.set(turnId, buffer);
  };

  const completeTurn = (
    conversationHistoryId: string,
    turnId: string,
    donePayload?: DoneEventData
  ) => {
    const bufferedDelta = clearStreamBuffer(turnId);
    const currentSnapshot = turnStatusRef.current.get(turnId);

    turnStatusRef.current.set(turnId, {
      status: 'completed',
      contentLength: (currentSnapshot?.contentLength ?? 0) + bufferedDelta.length
    });

    if (!markTurnResolved(turnId)) {
      return;
    }

    const manager = getTurnStepsManager(turnId);
    if (manager) {
      manager.completeStep(STEP_KEYS.request);
      manager.completeStep(STEP_KEYS.response);
      manager.startProcessing(STEP_KEYS.completion);
      manager.updateStep(STEP_KEYS.completion, {
        content: '整理输出',
        tooltip:
          donePayload?.characterCount !== undefined
            ? `已输出 ${donePayload.characterCount} 个字符，共 ${donePayload.chunkCount ?? 0} 个片段。`
            : '本轮回复已完成。'
      });
      manager.settleUnfinishedSteps('completed');
      manager.completeStep(STEP_KEYS.completion);
    }

    let turnsForTitle: ConversationTurn[] | undefined;

    updateConversation(
      conversationHistoryId,
      (prevState) => {
        const nextState = {
          ...prevState,
          turns: prevState.turns.map((turn) =>
            turn.id === turnId
                ? {
                    ...turn,
                    aiResponse: {
                      ...turn.aiResponse,
                      content: (turn.aiResponse.content || '') + bufferedDelta,
                      errorMessage: undefined,
                      status: 'completed' as const,
                      timestamp: new Date()
                    }
                }
              : turn
          ),
          currentTurnId: undefined
        };

        if (nextState.turns.length === 1) {
          turnsForTitle = nextState.turns;
        }

        return nextState;
      },
      true
    );

    if (turnsForTitle) {
      void generateConversationTitle({
        conversationId: conversationHistoryId,
        turns: turnsForTitle,
        turnId
      }).catch(console.error);
    }

    eventSourceRef.current = null;
    releaseTurnResources(turnId);
  };

  const failTurn = (
    conversationHistoryId: string,
    turnId: string,
    errorText: string
  ) => {
    const bufferedDelta = clearStreamBuffer(turnId);
    const currentSnapshot = turnStatusRef.current.get(turnId);

    turnStatusRef.current.set(turnId, {
      status: 'error',
      contentLength: (currentSnapshot?.contentLength ?? 0) + bufferedDelta.length
    });

    if (!markTurnResolved(turnId)) {
      return;
    }

    const manager = getTurnStepsManager(turnId);
    if (manager) {
      manager.errorStep(STEP_KEYS.request, errorText);
      manager.errorStep(STEP_KEYS.response, errorText);
      manager.errorStep(STEP_KEYS.completion, errorText);
      manager.settleUnfinishedSteps('error', errorText);
    }

    updateConversation(
      conversationHistoryId,
      (prevState) => ({
        ...prevState,
        turns: prevState.turns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                aiResponse: {
                  ...turn.aiResponse,
                  content: (turn.aiResponse.content || '') + bufferedDelta,
                  errorMessage: errorText,
                  status: 'error' as const,
                  timestamp: new Date()
                }
              }
            : turn
        ),
        currentTurnId: undefined
      }),
      false
    );

    eventSourceRef.current = null;
    releaseTurnResources(turnId);
  };

  const handleToolCall = (turnId: string, payload: ToolCallEventData) => {
    const manager = getTurnStepsManager(turnId);
    if (!manager) {
      return;
    }

    const toolName = payload.toolName?.trim() || payload.toolname?.trim() || '未知工具';
    const stepKey = `${TOOL_STEP_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const inputText = formatStructuredValue(payload.params);
    const details = buildToolStepDetails({
      toolName,
      toolCallId: payload.toolCallId,
      input: inputText,
      timestamp: payload.timestamp
    });

    pushPendingToolStep(turnId, stepKey);
    bindPendingToolCallId(turnId, payload.toolCallId, stepKey);
    manager.updateStep(STEP_KEYS.response, {
      status: 'processing',
      content: '调用工具',
      tooltip: `${toolName} 正在执行。`
    });
    manager.addStep(
      `调用工具 ${toolName}`,
      inputText ? `输入参数已发送：${truncateText(inputText)}` : '工具已经开始执行。',
      {
        key: stepKey,
        status: 'processing',
        details
      }
    );
  };

  const handleToolResult = (turnId: string, payload: ToolResultEventData) => {
    const manager = getTurnStepsManager(turnId);
    if (!manager) {
      return;
    }

    const stepKey = resolvePendingToolStep(turnId, payload.toolCallId);
    const existingStep = stepKey ? manager.getStep(stepKey) : undefined;
    const existingDetails = existingStep?.details ?? [];
    const toolName =
      payload.toolName?.trim() ||
      existingDetails.find((detail) => detail.label === 'Tool')?.value ||
      '工具';
    const inputText = existingDetails.find((detail) => detail.label === 'Input')?.value;
    const callId = payload.toolCallId || existingDetails.find((detail) => detail.label === 'Call ID')?.value;
    const resultText = formatStructuredValue(payload.result || payload['tool-result']);
    const tooltip = resultText
      ? `工具结果：${truncateText(resultText)}`
      : '工具执行已返回结果。';
    const details = buildToolStepDetails({
      toolName,
      toolCallId: callId,
      input: inputText,
      output: resultText,
      timestamp: payload.timestamp
    });

    if (!stepKey) {
      manager.addStep(`${toolName} 执行完成`, tooltip, {
        status: 'completed',
        details
      });
    } else {
      manager.updateStep(stepKey, {
        content: `${toolName} 执行完成`,
        status: 'completed',
        tooltip,
        details
      });
    }

    manager.updateStep(STEP_KEYS.response, {
      status: 'processing',
      content: '整合工具结果',
      tooltip: `${toolName} 已返回，正在继续生成回复。`
    });
  };

  const setupSSE = (
    turnId: string,
    conversationHistoryId: string,
    historyTurns: ConversationTurn[],
    userMessage: string,
    agentId?: string
  ) => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
      }

      resolvedTurnsRef.current.delete(turnId);

      const abortController = new AbortController();
      eventSourceRef.current = abortController;

      const requestBody = {
        conversationId: conversationHistoryId,
        requestId: turnId,
        agentId,
        messages: buildHistoryMessages(historyTurns, userMessage)
      };

      void fetchEventSource(`${API_BASE_URLS.core}/deepseek/chat/stream`, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
        openWhenHidden: true,
        async onopen(response) {
          if (!response.ok) {
            throw new Error(`Failed to establish SSE connection: ${response.status}`);
          }
        },
        onmessage(event) {
          switch (event.event) {
            case 'session': {
              const payload = parseEventData<SessionEventPayload>(event.data);
              if (payload) {
                applySessionEvent(turnId, payload);
              }
              break;
            }

            case 'status': {
              const payload = parseEventData<StatusEventPayload>(event.data);
              if (payload) {
                applyStatusEvent(turnId, payload);
              }
              break;
            }

            case 'tool-call': {
              const payload = parseEventData<ToolCallEventData>(event.data);
              if (payload) {
                handleToolCall(turnId, payload);
              }
              break;
            }

            case 'tool-result': {
              const payload = parseEventData<ToolResultEventData>(event.data);
              if (payload) {
                handleToolResult(turnId, payload);
              }
              break;
            }

            case 'message': {
              const payload = parseEventData<StreamMessageEventData>(event.data);
              const deltaContent = payload?.output?.text;

              if (typeof deltaContent !== 'string' || !deltaContent) {
                break;
              }

              const manager = getTurnStepsManager(turnId);
              manager?.updateStep(STEP_KEYS.response, {
                status: 'processing',
                content: '生成回复',
                tooltip: '模型正在流式返回内容。'
              });

              bufferStreamDelta(turnId, conversationHistoryId, deltaContent);
              break;
            }

            case 'done': {
              const payload = parseEventData<DoneEventData>(event.data);
              completeTurn(conversationHistoryId, turnId, payload || undefined);
              break;
            }

            case 'error-message': {
              const payload = parseEventData<ErrorEventData>(event.data);
              failTurn(
                conversationHistoryId,
                turnId,
                payload?.error?.trim() || '服务端返回错误。'
              );
              abortController.abort();
              break;
            }

            default:
              console.warn('Unknown SSE event type:', event.event);
          }
        },
        onerror(error) {
          console.error(`SSE connection error for conversation ${conversationHistoryId}:`, error);
          throw error;
        },
        async onclose() {
          eventSourceRef.current = null;

          const snapshot = turnStatusRef.current.get(turnId);
          const hasBufferedContent =
            (streamBuffersRef.current.get(turnId)?.chunks.length ?? 0) > 0;

          if (
            !resolvedTurnsRef.current.has(turnId) &&
            (snapshot?.status === 'streaming' || hasBufferedContent)
          ) {
            completeTurn(conversationHistoryId, turnId);
          }
        }
      }).catch((error) => {
        if (abortController.signal.aborted || resolvedTurnsRef.current.has(turnId)) {
          return;
        }

        console.error('Failed to stream chat response:', error);
        failTurn(conversationHistoryId, turnId, '连接已中断，请稍后重试。');
      });
    } catch (error) {
      console.error('Failed to setup SSE connection:', error);
      failTurn(conversationHistoryId, turnId, '请求初始化失败，请稍后重试。');
    }
  };

  const {
    loading: loadingConversationDetail
  } = useRequest(
    async () => getConversationDetailApi(conversationId!),
    {
      ready: needLoadConversationDetail,
      refreshDeps: [conversationId, needLoadConversationDetail],
      loadingDelay: 300,
      onSuccess: (detail) => {
        const detailConversation: ConversationHistory = {
          ...detail,
          id: detail.id || conversationId!,
          conversationState: detail.conversationState || { turns: [] }
        };

        setConversationHistories((prev) => {
          const exists = prev.some((item) => item.id === detailConversation.id);

          if (!exists) {
            return [detailConversation, ...prev];
          }

          return prev.map((item) =>
            item.id === detailConversation.id
              ? {
                  ...item,
                  ...detailConversation
                }
              : item
          );
        });
      },
      onError: (error) => {
        console.error('Failed to load conversation detail:', error);
        message.error('Failed to load conversation detail.');
      }
    }
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(scrollToBottom, 80);
    return () => window.clearTimeout(timeoutId);
  }, [
    conversationState.turns.length,
    latestTurnContentLength,
    latestTurnStepCount,
    loadingConversationDetail
  ]);

  useEffect(
    () => () => {
      eventSourceRef.current?.abort();
      stepManagersRef.current.clear();
      pendingToolStepsRef.current.clear();
      resolvedTurnsRef.current.clear();
      turnStatusRef.current.clear();
      turnSessionsRef.current.clear();
      streamBuffersRef.current.forEach((buffer) => {
        if (buffer.timeoutId !== null) {
          window.clearTimeout(buffer.timeoutId);
        }
      });
      streamBuffersRef.current.clear();
    },
    []
  );

  const sendMessage = async (userInputContent: string) => {
    const trimmedInput = userInputContent.trim();
    if (!trimmedInput) {
      return false;
    }

    if (!selectedAgentId) {
      message.warning('Please select an agent first.');
      return false;
    }

    if (conversationId && !conversationHistory) {
      message.warning('Conversation is still loading.');
      return false;
    }

    let newTurnId: string | null = null;
    let targetConversationId: string | null = null;

    try {
      let targetConversation = conversationHistory;
      let historyTurns = conversationState.turns;

      if (!targetConversation) {
        const result = await createConversationHistory({
          title: trimmedInput,
          initialState: {
            conversationState: {
              turns: [],
              agentId: selectedAgentId,
              agentName: selectedAgent?.name
            }
          }
        });
        targetConversation = result.conversation;
        targetConversationId = targetConversation.id;
        historyTurns = [];
        setLocalConversationId(targetConversation.id);
      } else {
        targetConversationId = targetConversation.id;
        updateConversation(
          targetConversation.id,
          (prevState) => ({
            ...prevState,
            agentId: selectedAgentId,
            agentName: selectedAgent?.name
          }),
          true
        );
      }

      const turnIndex = historyTurns.length;
      const newTurn = createNewTurn(trimmedInput, turnIndex, targetConversation.id);
      newTurnId = newTurn.id;

      turnStatusRef.current.set(newTurn.id, {
        status: 'pending',
        contentLength: 0
      });

      updateConversation(
        targetConversation.id,
        (prevState) => ({
          ...prevState,
          turns: [...prevState.turns, newTurn],
          currentTurnId: newTurn.id
        }),
        false
      );

      initializeTurnSteps(newTurn.id, targetConversation.id);
      setupSSE(newTurn.id, targetConversation.id, historyTurns, trimmedInput, selectedAgentId);

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      message.error('Failed to send message.');

      if (newTurnId && targetConversationId) {
        failTurn(targetConversationId, newTurnId, '请求发送失败，请稍后重试。');
      }

      return false;
    }
  };

  const handleSendMessage = async () => {
    if (conversationState.currentTurnId) {
      return;
    }

    const success = await sendMessage(input);
    if (success) {
      setInput('');
    }
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgentId(value);

    if (!activeConversationId || !conversationHistory) {
      return;
    }

    const nextAgent = agents.find((agent) => String(agent.id) === value);
    updateConversation(
      activeConversationId,
      (prevState) => ({
        ...prevState,
        agentId: value,
        agentName: nextAgent?.name
      }),
      true
    );
  };

  return (
    <div className="chat-area">
      <div
        ref={messagesContainerRef}
        className="chat-area__viewport"
      >
        {loadingConversationDetail ? (
          <div className="chat-area__loading">
            <Spin size="large" />
            <p>Loading conversation...</p>
          </div>
        ) : !isConversationReady ? (
          <div style={{ height: '100%' }} />
        ) : conversationState.turns.length === 0 ? (
          <div className="chat-area__empty">
            <h3 className="chat-area__empty-title">Conversation Workspace</h3>
            <p className="chat-area__empty-copy">
              Start a prompt to create a new assistant response thread.
            </p>
          </div>
        ) : (
          <>
            {conversationState.turns.map((turn) => (
              <ChatTurnCard
                key={turn.id}
                turn={turn}
                onShowTestCase={showTestCaseSidebar}
              />
            ))}
          </>
        )}
      </div>

      <div className="chat-area__composer">
        <Select
          value={selectedAgentId}
          onChange={handleAgentChange}
          placeholder={loadingAgents ? 'Loading agents...' : 'Select agent'}
          options={agents.map((agent) => ({
            label: agent.name,
            value: String(agent.id)
          }))}
          className="chat-area__agent-select"
          disabled={loadingAgents || !!conversationState.currentTurnId}
        />
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={() => setIsRepositoryVisible(true)}
          className="chat-area__attach-button"
        />
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={() => {
            void handleSendMessage();
          }}
          placeholder={isAgentSelected ? 'Type your message here...' : 'Select an agent first'}
          disabled={!isAgentSelected || !!conversationState.currentTurnId}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          onClick={() => {
            void handleSendMessage();
          }}
          disabled={!isAgentSelected || !input.trim() || !!conversationState.currentTurnId}
          className="chat-area__send-button"
        >
          Send
        </Button>
      </div>

      <MyRepository
        visible={isRepositoryVisible}
        onClose={() => setIsRepositoryVisible(false)}
      />
    </div>
  );
}
