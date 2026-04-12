import { describe, expect, it, vi } from 'vitest'

vi.mock('@/assets/toolProviderConfluence.svg', () => ({ default: 'confluence.svg' }))
vi.mock('@/assets/toolProviderDefault.svg', () => ({ default: 'default.svg' }))
vi.mock('@/assets/toolProviderInternal.svg', () => ({ default: 'internal.svg' }))
vi.mock('@/assets/toolProviderJira.svg', () => ({ default: 'jira.svg' }))
vi.mock('@/assets/toolProviderPython.svg', () => ({ default: 'python.svg' }))
vi.mock('@/assets/toolProviderWeb.svg', () => ({ default: 'web.svg' }))

import {
  DEFAULT_TOOL_ICON,
  TOOL_ICON_CONFIG,
  getToolIcon,
  normalizeToolIcon,
} from '../IconConfig'

describe('IconConfig', () => {
  it('returns mapped icons with default fallback', () => {
    expect(TOOL_ICON_CONFIG.jira).toBe('jira.svg')
    expect(DEFAULT_TOOL_ICON).toBe('default.svg')
    expect(normalizeToolIcon(' JIRA ')).toBe('jira')
    expect(normalizeToolIcon()).toBeUndefined()
    expect(getToolIcon('Python')).toBe('python.svg')
    expect(getToolIcon('missing')).toBe('default.svg')
    expect(getToolIcon('')).toBe('default.svg')
    expect(getToolIcon()).toBe('default.svg')
  })
})
