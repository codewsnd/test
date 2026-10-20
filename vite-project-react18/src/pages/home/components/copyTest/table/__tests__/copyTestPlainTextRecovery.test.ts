import { describe, expect, it } from 'vitest';
import { ensureCopyTestWorkingColumns } from '../copyTestTableColumns';
import { deleteCopyTestEvidenceImage } from '../copyTestTableState';
import { applyCopyTestValidationResults } from '../copyTestTableRender';
import { parseCopyTestStorageTables, type CopyTestWorkingTable } from '../copyTestTableParser';
import { getConfluenceStorageTableImageFileNames } from '../copyTestTableImages';
import { parseHtml } from '../tableModel';
import {
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE as IMAGE_ID,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE as INSTANCE_ID,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE as ALT,
} from '../tableConstants';

const IDS = [
  '0198f4e0-0000-7000-8000-000000000000.png',
  '0198f4e0-0001-7000-8000-000000000000.png',
  '0198f4e0-0002-7000-8000-000000000000.png',
];
const anchor = (id: string): string => {
  return `<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">copytest-result-${id}</ac:parameter></ac:structured-macro>`;
};
const headers = '<tr><th>Copy</th><th>Test Result - Copy</th><th>Test Evidence - Copy</th></tr>';
const group = (status: string, labels: string[]): string => {
  return `<p><strong>${status}:</strong></p><ul>${labels.map(label => `<li>${label}</li>`).join('')}</ul>`;
};
const evidence = (names: string[]): string => names.map((name, index) => {
  return `<p>${name}</p><p><ac:image><ri:attachment ri:filename="${IDS[index]}" /></ac:image></p>`;
}).join('');
const storage = (result: string, names: string[]): string => {
  return `<table>${headers}<tr><td>业务内容</td><td>${result}</td><td>${evidence(names)}</td></tr></table>`;
};
const load = (html: string): CopyTestWorkingTable => {
  return ensureCopyTestWorkingColumns(parseCopyTestStorageTables(html)[0], 0, 'Copy');
};
const stripMetadata = (html: string): string => {
  return html.replace(/ (?:data-[\w-]+|ac:[\w-]+)="[^"]*"/g, '');
};
const resultText = (table: CopyTestWorkingTable): string => {
  return table.model.rows[1].slots[1]!.cell.element.textContent || '';
};
const remove = (table: CopyTestWorkingTable, index: number): CopyTestWorkingTable => {
  const image = parseHtml(table.workingHtml).querySelectorAll(`[${IMAGE_ID}]`)[index];
  const deleted = deleteCopyTestEvidenceImage(table, {
    imageId: image.getAttribute(IMAGE_ID)!, instanceId: image.getAttribute(INSTANCE_ID)!,
  }, 0, 'Copy');
  expect(deleted.removed).toBe(true);
  return deleted.table;
};

describe('plain text image compatibility', () => {
  it('旧 Anchor 的内部参数不计入文件名，删除仍按可见名称关联', () => {
    const table = load(storage(group('Passed', [`${anchor(IDS[0])}首页`, `${anchor(IDS[1])}付款`]), ['首页', '付款']));
    expect(resultText(table)).not.toContain('copytest-result-');
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[1]]);
    expect(resultText(deleted)).toBe('Passed:付款');
  });

  it.each([0, 1])('旧页图片附件链接与普通图片共享 Evidence，删除第 %i 张同步所有覆盖行', index => {
    const webp = IDS[0].replace('.png', '.webp');
    const first = group('Passed', [`${anchor(IDS[1])}付款`])
      + group('Failed', [`${anchor(webp)}订单<ul><li>文字缺失</li></ul>`]);
    const second = group('Passed', [`${anchor(webp)}订单`, `${anchor(IDS[1])}付款`]);
    const images = `<div><strong>订单</strong><br /><a href="/download/attachments/360553/${webp}?version=1">${webp}</a></div>`
      + `<div><strong>付款</strong><ac:image><ri:attachment ri:filename="${IDS[1]}" /></ac:image></div>`;
    const table = load(`<table>${headers}<tr><td>业务一</td><td>${first}</td><td rowspan="2">${images}</td></tr>`
      + `<tr><td>业务二</td><td>${second}</td></tr></table>`);
    expect(getConfluenceStorageTableImageFileNames(table.workingHtml)).toEqual([webp, IDS[1]]);
    const deleted = remove(table, index);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual(index === 0 ? [IDS[1]] : [webp]);
    const kept = index === 0 ? '付款' : '订单';
    const removed = index === 0 ? '订单' : '付款';
    [1, 2].forEach(row => {
      const text = deleted.model.rows[row].slots[1]!.cell.element.textContent;
      expect(text).toContain(kept);
      expect(text).not.toContain(removed);
      expect(text).not.toContain('copytest-result-');
    });
    expect(resultText(deleted).includes('文字缺失')).toBe(index === 1);
  });

  it('从图片顶部普通文字恢复中文多点名称，删除不同名图只更新对应结果', () => {
    const table = load(storage(group('Passed', ['首页.最终版', '付款']), ['首页.最终版', '付款']));
    expect(parseHtml(table.workingHtml).querySelector(`[${ALT}]`)?.getAttribute(ALT)).toBe('首页.最终版.png');
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[1]]);
    expect(resultText(deleted)).toContain('付款');
    expect(resultText(deleted)).not.toContain('首页');
  });

  it('UUID 和无标题均使用 Image01/02，旧 UUID 结果仍能精确删除', () => {
    const table = load(storage(group('Passed', IDS.slice(0, 2).map(id => id.slice(0, -4))), ['', IDS[1]]));
    const images = parseHtml(table.workingHtml).querySelectorAll(`[${ALT}]`);
    expect(Array.from(images, image => image.getAttribute(ALT))).toEqual(['Image01.png', 'Image02.png']);
    expect(resultText(table)).toContain('Image01');
    expect(resultText(table)).not.toContain('0198f4e0');
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[1]]);
  });

  it('旧 Screen 序号跨 Passed/Failed 排序后仍对应原图', () => {
    const table = load(storage(group('Passed', ['Screen02']) + group('Failed', ['Screen01']), ['', '']));
    const deleted = remove(table, 1);
    expect(resultText(deleted)).toContain('Failed:');
    expect(resultText(deleted)).not.toContain('Passed:');
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[0]]);
  });

  it('旧页同名同状态可删一张，再导入后可删除最后一张', () => {
    const table = load(storage(group('Passed', ['同名', '同名']), ['同名', '同名']));
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[1]]);
    expect(resultText(deleted).match(/同名/g)).toHaveLength(1);
    const empty = remove(load(stripMetadata(deleted.workingHtml)), 0);
    expect(resultText(empty)).toBe('');
    expect(getConfluenceStorageTableImageFileNames(empty.workingHtml)).toEqual([]);
    expect(load(stripMetadata(empty.workingHtml)).headers).toHaveLength(3);
  });

  it('旧同名状态冲突只将剩余同名项标为待校验，不误删不同名图片及原因', () => {
    const table = load(storage(group('Passed', ['同名'])
      + group('Failed', ['同名', '付款<ul><li>文字不一致</li></ul>']), ['同名', '同名', '付款']));
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual(IDS.slice(1));
    expect(resultText(deleted)).toContain('Needs revalidation:');
    expect(resultText(deleted)).toContain('文字不一致');
    expect(resultText(deleted)).not.toContain('Passed:');
    const last = remove(load(stripMetadata(deleted.workingHtml)), 0);
    expect(getConfluenceStorageTableImageFileNames(last.workingHtml)).toEqual([IDS[2]]);
    expect(resultText(last)).not.toContain('Needs revalidation:');
    expect(resultText(last)).toContain('文字不一致');
  });

  it('新同名异状态纯文字关联经三轮清理属性后仍能精确删除', () => {
    const images = IDS.slice(0, 2).map(fileName => ({ fileName, base64: '', originalFileName: '同名.png' }));
    let table = applyCopyTestValidationResults(load(storage('', [])), [{
      rowIndex: 0, passed: true, languageIssues: [], evidenceImageFileNames: IDS.slice(0, 2),
      evidenceImages: images, screenStatuses: [
        { imageId: IDS[0], passed: false, languageIssues: ['错字'] },
        { imageId: IDS[1], passed: true, languageIssues: [] },
      ],
    }], 0, 'Copy', images);
    for (let round = 0; round < 3; round += 1) {
      table = load(stripMetadata(table.workingHtml));
      expect(resultText(table)).toContain('同名 [Image 1]');
      expect(resultText(table)).toContain('同名 [Image 2]');
      expect(table.workingHtml).not.toMatch(/ac:(?:alt|title)|ac:structured-macro|<a /);
    }
    const deleted = remove(table, 0);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[1]]);
    expect(resultText(deleted)).toContain('Passed:');
    expect(resultText(deleted)).not.toContain('Failed:');
  });

  it('新无原名图片采用独立序号，保留属性和清除属性两种回导结果一致', () => {
    const images = IDS.slice(0, 2).map(fileName => ({ fileName, base64: '' }));
    const table = applyCopyTestValidationResults(load(storage('', [])), [{
      rowIndex: 0, passed: true, languageIssues: [], evidenceImageFileNames: IDS.slice(0, 2),
      evidenceImages: images,
    }], 0, 'Copy', images);
    [table.workingHtml, stripMetadata(table.workingHtml)].forEach(html => {
      const imported = load(html);
      expect(resultText(imported)).toContain('Image01');
      expect(resultText(imported)).toContain('Image02');
      expect(resultText(remove(imported, 0))).toContain('Image02');
    });
  });

  it('同一个附件重复出现在旧页同一格时只移除选中的出现位置', () => {
    const html = storage(group('Passed', ['同名', '同名']), ['同名', '同名']).replace(IDS[1], IDS[0]);
    const deleted = remove(load(html), 1);
    expect(parseHtml(deleted.workingHtml).querySelectorAll(`[${IMAGE_ID}]`)).toHaveLength(1);
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[0]]);
    expect(resultText(deleted).match(/同名/g)).toHaveLength(1);
  });

  it('同一个附件用于不同业务行时不跨行误删', () => {
    const row = `<tr><td>业务</td><td>${group('Passed', ['首页'])}</td><td>${evidence(['首页'])}</td></tr>`;
    const table = load(`<table>${headers}${row}<tr><td></td><td></td><td></td></tr>${row}</table>`);
    const deleted = remove(table, 0);
    expect(deleted.model.rows[3].slots[1]!.cell.element.textContent).toContain('首页');
    expect(getConfluenceStorageTableImageFileNames(deleted.workingHtml)).toEqual([IDS[0]]);
  });
});
