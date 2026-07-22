import { describe, expect, it } from 'vitest';
import { buildCopyTestExportTableModel } from '../copyTestExportModel';

/** 同时包含纵向合并、Test 双列和两张 Evidence 图片的最小表格。 */
const MERGED_TABLE_HTML = [
  '<table>',
  '<tr><th>Feature</th>',
  '<th data-copy-test-column-type="result">Test Result - Feature</th>',
  '<th data-copy-test-column-type="evidence">Test Evidence - Feature</th></tr>',
  '<tr><td rowspan="2">你好</td>',
  '<td>Passed:<ul><li>Screen01</li></ul></td>',
  '<td rowspan="2" data-copy-test-column-type="evidence">',
  '<div data-copy-test-evidence-card="true"><strong>Screen01</strong><br />',
  '<ac:image ac:width="100" ac:height="200"><ri:attachment ri:filename="screen-a.png" /></ac:image></div>',
  '<div data-copy-test-evidence-card="true"><strong>Screen02</strong><br />',
  '<ac:image ac:width="120" ac:height="80"><ri:attachment ri:filename="screen-b.png" /></ac:image></div>',
  '</td></tr>',
  '<tr><td data-copy-test-column-type="result">Failed:<ul><li>Missing copy</li></ul></td></tr>',
  '</table>',
].join('');

/** 模拟当前浏览器内存中唯一可读取的 Evidence 图片。 */
const AVAILABLE_IMAGE = {
  base64: 'data:image/png;base64,QUJD',
  fileName: 'screen-a.png',
};

describe('buildCopyTestExportTableModel', () => {
  it('keeps anchor cells, merged positions, readable text and image order', () => {
    /** 由完整 workingHtml 构建出的中立表格模型。 */
    const model = buildCopyTestExportTableModel(MERGED_TABLE_HTML, [AVAILABLE_IMAGE]);

    expect(model.columnCount).toBe(3);
    expect(model.rowCount).toBe(3);
    expect(model.rows[1].cells[0]).toMatchObject({
      colSpan: 1,
      columnIndex: 0,
      rowSpan: 2,
      text: '你好',
    });
    expect(model.rows[2].cells).toHaveLength(1);
    expect(model.rows[2].cells[0]).toMatchObject({
      columnIndex: 1,
      kind: 'result',
      text: 'Failed:\n• Missing copy',
    });
    expect(model.rows[1].cells[2].images).toEqual([
      expect.objectContaining({
        dataUrl: AVAILABLE_IMAGE.base64,
        fileName: 'screen-a.png',
        label: 'Screen01',
      }),
      expect.objectContaining({
        dataUrl: undefined,
        fileName: 'screen-b.png',
        label: 'Screen02',
      }),
    ]);
    expect(model.missingImageFileNames).toEqual(['screen-b.png']);
  });

  it('ignores nested-table rows and rejects an out-of-range rowspan', () => {
    /** 包含嵌套表格但只有两行顶层数据的合法 workingHtml。 */
    const nestedTableHtml = '<table><tr><th>A</th></tr><tr><td>Outer<table><tr><td>Inner</td></tr></table></td></tr></table>';
    /** 解析嵌套表格后的顶层模型。 */
    const nestedModel = buildCopyTestExportTableModel(nestedTableHtml, []);
    expect(nestedModel.rowCount).toBe(2);

    expect(() => buildCopyTestExportTableModel(
      '<table><tr><td rowspan="2">Broken</td></tr></table>',
      []
    )).toThrow('invalid merged-cell layout');
  });

  it('rejects HTML without a usable table', () => {
    expect(() => buildCopyTestExportTableModel('<p>not a table</p>', [])).toThrow(
      'No valid table found for export'
    );
  });

  it('does not treat an ordinary business-column image as Test Evidence', () => {
    /** 普通业务列中包含非 managed 图片的模型。 */
    const model = buildCopyTestExportTableModel(
      '<table><tr><td><ac:image><ri:attachment ri:filename="business.png" /></ac:image>Business</td></tr></table>',
      []
    );

    expect(model.rows[0].cells[0].images).toEqual([]);
    expect(model.missingImageFileNames).toEqual([]);
  });
});
