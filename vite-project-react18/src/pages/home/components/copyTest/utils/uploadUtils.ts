/**
 * 文件作用：提供截图上传校验、转码、命名和大小格式化工具。
 */
import { v7 as uuidv7 } from 'uuid';
import { calculateFileMD5 } from '@/utils/fileUtils';
import {
  IMAGE_FILE_NAME_PATTERN,
  MAX_UPLOAD_IMAGE_COUNT,
  MAX_UPLOAD_TOTAL_BYTES,
} from '../constants';
import type { CopyTestMemoryImage } from '../types';

/** 定义 FILE_EXTENSION_PATTERN 常量。 */
const FILE_EXTENSION_PATTERN = /(\.[^./\\]+)$/;

/** 将浏览器文件读取为 base64 data url。 */
export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {

    /** 定义 reader 常量。 */
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/** 判断文件是否可以按图片处理。 */
export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') || IMAGE_FILE_NAME_PATTERN.test(file.name);
};

/** 统计一组内存图片的总容量。 */
export const getTotalImageSize = (images: Array<{ size: number }>): number => {
  return images.reduce((total, image) => total + image.size, 0);
};

/** 将字节数格式化为用户可读的容量文案。 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/** 校验原始文件列表是否符合上传入口限制。 */
export const getUploadLimitError = (
  files: File[],
  currentImages: CopyTestMemoryImage[] = []
): string | null => {
  if (files.some(file => !isImageFile(file))) {
    return 'Please upload image files only';
  }

  if (currentImages.length + files.length > MAX_UPLOAD_IMAGE_COUNT) {
    return `Please upload no more than ${MAX_UPLOAD_IMAGE_COUNT} images`;
  }

  if (getTotalImageSize(currentImages) + getRawFilesTotalSize(files) > MAX_UPLOAD_TOTAL_BYTES) {
    return 'Total image size cannot exceed 10 MB';
  }

  return null;
};

/** 统计原始浏览器文件列表的总容量。 */
export const getRawFilesTotalSize = (files: File[]): number => {
  return files.reduce((total, file) => total + file.size, 0);
};

/** 校验内存图片数量和总容量限制。 */
export const getImageLimitError = (images: Array<{ size: number }>): string | null => {
  if (images.length > MAX_UPLOAD_IMAGE_COUNT) {
    return `Please upload no more than ${MAX_UPLOAD_IMAGE_COUNT} images`;
  }

  if (getTotalImageSize(images) > MAX_UPLOAD_TOTAL_BYTES) {
    return 'Total image size cannot exceed 10 MB';
  }

  return null;
};

/** 处理 buildUuidFileName 辅助逻辑。 */
const buildUuidFileName = (fileName: string): string => {

  /** 定义 uuid 常量。 */
  const uuid = uuidv7();

  /** 定义 extension 常量。 */
  const extension = fileName.match(FILE_EXTENSION_PATTERN)?.[1] || '';

  /** 定义 baseName 常量。 */
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  return `${baseName}-${uuid}${extension}`;
};

/** 将单个文件转换为内存图片对象。 */
export const fileToMemoryImage = async (file: File): Promise<CopyTestMemoryImage> => {

  /** 定义 [md5, base64] 常量。 */
  const [md5, base64] = await Promise.all([
    calculateFileMD5(file),
    readFileAsBase64(file),
  ]);
  return {
    fileName: buildUuidFileName(file.name),
    base64,
    md5,
    size: file.size,
  };
};

/** 将唯一图片加入结果集合。 */
export const appendUniqueImage = (
  images: CopyTestMemoryImage[],
  md5Set: Set<string>,
  image: CopyTestMemoryImage
): void => {
  if (md5Set.has(image.md5)) {
    return;
  }

  images.push(image);
  md5Set.add(image.md5);
};

/** 将文件批量转换为只保存在内存中的图片数据。 */
export const filesToMemoryImages = async (files: File[]): Promise<CopyTestMemoryImage[]> => {

  /** 定义 images 常量。 */
  const images: CopyTestMemoryImage[] = [];

  /** 定义 md5Set 常量。 */
  const md5Set = new Set<string>();

  for (const file of files) {

    /** 定义 image 常量。 */
    const image = await fileToMemoryImage(file);
    appendUniqueImage(images, md5Set, image);
  }

  return images;
};
