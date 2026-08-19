import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
} from '../../table/tableConstants';
import { useCopyTestSession } from '../useCopyTestSession';

const image = {
  base64: 'data:image/png;base64,QUJD',
  fileName: 'screen-a.png',
  originalFileName: 'first.png',
};

const storageHtml = [
  '<table><tr><th>ID</th><th>Target</th></tr>',
  '<tr><td>1</td><td>First</td></tr>',
  '<tr><td>2</td><td>Second</td></tr>',
  '<tr><td>3</td><td>Third</td></tr>',
  '</table>',
].join('');

/** 读取当前 working DOM 中的全部 Evidence Screen 身份。 */
const getEvidenceImageIds = (workingHtml: string): string[] => {
  const document = new DOMParser().parseFromString(workingHtml, 'text/html');
  return Array.from(document.querySelectorAll(
    `[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`
  )).map(element => {
    return element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
  });
};

describe('useCopyTestSession validation overwrite', () => {
  it('uses the latest status and content when the winner keeps the same fileName', () => {
    const { result } = renderHook(() => useCopyTestSession());
    /** 附件名相同但内容不同的后续上传。 */
    const sameFileNameImage = {
      base64: 'data:image/png;base64,REVG',
      fileName: image.fileName,
      originalFileName: 'same-name.png',
    };
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
        evidenceImageFileNames: [sameFileNameImage.fileName],
        evidenceImages: [sameFileNameImage],
        languageIssues: ['Latest batch result.'],
        passed: false,
        rowIndex: 0,
      }], [sameFileNameImage], 1, 'Target', 0);
    });

    const workingHtml = result.current.selectedTable?.workingHtml || '';
    expect(getEvidenceImageIds(workingHtml)).toEqual([image.fileName]);
    expect(workingHtml).toContain('Latest batch result.');
    expect(result.current.getCurrentValidationImages()).toEqual([sameFileNameImage]);
  });

  it('uses a same-content new UUID when it expands an adjacent historical group', () => {
    const { result } = renderHook(() => useCopyTestSession());
    /** 与历史 A 内容相同、但附件身份不同的本批 winner。 */
    const sameContentWinner = {
      ...image,
      fileName: 'screen-a-new-uuid.png',
      originalFileName: 'same-content-new-name.png',
    };
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([0, 1].map(rowIndex => ({
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [image], 1, 'Target', 0);
    });
    act(() => {
      result.current.applyValidationResults([0, 1, 2].map(rowIndex => ({
        evidenceImageFileNames: [sameContentWinner.fileName],
        evidenceImages: [sameContentWinner],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [sameContentWinner], 1, 'Target', 0);
    });

    const workingHtml = result.current.selectedTable?.workingHtml || '';
    const document = new DOMParser().parseFromString(workingHtml, 'text/html');
    const resultImageIds = Array.from(document.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
    )).map(element => element.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE));
    const evidenceCell = document.querySelector(
      `td[data-copy-test-column-type="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    );
    expect(getEvidenceImageIds(workingHtml)).toEqual([sameContentWinner.fileName]);
    expect(new Set(resultImageIds)).toEqual(new Set([sameContentWinner.fileName]));
    expect(evidenceCell?.getAttribute('rowspan')).toBe('3');
    expect(workingHtml).not.toContain(`data-copy-test-evidence-image-id="${image.fileName}"`);
    expect(result.current.getCurrentValidationImages()).toEqual([sameContentWinner]);
  });

  it('does not expand an historical group across a row omitted from the current batch', () => {
    const { result } = renderHook(() => useCopyTestSession());
    const nextImage = {
      base64: 'data:image/png;base64,REVG',
      fileName: 'screen-b.png',
      originalFileName: 'second.png',
    };
    act(() => {
      result.current.applyLoadedStorage(storageHtml);
    });
    act(() => {
      result.current.handleComparisonColumnChange(1);
    });
    act(() => {
      result.current.applyValidationResults([0, 1].map(rowIndex => ({
        evidenceImageFileNames: [image.fileName],
        evidenceImages: [image],
        languageIssues: [],
        passed: true,
        rowIndex,
      })), [image], 1, 'Target', 0);
    });
    act(() => {
      result.current.applyValidationResults([{
        evidenceImageFileNames: [nextImage.fileName],
        evidenceImages: [nextImage],
        languageIssues: [],
        passed: true,
        rowIndex: 2,
      }], [nextImage], 1, 'Target', 0);
    });

    const workingHtml = result.current.selectedTable?.workingHtml || '';
    const document = new DOMParser().parseFromString(workingHtml, 'text/html');
    const evidenceCells = Array.from(document.querySelectorAll(
      `td[data-copy-test-column-type="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    ));
    expect(getEvidenceImageIds(workingHtml)).toEqual([
      image.fileName,
      nextImage.fileName,
    ]);
    expect(evidenceCells.map(cell => cell.getAttribute('rowspan'))).toEqual(['2', null]);
    expect(result.current.getCurrentValidationImages()).toEqual([image, nextImage]);
  });
});
