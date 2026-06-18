import { describe, expect, it, vi } from 'vitest';
import {
  buildStorageWithAttachmentPreviews,
  getCopyTestValidationContext,
  getRequiredExportStorage,
} from '../copyTestControllerUtils';
import { applyCopyTestValidationResults, ensureCopyTestWorkingColumns } from '../../table/copyTestTableEditor';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';

const hoisted = vi.hoisted(() => ({ warning: vi.fn() }));

vi.mock('antd', () => ({ message: { warning: hoisted.warning } }));

const storageHtml = '<table><tr><th>Target</th></tr><tr><td>copy</td></tr></table>';
const storageWithImage = '<table><tr><td><ac:image><ri:attachment ri:filename="screen.png" /></ac:image></td></tr></table>';
const parsedTable = parseCopyTestStorageTables(storageHtml)[0];
const workingTable = applyCopyTestValidationResults(
  ensureCopyTestWorkingColumns(parsedTable, 0, 'Target'),
  [{ passed: true, rowIndex: 0 }],
  [],
  0,
  'Target'
);
const tableState = {
  buildSelectedRowsForValidation: () => [{ expected: 'copy', rowIndex: 0 }],
  originalStorageHtml: storageHtml,
  referenceHeader: { index: 0, label: 'Reference' },
  selectedColumnIndex: 0,
  selectedHeader: { index: 0, label: 'Target' },
  selectedTable: workingTable,
} as never;

describe('copyTestControllerUtils', () => {
  it('validates export and validation context guards and attachment previews', async () => {
    expect(getRequiredExportStorage({ ...tableState, selectedTable: undefined } as never)).toBeNull();
    expect(getRequiredExportStorage(tableState)).toContain('Test Result - Target');
    expect(getCopyTestValidationContext(tableState, [])).toBeNull();
    expect(getCopyTestValidationContext({ ...tableState, selectedTable: undefined } as never, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])).toBeNull();
    expect(getCopyTestValidationContext(tableState, Array.from({ length: 51 }, (_, index) => ({
      base64: 'x',
      fileName: `${index}.png`,
      md5: `${index}`,
      size: 1,
    })))).toBeNull();
    expect(getCopyTestValidationContext({ ...tableState, buildSelectedRowsForValidation: () => [] } as never, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])).toBeNull();
    expect(getCopyTestValidationContext(tableState, [{ base64: 'x', fileName: 'a.png', md5: 'm', size: 1 }])?.rows).toHaveLength(1);
    expect(await buildStorageWithAttachmentPreviews({
      confluenceUrl: 'http://wiki',
      loadAttachments: () => ({ images: [{ base64: 'data:image/png;base64,QUJD', fileName: 'screen.png' }] }) as never,
      storageHtml: storageWithImage,
    })).toContain('data-copy-test-evidence-image-id');
    expect(await buildStorageWithAttachmentPreviews({
      confluenceUrl: 'http://wiki',
      loadAttachments: () => {
        throw new Error('failed');
      },
      storageHtml: storageWithImage,
    })).toBe(storageWithImage);
  });
});
