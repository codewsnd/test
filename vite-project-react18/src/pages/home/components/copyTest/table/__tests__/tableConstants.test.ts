import { describe, expect, it } from 'vitest';
import * as constants from '../tableConstants';

describe('tableConstants', () => {
  it('exports CopyTest table constants', () => {
    expect(constants.COPY_TEST_GENERATED_RESULT_TYPE).toBe('result');
    expect(constants.COPY_TEST_GENERATED_EVIDENCE_TYPE).toBe('evidence');
    expect(constants.COPY_TEST_EVIDENCE_IMAGE_WIDTH).toBe(100);
    expect(constants.COPY_TEST_EVIDENCE_IMAGE_HEIGHT).toBe(200);
  });
});
