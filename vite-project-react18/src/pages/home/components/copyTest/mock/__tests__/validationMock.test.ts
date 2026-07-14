import { describe, expect, it, vi } from 'vitest';
import { mockCopyTestValidationApi } from '../validationMock';

const images = [
  { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' },
  { base64: 'data:image/png;base64,REVG', fileName: 'screen-b.png' },
];

describe('validationMock strict contract', () => {
  it('returns a deterministic explicit group when random values are controlled', () => {
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0);

    const result = mockCopyTestValidationApi(images, [
      { expected: 'copy 1', rowIndex: 0 },
      { expected: 'copy 2', rowIndex: 1 },
    ]);

    expect(result).toEqual([
      {
        evidenceImageFileNames: ['screen-a.png'],
        evidenceRowSpan: 2,
        hideEvidenceCell: false,
        passed: true,
        rowIndex: 0,
      },
      {
        evidenceImageFileNames: ['screen-a.png'],
        hideEvidenceCell: true,
        languageIssues: ['OCR text does not match the selected comparison copy.'],
        passed: false,
        rowIndex: 1,
      },
    ]);
    expect(Object.prototype.hasOwnProperty.call(result[1], 'evidenceRowSpan')).toBe(false);
    randomSpy.mockRestore();
  });

  it('omits image fields when no screenshots are uploaded', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const result = mockCopyTestValidationApi([], [{ expected: 'copy', rowIndex: 4 }]);

    expect(result[0]).toMatchObject({
      evidenceRowSpan: 1,
      hideEvidenceCell: false,
      passed: false,
      rowIndex: 4,
    });
    expect(result[0].languageIssues).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(result[0], 'evidenceImageFileNames')).toBe(false);
    randomSpy.mockRestore();
  });

  it('never merges rows whose rowIndex values are not consecutive', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = mockCopyTestValidationApi(images, [
      { expected: 'copy 1', rowIndex: 0 },
      { expected: 'copy 2', rowIndex: 3 },
    ]);

    expect(result.map(item => item.evidenceRowSpan)).toEqual([1, 1]);
    expect(result.every(item => item.hideEvidenceCell === false)).toBe(true);
    randomSpy.mockRestore();
  });
});
