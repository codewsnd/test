import { springboot3BackendApi } from '@/api/axios'

export interface CreateAgentApiRequest {
  name: string
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
  tools?: string
  tags?: string
  templateSchemas?: string
}

export interface AgentApiItem extends CreateAgentApiRequest {
  id: number
  createTime?: string
  updateTime?: string
  isDeleted?: boolean
}

export interface GetAgentsApiRequest {
  name?: string
  type?: string
}

export const getAgentsApi = async (
  params?: GetAgentsApiRequest,
): Promise<AgentApiItem[]> => {
  return springboot3BackendApi.get('/agents', { params })
}

export const createAgentApi = async (
  request: CreateAgentApiRequest,
): Promise<AgentApiItem> => {
  return springboot3BackendApi.post('/agents', request)
}

export const getAgentApi = async (id: number | string): Promise<AgentApiItem> => {
  return springboot3BackendApi.get(`/agents/${id}`)
}

export const updateAgentApi = async (
  id: number | string,
  request: CreateAgentApiRequest,
): Promise<AgentApiItem> => {
  return springboot3BackendApi.put(`/agents/${id}`, request)
}
