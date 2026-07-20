import { describe, expect, it } from 'vitest';
import { getCopyTestTableOptionLabel } from '../tableOptionUtils';

describe('tableOptionUtils', () => {
  it('formats filtered table positions as one-based labels', () => {
    expect(getCopyTestTableOptionLabel(0)).toBe('Table1');
    expect(getCopyTestTableOptionLabel(4)).toBe('Table5');
  });
});
