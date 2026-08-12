/**
 * 文件作用：提供 CopyTest 图片稳定 ID 的生成逻辑。
 */
import type { CopyTestImage } from '../api/copyTestApi';

/** 旧版可见标签中包裹文件名的 Screen 序号格式。 */
const LEGACY_SCREEN_NAME_PATTERN = /^Screen\d+\s*\((.+)\)$/i;

/** 旧版仅包含 Screen 序号、没有文件名的可见标签格式。 */
const LEGACY_SCREEN_ONLY_PATTERN = /^Screen\d+$/i;

/** 旧附件名末尾由系统追加的 UUIDv7。 */
const LEGACY_ATTACHMENT_UUID_SUFFIX_PATTERN =
  /^(.*)-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 历史 Storage 中恢复图片展示名称所需的信息。 */
export interface CopyTestStoredImageNameInput {
  /** ri:attachment 保存的内部附件名。 */
  attachmentFileName: string;
  /** Evidence metadata 保存的原始文件名。 */
  displayFileName?: string | null;
  /** Evidence 卡片中当前可见的旧标签。 */
  existingLabel?: string | null;
}

/** 使用附件文件名作为 CopyTest 图片的唯一稳定 ID。 */
export const getCopyTestImageId = (image: CopyTestImage): string => {
  return image.fileName;
};

/** 读取用户可识别的图片文件名，无原始名时回退到附件名。 */
export const getCopyTestImageDisplayFileName = (image: CopyTestImage): string => {
  return image.originalFileName?.trim() ? image.originalFileName : image.fileName;
};

/** 去掉路径和最后一段扩展名，保留文件名主体。 */
export const getCopyTestFileNameStem = (value: string): string => {
  /** 防御性去掉可能来自外部数据的目录部分。 */
  const fileName = value.trim().split(/[\\/]/).pop() || '';
  /** 最后一个点号才表示扩展名；`.name` 类隐藏文件保留原名。 */
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === fileName.length - 1) {
    return fileName;
  }
  return fileName.slice(0, extensionIndex);
};

/** 去掉路径和最后一段扩展名，保留用户真实文件名主体。 */
export const getCopyTestImageDisplayName = (image: CopyTestImage): string => {
  return getCopyTestFileNameStem(getCopyTestImageDisplayFileName(image));
};

/** 从旧 Screen 标签中读取已经展示过的文件名主体。 */
const getLegacyLabelName = (existingLabel?: string | null): string => {
  /** 去除旧标签首尾空白后的稳定文本。 */
  const label = existingLabel?.trim() || '';
  /** ScreenNN (name) 中已经不含扩展名的历史展示名称。 */
  const wrappedName = LEGACY_SCREEN_NAME_PATTERN.exec(label)?.[1]?.trim();
  if (wrappedName) {
    return wrappedName;
  }
  return label && !LEGACY_SCREEN_ONLY_PATTERN.test(label) ? label : '';
};

/** 从原名-UUID 格式的旧附件名中恢复原始文件名主体。 */
const getLegacyAttachmentName = (attachmentFileName: string): string => {
  /** 已去掉路径和扩展名的旧附件名主体。 */
  const attachmentStem = getCopyTestFileNameStem(attachmentFileName);
  /** 仅剥离严格位于末尾的 UUIDv7，避免误改普通文件名。 */
  const originalStem = LEGACY_ATTACHMENT_UUID_SUFFIX_PATTERN.exec(attachmentStem)?.[1]?.trim();
  return originalStem || attachmentStem;
};

/** 按 metadata、旧标签和附件名顺序恢复历史图片的展示名称。 */
export const getCopyTestStoredImageDisplayName = ({
  attachmentFileName,
  displayFileName,
  existingLabel,
}: CopyTestStoredImageNameInput): string => {
  /** 当前 metadata 中可能保存的完整原始文件名。 */
  const storedDisplayFileName = displayFileName?.trim() || '';
  if (storedDisplayFileName && storedDisplayFileName !== attachmentFileName.trim()) {
    return getCopyTestFileNameStem(storedDisplayFileName);
  }

  /** 已经写入历史卡片的文件名可在 metadata 被清理后继续恢复。 */
  const legacyLabelName = getLegacyLabelName(existingLabel);
  return legacyLabelName || getLegacyAttachmentName(attachmentFileName);
};
