/**
 * 文件作用：安全地把浏览器图片统一为三种导出文件都能嵌入的格式。
 */
import type { CopyTestExportImageInput } from './copyTestExportTypes';

/** base64 图片 data URL 的严格格式。 */
const COPY_TEST_EXPORT_IMAGE_DATA_URL_PATTERN = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i;

/** PNG data URL 使用的 MIME 子类型。 */
const COPY_TEST_EXPORT_PNG_MIME_SUBTYPE = 'png';

/** JPEG data URL 允许使用的 MIME 子类型。 */
const COPY_TEST_EXPORT_JPEG_MIME_SUBTYPES = new Set(['jpeg', 'jpg']);

/** PNG 文件必须具有的八字节签名。 */
const COPY_TEST_EXPORT_PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** 单张源图片允许的最大边长，避免异常尺寸消耗过多解码内存。 */
const COPY_TEST_EXPORT_SOURCE_IMAGE_MAX_DIMENSION = 8_192;

/** 单张源图片允许的最大像素数。 */
const COPY_TEST_EXPORT_SOURCE_IMAGE_MAX_PIXELS = 20_000_000;

/** 非通用图片转为 PNG 后允许的最大边长。 */
const COPY_TEST_EXPORT_NORMALIZED_IMAGE_MAX_DIMENSION = 2_048;

/** 非通用图片转为 PNG 后允许的最大像素数。 */
const COPY_TEST_EXPORT_NORMALIZED_IMAGE_MAX_PIXELS = 4_000_000;

/** 单张源图片或转码图片允许的最大二进制字节数。 */
const COPY_TEST_EXPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** 一次导出保存在内存中的全部规范图片最大字节数。 */
const COPY_TEST_EXPORT_TOTAL_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** 图片校验或格式转换失败时使用的错误信息。 */
const COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR = 'Unable to prepare export image';

/** 解析完成的一张 base64 图片。 */
interface CopyTestParsedExportImage {
  /** 图片解码后的原始二进制。 */
  bytes: Uint8Array;
  /** data URL 中声明的小写 MIME 子类型。 */
  mimeSubtype: string;
}

/** 计算一段规范 base64 内容对应的二进制字节数。 */
const getBase64ByteLength = (base64: string): number => {
  /** base64 末尾用于对齐的填充字符数量。 */
  const padding = base64.endsWith('==') ? 2 : Number(base64.endsWith('='));
  return Math.floor(base64.length * 3 / 4) - padding;
};

/** 严格解码 data URL，并在分配二进制前限制压缩内容大小。 */
const parseCopyTestExportImage = (dataUrl: string): CopyTestParsedExportImage => {
  /** data URL 中的 MIME 子类型和 base64 内容。 */
  const match = COPY_TEST_EXPORT_IMAGE_DATA_URL_PATTERN.exec(dataUrl);
  if (!match || match[2].length % 4 === 1) {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
  /** 图片 base64 内容的预计二进制大小。 */
  const byteLength = getBase64ByteLength(match[2]);
  if (byteLength <= 0 || byteLength > COPY_TEST_EXPORT_IMAGE_MAX_BYTES) {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
  try {
    /** 浏览器严格解码后的二进制字符串。 */
    const binary = globalThis.atob(match[2]);
    return {
      bytes: Uint8Array.from(binary, character => character.charCodeAt(0)),
      mimeSubtype: match[1].toLowerCase(),
    };
  } catch {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
};

/** 判断二进制是否以给定文件签名开头。 */
const hasCopyTestImageSignature = (
  bytes: Uint8Array,
  signature: readonly number[]
): boolean => {
  return bytes.length >= signature.length
    && signature.every((value, index) => bytes[index] === value);
};

/** 判断二进制是否具有完整 JPEG 首尾签名。 */
const hasCopyTestJpegSignature = (bytes: Uint8Array): boolean => {
  return bytes.length >= 5
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff
    && bytes[bytes.length - 1] === 0xd9;
};

/** 判断图片是否为三种文件格式都能直接嵌入的有效签名类型。 */
const isCopyTestNativeExportImage = (
  image: CopyTestParsedExportImage
): boolean => {
  if (image.mimeSubtype === COPY_TEST_EXPORT_PNG_MIME_SUBTYPE) {
    return hasCopyTestImageSignature(image.bytes, COPY_TEST_EXPORT_PNG_SIGNATURE);
  }
  if (COPY_TEST_EXPORT_JPEG_MIME_SUBTYPES.has(image.mimeSubtype)) {
    return hasCopyTestJpegSignature(image.bytes);
  }
  return false;
};

/** 等待浏览器完整解码一张 data URL 图片。 */
const loadCopyTestExportImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    /** 用于验证和转换上传图片的浏览器图片元素。 */
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR));
    };
    image.src = dataUrl;
  });
};

/** 读取并限制浏览器成功解码后的正整数图片尺寸。 */
const getCopyTestExportImageSize = (
  image: HTMLImageElement
): { height: number; width: number } => {
  /** 解码后优先使用的图片原始宽度。 */
  const width = image.naturalWidth || image.width;
  /** 解码后优先使用的图片原始高度。 */
  const height = image.naturalHeight || image.height;
  /** 当前图片解码后的总像素数。 */
  const pixelCount = width * height;
  if (
    width <= 0
    || height <= 0
    || width > COPY_TEST_EXPORT_SOURCE_IMAGE_MAX_DIMENSION
    || height > COPY_TEST_EXPORT_SOURCE_IMAGE_MAX_DIMENSION
    || pixelCount > COPY_TEST_EXPORT_SOURCE_IMAGE_MAX_PIXELS
  ) {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
  return { height, width };
};

/** 计算非通用图片转为 PNG 时使用的安全画布尺寸。 */
const getCopyTestNormalizedImageSize = (
  sourceSize: { height: number; width: number }
): { height: number; width: number } => {
  /** 同时满足最大边长和最大像素数的等比缩放比例。 */
  const scale = Math.min(
    1,
    COPY_TEST_EXPORT_NORMALIZED_IMAGE_MAX_DIMENSION / sourceSize.width,
    COPY_TEST_EXPORT_NORMALIZED_IMAGE_MAX_DIMENSION / sourceSize.height,
    Math.sqrt(
      COPY_TEST_EXPORT_NORMALIZED_IMAGE_MAX_PIXELS
        / (sourceSize.width * sourceSize.height)
    )
  );
  return {
    height: Math.max(1, Math.floor(sourceSize.height * scale)),
    width: Math.max(1, Math.floor(sourceSize.width * scale)),
  };
};

/** 异步把 Canvas 编码为 PNG Blob，避免同步 toDataURL 长时间阻塞主线程。 */
const createCopyTestExportPngBlob = (
  canvas: HTMLCanvasElement
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob || blob.size <= 0 || blob.size > COPY_TEST_EXPORT_IMAGE_MAX_BYTES) {
        reject(new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

/** 将 PNG Blob 异步转换为三种导出器共用的 data URL。 */
const readCopyTestExportBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    /** 负责生成 base64 data URL 的浏览器文件读取器。 */
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR));
    };
    reader.onerror = () => {
      reject(new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR));
    };
    reader.readAsDataURL(blob);
  });
};

/** 使用浏览器 Canvas 转换一张已经通过 data URL 校验的图片。 */
const convertValidatedCopyTestExportImageToPng = async (
  dataUrl: string
): Promise<string> => {
  /** 浏览器已经解码完成的源图片。 */
  const image = await loadCopyTestExportImage(dataUrl);
  /** 源图片在安全限制内的原始尺寸。 */
  const sourceSize = getCopyTestExportImageSize(image);
  /** 最终 PNG 使用的等比缩放画布尺寸。 */
  const normalizedSize = getCopyTestNormalizedImageSize(sourceSize);
  /** 把非通用图片重新编码为 PNG 的离屏画布。 */
  const canvas = document.createElement('canvas');
  canvas.width = normalizedSize.width;
  canvas.height = normalizedSize.height;
  /** 用于绘制源图片的二维画布上下文。 */
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
  context.drawImage(image, 0, 0, normalizedSize.width, normalizedSize.height);
  /** 由浏览器异步编码完成且大小受限的 PNG Blob。 */
  const pngBlob = await createCopyTestExportPngBlob(canvas);
  return readCopyTestExportBlobAsDataUrl(pngBlob);
};

/** 使用浏览器 Canvas 将一张可解码图片转换为受限尺寸的 PNG data URL。 */
export const convertCopyTestExportImageToPng = async (
  dataUrl: string
): Promise<string> => {
  parseCopyTestExportImage(dataUrl);
  return convertValidatedCopyTestExportImageToPng(dataUrl);
};

/** 规范一张图片；校验或转换失败时清空内容以触发现有缺失图片提示。 */
const normalizeCopyTestExportImage = async (
  image: CopyTestExportImageInput
): Promise<CopyTestExportImageInput> => {
  /** 去除调用方可能带入的首尾空白后的 data URL。 */
  const dataUrl = image.base64.trim();
  try {
    /** 当前图片是否能在严格校验后保持原始二进制。 */
    const isNativeImage = isCopyTestNativeExportImage(
      parseCopyTestExportImage(dataUrl)
    );
    if (isNativeImage) {
      /** 浏览器解码校验不会修改有效 PNG 或 JPEG 的原始字节。 */
      getCopyTestExportImageSize(await loadCopyTestExportImage(dataUrl));
      return { ...image, base64: dataUrl };
    }
    return {
      ...image,
      base64: await convertValidatedCopyTestExportImageToPng(dataUrl),
    };
  } catch {
    return { ...image, base64: '' };
  }
};

/** 读取一张规范图片的二进制大小。 */
const getCopyTestExportImageByteLength = (dataUrl: string): number => {
  if (!dataUrl) {
    return 0;
  }
  /** 规范图片 data URL 中无需再次解码的 base64 内容。 */
  const base64 = COPY_TEST_EXPORT_IMAGE_DATA_URL_PATTERN.exec(dataUrl)?.[2];
  if (!base64) {
    throw new Error(COPY_TEST_EXPORT_IMAGE_CONVERSION_ERROR);
  }
  return getBase64ByteLength(base64);
};

/** 将图片顺序规范为 PNG 或 JPEG，并限制一次导出的总内存占用。 */
export const normalizeCopyTestExportImages = async (
  images: readonly CopyTestExportImageInput[]
): Promise<CopyTestExportImageInput[]> => {
  /** 已保留在本次导出模型中的图片二进制总大小。 */
  let totalBytes = 0;
  /** 按输入顺序生成且不会并发占用多个 Canvas 的结果。 */
  const normalizedImages: CopyTestExportImageInput[] = [];
  for (const image of images) {
    /** 当前图片完成校验或转码后的独立副本。 */
    const normalizedImage = await normalizeCopyTestExportImage(image);
    /** 当前图片将增加的实际二进制大小。 */
    const imageBytes = getCopyTestExportImageByteLength(normalizedImage.base64);
    if (totalBytes + imageBytes > COPY_TEST_EXPORT_TOTAL_IMAGE_MAX_BYTES) {
      normalizedImages.push({ ...normalizedImage, base64: '' });
      continue;
    }
    totalBytes += imageBytes;
    normalizedImages.push(normalizedImage);
  }
  return normalizedImages;
};
