/**
 * 文件作用：渲染 Evidence 图片的大图预览入口。
 */
import React from 'react';
import { Image } from 'antd';
import type { CopyTestEvidencePreviewInfo } from '../types';

/** 定义 EvidenceImagePreviewProps 的数据结构。 */
interface EvidenceImagePreviewProps {
  onClose: () => void;
  previewImage: CopyTestEvidencePreviewInfo | null;
}

/** 渲染 EvidenceImagePreview 组件。 */
export const EvidenceImagePreview: React.FC<EvidenceImagePreviewProps> = ({
  onClose,
  previewImage,
}) => {

  /** 处理 handleVisibleChange 方法逻辑。 */
  const handleVisibleChange = (visible: boolean): void => {
    if (!visible) {
      onClose();
    }
  };

  if (!previewImage) {
    return null;
  }

  return (
    <div className="hidden">
      <Image
        alt={previewImage.alt || 'Screenshot preview'}
        src={previewImage.src}
        preview={{
          visible: true,
          onVisibleChange: handleVisibleChange,
        }}
      />
    </div>
  );
};
