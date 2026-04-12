import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock, toolListValue } = vi.hoisted(() => ({
  getMock: vi.fn(),
  toolListValue: '/tool/list',
}))

vi.mock('@/api/axios', () => ({
  default: {
    get: getMock,
  },
}))

vi.mock('@/api/tool/api', () => ({
  GET_TOOL_LIST: toolListValue,
}))

import { getAllToolsApi, getAllToolsApi2 } from '../toolApi'

describe('toolApi', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns mock tools after the built-in delay', async () => {
    const toolsPromise = getAllToolsApi()

    await vi.advanceTimersByTimeAsync(2000)

    await expect(toolsPromise).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool_name: 'python_data_analysis',
          tool_display_name: 'Python data analysis',
          provider: 'Python',
          is_hidden_in_tool: false,
        }),
        expect.objectContaining({
          tool_name: 'generate_dummy_test_data',
          is_hidden_in_tool: true,
        }),
      ]),
    )
    await expect(toolsPromise).resolves.toHaveLength(9)
    expect(getMock).not.toHaveBeenCalled()
  })

  it('calls tool list api with cache flag in getAllToolsApi2', async () => {
    const response = { data: [{ id: 1 }] }
    getMock.mockResolvedValueOnce(response)

    await expect(getAllToolsApi2()).resolves.toBe(response)
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith('/tool/list?usecache=false')
  })
})
