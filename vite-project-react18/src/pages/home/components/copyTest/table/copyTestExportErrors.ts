/** 导出失败的稳定分类与用户可操作的提示。 */
export const COPY_TEST_EXPORT_ERROR_MESSAGES = {
  SELECTION_REQUIRED: 'Please select a table and comparison column before exporting.',
  ROWS_REQUIRED: 'Please select at least one row to export.',
  STORAGE_READ_FAILED: 'Could not load the latest Confluence page. Check your connection and access, then retry.',
  INVALID_EXPORT_SCOPE: 'Could not initialize this export. Please retry.',
  IMPORTED_TABLE_INVALID: 'The imported table could not be read. Please import the page again.',
  WORKING_TABLE_INVALID: 'The local table could not be read. Please import the page again and repeat your changes.',
  WORKING_STRUCTURE_CHANGED: 'The local table structure no longer matches the imported table. Please import the page again and repeat your changes.',
  TABLE_NOT_FOUND: 'The original table could not be located. It may have been removed or its headers, rows or merged cells changed. Please import the page again.',
  TABLE_AMBIGUOUS: 'Multiple tables have the same structure, so the export target cannot be identified. Give the tables distinct headers before importing again.',
  SOURCE_COLUMN_CHANGED: 'The comparison column text or merged cells no longer match the imported page. Please import the page again and validate the updated content.',
  ROW_COUNT_CHANGED: 'The table row count no longer matches the local results. Please import the page again and validate the updated rows.',
  MERGED_SELECTION_CONFLICT: 'Some Test Result or Test Evidence cells span selected and unselected rows. Select all rows covered by those merged cells, then retry.',
  DUPLICATE_CELLS: 'Duplicate Test Result or Test Evidence cells were found for this comparison column. Resolve the duplicate columns in Confluence, then import again.',
  CELL_MAPPING_FAILED: 'The table cells could not be mapped for export. Check the table layout and merged cells, then import the page again.',
  PATCH_SCOPE_MISMATCH: 'Export was stopped because it would change content outside the selected table. Please import the page again and retry.',
} as const;

export type CopyTestExportErrorCode = keyof typeof COPY_TEST_EXPORT_ERROR_MESSAGES;

/** 保留具体失败原因，供控制器选择提示；兼容接口仍可将其转换为 null。 */
export class CopyTestExportError extends Error {
  readonly code: CopyTestExportErrorCode;

  constructor(code: CopyTestExportErrorCode) {
    super(COPY_TEST_EXPORT_ERROR_MESSAGES[code]);
    this.name = 'CopyTestExportError';
    this.code = code;
  }
}
