import { describe, expect, it } from 'vitest';
import {
  createCopyTestExportScope,
  isValidCopyTestExportScope,
} from '../copyTestExportScope';

describe('copyTestExportScope', () => {
  it('creates unique attribute-safe tokens and rejects unsafe values', () => {
    const first = createCopyTestExportScope();
    const second = createCopyTestExportScope();

    expect(first).not.toBe(second);
    expect(isValidCopyTestExportScope(first)).toBe(true);
    expect(isValidCopyTestExportScope(second)).toBe(true);
    expect(isValidCopyTestExportScope('true')).toBe(false);
    expect(isValidCopyTestExportScope('copytest-123')).toBe(false);
    expect(isValidCopyTestExportScope('copytest-0000000000000000000000000000000"')).toBe(false);
  });
});
