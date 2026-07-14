import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCopyTestSession } from '../useCopyTestSession';

const image = { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' };
const storageHtml = [
  '<table>',
  '<tr><th>Reference</th><th>Target</th></tr>',
  '<tr><td>Hello</td><td rowspan="2">你好</td></tr>',
  '<tr><td>World</td></tr>',
  '<tr><td>Submit</td><td>提交</td></tr>',
  '</table>',
].join('');

const importedImage = { base64: 'data:image/png;base64,SU1QT1JURUQ=', fileName: 'imported.png' };
const unrelatedBusinessImage = { base64: 'data:image/png;base64,QlVTSU5FU1M=', fileName: 'business.png' };
const importedStorageHtml = [
  '<table><tr>',
  '<th>Target</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Evidence - Target</th>',
  '</tr><tr>',
  '<td>Copy</td>',
  '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">',
  '<ac:image data-copy-test-evidence-image-id="imported.png" data-copy-test-evidence-image-instance-id="imported.png:1:0">',
  '<ri:attachment ri:filename="imported.png" /></ac:image></td>',
  '<td><ac:image><ri:attachment ri:filename="business.png" /></ac:image></td>',
  '</tr></table>',
].join('');

describe('useCopyTestSession', () => {
  it('manages storage, selection, validation snapshots, export commit, and deletion', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      expect(result.current.applyLoadedStorage(storageHtml)).toBe(1);
    });
    expect(result.current.selectedTableIndex).toBe(0);
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    expect(result.current.selectedRowIndexes).toEqual([0, 2]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { expected: '你好', rowIndex: 0 },
      { expected: '提交', rowIndex: 2 },
    ]);
    act(() => {
      result.current.setSelectedRowIndexes([0]);
      result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-a.png'],
        evidenceImages: [image],
        hideEvidenceCell: false,
        passed: true,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
      result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-a.png'],
        evidenceImages: [image],
        hideEvidenceCell: false,
        passed: true,
        rowIndex: 0,
      }], [image], 1, 'Target', 99);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
    expect(result.current.getCurrentValidationImages()).toEqual([image]);
    expect(result.current.getCurrentPreviewImages()).toEqual([image]);
    act(() => {
      expect(result.current.deleteEvidenceImage({
        imageId: 'missing',
        instanceId: 'missing:1:0',
      })).toEqual({ imageStillUsed: false, removed: false });
      expect(result.current.deleteEvidenceImage({
        imageId: 'screen-a.png',
        instanceId: 'screen-a.png:1:0',
      })).toEqual({ imageStillUsed: false, removed: true });
      result.current.commitExportedStorage(result.current.originalStorageHtml);
      result.current.commitExportedStorage('<p>no tables</p>');
      result.current.resetValidationSnapshots();
      result.current.handleTableChange(0);
    });
    expect(result.current.selectedColumnIndex).toBeUndefined();
    act(() => {
      result.current.handleComparisonColumnChange(99);
      result.current.handleComparisonColumnChange(undefined);
    });
    expect(result.current.selectedColumnIndex).toBeUndefined();
  });

  it('keeps imported previews separate from validation and export images', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      expect(result.current.applyLoadedStorage(
        importedStorageHtml,
        [importedImage, unrelatedBusinessImage]
      )).toBe(1);
    });

    expect(result.current.getCurrentPreviewImages()).toEqual([importedImage]);
    expect(result.current.getCurrentValidationImages()).toEqual([]);

    act(() => {
      result.current.resetValidationSnapshots();
    });
    expect(result.current.getCurrentPreviewImages()).toEqual([importedImage]);
  });
});
