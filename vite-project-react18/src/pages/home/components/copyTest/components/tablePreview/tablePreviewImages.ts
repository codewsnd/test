/**
 * 文件作用：管理 TablePreview 内存图片到 Blob URL 的稳定映射和生命周期输入。
 */
import { useRef } from 'react';
import type { CopyTestImage } from '../../api/copyTestApi';
import { getCopyTestImageId } from '../../table/copyTestImageUtils';
import {
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
} from '../../table/tableConstants';

/** iframe 图片预览 URL 缓存。 */
interface PreviewImageUrlBundle {
  /** 组件卸载或缓存更新时需要释放的 Blob URL。 */
  urls: string[];
  /** 按稳定图片 ID 索引的预览 URL。 */
  urlsByImageId: Record<string, string>;
}

/** 未提供内存图片时复用稳定空数组，避免无关重渲染重建 URL。 */
export const EMPTY_PREVIEW_IMAGES: CopyTestImage[] = [];

export const createObjectUrlFromDataUrl = (dataUrl: string): string | null => {
  /** data URL 中的 MIME 类型和 base64 内容。 */
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  /** 从 base64 解码得到的二进制字符串。 */
  const binary = window.atob(match[2]);
  /** 用于构造 Blob 的字节数组。 */
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: match[1] }));
};

/** 读取当前 storage 图片的稳定实例标识。 */
export const getPreviewImageKey = (element: Element): string => {
  return element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '';
};

/** 判断两批预览图片的文件身份与内容是否完全一致。 */
const arePreviewImagesEqual = (
  left: CopyTestImage[],
  right: CopyTestImage[]
): boolean => {
  return left.length === right.length && left.every((image, index) => {
    const otherImage = right[index];
    return image.fileName === otherImage.fileName
      && image.base64 === otherImage.base64;
  });
};

/** 跨 working table 状态更新复用内容未变化的图片数组。 */
export const useStablePreviewImages = (images: CopyTestImage[]): CopyTestImage[] => {
  /** 最近一批内容不同的预览图片。 */
  const stableImagesRef = useRef(images);
  if (!arePreviewImagesEqual(stableImagesRef.current, images)) {
    stableImagesRef.current = images;
  }
  return stableImagesRef.current;
};

/** 为内存图片生成轻量 Blob URL，避免 base64 进入 srcdoc。 */
export const createPreviewImageUrlBundle = (images: CopyTestImage[]): PreviewImageUrlBundle => {
  /** 生命周期结束时需要释放的 Blob URL。 */
  const urls: string[] = [];
  /** 同一内存图片只创建一次 Blob URL 的 ID 索引。 */
  const urlsByImageId = Object.create(null) as Record<string, string>;
  images.forEach(image => {
    /** 当前内存图片的稳定 ID。 */
    const imageId = getCopyTestImageId(image);
    if (urlsByImageId[imageId]) {
      return;
    }
    /** 供 iframe 加载的轻量 Blob URL。 */
    const objectUrl = createObjectUrlFromDataUrl(image.base64);
    if (objectUrl) {
      urls.push(objectUrl);
      urlsByImageId[imageId] = objectUrl;
    }
  });
  return { urls, urlsByImageId };
};

/** 将当前 storage 中的图片实例映射到已稳定复用的 Blob URL。 */
export const mapPreviewImageUrlsByKey = (
  tableHtml: string,
  urlsByImageId: Record<string, string>
): Record<string, string> => {
  /** 仅用于扫描 storage 图片标记的脱离 DOM 文档。 */
  const doc = document.implementation.createHTMLDocument('copy-test-preview-images');
  /** 按图片实例标识索引的 Blob URL。 */
  const urlsByKey = Object.create(null) as Record<string, string>;
  doc.body.innerHTML = tableHtml;
  doc.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`).forEach(element => {
    /** storage 图片节点关联的内存图片 ID。 */
    const imageId = element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
    /** 当前 storage 图片节点的唯一实例 ID。 */
    const instanceId = getPreviewImageKey(element);
    /** 当前 storage 图片可用的 Blob URL。 */
    const objectUrl = urlsByImageId[imageId];
    if (!instanceId || !objectUrl) {
      return;
    }
    urlsByKey[instanceId] = objectUrl;
  });
  return urlsByKey;
};

/** 读取当前列单元格是否有可校验内容。 */

