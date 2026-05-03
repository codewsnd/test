import React from 'react';
import { Card, Spin, Tag, Typography } from 'antd';
import { ProcessStep, StepStatus, AiResponseStatus } from './types';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from "@ant-design/icons";

interface StatusCardProps {
  steps: ProcessStep[];
  responseStatus: AiResponseStatus;
}

const { Text } = Typography;

const STATUS_META: Record<StepStatus, {
  label: string;
  color: string;
  softBackground: string;
  icon: React.ReactNode;
}> = {
  waiting: {
    label: 'Queued',
    color: '#d48806',
    softBackground: '#fff7e6',
    icon: <ClockCircleOutlined style={{ color: '#d48806' }} />
  },
  processing: {
    label: 'Running',
    color: '#1677ff',
    softBackground: '#e6f4ff',
    icon: <Spin size="small" />
  },
  completed: {
    label: 'Done',
    color: '#389e0d',
    softBackground: '#f6ffed',
    icon: <CheckCircleOutlined style={{ color: '#389e0d' }} />
  },
  error: {
    label: 'Error',
    color: '#cf1322',
    softBackground: '#fff1f0',
    icon: <ExclamationCircleOutlined style={{ color: '#cf1322' }} />
  }
};

const getOverallStatus = (steps: ProcessStep[], responseStatus: AiResponseStatus): StepStatus => {
  if (responseStatus === 'error' || steps.some(step => step.status === 'error')) {
    return 'error';
  }

  if (responseStatus === 'completed' && steps.every(step => step.status === 'completed')) {
    return 'completed';
  }

  if (responseStatus === 'streaming' || responseStatus === 'pending' || steps.some(step => step.status === 'processing')) {
    return 'processing';
  }

  return 'waiting';
};

const getSummaryText = (status: StepStatus) => {
  switch (status) {
    case 'waiting':
      return 'The request is queued.';
    case 'processing':
      return 'The assistant is working on this response.';
    case 'completed':
      return 'The response has been generated.';
    case 'error':
      return 'The request stopped before it could finish.';
    default:
      return '';
  }
};

export const StatusCard: React.FC<StatusCardProps> = ({ steps, responseStatus }) => {
  if (steps.length === 0) {
    return null;
  }

  const overallStatus = getOverallStatus(steps, responseStatus);
  const overallMeta = STATUS_META[overallStatus];

  return (
    <Card
      size="small"
      style={{
        margin: '8px 0',
        borderRadius: '12px',
        background: '#fcfcfd',
        border: `1px solid ${overallMeta.softBackground === '#fff1f0' ? '#ffccc7' : '#e5e7eb'}`
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div>
          <Text strong style={{ fontSize: '13px', color: '#111827' }}>
            Assistant status
          </Text>
          <div style={{ marginTop: '2px' }}>
            <Text style={{ fontSize: '12px', color: '#6b7280' }}>
              {getSummaryText(overallStatus)}
            </Text>
          </div>
        </div>

        <Tag
          bordered={false}
          style={{
            margin: 0,
            color: overallMeta.color,
            background: overallMeta.softBackground,
            fontWeight: 600,
            borderRadius: '999px',
            paddingInline: '10px'
          }}
        >
          {overallMeta.label}
        </Tag>
      </div>

      {steps.map((step, index) => (
        <div
          key={step.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            paddingBottom: index < steps.length - 1 ? '10px' : 0
          }}
        >
          <div style={{ position: 'relative', width: '18px', display: 'flex', justifyContent: 'center' }}>
            {index < steps.length - 1 && (
              <span
                style={{
                  position: 'absolute',
                  top: '18px',
                  bottom: '-10px',
                  width: '1px',
                  background: '#d9d9d9'
                }}
              />
            )}

            <span
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: STATUS_META[step.status].softBackground
              }}
            >
              {STATUS_META[step.status].icon}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Text style={{ fontSize: '13px', color: '#111827' }}>
                {step.content}
              </Text>
              <Text
                style={{
                  fontSize: '11px',
                  color: STATUS_META[step.status].color,
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {STATUS_META[step.status].label}
              </Text>
            </div>

            {step.tooltip && (
              <div style={{ marginTop: '2px' }}>
                <Text style={{ fontSize: '12px', color: '#6b7280' }}>
                  {step.tooltip}
                </Text>
              </div>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
};
*** Update File: /Users/deft/dev/github/test/vite-project-react18/src/pages/home/components/chat/ChatArea.tsx
@@
-import {useState, useRef, useEffect} from "react";
-import {Input, Button, Card, Space, Spin, message} from "antd";
+import { useEffect, useRef, useState } from "react";
+import { Input, Button, Card, Spin, message } from "antd";
 import { PlusOutlined, ArrowRightOutlined } from '@ant-design/icons';
 import { useAtom, useSetAtom } from 'jotai';
 import { useRequest } from 'ahooks';
 
 import { fetchEventSource } from '@microsoft/fetch-event-source';
 import { API_BASE_URLS } from '@/api/axios';
 import type { ConversationTurn } from './types';
 import { StepsManager } from './StepsManager';
 import { StatusCard } from './StatusCard';
 import { MyRepository } from '../chat/dataCenter';
 import { MarkdownRenderer } from '../../../../components/MarkdownRenderer';
 import { getConversationDetailApi, type ConversationHistory } from '@/api/conversationHistoryApi';
 import {
   conversationHistoriesAtom,
   createConversationHistoryAtom, generateConversationTitleAtom,
   setConversationStateAtom
 } from "../conversationHistory/conversationHistoryAtom";
 import { showTestCaseSidebarAtom } from '@/pages/home/components/testCase/testCaseAtom';
 
 interface ChatAreaProps {
   conversationId?: string;
 }
 
+type HistoryMessage = {
+  role: 'user' | 'assistant';
+  content: string;
+};
+
+type ToolCallEventData = {
+  toolname?: string;
+  params?: string;
+};
+
+type ToolResultEventData = {
+  'tool-result'?: string;
+};
+
+type MessageEventData = {
+  output?: {
+    text?: string | null;
+  };
+};
+
+type ErrorEventData = {
+  error?: string;
+};
+
+const STEP_KEYS = {
+  request: 'request',
+  response: 'response',
+  completed: 'completed'
+} as const;
+
+const truncateText = (value: string | undefined, maxLength = 160) => {
+  if (!value) {
+    return '';
+  }
+
+  const normalized = value.replace(/\s+/g, ' ').trim();
+  if (normalized.length <= maxLength) {
+    return normalized;
+  }
+
+  return `${normalized.slice(0, maxLength)}...`;
+};
+
+const safeParseJson = <T,>(raw: string): T | null => {
+  try {
+    return JSON.parse(raw) as T;
+  } catch {
+    return null;
+  }
+};
+
+const buildHistoryMessages = (turns: ConversationTurn[], message: string): HistoryMessage[] => {
+  const historyMessages = turns.flatMap((turn) => {
+    const messages: HistoryMessage[] = [];
+
+    if (turn.userInput?.content) {
+      messages.push({
+        role: 'user',
+        content: turn.userInput.content
+      });
+    }
+
+    if (turn.aiResponse?.content && turn.aiResponse.status === 'completed') {
+      messages.push({
+        role: 'assistant',
+        content: turn.aiResponse.content
+      });
+    }
+
+    return messages;
+  });
+
+  historyMessages.push({
+    role: 'user',
+    content: message
+  });
+
+  return historyMessages;
+};
+
+const appendErrorMessage = (content: string, errorMessage: string) => {
+  const nextErrorMessage = `❌ 错误: ${errorMessage}`;
+  if (content.includes(nextErrorMessage)) {
+    return content;
+  }
+
+  return content ? `${content}\n\n${nextErrorMessage}` : nextErrorMessage;
+};
+
 export default function ChatArea({ conversationId }: ChatAreaProps) {
 
   // 会话历史相关
   const [conversationHistories] = useAtom(conversationHistoriesAtom);
   const setConversationHistories = useSetAtom(conversationHistoriesAtom);
@@
   const [input, setInput] = useState("");
   const messagesContainerRef = useRef<HTMLDivElement>(null);
 
   // data center
   const [isRepositoryVisible, setIsRepositoryVisible] = useState(false);
 
   // 每个ChatArea独立管理自己的SSE连接
   const eventSourceRef = useRef<AbortController | null>(null);
-
-
-  // 移除独立的steps状态，使用ConversationTurn中的processSteps
-  const stepRef = useRef<StepsManager>();
+  const stepManagersRef = useRef<Map<string, StepsManager>>(new Map());
+  const toolStepQueuesRef = useRef<Map<string, string[]>>(new Map());
+
+  const latestTurn = conversationState.turns[conversationState.turns.length - 1];
 
 
   // 滚动到底部
   const scrollToBottom = () => {
     const container = messagesContainerRef.current;
@@
   };
 
   useEffect(() => {
-    const timeoutId = setTimeout(scrollToBottom, 100);
+    const timeoutId = window.setTimeout(scrollToBottom, 80);
     return () => clearTimeout(timeoutId);
-  }, [conversationState.turns.length]);
+  }, [
+    conversationState.turns.length,
+    conversationState.currentTurnId,
+    latestTurn?.aiResponse.content,
+    latestTurn?.processSteps?.length
+  ]);
 
   const {
     loading: loadingConversationDetail
   } = useRequest(
@@
   const createNewTurn = (userInputContent: string, turnIndex: number, conversationHistoryId: string): ConversationTurn => ({
     id: `turn_${Date.now()}_${turnIndex}_${Math.random().toString(36).substring(2, 6)}`,
     turnIndex,
     timestamp: new Date(),
@@
     aiResponse: { content: '', status: 'pending' as const, timestamp: new Date() },
     processSteps: []
   });
 
-  const setupSSE = (turnId: string, message: string) => {
-    if (!conversationHistoryIdRef.current) {
-      console.error('Cannot setup SSE: conversationId is null');
-      return;
-    }
-
-    try {
-      // 清理现有连接
-      if (eventSourceRef.current) {
-        console.log(`Aborting existing SSE connection for conversation: ${conversationHistoryIdRef.current}`);
-        eventSourceRef.current.abort();
-      }
-
-      const sseUrl = `${API_BASE_URLS.core}/deepseek/chat/stream`;
-      console.log(`Creating independent SSE connection: ${sseUrl}`);
-
-      // 创建新的 AbortController
-      const abortController = new AbortController();
-      eventSourceRef.current = abortController;
-
-      // 构建完整的历史消息记录
-      const historyMessages = conversationState.turns.flatMap(turn => {
-        const messages = [];
-
-        // 添加用户消息
-        if (turn.userInput?.content) {
-          messages.push({
-            role: 'user',
-            content: turn.userInput.content
-          });
-        }
-
-        // 添加AI回复
-        if (turn.aiResponse?.content && turn.aiResponse.status === 'completed') {
-          messages.push({
-            role: 'assistant',
-            content: turn.aiResponse.content
-          });
-        }
-
-        return messages;
-      });
-
-      // 添加当前消息
-      historyMessages.push({
-        role: 'user',
-        content: message
-      });
-
-      console.log('Sending messages with history:', historyMessages);
-
-      const requestBody = {
-        // modelName: 'deepseek-chat',
-        messages: historyMessages,
-      };
-
-      fetchEventSource(sseUrl, {
-        method: 'POST',
-        headers: {
-          'Accept': 'text/event-stream',
-          'Content-Type': 'application/json',
-        },
-        body: JSON.stringify(requestBody),
-        signal: abortController.signal,
-
-        async onopen(response) {
-          if (response.ok) {
-            console.log(`Independent SSE connection established for conversation: ${conversationHistoryIdRef.current}`);
-          } else {
-            throw new Error(`Failed to establish SSE connection: ${response.status}`);
-          }
-        },
-
-        onmessage(event) {
-          try {
-            console.log('SSE Event:', event.event, event.data);
-
-            // 处理不同的事件类型
-            switch (event.event) {
-              case 'tool-call': {
-                // 工具调用事件
-                if (!event.data || event.data.trim() === '') {
-                  console.warn('Received empty tool-call data, skipping...');
-                  break;
-                }
-                const toolCallData = JSON.parse(event.data);
-                console.log('Tool call:', toolCallData);
-
-                // 可以在UI中显示工具调用信息
-                setConversationState(
-                  prevState => ({
-                    ...prevState,
-                    turns: prevState.turns.map(turn =>
-                      turn.id === turnId
-                        ? {
-                            ...turn,
-                            aiResponse: {
-                              ...turn.aiResponse,
-                              content: (turn.aiResponse.content || '') + `\n\n🔧 调用工具: ${toolCallData.toolname}\n参数: ${toolCallData.params}\n`,
-                              status: 'streaming' as const
-                            }
-                          }
-                        : turn
-                    ),
-                    currentTurnId: turnId
-                  }),
-                  conversationHistoryIdRef.current,
-                  false
-                );
-                break;
-              }
-
-              case 'tool-result': {
-                // 工具执行结果
-                if (!event.data || event.data.trim() === '') {
-                  console.warn('Received empty tool-result data, skipping...');
-                  break;
-                }
-                // const toolResult = JSON.parse(event.data);
-                // console.log('Tool result:', toolResult);
-                // setConversationState(
-                //   prevState => ({
-                //     ...prevState,
-                //     turns: prevState.turns.map(turn =>
-                //       turn.id === turnId
-                //         ? {
-                //             ...turn,
-                //             aiResponse: {
-                //               ...turn.aiResponse,
-                //               content: (turn.aiResponse.content || '') + `\n✅ 工具结果: ${toolResult['tool-result']}\n`,
-                //               status: 'streaming' as const
-                //             }
-                //           }
-                //         : turn
-                //     ),
-                //     currentTurnId: turnId
-                //   }),
-                //   conversationHistoryIdRef.current,
-                //   false
-                // );
-                break;
-              }
-
-              case 'message': {
-                // 流式AI响应消息
-                try {
-                  // 检查 event.data 是否为空或无效
-                  if (!event.data || event.data.trim() === '') {
-                    console.warn('Received empty message data, skipping...');
-                    break;
-                  }
-
-                  const messageData = JSON.parse(event.data);
-                  console.log('Message data:', messageData);
-
-                  // Spring AI ChatResponse.Result 结构:
-                  // { output: { text: string, messageType: string, ... }, metadata: { ... } }
-                  // 提取 text 字段作为增量内容
-                  let deltaContent = '';
-
-                  if (messageData.output && typeof messageData.output.text === 'string') {
-                    deltaContent = messageData.output.text;
-                  }
-
-                  console.log('Delta content:', deltaContent);
-
-                  // 即使是空字符串也要处理，因为可能是流的一部分
-                  if (deltaContent !== undefined && deltaContent !== null) {
-                    setConversationState(
-                      prevState => {
-                        const updatedTurns = prevState.turns.map(turn => {
-                          if (turn.id === turnId) {
-                            const currentContent = turn.aiResponse.content || '';
-                            return {
-                              ...turn,
-                              aiResponse: {
-                                ...turn.aiResponse,
-                                content: currentContent + deltaContent,
-                                status: 'streaming' as const
-                              }
-                            };
-                          }
-                          return turn;
-                        });
-
-                        return {
-                          ...prevState,
-                          turns: updatedTurns,
-                          currentTurnId: turnId
-                        };
-                      },
-                      conversationHistoryIdRef.current,
-                      false
-                    );
-
-                    // 完成第二步（仅在第一次收到数据时）
-                    if (stepRef.current && deltaContent) {
-                      const currentSteps = stepRef.current.getSteps();
-                      const step2 = currentSteps.find(step => step.content === '处理中' && step.status === 'processing');
-                      if (step2) {
-                        stepRef.current.completeStep(step2.id);
-                      }
-                    }
-                  }
-                } catch (parseError) {
-                  console.error('Failed to parse message event:', parseError, 'Raw data:', event.data);
-                }
-                break;
-              }
-
-              case 'done': {
-                // 流结束
-                console.log('Stream done:', event.data);
-
-                // 完成第三步
-                if (stepRef.current && (stepRef.current as any).step3Id) {
-                  const step3Id = (stepRef.current as any).step3Id;
-                  stepRef.current.startProcessing(step3Id);
-                  setTimeout(() => {
-                    stepRef.current?.completeStep(step3Id);
-                  }, 500);
-                }
-
-                // AI回复完成
-                setConversationState(
-                  prevState => {
-                    console.log('AI response completed, turns length:', prevState.turns.length);
-
-                    const updatedState = {
-                      ...prevState,
-                      turns: prevState.turns.map(turn =>
-                        turn.id === turnId
-                          ? {...turn, aiResponse: {...turn.aiResponse, status: 'completed' as const, timestamp: new Date()}}
-                          : turn
-                      ),
-                      currentTurnId: undefined
-                    };
-
-                    // 如果这是新会话的第一次对话，生成标题
-                    if (updatedState.turns.length === 1) {
-                      generateConversationTitle({
-                        conversationId: conversationHistoryIdRef.current!,
-                        turns: updatedState.turns,
-                        turnId
-                      }).catch(console.error);
-                    }
-
-                    return updatedState;
-                  },
-                  conversationHistoryIdRef.current,
-                  true
-                );
-
-                // 连接完成后清理
-                eventSourceRef.current = null;
-                console.log(`Independent SSE connection completed for conversation: ${conversationHistoryIdRef.current}`);
-                break;
-              }
-
-              case 'error-message': {
-                // 错误消息
-                if (!event.data || event.data.trim() === '') {
-                  console.warn('Received empty error-message data, skipping...');
-                  break;
-                }
-                const errorData = JSON.parse(event.data);
-                console.error('Error from server:', errorData);
-
-                setConversationState(
-                  prevState => ({
-                    ...prevState,
-                    turns: prevState.turns.map(turn =>
-                      turn.id === turnId
-                        ? {
-                            ...turn,
-                            aiResponse: {
-                              ...turn.aiResponse,
-                              content: (turn.aiResponse.content || '') + `\n\n❌ 错误: ${errorData.error}`,
-                              status: 'error' as const
-                            }
-                          }
-                        : turn
-                    ),
-                    currentTurnId: undefined
-                  }),
-                  conversationHistoryIdRef.current,
-                  false
-                );
-                break;
-              }
-
-              default:
-                console.warn('Unknown event type:', event.event);
-            }
-          } catch (error) {
-            console.error('Error processing SSE message:', error);
-          }
-        },
-
-        onerror(error) {
-          console.error(`Independent SSE connection error for conversation ${conversationHistoryIdRef.current}:`, error);
-
-          setConversationState(
-            prevState => ({
-              ...prevState,
-              turns: prevState.turns.map(turn =>
-                turn.id === turnId
-                  ? {...turn, aiResponse: {...turn.aiResponse, status: 'error' as const}}
-                  : turn
-              ),
-              currentTurnId: undefined
-            }),
-            conversationHistoryIdRef.current,
-            false
-          );
-
-          // 错误时清理连接
-          eventSourceRef.current = null;
-          console.log(`Independent SSE connection closed due to error for conversation: ${conversationHistoryIdRef.current}`);
-
-          // 抛出错误以停止重试
-          throw error;
-        },
-
-        // 自定义重试逻辑
-        openWhenHidden: true, // 即使页面在后台也保持连接
-        async onclose() {
-          // 连接关闭时的处理
-          console.log(`Independent SSE connection closed for conversation: ${conversationHistoryIdRef.current}`);
-
-          // 备用机制：如果连接关闭但没有收到[DONE]，也尝试完成处理
-          setTimeout(() => {
-            setConversationState(
-              prevState => {
-                const currentTurn = prevState.turns.find(turn => turn.id === turnId);
-                if (currentTurn && currentTurn.aiResponse.status === 'streaming') {
-                  console.log('SSE connection closed while streaming, marking as completed');
-
-                  const updatedState = {
-                    ...prevState,
-                    turns: prevState.turns.map(turn =>
-                      turn.id === turnId
-                        ? {...turn, aiResponse: {...turn.aiResponse, status: 'completed' as const, timestamp: new Date()}}
-                        : turn
-                    ),
-                    currentTurnId: undefined
-                  };
-
-                  // 如果这是新会话的第一次对话，生成标题
-                  if (prevState.turns.length === 1 && currentTurn.aiResponse.content) {
-                    generateConversationTitle({
-                      conversationId: conversationHistoryIdRef.current!,
-                      turns: updatedState.turns,
-                      turnId
-                    }).catch(console.error);
-                  }
-
-                  return updatedState;
-                }
-                return prevState;
-              },
-              conversationHistoryIdRef.current,
-              true
-            );
-          }, 200);
-        }
-      });
-
-    } catch (error) {
-      console.error('Failed to setup independent SSE connection:', error);
-      handleError(turnId);
-    }
-  };
-
-  // 简化的错误处理
-  const handleError = (turnId: string) => {
-    if (!conversationHistoryIdRef.current) return;
-
-    setConversationState(
-      prevState => ({
-        ...prevState,
-        turns: prevState.turns.map(turn =>
-          turn.id === turnId
-            ? {...turn, aiResponse: {...turn.aiResponse, status: 'error' as const}}
-            : turn
-        ),
-        currentTurnId: undefined
-      }),
-      conversationHistoryIdRef.current,
-      false
-    );
-  };
+  const updateTurnState = (
+    turnId: string,
+    updater: (turn: ConversationTurn) => ConversationTurn,
+    {
+      currentTurnId,
+      isDone = false,
+      targetConversationId = conversationHistoryIdRef.current
+    }: {
+      currentTurnId?: string;
+      isDone?: boolean;
+      targetConversationId?: string | null;
+    } = {}
+  ) => {
+    if (!targetConversationId) {
+      return;
+    }
+
+    setConversationState(
+      (prevState) => ({
+        ...prevState,
+        turns: prevState.turns.map((turn) => turn.id === turnId ? updater(turn) : turn),
+        currentTurnId
+      }),
+      targetConversationId,
+      isDone
+    );
+  };
+
+  const createTurnStepsManager = (turnId: string) => {
+    const manager = new StepsManager((steps) => {
+      updateTurnState(turnId, (turn) => ({
+        ...turn,
+        processSteps: steps
+      }));
+    });
+
+    stepManagersRef.current.set(turnId, manager);
+    toolStepQueuesRef.current.set(turnId, []);
+
+    return manager;
+  };
+
+  const getTurnStepsManager = (turnId: string) => stepManagersRef.current.get(turnId);
+
+  const initializeTurnSteps = (turnId: string) => {
+    const manager = createTurnStepsManager(turnId);
+
+    manager.addStep('初始化请求', '准备发送消息到服务器', {
+      key: STEP_KEYS.request,
+      status: 'processing'
+    });
+    manager.completeStep(STEP_KEYS.request);
+
+    manager.addStep('分析需求', 'AI 正在理解上下文并准备回复', {
+      key: STEP_KEYS.response,
+      status: 'processing'
+    });
+
+    manager.addStep('完成', '响应流结束后会自动关闭', {
+      key: STEP_KEYS.completed
+    });
+
+    return manager;
+  };
+
+  const finalizeTurnSteps = (turnId: string) => {
+    const manager = getTurnStepsManager(turnId);
+    if (!manager) {
+      return;
+    }
+
+    manager.updateStep(STEP_KEYS.response, {
+      status: 'completed',
+      content: '生成回复',
+      tooltip: 'AI 已完成本轮回复'
+    });
+    manager.startProcessing(STEP_KEYS.completed);
+    manager.completeStep(STEP_KEYS.completed);
+  };
+
+  const failTurnSteps = (turnId: string, detail = '响应生成失败') => {
+    const manager = getTurnStepsManager(turnId);
+    if (!manager) {
+      return;
+    }
+
+    manager.errorStep(STEP_KEYS.completed, detail);
+    manager.settleUnfinishedSteps('error', detail);
+  };
+
+  const addToolStep = (turnId: string, payload: ToolCallEventData) => {
+    const manager = getTurnStepsManager(turnId);
+    if (!manager) {
+      return;
+    }
+
+    manager.updateStep(STEP_KEYS.response, {
+      status: 'processing',
+      content: '调用工具',
+      tooltip: 'AI 正在请求外部工具协助处理'
+    });
+
+    const stepId = manager.addStep(
+      `工具执行 · ${payload.toolname || '未命名工具'}`,
+      truncateText(payload.params),
+      { status: 'processing' }
+    );
+
+    const toolQueue = toolStepQueuesRef.current.get(turnId) || [];
+    toolQueue.push(stepId);
+    toolStepQueuesRef.current.set(turnId, toolQueue);
+  };
+
+  const completeToolStep = (turnId: string, payload: ToolResultEventData) => {
+    const manager = getTurnStepsManager(turnId);
+    if (!manager) {
+      return;
+    }
+
+    const toolQueue = toolStepQueuesRef.current.get(turnId) || [];
+    const currentToolStepId = toolQueue.shift();
+
+    if (currentToolStepId) {
+      manager.updateStep(currentToolStepId, {
+        status: 'completed',
+        tooltip: payload['tool-result']
+          ? `工具结果已返回：${truncateText(payload['tool-result'])}`
+          : '工具结果已返回'
+      });
+    }
+
+    toolStepQueuesRef.current.set(turnId, toolQueue);
+    manager.updateStep(STEP_KEYS.response, {
+      status: 'processing',
+      content: '生成回复',
+      tooltip: 'AI 正在整合工具结果'
+    });
+  };
+
+  const cleanupTurnRuntime = (turnId: string) => {
+    stepManagersRef.current.delete(turnId);
+    toolStepQueuesRef.current.delete(turnId);
+  };
+
+  const completeTurn = (turnId: string, isDone: boolean) => {
+    if (!conversationHistoryIdRef.current) {
+      return;
+    }
+
+    finalizeTurnSteps(turnId);
+
+    setConversationState(
+      (prevState) => {
+        const currentTurn = prevState.turns.find((turn) => turn.id === turnId);
+        if (!currentTurn || currentTurn.aiResponse.status === 'completed' || currentTurn.aiResponse.status === 'error') {
+          return prevState;
+        }
+
+        const updatedState = {
+          ...prevState,
+          turns: prevState.turns.map((turn) =>
+            turn.id === turnId
+              ? {
+                  ...turn,
+                  aiResponse: {
+                    ...turn.aiResponse,
+                    status: 'completed' as const,
+                    timestamp: new Date()
+                  }
+                }
+              : turn
+          ),
+          currentTurnId: undefined
+        };
+
+        if (updatedState.turns.length === 1 && currentTurn.aiResponse.content) {
+          generateConversationTitle({
+            conversationId: conversationHistoryIdRef.current!,
+            turns: updatedState.turns,
+            turnId
+          }).catch(console.error);
+        }
+
+        return updatedState;
+      },
+      conversationHistoryIdRef.current,
+      isDone
+    );
+
+    cleanupTurnRuntime(turnId);
+    eventSourceRef.current = null;
+  };
+
+  const markTurnAsError = (turnId: string, errorMessage?: string) => {
+    failTurnSteps(turnId, errorMessage || '响应生成失败');
+
+    updateTurnState(
+      turnId,
+      (turn) => ({
+        ...turn,
+        aiResponse: {
+          ...turn.aiResponse,
+          content: errorMessage ? appendErrorMessage(turn.aiResponse.content || '', errorMessage) : turn.aiResponse.content,
+          status: 'error' as const,
+          timestamp: new Date()
+        }
+      }),
+      {
+        currentTurnId: undefined
+      }
+    );
+
+    cleanupTurnRuntime(turnId);
+    eventSourceRef.current = null;
+  };
+
+  const setupSSE = (turnId: string, userMessage: string) => {
+    if (!conversationHistoryIdRef.current) {
+      console.error('Cannot setup SSE: conversationId is null');
+      return;
+    }
+
+    if (eventSourceRef.current) {
+      eventSourceRef.current.abort();
+    }
+
+    const abortController = new AbortController();
+    eventSourceRef.current = abortController;
+
+    const requestBody = {
+      messages: buildHistoryMessages(conversationState.turns, userMessage)
+    };
+
+    void fetchEventSource(`${API_BASE_URLS.core}/deepseek/chat/stream`, {
+      method: 'POST',
+      headers: {
+        Accept: 'text/event-stream',
+        'Content-Type': 'application/json'
+      },
+      body: JSON.stringify(requestBody),
+      signal: abortController.signal,
+      openWhenHidden: true,
+      async onopen(response) {
+        if (!response.ok) {
+          throw new Error(`Failed to establish SSE connection: ${response.status}`);
+        }
+      },
+      onmessage(event) {
+        if (!event.data || event.data.trim() === '') {
+          return;
+        }
+
+        switch (event.event) {
+          case 'tool-call': {
+            const payload = safeParseJson<ToolCallEventData>(event.data);
+            if (payload) {
+              addToolStep(turnId, payload);
+            }
+            break;
+          }
+
+          case 'tool-result': {
+            const payload = safeParseJson<ToolResultEventData>(event.data);
+            if (payload) {
+              completeToolStep(turnId, payload);
+            }
+            break;
+          }
+
+          case 'message': {
+            const payload = safeParseJson<MessageEventData>(event.data);
+            const deltaContent = payload?.output?.text;
+
+            if (deltaContent === undefined || deltaContent === null) {
+              break;
+            }
+
+            updateTurnState(
+              turnId,
+              (turn) => ({
+                ...turn,
+                aiResponse: {
+                  ...turn.aiResponse,
+                  content: `${turn.aiResponse.content || ''}${deltaContent}`,
+                  status: 'streaming' as const
+                }
+              }),
+              {
+                currentTurnId: turnId
+              }
+            );
+
+            if (deltaContent) {
+              const manager = getTurnStepsManager(turnId);
+              manager?.updateStep(STEP_KEYS.response, {
+                status: 'processing',
+                content: '生成回复',
+                tooltip: 'AI 正在输出最终答案'
+              });
+            }
+            break;
+          }
+
+          case 'done':
+            completeTurn(turnId, true);
+            break;
+
+          case 'error-message': {
+            const payload = safeParseJson<ErrorEventData>(event.data);
+            markTurnAsError(turnId, payload?.error || '服务器返回了错误信息');
+            break;
+          }
+
+          default:
+            break;
+        }
+      },
+      onerror(error) {
+        if ((error as Error).name === 'AbortError') {
+          return;
+        }
+
+        markTurnAsError(turnId);
+        throw error;
+      },
+      onclose() {
+        window.setTimeout(() => {
+          completeTurn(turnId, true);
+        }, 200);
+      }
+    }).catch((error: unknown) => {
+      if ((error as Error).name === 'AbortError') {
+        return;
+      }
+
+      console.error('Failed to consume SSE stream:', error);
+      markTurnAsError(turnId);
+    });
+  };
 
   // 简化的API请求函数
   const sendChatRequest = async (userInputContent: string, turnId: string) => {
     if (!conversationHistoryIdRef.current) {
       console.error('Cannot send chat request: conversationId is null');
@@
       handleError(turnId);
       throw error;
     }
   };
-
-  useEffect(() => {
-    // 初始化StepsManager
-    stepRef.current = new StepsManager(() => {});
-  }, []);
 
   // 简化的发送消息函数
   const sendMessage = async (userInput: string) => {
     const trimmedInput = userInput.trim();
     if (!trimmedInput) return;
              {step.content}
            </span>
            {step.tooltip && (
              <div style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '2px'
              }}>
                {step.tooltip}
              </div>
            )}
          </div>

          <span style={{
            fontSize: '11px',
            color: getStatusColor(step.status),
            fontWeight: '500'
          }}>
            {getStatusText(step.status)}
          </span>
        </div>
      ))}
    </Card>
  );
};
       setConversationState(
         prevState => ({
           ...prevState,
           turns: [...prevState.turns, newTurn],
           currentTurnId: newTurn.id
         }),
         targetConversation.id,
         false
       );
 
-      // 设置步骤管理器
-      stepRef.current!.callback = (steps) => {
-        setConversationState(
-          prevState => ({
-            ...prevState,
-            turns: prevState.turns.map(turn =>
-              turn.id === newTurn.id ? { ...turn, processSteps: steps } : turn
-            )
-          }),
-          conversationHistoryIdRef.current,
-          false
-        );
-      };
-
-      // 添加处理步骤并发送请求
-      const step1 = stepRef.current!.addStep('初始化请求', '准备发送消息到服务器');
-      const step2 = stepRef.current!.addStep('处理中', '服务器正在处理您的请求');
-      const step3 = stepRef.current!.addStep('完成', '响应已生成完毕');
-
-      (stepRef.current as any).step3Id = step3;
-
-      stepRef.current!.startProcessing(step1);
-      stepRef.current!.completeStep(step1);
-      stepRef.current!.startProcessing(step2);
+      initializeTurnSteps(newTurn.id);
 
       await sendChatRequest(trimmedInput, newTurn.id);
 
     } catch (error) {
       console.error('Failed to send message:', error);
-      if (stepRef.current) {
-        const currentSteps = stepRef.current.getSteps();
-        currentSteps.forEach(step => {
-          if (step.status !== 'completed') {
-            stepRef.current?.errorStep(step.id);
-          }
-        });
-      }
+      markTurnAsError((error as { turnId?: string })?.turnId || conversationState.currentTurnId || '');
     }
   };
 
   // 处理发送消息按钮点击
   const handleSendMessage = async () => {
@@
                 >
                   {turn.userInput.content}
                 </Card>
 
                 {/* 状态卡片 - 显示在用户输入后，AI响应前 */}
-                <StatusCard steps={turn.processSteps || []} />
+                <StatusCard
+                  steps={turn.processSteps || []}
+                  responseStatus={turn.aiResponse.status}
+                />
 
                 {/* AI响应 */}
                 <Card
                   style={{
                     margin: "8px 0",
