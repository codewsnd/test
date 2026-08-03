import { describe, expect, it } from 'vitest';
import * as constants from '../tableConstants';

describe('tableConstants', () => {
  it('exports CopyTest table constants', () => {
    expect(constants.COPY_TEST_GENERATED_RESULT_TYPE).toBe('result');
    expect(constants.COPY_TEST_GENERATED_EVIDENCE_TYPE).toBe('evidence');
    expect(constants.COPY_TEST_SCHEMA_VERSION).toBe('2');
    expect(constants.COPY_TEST_OWNER_ID_ATTRIBUTE).toBe('data-copy-test-owner-id');
    expect(constants.COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE).toBe(
      'data-copy-test-result-retained-language-issues'
    );
    expect(constants.COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE).toBe(
      'data-copy-test-result-status-group'
    );
    expect(constants.COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE).toBe(
      'data-copy-test-result-screen-order'
    );
    expect(constants.COPY_TEST_EVIDENCE_IMAGE_WIDTH).toBe(100);
    expect(constants.COPY_TEST_EVIDENCE_IMAGE_HEIGHT).toBe(200);
  });
});
