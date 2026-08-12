import { describe, expect, it } from 'vitest';
import { migrateCopyTestImageLabelsWithDetails } from '../copyTestImageLabelMigration';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from '../tableConstants';
import { parseHtml } from '../tableModel';

/** 测试表格统一使用的来源列 ownership key。 */
const SOURCE_COLUMN_KEY = '0:Target';

/** 历史 UUID 内部附件名。 */
const IMAGE_ID = '0198f4e0-0000-7000-8000-000000000000.png';

/** 构建严格受管 Result 或 Evidence 单元格 metadata。 */
const createManagedAttributes = (type: 'result' | 'evidence'): string => {
  return [
    `${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${type}"`,
    `${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="${SOURCE_COLUMN_KEY}"`,
    `${COPY_TEST_OWNER_ID_ATTRIBUTE}="${SOURCE_COLUMN_KEY}"`,
    `${COPY_TEST_SCHEMA_ATTRIBUTE}="${COPY_TEST_SCHEMA_VERSION}"`,
  ].join(' ');
};

/** 创建包含历史 Result/Evidence Screen 标签的单表 HTML。 */
const createHistoricalTable = (
  resultAttributes = createManagedAttributes(COPY_TEST_GENERATED_RESULT_TYPE),
  evidenceAttributes = createManagedAttributes(COPY_TEST_GENERATED_EVIDENCE_TYPE)
): string => {
  return [
    '<table><tr><th>Target</th></tr><tr><td>Copy</td>',
    `<td ${resultAttributes}><ul>`,
    `<li ${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${IMAGE_ID}">`,
    'Screen01 (旧标签)<ul><li>Visible copy differs.</li></ul></li></ul></td>',
    `<td ${evidenceAttributes}>`,
    `<div ${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}="true"><strong>Screen01 (旧标签)</strong><br />`,
    `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${IMAGE_ID}"`,
    ` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="首页.最终版.PNG">`,
    `<ri:attachment ri:filename="${IMAGE_ID}" /></ac:image></div></td>`,
    '</tr></table>',
  ].join('');
};

/** 读取元素直接拥有的第一个非空文本标签。 */
const getDirectTextLabel = (element: Element | null): string => {
  return Array.from(element?.childNodes || []).find(node => {
    return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
  })?.textContent?.trim() || '';
};

describe('copyTestImageLabelMigration', () => {
  it('按 Evidence 原始文件名迁移同一来源列的 Result 和 Evidence 标签', () => {
    const migration = migrateCopyTestImageLabelsWithDetails(createHistoricalTable());
    const documentModel = parseHtml(migration.html);
    const resultReference = documentModel.querySelector(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${IMAGE_ID}"]`
    );
    const evidenceLabel = documentModel.querySelector(
      `[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}] > strong`
    );

    expect(migration.sourceColumnKeys).toEqual([SOURCE_COLUMN_KEY]);
    expect(getDirectTextLabel(resultReference)).toBe('首页.最终版');
    expect(evidenceLabel?.textContent).toBe('首页.最终版');
    expect(resultReference?.textContent).toContain('Visible copy differs.');
    expect(migration.html).toContain(`ri:filename="${IMAGE_ID}"`);
    expect(migration.html).not.toContain('Screen01');
  });

  it('当前标签已经正确时原样返回 HTML 且不产生待回写来源列', () => {
    const currentTable = createHistoricalTable()
      .split('Screen01 (旧标签)')
      .join('首页.最终版');

    expect(migrateCopyTestImageLabelsWithDetails(currentTable)).toEqual({
      html: currentTable,
      sourceColumnKeys: [],
    });
  });

  it('忽略 ownership 不完整的同名 Result 和 Evidence 节点', () => {
    const incompleteAttributes = [
      `${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="result"`,
      `${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="${SOURCE_COLUMN_KEY}"`,
      `${COPY_TEST_SCHEMA_ATTRIBUTE}="${COPY_TEST_SCHEMA_VERSION}"`,
    ].join(' ');
    const unownedTable = createHistoricalTable(incompleteAttributes, incompleteAttributes);

    expect(migrateCopyTestImageLabelsWithDetails(unownedTable)).toEqual({
      html: unownedTable,
      sourceColumnKeys: [],
    });
  });

  it('没有原始文件名 metadata 时从旧标签恢复名称', () => {
    const table = createHistoricalTable()
      .replace(` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="首页.最终版.PNG"`, '')
      .split('Screen01 (旧标签)')
      .join('Screen01 (登录页面)');
    const migration = migrateCopyTestImageLabelsWithDetails(table);

    expect(migration.html).toContain('登录页面');
    expect(migration.html).not.toContain('Screen01');
    expect(migration.sourceColumnKeys).toEqual([SOURCE_COLUMN_KEY]);
  });

  it('忽略嵌套表格中的图片候选', () => {
    const directImage = [
      `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${IMAGE_ID}"`,
      ` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="首页.最终版.PNG">`,
      `<ri:attachment ri:filename="${IMAGE_ID}" /></ac:image>`,
    ].join('');
    const nestedImage = [
      `<table><tr><td><ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${IMAGE_ID}"`,
      ` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="嵌套图片.png">`,
      `<ri:attachment ri:filename="${IMAGE_ID}" /></ac:image></td></tr></table>`,
    ].join('');
    const table = createHistoricalTable().replace(directImage, nestedImage);

    expect(migrateCopyTestImageLabelsWithDetails(table)).toEqual({
      html: table,
      sourceColumnKeys: [],
    });
  });

  it('同一卡片存在多个直接图片候选时安全跳过', () => {
    const secondImageId = '0198f4e0-0001-7000-8000-000000000000.png';
    const secondImage = [
      `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${secondImageId}"`,
      ` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="第二张.png">`,
      `<ri:attachment ri:filename="${secondImageId}" /></ac:image>`,
    ].join('');
    const table = createHistoricalTable().replace('</ac:image></div></td>', [
      '</ac:image>',
      secondImage,
      '</div></td>',
    ].join(''));

    expect(migrateCopyTestImageLabelsWithDetails(table)).toEqual({
      html: table,
      sourceColumnKeys: [],
    });
  });
});
