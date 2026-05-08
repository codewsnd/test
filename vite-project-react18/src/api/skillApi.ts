import axios from '@/api/axios'

const CORE_API_URL = import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000'

export interface SkillApiItem {
  id: string
  name: string
  description: string
  content: string
  triggerKeywords: string[]
  toolNames: string[]
  tags: string[]
  source?: string
  version?: string
  author?: string
  installCount?: number
  trustLevel?: string
  homepageUrl?: string | null
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
