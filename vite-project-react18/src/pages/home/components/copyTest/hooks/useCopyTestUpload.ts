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
  prepareUploadImages: (files: File[], disabled: boolean) => Promise<void>;
  preparingUpload: boolean;
  removeUploadImage: (md5: string) => void;
  resetUploadState: () => void;
  uploadImages: CopyTestMemoryImage[];
  uploadTotalSize: number;
}

/** 管理截图上传、base64 转换、MD5 去重和进度状态。 */
export const useCopyTestUpload = (): UseCopyTestUploadResult => {

  /** 定义 [uploadImages, setUploadImages] 常量。 */
  const [uploadImages, setUploadImages] = useState<CopyTestMemoryImage[]>([]);

  /** 定义 [preparingUpload, setPreparingUpload] 常量。 */
  const [preparingUpload, setPreparingUpload] = useState(false);

  /** 定义 uploadTotalSize 常量。 */
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

    /** 定义 nextImages 常量。 */
    const nextImages = mergeUploadImages(uploadImages, images);

    /** 定义 imageLimitError 常量。 */
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

    /** 定义 md5Set 常量。 */
    const md5Set = new Set(currentImages.map(image => image.md5));

    /** 定义 uniqueImages 常量。 */
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

    /** 定义 uploadError 常量。 */

    const uploadError = getUploadLimitError(files, uploadImages);
    if (uploadError) {
      message.warning(uploadError);
      return;
    }

    beginPreparingUpload();
    try {

      /** 定义 images 常量。 */
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

    /** 定义 nextImages 常量。 */
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
