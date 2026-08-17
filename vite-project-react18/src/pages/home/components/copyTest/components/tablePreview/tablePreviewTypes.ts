/**
 * 文件作用：声明 TablePreview 组件、iframe 消息和横向滚动交互使用的类型。
 */
import type { CopyTestImage } from '../../api/copyTestApi';
import type {
  CopyTestEvidenceDeleteTarget,
  CopyTestEvidencePreviewInfo,
  CopyTestResultStatusUpdate,
  CopyTestTableEntry,
} from '../../types';
import { PREVIEW_MESSAGE_TYPE } from './tablePreviewConstants';

/** iframe 表格预览的数据、交互状态与回调。 */
export interface CopyTestTablePreviewProps {
  /** 是否禁止行选择、Evidence 删除和 Result 状态操作。 */
  disabled?: boolean;
  /** 用于将 storage 图片映射为本地预览 URL 的内存图片。 */
  images?: CopyTestImage[];
  /** 用户删除某个 Evidence 图片实例时的回调。 */
  onEvidenceImageDelete: (target: CopyTestEvidenceDeleteTarget) => void;
  /** 用户打开 Evidence 大图预览时的回调。 */
  onEvidenceImagePreview: (previewInfo: CopyTestEvidencePreviewInfo) => void;
  /** 用户人工移动单个 Result Screen 状态时的回调。 */
  onResultStatusChange: (update: CopyTestResultStatusUpdate) => void;
  /** 已选逻辑行下标变更时的回调。 */
  onSelectedRowIndexesChange: (value: number[]) => void;
  /** 当前 working table 内容版本，用于拒绝旧 iframe 的延迟状态消息。 */
  previewRevision: number;
  /** 是否仅禁止 Result 状态链接，不影响选择和 Evidence 操作。 */
  resultStatusDisabled?: boolean;
  /** 当前 Comparison Column 的逻辑列下标。 */
  selectedColumnIndex?: number;
  /** 当前已选中的数据行下标。 */
  selectedRowIndexes: number[];
  /** 需要预览的当前工作表格。 */
  table?: CopyTestTableEntry;
}

export type PreviewFrameMessage =
  | {
    action: 'preview';
    alt: string;
    imageId: string;
    src: string;
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'delete';
    imageId: string;
    instanceId: string;
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'selection';
    checked: boolean;
    rowIndexes: number[];
    type: typeof PREVIEW_MESSAGE_TYPE;
  }
  | {
    action: 'set-result-status';
    imageId: string;
    instanceId: string;
    passed: boolean;
    previewRevision: number;
    rowIndex: number;
    sourceColumnKey: string;
    tableIndex: number;
    type: typeof PREVIEW_MESSAGE_TYPE;
  };

/** 表格横向滚动条尺寸信息。 */
export interface HorizontalScrollMetrics {
  /** iframe 表格的实际可滚动宽度。 */
  contentWidth: number;
  /** iframe 滚动容器当前的横向偏移。 */
  scrollLeft: number;
  /** 表格是否溢出并需要展示固定滚动条。 */
  visible: boolean;
  /** iframe 滚动容器的可见宽度。 */
  viewportWidth: number;
}

/** 固定横向滚动条一次拖拽的起点信息。 */
export interface HorizontalDragStart {
  /** 按下滑块时指针的水平坐标。 */
  clientX: number;
  /** 当前表格可滚动的最大水平偏移。 */
  maxScrollLeft: number;
  /** 滑块在轨道内可移动的最大像素距离。 */
  maxThumbTravel: number;
  /** 按下滑块时 iframe 的水平滚动偏移。 */
  scrollLeft: number;
}

