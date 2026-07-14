/**
 * 文件作用：提供 CopyTest 图片稳定 ID 的生成逻辑。
 */
import type { CopyTestImage } from '../api/copyTestApi';

/** 使用附件文件名作为 CopyTest 图片的唯一稳定 ID。 */
export const getCopyTestImageId = (image: CopyTestImage): string => {
  return image.fileName;
};
