import { describe, expect, it } from 'vitest';
import {
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
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

const IMAGE_BASE64 = 'data:image/png;base64,QUJD';
const SOURCE_A = 'table-0:target-a';
const SOURCE_B = 'table-0:target-b';
const EXPORT_SCOPE_A = 'copytest-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EXPORT_SCOPE_B = 'copytest-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const A_RUNTIME_BASE64 = 'data:image/png;base64,QQ==';
const A_PROVIDED_BASE64 = 'data:image/png;base64,QUE=';
const B_RUNTIME_BASE64 = 'data:image/png;base64,Qg==';
const B_PROVIDED_BASE64 = 'data:image/png;base64,QkI=';
const BUSINESS_BASE64 = 'data:image/png;base64,QlVTSU5FU1M=';
const FOREIGN_BASE64 = 'data:image/png;base64,Rk9SRUlHTg==';

const createResultCell = (
  sourceColumnKey: string,
  imageId: string,
  exportScope?: string
): string => {
  const exportScopeAttribute = exportScope ? ` data-copy-test-export-scope="${exportScope}"` : '';
  return [
    `<td${exportScopeAttribute} data-copy-test-column-type="result" data-copy-test-source-column-key="${sourceColumnKey}">`,
    '<div data-copy-test-generated-content="result" data-copy-test-preview-result="keep">',
    `<ul><li data-copy-test-result-image-id="${imageId}" data-copy-test-result-image-instance-id="${imageId}:1">Screen01</li></ul>`,
    '</div></td>',
  ].join('');
};

const createEvidenceCell = (
  sourceColumnKey: string,
  imageId: string,
  fileName: string,
  base64: string,
  exportScope?: string
): string => {
  const exportScopeAttribute = exportScope ? ` data-copy-test-export-scope="${exportScope}"` : '';
  return [
    `<td${exportScopeAttribute} data-copy-test-column-type="evidence" data-copy-test-source-column-key="${sourceColumnKey}">`,
    '<div data-copy-test-generated-content="evidence">',
    '<div data-copy-test-evidence-card="true">',
    `<ac:image ac:width="7" ac:height="9" data-copy-test-evidence-image-id="${imageId}"`,
    ` data-copy-test-evidence-image-instance-id="${imageId}:1" data-copy-test-evidence-image-src="${base64}"`,
    ` data-copy-test-evidence-image-alt="${fileName}" data-copy-test-preview-temp="preview">`,
    `<ri:attachment ri:filename="${fileName}" />`,
    '</ac:image></div></div></td>',
  ].join('');
};

const BUSINESS_CELL = [
  '<td data-business-format="  keep  ">',
  `<ac:image ac:width="321" ac:height="654" data-copy-test-storage-image-src="${BUSINESS_BASE64}"`,
  ` data-copy-test-evidence-image-src="${BUSINESS_BASE64}" data-copy-test-preview-temp="business">`,
  '<ri:attachment ri:filename="business.png" /></ac:image>',
  '</td>',
].join('');

const FOREIGN_TEST_LIKE_CELL = [
  '<td data-human-column="true"><strong>Test Evidence - Target|values=fr|</strong>',
  `<ac:image ac:width="333" ac:height="444" data-copy-test-evidence-image-src="${FOREIGN_BASE64}"`,
  ' data-copy-test-preview-temp="foreign"><ri:attachment ri:filename="foreign.png" /></ac:image>',
  '</td>',
].join('');

const INVALID_MANAGED_CELL = [
  `<td data-copy-test-column-type="manual" data-copy-test-source-column-key="${SOURCE_A}">`,
  `<ac:image ac:width="555" ac:height="666" data-copy-test-evidence-image-src="${FOREIGN_BASE64}">`,
  '<ri:attachment ri:filename="manual.png" /></ac:image></td>',
].join('');

const A_RESULT_CELL = createResultCell(SOURCE_A, 'a-id', EXPORT_SCOPE_A);
const A_EVIDENCE_CELL = createEvidenceCell(
  SOURCE_A,
  'a-id',
  'a.png',
  A_RUNTIME_BASE64,
  EXPORT_SCOPE_A
);
const B_RESULT_CELL = createResultCell(SOURCE_B, 'b-id', EXPORT_SCOPE_B);
const B_EVIDENCE_CELL = createEvidenceCell(
  SOURCE_B,
  'b-id',
  'b.png',
  B_RUNTIME_BASE64,
  EXPORT_SCOPE_B
);

const EXPORT_STORAGE = [
  '<p data-outside="before">before &amp; untouched</p>',
  '<table data-table-format="keep"><tr>',
  '<th>Business</th><th>Test Evidence - Target|values=fr|</th>',
  `<th data-copy-test-column-type="result" data-copy-test-source-column-key="${SOURCE_A}">A Result</th>`,
  `<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="${SOURCE_A}">A Evidence</th>`,
  `<th data-copy-test-column-type="result" data-copy-test-source-column-key="${SOURCE_B}">B Result</th>`,
  `<th data-copy-test-column-type="evidence" data-copy-test-source-column-key="${SOURCE_B}">B Evidence</th>`,
  '</tr><tr>',
  BUSINESS_CELL,
  FOREIGN_TEST_LIKE_CELL,
  INVALID_MANAGED_CELL,
  A_RESULT_CELL,
  A_EVIDENCE_CELL,
  B_RESULT_CELL,
  B_EVIDENCE_CELL,
  '</tr></table>',
  '<p data-outside="after">after &amp; untouched</p>',
].join('');

const getSourceCellRanges = (storageHtml: string, sourceColumnKey: string): CopyTestRawCellRange[] => {
  const marker = `data-copy-test-source-column-key="${sourceColumnKey}"`;
  return scanTopLevelTableRawRanges(storageHtml).flatMap(table => {
    return table.rows.flatMap(row => {
      return row.cells.filter(cellRange => getRawRangeText(storageHtml, cellRange.openTagRange).includes(marker));
    });
  });
};

const getSourceCells = (storageHtml: string, sourceColumnKey: string): string[] => {
  return getSourceCellRanges(storageHtml, sourceColumnKey)
    .map(cellRange => getRawRangeText(storageHtml, cellRange));
};

describe('copyTestTableImages', () => {
  it('loads and indexes only strict managed Evidence without embedding base64', () => {
    const managedCell = createEvidenceCell(
      SOURCE_A,
      'legacy-id',
      'screen-a.png',
      IMAGE_BASE64
    );
    const html = `<table><tr>${managedCell}${BUSINESS_CELL}${FOREIGN_TEST_LIKE_CELL}${INVALID_MANAGED_CELL}</tr></table>`;
    const images = [{ base64: IMAGE_BASE64, fileName: 'screen-a.png' }];
    expect(getConfluenceStorageTableImageFileNames(html)).toEqual(['screen-a.png']);
    const previewBundle = buildConfluenceStorageTableImagePreviewBundle(html, [
      ...images,
      { base64: BUSINESS_BASE64, fileName: 'business.png' },
      { base64: FOREIGN_BASE64, fileName: 'foreign.png' },
    ]);
    const previewHtml = previewBundle.storageHtml;
    expect(previewBundle.images).toEqual(images);
    const previewManagedCell = getSourceCells(previewHtml, SOURCE_A)[0];
    expect(previewManagedCell).toContain('data-copy-test-evidence-image-id="screen-a.png"');
    expect(previewManagedCell).toContain('data-copy-test-evidence-image-instance-id="screen-a.png:existing:0"');
    expect(previewManagedCell).not.toContain(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE);
    expect(previewManagedCell).not.toContain('data-copy-test-storage-image-src');
    expect(previewHtml).toContain(BUSINESS_CELL);
    expect(previewHtml).toContain(FOREIGN_TEST_LIKE_CELL);
    expect(previewHtml).toContain(INVALID_MANAGED_CELL);

    const doc = parseHtml('<p></p><img alt="x" /><image><attachment filename="screen-c.png" /></image>');
    expect(isStorageImageElement(doc.querySelector('img') as Element)).toBe(true);
    expect(isStorageImageElement(doc.querySelector('p') as Element)).toBe(false);
    expect(getConfluenceStorageTableImageFileNames(doc.body.innerHTML)).toEqual([]);
  });

  it('patches only current A cells while preserving B, foreign, business, and outside bytes', () => {
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
    expect(payload.storageHtml).toContain(`ac:width="${COPY_TEST_EVIDENCE_IMAGE_WIDTH}"`);
    expect(payload.storageHtml).toContain(`ac:height="${COPY_TEST_EVIDENCE_IMAGE_HEIGHT}"`);
    expect(aCells).not.toContain('data-copy-test-result-image-id="a-id"');
    expect(aCells).not.toContain('data-copy-test-evidence-image-id="a-id"');
    expect(aCells).not.toContain('data-copy-test-evidence-card="true"');
    expect(aCells).toContain('data-copy-test-preview-result="keep"');
    expect(payload.storageHtml).toContain(B_RESULT_CELL);
    expect(payload.storageHtml).toContain(B_EVIDENCE_CELL);
    expect(payload.storageHtml).toContain(BUSINESS_CELL);
    expect(payload.storageHtml).toContain(FOREIGN_TEST_LIKE_CELL);
    expect(payload.storageHtml).toContain(INVALID_MANAGED_CELL);
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

  it('keeps cleaned A cells unchanged while independently patching B cells', () => {
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
    expect(bPayload.storageHtml).not.toContain('data-copy-test-result-image-id="b-id"');
    expect(bPayload.storageHtml).not.toContain('data-copy-test-evidence-image-id="b-id"');
    expect(bPayload.storageHtml).toContain(BUSINESS_CELL);
    expect(bPayload.storageHtml).toContain(FOREIGN_TEST_LIKE_CELL);
  });

  it('uses the transient export scope to isolate identical source keys in different tables', () => {
    const scopedTarget = createEvidenceCell(
      SOURCE_A,
      'target-id',
      'target.png',
      A_RUNTIME_BASE64,
      EXPORT_SCOPE_A
    );
    const booleanScopedOtherTable = createEvidenceCell(
      SOURCE_A,
      'boolean-id',
      'boolean.png',
      B_RUNTIME_BASE64
    ).replace('<td ', '<td data-copy-test-export-scope="true" ');
    const otherTokenTable = createEvidenceCell(
      SOURCE_A,
      'other-id',
      'other.png',
      B_RUNTIME_BASE64,
      EXPORT_SCOPE_B
    );
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
});
