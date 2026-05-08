import axios from '@/api/axios'

const CORE_API_URL = import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000'

export interface SkillApiItem {
  id: string
  name: string
  description: string
  whenToUse?: string
  content: string
  commandName?: string
  triggerKeywords: string[]
  toolNames: string[]
  allowedTools?: string[]
  argumentHint?: string
  arguments?: string[]
  disableModelInvocation?: boolean
  userInvocable?: boolean
  model?: string | null
  effort?: string | null
  context?: string | null
  agent?: string | null
  paths?: string[]
  shell?: string | null
  tags: string[]
  source?: string
  sourcePath?: string | null
  resourceFiles?: string[]
  version?: string
  author?: string
  installCount?: number
  trustLevel?: string
  homepageUrl?: string | null
  claudeCodeCompatible?: boolean
  enabled: boolean
}

export const getAllSkillsApi = async (): Promise<SkillApiItem[]> => {
  const response = await axios.get<SkillApiItem[]>(`${CORE_API_URL}/api/v1/skills`, {
    params: {
      usecache: false,
    },
  })
  return response.data
}
