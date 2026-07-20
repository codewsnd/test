import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
} from '../../table/copyTestTableParser';
import { useCopyTestSession } from '../useCopyTestSession';

const image = { base64: 'data:image/png;base64,QUJD', fileName: 'screen-a.png' };
/** 连续删除回归中的未加载占位图片。 */
const secondImage = { base64: 'data:image/png;base64,REVG', fileName: 'screen-b.png' };
/** 连续删除回归中仍成功加载的真实图片。 */
const thirdImage = { base64: 'data:image/png;base64,R0hJ', fileName: 'screen-c.png' };
const storageHtml = [
  '<table>',
  '<tr><th>Reference</th><th>Target</th></tr>',
  '<tr><td>Hello</td><td rowspan="2">你好</td></tr>',
  '<tr><td>World</td></tr>',
  '<tr><td>Submit</td><td>提交</td></tr>',
  '</table>',
].join('');

/** 第二列为空表头、但仍可按原始逻辑列下标选择的会话表格。 */
const blankHeaderStorageHtml = [
  '<table><tr><th>ID</th><th><br /></th></tr>',
  '<tr><td>1</td><td>copy</td></tr>',
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
  it('selects a blank header by original index without changing its ownership label', () => {
    /** 用于验证 UI 占位标签不会进入业务 ownership 的 CopyTest 会话。 */
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      expect(result.current.applyLoadedStorage(blankHeaderStorageHtml)).toBe(1);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    expect(result.current.selectedColumnIndex).toBe(1);
    expect(result.current.selectedHeader?.label).toBe('');
    expect(getSourceColumnKey(1, result.current.selectedHeader?.label || '')).toBe('1:');
    expect(result.current.selectedRowIndexes).toEqual([0]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { expected: 'copy', rowIndex: 0 },
    ]);
  });

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
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
    expect(result.current.selectedTable?.workingHtml).not.toContain('screen-a.png');
    act(() => {
      result.current.commitExportedStorage(result.current.originalStorageHtml);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(false);
    act(() => {
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

  it('keeps an all-empty validation result pending until the Pair is exported', () => {
    /** 用于验证空结果仍可回写的 CopyTest 会话。 */
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(false);

    act(() => {
      result.current.applyValidationResults([
        {
          evidenceImageFileNames: [],
          evidenceImages: [],
          languageIssues: [],
          passed: false,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: [],
          evidenceImages: [],
          languageIssues: [],
          passed: false,
          rowIndex: 2,
        },
      ], [], 1, 'Target', 0);
    });

    expect(result.current.selectedTable?.workingHtml).not.toContain('Passed');
    expect(result.current.selectedTable?.workingHtml).not.toContain('Failed');
    expect(result.current.selectedColumnHasExportableContent).toBe(true);

    act(() => {
      result.current.commitExportedStorage(result.current.selectedTable?.workingHtml || storageHtml);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(false);
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

  it('resets imported tables, selections, and image identities as one session', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(importedStorageHtml, [importedImage]);
    });
    act(() => {
      result.current.handleComparisonColumnChange(0);
    });
    expect(result.current.selectedColumnIndex).toBe(0);

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.originalStorageHtml).toBe('');
    expect(result.current.tables).toEqual([]);
    expect(result.current.selectedTable).toBeUndefined();
    expect(result.current.selectedColumnIndex).toBeUndefined();
    expect(result.current.selectedRowIndexes).toEqual([]);
    expect(result.current.getCurrentPreviewImages()).toEqual([]);
    expect(result.current.getCurrentValidationImages()).toEqual([]);
  });

  it('normalizes four selected physical rows into three atomic source groups', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(middleMergedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    expect(result.current.selectedRowIndexes).toEqual([0, 1, 3]);
    act(() => {
      result.current.setSelectedRowIndexes([0, 1, 2, 3]);
    });

    expect(result.current.selectedRowIndexes).toEqual([0, 1, 3]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { expected: 'copy 1', rowIndex: 0 },
      { expected: 'copy 2 and 3', rowIndex: 1 },
      { expected: 'copy 4', rowIndex: 3 },
    ]);
  });

  it('preserves an unselected no-image Failed result during partial validation after import', () => {
    /** 先生成同时包含无图失败结果和有图通过结果的合法 Pair。 */
    const generated = renderHook(() => useCopyTestSession());
    act(() => {
      generated.result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      generated.result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      generated.result.current.applyValidationResults([
        {
          evidenceImageFileNames: [],
          evidenceImages: [],
          languageIssues: ['Historical missing copy'],
          passed: false,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen-a.png'],
          evidenceImages: [image],
          languageIssues: [],
          passed: true,
          rowIndex: 2,
        },
      ], [image], 1, 'Target', 0);
    });
    /** 模拟回写后再次导入的完整工作表格。 */
    const generatedStorageHtml = generated.result.current.selectedTable?.workingHtml || '';
    /** 再次导入后的新会话没有任何内存结果快照。 */
    const imported = renderHook(() => useCopyTestSession());
    act(() => {
      imported.result.current.applyLoadedStorage(generatedStorageHtml, [image]);
    });
    act(() => {
      imported.result.current.handleComparisonColumnChange(1);
    });

    act(() => {
      imported.result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-b.png'],
        evidenceImages: [secondImage],
        languageIssues: [],
        passed: true,
        rowIndex: 2,
      }], [secondImage], 1, 'Target', 0);
    });

    /** 局部校验只能替换 rowIndex 2，未选中的无图失败结果必须保留。 */
    const updatedHtml = imported.result.current.selectedTable?.workingHtml || '';
    expect(updatedHtml).toContain('Historical missing copy');
    expect(updatedHtml).toContain('screen-b.png');
    expect(updatedHtml).not.toContain('screen-a.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([secondImage]);
  });

  it('preserves unselected atomic rowspan groups during partial validation after import', () => {
    /** 先为四个物理行、三个来源原子组生成完整校验结果。 */
    const generated = renderHook(() => useCopyTestSession());
    act(() => {
      generated.result.current.applyLoadedStorage(middleMergedStorageHtml);
    });
    act(() => {
      generated.result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      generated.result.current.applyValidationResults([
        {
          evidenceImageFileNames: ['screen-a.png'],
          evidenceImages: [image],
          languageIssues: [],
          passed: true,
          rowIndex: 0,
        },
        {
          evidenceImageFileNames: ['screen-b.png'],
          evidenceImages: [secondImage],
          languageIssues: [],
          passed: true,
          rowIndex: 1,
        },
        {
          evidenceImageFileNames: ['screen-c.png'],
          evidenceImages: [thirdImage],
          languageIssues: [],
          passed: true,
          rowIndex: 3,
        },
      ], [image, secondImage, thirdImage], 1, 'Target', 0);
    });
    /** 模拟回写后重新导入，并保留三张附件的真实预览内容。 */
    const generatedStorageHtml = generated.result.current.selectedTable?.workingHtml || '';
    /** 用于验证 DOM 恢复路径的新会话。 */
    const imported = renderHook(() => useCopyTestSession());
    act(() => {
      imported.result.current.applyLoadedStorage(
        generatedStorageHtml,
        [image, secondImage, thirdImage]
      );
    });
    act(() => {
      imported.result.current.handleComparisonColumnChange(1);
    });

    act(() => {
      imported.result.current.applyValidationResults([{
        evidenceImageFileNames: [],
        evidenceImages: [],
        languageIssues: ['Updated first row only'],
        passed: false,
        rowIndex: 0,
      }], [], 1, 'Target', 0);
    });

    /** 本次只替换首行，2/3 原子组与第 4 行的图片关系必须继续存在。 */
    const updatedHtml = imported.result.current.selectedTable?.workingHtml || '';
    expect(updatedHtml).toContain('Updated first row only');
    expect(updatedHtml).not.toContain('screen-a.png');
    expect(updatedHtml).toContain('screen-b.png');
    expect(updatedHtml).toContain('screen-c.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([
      secondImage,
      thirdImage,
    ]);

    /** 重新解析更新结果，确认 2/3 行的 Result 与 Evidence 仍共享 rowspan=2。 */
    const updatedTable = parseCopyTestStorageTables(updatedHtml)[0];
    /** 当前 Target 来源列对应的生成双列下标。 */
    const generatedIndexes = findGeneratedColumnIndexes(
      updatedTable.headers,
      getSourceColumnKey(1, 'Target')
    );
    expect(updatedTable.model.rows[2].slots[generatedIndexes.result!]?.owned).toBe(true);
    expect(updatedTable.model.rows[2].slots[generatedIndexes.result!]?.cell.rowSpan).toBe(2);
    expect(updatedTable.model.rows[3].slots[generatedIndexes.result!]?.owned).toBe(false);
    expect(updatedTable.model.rows[2].slots[generatedIndexes.evidence!]?.owned).toBe(true);
    expect(updatedTable.model.rows[2].slots[generatedIndexes.evidence!]?.cell.rowSpan).toBe(2);
    expect(updatedTable.model.rows[3].slots[generatedIndexes.evidence!]?.owned).toBe(false);
  });

  it('preserves unloaded Evidence identities across consecutive imported-image deletions', () => {
    /** 先生成包含三张 Evidence 的合法 schema 2 storage。 */
    const generated = renderHook(() => useCopyTestSession());
    act(() => {
      generated.result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      generated.result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      generated.result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-a.png', 'screen-b.png', 'screen-c.png'],
        evidenceImages: [image, secondImage, thirdImage],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [image, secondImage, thirdImage], 1, 'Target', 0);
    });
    /** 模拟附件接口只成功返回第一张和第三张图片。 */
    const imported = renderHook(() => useCopyTestSession());
    act(() => {
      imported.result.current.applyLoadedStorage(
        generated.result.current.selectedTable?.workingHtml || '',
        [image, thirdImage]
      );
    });
    act(() => {
      imported.result.current.handleComparisonColumnChange(1);
    });

    act(() => {
      expect(imported.result.current.deleteEvidenceImage({
        imageId: 'screen-a.png',
        instanceId: '1:Target:1:screen-a.png',
      })).toEqual({ imageStillUsed: false, removed: true });
    });
    expect(imported.result.current.selectedTable?.workingHtml).toContain('screen-b.png');
    expect(imported.result.current.selectedTable?.workingHtml).toContain('screen-c.png');

    act(() => {
      expect(imported.result.current.deleteEvidenceImage({
        imageId: 'screen-b.png',
        instanceId: '1:Target:1:screen-b.png',
      })).toEqual({ imageStillUsed: false, removed: true });
    });
    expect(imported.result.current.selectedTable?.workingHtml).not.toContain('screen-a.png');
    expect(imported.result.current.selectedTable?.workingHtml).not.toContain('screen-b.png');
    expect(imported.result.current.selectedTable?.workingHtml).toContain('screen-c.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([thirdImage]);
    expect(imported.result.current.getCurrentPreviewImages()).toEqual([thirdImage]);
  });
});
