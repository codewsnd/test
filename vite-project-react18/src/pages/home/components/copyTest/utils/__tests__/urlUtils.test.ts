import { describe, expect, it } from 'vitest';
import {
  getConfluenceTableError,
  getConfluenceUrlError,
  INVALID_CONFLUENCE_URL_ERROR,
  isValidConfluenceUrl,
  NO_VALID_TABLE_ERROR,
} from '../urlUtils';

describe('urlUtils', () => {
  it('accepts http urls and rejects unsupported or malformed values', () => {
    expect(isValidConfluenceUrl('http://example.com')).toBe(true);
    expect(isValidConfluenceUrl('https://example.com')).toBe(true);
    expect(isValidConfluenceUrl('ftp://example.com')).toBe(false);
    expect(isValidConfluenceUrl('bad')).toBe(false);
    expect(getConfluenceUrlError(' https://example.com ')).toBeUndefined();
    expect(getConfluenceUrlError('bad')).toBe(INVALID_CONFLUENCE_URL_ERROR);
    expect(getConfluenceTableError(1)).toBeUndefined();
    expect(getConfluenceTableError(0)).toBe(NO_VALID_TABLE_ERROR);
    expect(NO_VALID_TABLE_ERROR).toBe('No valid table found');
  });
});
