import { describe, expect, it } from 'vitest';
import type { CopyTestProps } from '../types';

describe('copyTest types', () => {
  it('keeps type-only module reachable for test organization', () => {
    const props: CopyTestProps = { open: true };
    expect(props.open).toBe(true);
  });
});
