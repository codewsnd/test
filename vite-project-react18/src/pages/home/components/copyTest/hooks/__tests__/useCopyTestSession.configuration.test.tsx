import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCopyTestSession } from '../useCopyTestSession';
import { hydrateCopyTestValidationSnapshot } from '../../table/copyTestTableState';
import type { CopyTestDisplayConfiguration } from '../../types';
import { selectCopyTestMatchedResults } from '../../utils/copyTestValidationMerge';

const storage = '<table><tr><th>Target</th></tr><tr><td>First</td></tr><tr><td>Second</td></tr></table>';
const imageA = { fileName: 'a.png', base64: 'data:image/png;base64,QQ==' };
const imageB = { fileName: 'b.png', base64: 'data:image/png;base64,Qg==' };
const imageC = { fileName: 'c.png', base64: 'data:image/png;base64,Qw==' };

const matched = (rowIndex: number, images: typeof imageA[], passed = true) => ({
  rowIndex, passed, evidenceImages: images, evidenceImageFileNames: images.map(image => image.fileName),
  languageIssues: passed ? [] : ['Different copy.'],
});

const setupSession = () => {
  const hook = renderHook(() => useCopyTestSession());
  act(() => { hook.result.current.applyLoadedStorage(storage); });
  act(() => { hook.result.current.handleComparisonColumnChange(0); });
  act(() => {
    hook.result.current.applyValidationResults([matched(0, [imageA]), matched(1, [imageA])], [imageA], 0, 'Target', 0);
  });
  return hook;
};

describe('display configuration applied to the working table', () => {
  it.each([
    { evidenceUpdateMode: 'add', evidenceMode: 'single', images: [imageB, imageC], expected: ['a.png', 'b.png'] },
    { evidenceUpdateMode: 'add', evidenceMode: 'multiple', images: [imageB, imageC], expected: ['a.png', 'b.png', 'c.png'] },
    { evidenceUpdateMode: 'replace', evidenceMode: 'single', images: [imageB, imageC], expected: ['b.png'] },
    { evidenceUpdateMode: 'replace', evidenceMode: 'multiple', images: [imageB, imageC], expected: ['b.png', 'c.png'] },
  ] as const)('$evidenceUpdateMode + $evidenceMode updates matched rows only', ({ evidenceUpdateMode, evidenceMode, images, expected }) => {
    const { result } = setupSession();
    const configuration: CopyTestDisplayConfiguration = { evidenceUpdateMode, evidenceMode };
    const selected = selectCopyTestMatchedResults(
      [matched(0, [...images], false), matched(1, [], false)],
      [...images],
      [0, 1].map(rowIndex => ({ rowIndex, evidenceGroupId: rowIndex, expected: 'Copy' })),
      evidenceMode
    ).map(item => ({ ...item, evidenceImages: images.filter(image => item.evidenceImageFileNames.includes(image.fileName)) }));
    act(() => {
      result.current.applyValidationResults(selected, [...images], 0, 'Target', 0, configuration);
    });
    const table = result.current.selectedTable!;
    const snapshot = hydrateCopyTestValidationSnapshot(table, 0, 'Target');
    expect(snapshot?.results[0].evidenceImageFileNames).toEqual(expected);
    expect(snapshot?.results[1].evidenceImageFileNames).toEqual(['a.png']);
    expect(snapshot?.results[1].passed).toBe(true);
    expect(snapshot?.results[0].screenStatuses?.find(status => status.imageId === 'b.png')?.passed).toBe(false);
    expect(snapshot?.results[0].screenStatuses?.map(status => status.imageId)).toEqual(expected);
    expect(snapshot?.results[0].screenStatuses?.find(status => status.imageId === 'a.png')?.passed)
      .toBe(evidenceUpdateMode === 'add' ? true : undefined);
    expect(result.current.getCurrentValidationImages().map(image => image.fileName)).toEqual(expect.arrayContaining([...expected, 'a.png']));
  });

  it.each(['add', 'replace'] as const)('%s with no match keeps HTML, revision and snapshots untouched', evidenceUpdateMode => {
    const { result } = setupSession();
    const before = result.current.selectedTable?.workingHtml;
    const revision = result.current.revision;
    const images = result.current.getCurrentValidationImages();
    act(() => {
      result.current.applyValidationResults([matched(0, [], false)], [], 0, 'Target', 0, { evidenceUpdateMode, evidenceMode: 'single' });
    });
    expect(result.current.selectedTable?.workingHtml).toBe(before);
    expect(result.current.revision).toBe(revision);
    expect(result.current.getCurrentValidationImages()).toBe(images);
  });

  it('keeps unmatched row references isolated when an appended image is deleted', () => {
    const { result } = setupSession();
    act(() => {
      result.current.applyValidationResults([matched(0, [imageB, imageC], false)], [imageB, imageC], 0, 'Target', 0,
        { evidenceUpdateMode: 'add', evidenceMode: 'multiple' });
    });
    const doc = new DOMParser().parseFromString(result.current.selectedTable!.workingHtml, 'text/html');
    const image = doc.querySelector('[data-copy-test-evidence-image-id="c.png"]')!;
    act(() => {
      expect(result.current.deleteEvidenceImage({
        imageId: 'c.png', instanceId: image.getAttribute('data-copy-test-evidence-image-instance-id')!,
      }).removed).toBe(true);
    });
    const snapshot = hydrateCopyTestValidationSnapshot(result.current.selectedTable!, 0, 'Target');
    expect(snapshot?.results[0].evidenceImageFileNames).toEqual(['a.png', 'b.png']);
    expect(snapshot?.results[1].evidenceImageFileNames).toEqual(['a.png']);
  });
});
