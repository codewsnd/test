import { describe, expect, it } from 'vitest';
import * as constants from '../constants';

describe('copyTest constants', () => {
  it('exports upload limits and image name pattern', () => {
    expect(constants.MAX_UPLOAD_IMAGE_COUNT).toBe(50);
    expect(constants.MAX_UPLOAD_TOTAL_BYTES).toBe(10 * 1024 * 1024);
    expect(constants.MAX_UPLOAD_TOTAL_LABEL).toBe('10 MB');
    expect(constants.IMAGE_FILE_NAME_PATTERN.test('a.png')).toBe(true);
  });
});
