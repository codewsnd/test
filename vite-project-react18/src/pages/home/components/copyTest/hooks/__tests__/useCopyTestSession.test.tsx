import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  parseCopyTestStorageTables,
} from '../../table/copyTestTableParser';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_RESULT_FAILED_GROUP_VALUE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_RESULT_PASSED_GROUP_VALUE,
  COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
} from '../../table/tableConstants';
import { useCopyTestSession } from '../useCopyTestSession';

const image = {
  base64: 'data:image/png;base64,QUJD',
  fileName: 'screen-a.png',
  originalFileName: 'This is just test.png',
};
/** 连续删除回归中的未加载占位图片。 */
const secondImage = {
  base64: 'data:image/png;base64,REVG',
  fileName: 'screen-b.png',
  originalFileName: 'Second upload.webp',
};
/** 连续删除回归中仍成功加载的真实图片。 */
const thirdImage = {
  base64: 'data:image/png;base64,R0hJ',
  fileName: 'screen-c.png',
  originalFileName: '第三批截图.PNG',
};
/** 覆盖已导入首行 winner 的新图片。 */
const replacementImage = {
  base64: 'data:image/png;base64,SktM',
  fileName: 'screen-d.png',
  originalFileName: 'Replacement.png',
};
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

/** First/Second 同时被前后空白行包围的会话表格。 */
const blankSeparatedStorageHtml = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td><br /></td></tr>',
  '<tr><td>2</td><td>First</td></tr>',
  '<tr><td>3</td><td>Second</td></tr>',
  '<tr><td>4</td><td><br /></td></tr>',
  '<tr><td>5</td><td>Fourth</td></tr>',
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

/** 两个 Comparison Column Pair 都已加载到会话缓存的导入表格。 */
const pairCacheStorageHtml = [
  '<table><tr><th>Alpha</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha" data-copy-test-schema="2">Test Result - Alpha</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha" data-copy-test-schema="2">Test Evidence - Alpha</th>',
  '<th>Beta</th>',
  '<th data-copy-test-column-type="result" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta" data-copy-test-schema="2">Test Result - Beta</th>',
  '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta" data-copy-test-schema="2">Test Evidence - Beta</th></tr>',
  '<tr><td>A</td><td></td>',
  '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Alpha" data-copy-test-owner-id="0:Alpha" data-copy-test-schema="2">',
  '<ac:image><ri:attachment ri:filename="alpha.png" /></ac:image></td>',
  '<td>B</td><td></td>',
  '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="3:Beta" data-copy-test-owner-id="3:Beta" data-copy-test-schema="2">',
  '<ac:image><ri:attachment ri:filename="beta.png" /></ac:image></td></tr></table>',
].join('');

/** 读取指定状态分组内保持业务顺序的 Screen 图片 ID。 */
const getStatusGroupImageIds = (document: Document, status: string): string[] => {
  const group = document.querySelector(
    `[${COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE}="${status}"]`
  );
  return Array.from(group?.querySelectorAll(
    `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
  ) || []).map(item => item.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) || '');
};

/** 读取 Evidence 单元格内保持展示顺序的图片 ID。 */
const getEvidenceImageIds = (document: Document): string[] => {
  return Array.from(document.querySelectorAll(
    `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`
  )).map(item => item.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '');
};

/** 读取 Evidence 卡片中完整的 Screen 展示标签。 */
const getEvidenceScreenLabels = (document: Document): string[] => {
  return Array.from(document.querySelectorAll(
    `[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}] strong`
  )).map(item => item.textContent || '');
};

/** 读取 Result 分组中完整的 Screen 展示标签。 */
const getResultScreenLabels = (document: Document): string[] => {
  return Array.from(document.querySelectorAll(
    `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
  )).map(item => item.firstChild?.textContent || '');
};

/** 读取指定 Screen 当前 Result DOM 中的实例 ID。 */
const getResultImageInstanceId = (document: Document, imageId: string): string => {
  const item = Array.from(document.querySelectorAll(
    `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
  )).find(candidate => {
    return candidate.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) === imageId;
  });
  return item?.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE) || '';
};

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
      { evidenceGroupId: 0, expected: 'copy', rowIndex: 0 },
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
      { evidenceGroupId: 0, expected: '你好', rowIndex: 0 },
      { evidenceGroupId: 2, expected: '提交', rowIndex: 2 },
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

  it('keeps only the latest batch winner and clears it for an empty result', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [secondImage.fileName],
        evidenceImages: [secondImage],
        languageIssues: ['Second screenshot differs.'],
        passed: false,
        rowIndex: 0,
      }], [secondImage], 1, 'Target', 0);
    });
    const afterSecondBatchDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    expect(getEvidenceImageIds(afterSecondBatchDocument)).toEqual([secondImage.fileName]);
    expect(getStatusGroupImageIds(
      afterSecondBatchDocument,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([]);
    expect(getStatusGroupImageIds(
      afterSecondBatchDocument,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([secondImage.fileName]);
    expect(getEvidenceScreenLabels(afterSecondBatchDocument)).toEqual(['Second upload']);
    expect(getResultScreenLabels(afterSecondBatchDocument)).toEqual(['Second upload']);
    expect(afterSecondBatchDocument.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${secondImage.fileName}"]`
    )?.textContent).toContain('Second screenshot differs.');
    expect(result.current.getCurrentValidationImages()).toEqual([secondImage]);

    /** 第三批唯一 winner 覆盖第二批。 */
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [thirdImage.fileName],
        evidenceImages: [thirdImage],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [thirdImage], 1, 'Target', 0);
    });
    const afterThirdBatchDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    expect(getEvidenceImageIds(afterThirdBatchDocument)).toEqual([thirdImage.fileName]);
    expect(getStatusGroupImageIds(
      afterThirdBatchDocument,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([thirdImage.fileName]);
    expect(getStatusGroupImageIds(
      afterThirdBatchDocument,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([]);
    expect(getEvidenceScreenLabels(afterThirdBatchDocument)).toEqual(['第三批截图']);
    expect(result.current.getCurrentValidationImages()).toEqual([thirdImage]);

    /** 本批没有 Evidence 时覆盖并清空目标行。 */
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [],
        evidenceImages: [],
        languageIssues: ['Newest screenshot did not match this row.'],
        passed: false,
        rowIndex: 0,
      }], [], 1, 'Target', 0);
    });
    const afterEmptyBatchDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    expect(getEvidenceImageIds(afterEmptyBatchDocument)).toEqual([]);
    expect(afterEmptyBatchDocument.body.textContent).not.toContain(
      'Newest screenshot did not match this row.'
    );
    expect(result.current.getCurrentValidationImages()).toEqual([]);
  });

  it('drops historical manual Screen state when a new winner overwrites it', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: ['Historical screenshot issue.'],
        passed: false,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
    });
    const initialDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    act(() => {
      result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: getResultImageInstanceId(initialDocument, image.fileName),
        passed: true,
        previewRevision: result.current.revision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [secondImage.fileName],
        evidenceImages: [secondImage],
        languageIssues: ['New screenshot issue.'],
        passed: false,
        rowIndex: 0,
      }], [secondImage], 1, 'Target', 0);
    });

    const overwrittenDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    expect(getStatusGroupImageIds(
      overwrittenDocument,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([]);
    expect(getStatusGroupImageIds(
      overwrittenDocument,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([secondImage.fileName]);
    expect(overwrittenDocument.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${secondImage.fileName}"]`
    )?.textContent).toContain('New screenshot issue.');
    expect(overwrittenDocument.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${image.fileName}"]`
    )).toBeNull();
    expect(result.current.getCurrentValidationImages()).toEqual([secondImage]);

    /** 已被覆盖的旧 winner 不再接受状态更新。 */
    act(() => {
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: getResultImageInstanceId(initialDocument, image.fileName),
        passed: false,
        previewRevision: result.current.revision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      })).toBe(false);
    });
  });

  it('moves the singleton Screen, rejects invalid identities, and restores its failure details', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: ['Visible copy differs.'],
        passed: false,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
    });
    act(() => {
      result.current.commitExportedStorage(
        result.current.selectedTable?.workingHtml || storageHtml
      );
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(false);

    /** 从初始 Result 读取预览消息必须携带的稳定图片和当前 DOM 实例身份。 */
    const initialDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    const imageInstanceId = getResultImageInstanceId(initialDocument, image.fileName);
    expect(imageInstanceId).not.toBe('');

    /** 把唯一 Screen 移入新建的 Passed 分组，并立即形成当前 Pair 的待回写变更。 */
    let changed = false;
    const failedPreviewRevision = result.current.revision;
    act(() => {
      changed = result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: true,
        previewRevision: failedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    const passedDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    const passedResult = passedDocument.querySelector(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
    );
    const passedImageItem = passedDocument.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${image.fileName}"]`
    );
    expect(changed).toBe(true);
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
    expect(getStatusGroupImageIds(
      passedDocument,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([image.fileName]);
    expect(getStatusGroupImageIds(
      passedDocument,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([]);
    expect(passedImageItem?.textContent).not.toContain('Visible copy differs.');
    expect(passedResult?.textContent).not.toContain('Visible copy differs.');
    expect(result.current.getCurrentValidationImages()).toEqual([image]);

    /** 重复目标、无效图片/实例组合和旧来源列消息都不应产生额外状态变化。 */
    const passedPreviewRevision = result.current.revision;
    const mixedHtml = result.current.selectedTable?.workingHtml;
    act(() => {
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: true,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      })).toBe(false);
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: '1:Target:1:other.png',
        passed: false,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      })).toBe(false);
      expect(result.current.setResultStatus({
        imageId: 'missing.png',
        instanceId: imageInstanceId,
        passed: false,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      })).toBe(false);
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: false,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: 'stale-column',
        tableIndex: 0,
      })).toBe(false);
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: false,
        previewRevision: failedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      })).toBe(false);
      expect(result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: false,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 1,
      })).toBe(false);
    });
    expect(result.current.selectedTable?.workingHtml).toBe(mixedHtml);

    /** 唯一 Screen 切回 Failed 分组后，原错误信息恢复可见。 */
    act(() => {
      changed = result.current.setResultStatus({
        imageId: image.fileName,
        instanceId: imageInstanceId,
        passed: false,
        previewRevision: passedPreviewRevision,
        rowIndex: 0,
        sourceColumnKey: '1:Target',
        tableIndex: 0,
      });
    });
    const failedDocument = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    const restoredImageItem = failedDocument.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${image.fileName}"]`
    );
    expect(changed).toBe(true);
    expect(getStatusGroupImageIds(
      failedDocument,
      COPY_TEST_RESULT_PASSED_GROUP_VALUE
    )).toEqual([]);
    expect(getStatusGroupImageIds(
      failedDocument,
      COPY_TEST_RESULT_FAILED_GROUP_VALUE
    )).toEqual([image.fileName]);
    expect(restoredImageItem?.textContent).toContain('Visible copy differs.');
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
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

  it('keeps cached Evidence images after switching between Comparison Columns', () => {
    /** 当前会话中已加载的 Alpha 附件。 */
    const alphaImage = { base64: 'data:image/png;base64,QUxQSEE=', fileName: 'alpha.png' };
    /** 当前会话中已加载的 Beta 附件。 */
    const betaImage = { base64: 'data:image/png;base64,QkVUQQ==', fileName: 'beta.png' };
    const { result } = renderHook(() => useCopyTestSession());

    act(() => {
      result.current.applyLoadedStorage(pairCacheStorageHtml);
    });
    expect(result.current.getCurrentPreviewImages()).toEqual([]);

    act(() => {
      /** 模拟选择 Alpha 后附件请求成功写入缓存。 */
      const selection = result.current.handleComparisonColumnChange(0);
      if (selection) {
        result.current.applyComparisonColumnPreviewImages(selection, [alphaImage]);
      }
    });
    expect(result.current.getCurrentPreviewImages()).toEqual([alphaImage]);

    act(() => {
      /** 切换 Beta 后继续合并，不覆盖 Alpha 缓存。 */
      const selection = result.current.handleComparisonColumnChange(3);
      if (selection) {
        result.current.applyComparisonColumnPreviewImages(selection, [betaImage]);
      }
    });
    expect(result.current.getCurrentPreviewImages()).toEqual([alphaImage, betaImage]);
  });

  it('立即迁移已导入 Result 和 Evidence 的历史 Screen 标签', () => {
    /** 使用纯 UUID 内部附件名和完整原始文件名 metadata 的历史 storage。 */
    const uuidFileName = '0198f4e0-0000-7000-8000-000000000000.png';
    const historicalStorage = [
      '<table><tr><th>Target</th>',
      '<th data-copy-test-column-type="result" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Result - Target</th>',
      '<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">Test Evidence - Target</th></tr>',
      '<tr><td>Copy</td>',
      '<td data-copy-test-column-type="result" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">',
      `<ul><li data-copy-test-result-image-id="${uuidFileName}">Screen01 (旧标签)</li></ul></td>`,
      '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="0:Target" data-copy-test-owner-id="0:Target" data-copy-test-schema="2">',
      `<div data-copy-test-evidence-card="true"><strong>Screen01 (旧标签)</strong><br />`,
      `<ac:image data-copy-test-evidence-image-id="${uuidFileName}" data-copy-test-evidence-image-alt="首页截图.png">`,
      `<ri:attachment ri:filename="${uuidFileName}" /></ac:image></div></td></tr></table>`,
    ].join('');
    const { result } = renderHook(() => useCopyTestSession());

    act(() => {
      result.current.applyLoadedStorage(historicalStorage);
    });

    expect(result.current.selectedTable?.workingHtml).toContain('首页截图');
    expect(result.current.selectedTable?.workingHtml).not.toContain('Screen01');
    expect(result.current.selectedTable?.workingHtml).toContain(`ri:filename="${uuidFileName}"`);
    expect(result.current.originalStorageHtml).toBe(historicalStorage);
    act(() => {
      result.current.handleComparisonColumnChange(0);
    });
    expect(result.current.selectedColumnHasExportableContent).toBe(true);
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

  it('links selection inside a non-empty section while preserving both validation rows', () => {
    const { result } = renderHook(() => useCopyTestSession());
    const expectedValidationRows = [
      { evidenceGroupId: 1, expected: 'First', rowIndex: 1 },
      { evidenceGroupId: 1, expected: 'Second', rowIndex: 2 },
    ];
    act(() => {
      result.current.applyLoadedStorage(blankSeparatedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    /** 两侧空行不可选，Fourth 使用新的独立 section。 */
    expect(result.current.selectedRowIndexes).toEqual([1, 2, 4]);
    act(() => {
      result.current.setSelectedRowIndexes([1]);
    });
    expect(result.current.selectedRowIndexes).toEqual([1, 2]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual(expectedValidationRows);

    /** 从第二行发起选择也必须得到同一整组。 */
    act(() => {
      result.current.setSelectedRowIndexes([2]);
    });
    expect(result.current.selectedRowIndexes).toEqual([1, 2]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual(expectedValidationRows);
  });

  it('overwrites a linked group with one latest Evidence image', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(blankSeparatedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.setSelectedRowIndexes([1]);
    });
    act(() => {
      result.current.applyValidationResults([1, 2].map(rowIndex => ({
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [image], 1, 'Target', 0);
    });
    act(() => {
      result.current.applyValidationResults([1, 2].map(rowIndex => ({
        evidenceImageFileNames: [secondImage.fileName],
        evidenceImages: [secondImage],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [secondImage], 1, 'Target', 0);
    });

    const document = new DOMParser().parseFromString(
      result.current.selectedTable?.workingHtml || '',
      'text/html'
    );
    const evidenceImage = document.querySelector(
      `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${secondImage.fileName}"]`
    );
    expect(getEvidenceImageIds(document)).toEqual([secondImage.fileName]);
    expect(evidenceImage?.closest('td')?.getAttribute('rowspan')).toBe('2');
    expect(getResultScreenLabels(document)).toEqual(['Second upload', 'Second upload']);
    expect(result.current.getCurrentValidationImages()).toEqual([secondImage]);
  });

  it('keeps rowspan atoms independently selectable when the column has no blank boundary', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(middleMergedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });

    expect(result.current.selectedRowIndexes).toEqual([0, 1, 3]);
    act(() => {
      result.current.setSelectedRowIndexes([0]);
    });
    expect(result.current.selectedRowIndexes).toEqual([0]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { evidenceGroupId: 0, expected: 'copy 1', rowIndex: 0 },
    ]);

    /** rowspan 覆盖行仍规范为原子锚点，但不会联动相邻原子组。 */
    act(() => {
      result.current.setSelectedRowIndexes([2]);
    });
    expect(result.current.selectedRowIndexes).toEqual([1]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { evidenceGroupId: 1, expected: 'copy 2 and 3', rowIndex: 1 },
    ]);

    act(() => {
      result.current.setSelectedRowIndexes([3]);
    });
    expect(result.current.selectedRowIndexes).toEqual([3]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { evidenceGroupId: 3, expected: 'copy 4', rowIndex: 3 },
    ]);
  });

  it('does not restore linked selection from a persisted no-blank dynamic merge', () => {
    const { result } = renderHook(() => useCopyTestSession());
    act(() => {
      result.current.applyLoadedStorage(middleMergedStorageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([0, 1].map(rowIndex => ({
        evidenceImageFileNames: [secondImage.fileName],
        evidenceImages: [secondImage],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [secondImage], 1, 'Target', 0);
    });
    act(() => {
      result.current.setSelectedRowIndexes([1]);
    });

    expect(result.current.selectedColumnContext?.rowGroups.map(group => group.evidenceGroupId))
      .toEqual([0, 0, 3]);
    expect(result.current.selectedRowIndexes).toEqual([1]);
    expect(result.current.buildSelectedRowsForValidation()).toEqual([
      { evidenceGroupId: 1, expected: 'copy 2 and 3', rowIndex: 1 },
    ]);
  });

  it('overwrites the validated imported row without restoring an empty historical row', () => {
    /** 先提交同时包含无图失败结果和有图通过结果的 AI 响应。 */
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

    /** 只保留第二个独立原子组的本轮 winner，不恢复无图历史 Result。 */
    const updatedHtml = imported.result.current.selectedTable?.workingHtml || '';
    expect(updatedHtml).not.toContain('Historical missing copy');
    expect(updatedHtml).not.toContain('screen-a.png');
    expect(updatedHtml).toContain('screen-b.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([secondImage]);
  });

  it('overwrites only the selected imported atom and preserves other winners and rowspans', () => {
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
    /** 模拟回写后重新导入，每个无空行原子组保留自己的 winner。 */
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
        evidenceImageFileNames: [replacementImage.fileName],
        evidenceImages: [replacementImage],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [replacementImage], 1, 'Target', 0);
    });

    /** 首行被新 winner 覆盖，其他独立原子组保持历史。 */
    const updatedHtml = imported.result.current.selectedTable?.workingHtml || '';
    expect(updatedHtml).not.toContain('screen-a.png');
    expect(updatedHtml).toContain('screen-b.png');
    expect(updatedHtml).toContain('screen-c.png');
    expect(updatedHtml).toContain('screen-d.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([
      replacementImage,
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

  it('persists and deletes one imported winner without unrelated image identities', () => {
    /** 先生成只含当前 winner 的合法 schema 2 storage。 */
    const generated = renderHook(() => useCopyTestSession());
    act(() => {
      generated.result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      generated.result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      generated.result.current.applyValidationResults([{
        evidenceImageFileNames: ['screen-a.png'],
        evidenceImages: [image],
        languageIssues: [],
        passed: true,
        rowIndex: 0,
      }], [image], 1, 'Target', 0);
    });
    const generatedHtml = generated.result.current.selectedTable?.workingHtml || '';
    expect(generatedHtml).toContain(image.fileName);
    expect(generatedHtml).not.toContain(secondImage.fileName);
    expect(generatedHtml).not.toContain(thirdImage.fileName);
    expect(generated.result.current.getCurrentValidationImages()).toEqual([image]);

    /** 重新导入后唯一 winner 仍可被精确删除。 */
    const imported = renderHook(() => useCopyTestSession());
    act(() => {
      imported.result.current.applyLoadedStorage(
        generatedHtml,
        [image]
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
    expect(imported.result.current.selectedTable?.workingHtml).not.toContain('screen-a.png');
    expect(imported.result.current.selectedTable?.workingHtml).not.toContain('screen-b.png');
    expect(imported.result.current.selectedTable?.workingHtml).not.toContain('screen-c.png');
    expect(imported.result.current.getCurrentValidationImages()).toEqual([]);
    expect(imported.result.current.getCurrentPreviewImages()).toEqual([]);
  });
});
