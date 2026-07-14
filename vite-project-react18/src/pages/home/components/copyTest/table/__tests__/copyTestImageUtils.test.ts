import { describe, expect, it } from 'vitest';
import { getCopyTestImageId } from '../copyTestImageUtils';

describe('copyTestImageUtils', () => {
  it('始终使用 fileName 作为唯一图片 ID', () => {
    expect(getCopyTestImageId({ base64: 'x', fileName: 'a.png' })).toBe('a.png');
  });
});
