import { describe, expect, it, vi } from 'vitest';
import { mockCopyTestLlmValidationApi, mockCopyTestValidationApi } from '../validationMock';

const images = [
  { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' },
  { base64: 'data:image/png;base64,QUJD', fileName: 'screen-b.png' },
];

describe('validationMock', () => {
  it('returns mock validation results without real timers', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(callback => {
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as unknown as NodeJS.Timeout;
    });
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.8)
      .mockReturnValue(0.1);
    const result = await mockCopyTestLlmValidationApi(images, [
      { expected: 'copy 1', rowIndex: 0 },
      { expected: 'copy 2', rowIndex: 1 },
    ], 'Target');
    expect(result).toHaveLength(2);
    expect(result[0].evidenceImageFileNames?.length).toBeGreaterThan(0);
    expect(mockCopyTestValidationApi).toBe(mockCopyTestLlmValidationApi);
    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
