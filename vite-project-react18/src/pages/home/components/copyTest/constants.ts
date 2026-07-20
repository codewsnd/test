/**
 * 文件作用：维护 CopyTest 上传限制、文件名识别和表格列宽常量。
 */
/** 未选择 Comparison Column 时普通 Header 的固定像素宽度。 */
export const COPY_TEST_PREVIEW_HEADER_WIDTH = 200;

/** 未选择 Comparison Column 时 Test Result Header 的固定像素宽度，同时用于回写 Confluence storage。 */
export const COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH = 300;

/** 未选择 Comparison Column 时 Test Evidence Header 的固定像素宽度，同时用于回写 Confluence storage。 */
export const COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH = 300;

/** 单次最多允许上传的截图数量。 */
export const MAX_UPLOAD_IMAGE_COUNT = 50;

/** 单次最多允许上传的截图总字节数。 */
export const MAX_UPLOAD_TOTAL_BYTES = 10 * 1024 * 1024;

/** 上传容量限制的用户可读文案。 */
export const MAX_UPLOAD_TOTAL_LABEL = '10 MB';

/** 支持按文件名识别的图片扩展名。 */
export const IMAGE_FILE_NAME_PATTERN = /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;
