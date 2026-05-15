import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import axios from '../axios'
import { message } from 'antd'
import {
  API_RETRY_DELAY_MS,
  ApiRetryUtil,
  requestWithRetry,
} from '../retryUtils'

vi.mock('../axios', () => ({
  default: {
    request: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
    options: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}))

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
  },
}))

const retryableStatuses = [408, 429, 500]

const makeAxiosError = (status?: number) => (
  status === undefined ? {} : { response: { status } }
)

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('requestWithRetry', () => {
  it('returns immediately when the request succeeds', async () => {
    const response = { ok: true }
    const request = vi.fn().mockResolvedValueOnce(response)

    await expect(requestWithRetry(request)).resolves.toBe(response)

    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each(retryableStatuses)('retries status %s errors before resolving', async (status) => {
    vi.useFakeTimers()
    const response = { ok: true }
    const request = vi
      .fn()
      .mockRejectedValueOnce(makeAxiosError(status))
      .mockResolvedValueOnce(response)

    const result = requestWithRetry(request)

    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS)

    await expect(result).resolves.toBe(response)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('retries network errors without a response status', async () => {
    vi.useFakeTimers()
    const response = { ok: true }
    const request = vi
      .fn()
      .mockRejectedValueOnce(makeAxiosError())
      .mockResolvedValueOnce(response)

    const result = requestWithRetry(request)

    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS)

    await expect(result).resolves.toBe(response)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable business errors', async () => {
    const error = makeAxiosError(400)
    const request = vi.fn().mockRejectedValueOnce(error)

    await expect(requestWithRetry(request)).rejects.toBe(error)

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('throws the last retryable error after the default attempts are exhausted', async () => {
    vi.useFakeTimers()
    const firstError = makeAxiosError(500)
    const secondError = makeAxiosError(500)
    const finalError = makeAxiosError(500)
    const request = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError)
      .mockRejectedValueOnce(finalError)

    const result = requestWithRetry(request)
    const assertion = expect(result).rejects.toBe(finalError)

    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS)
    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS)

    await assertion
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('uses a fixed delay between retry attempts', async () => {
    vi.useFakeTimers()
    const response = { ok: true }
    const request = vi
      .fn()
      .mockRejectedValueOnce(makeAxiosError(500))
      .mockRejectedValueOnce(makeAxiosError(500))
      .mockResolvedValueOnce(response)

    const result = requestWithRetry(request)

    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS - 1)
    expect(request).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(API_RETRY_DELAY_MS - 1)
    expect(request).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)

    await expect(result).resolves.toBe(response)
    expect(request).toHaveBeenCalledTimes(3)
  })
})

describe('ApiRetryUtil.request', () => {
  it('returns the request result through the retry wrapper', async () => {
    const response = { id: 1 }

    await expect(ApiRetryUtil.request(() => Promise.resolve(response))).resolves.toBe(response)
  })

  it('delegates axios-style request configs and keeps error messages as an extra argument', async () => {
    vi.mocked(axios.request).mockResolvedValueOnce('request response' as never)

    await expect(
      ApiRetryUtil.request<string>(
        {
          url: '/items',
          method: 'get',
        },
        'request failed'
      )
    ).resolves.toBe('request response')

    expect(axios.request).toHaveBeenCalledWith({
      url: '/items',
      method: 'get',
      skipError: true,
    })
  })

  it('shows the provided error message and rethrows the original error', async () => {
    const error = makeAxiosError(400)

    await expect(
      ApiRetryUtil.request(() => Promise.reject(error), 'request failed')
    ).rejects.toBe(error)

    expect(message.error).toHaveBeenCalledWith('request failed')
    expect(console.error).toHaveBeenCalledWith('request failed', error)
  })

  it('rethrows without a toast when no error message is provided', async () => {
    const error = makeAxiosError(400)

    await expect(ApiRetryUtil.request(() => Promise.reject(error))).rejects.toBe(error)

    expect(message.error).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('ApiRetryUtil HTTP helpers', () => {
  it('delegates get and delete with axios-style config and extra error messages', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce('get response' as never)
    vi.mocked(axios.delete).mockResolvedValueOnce('delete response' as never)

    await expect(ApiRetryUtil.get('/items', undefined, 'get failed')).resolves.toBe('get response')
    await expect(ApiRetryUtil.delete('/items/1', undefined, 'delete failed')).resolves.toBe('delete response')

    expect(axios.get).toHaveBeenCalledWith('/items', { skipError: true })
    expect(axios.delete).toHaveBeenCalledWith('/items/1', { skipError: true })
  })

  it('shows optional extra error messages after helper requests fail', async () => {
    const error = makeAxiosError(400)
    vi.mocked(axios.get).mockRejectedValueOnce(error as never)

    await expect(ApiRetryUtil.get('/items', undefined, 'get failed')).rejects.toBe(error)

    expect(message.error).toHaveBeenCalledWith('get failed')
    expect(console.error).toHaveBeenCalledWith('get failed', error)
  })

  it('delegates head and options with supplied config and preserves skipError false', async () => {
    const config: AxiosRequestConfig = {
      params: { q: 'term' },
      skipError: false,
    }
    vi.mocked(axios.head).mockResolvedValueOnce('head response' as never)
    vi.mocked(axios.options).mockResolvedValueOnce('options response' as never)

    await expect(ApiRetryUtil.head('/meta', config, 'head failed')).resolves.toBe('head response')
    await expect(ApiRetryUtil.options('/meta', config, 'options failed')).resolves.toBe('options response')

    expect(axios.head).toHaveBeenCalledWith('/meta', {
      params: { q: 'term' },
      skipError: false,
    })
    expect(axios.options).toHaveBeenCalledWith('/meta', {
      params: { q: 'term' },
      skipError: false,
    })
  })

  it('delegates post, put, and patch with data and config defaults', async () => {
    const data = { name: 'Ada' }
    const config: AxiosRequestConfig = {
      headers: { token: 't' },
    }
    vi.mocked(axios.post).mockResolvedValueOnce('post response' as never)
    vi.mocked(axios.put).mockResolvedValueOnce('put response' as never)
    vi.mocked(axios.patch).mockResolvedValueOnce('patch response' as never)

    await expect(ApiRetryUtil.post('/items', data, config, 'post failed')).resolves.toBe('post response')
    await expect(ApiRetryUtil.put('/items/1', data, config, 'put failed')).resolves.toBe('put response')
    await expect(ApiRetryUtil.patch('/items/1', data, config, 'patch failed')).resolves.toBe('patch response')

    expect(axios.post).toHaveBeenCalledWith('/items', data, {
      headers: { token: 't' },
      skipError: true,
    })
    expect(axios.put).toHaveBeenCalledWith('/items/1', data, {
      headers: { token: 't' },
      skipError: true,
    })
    expect(axios.patch).toHaveBeenCalledWith('/items/1', data, {
      headers: { token: 't' },
      skipError: true,
    })
  })

  it('delegates post, put, and patch when error messages are omitted', async () => {
    const data = { name: 'Grace' }
    vi.mocked(axios.post).mockResolvedValueOnce('post response' as never)
    vi.mocked(axios.put).mockResolvedValueOnce('put response' as never)
    vi.mocked(axios.patch).mockResolvedValueOnce('patch response' as never)

    await expect(ApiRetryUtil.post('/items', data)).resolves.toBe('post response')
    await expect(ApiRetryUtil.put('/items/1', data)).resolves.toBe('put response')
    await expect(ApiRetryUtil.patch('/items/1', data)).resolves.toBe('patch response')

    expect(axios.post).toHaveBeenCalledWith('/items', data, { skipError: true })
    expect(axios.put).toHaveBeenCalledWith('/items/1', data, { skipError: true })
    expect(axios.patch).toHaveBeenCalledWith('/items/1', data, { skipError: true })
  })
})
