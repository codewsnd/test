export interface AgentFormData {
  name?: string
  type?: string
  icon?: string
  modelName?: string
  systemPrompt?: string
  callCount?: number
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  outputType?: string
  createUser?: string
  tools: string[]
  skills?: string[]
  tags?: string[]
  templateSchemas?: string
}
