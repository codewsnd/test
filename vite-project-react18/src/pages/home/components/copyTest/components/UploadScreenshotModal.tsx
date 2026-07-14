/**
 * 文件作用：渲染截图上传弹窗、截图列表和 Validate 操作入口。
 */
import React, { useRef } from 'react';
import { Button, Modal, Space, Typography } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { MAX_UPLOAD_IMAGE_COUNT, MAX_UPLOAD_TOTAL_LABEL } from '../constants';
import type { CopyTestMemoryImage } from '../types';
import { formatFileSize } from '../utils/uploadUtils';

/** Ant Design 文本组件的局部别名。 */
const { Text } = Typography;

/** 截图缩略图尺寸。 */
const IMAGE_PREVIEW_SIZE = 64;

/** 截图辅助信息使用的 Ant Design 文本类型。 */
const TEXT_TYPE_SECONDARY = 'secondary';

/** 上传截图弹窗组件的入参。 */
interface UploadScreenshotModalProps {
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

/** 单张上传截图行的入参。 */
interface UploadImageRowProps {
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

/** 渲染单张截图预览行。 */
const UploadImageRow: React.FC<UploadImageRowProps> = ({
  image,
  onRemoveImage,
}) => {
  return (
    <div className="flex items-center gap-3 rounded border border-gray-200 px-3 py-2">
      <img
        alt={image.fileName}
        src={image.base64}
        className="shrink-0 rounded border border-gray-200 object-cover"
        style={{
          width: IMAGE_PREVIEW_SIZE,
          height: IMAGE_PREVIEW_SIZE,
        }}
      />
      <div className="min-w-0 flex-1">
        <Text className="block truncate">{image.fileName}</Text>
        <Text type={TEXT_TYPE_SECONDARY}>{formatFileSize(image.size)}</Text>
      </div>
      <Button
        aria-label={`Delete ${image.fileName}`}
        icon={<DeleteOutlined />}
        onClick={() => onRemoveImage(image.md5)}
      />
    </div>
  );
};

/** 渲染已上传截图列表。 */
const UploadImageList: React.FC<Pick<
  UploadScreenshotModalProps,
  'onRemoveImage' | 'uploadImages'
>> = ({
  onRemoveImage,
  uploadImages,
}) => {
  if (uploadImages.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-center">
        <Text type={TEXT_TYPE_SECONDARY}>No screenshots selected</Text>
      </div>
    );
  }

  return (
    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
      {uploadImages.map(image => (
        <UploadImageRow
          key={image.md5}
          image={image}
          onRemoveImage={onRemoveImage}
        />
      ))}
    </div>
  );
};

/** 渲染上传截图并触发校验的弹窗。 */
export const UploadScreenshotModal: React.FC<UploadScreenshotModalProps> = ({
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
      open={open}
      onCancel={onClose}
      width={760}
      footer={[
        <Button key="close" onClick={onClose} disabled={preparingUpload || processing}>
          Close
        </Button>,
        <Button
          key="validate"
          type="primary"
          disabled={!canValidate}
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
          icon={<UploadOutlined />}
          loading={preparingUpload}
          onClick={handleChooseImages}
        >
          Select screenshots
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        <UploadImageList uploadImages={uploadImages} onRemoveImage={onRemoveImage} />
      </Space>
    </Modal>
  );
};

export default UploadScreenshotModal;
