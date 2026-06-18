import { describe, expect, it } from 'vitest';
import { getCopyTestTableOptionLabel } from '../tableOptionUtils';

describe('tableOptionUtils', () => {
  it('formats table option labels as one-based indexes', () => {
    expect(getCopyTestTableOptionLabel({ index: 2 })).toBe('Table3');
  });
});
