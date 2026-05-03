import { afterEach, describe, expect, it, vi } from 'vitest'
import { coreApi } from '@/api/axios'
import { GET_TOOL_LIST } from '@/api/tool/api'
import { getAllToolsApi, getAllToolsApi2 } from '../toolApi'

vi.mock('@/api/axios', () => ({
  coreApi: {
    get: vi.fn(),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('toolApi', () => {
  it('fetches tool list from core service', async () => {
    const response = [{ tool_full_name: 'server/tool' }]

    vi.mocked(coreApi.get).mockResolvedValueOnce(response as never)

    const result = await getAllToolsApi()

    expect(coreApi.get).toHaveBeenCalledWith(GET_TOOL_LIST, {
      params: {
        usecache: false,
      },
    })
    expect(result).toBe(response)
  })

  it('delegates getAllToolsApi2 to getAllToolsApi', async () => {
    const response = [{ tool_full_name: 'server/tool' }]

    vi.mocked(coreApi.get).mockResolvedValueOnce(response as never)

    const result = await getAllToolsApi2()

    expect(coreApi.get).toHaveBeenCalledTimes(1)
    expect(result).toBe(response)
  })
})
