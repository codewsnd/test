export interface ConversationTurn {
  id: string; // 对话会话的唯一Id
  turnIndex: number; // 在对话中的位置索引（从0开始）
  timestamp: Date; // 对话开始时间

  // 用户输入部分
  userInput: {
    content: string;
  }

  // AI回复部分
  aiResponse: {
    content: string;
    status: AiResponseStatus;
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

export interface ProcessStep {
  id: string;
  content: string;
  tooltip: string;
  status: StepStatus
  timestamp: Date;
}
