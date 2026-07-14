/**
 * 文件作用：封装截图上传、校验和本地图片状态。
 */
import { useMemo, useState } from 'react';
import { message } from 'antd';
import type { CopyTestMemoryImage } from '../types';
import {
  filesToMemoryImages,
  getImageLimitError,
  getTotalImageSize,
  getUploadLimitError,
} from '../utils/uploadUtils';

/** copyTest 上传状态 hook 的返回值。 */
export interface UseCopyTestUploadResult {
  /** 校验并转换用户新选择的截图文件。 */
  prepareUploadImages: (files: File[], disabled: boolean) => Promise<void>;
  /** 文件读取和摘要计算是否正在进行。 */
  preparingUpload: boolean;
  /** 按 MD5 从本次上传列表删除一张图片。 */
  removeUploadImage: (md5: string) => void;
  /** 清空本次上传列表和准备状态。 */
  resetUploadState: () => void;
  /** 已完成 base64 与 MD5 准备的图片列表。 */
  uploadImages: CopyTestMemoryImage[];
  /** 当前上传列表的总字节数。 */
  uploadTotalSize: number;
}

/** 管理截图上传、base64 转换、MD5 去重和进度状态。 */
export const useCopyTestUpload = (): UseCopyTestUploadResult => {

  /** 当前上传图片及其状态更新函数。 */
  const [uploadImages, setUploadImages] = useState<CopyTestMemoryImage[]>([]);

  /** 文件准备状态及其更新函数。 */
  const [preparingUpload, setPreparingUpload] = useState(false);

  /** 当前上传图片的总字节数。 */
  const uploadTotalSize = useMemo(() => getTotalImageSize(uploadImages), [uploadImages]);

  /** 重置所有截图上传状态。 */
  const resetUploadState = (): void => {
    setUploadImages([]);
    setPreparingUpload(false);
  };

  /** 进入截图准备状态。 */
  const beginPreparingUpload = (): void => {
    setPreparingUpload(true);
  };

  /** 应用准备完成的内存图片。 */
  const applyPreparedImages = (images: CopyTestMemoryImage[]): void => {
    /** 与现有列表按 MD5 合并后的图片集合。 */
    const nextImages = mergeUploadImages(uploadImages, images);

    /** 合并后的图片数量或总大小错误。 */
    const imageLimitError = getImageLimitError(nextImages);
    if (imageLimitError) {
      message.warning(imageLimitError);
      return;
    }

    setUploadImages(nextImages);
  };

  /** 按 MD5 合并内存图片并过滤重复文件。 */
  const mergeUploadImages = (
    currentImages: CopyTestMemoryImage[],
    nextImages: CopyTestMemoryImage[]
  ): CopyTestMemoryImage[] => {

    /** 已加入结果集合的图片摘要。 */
    const md5Set = new Set(currentImages.map(image => image.md5));

    /** 保持首次出现顺序的去重图片结果。 */
    const uniqueImages = [...currentImages];
    nextImages.forEach(image => {
      if (!md5Set.has(image.md5)) {
        uniqueImages.push(image);
        md5Set.add(image.md5);
      }
    });
    return uniqueImages;
  };

  /** 处理截图准备失败。 */
  const handlePrepareError = (error: unknown): void => {
    console.error('Failed to prepare images:', error);
    message.error('Failed to prepare images');
  };

  /** 将用户选择的图片准备为内存态 base64 数据。 */
  const prepareUploadImages = async (files: File[], disabled: boolean): Promise<void> => {
    if (disabled || files.length === 0) {
      return;
    }

    /** 新旧文件合并前即可判定的上传限制错误。 */
    const uploadError = getUploadLimitError(files, uploadImages);
    if (uploadError) {
      message.warning(uploadError);
      return;
    }

    beginPreparingUpload();
    try {
      /** 完成 base64、MD5 和大小计算的新图片。 */
      const images = await filesToMemoryImages(files);
      applyPreparedImages(images);
    } catch (error) {
      handlePrepareError(error);
    } finally {
      setPreparingUpload(false);
    }
  };

  /** 删除弹窗中的单张截图。 */
  const removeUploadImage = (md5: string): void => {
    /** 排除指定摘要后的上传列表。 */
    const nextImages = uploadImages.filter(image => image.md5 !== md5);
    setUploadImages(nextImages);
  };

  return {
    prepareUploadImages,
    preparingUpload,
    removeUploadImage,
    resetUploadState,
    uploadImages,
    uploadTotalSize,
  };
};
