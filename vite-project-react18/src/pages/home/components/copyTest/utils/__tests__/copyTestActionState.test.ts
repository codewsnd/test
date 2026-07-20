import { describe, expect, it } from 'vitest';
import { buildCopyTestActionState } from '../copyTestActionState';

const table = { index: 0 } as never;

describe('copyTestActionState', () => {
  it('computes busy, upload, validate, and export states', () => {
    expect(buildCopyTestActionState({
      attachmentsLoading: false,
      exportLoading: false,
      hasExportableContent: true,
      hasActiveImportedSession: true,
      selectedColumnIndex: 1,
      selectedRowCount: 1,
      selectedTable: table,
      storageHtml: '<table />',
      storageLoading: false,
      uploadImageCount: 1,
      uploadPreparing: false,
      validationLoading: false,
    })).toEqual({
      canExportToConfluence: true,
      canUpload: true,
      canValidate: true,
      importBusy: false,
      uploadBusy: false,
    });
    expect(buildCopyTestActionState({
      attachmentsLoading: true,
      exportLoading: true,
      hasExportableContent: false,
      hasActiveImportedSession: false,
      selectedColumnIndex: undefined,
      selectedRowCount: 0,
      selectedTable: undefined,
      storageHtml: '',
      storageLoading: true,
      uploadImageCount: 0,
      uploadPreparing: true,
      validationLoading: true,
    })).toMatchObject({ canExportToConfluence: false, canUpload: false, canValidate: false, importBusy: true, uploadBusy: true });
  });

  it('disables every table action when the imported session is inactive', () => {
    expect(buildCopyTestActionState({
      attachmentsLoading: false,
      exportLoading: false,
      hasExportableContent: true,
      hasActiveImportedSession: false,
      selectedColumnIndex: 1,
      selectedRowCount: 1,
      selectedTable: table,
      storageHtml: '<table />',
      storageLoading: false,
      uploadImageCount: 1,
      uploadPreparing: false,
      validationLoading: false,
    })).toMatchObject({
      canExportToConfluence: false,
      canUpload: false,
      canValidate: false,
    });
  });
});
