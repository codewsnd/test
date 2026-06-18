/**
 * 文件作用：处理 CopyTest 表格中的 Confluence 图片预览、导出清理和图片 payload。
 */
import type { CopyTestImage } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
} from './tableConstants';
import { parseHtml, toConfluenceStorageHtml } from './tableModel';
import { getCopyTestImageId } from './copyTestImageUtils';

/** CopyTest 导出给后端的 payload。 */
export interface CopyTestExportPayload {
  images: CopyTestImage[];
  storageHtml: string;
}

/** 定义 STORAGE_IMAGE_TAG_NAMES 常量。 */
const STORAGE_IMAGE_TAG_NAMES = ['ac:image', 'image', 'img'];

/** 定义 STORAGE_ATTACHMENT_TAG_NAMES 常量。 */
const STORAGE_ATTACHMENT_TAG_NAMES = ['ri:attachment', 'attachment'];

/** 定义 COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE 常量。 */
const COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE = 'data-copy-test-storage-image-src';

/** 导出时移除的 runtime 属性。 */
const COPY_TEST_RUNTIME_ATTRIBUTES = [
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE,
];

/** iframe 预览运行时属性前缀。 */
const COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX = 'data-copy-test-preview-';

/** 判断元素是否是 Confluence storage 图片元素。 */
export const isStorageImageElement = (element: Element): boolean => {
  return STORAGE_IMAGE_TAG_NAMES.includes(element.tagName.toLowerCase());
};

/** 查找图片元素里的附件元素。 */
const findStorageAttachmentElement = (imageElement: Element): Element | undefined => {
  return Array.from(imageElement.children).find(child => {
    return STORAGE_ATTACHMENT_TAG_NAMES.includes(child.tagName.toLowerCase());
  });
};

/** 读取 storage 图片文件名。 */
const getStorageImageFileName = (imageElement: Element): string => {
  const attachment = findStorageAttachmentElement(imageElement);
  return attachment?.getAttribute('ri:filename')
    || attachment?.getAttribute('filename')
    || imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE)
    || '';
};

/** 读取 storage 内引用到的附件文件名。 */
export const getConfluenceStorageTableImageFileNames = (storageHtml: string): string[] => {
  const fileNames = new Set<string>();
  parseHtml(storageHtml).querySelectorAll('*').forEach(element => {
    const fileName = isStorageImageElement(element) ? getStorageImageFileName(element) : '';
    if (fileName) {
      fileNames.add(fileName);
    }
  });
  return Array.from(fileNames);
};

/** 给已有 Confluence 图片补充本地预览所需 runtime 属性。 */
export const applyConfluenceStorageTableImages = (
  storageHtml: string,
  images: CopyTestImage[]
): string => {
  const imageMap = new Map(images.map(image => [image.fileName, image]));
  const doc = parseHtml(storageHtml);
  doc.querySelectorAll('*').forEach((element, index) => {
    if (!isStorageImageElement(element)) {
      return;
    }

    const image = imageMap.get(getStorageImageFileName(element));
    if (!image) {
      return;
    }

    const imageId = getCopyTestImageId(image);
    element.setAttribute(COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE, image.base64);
    element.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, imageId);
    element.setAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE, `${imageId}:existing:${index}`);
    element.setAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE, image.base64);
    element.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE, image.fileName);
  });
  return toConfluenceStorageHtml(doc.body.innerHTML);
};

/** 读取 runtime 图片数据。 */
const readRuntimeImage = (imageElement: Element): CopyTestImage | null => {
  const fileName = getStorageImageFileName(imageElement);
  const base64 = imageElement.getAttribute(COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE)
    || imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE)
    || '';
  return fileName && base64 ? { base64, fileName } : null;
};

/** 规范 Evidence 图片尺寸。 */
const normalizeEvidenceImageSize = (element: Element): void => {
  element.setAttribute('ac:width', String(COPY_TEST_EVIDENCE_IMAGE_WIDTH));
  element.setAttribute('ac:height', String(COPY_TEST_EVIDENCE_IMAGE_HEIGHT));
};

/** 清理导出时不应进入 Confluence 的 runtime 属性。 */
const stripRuntimeAttributes = (doc: Document): void => {
  doc.querySelectorAll('*').forEach(element => {
    COPY_TEST_RUNTIME_ATTRIBUTES.forEach(attributeName => element.removeAttribute(attributeName));
    Array.from(element.attributes)
      .filter(attribute => attribute.name.startsWith(COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX))
      .forEach(attribute => element.removeAttribute(attribute.name));
  });
};

/** 构建图片查找表。 */
const buildImageMap = (
  runtimeImages: CopyTestImage[],
  providedImages: CopyTestImage[]
): Map<string, CopyTestImage> => {
  const imageMap = new Map<string, CopyTestImage>();
  runtimeImages.forEach(image => imageMap.set(image.fileName, image));
  providedImages.forEach(image => imageMap.set(image.fileName, image));
  return imageMap;
};

/** 构建导出图片 payload。 */
const buildExportImages = (
  fileNames: string[],
  runtimeImages: CopyTestImage[],
  providedImages: CopyTestImage[]
): CopyTestImage[] => {
  const imageMap = buildImageMap(runtimeImages, providedImages);
  return fileNames.flatMap(fileName => {
    const image = imageMap.get(fileName);
    return image ? [{ base64: image.base64, fileName: image.fileName }] : [];
  });
};

/** 清理 storage HTML 并构造后端上传 payload。 */
export const buildConfluenceStorageTableExportPayload = (
  storageHtml: string,
  images: CopyTestImage[] = []
): CopyTestExportPayload => {
  const doc = parseHtml(storageHtml);
  const runtimeImages: CopyTestImage[] = [];
  doc.querySelectorAll('*').forEach(element => {
    if (!isStorageImageElement(element)) {
      return;
    }

    const runtimeImage = readRuntimeImage(element);
    if (runtimeImage) {
      runtimeImages.push(runtimeImage);
    }
    normalizeEvidenceImageSize(element);
  });
  const fileNames = getConfluenceStorageTableImageFileNames(doc.body.innerHTML);
  stripRuntimeAttributes(doc);
  return {
    images: buildExportImages(fileNames, runtimeImages, images),
    storageHtml: toConfluenceStorageHtml(doc.body.innerHTML),
  };
};
