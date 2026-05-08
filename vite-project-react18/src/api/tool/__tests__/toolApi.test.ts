import { afterEach, describe, expect, it, vi } from 'vitest'
import axios from '@/api/axios'
import { GET_TOOL_LIST } from '@/api/tool/api'
import { getAllToolsApi, getAllToolsApi2 } from '../toolApi'

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('toolApi', () => {
  const coreBaseUrl = import.meta.env.VITE_API_CORE_URL || 'http://localhost:8000'

  it('fetches tool list from core service', async () => {
    const response = [{ tool_full_name: 'server/tool' }]

    vi.mocked(axios.get).mockResolvedValueOnce({ data: response } as never)

    const result = await getAllToolsApi()

    expect(axios.get).toHaveBeenCalledWith(`${coreBaseUrl}${GET_TOOL_LIST}`, {
      params: {
        usecache: false,
      },
    })
    expect(result).toBe(response)
  })

  it('delegates getAllToolsApi2 to getAllToolsApi', async () => {
    const response = [{ tool_full_name: 'server/tool' }]

    vi.mocked(axios.get).mockResolvedValueOnce({ data: response } as never)

    const result = await getAllToolsApi2()

    expect(axios.get).toHaveBeenCalledTimes(1)
    expect(result).toBe(response)
  })
})
