import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertCopyTestExportImageToPng,
  normalizeCopyTestExportImages,
} from '../copyTestExportImages';
import { exportCopyTestTable } from '../index';

/** Canvas 测试替身返回的一像素有效 PNG data URL。 */
const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** 用于验证原生格式不被重复编码的 JPEG 签名数据。 */
const NATIVE_JPEG = 'data:image/jpeg;base64,/9j/AP/Z';

/** 用于触发浏览器转码流程的 WebP data URL。 */
const SOURCE_WEBP = 'data:image/webp;base64,V0VCUA==';

/** 模拟浏览器成功加载一张具有有效尺寸的图片。 */
class SuccessfulImageMock {
  /** 图片渲染高度的兼容回退值。 */
  height = 0;

  /** 图片解码后的原始高度。 */
  naturalHeight = 40;

  /** 图片解码后的原始宽度。 */
  naturalWidth = 80;

  /** 图片加载失败回调。 */
  onerror: (() => void) | null = null;

  /** 图片加载成功回调。 */
  onload: (() => void) | null = null;

  /** 图片渲染宽度的兼容回退值。 */
  width = 0;

  /** 设置图片地址后异步触发成功回调。 */
  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

/** 模拟浏览器无法解码上传图片。 */
class FailedImageMock extends SuccessfulImageMock {
  /** 设置图片地址后异步触发失败回调。 */
  override set src(_value: string) {
    queueMicrotask(() => {
      this.onerror?.();
    });
  }
}

/** 模拟浏览器解码出超过安全边长的图片。 */
class OversizedImageMock extends SuccessfulImageMock {
  /** 超过单图安全限制的原始宽度。 */
  override naturalWidth = 9_000;
}

/** 安装图片和 Canvas 成功转码所需的浏览器测试替身。 */
const installSuccessfulConversionMocks = (): ReturnType<typeof vi.fn> => {
  /** 验证源图片确实被绘制到 Canvas 的方法替身。 */
  const drawImage = vi.fn();
  /** 浏览器二维画布上下文的最小测试替身。 */
  const context = { drawImage } as unknown as CanvasRenderingContext2D;
  /** 浏览器 Canvas 元素的最小测试替身。 */
  const canvas = {
    getContext: vi.fn(() => context),
    height: 0,
    toBlob: vi.fn((callback: BlobCallback) => {
      /** 一像素 PNG data URL 对应的真实二进制。 */
      const binary = globalThis.atob(ONE_PIXEL_PNG.split(',')[1]);
      /** 提供给 FileReader 的有效 PNG Blob。 */
      const blob = new Blob([
        Uint8Array.from(binary, character => character.charCodeAt(0)),
      ], { type: 'image/png' });
      callback(blob);
    }),
    width: 0,
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal('Image', SuccessfulImageMock);
  vi.spyOn(document, 'createElement').mockReturnValue(canvas);
  return drawImage;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('copyTestExportImages', () => {
  it('keeps PNG and JPEG data URLs without browser re-encoding', async () => {
    /** 原生格式校验期间不应发生 Canvas 绘制。 */
    const drawImage = installSuccessfulConversionMocks();
    /** 原生格式规范后的图片数组。 */
    const images = await normalizeCopyTestExportImages([
      { base64: `  ${ONE_PIXEL_PNG}  `, fileName: 'screen.png' },
      { base64: NATIVE_JPEG, fileName: 'screen.jpg' },
    ]);

    expect(images).toEqual([
      { base64: ONE_PIXEL_PNG, fileName: 'screen.png' },
      { base64: NATIVE_JPEG, fileName: 'screen.jpg' },
    ]);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('converts a browser-decodable WebP image to PNG', async () => {
    /** 检查 Canvas 绘制行为的测试替身。 */
    const drawImage = installSuccessfulConversionMocks();

    await expect(convertCopyTestExportImageToPng(SOURCE_WEBP)).resolves.toBe(
      ONE_PIXEL_PNG
    );
    await expect(normalizeCopyTestExportImages([
      { base64: SOURCE_WEBP, fileName: 'screen.webp' },
    ])).resolves.toEqual([
      { base64: ONE_PIXEL_PNG, fileName: 'screen.webp' },
    ]);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('marks an undecodable image as missing instead of silently omitting it', async () => {
    vi.stubGlobal('Image', FailedImageMock);

    await expect(normalizeCopyTestExportImages([
      { base64: SOURCE_WEBP, fileName: 'broken.webp' },
    ])).resolves.toEqual([
      { base64: '', fileName: 'broken.webp' },
    ]);
  });

  it('rejects a damaged native image before an exporter can embed it', async () => {
    vi.stubGlobal('Image', SuccessfulImageMock);

    await expect(normalizeCopyTestExportImages([
      { base64: 'data:image/png;base64,UE5H', fileName: 'damaged.png' },
    ])).resolves.toEqual([
      { base64: '', fileName: 'damaged.png' },
    ]);
  });

  it('rejects an oversized source before allocating a Canvas', async () => {
    vi.stubGlobal('Image', OversizedImageMock);
    /** 确认尺寸校验发生在创建 Canvas 之前的调用监控。 */
    const createElement = vi.spyOn(document, 'createElement');

    await expect(normalizeCopyTestExportImages([
      { base64: SOURCE_WEBP, fileName: 'oversized.webp' },
    ])).resolves.toEqual([
      { base64: '', fileName: 'oversized.webp' },
    ]);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('normalizes images sequentially to cap decoded-image memory', async () => {
    /** 当前同时处于加载状态的图片数量。 */
    let activeImageCount = 0;
    /** 测试期间观察到的最大并行图片数量。 */
    let maximumActiveImageCount = 0;

    /** 记录每张图片开始和结束加载时的并发数。 */
    class SequentialImageMock extends SuccessfulImageMock {
      /** 设置图片地址后在微任务中完成本次加载。 */
      override set src(_value: string) {
        activeImageCount += 1;
        maximumActiveImageCount = Math.max(
          maximumActiveImageCount,
          activeImageCount
        );
        queueMicrotask(() => {
          activeImageCount -= 1;
          this.onload?.();
        });
      }
    }

    vi.stubGlobal('Image', SequentialImageMock);
    await normalizeCopyTestExportImages([
      { base64: ONE_PIXEL_PNG, fileName: 'screen-1.png' },
      { base64: ONE_PIXEL_PNG, fileName: 'screen-2.png' },
      { base64: ONE_PIXEL_PNG, fileName: 'screen-3.png' },
    ]);

    expect(maximumActiveImageCount).toBe(1);
  });

  it('aborts before download when a cached Evidence image is damaged', async () => {
    /** 引用一张已进入缓存但内容损坏图片的最小 Evidence 表格。 */
    const tableHtml = [
      '<table><tr><th data-copy-test-column-type="evidence">Test Evidence - Feature</th></tr>',
      '<tr><td data-copy-test-column-type="evidence">',
      '<div data-copy-test-evidence-card="true"><strong>Screen01</strong>',
      '<ac:image><ri:attachment ri:filename="missing.png" /></ac:image>',
      '</div></td></tr></table>',
    ].join('');

    await expect(exportCopyTestTable({
      format: 'pdf',
      images: [{ base64: 'not-a-data-url', fileName: 'missing.png' }],
      tableHtml,
    })).rejects.toThrow('Test Evidence images are unavailable for export: missing.png');
  });
});
