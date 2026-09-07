import { describe, expect, it } from 'vitest';
import { countCopyTestMatchedImages, mergeCopyTestMatchedResults, selectCopyTestMatchedResults } from '../copyTestValidationMerge';
import type { CopyTestValidationResultWithEvidence } from '../../types';

const imageA = { fileName: 'a.png', base64: 'data:image/png;base64,QQ==' };
const imageB = { fileName: 'b.png', base64: 'data:image/png;base64,Qg==' };
const historical: CopyTestValidationResultWithEvidence = {
  rowIndex: 0, passed: true, languageIssues: [], evidenceImageFileNames: ['a.png'], evidenceImages: [imageA],
  screenStatuses: [{ imageId: 'a.png', passed: true, aiPassed: false, languageIssues: ['Original issue.'] }],
};
const current: CopyTestValidationResultWithEvidence = {
  rowIndex: 0, passed: false, languageIssues: ['Different copy.'], evidenceImageFileNames: ['b.png'], evidenceImages: [imageB],
};

describe('matched validation results', () => {
  it('appends matched failures and preserves the previous manual status', () => {
    const [result] = mergeCopyTestMatchedResults([historical], [current], 'add');
    expect(result.evidenceImageFileNames).toEqual(['a.png', 'b.png']);
    expect(result.screenStatuses).toEqual([
      historical.screenStatuses?.[0],
      { imageId: 'b.png', aiPassed: false, passed: false, languageIssues: ['Different copy.'] },
    ]);
  });

  it('does not append the same content under a new filename', () => {
    const duplicate = { ...current, evidenceImages: [{ ...imageA, fileName: 'b.png' }] };
    expect(mergeCopyTestMatchedResults([historical], [duplicate], 'add')[0].evidenceImageFileNames).toEqual(['a.png']);
  });

  it.each(['add', 'replace'] as const)('%s leaves unmatched rows unchanged', mode => {
    const unmatched = { ...current, evidenceImages: [], evidenceImageFileNames: [] };
    expect(mergeCopyTestMatchedResults([historical], [unmatched], mode)).toEqual([historical]);
  });

  it('replaces only the matching row', () => {
    const untouched = { ...historical, rowIndex: 1 };
    expect(mergeCopyTestMatchedResults([historical, untouched], [current], 'replace')).toEqual([current, untouched]);
  });

  it('filters unknown rows and images, constrains this batch, and counts distinct matched images', () => {
    const results = [
      { ...current, evidenceImageFileNames: ['a.png', 'b.png', 'unknown.png'] },
      { ...current, rowIndex: 1, evidenceImageFileNames: ['a.png', 'b.png'] },
      { ...current, rowIndex: 99 },
    ];
    const rows = [0, 1].map(rowIndex => ({ rowIndex, evidenceGroupId: 0, expected: 'Copy' }));
    const single = selectCopyTestMatchedResults(results, [imageA, imageB], rows, 'single');
    const multiple = selectCopyTestMatchedResults(results, [imageA, imageB], rows, 'multiple');
    expect(single.map(result => result.evidenceImageFileNames)).toEqual([['a.png'], ['a.png']]);
    expect(countCopyTestMatchedImages(single)).toBe(1);
    expect(multiple.map(result => result.evidenceImageFileNames)).toEqual([['a.png', 'b.png'], ['a.png', 'b.png']]);
    expect(countCopyTestMatchedImages(multiple)).toBe(2);
  });
});
