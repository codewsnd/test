/**
 * 文件作用：提供 CopyTest 图片稳定 ID 的生成逻辑。
 */
import type { CopyTestImage } from '../api/copyTestApi';

/** 获取 CopyTest 图片稳定 ID。 */
export const getCopyTestImageId = (image: CopyTestImage): string => {
  return image.md5 || image.fileName;
};
