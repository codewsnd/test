export interface ConversationTurn {
  id: string; // 对话会话的唯一Id
  turnIndex: number; // 在对话中的位置索引（从0开始）
  timestamp: Date; // 对话开始时间
  conversationHistoryId?: string; // 所属会话Id

  // 输入内容
  userInput: {
    content: string;
  }

  // 回复内容
  aiResponse: {
    content: string;
    status: AiResponseStatus;
    errorMessage?: string;
    timestamp: Date; // AI回复完成时间
  }

  processSteps?: ProcessStep[];
}

export interface ConversationState {
  turns: ConversationTurn[]; // 对话会话的轮次列表
  currentTurnId? : string; // 当前正在处理的回合Id
}

export type StepStatus = 'waiting' | 'processing' | 'completed' | 'error';
export type AiResponseStatus = 'pending' | 'streaming' | 'completed' | 'error';
export type SseStatusStage =
  | 'accepted'
  | 'session-ready'
  | 'generating'
  | 'responding'
  | 'tool-running'
  | 'tool-completed'
  | 'finalizing'
  | 'completed'
  | 'failed';

export interface ProcessStepDetail {
  label: string;
  value: string;
}

export interface ProcessStep {
  id: string;
  content: string;
  tooltip: string;
  status: StepStatus;
  timestamp: Date;
  details?: ProcessStepDetail[];
}

export interface SessionEventPayload {
  sessionId?: string;
  requestId?: string;
  conversationId?: string;
  modelName?: string;
  startedAt?: string;
  resumed?: boolean;
}

export interface StatusEventPayload {
  stage?: SseStatusStage;
  state?: StepStatus;
  label?: string;
  detail?: string;
  sessionId?: string;
  timestamp?: string;
}
