/**
 * 文件作用：定义 CopyTest 本地文件导出的独立输入、表格模型和输出类型。
 */

/** CopyTest 支持的本地文件导出格式。 */
export type CopyTestFileExportFormat = 'pdf' | 'word' | 'excel';

/** 导出模型中的单元格业务类型。 */
export type CopyTestExportCellKind = 'normal' | 'result' | 'evidence';

/** 本地文件导出可消费的最小图片结构。 */
export interface CopyTestExportImageInput {
  /** 图片 data URL；内容为空或校验失败时会中止本次文件导出。 */
  base64: string;
  /** 与 Confluence ri:attachment 的 ri:filename 对应的文件名。 */
  fileName: string;
}

/** CopyTest 本地文件导出的唯一公开请求结构。 */
export interface CopyTestFileExportRequest {
  /** 可选的导出时间，省略时使用用户点击时的本地时间。 */
  exportedAt?: Date;
  /** 用户选择的文件格式。 */
  format: CopyTestFileExportFormat;
  /** 当前工作表实际引用且已加载到浏览器内存的图片。 */
  images: readonly CopyTestExportImageInput[];
  /** 当前选中表格的完整 workingHtml。 */
  tableHtml: string;
}

/** 导出完成后供界面提示的结果。 */
export interface CopyTestFileExportResult {
  /** 已触发下载的文件名。 */
  fileName: string;
}

/** 单元格内一张 Evidence 图片的中立表示。 */
export interface CopyTestExportCellImage {
  /** 可供 PDF、Word 或 Excel 嵌入的图片 data URL。 */
  dataUrl?: string;
  /** Confluence 附件文件名。 */
  fileName: string;
  /** 原始 Storage 声明的图片高度。 */
  height: number;
  /** Screen01 (file name) 等用户可见标签。 */
  label: string;
  /** 原始 Storage 声明的图片宽度。 */
  width: number;
}

/** 单个物理单元格的导出模型。 */
export interface CopyTestExportCell {
  /** 单元格横向覆盖的逻辑列数。 */
  colSpan: number;
  /** 单元格左上角所在的逻辑列下标。 */
  columnIndex: number;
  /** 单元格是否来自 th。 */
  header: boolean;
  /** 单元格内按 DOM 顺序解析出的 Evidence 图片。 */
  images: CopyTestExportCellImage[];
  /** 普通列、Test Result 或 Test Evidence 类型。 */
  kind: CopyTestExportCellKind;
  /** 单元格左上角所在的物理行下标。 */
  rowIndex: number;
  /** 单元格纵向覆盖的物理行数。 */
  rowSpan: number;
  /** 去除交互元素和图片节点后的可导出文本。 */
  text: string;
}

/** 单个物理表格行的导出模型。 */
export interface CopyTestExportRow {
  /** 当前物理行直接拥有的锚点单元格。 */
  cells: CopyTestExportCell[];
  /** 当前物理行下标。 */
  index: number;
}

/** PDF、Word、Excel 共用的中立表格模型。 */
export interface CopyTestExportTableModel {
  /** 合并关系展开后的最大逻辑列数。 */
  columnCount: number;
  /** 已进入当前会话缓存，但内容无法转换的图片文件名。 */
  missingImageFileNames: string[];
  /** 表格物理行数。 */
  rowCount: number;
  /** 按原始 DOM 顺序排列的物理行。 */
  rows: CopyTestExportRow[];
}
