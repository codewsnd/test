import {useState, useRef, useEffect} from "react";
import {Input, Button, Card, Space, Spin, message} from "antd";
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

export default function ChatArea({ conversationId }: ChatAreaProps) {

  // 会话历史相关
  const [conversationHistories] = useAtom(conversationHistoriesAtom);
  const setConversationHistories = useSetAtom(conversationHistoriesAtom);
  const createConversationHistory = useSetAtom(createConversationHistoryAtom);
  const setConversationState = useSetAtom(setConversationStateAtom);
  const generateConversationTitle = useSetAtom(generateConversationTitleAtom);
  const showTestCaseSidebar = useSetAtom(showTestCaseSidebarAtom);

  const conversationHistoryIdRef = useRef<string | null>(conversationId || null);
  const conversationHistory = conversationHistoryIdRef.current ?
    conversationHistories.find(c => c.id === conversationHistoryIdRef.current) : undefined;
  const conversationState = conversationHistory?.conversationState || {
    turns: [],
    currentTurnId: undefined
  };
  const isConversationReady = !conversationId || !!conversationHistory?.conversationState;
  const needLoadConversationDetail = !!conversationId && !conversationHistory?.conversationState;

  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // data center
  const [isRepositoryVisible, setIsRepositoryVisible] = useState(false);

  // 每个ChatArea独立管理自己的SSE连接
  const eventSourceRef = useRef<AbortController | null>(null);


  // 移除独立的steps状态，使用ConversationTurn中的processSteps
  const stepRef = useRef<StepsManager>();


  // 滚动到底部
  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [conversationState.turns.length]);

  const {
    loading: loadingConversationDetail
  } = useRequest(
    async () => {
      return await getConversationDetailApi(conversationId!);
    },
    {
      ready: needLoadConversationDetail,
      refreshDeps: [conversationId, needLoadConversationDetail],
      loadingDelay: 300,
      onSuccess: (detail) => {
        const id = detail.id || conversationId!;
        const detailConversation: ConversationHistory = {
          ...detail,
          conversationState: detail.conversationState || { turns: [] }
        };

        setConversationHistories(prev => {
          const exists = prev.some(c => c.id === id);
          if (!exists) {
            return [detailConversation, ...prev];
          }
          return prev.map(c => c.id === id
            ? { ...c, ...detailConversation }
            : c
          );
        });
      },
      onError: (error) => {
        console.error('Failed to load conversation detail:', error);
        message.error('Failed to load conversation detail.');
      }
    }
  );

  // 创建新的对话轮次
  const createNewTurn = (userInputContent: string, turnIndex: number, conversationHistoryId: string): ConversationTurn => ({
    id: `turn_${Date.now()}_${turnIndex}_${Math.random().toString(36).substring(2, 6)}`,
    turnIndex,
    timestamp: new Date(),
    conversationHistoryId,
    userInput: { content: userInputContent },
    aiResponse: { content: '', status: 'pending' as const, timestamp: new Date() },
    processSteps: []
  });

  const setupSSE = (turnId: string, message: string) => {
    if (!conversationHistoryIdRef.current) {
      console.error('Cannot setup SSE: conversationId is null');
      return;
    }

    try {
      // 清理现有连接
      if (eventSourceRef.current) {
        console.log(`Aborting existing SSE connection for conversation: ${conversationHistoryIdRef.current}`);
        eventSourceRef.current.abort();
      }

      const sseUrl = `${API_BASE_URLS.core}/deepseek/chat/stream`;
      console.log(`Creating independent SSE connection: ${sseUrl}`);

      // 创建新的 AbortController
      const abortController = new AbortController();
      eventSourceRef.current = abortController;

      // 构建完整的历史消息记录
      const historyMessages = conversationState.turns.flatMap(turn => {
        const messages = [];

        // 添加用户消息
        if (turn.userInput?.content) {
          messages.push({
            role: 'user',
            content: turn.userInput.content
          });
        }

        // 添加AI回复
        if (turn.aiResponse?.content && turn.aiResponse.status === 'completed') {
          messages.push({
            role: 'assistant',
            content: turn.aiResponse.content
          });
        }

        return messages;
      });

      // 添加当前消息
      historyMessages.push({
        role: 'user',
        content: message
      });

      console.log('Sending messages with history:', historyMessages);

      const requestBody = {
        // modelName: 'deepseek-chat',
        messages: historyMessages,
      };

      fetchEventSource(sseUrl, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,

        async onopen(response) {
          if (response.ok) {
            console.log(`Independent SSE connection established for conversation: ${conversationHistoryIdRef.current}`);
          } else {
            throw new Error(`Failed to establish SSE connection: ${response.status}`);
          }
        },

        onmessage(event) {
          try {
            console.log('SSE Event:', event.event, event.data);

            // 处理不同的事件类型
            switch (event.event) {
              case 'tool-call': {
                // 工具调用事件
                if (!event.data || event.data.trim() === '') {
                  console.warn('Received empty tool-call data, skipping...');
                  break;
                }
                const toolCallData = JSON.parse(event.data);
                console.log('Tool call:', toolCallData);

                // 可以在UI中显示工具调用信息
                setConversationState(
                  prevState => ({
                    ...prevState,
                    turns: prevState.turns.map(turn =>
                      turn.id === turnId
                        ? {
                            ...turn,
                            aiResponse: {
                              ...turn.aiResponse,
                              content: (turn.aiResponse.content || '') + `\n\n🔧 调用工具: ${toolCallData.toolname}\n参数: ${toolCallData.params}\n`,
                              status: 'streaming' as const
                            }
                          }
                        : turn
                    ),
                    currentTurnId: turnId
                  }),
                  conversationHistoryIdRef.current,
                  false
                );
                break;
              }

              case 'tool-result': {
                // 工具执行结果
                if (!event.data || event.data.trim() === '') {
                  console.warn('Received empty tool-result data, skipping...');
                  break;
                }
                // const toolResult = JSON.parse(event.data);
                // console.log('Tool result:', toolResult);
                // setConversationState(
                //   prevState => ({
                //     ...prevState,
                //     turns: prevState.turns.map(turn =>
                //       turn.id === turnId
                //         ? {
                //             ...turn,
                //             aiResponse: {
                //               ...turn.aiResponse,
                //               content: (turn.aiResponse.content || '') + `\n✅ 工具结果: ${toolResult['tool-result']}\n`,
                //               status: 'streaming' as const
                //             }
                //           }
                //         : turn
                //     ),
                //     currentTurnId: turnId
                //   }),
                //   conversationHistoryIdRef.current,
                //   false
                // );
                break;
              }

              case 'message': {
                // 流式AI响应消息
                try {
                  // 检查 event.data 是否为空或无效
                  if (!event.data || event.data.trim() === '') {
                    console.warn('Received empty message data, skipping...');
                    break;
                  }

                  const messageData = JSON.parse(event.data);
                  console.log('Message data:', messageData);

                  // Spring AI ChatResponse.Result 结构:
                  // { output: { text: string, messageType: string, ... }, metadata: { ... } }
                  // 提取 text 字段作为增量内容
                  let deltaContent = '';

                  if (messageData.output && typeof messageData.output.text === 'string') {
                    deltaContent = messageData.output.text;
                  }

                  console.log('Delta content:', deltaContent);

                  // 即使是空字符串也要处理，因为可能是流的一部分
                  if (deltaContent !== undefined && deltaContent !== null) {
                    setConversationState(
                      prevState => {
                        const updatedTurns = prevState.turns.map(turn => {
                          if (turn.id === turnId) {
                            const currentContent = turn.aiResponse.content || '';
                            return {
                              ...turn,
                              aiResponse: {
                                ...turn.aiResponse,
                                content: currentContent + deltaContent,
                                status: 'streaming' as const
                              }
                            };
                          }
                          return turn;
                        });

                        return {
                          ...prevState,
                          turns: updatedTurns,
                          currentTurnId: turnId
                        };
                      },
                      conversationHistoryIdRef.current,
                      false
                    );

                    // 完成第二步（仅在第一次收到数据时）
                    if (stepRef.current && deltaContent) {
                      const currentSteps = stepRef.current.getSteps();
                      const step2 = currentSteps.find(step => step.content === '处理中' && step.status === 'processing');
                      if (step2) {
                        stepRef.current.completeStep(step2.id);
                      }
                    }
                  }
                } catch (parseError) {
                  console.error('Failed to parse message event:', parseError, 'Raw data:', event.data);
                }
                break;
              }

              case 'done': {
                // 流结束
                console.log('Stream done:', event.data);

                // 完成第三步
                if (stepRef.current && (stepRef.current as any).step3Id) {
                  const step3Id = (stepRef.current as any).step3Id;
                  stepRef.current.startProcessing(step3Id);
                  setTimeout(() => {
                    stepRef.current?.completeStep(step3Id);
                  }, 500);
                }

                // AI回复完成
                setConversationState(
                  prevState => {
                    console.log('AI response completed, turns length:', prevState.turns.length);

                    const updatedState = {
                      ...prevState,
                      turns: prevState.turns.map(turn =>
                        turn.id === turnId
                          ? {...turn, aiResponse: {...turn.aiResponse, status: 'completed' as const, timestamp: new Date()}}
                          : turn
                      ),
                      currentTurnId: undefined
                    };

                    // 如果这是新会话的第一次对话，生成标题
                    if (updatedState.turns.length === 1) {
                      generateConversationTitle({
                        conversationId: conversationHistoryIdRef.current!,
                        turns: updatedState.turns,
                        turnId
                      }).catch(console.error);
                    }

                    return updatedState;
                  },
                  conversationHistoryIdRef.current,
                  true
                );

                // 连接完成后清理
                eventSourceRef.current = null;
                console.log(`Independent SSE connection completed for conversation: ${conversationHistoryIdRef.current}`);
                break;
              }

              case 'error-message': {
                // 错误消息
                if (!event.data || event.data.trim() === '') {
                  console.warn('Received empty error-message data, skipping...');
                  break;
                }
                const errorData = JSON.parse(event.data);
                console.error('Error from server:', errorData);

                setConversationState(
                  prevState => ({
                    ...prevState,
                    turns: prevState.turns.map(turn =>
                      turn.id === turnId
                        ? {
                            ...turn,
                            aiResponse: {
                              ...turn.aiResponse,
                              content: (turn.aiResponse.content || '') + `\n\n❌ 错误: ${errorData.error}`,
                              status: 'error' as const
                            }
                          }
                        : turn
                    ),
                    currentTurnId: undefined
                  }),
                  conversationHistoryIdRef.current,
                  false
                );
                break;
              }

              default:
                console.warn('Unknown event type:', event.event);
            }
          } catch (error) {
            console.error('Error processing SSE message:', error);
          }
        },

        onerror(error) {
          console.error(`Independent SSE connection error for conversation ${conversationHistoryIdRef.current}:`, error);

          setConversationState(
            prevState => ({
              ...prevState,
              turns: prevState.turns.map(turn =>
                turn.id === turnId
                  ? {...turn, aiResponse: {...turn.aiResponse, status: 'error' as const}}
                  : turn
              ),
              currentTurnId: undefined
            }),
            conversationHistoryIdRef.current,
            false
          );

          // 错误时清理连接
          eventSourceRef.current = null;
          console.log(`Independent SSE connection closed due to error for conversation: ${conversationHistoryIdRef.current}`);

          // 抛出错误以停止重试
          throw error;
        },

        // 自定义重试逻辑
        openWhenHidden: true, // 即使页面在后台也保持连接
        async onclose() {
          // 连接关闭时的处理
          console.log(`Independent SSE connection closed for conversation: ${conversationHistoryIdRef.current}`);

          // 备用机制：如果连接关闭但没有收到[DONE]，也尝试完成处理
          setTimeout(() => {
            setConversationState(
              prevState => {
                const currentTurn = prevState.turns.find(turn => turn.id === turnId);
                if (currentTurn && currentTurn.aiResponse.status === 'streaming') {
                  console.log('SSE connection closed while streaming, marking as completed');

                  const updatedState = {
                    ...prevState,
                    turns: prevState.turns.map(turn =>
                      turn.id === turnId
                        ? {...turn, aiResponse: {...turn.aiResponse, status: 'completed' as const, timestamp: new Date()}}
                        : turn
                    ),
                    currentTurnId: undefined
                  };

                  // 如果这是新会话的第一次对话，生成标题
                  if (prevState.turns.length === 1 && currentTurn.aiResponse.content) {
                    generateConversationTitle({
                      conversationId: conversationHistoryIdRef.current!,
                      turns: updatedState.turns,
                      turnId
                    }).catch(console.error);
                  }

                  return updatedState;
                }
                return prevState;
              },
              conversationHistoryIdRef.current,
              true
            );
          }, 200);
        }
      });

    } catch (error) {
      console.error('Failed to setup independent SSE connection:', error);
      handleError(turnId);
    }
  };

  // 简化的错误处理
  const handleError = (turnId: string) => {
    if (!conversationHistoryIdRef.current) return;

    setConversationState(
      prevState => ({
        ...prevState,
        turns: prevState.turns.map(turn =>
          turn.id === turnId
            ? {...turn, aiResponse: {...turn.aiResponse, status: 'error' as const}}
            : turn
        ),
        currentTurnId: undefined
      }),
      conversationHistoryIdRef.current,
      false
    );
  };

  // 简化的API请求函数
  const sendChatRequest = async (userInputContent: string, turnId: string) => {
    if (!conversationHistoryIdRef.current) {
      console.error('Cannot send chat request: conversationId is null');
      return;
    }

    try {
      setupSSE(turnId, userInputContent);
    } catch (error) {
      console.error('Failed to send chat request:', error);
      handleError(turnId);
      throw error;
    }
  };

  useEffect(() => {
    // 初始化StepsManager
    stepRef.current = new StepsManager(() => {});
  }, []);

  // 简化的发送消息函数
  const sendMessage = async (userInput: string) => {
    const trimmedInput = userInput.trim();
    if (!trimmedInput) return;

    try {
      // 获取或创建对话
      let targetConversation = conversationHistory;
      let isNewConversation = false;

      if (!targetConversation) {
        const result = await createConversationHistory({ title: trimmedInput });
        targetConversation = result.conversation;
        isNewConversation = true;
        conversationHistoryIdRef.current = targetConversation.id;
      }

      // 创建新的对话轮次
      const turnIndex = isNewConversation ? 0 : conversationState.turns.length;
      const newTurn = createNewTurn(trimmedInput, turnIndex, targetConversation.id);

      // 更新对话状态
      setConversationState(
        prevState => ({
          ...prevState,
          turns: [...prevState.turns, newTurn],
          currentTurnId: newTurn.id
        }),
        targetConversation.id,
        false
      );

      // 设置步骤管理器
      stepRef.current!.callback = (steps) => {
        setConversationState(
          prevState => ({
            ...prevState,
            turns: prevState.turns.map(turn =>
              turn.id === newTurn.id ? { ...turn, processSteps: steps } : turn
            )
          }),
          conversationHistoryIdRef.current,
          false
        );
      };

      // 添加处理步骤并发送请求
      const step1 = stepRef.current!.addStep('初始化请求', '准备发送消息到服务器');
      const step2 = stepRef.current!.addStep('处理中', '服务器正在处理您的请求');
      const step3 = stepRef.current!.addStep('完成', '响应已生成完毕');

      (stepRef.current as any).step3Id = step3;

      stepRef.current!.startProcessing(step1);
      stepRef.current!.completeStep(step1);
      stepRef.current!.startProcessing(step2);

      await sendChatRequest(trimmedInput, newTurn.id);

    } catch (error) {
      console.error('Failed to send message:', error);
      if (stepRef.current) {
        const currentSteps = stepRef.current.getSteps();
        currentSteps.forEach(step => {
          if (step.status !== 'completed') {
            stepRef.current?.errorStep(step.id);
          }
        });
      }
    }
  };

  // 处理发送消息按钮点击
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput("");
  };

  return (
    <>
      <div ref={messagesContainerRef} style={{flex: 1, overflowY: "auto"}}>
        {loadingConversationDetail ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            color: "#999",
            flexDirection: "column",
            gap: "12px"
          }}>
            <Spin size="large" />
            <p>Loading conversation...</p>
          </div>
        ) : !isConversationReady ? (
          <div style={{ height: "100%" }} />
        ) : conversationState.turns.length === 0 ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            color: "#999",
            flexDirection: "column"
          }}>
            <h3>Start a New Conversation</h3>
            <p>Ask a question to begin chatting</p>
          </div>
        ) : (
          <>
            {conversationState.turns.map((turn) => (
              <div key={turn.id}>
                {/* 用户输入 */}
                <Card
                  style={{
                    margin: "8px 0",
                    background: "#e6f7ff",
                    textAlign: "right",
                  }}
                >
                  {turn.userInput.content}
                </Card>

                {/* 状态卡片 - 显示在用户输入后，AI响应前 */}
                <StatusCard steps={turn.processSteps || []} />

                {/* AI响应 */}
                <Card
                  style={{
                    margin: "8px 0",
                    background: "#fff1f0",
                    textAlign: "left",
                  }}
                >
                  <MarkdownRenderer
                    turn={turn}
                    content={turn.aiResponse.content || ''}
                    showExpandButton={true}
                  />

                  {/* Export to Jira button - only show when AI response is completed and has content */}
                  {turn.aiResponse.status === 'completed' && turn.aiResponse.content && (
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                      <Button
                        type="link"
                        onClick={() => showTestCaseSidebar()}
                        style={{
                          padding: 0,
                          height: 'auto',
                          fontWeight: 500,
                          color: '#1890ff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Export to Jira
                        <ArrowRightOutlined />
                      </Button>
                    </div>
                  )}

                  {turn.aiResponse.status === 'error' && (
                    <div style={{color: '#ff4d4f', fontSize: '12px', marginTop: '4px'}}>
                      Error occurred while generating response
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{display: "flex", marginTop: 10, gap: 8}}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={() => setIsRepositoryVisible(true)}
          style={{ minWidth: 'auto', padding: '4px 8px' }}
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={handleSendMessage}
          placeholder="Type your message here..."
          disabled={!!conversationState.currentTurnId}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          onClick={handleSendMessage}
          disabled={!input || !!conversationState.currentTurnId}
        >
          Send
        </Button>
      </div>

      <MyRepository
        visible={isRepositoryVisible}
        onClose={() => setIsRepositoryVisible(false)}
      />
    </>
  );
}
