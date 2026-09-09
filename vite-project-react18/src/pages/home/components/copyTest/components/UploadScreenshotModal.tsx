/**
 * 文件作用：渲染截图上传弹窗、截图列表和 Validate 操作入口。
 */
import React, { useRef } from 'react';
import { Button, Image, Modal, Space, Typography } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { MAX_UPLOAD_IMAGE_COUNT, MAX_UPLOAD_TOTAL_LABEL } from '../constants';
import type { CopyTestMemoryImage } from '../types';
import { formatFileSize, isImageFile } from '../utils/uploadUtils';
import { CopyTestDisplayConfiguration } from './CopyTestDisplayConfiguration';
import type { CopyTestDisplayConfiguration as DisplayConfiguration } from '../types';

/** Ant Design 文本组件的局部别名。 */
const { Text } = Typography;

/** 截图缩略图尺寸。 */
const IMAGE_PREVIEW_HEIGHT = 75;

/** 截图辅助信息使用的 Ant Design 文本类型。 */
const TEXT_TYPE_SECONDARY = 'secondary';

/** 上传截图弹窗组件的入参。 */
interface UploadScreenshotModalProps {
  displayConfiguration: DisplayConfiguration;
  onDisplayConfigurationChange: (value: DisplayConfiguration) => void;
  /** 当前截图集合是否满足校验前置条件。 */
  canValidate: boolean;
  /** 关闭上传弹窗的回调。 */
  onClose: () => void;
  /** 用户选择截图后的异步处理回调。 */
  onFilesSelected: (files: File[]) => Promise<void>;
  /** 按照内存图片 MD5 删除截图的回调。 */
  onRemoveImage: (md5: string) => void;
  /** 使用当前截图开始校验的回调。 */
  onValidate: () => void;
  /** 是否显示上传弹窗。 */
  open: boolean;
  /** 是否正在读取和预处理本地截图。 */
  preparingUpload: boolean;
  /** 是否正在执行校验。 */
  processing: boolean;
  /** 当前已读入内存的截图列表。 */
  uploadImages: CopyTestMemoryImage[];
  /** 当前截图的原始字节总数。 */
  uploadTotalSize: number;
}

/** 单张上传截图卡片的入参。 */
interface UploadImageCardProps {
  /** 当前截图列表交互是否被异步任务锁定。 */
  disabled: boolean;
  /** 需要展示的内存截图。 */
  image: CopyTestMemoryImage;
  /** 按照内存图片 MD5 删除截图的回调。 */
  onRemoveImage: (md5: string) => void;
}

/** 渲染截图数量和大小限制摘要。 */
const UploadLimitSummary: React.FC<Pick<
  UploadScreenshotModalProps,
  'uploadImages' | 'uploadTotalSize'
>> = ({
  uploadImages,
  uploadTotalSize,
}) => {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
      <Text type={TEXT_TYPE_SECONDARY}>
        Images: {uploadImages.length} / {MAX_UPLOAD_IMAGE_COUNT}
      </Text>
      <Text type={TEXT_TYPE_SECONDARY}>
        Total size: {formatFileSize(uploadTotalSize)} / {MAX_UPLOAD_TOTAL_LABEL}
      </Text>
    </div>
  );
};

/** 渲染支持放大预览的截图卡片。 */
const UploadImageCard: React.FC<UploadImageCardProps> = ({
  disabled,
  image,
  onRemoveImage,
}) => {
  /** 上传列表展示原始文件名，内部 AI/附件标识保持 ASCII-safe。 */
  const displayName = image.originalFileName || image.fileName;
  return (
    <div className="min-w-0 rounded border border-gray-200 p-1">
      <Image
        alt={displayName}
        src={image.base64}
        width="100%"
        height={IMAGE_PREVIEW_HEIGHT}
        className="rounded bg-gray-50 object-contain"
      />
      <Text className="mt-1 block truncate text-xs" title={displayName}>{displayName}</Text>
      <div className="mt-1 flex min-w-0 flex-col items-center gap-1">
        <Text className="block w-full truncate text-xs" type={TEXT_TYPE_SECONDARY} title={formatFileSize(image.size)}>
          {formatFileSize(image.size)}
        </Text>
        <Button
          size="small"
          aria-label={`Delete ${displayName}`}
          disabled={disabled}
          icon={<DeleteOutlined />}
          onClick={() => onRemoveImage(image.md5)}
        />
      </div>
    </div>
  );
};

/** 渲染已上传截图列表。 */
const UploadImageList: React.FC<Pick<
  UploadScreenshotModalProps,
  'onRemoveImage' | 'preparingUpload' | 'processing' | 'uploadImages'
>> = ({
  onRemoveImage,
  preparingUpload,
  processing,
  uploadImages,
}) => {
  /** 文件准备或校验期间统一锁定截图列表操作。 */
  const disabled = preparingUpload || processing;

  if (uploadImages.length === 0) {
    return null;
  }

  return (
    <Image.PreviewGroup>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
      >
        {uploadImages.map(image => (
          <UploadImageCard
            key={image.md5}
            disabled={disabled}
            image={image}
            onRemoveImage={onRemoveImage}
          />
        ))}
      </div>
    </Image.PreviewGroup>
  );
};

/** 优先读取剪贴板文件列表，兼容仅通过 items 提供图片的浏览器。 */
const getClipboardImages = (clipboardData: DataTransfer): File[] => {
  const files = Array.from(clipboardData.files);
  if (files.length > 0) {
    return files.filter(isImageFile);
  }
  return Array.from(clipboardData.items)
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null && isImageFile(file));
};

/** 空列表和已有图片时均支持拖入或粘贴图片，统一交给现有上传校验处理。 */
const ScreenshotDropZone: React.FC<{
  children: React.ReactNode;
  disabled: boolean;
  empty: boolean;
  onFilesSelected: UploadScreenshotModalProps['onFilesSelected'];
}> = ({ children, disabled, empty, onFilesSelected }) => {
  const handleDragOver = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    if (disabled || files.length === 0) {
      return;
    }
    await onFilesSelected(files);
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLElement>): Promise<void> => {
    if (disabled) {
      return;
    }
    const files = getClipboardImages(event.clipboardData);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    await onFilesSelected(files);
  };

  return (
    <section
      aria-label="Screenshot drop area"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className="rounded border border-dashed border-gray-300 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <div
        className={`flex w-full items-center justify-center gap-2 text-gray-500 ${disabled ? 'opacity-50' : ''} ${empty ? 'py-10' : 'mb-2 py-2.5'}`}
      >
        <UploadOutlined />
        <span>{empty ? 'Drop or paste screenshots here' : 'Drop or paste more screenshots here'}</span>
      </div>
      {children}
    </section>
  );
};

/** 渲染上传截图并触发校验的弹窗。 */
export const UploadScreenshotModal: React.FC<UploadScreenshotModalProps> = ({
  displayConfiguration,
  onDisplayConfigurationChange,
  canValidate,
  onClose,
  onFilesSelected,
  onRemoveImage,
  onValidate,
  open,
  preparingUpload,
  processing,
  uploadImages,
  uploadTotalSize,
}) => {
  /** 隐藏文件输入框的 DOM 引用。 */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 文件准备或校验期间统一锁定上传弹窗交互。 */
  const uploadInteractionDisabled = preparingUpload || processing;

  /** 打开系统文件选择器。 */
  const handleChooseImages = (): void => {
    fileInputRef.current?.click();
  };

  /** 接收用户选择的图片文件。 */
  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    /** 从 FileList 复制出的可稳定传递文件数组。 */
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await onFilesSelected(files);
  };

  return (
    <Modal
      title="Upload Screenshot"
      centered
      open={open}
      onCancel={onClose}
      width={950}
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' } }}
      footer={[
        <Button key="close" onClick={onClose} disabled={preparingUpload || processing}>
          Close
        </Button>,
        <Button
          key="validate"
          type="primary"
          disabled={!canValidate || uploadInteractionDisabled}
          loading={processing}
          onClick={onValidate}
        >
          Validate
        </Button>,
      ]}
    >
      <Space direction="vertical" size="middle" className="w-full">
        <UploadLimitSummary uploadImages={uploadImages} uploadTotalSize={uploadTotalSize} />
        <Button
          disabled={uploadInteractionDisabled}
          icon={<UploadOutlined />}
          loading={preparingUpload}
          onClick={handleChooseImages}
        >
          Select screenshots
        </Button>
        <CopyTestDisplayConfiguration
          disabled={uploadInteractionDisabled}
          value={displayConfiguration}
          onChange={onDisplayConfigurationChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={uploadInteractionDisabled}
          className="hidden"
          onChange={handleFilesSelected}
        />
        <ScreenshotDropZone
          disabled={!open || uploadInteractionDisabled}
          empty={uploadImages.length === 0}
          onFilesSelected={onFilesSelected}
        >
          <UploadImageList
            onRemoveImage={onRemoveImage}
            preparingUpload={preparingUpload}
            processing={processing}
            uploadImages={uploadImages}
          />
        </ScreenshotDropZone>
      </Space>
    </Modal>
  );
};

export default UploadScreenshotModal;
