import { describe, expect, it } from 'vitest';
import {
  getConfluenceTableError,
  getConfluenceUrlError,
  INVALID_CONFLUENCE_URL_ERROR,
  isValidConfluenceUrl,
  NO_VALID_TABLE_ERROR,
} from '../urlUtils';

describe('urlUtils', () => {
  it('accepts valid http and https Confluence urls', () => {
    expect(isValidConfluenceUrl('http://example.com')).toBe(true);
    expect(isValidConfluenceUrl('https://example.com')).toBe(true);
    expect(isValidConfluenceUrl('http://localhost:8080/pages/1')).toBe(true);
    expect(isValidConfluenceUrl('https://[2001:db8::1]:8443/pages/1')).toBe(true);
    expect(isValidConfluenceUrl(
      'http://192.168.66.200:11002/spaces/DEV/pages/163938/CopyTest+QA+Fixture'
    )).toBe(true);
    expect(getConfluenceUrlError(' https://example.com ')).toBeUndefined();
  });

  it('rejects unsupported, incomplete, or malformed urls', () => {
    expect(isValidConfluenceUrl('ftp://example.com')).toBe(false);
    expect(isValidConfluenceUrl('example.com')).toBe(false);
    expect(isValidConfluenceUrl('http:example.com')).toBe(false);
    expect(isValidConfluenceUrl('http://')).toBe(false);
    expect(isValidConfluenceUrl('https://example.com:')).toBe(false);
    expect(isValidConfluenceUrl('https://example.com:70000/pages/1')).toBe(false);
    expect(isValidConfluenceUrl('https://-invalid.example.com/pages/1')).toBe(false);
    expect(isValidConfluenceUrl('https://invalid_.example.com/pages/1')).toBe(false);
    expect(isValidConfluenceUrl('https://example..com/pages/1')).toBe(false);
    expect(isValidConfluenceUrl('https://example.com/path with spaces')).toBe(false);
    expect(isValidConfluenceUrl('https://example.com/<script>')).toBe(false);
    expect(isValidConfluenceUrl('https://example.com/%ZZ')).toBe(false);
    expect(isValidConfluenceUrl('bad')).toBe(false);
    expect(getConfluenceUrlError('bad')).toBe(INVALID_CONFLUENCE_URL_ERROR);
  });

  it('rejects multiple absolute urls concatenated into one input', () => {
    const confluenceUrl = 'http://192.168.66.200:11002/spaces/DEV/pages/163938/CopyTest+QA+20260714-174344+1+Table+-+Rowspan+Fixture';

    expect(isValidConfluenceUrl(`${confluenceUrl};${confluenceUrl}`)).toBe(false);
    expect(isValidConfluenceUrl(`${confluenceUrl};https://example.com/another-page`)).toBe(false);
    expect(getConfluenceUrlError(`${confluenceUrl};${confluenceUrl}`))
      .toBe(INVALID_CONFLUENCE_URL_ERROR);
  });

  it('returns a table error only when no valid table exists', () => {
    expect(getConfluenceTableError(1)).toBeUndefined();
    expect(getConfluenceTableError(0)).toBe(NO_VALID_TABLE_ERROR);
    expect(NO_VALID_TABLE_ERROR).toBe('No valid table found');
  });
});
