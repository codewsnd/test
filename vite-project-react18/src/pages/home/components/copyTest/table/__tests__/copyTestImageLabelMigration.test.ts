import { describe, expect, it } from 'vitest';
import {
  migrateCopyTestImageLabels,
  migrateCopyTestImageLabelsWithDetails,
} from '../copyTestImageLabelMigration';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
} from '../tableConstants';
import { parseHtml } from '../tableModel';

/** 当前 Pair 严格 ownership 使用的来源列键。 */
const SOURCE_KEY = '0:Target';

/** 当前纯 UUID 附件名。 */
const CURRENT_UUID_FILE = '0198f4e0-0000-7000-8000-000000000000.png';

/** 无法恢复原始名的历史纯 UUID 附件名。 */
const UUID_ONLY_FILE = '0198f4e0-0001-7000-8000-000000000000.webp';

/** 仍包含原名主体的旧版 UUID 附件名。 */
const LEGACY_FILE = '旧版首页-0198f4e0-0002-7000-8000-000000000000.jpg';

/** 创建严格受管 Result/Evidence 单元格的公共 metadata。 */
const managedAttributes = (type: 'result' | 'evidence'): string => {
  return [
    `data-copy-test-column-type="${type}"`,
    `data-copy-test-source-column-key="${SOURCE_KEY}"`,
    `data-copy-test-owner-id="${SOURCE_KEY}"`,
    'data-copy-test-schema="2"',
  ].join(' ');
};

/** 创建历史 Result 条目。 */
const resultItem = (imageId: string, label: string): string => {
  return `<li ${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}="${imageId}">${label}</li>`;
};

/** 创建历史 Evidence 卡片。 */
const evidenceCard = (
  imageId: string,
  label: string,
  displayFileName?: string
): string => {
  /** 只有新结构才具备的原始文件名 metadata。 */
  const alt = displayFileName
    ? ` data-copy-test-evidence-image-alt="${displayFileName}"`
    : '';
  return [
    `<div ${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}="true"><strong>${label}</strong><br />`,
    `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${imageId}"${alt}>`,
    `<ri:attachment ri:filename="${imageId}" /></ac:image></div>`,
  ].join('');
};

/** 读取迁移后 Result 与 Evidence 的可见标签。 */
const getVisibleLabels = (html: string): { evidence: string[]; result: string[] } => {
  /** 迁移结果的独立 DOM。 */
  const doc = parseHtml(html);
  return {
    evidence: Array.from(doc.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}] > strong`
    )).map(label => label.textContent || ''),
    result: Array.from(doc.querySelectorAll(
      `[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`
    )).map(reference => reference.firstChild?.textContent || ''),
  };
};

describe('migrateCopyTestImageLabels', () => {
  it('立即把历史 Result 和 Evidence 标签迁移为原始名、旧附件名或 UUID', () => {
    const storage = [
      '<table><tr><th>Target</th><th>Test Result</th><th>Test Evidence</th></tr>',
      `<tr><td>copy</td><td ${managedAttributes('result')}><ul>`,
      resultItem(CURRENT_UUID_FILE, 'Screen01 (过时名称)'),
      resultItem(UUID_ONLY_FILE, 'Screen02'),
      resultItem(LEGACY_FILE, 'Screen03'),
      '</ul></td>',
      `<td ${managedAttributes('evidence')}>`,
      evidenceCard(CURRENT_UUID_FILE, 'Screen01 (过时名称)', '首页.最终版.PNG'),
      evidenceCard(UUID_ONLY_FILE, 'Screen02', UUID_ONLY_FILE),
      evidenceCard(LEGACY_FILE, 'Screen03', LEGACY_FILE),
      '</td></tr></table>',
    ].join('');

    const migrated = migrateCopyTestImageLabels(storage);
    const migration = migrateCopyTestImageLabelsWithDetails(storage);

    expect(getVisibleLabels(migrated)).toEqual({
      evidence: [
        '首页.最终版',
        '0198f4e0-0001-7000-8000-000000000000',
        '旧版首页',
      ],
      result: [
        '首页.最终版',
        '0198f4e0-0001-7000-8000-000000000000',
        '旧版首页',
      ],
    });
    expect(migrated).toContain(`ri:filename="${CURRENT_UUID_FILE}"`);
    expect(migration.sourceColumnKeys).toEqual([SOURCE_KEY]);
    expect(migration.html).toBe(migrated);
    expect(migrateCopyTestImageLabels(migrated)).toBe(migrated);
    expect(migrateCopyTestImageLabelsWithDetails(migrated).sourceColumnKeys).toEqual([]);
  });

  it('在原始名 metadata 缺失时沿用旧标签中的文件名主体', () => {
    const storage = [
      '<table><tr><th>Target</th><th>Test Result</th><th>Test Evidence</th></tr>',
      `<tr><td>copy</td><td ${managedAttributes('result')}>`,
      resultItem(CURRENT_UUID_FILE, 'Screen01 (已知名称.final)'),
      `</td><td ${managedAttributes('evidence')}>`,
      evidenceCard(CURRENT_UUID_FILE, 'Screen01 (已知名称.final)'),
      '</td></tr></table>',
    ].join('');

    expect(getVisibleLabels(migrateCopyTestImageLabels(storage))).toEqual({
      evidence: ['已知名称.final'],
      result: ['已知名称.final'],
    });
  });

  it('不会改写缺少严格 ownership 的普通业务单元格', () => {
    const storage = [
      '<table><tr><th>Result</th><th>Evidence</th></tr><tr>',
      `<td>${resultItem(CURRENT_UUID_FILE, 'Screen01')}</td>`,
      `<td>${evidenceCard(CURRENT_UUID_FILE, 'Screen01', '首页.png')}</td>`,
      '</tr></table>',
    ].join('');

    expect(migrateCopyTestImageLabels(storage)).toBe(storage);
  });
});
