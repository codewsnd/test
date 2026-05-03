import { coreApi } from '@/api/axios'
import { GET_TOOL_LIST } from '@/api/tool/api'

export interface GetAllToolsApiParameter {
  param_name: string
  param_description: string
  required: boolean
}

export interface GetAllToolsApiItem {
  tool_name: string
  tool_display_name: string
  mcp_server_name: string
  tool_full_name: string
  tool_category: string
  tool_description: string
  tag: string[]
  parameters: GetAllToolsApiParameter[]
  provider?: string
  icon?: string
  is_hidden_in_tool?: boolean
}

export const getAllToolsApi = async (): Promise<GetAllToolsApiItem[]> => {
  return coreApi.get(GET_TOOL_LIST, {
    params: {
      usecache: false,
    },
  })
}

export const getAllToolsApi2 = async (): Promise<GetAllToolsApiItem[]> => {
  return getAllToolsApi()
}
