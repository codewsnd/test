import type { AgentFormData } from '@/pages/agent-create/components/agentFormTypes'

export interface AgentModelPreset {
  modelName: string
  label: string
  family: 'general' | 'reasoning' | 'multimodal'
  summary: string
  contextWindow: string
  defaultOutputCap: string
  notes: string[]
  defaults: Pick<
    AgentFormData,
    | 'type'
    | 'temperature'
    | 'maxTokens'
    | 'topP'
    | 'frequencyPenalty'
    | 'presencePenalty'
    | 'outputType'
  >
}

export const DEFAULT_AGENT_MODEL = 'gpt-5-mini'

export const AGENT_MODEL_PRESETS: AgentModelPreset[] = [
  {
    modelName: 'gpt-5',
    label: 'GPT-5',
    family: 'reasoning',
    summary: '高智能主力模型，适合复杂规划、长链路决策和高质量输出。',
    contextWindow: 'high-context reasoning',
    defaultOutputCap: 'high output budget',
    notes: ['适合复杂 agent 与长链路任务。', '优先通过 Prompt 和工具策略控输出，而不是过度调采样。'],
    defaults: {
      type: 'reasoning',
      temperature: 1,
      maxTokens: 8192,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'gpt-5-mini',
    label: 'GPT-5 mini',
    family: 'reasoning',
    summary: '当前更均衡的默认起点，兼顾推理能力、响应速度和成本。',
    contextWindow: 'high-context reasoning',
    defaultOutputCap: 'mid-high output budget',
    notes: ['推荐作为新建 agent 的默认模型。', '适合大多数需要思考和工具编排的场景。'],
    defaults: {
      type: 'reasoning',
      temperature: 1,
      maxTokens: 6144,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'gpt-5-nano',
    label: 'GPT-5 nano',
    family: 'reasoning',
    summary: '更轻量的智能模型，适合路由、提取和轻决策类任务。',
    contextWindow: 'efficient reasoning',
    defaultOutputCap: 'compact output budget',
    notes: ['更适合轻量代理。', '如果需要长答案或复杂分析，建议升级到 mini 或更高档位。'],
    defaults: {
      type: 'reasoning',
      temperature: 1,
      maxTokens: 3072,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'text',
    },
  },
  {
    modelName: 'gpt-4.1',
    label: 'GPT-4.1',
    family: 'general',
    summary: '高质量通用模型，适合复杂指令、长上下文与稳定工具调用。',
    contextWindow: '1M context',
    defaultOutputCap: '32,768 max output tokens',
    notes: ['适合作为高质量主力模型。', '默认保持低随机性，方便稳定复现。'],
    defaults: {
      type: 'assistant',
      temperature: 0.3,
      maxTokens: 8192,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    family: 'general',
    summary: '均衡的默认选择，速度、成本和工具能力都比较稳。',
    contextWindow: '1M context',
    defaultOutputCap: '32,768 max output tokens',
    notes: ['适合作为大多数 agent 的默认起点。', '首版上线推荐先从这组参数开始。'],
    defaults: {
      type: 'assistant',
      temperature: 0.4,
      maxTokens: 6144,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'gpt-4.1-nano',
    label: 'GPT-4.1 nano',
    family: 'general',
    summary: '轻量低成本，更适合分类、提取和简单路由类 agent。',
    contextWindow: '1M context',
    defaultOutputCap: 'small output footprint',
    notes: ['建议控制输出长度。', '更适合简单任务，不建议承载过重推理。'],
    defaults: {
      type: 'assistant',
      temperature: 0.2,
      maxTokens: 2048,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'text',
    },
  },
  {
    modelName: 'gpt-4o',
    label: 'GPT-4o',
    family: 'multimodal',
    summary: '通用多模态模型，适合需要兼顾灵活性与交互体验的场景。',
    contextWindow: 'large context',
    defaultOutputCap: 'mid-size output',
    notes: ['更适合富交互和多模态扩展。', '如果以文本任务为主，可优先考虑 4.1 系列。'],
    defaults: {
      type: 'multimodal',
      temperature: 0.5,
      maxTokens: 4096,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    family: 'multimodal',
    summary: '更轻量的多模态选项，适合快速响应和成本敏感任务。',
    contextWindow: 'large context',
    defaultOutputCap: 'mid-size output',
    notes: ['适合作为高并发场景的轻量备选。', '建议保守控制输出长度。'],
    defaults: {
      type: 'multimodal',
      temperature: 0.4,
      maxTokens: 3072,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'o3',
    label: 'o3',
    family: 'reasoning',
    summary: '重推理场景优先，适合复杂分析、规划和多步决策。',
    contextWindow: 'reasoning-optimized',
    defaultOutputCap: '100,000 max output tokens',
    notes: ['推理模型更适合保持默认采样。', '若主要是稳定产出，尽量少调温度。'],
    defaults: {
      type: 'reasoning',
      temperature: 1,
      maxTokens: 8192,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
  {
    modelName: 'o4-mini',
    label: 'o4-mini',
    family: 'reasoning',
    summary: '更快更省的推理型选择，适合多数需要分析能力的 agent。',
    contextWindow: 'reasoning-optimized',
    defaultOutputCap: '100,000 max output tokens',
    notes: ['适合把复杂度控制在中等范围的推理任务。', '常用于分析、路由和带工具决策。'],
    defaults: {
      type: 'reasoning',
      temperature: 1,
      maxTokens: 6144,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      outputType: 'markdown',
    },
  },
]

export const AGENT_MODEL_PRESET_MAP = Object.fromEntries(
  AGENT_MODEL_PRESETS.map((preset) => [preset.modelName, preset]),
) as Record<string, AgentModelPreset>
