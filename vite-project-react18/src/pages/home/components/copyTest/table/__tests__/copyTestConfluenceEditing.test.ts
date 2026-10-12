import { describe, expect, it } from 'vitest';
import { buildPreviewDocumentHtml } from '../../components/tablePreview/tablePreviewDocument';
import { mapPreviewImageUrlsByKey } from '../../components/tablePreview/tablePreviewImages';
import { ensureCopyTestWorkingColumns } from '../copyTestTableColumns';
import { buildCurrentColumnExportStorage } from '../copyTestTableExporter';
import { getConfluenceStorageTableImageFileNames } from '../copyTestTableImages';
import { parseCopyTestStorageTables } from '../copyTestTableParser';
import { parseHtml } from '../tableModel';

const RESULT_HEADER = 'Test Result - Copy';
const EVIDENCE_HEADER = 'Test Evidence - Copy';
const FILE_NAMES = ['replacement.png', 'second.png', 'third.png'];

/** Confluence 编辑保存后的结构：全部自定义属性被移除，内容仍在。 */
const createEditedStorage = (): string => {
  const rows = FILE_NAMES.map((fileName, index) => [
    `<tr><td>Group ${index + 1}</td>`,
    `<td><div><div>AI Comparison</div><div><strong>Passed:</strong><ul><li>screen ${index}</li></ul></div></div></td>`,
    `<td><ac:image><ri:attachment ri:filename="${fileName}" /></ac:image></td></tr>`,
  ].join(''));
  return `<p>Edited text</p><table><tr><th>Copy</th><th>${RESULT_HEADER}</th><th>${EVIDENCE_HEADER}</th></tr>${rows.join('<tr><td></td><td></td><td></td></tr>')}</table>`;
};

describe('Confluence editor compatibility', () => {
  it('keeps every historical result and image visible without adding duplicate columns', () => {
    const imported = parseCopyTestStorageTables(createEditedStorage())[0];
    const table = ensureCopyTestWorkingColumns(imported, 0, 'Copy');
    expect(table.headers).toHaveLength(3);
    expect(imported.originalHtml).not.toContain('data-copy-test-');
    expect(getConfluenceStorageTableImageFileNames(table.workingHtml)).toEqual(FILE_NAMES);

    const urls = Object.fromEntries(FILE_NAMES.map(fileName => [fileName, `blob:${fileName}`]));
    const preview = parseHtml(buildPreviewDocumentHtml(
      table, mapPreviewImageUrlsByKey(table.workingHtml, urls), 0
    ));
    const resultCells = Array.from(preview.querySelectorAll('td'))
      .filter(cell => cell.textContent?.includes('AI Comparison'));
    expect(resultCells).toHaveLength(3);
    expect(resultCells.every(cell => cell.style.display !== 'none')).toBe(true);
    expect(Array.from(preview.querySelectorAll('img')).map(image => image.getAttribute('src')))
      .toEqual(FILE_NAMES.map(fileName => `blob:${fileName}`));
  });

  it('exports back into the original pair and keeps unrelated page text', () => {
    const storage = createEditedStorage();
    const imported = parseCopyTestStorageTables(storage)[0];
    const table = ensureCopyTestWorkingColumns(imported, 0, 'Copy');
    const exported = buildCurrentColumnExportStorage({
      exportScope: 'copytest-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      originalStorageHtml: storage,
      selectedColumnIndex: 0,
      selectedColumnLabel: 'Copy',
      table,
    });
    expect(exported).toContain('<p>Edited text</p>');
    expect(parseCopyTestStorageTables(exported)[0].headers).toHaveLength(3);
    expect(exported.match(/AI Comparison/g)).toHaveLength(3);
    expect(getConfluenceStorageTableImageFileNames(exported)).toEqual(FILE_NAMES);
  });

  it('does not reclaim title-only business columns', () => {
    const storage = createEditedStorage().replaceAll('AI Comparison', 'Human notes');
    const table = parseCopyTestStorageTables(storage)[0];
    expect(table.headers.every(header => !header.generatedType)).toBe(true);
  });

  it('does not guess between duplicate result columns', () => {
    const storage = createEditedStorage().replace(
      `<th>${RESULT_HEADER}</th>`, `<th>${RESULT_HEADER}</th><th>${RESULT_HEADER}</th>`
    );
    const table = parseCopyTestStorageTables(storage)[0];
    expect(table.headers.every(header => !header.generatedType)).toBe(true);
  });

  it('does not override explicit conflicting ownership', () => {
    const storage = createEditedStorage().replace(
      `<th>${RESULT_HEADER}</th>`, `<th data-copy-test-owner-id="other">${RESULT_HEADER}</th>`
    );
    const table = parseCopyTestStorageTables(storage)[0];
    expect(table.headers.every(header => !header.generatedType)).toBe(true);
  });
});
