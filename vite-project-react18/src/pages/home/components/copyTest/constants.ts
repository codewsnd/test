/**
 * 文件作用：维护 CopyTest 上传限制和文件名识别常量。
 */
/** 单次最多允许上传的截图数量。 */
export const MAX_UPLOAD_IMAGE_COUNT = 50;

/** 单次最多允许上传的截图总字节数。 */
export const MAX_UPLOAD_TOTAL_BYTES = 10 * 1024 * 1024;

/** 上传容量限制的用户可读文案。 */
export const MAX_UPLOAD_TOTAL_LABEL = '10 MB';

/** 支持按文件名识别的图片扩展名。 */
export const IMAGE_FILE_NAME_PATTERN = /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;
