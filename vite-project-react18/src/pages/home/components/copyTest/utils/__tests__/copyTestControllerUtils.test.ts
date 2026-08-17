import { describe, expect, it, vi } from 'vitest';
import {
  buildStorageAttachmentPreviewBundle,
  getAttachmentPreviewRequest,
  getCopyTestValidationContext,
  getEmptyAttachmentPreviewBundle,
  getRequiredExportStorage,
} from '../copyTestControllerUtils';
import { applyCopyTestValidationResults, ensureCopyTestWorkingColumns } from '../../table/copyTestTableEditor';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';
import type { UseCopyTestSessionResult } from '../../hooks/useCopyTestSession';

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
  buildSelectedRowsForValidation: () => [{ expected: 'copy', rowIndex: 0 }],
  originalStorageHtml: storageHtml,
  selectedColumnIndex: 0,
  selectedHeader: { index: 0, label: 'Target' },
  selectedRowIndexes: [0],
  selectedTable: workingTable,
} as unknown as UseCopyTestSessionResult;

describe('copyTestControllerUtils', () => {
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
    expect(getCopyTestValidationContext(tableState, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])?.rows).toHaveLength(1);
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
