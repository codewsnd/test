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

      // 构建符合后端 AiChatRequest 格式的请求体
      // const requestBody = {
      //   modelName: 'deepseek-chat',
      //   messages: historyMessages,
      //   documents: [{
      //     id: new Date().toISOString(),
      //     type: 'image',
      //     base64url: ['data:image/png;base64,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']
      //   }],  // 可以在这里添加文档和图片
      //   requestId: conversationHistoryIdRef.current
      // };

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
