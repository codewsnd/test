import axios from '@/api/axios'

const SPRINGBOOT3_BACKEND_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_BACKEND_URL || 'http://localhost:8081'

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
  const response = await axios.get<AgentApiItem[]>(`${SPRINGBOOT3_BACKEND_API_URL}/agents`, { params })
  return response.data
}

export const createAgentApi = async (
  request: CreateAgentApiRequest,
): Promise<AgentApiItem> => {
  const response = await axios.post<AgentApiItem>(`${SPRINGBOOT3_BACKEND_API_URL}/agents`, request)
  return response.data
}

export const getAgentApi = async (id: number | string): Promise<AgentApiItem> => {
  const response = await axios.get<AgentApiItem>(`${SPRINGBOOT3_BACKEND_API_URL}/agents/${id}`)
  return response.data
}

export const updateAgentApi = async (
  id: number | string,
  request: CreateAgentApiRequest,
): Promise<AgentApiItem> => {
  const response = await axios.put<AgentApiItem>(`${SPRINGBOOT3_BACKEND_API_URL}/agents/${id}`, request)
  return response.data
}
