/**
 * 文件作用：集中维护 TablePreview 父页面与 iframe 文档共用的 DOM 协议和样式常量。
 */
import {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../../constants';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
} from '../../table/tableConstants';

export const DELETE_BUTTON_ATTRIBUTE = 'data-copy-test-evidence-delete-button';

/** 旧版 Result 状态按钮属性，仅用于清理导入 storage 中的历史运行时标记。 */
export const LEGACY_RESULT_STATUS_BUTTON_ATTRIBUTE = 'data-copy-test-result-status-button';

/** Result 状态切换链接的 DOM 标记属性。 */
export const RESULT_STATUS_LINK_ATTRIBUTE = 'data-copy-test-result-status-link';

/** Result 状态链接对应的业务数据行下标属性。 */
export const RESULT_STATUS_ROW_INDEX_ATTRIBUTE = 'data-copy-test-result-status-row-index';

/** Result 状态链接对应的明确目标状态属性。 */
export const RESULT_STATUS_PASSED_ATTRIBUTE = 'data-copy-test-result-status-passed';

/** Result 状态链接所属来源列键属性。 */
export const RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE =
  'data-copy-test-result-status-source-column-key';

/** 仅在系统预览中显示的标点识别复核提示属性。 */
export const PUNCTUATION_REVIEW_WARNING_ATTRIBUTE =
  'data-copy-test-punctuation-review-warning';

/** 触发标点识别复核提示前允许出现的标点数量。 */
export const PUNCTUATION_REVIEW_THRESHOLD = 3;

/** 标点较多且存在 Failed 时显示的简短英文提示。 */
export const PUNCTUATION_REVIEW_WARNING_TEXT =
  'Punctuation recognition may be inaccurate. Please review.';

/** 匹配单个 Unicode 标点字符，不把货币、数学符号或 Emoji 计入标点。 */
export const UNICODE_PUNCTUATION_PATTERN = /^\p{P}$/u;

/** Result 当前状态使用的固定可见文本。 */
export const PASSED_RESULT_LABEL = 'Passed:';

/** Result 当前失败状态使用的固定可见文本。 */
export const FAILED_RESULT_LABEL = 'Failed:';

/** Passed Result 对应的人工切换链接文本。 */
export const MARK_AS_FAILED_LINK_LABEL = 'Mark as Failed';

/** Failed Result 对应的人工切换链接文本。 */
export const MARK_AS_PASSED_LINK_LABEL = 'Mark as Passed';

/** iframe 预览动作属性。 */
export const PREVIEW_ACTION_ATTRIBUTE = 'data-copy-test-preview-action';

/** iframe 预览图片 ID 属性。 */
export const PREVIEW_IMAGE_ID_ATTRIBUTE = 'data-copy-test-preview-image-id';

/** iframe 预览图片实例 ID 属性。 */
export const PREVIEW_IMAGE_INSTANCE_ATTRIBUTE = 'data-copy-test-preview-image-instance-id';

/** iframe 预览图片 src 属性。 */
export const PREVIEW_IMAGE_SRC_ATTRIBUTE = 'data-copy-test-preview-image-src';

/** iframe 预览图片 alt 属性。 */
export const PREVIEW_IMAGE_ALT_ATTRIBUTE = 'data-copy-test-preview-image-alt';

/** iframe 预览中隐藏原始 Confluence 图片节点的属性。 */
export const PREVIEW_STORAGE_IMAGE_ATTRIBUTE = 'data-copy-test-preview-storage-image';

/** iframe 行选择 checkbox 属性。 */
export const SELECTION_CHECKBOX_ATTRIBUTE = 'data-copy-test-selection-checkbox';

/** iframe 行选择 checkbox 对应行属性。 */
export const SELECTION_ROW_INDEXES_ATTRIBUTE = 'data-copy-test-selection-row-indexes';

/** iframe 行选择列属性。 */
export const SELECTION_COLUMN_ATTRIBUTE = 'data-copy-test-selection-column';

/** iframe 分组选择标签属性。 */
export const SELECTION_GROUP_LABEL_ATTRIBUTE = 'data-copy-test-selection-group-label';

/** iframe 表格是否展示顺序 Group 标签。 */
export const SELECTION_GROUP_MODE_ATTRIBUTE = 'data-copy-test-selection-group-mode';

/** iframe 行选择全选属性。 */
export const SELECTION_SELECT_ALL_ATTRIBUTE = 'data-copy-test-selection-all';

/** iframe checkbox 是否原本可选择。 */
export const SELECTION_SELECTABLE_ATTRIBUTE = 'data-copy-test-selection-selectable';

/** iframe postMessage 来源类型。 */
export const PREVIEW_MESSAGE_TYPE = 'copy-test-preview-message';

/** 父页面增量同步到 iframe 的状态消息类型。 */
export const PREVIEW_STATE_MESSAGE_TYPE = 'copy-test-preview-state';

/** iframe 文档当前 working table 版本属性。 */
export const PREVIEW_REVISION_ATTRIBUTE = 'data-copy-test-preview-revision';

/** DOM 布尔属性写入时使用的统一字符串值。 */
export const DOM_TRUE_ATTRIBUTE_VALUE = 'true';

/** DOM disabled 属性名称，供 checkbox 和删除按钮共用。 */
export const DISABLED_ATTRIBUTE = 'disabled';

/** 导入 storage 不得预置、只能由当前 iframe 构建流程生成的内部交互属性。 */
export const PREVIEW_RESERVED_RUNTIME_ATTRIBUTES: ReadonlySet<string> = new Set([
  DELETE_BUTTON_ATTRIBUTE,
  PREVIEW_ACTION_ATTRIBUTE,
  PREVIEW_IMAGE_ALT_ATTRIBUTE,
  PREVIEW_IMAGE_ID_ATTRIBUTE,
  PREVIEW_IMAGE_INSTANCE_ATTRIBUTE,
  PREVIEW_IMAGE_SRC_ATTRIBUTE,
  PREVIEW_STORAGE_IMAGE_ATTRIBUTE,
  LEGACY_RESULT_STATUS_BUTTON_ATTRIBUTE,
  PUNCTUATION_REVIEW_WARNING_ATTRIBUTE,
  RESULT_STATUS_LINK_ATTRIBUTE,
  RESULT_STATUS_PASSED_ATTRIBUTE,
  RESULT_STATUS_ROW_INDEX_ATTRIBUTE,
  RESULT_STATUS_SOURCE_COLUMN_KEY_ATTRIBUTE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_COLUMN_ATTRIBUTE,
  SELECTION_GROUP_LABEL_ATTRIBUTE,
  SELECTION_GROUP_MODE_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECTABLE_ATTRIBUTE,
  SELECTION_SELECT_ALL_ATTRIBUTE,
]);

/** iframe 预览里目标 table 的选择器。 */
export const PREVIEW_TABLE_SELECTOR = 'table';

/** 解析相对预览 URL 时使用的固定安全基准地址。 */
export const PREVIEW_SAFE_URL_BASE = 'https://copy-test.invalid/';

/** href 与 src 均允许使用的普通 Web 协议。 */
export const PREVIEW_WEB_PROTOCOLS = ['http:', 'https:'] as const;

/** href 允许使用的非执行型协议集合。 */
export const PREVIEW_ALLOWED_LINK_PROTOCOLS: ReadonlySet<string> = new Set([
  ...PREVIEW_WEB_PROTOCOLS,
  'mailto:',
  'tel:',
]);

/** src 允许使用的非执行型协议集合。 */
export const PREVIEW_ALLOWED_RESOURCE_PROTOCOLS: ReadonlySet<string> = new Set(PREVIEW_WEB_PROTOCOLS);

/** 需要执行协议白名单校验的 URL 属性名。 */
export const PREVIEW_URL_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set(['href', 'src']);

/** 标记预览表已应用固定 Header 列宽的属性。 */
export const PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-fixed-width-table';

/** 标记预览表正使用三列等分布局的属性。 */
export const PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-equal-width-table';

/** 标记预览 col 元素所属列类型的属性。 */
export const PREVIEW_COLUMN_ROLE_ATTRIBUTE = 'data-copy-test-preview-column-role';

/** 普通 Header 列的预览角色。 */
export const PREVIEW_HEADER_COLUMN_ROLE = 'header';

/** 行选择列的预览角色。 */
export const PREVIEW_SELECTION_COLUMN_ROLE = 'selection';

/** iframe 行选择列固定占用的像素宽度。 */
export const PREVIEW_SELECTION_COLUMN_WIDTH = 42;

/** 展示 Group 标签时行选择列固定占用的像素宽度。 */
export const PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH = 112;

/** 选中 Comparison Column 后三个业务列共同使用的响应式宽度。 */
export const PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH = `calc((100% - ${PREVIEW_SELECTION_COLUMN_WIDTH}px) / 3)`;

/** 展示 Group 标签时三个业务列共同使用的响应式宽度。 */
export const PREVIEW_GROUPED_EQUAL_BUSINESS_COLUMN_WIDTH =
  `calc((100% - ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px) / 3)`;

/** 注入 iframe 文档的表格、选择框和 Evidence 样式。 */
export const PREVIEW_DOCUMENT_STYLE = `
  html,
  body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    color: #172b4d;
    font-family: Arial, sans-serif;
    font-size: 14px;
  }

  body {
    box-sizing: border-box;
  }

  .copy-test-preview-scroll-root {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: scroll;
    padding: 0;
    scrollbar-color: #6b7280 #e5e7eb;
    scrollbar-gutter: stable both-edges;
    scrollbar-width: auto;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-track {
    background: #e5e7eb;
    border-radius: 8px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-thumb {
    background: #6b7280;
    border: 3px solid #e5e7eb;
    border-radius: 8px;
  }

  .copy-test-preview-scroll-root::-webkit-scrollbar-thumb:hover {
    background: #4b5563;
  }

  table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }

  table[${PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"] {
    table-layout: fixed !important;
  }

  table[${PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"] {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_HEADER_COLUMN_ROLE}"] {
    width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"] {
    width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"] {
    width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
    min-width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
    max-width: ${COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH}px !important;
  }

  col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"] {
    width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
    min-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
    max-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px !important;
  }

  table[${SELECTION_GROUP_MODE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"]
    > colgroup > col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"] {
    width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px !important;
    min-width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px !important;
    max-width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px !important;
  }

  table[${PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"]
    > colgroup > col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}]:not([${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"]) {
    width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    min-width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    max-width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
  }

  table[${PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"][${SELECTION_GROUP_MODE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"]
    > colgroup > col[${PREVIEW_COLUMN_ROLE_ATTRIBUTE}]:not([${PREVIEW_COLUMN_ROLE_ATTRIBUTE}="${PREVIEW_SELECTION_COLUMN_ROLE}"]) {
    width: ${PREVIEW_GROUPED_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    min-width: ${PREVIEW_GROUPED_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
    max-width: ${PREVIEW_GROUPED_EQUAL_BUSINESS_COLUMN_WIDTH} !important;
  }

  th,
  td {
    box-sizing: border-box;
    border: 1px solid #c1c7d0;
    max-width: none;
    padding: 7px 10px;
    vertical-align: top;
    white-space: pre-wrap;
    word-break: break-word;
  }

  th {
    background: #f4f5f7;
    font-weight: 600;
  }

  [${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}] {
    display: inline-flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    width: 120px;
    max-width: 100%;
    margin: 0 16px 12px 0;
    position: relative;
    vertical-align: top;
  }

  [${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"] {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
  }

  [${DELETE_BUTTON_ATTRIBUTE}] {
    position: absolute;
    right: 0;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #de350b;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    box-shadow: 0 1px 4px rgba(9, 30, 66, 0.2);
  }

  [${DELETE_BUTTON_ATTRIBUTE}] svg {
    width: 15px;
    height: 15px;
    pointer-events: none;
  }

  [${DELETE_BUTTON_ATTRIBUTE}][disabled] {
    cursor: not-allowed;
    opacity: 0.45;
  }

  [${RESULT_STATUS_LINK_ATTRIBUTE}] {
    margin-left: 8px;
    color: #0052cc;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: opacity 120ms ease;
    white-space: nowrap;
  }

  li[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]:hover > [${RESULT_STATUS_LINK_ATTRIBUTE}],
  li[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]:focus-within > [${RESULT_STATUS_LINK_ATTRIBUTE}] {
    opacity: 1;
    pointer-events: auto;
  }

  [${RESULT_STATUS_LINK_ATTRIBUTE}]:hover:not([aria-disabled="true"]),
  [${RESULT_STATUS_LINK_ATTRIBUTE}]:focus-visible:not([aria-disabled="true"]) {
    color: #0747a6;
  }

  [${RESULT_STATUS_LINK_ATTRIBUTE}][aria-disabled="true"] {
    color: #6b778c;
    cursor: not-allowed;
    text-decoration: none;
  }

  [${PUNCTUATION_REVIEW_WARNING_ATTRIBUTE}] {
    margin: 8px 0 0;
    color: #6b778c;
    font-size: 12px;
    line-height: 1.4;
  }

  ac\\:image,
  ac-image {
    display: none !important;
  }

  [${PREVIEW_STORAGE_IMAGE_ATTRIBUTE}] {
    display: none !important;
  }

  [${PREVIEW_ACTION_ATTRIBUTE}="preview"] {
    cursor: zoom-in;
    display: block;
    width: 120px;
    height: 180px;
    object-fit: contain;
  }

  [${SELECTION_COLUMN_ATTRIBUTE}] {
    box-sizing: border-box;
    width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
    min-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
    max-width: ${PREVIEW_SELECTION_COLUMN_WIDTH}px;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }

  table[${SELECTION_GROUP_MODE_ATTRIBUTE}="${DOM_TRUE_ATTRIBUTE_VALUE}"]
    [${SELECTION_COLUMN_ATTRIBUTE}] {
    width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px;
    min-width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px;
    max-width: ${PREVIEW_GROUPED_SELECTION_COLUMN_WIDTH}px;
    padding: 0 8px;
  }

  [${SELECTION_COLUMN_ATTRIBUTE}] > label {
    align-items: center;
    display: inline-flex;
    gap: 6px;
    justify-content: center;
    white-space: nowrap;
  }

  [${SELECTION_GROUP_LABEL_ATTRIBUTE}] {
    color: #172b4d;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }

  [${SELECTION_CHECKBOX_ATTRIBUTE}] {
    accent-color: #172b4d;
    cursor: pointer;
    height: 16px;
    margin: 0;
    width: 16px;
  }

  [${SELECTION_CHECKBOX_ATTRIBUTE}][disabled] {
    cursor: not-allowed;
    opacity: 0.4;
  }
`;

/** iframe 发给父页面的消息。 */
