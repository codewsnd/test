/**
 * 文件作用：保持 CopyTest 表格编辑器的稳定公开入口。
 */
export {
  applyCopyTestValidationResults,
  bindResultImages,
} from './copyTestTableRender';
export { ensureCopyTestWorkingColumns } from './copyTestTableColumns';
export {
  deleteCopyTestEvidenceImage,
  hydrateCopyTestValidationSnapshot,
  setCopyTestResultStatus,
} from './copyTestTableState';
export type {
  CopyTestEvidenceDeleteResult,
  CopyTestEvidenceDeleteTarget,
  CopyTestResultScreenStatus,
  CopyTestResultStatusToggleResult,
  CopyTestResultStatusUpdate,
  CopyTestValidationResultWithEvidence,
  CopyTestValidationSnapshot,
} from './copyTestTableRender';
