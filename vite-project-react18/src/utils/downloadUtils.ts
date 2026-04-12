import html2canvas from 'html2canvas';

// 默认文件名前缀：与现有下载命名保持一致
const DEFAULT_FILE_PREFIX = 'AI-Generated Frontend Page';

// 浏览器 Canvas 单边尺寸上限（按常见浏览器能力取更高阈值，减少长页面被过度缩小）
const DEFAULT_MAX_SIDE = 32767;

// 总像素上限：64MP，优先保证清晰度，失败时会自动降级 scale
const DEFAULT_MAX_PIXELS = 64_000_000;

const getTimestamp = (): string => {
  // 统一使用数字月份，格式 YYYYMMDDHHmmss
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const buildFileName = (extension: string, filePrefix: string): string => {
  return `${filePrefix}_${getTimestamp()}.${extension}`;
};

const triggerDownload = (blob: Blob, fileName: string): void => {
  // 通用浏览器下载触发逻辑
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const isExternalResourceUrl = (raw: string, baseUri: string): boolean => {
  // data/blob/hash 视为本地可用资源，不作为跨域处理
  const value = raw.trim();
  if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:')) {
    return false;
  }
  try {
    const parsedUrl = new URL(value, baseUri);
    return parsedUrl.origin !== window.location.origin;
  } catch {
    return true;
  }
};

const hasExternalSrcsetUrl = (srcset: string, baseUri: string): boolean => {
  const candidates = srcset
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(/\s+/)[0])
    .filter(Boolean);

  for (const url of candidates) {
    if (isExternalResourceUrl(url, baseUri)) {
      return true;
    }
  }
  return false;
};

export const downloadHtmlFile = (
  htmlContent: string,
  options?: { filePrefix?: string }
): void => {
  // 直接以 UTF-8 文本导出 html
  const filePrefix = options?.filePrefix ?? DEFAULT_FILE_PREFIX;
  const fileName = buildFileName('html', filePrefix);
  const blob = new Blob([htmlContent], {type: 'text/html;charset=utf-8'});
  triggerDownload(blob, fileName);
};

export const downloadPngFromIframe = async (
  iframe: HTMLIFrameElement,
  options?: { filePrefix?: string }
): Promise<void> => {
  const iframeDocument = iframe.contentDocument;
  if (!iframeDocument?.documentElement) {
    throw new Error('No rendered preview page available for image download');
  }

  const rootElement = iframeDocument.documentElement;
  const rawWidth = Math.max(rootElement.scrollWidth, rootElement.clientWidth, iframe.clientWidth);
  const rawHeight = Math.max(rootElement.scrollHeight, rootElement.clientHeight, iframe.clientHeight);

  // 清晰度策略（最佳实践）：
  // 1) 默认优先 2x 渲染，提升文字和边缘锐度
  // 2) 受单边和总像素上限约束，避免浏览器崩溃
  // 3) 高分辨率失败时自动降级重试，保证可导出
  const targetDeviceScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const scaleBySide = DEFAULT_MAX_SIDE / Math.max(1, Math.max(rawWidth, rawHeight));
  const scaleByPixels = Math.sqrt(DEFAULT_MAX_PIXELS / Math.max(1, rawWidth * rawHeight));
  const maxRecommendedScale = Math.max(0.2, Math.min(targetDeviceScale, scaleBySide, scaleByPixels));

  const renderWithScale = async (scale: number): Promise<HTMLCanvasElement> => {
    return html2canvas(rootElement, {
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: rawWidth,
      height: rawHeight,
      windowWidth: rawWidth,
      windowHeight: rawHeight,
      scrollX: 0,
      scrollY: 0,
      scale,
      onclone: (clonedDocument) => {
        // 克隆阶段清理高风险节点，降低 tainted canvas 概率
        const body = clonedDocument.body;
        if (!body) {
          return;
        }
        body.querySelectorAll('script, iframe, object, embed, canvas').forEach((element) => {
          element.remove();
        });
        body.querySelectorAll('img, source').forEach((element) => {
          const src = element.getAttribute('src');
          if (src && isExternalResourceUrl(src, clonedDocument.baseURI)) {
            element.removeAttribute('src');
          }
          const srcset = element.getAttribute('srcset');
          if (srcset && hasExternalSrcsetUrl(srcset, clonedDocument.baseURI)) {
            element.removeAttribute('srcset');
          }
        });
        body.querySelectorAll('*').forEach((element) => {
          const inlineStyle = element.getAttribute('style');
          if (inlineStyle && /url\((?!\s*['"]?(?:data:|blob:))/i.test(inlineStyle)) {
            element.removeAttribute('style');
          }
        });
      },
    });
  };

  let canvas: HTMLCanvasElement | null = null;
  const candidateScales = Array.from(
    new Set(
      [2, 1, maxRecommendedScale, 0.75, 0.5]
        .map((value) => Number(value.toFixed(3)))
        .filter((value) => value >= 0.2)
    )
  );

  let lastError: unknown;
  for (const scale of candidateScales) {
    try {
      canvas = await renderWithScale(scale);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!canvas) {
    throw lastError instanceof Error ? lastError : new Error('Failed to render PNG canvas');
  }

  // PNG 为无损导出，不使用质量参数
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG image'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });

  const filePrefix = options?.filePrefix ?? DEFAULT_FILE_PREFIX;
  triggerDownload(pngBlob, buildFileName('png', filePrefix));
};
