/**
 * 文件作用：渲染 Evidence 图片的大图预览入口。
 */
import React from 'react';
import { Image } from 'antd';
import type { CopyTestEvidencePreviewInfo } from '../types';

/** Evidence 大图预览的展示状态与关闭回调。 */
interface EvidenceImagePreviewProps {
  /** 预览层关闭时的回调。 */
  onClose: () => void;
  /** 当前需要预览的图片，空值表示不展示。 */
  previewImage: CopyTestEvidencePreviewInfo | null;
}

/** 渲染 EvidenceImagePreview 组件。 */
export const EvidenceImagePreview: React.FC<EvidenceImagePreviewProps> = ({
  onClose,
  previewImage,
}) => {
  /** 将 Ant Design 预览层的关闭动作同步给上层。 */
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
