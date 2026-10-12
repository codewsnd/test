import { describe, expect, it, vi } from 'vitest';
import {
  buildStorageAttachmentPreviewBundle,
  getAttachmentPreviewRequest,
  getCopyTestValidationContext,
  getEmptyAttachmentPreviewBundle,
  getRequiredExportStorage,
  getRequiredExportStorageOrThrow,
  hasCopyTestValidationEvidence,
} from '../copyTestControllerUtils';
import { applyCopyTestValidationResults, ensureCopyTestWorkingColumns } from '../../table/copyTestTableEditor';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';
import type { UseCopyTestSessionResult } from '../../hooks/useCopyTestSession';
import { CopyTestExportError } from '../../table/copyTestExportErrors';

const hoisted = vi.hoisted(() => ({ warning: vi.fn() }));

vi.mock('antd', () => ({ message: { warning: hoisted.warning } }));

const storageHtml = '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>';
const managedEvidenceStorage = [
  '<table><tr><td data-copy-test-schema="2" data-copy-test-column-type="evidence"',
  ' data-copy-test-source-column-key="table-0:target" data-copy-test-owner-id="table-0:target">',
  '<ac:image><ri:attachment ri:filename="screen.png" /></ac:image>',
  '</td></tr></table>',
].join('');
const parsedTable = parseCopyTestStorageTables(storageHtml)[0];
const workingTable = applyCopyTestValidationResults(
  ensureCopyTestWorkingColumns(parsedTable, 0, 'Target'),
  [{
    evidenceImageFileNames: [],
    evidenceImages: [],
    languageIssues: [],
    passed: true,
    rowIndex: 0,
  }],
  0,
  'Target',
  []
);
const tableState = {
  buildSelectedRowsForValidation: () => [{ evidenceGroupId: 0, expected: 'copy', rowIndex: 0 }],
  originalStorageHtml: storageHtml,
  selectedColumnIndex: 0,
  selectedHeader: { index: 0, label: 'Target' },
  selectedRowIndexes: [0],
  selectedTable: workingTable,
} as unknown as UseCopyTestSessionResult;

describe('copyTestControllerUtils', () => {
  it.each([
    { content: '<p><br></p>', expected: false },
    { content: '<p>&nbsp;</p>', expected: false },
    { content: '<p>Existing evidence</p>', expected: true },
    { content: '<ac:image><ri:attachment ri:filename="old.png" /></ac:image>', expected: true },
    { content: '<img src="old.png" />', expected: true },
  ])('detects selected Evidence content: $content', ({ content, expected }) => {
    const generated = ensureCopyTestWorkingColumns(parsedTable, 0, 'Target');
    const doc = new DOMParser().parseFromString(generated.workingHtml, 'text/html');
    doc.querySelector('td[data-copy-test-column-type="evidence"]')!.innerHTML = content;
    const table = parseCopyTestStorageTables(doc.body.innerHTML)[0];
    expect(hasCopyTestValidationEvidence({
      selectedTable: table, selectedColumnIndex: 0, selectedColumnLabel: 'Target',
      rows: [{ rowIndex: 0, evidenceGroupId: 0, expected: 'copy' }],
    })).toBe(expected);
  });

  it('does not count Evidence belonging to unselected rows', () => {
    const table = applyCopyTestValidationResults(
      parseCopyTestStorageTables('<table><tr><th>Target</th></tr><tr><td>A</td></tr><tr><td></td></tr><tr><td>B</td></tr></table>')[0],
      [{ rowIndex: 0, passed: true, languageIssues: [], evidenceImageFileNames: ['a.png'],
        evidenceImages: [{ fileName: 'a.png', base64: 'data:image/png;base64,QQ==' }] }],
      0, 'Target', [{ fileName: 'a.png', base64: 'data:image/png;base64,QQ==' }]
    );
    expect(hasCopyTestValidationEvidence({
      selectedTable: table, selectedColumnIndex: 0, selectedColumnLabel: 'Target',
      rows: [{ rowIndex: 2, evidenceGroupId: 2, expected: 'B' }],
    })).toBe(false);
  });

  it('returns selection-specific export errors without emitting a second static notification', () => {
    hoisted.warning.mockClear();
    expect(() => getRequiredExportStorageOrThrow({ ...tableState, selectedTable: undefined }))
      .toThrow(new CopyTestExportError('SELECTION_REQUIRED'));
    expect(() => getRequiredExportStorageOrThrow({ ...tableState, selectedRowIndexes: [] }))
      .toThrow(new CopyTestExportError('ROWS_REQUIRED'));
    expect(hoisted.warning).not.toHaveBeenCalled();
  });
  it('validates export and validation context guards', () => {
    expect(getRequiredExportStorage({ ...tableState, selectedTable: undefined })).toBeNull();
    expect(getRequiredExportStorage({ ...tableState, selectedRowIndexes: [] })).toBeNull();
    expect(getRequiredExportStorage(tableState)).toContain('Test Result - Target');
    expect(getCopyTestValidationContext(tableState, [])).toBeNull();
    expect(getCopyTestValidationContext({ ...tableState, selectedTable: undefined }, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])).toBeNull();
    expect(getCopyTestValidationContext(tableState, Array.from({ length: 51 }, (_, index) => ({
      base64: 'x',
      fileName: `${index}.png`,
      md5: `${index}`,
      size: 1,
    })))).toBeNull();
    expect(getCopyTestValidationContext({ ...tableState, buildSelectedRowsForValidation: () => [] }, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])).toBeNull();
    expect(getCopyTestValidationContext(tableState, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])?.rows).toEqual([
      { evidenceGroupId: 0, expected: 'copy', rowIndex: 0 },
    ]);
  });

  it('builds attachment preview requests and propagates attachment failures', async () => {
    expect(getAttachmentPreviewRequest('http://wiki', storageHtml)).toBeNull();
    expect(getAttachmentPreviewRequest('http://wiki', managedEvidenceStorage)).toEqual({
      confluenceUrl: 'http://wiki',
      fileNames: ['screen.png'],
    });
    const emptyBundle = getEmptyAttachmentPreviewBundle(storageHtml);
    expect(emptyBundle).toEqual({ images: [], storageHtml });
    const loadAttachments = vi.fn();
    await expect(buildStorageAttachmentPreviewBundle({
      confluenceUrl: 'http://wiki',
      loadAttachments,
      storageHtml,
    })).resolves.toEqual(emptyBundle);
    expect(loadAttachments).not.toHaveBeenCalled();

    const attachmentError = new Error('failed');
    await expect(buildStorageAttachmentPreviewBundle({
      confluenceUrl: 'http://wiki',
      loadAttachments: vi.fn().mockRejectedValue(attachmentError),
      storageHtml: managedEvidenceStorage,
    })).rejects.toBe(attachmentError);
  });
});
