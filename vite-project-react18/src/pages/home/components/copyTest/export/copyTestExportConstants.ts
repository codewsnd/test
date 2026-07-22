/**
 * 文件作用：维护 CopyTest 本地文件导出的格式、尺寸和识别常量。
 */

/** 普通列在本地文件中的目标像素宽度。 */
export const COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH = 200;

/** Test Result 列在本地文件中的目标像素宽度。 */
export const COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH = 300;

/** Test Evidence 列在本地文件中的目标像素宽度。 */
export const COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH = 300;

/** Evidence 图片缺失宽高时使用的默认像素宽度。 */
export const COPY_TEST_EXPORT_IMAGE_DEFAULT_WIDTH = 100;

/** Evidence 图片缺失宽高时使用的默认像素高度。 */
export const COPY_TEST_EXPORT_IMAGE_DEFAULT_HEIGHT = 200;

/** PDF 和 Word 中单张 Evidence 图片允许使用的最大像素宽度。 */
export const COPY_TEST_EXPORT_IMAGE_MAX_WIDTH = 120;

/** PDF 和 Word 中单张 Evidence 图片允许使用的最大像素高度。 */
export const COPY_TEST_EXPORT_IMAGE_MAX_HEIGHT = 160;

/** 标记 Result 或 Evidence 生成列类型的 Storage 属性名。 */
export const COPY_TEST_EXPORT_GENERATED_TYPE_ATTRIBUTE = 'data-copy-test-column-type';

/** 标记单张 Evidence 卡片的 Storage 属性名。 */
export const COPY_TEST_EXPORT_EVIDENCE_CARD_ATTRIBUTE = 'data-copy-test-evidence-card';

/** Result 生成列的 Storage 类型值。 */
export const COPY_TEST_EXPORT_RESULT_TYPE = 'result';

/** Evidence 生成列的 Storage 类型值。 */
export const COPY_TEST_EXPORT_EVIDENCE_TYPE = 'evidence';

/** Test Result 表头兼容识别前缀。 */
export const COPY_TEST_EXPORT_RESULT_HEADER_PREFIX = 'Test Result -';

/** Test Evidence 表头兼容识别前缀。 */
export const COPY_TEST_EXPORT_EVIDENCE_HEADER_PREFIX = 'Test Evidence -';

/** Excel 文件的标准 MIME 类型。 */
export const COPY_TEST_EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Word 文件的标准 MIME 类型。 */
export const COPY_TEST_WORD_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** PDF 文件的标准 MIME 类型。 */
export const COPY_TEST_PDF_MIME_TYPE = 'application/pdf';

/** Test Result 通过状态使用的导出颜色。 */
export const COPY_TEST_EXPORT_PASSED_COLOR = '00875A';

/** Test Result 失败状态使用的导出颜色。 */
export const COPY_TEST_EXPORT_FAILED_COLOR = 'FF0000';

/** Test Result 通过状态使用的固定标签。 */
export const COPY_TEST_EXPORT_PASSED_LABEL = 'Passed:';

/** Test Result 失败状态使用的固定标签。 */
export const COPY_TEST_EXPORT_FAILED_LABEL = 'Failed:';
