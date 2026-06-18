import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCopyTestSession } from '../useCopyTestSession';

const image = { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' };
const storageHtml = [
  '<table>',
  '<tr><th>Reference|values=hk_en|</th><th>Target</th></tr>',
  '<tr><td>Hello</td><td rowspan="2">你好</td></tr>',
  '<tr><td>World</td></tr>',
  '<tr><td>Submit</td><td>提交</td></tr>',
  '</table>',
].join('');

describe('useCopyTestSession', () => {
  it('manages storage, selection, validation snapshots, export commit, and deletion', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      expect(result.current.applyLoadedStorage(storageHtml)).toBe(1);
    });
    expect(result.current.selectedTableIndex).toBe(0);
    expect(result.current.previewColumnIndexes).toEqual([0, 1]);
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    expect(result.current.selectedRowIndexes).toEqual([0, 2]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { expected: '你好', reference: 'Hello', rowIndex: 0 },
      { expected: '提交', reference: 'Submit', rowIndex: 2 },
    ]);
    act(() => {
      result.current.setSelectedRowIndexes([0]);
      result.current.applyValidationResults([{ evidenceImageFileNames: ['screen-a.png'], passed: true, rowIndex: 0 }], [image], 1, 'Target', 0);
      result.current.applyValidationResults([{ evidenceImageFileNames: ['screen-a.png'], passed: true, rowIndex: 0 }], [image], 1, 'Target', 99);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
    expect(result.current.getCurrentValidationImages()).toEqual([image]);
    act(() => {
      expect(result.current.removeEvidenceImageReference({ imageId: 'missing' })).toEqual({ imageStillUsed: false, removed: false });
      expect(result.current.removeEvidenceImageReference({ imageId: 'screen-a.png' })).toEqual({ imageStillUsed: false, removed: true });
      result.current.commitExportedStorage(result.current.originalStorageHtml);
      result.current.commitExportedStorage('<p>no tables</p>');
      result.current.resetValidationSnapshots();
      result.current.handleTableChange(0);
    });
    expect(result.current.selectedColumnIndex).toBeUndefined();
    act(() => {
      result.current.handleComparisonColumnChange(99);
      result.current.handleComparisonColumnChange(undefined);
      result.current.resetLoadedData();
    });
    expect(result.current.tables).toEqual([]);
  });
});
