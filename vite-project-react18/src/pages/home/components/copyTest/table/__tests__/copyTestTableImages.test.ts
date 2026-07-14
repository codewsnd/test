import { describe, expect, it } from 'vitest';
import {
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
} from '../tableConstants';
import { parseHtml } from '../tableModel';
import {
  getNonTargetRawSegments,
  getRawRangeText,
  scanTopLevelTableRawRanges,
  type CopyTestRawCellRange,
} from '../copyTestStoragePatch';
import {
  buildConfluenceStorageTableExportPayload,
  buildConfluenceStorageTableImagePreviewBundle,
  getConfluenceStorageTableImageFileNames,
  isStorageImageElement,
} from '../copyTestTableImages';

const SOURCE_A = 'table-0:target-a';
const SOURCE_B = 'table-0:target-b';
const EXPORT_SCOPE_A = 'copytest-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EXPORT_SCOPE_B = 'copytest-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const A_PROVIDED_BASE64 = 'data:image/png;base64,QUE=';
const B_PROVIDED_BASE64 = 'data:image/png;base64,QkI=';
const BUSINESS_BASE64 = 'data:image/png;base64,QlVTSU5FU1M=';
const FOREIGN_BASE64 = 'data:image/png;base64,Rk9SRUlHTg==';

/** 构建 schema 2 managed 单元格的严格 ownership 属性。 */
const createManagedAttributes = (
  sourceColumnKey: string,
  type: 'result' | 'evidence',
  exportScope?: string
): string => {
  const exportScopeAttribute = exportScope ? ` data-copy-test-export-scope="${exportScope}"` : '';
  return [
    `data-copy-test-schema="2" data-copy-test-column-type="${type}"`,
    ` data-copy-test-source-column-key="${sourceColumnKey}" data-copy-test-owner-id="${sourceColumnKey}"`,
    exportScopeAttribute,
  ].join('');
};

/** 构建包含稳定 Result 图片引用的 managed 单元格。 */
const createResultCell = (
  sourceColumnKey: string,
  imageId: string,
  exportScope?: string
): string => {
  return [
    `<td ${createManagedAttributes(sourceColumnKey, 'result', exportScope)}>`,
    '<div data-copy-test-generated-content="result" data-copy-test-preview-result="remove">',
    `<ul><li data-copy-test-result-image-id="${imageId}" data-copy-test-result-image-instance-id="${imageId}:1">Screen01</li></ul>`,
    '</div></td>',
  ].join('');
};

/** 构建仅使用 ac:image > ri:attachment[ri:filename] 的 managed Evidence 单元格。 */
const createEvidenceCell = (
  sourceColumnKey: string,
  imageId: string | undefined,
  fileName: string,
  exportScope?: string
): string => {
  const stableImageAttributes = imageId
    ? ` data-copy-test-evidence-image-id="${imageId}" data-copy-test-evidence-image-instance-id="${imageId}:1"`
    : '';
  return [
    `<td ${createManagedAttributes(sourceColumnKey, 'evidence', exportScope)}>`,
    '<div data-copy-test-generated-content="evidence">',
    '<div data-copy-test-evidence-card="true">',
    `<ac:image ac:width="7" ac:height="9"${stableImageAttributes}`,
    ` data-copy-test-evidence-image-alt="${fileName}" data-copy-test-preview-temp="remove">`,
    `<ri:attachment ri:filename="${fileName}" />`,
    '</ac:image></div></div></td>',
  ].join('');
};

/** 构建带严格 ownership 的自定义 Evidence 单元格。 */
const createCustomEvidenceCell = (sourceColumnKey: string, content: string): string => {
  return `<td ${createManagedAttributes(sourceColumnKey, 'evidence')}>${content}</td>`;
};

/** 构建严格 metadata 的生成列表头。 */
const createManagedHeader = (
  sourceColumnKey: string,
  type: 'result' | 'evidence',
  label: string
): string => {
  return `<th ${createManagedAttributes(sourceColumnKey, type)}>${label}</th>`;
};

const BUSINESS_CELL = [
  '<td data-business-format="  keep  ">',
  '<ac:image ac:width="321" ac:height="654">',
  '<ri:attachment ri:filename="business.png" /></ac:image>',
  '</td>',
].join('');

const FOREIGN_TEST_LIKE_CELL = [
  '<td data-human-column="true"><strong>Test Evidence - Target FR</strong>',
  '<ac:image ac:width="333" ac:height="444">',
  '<ri:attachment ri:filename="foreign.png" /></ac:image>',
  '</td>',
].join('');

const INVALID_MANAGED_CELL = [
  `<td data-copy-test-schema="2" data-copy-test-column-type="manual" data-copy-test-source-column-key="${SOURCE_A}"`,
  ` data-copy-test-owner-id="${SOURCE_A}">`,
  '<ac:image ac:width="555" ac:height="666"><ri:attachment ri:filename="manual.png" /></ac:image></td>',
].join('');

const MISSING_SCHEMA_CELL = [
  `<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="${SOURCE_A}"`,
  ` data-copy-test-owner-id="${SOURCE_A}">`,
  '<ac:image><ri:attachment ri:filename="missing-schema.png" /></ac:image></td>',
].join('');

const MISMATCHED_OWNER_CELL = [
  `<td data-copy-test-schema="2" data-copy-test-column-type="evidence" data-copy-test-source-column-key="${SOURCE_A}"`,
  ' data-copy-test-owner-id="other-owner">',
  '<ac:image><ri:attachment ri:filename="wrong-owner.png" /></ac:image></td>',
].join('');

const A_RESULT_CELL = createResultCell(SOURCE_A, 'a-id', EXPORT_SCOPE_A);
const A_EVIDENCE_CELL = createEvidenceCell(SOURCE_A, 'a-id', 'a.png', EXPORT_SCOPE_A);
const B_RESULT_CELL = createResultCell(SOURCE_B, 'b-id', EXPORT_SCOPE_B);
const B_EVIDENCE_CELL = createEvidenceCell(SOURCE_B, 'b-id', 'b.png', EXPORT_SCOPE_B);

const EXPORT_STORAGE = [
  '<p data-outside="before">before &amp; untouched</p>',
  '<table data-table-format="keep"><tr>',
  '<th>Business</th><th>Test Evidence - Target FR</th>',
  createManagedHeader(SOURCE_A, 'result', 'A Result'),
  createManagedHeader(SOURCE_A, 'evidence', 'A Evidence'),
  createManagedHeader(SOURCE_B, 'result', 'B Result'),
  createManagedHeader(SOURCE_B, 'evidence', 'B Evidence'),
  '</tr><tr>',
  BUSINESS_CELL,
  FOREIGN_TEST_LIKE_CELL,
  INVALID_MANAGED_CELL,
  MISSING_SCHEMA_CELL,
  MISMATCHED_OWNER_CELL,
  A_RESULT_CELL,
  A_EVIDENCE_CELL,
  B_RESULT_CELL,
  B_EVIDENCE_CELL,
  '</tr></table>',
  '<p data-outside="after">after &amp; untouched</p>',
].join('');

/** 读取指定 source key 的 raw 单元格范围。 */
const getSourceCellRanges = (storageHtml: string, sourceColumnKey: string): CopyTestRawCellRange[] => {
  const marker = `data-copy-test-source-column-key="${sourceColumnKey}"`;
  return scanTopLevelTableRawRanges(storageHtml).flatMap(table => {
    return table.rows.flatMap(row => {
      return row.cells.filter(cellRange => getRawRangeText(storageHtml, cellRange.openTagRange).includes(marker));
    });
  });
};

/** 读取指定 source key 的 raw 单元格文本。 */
const getSourceCells = (storageHtml: string, sourceColumnKey: string): string[] => {
  return getSourceCellRanges(storageHtml, sourceColumnKey)
    .map(cellRange => getRawRangeText(storageHtml, cellRange));
};

describe('copyTestTableImages', () => {
  it('只读取严格 managed Evidence 中的规范附件且不改写 preview storage', () => {
    const managedCell = createEvidenceCell(SOURCE_A, undefined, 'screen-a.png');
    const unsupportedCells = [
      createCustomEvidenceCell('legacy-image', '<image><ri:attachment ri:filename="image-tag.png" /></image>'),
      createCustomEvidenceCell('legacy-attachment', '<ac:image><attachment ri:filename="attachment-tag.png" /></ac:image>'),
      createCustomEvidenceCell('legacy-filename', '<ac:image><ri:attachment filename="filename-attribute.png" /></ac:image>'),
      createCustomEvidenceCell('legacy-alt', '<ac:image data-copy-test-evidence-image-alt="alt-only.png"></ac:image>'),
      createCustomEvidenceCell('nested-attachment', '<ac:image><span><ri:attachment ri:filename="nested.png" /></span></ac:image>'),
      createCustomEvidenceCell('nested-cell', '<table><tr><td><ac:image><ri:attachment ri:filename="inner.png" /></ac:image></td></tr></table>'),
    ].join('');
    const html = [
      `<table><tr>${managedCell}${unsupportedCells}${BUSINESS_CELL}${FOREIGN_TEST_LIKE_CELL}`,
      `${INVALID_MANAGED_CELL}${MISSING_SCHEMA_CELL}${MISMATCHED_OWNER_CELL}</tr></table>`,
    ].join('');
    const images = [{ base64: A_PROVIDED_BASE64, fileName: 'screen-a.png' }];

    expect(getConfluenceStorageTableImageFileNames(html)).toEqual(['screen-a.png']);
    const previewBundle = buildConfluenceStorageTableImagePreviewBundle(html, [
      ...images,
      { base64: BUSINESS_BASE64, fileName: 'business.png' },
      { base64: FOREIGN_BASE64, fileName: 'foreign.png' },
      { base64: FOREIGN_BASE64, fileName: 'alt-only.png' },
    ]);
    expect(previewBundle).toEqual({ images, storageHtml: html });
    expect(previewBundle.storageHtml).not.toContain('data-copy-test-evidence-image-id=');

    const doc = parseHtml([
      '<p></p>',
      '<ac:image><ri:attachment ri:filename="canonical.png" /></ac:image>',
      '<ac:image data-invalid="true"></ac:image>',
      '<img alt="x" /><image></image>',
    ].join(''));
    const elements = Array.from(doc.body.querySelectorAll('*'));
    const storageImage = elements.find(element => element.getAttribute('data-invalid') === null
      && element.tagName.toLowerCase() === 'ac:image');
    const invalidStorageImage = elements.find(element => element.getAttribute('data-invalid') === 'true');
    expect(isStorageImageElement(storageImage as Element)).toBe(true);
    expect(isStorageImageElement(invalidStorageImage as Element)).toBe(false);
    expect(isStorageImageElement(doc.querySelector('img') as Element)).toBe(false);
    expect(isStorageImageElement(doc.querySelector('image') as Element)).toBe(false);
    expect(isStorageImageElement(doc.querySelector('p') as Element)).toBe(false);
  });

  it('只导出当前 A 双列并保留稳定图片 metadata', () => {
    const providedImages = [
      { base64: A_PROVIDED_BASE64, fileName: 'a.png' },
      { base64: B_PROVIDED_BASE64, fileName: 'b.png' },
      { base64: BUSINESS_BASE64, fileName: 'business.png' },
      { base64: FOREIGN_BASE64, fileName: 'foreign.png' },
    ];
    const beforeTargetRanges = getSourceCellRanges(EXPORT_STORAGE, SOURCE_A);
    const payload = buildConfluenceStorageTableExportPayload(
      EXPORT_STORAGE,
      SOURCE_A,
      EXPORT_SCOPE_A,
      providedImages
    );
    const afterTargetRanges = getSourceCellRanges(payload.storageHtml, SOURCE_A);
    const aCells = getSourceCells(payload.storageHtml, SOURCE_A).join('');

    expect(payload.images).toEqual([{ base64: A_PROVIDED_BASE64, fileName: 'a.png' }]);
    expect(aCells).toContain(`ac:width="${COPY_TEST_EVIDENCE_IMAGE_WIDTH}"`);
    expect(aCells).toContain(`ac:height="${COPY_TEST_EVIDENCE_IMAGE_HEIGHT}"`);
    expect(aCells).toContain('data-copy-test-result-image-id="a-id"');
    expect(aCells).toContain('data-copy-test-result-image-instance-id="a-id:1"');
    expect(aCells).toContain('data-copy-test-evidence-image-id="a-id"');
    expect(aCells).toContain('data-copy-test-evidence-image-instance-id="a-id:1"');
    expect(aCells).toContain('data-copy-test-evidence-card="true"');
    expect(aCells).toContain('data-copy-test-evidence-image-alt="a.png"');
    expect(aCells).not.toContain(`data-copy-test-export-scope="${EXPORT_SCOPE_A}"`);
    expect(aCells).not.toContain('data-copy-test-preview-');
    expect(payload.storageHtml).toContain(B_RESULT_CELL);
    expect(payload.storageHtml).toContain(B_EVIDENCE_CELL);
    expect(payload.storageHtml).toContain(BUSINESS_CELL);
    expect(payload.storageHtml).toContain(FOREIGN_TEST_LIKE_CELL);
    expect(payload.storageHtml).toContain(INVALID_MANAGED_CELL);
    expect(payload.storageHtml).toContain(MISSING_SCHEMA_CELL);
    expect(payload.storageHtml).toContain(MISMATCHED_OWNER_CELL);
    expect(getNonTargetRawSegments(EXPORT_STORAGE, beforeTargetRanges))
      .toEqual(getNonTargetRawSegments(payload.storageHtml, afterTargetRanges));

    const repeated = buildConfluenceStorageTableExportPayload(
      payload.storageHtml,
      SOURCE_A,
      EXPORT_SCOPE_A,
      providedImages
    );
    expect(repeated.storageHtml).toBe(payload.storageHtml);
    expect(repeated.images).toEqual([]);
  });

  it('保持已清理 A 双列不变并独立导出 B 双列', () => {
    const aPayload = buildConfluenceStorageTableExportPayload(EXPORT_STORAGE, SOURCE_A, EXPORT_SCOPE_A, [{
      base64: A_PROVIDED_BASE64,
      fileName: 'a.png',
    }]);
    const aCellsBeforeBExport = getSourceCells(aPayload.storageHtml, SOURCE_A);
    const bPayload = buildConfluenceStorageTableExportPayload(
      aPayload.storageHtml,
      SOURCE_B,
      EXPORT_SCOPE_B,
      [{
        base64: B_PROVIDED_BASE64,
        fileName: 'b.png',
      }]
    );

    expect(bPayload.images).toEqual([{ base64: B_PROVIDED_BASE64, fileName: 'b.png' }]);
    expect(getSourceCells(bPayload.storageHtml, SOURCE_A)).toEqual(aCellsBeforeBExport);
    expect(bPayload.storageHtml).toContain('data-copy-test-result-image-id="b-id"');
    expect(bPayload.storageHtml).toContain('data-copy-test-evidence-image-id="b-id"');
    expect(bPayload.storageHtml).not.toContain(`data-copy-test-export-scope="${EXPORT_SCOPE_B}"`);
    expect(bPayload.storageHtml).toContain(BUSINESS_CELL);
    expect(bPayload.storageHtml).toContain(FOREIGN_TEST_LIKE_CELL);
  });

  it('使用瞬时 export scope 隔离不同表格里的相同 source key', () => {
    const scopedTarget = createEvidenceCell(SOURCE_A, 'target-id', 'target.png', EXPORT_SCOPE_A);
    const booleanScopedOtherTable = createEvidenceCell(SOURCE_A, 'boolean-id', 'boolean.png')
      .replace('<td ', '<td data-copy-test-export-scope="true" ');
    const otherTokenTable = createEvidenceCell(SOURCE_A, 'other-id', 'other.png', EXPORT_SCOPE_B);
    const storage = [
      `<table><tr>${scopedTarget}</tr></table>`,
      `<table><tr>${booleanScopedOtherTable}</tr></table>`,
      `<table><tr>${otherTokenTable}</tr></table>`,
    ].join('');
    const payload = buildConfluenceStorageTableExportPayload(storage, SOURCE_A, EXPORT_SCOPE_A, [{
      base64: A_PROVIDED_BASE64,
      fileName: 'target.png',
    }]);

    expect(payload.images).toEqual([{ base64: A_PROVIDED_BASE64, fileName: 'target.png' }]);
    expect(payload.storageHtml).not.toContain(`data-copy-test-export-scope="${EXPORT_SCOPE_A}"`);
    expect(payload.storageHtml).toContain(booleanScopedOtherTable);
    expect(payload.storageHtml).toContain(otherTokenTable);

    const rejected = buildConfluenceStorageTableExportPayload(
      storage,
      SOURCE_A,
      'true',
      [{ base64: A_PROVIDED_BASE64, fileName: 'target.png' }]
    );
    expect(rejected).toEqual({ images: [], storageHtml: storage });
  });

  it('不再把 storage 内嵌 base64 当作导出图片来源', () => {
    const embeddedStorage = createEvidenceCell(
      SOURCE_A,
      'embedded-id',
      'embedded.png',
      EXPORT_SCOPE_A
    ).replace(
      '<ac:image ',
      `<ac:image data-copy-test-storage-image-src="${A_PROVIDED_BASE64}" data-copy-test-evidence-image-src="${A_PROVIDED_BASE64}" `
    );
    const payload = buildConfluenceStorageTableExportPayload(
      `<table><tr>${embeddedStorage}</tr></table>`,
      SOURCE_A,
      EXPORT_SCOPE_A
    );

    expect(payload.images).toEqual([]);
    expect(payload.storageHtml).toContain('data-copy-test-storage-image-src=');
    expect(payload.storageHtml).toContain('data-copy-test-evidence-image-src=');
  });
});
