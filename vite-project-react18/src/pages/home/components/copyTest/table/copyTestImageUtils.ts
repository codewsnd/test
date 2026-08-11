/**
 * 文件作用：提供 CopyTest 图片稳定 ID 的生成逻辑。
 */
import type { CopyTestImage } from '../api/copyTestApi';

/** 使用附件文件名作为 CopyTest 图片的唯一稳定 ID。 */
export const getCopyTestImageId = (image: CopyTestImage): string => {
  return image.fileName;
};

/** 读取用户可识别的图片文件名，无原始名时回退到附件名。 */
export const getCopyTestImageDisplayFileName = (image: CopyTestImage): string => {
  return image.originalFileName?.trim() ? image.originalFileName : image.fileName;
};

/** 去掉路径和最后一段扩展名，保留用户真实文件名主体。 */
export const getCopyTestImageDisplayName = (image: CopyTestImage): string => {
  /** 防御性去掉可能来自外部数据的目录部分。 */
  const fileName = getCopyTestImageDisplayFileName(image).split(/[\\/]/).pop() || '';
  /** 最后一个点号才表示扩展名；`.name` 类隐藏文件保留原名。 */
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return fileName;
  }
  return fileName.slice(0, extensionIndex);
};
