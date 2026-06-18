import { describe, expect, it } from 'vitest';
import { isValidConfluenceUrl } from '../urlUtils';

describe('urlUtils', () => {
  it('accepts http urls and rejects unsupported or malformed values', () => {
    expect(isValidConfluenceUrl('http://example.com')).toBe(true);
    expect(isValidConfluenceUrl('https://example.com')).toBe(true);
    expect(isValidConfluenceUrl('ftp://example.com')).toBe(false);
    expect(isValidConfluenceUrl('bad')).toBe(false);
  });
});
