import { describe, expect, it } from 'vitest';
import { getCopyTestImageId } from '../copyTestImageUtils';

describe('copyTestImageUtils', () => {
  it('prefers md5 and falls back to file name', () => {
    expect(getCopyTestImageId({ base64: 'x', fileName: 'a.png', md5: 'md5-a' })).toBe('md5-a');
    expect(getCopyTestImageId({ base64: 'x', fileName: 'a.png' })).toBe('a.png');
  });
});
