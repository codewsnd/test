import { describe, expect, it } from 'vitest'
import { capitalizeFirstLetter } from '../stringUtils'

describe('capitalizeFirstLetter', () => {
  it('capitalizes the first character and safely handles empty values', () => {
    expect(capitalizeFirstLetter('tool')).toBe('Tool')
    expect(capitalizeFirstLetter('Tool')).toBe('Tool')
    expect(capitalizeFirstLetter('')).toBe('')
    expect(capitalizeFirstLetter()).toBe('')
  })
})
