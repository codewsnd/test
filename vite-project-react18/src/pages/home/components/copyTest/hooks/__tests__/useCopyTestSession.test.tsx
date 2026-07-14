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

/** Target 列中间两个数据行合并的四行会话回归表格。 */
const middleMergedStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>copy 1</td></tr>',
  '<tr><td>2</td><td rowspan="2">copy 2 and 3</td></tr>',
  '<tr><td>3</td></tr>',
  '<tr><td>4</td><td>copy 4</td></tr>',
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
  '<ac:image data-copy-test-evidence-image-id="imported.png" data-copy-test-evidence-image-instance-id="0:Target:1:imported.png">',
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
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
      result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-a.png'],
        evidenceImages: [image],
        languageIssues: [],
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
        instanceId: '1:Target:1:missing',
      })).toEqual({ imageStillUsed: false, removed: false });
      expect(result.current.deleteEvidenceImage({
        imageId: 'screen-a.png',
        instanceId: '1:Target:1:screen-a.png',
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

  it('keeps a middle rowspan source group atomic when session selection receives covered rows', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(middleMergedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    expect(result.current.selectedRowIndexes).toEqual([0, 1, 3]);
    act(() => {
      result.current.setSelectedRowIndexes([3, 2, 1, 2]);
    });

    expect(result.current.selectedRowIndexes).toEqual([1, 3]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { expected: 'copy 2 and 3', rowIndex: 1 },
      { expected: 'copy 4', rowIndex: 3 },
    ]);
  });
});
