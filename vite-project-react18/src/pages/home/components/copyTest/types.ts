/**
 * 文件作用：定义 CopyTest 组件、表格和图片相关共享类型。
 */
import type { CopyTestImage } from './api/copyTestApi';
import type {
  CopyTestHeader as CopyTestModelHeader,
} from './table/tableModel';
import type {
  CopyTestEvidenceDeleteTarget as CopyTestEditorEvidenceDeleteTarget,
  CopyTestResultStatusUpdate as CopyTestEditorResultStatusUpdate,
  CopyTestValidationResultWithEvidence as CopyTestEditorValidationResultWithEvidence,
} from './table/copyTestTableEditor';
import type { CopyTestWorkingTable } from './table/copyTestTableParser';

/** CopyTest 弹窗组件的外部入参。 */
export interface CopyTestProps {
  /** 关闭 CopyTest 弹窗时执行的回调。 */
  onClose?: () => void;
  /** 是否显示 CopyTest 弹窗。 */
  open?: boolean;
}

/** Confluence 表格的列头信息。 */
export type CopyTestHeader = CopyTestModelHeader;

/** 从 Confluence storage html 中解析出的单张 CopyTest 表格。 */
export type CopyTestTableEntry = CopyTestWorkingTable;

/** 仅保存在浏览器内存中的截图信息。 */
export interface CopyTestMemoryImage extends CopyTestImage {
  /** 图片内容的 MD5，用于本次上传列表去重。 */
  md5: string;
  /** 图片原始文件大小，单位为字节。 */
  size: number;
}

/** Evidence 图片预览需要的轻量信息。 */
export interface CopyTestEvidencePreviewInfo {
  /** Evidence 图片的替代文本。 */
  alt: string;
  /** 由附件文件名确定的稳定图片标识。 */
  imageId: string;
  /** 浏览器预览使用的 Blob URL。 */
  src: string;
}

/** 删除 Evidence 图片时用于定位具体图片实例的信息。 */
export type CopyTestEvidenceDeleteTarget = CopyTestEditorEvidenceDeleteTarget;

/** 人工移动单个 Result Screen 状态时使用的稳定目标和预览身份。 */
export interface CopyTestResultStatusUpdate extends CopyTestEditorResultStatusUpdate {
  /** 生成操作按钮时所属的工作表格下标。 */
  tableIndex: number;
  /** 生成操作按钮时所属的表格会话版本。 */
  previewRevision: number;
}

/** 已绑定 Evidence 内存图片的校验结果。 */
export type CopyTestValidationResultWithEvidence = CopyTestEditorValidationResultWithEvidence;
