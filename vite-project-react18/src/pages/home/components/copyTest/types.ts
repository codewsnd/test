/**
 * 文件作用：定义 CopyTest 组件、表格和图片相关共享类型。
 */
import type { CopyTestImage } from './api/copyTestApi';
import type {
  CopyTestHeader as CopyTestModelHeader,
} from './table/tableModel';
import type {
  CopyTestEvidenceDeleteTarget as CopyTestEditorEvidenceDeleteTarget,
  CopyTestValidationResultWithEvidence as CopyTestEditorValidationResultWithEvidence,
} from './table/copyTestTableEditor';
import type { CopyTestWorkingTable } from './table/copyTestTableParser';

/** CopyTest 弹窗组件的外部入参。 */
export interface CopyTestProps {
  onClose?: () => void;
  open?: boolean;
}

/** Confluence 表格的列头信息。 */
export type CopyTestHeader = CopyTestModelHeader;

/** 从 Confluence storage html 中解析出的单张 CopyTest 表格。 */
export type CopyTestTableEntry = CopyTestWorkingTable;

/** 仅保存在浏览器内存中的截图信息。 */
export interface CopyTestMemoryImage extends CopyTestImage {
  md5: string;
  size: number;
}

/** Evidence 图片预览需要的轻量信息。 */
export interface CopyTestEvidencePreviewInfo {
  alt: string;
  imageId: string;
  src: string;
}

/** 删除 Evidence 图片时用于定位具体图片实例的信息。 */
export type CopyTestEvidenceDeleteTarget = CopyTestEditorEvidenceDeleteTarget;

/** 支持 CopyTest 证据图片展示的校验结果。 */
export interface CopyTestValidationResultWithEvidence extends CopyTestEditorValidationResultWithEvidence {


  /** 模型用于判定 Result 的图片列表，仅用于状态维护。 */
  resultImages?: CopyTestImage[];


  /** Evidence 列中实际展示的图片列表。 */
  evidenceImages?: CopyTestImage[];
}
