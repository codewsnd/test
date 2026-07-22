import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCopyTestExportFileName,
  createCopyTestExportTimestamp,
  downloadCopyTestBlob,
} from '../copyTestExportDownload';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('copyTestExportDownload', () => {
  it('uses the local date and requested format in deterministic file names', () => {
    /** 固定为本地时区读取的导出时间。 */
    const exportedAt = new Date(2026, 6, 22, 15, 4, 5);
    expect(createCopyTestExportTimestamp(exportedAt)).toBe('20260722150405');
    expect(createCopyTestExportFileName('pdf', exportedAt)).toBe('20260722150405.pdf');
    expect(createCopyTestExportFileName('word', exportedAt)).toBe('20260722150405.docx');
    expect(createCopyTestExportFileName('excel', exportedAt)).toBe('20260722150405.xlsx');
  });

  it('clicks a temporary link and always revokes its object URL', () => {
    /** 为下载 Blob 返回稳定地址的 URL 替身。 */
    const createObjectURL = vi.fn(() => 'blob:copy-test');
    /** 记录临时 URL 是否被释放的 URL 替身。 */
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    /** 避免测试环境执行真实导航的链接点击替身。 */
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCopyTestBlob(new Blob(['file']), '20260722150405.pdf');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:copy-test');
    expect(document.querySelector('a[download="20260722150405.pdf"]')).toBeNull();
  });
});
