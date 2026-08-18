/**
 * 文件作用：维护表格生成列、运行时属性和导出尺寸常量。
 */
/** Result 生成列标题使用的固定前缀。 */
export const COPY_TEST_RESULT_HEADER_PREFIX = 'Test Result -';

/** Evidence 生成列标题使用的固定前缀。 */
export const COPY_TEST_EVIDENCE_HEADER_PREFIX = 'Test Evidence -';

/** Result 生成列的 metadata 类型值。 */
export const COPY_TEST_GENERATED_RESULT_TYPE = 'result';

/** Evidence 生成列的 metadata 类型值。 */
export const COPY_TEST_GENERATED_EVIDENCE_TYPE = 'evidence';

/** 标记 CopyTest 管理内容根节点的属性名。 */
export const COPY_TEST_GENERATED_CONTENT_ATTRIBUTE = 'data-copy-test-generated-content';

/** 标记生成单元格 Result/Evidence 类型的属性名。 */
export const COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE = 'data-copy-test-column-type';

/** 记录生成单元格所属源列 key 的属性名。 */
export const COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE = 'data-copy-test-source-column-key';

/** 在每个 Result 原子单元格上持久化 Evidence 结构组锚点的属性名。 */
export const COPY_TEST_EVIDENCE_GROUP_ID_ATTRIBUTE = 'data-copy-test-evidence-group-id';

/** CopyTest 生成节点的 metadata schema 属性。 */
export const COPY_TEST_SCHEMA_ATTRIBUTE = 'data-copy-test-schema';

/** CopyTest 当前生成节点 metadata schema 版本。 */
export const COPY_TEST_SCHEMA_VERSION = '2';

/** CopyTest 生成双列的 owner 属性。 */
export const COPY_TEST_OWNER_ID_ATTRIBUTE = 'data-copy-test-owner-id';

/** 导出流水线临时标记当前目标 Pair 的属性。 */
export const COPY_TEST_EXPORT_SCOPE_ATTRIBUTE = 'data-copy-test-export-scope';

/** 标记一张 Evidence 图片卡片的属性名。 */
export const COPY_TEST_EVIDENCE_CARD_ATTRIBUTE = 'data-copy-test-evidence-card';

/** 记录 Evidence 图片稳定 ID 的属性名。 */
export const COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE = 'data-copy-test-evidence-image-id';

/** 区分同一 Evidence 图片多次出现实例的属性名。 */
export const COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE = 'data-copy-test-evidence-image-instance-id';

/** 保存 Evidence 图片可访问性文本和文件名提示的属性名。 */
export const COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE = 'data-copy-test-evidence-image-alt';

/** 记录 Result 图片引用稳定 ID 的属性名。 */
export const COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE = 'data-copy-test-result-image-id';

/** 记录 Result 图片引用实例 ID 的属性名。 */
export const COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE = 'data-copy-test-result-image-instance-id';

/** 保存 Result Screen 在 Evidence 序列中的稳定显示顺序。 */
export const COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE = 'data-copy-test-result-screen-order';

/** 标记 Result 根节点内 Passed/Failed 分组的属性名。 */
export const COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE = 'data-copy-test-result-status-group';

/** Result Passed 分组使用的属性值。 */
export const COPY_TEST_RESULT_PASSED_GROUP_VALUE = 'passed';

/** Result Failed 分组使用的属性值。 */
export const COPY_TEST_RESULT_FAILED_GROUP_VALUE = 'failed';

/** 在 Screen 切换到 Passed 后保留原 Failed 错误信息的属性名。 */
export const COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE =
  'data-copy-test-result-retained-language-issues';

/** Test Result 通过状态使用的文字颜色。 */
export const COPY_TEST_PASSED_COLOR = '#00875a';

/** Test Result 失败状态使用的文字颜色。 */
export const COPY_TEST_FAILED_COLOR = '#ff0000';

/** 回写 Confluence storage 时 Evidence 图片的固定宽度。 */
export const COPY_TEST_EVIDENCE_IMAGE_WIDTH = 100;

/** 回写 Confluence storage 时 Evidence 图片的固定高度。 */
export const COPY_TEST_EVIDENCE_IMAGE_HEIGHT = 200;
