import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCopyTestExcelMerges,
  buildCopyTestExcelRows,
  createCopyTestExcelBlob,
} from '../copyTestExcelExporter';
import {
  buildCopyTestPdfPageLayout,
  buildCopyTestPdfTableRows,
  createCopyTestPdfBlob,
} from '../copyTestPdfExporter';
import { createCopyTestWordBlob } from '../copyTestWordExporter';
import type {
  CopyTestExportCell,
  CopyTestExportCellImage,
  CopyTestExportRow,
  CopyTestExportTableModel,
} from '../copyTestExportTypes';

/** 可被 jsPDF 和 Word OOXML 真实解析的一像素 PNG。 */
const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** 与第一张图片二进制不同的一像素红色 PNG。 */
const RED_ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

/** Word Open XML 文档对外暴露的标准 MIME 类型。 */
const WORD_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** 用于验证 Word 文本节点转义和回读的全部 XML 特殊字符。 */
const WORD_XML_SPECIAL_TEXT = `A&B <C> "D" 'E'`;

/** Word 文本节点中特殊字符对应的完整 XML 转义结果。 */
const WORD_XML_ESCAPED_SPECIAL_TEXT =
  'A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;';

/** 三种格式共用的完整五列合并表格模型。 */
const EXPORT_MODEL: CopyTestExportTableModel = {
  columnCount: 5,
  missingImageFileNames: [],
  rowCount: 3,
  rows: [
    {
      cells: [
        { colSpan: 2, columnIndex: 0, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Feature / Owner' },
        { colSpan: 1, columnIndex: 2, header: true, images: [], kind: 'result', rowIndex: 0, rowSpan: 1, text: 'Test Result - Feature' },
        { colSpan: 1, columnIndex: 3, header: true, images: [], kind: 'evidence', rowIndex: 0, rowSpan: 1, text: 'Test Evidence - Feature' },
        { colSpan: 1, columnIndex: 4, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Notes' },
      ],
      index: 0,
    },
    {
      cells: [
        { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex: 1, rowSpan: 2, text: 'Flow' },
        { colSpan: 1, columnIndex: 1, header: false, images: [], kind: 'normal', rowIndex: 1, rowSpan: 1, text: 'Owner A' },
        { colSpan: 1, columnIndex: 2, header: false, images: [], kind: 'result', rowIndex: 1, rowSpan: 1, text: 'Passed:\n• Screen01' },
        {
          colSpan: 1,
          columnIndex: 3,
          header: false,
          images: [
            { dataUrl: ONE_PIXEL_PNG, fileName: 'screen-a.png', height: 40, label: 'Screen01', width: 60 },
            { dataUrl: RED_ONE_PIXEL_PNG, fileName: 'screen-b.png', height: 50, label: 'Screen02', width: 70 },
          ],
          kind: 'evidence',
          rowIndex: 1,
          rowSpan: 2,
          text: 'Screen01\nScreen02',
        },
        { colSpan: 1, columnIndex: 4, header: false, images: [], kind: 'normal', rowIndex: 1, rowSpan: 1, text: 'Passed:\nFirst note' },
      ],
      index: 1,
    },
    {
      cells: [
        { colSpan: 1, columnIndex: 1, header: false, images: [], kind: 'normal', rowIndex: 2, rowSpan: 1, text: 'Owner B' },
        { colSpan: 1, columnIndex: 2, header: false, images: [], kind: 'result', rowIndex: 2, rowSpan: 1, text: 'Failed:\n• Copy mismatch' },
        { colSpan: 1, columnIndex: 4, header: false, images: [], kind: 'normal', rowIndex: 2, rowSpan: 1, text: 'LAST-CELL' },
      ],
      index: 2,
    },
  ],
};

/** 首行表头跨入第二物理行的 PDF 合并回归模型。 */
const HEADER_ROWSPAN_PDF_MODEL: CopyTestExportTableModel = {
  columnCount: 3,
  missingImageFileNames: [],
  rowCount: 3,
  rows: [
    {
      cells: [
        { colSpan: 1, columnIndex: 0, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 2, text: 'Merged header' },
        { colSpan: 1, columnIndex: 1, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Header B' },
        { colSpan: 1, columnIndex: 2, header: true, images: [], kind: 'result', rowIndex: 0, rowSpan: 1, text: 'Test Result' },
      ],
      index: 0,
    },
    {
      cells: [
        { colSpan: 1, columnIndex: 1, header: true, images: [], kind: 'normal', rowIndex: 1, rowSpan: 1, text: 'Subheader B' },
        { colSpan: 1, columnIndex: 2, header: true, images: [], kind: 'result', rowIndex: 1, rowSpan: 1, text: 'Subheader Result' },
      ],
      index: 1,
    },
    {
      cells: [
        { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex: 2, rowSpan: 1, text: 'Source value' },
        { colSpan: 1, columnIndex: 1, header: false, images: [], kind: 'normal', rowIndex: 2, rowSpan: 1, text: 'Detail value' },
        { colSpan: 1, columnIndex: 2, header: false, images: [], kind: 'result', rowIndex: 2, rowSpan: 1, text: 'Passed:\n• Screen01' },
      ],
      index: 2,
    },
  ],
};

/** 构建用于验证 PDF 单个高 Evidence 单元格的完整模型。 */
const buildSingleEvidencePdfModel = (
  text: string,
  images: CopyTestExportCellImage[],
  headerText = 'Test Evidence - Feature'
): CopyTestExportTableModel => {
  return {
    columnCount: 1,
    missingImageFileNames: [],
    rowCount: 2,
    rows: [
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: true,
          images: [],
          kind: 'evidence',
          rowIndex: 0,
          rowSpan: 1,
          text: headerText,
        }],
        index: 0,
      },
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: false,
          images,
          kind: 'evidence',
          rowIndex: 1,
          rowSpan: 1,
          text,
        }],
        index: 1,
      },
    ],
  };
};

/** 构建用于验证 PDF Result 文字排版的最小完整模型。 */
const buildSingleResultPdfModel = (
  text: string
): CopyTestExportTableModel => {
  return {
    columnCount: 1,
    missingImageFileNames: [],
    rowCount: 2,
    rows: [
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: true,
          images: [],
          kind: 'result',
          rowIndex: 0,
          rowSpan: 1,
          text: 'Test Result - Module',
        }],
        index: 0,
      },
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: false,
          images: [],
          kind: 'result',
          rowIndex: 1,
          rowSpan: 1,
          text,
        }],
        index: 1,
      },
    ],
  };
};

/** Canvas 多语言绘制测试保存的单行调用信息。 */
interface PdfCanvasTextDraw {
  /** 绘制当前文字行时使用的方向。 */
  direction: CanvasDirection;
  /** 绘制当前文字行时使用的 CSS 颜色。 */
  fillStyle: string;
  /** 绘制当前文字行时使用的完整字体声明。 */
  font: string;
  /** 当前绘制的文字行。 */
  text: string;
}

/** jsPDF 向量文字调用时锁定的状态样式。 */
interface PdfVectorTextDraw {
  /** 绘制当前文字时使用的 CSS 十六进制颜色。 */
  color: string;
  /** 绘制当前文字时使用的字体样式。 */
  fontStyle: string;
  /** 绘制当前文字时所在的真实 PDF 页码。 */
  pageNumber: number;
  /** 当前绘制的文字。 */
  text: string;
}

/** jsPDF text 方法的完整参数，供真实文档绘制调用捕获使用。 */
type PdfTextArguments = Parameters<jsPDF['text']>;

/** 在新建 jsPDF 实例初始化时捕获真实 text 调用。 */
const installPdfTextCapture = (): {
  calls: PdfTextArguments[];
  draws: PdfVectorTextDraw[];
  remove: () => void;
} => {
  /** 当前测试期间所有真实 PDF 文字绘制调用。 */
  const calls: PdfTextArguments[] = [];
  /** 当前测试期间所有真实 PDF 文字绘制样式。 */
  const draws: PdfVectorTextDraw[] = [];
  /** jsPDF 初始化事件中安装到当前文档实例的方法包装器。 */
  const initializedEvent = ['initialized', function (this: jsPDF): void {
    /** 当前文档原始的文字绘制方法。 */
    const originalText = this.text;
    this.text = ((...args: PdfTextArguments): jsPDF => {
      calls.push(args);
      draws.push({
        color: this.getTextColor(),
        fontStyle: this.getFont().fontStyle,
        pageNumber: this.getCurrentPageInfo().pageNumber,
        text: Array.isArray(args[0]) ? args[0].join('\n') : args[0],
      });
      return originalText.apply(this, args);
    }) as jsPDF['text'];
  }];
  jsPDF.API.events.push(initializedEvent);
  return {
    calls,
    draws,
    remove: () => {
      /** 当前初始化事件在 jsPDF 全局事件列表中的位置。 */
      const eventIndex = jsPDF.API.events.indexOf(initializedEvent);
      if (eventIndex >= 0) {
        jsPDF.API.events.splice(eventIndex, 1);
      }
    },
  };
};

/** 安装 PDF Canvas 的最小可测实现并返回真实绘制记录。 */
const installPdfCanvasStub = (): PdfCanvasTextDraw[] => {
  /** Canvas fillText 每次调用时锁定的字体和方向。 */
  const textDraws: PdfCanvasTextDraw[] = [];
  /** PDF 多语言代码实际读取的最小 Canvas 上下文。 */
  const context = {
    direction: 'inherit' as CanvasDirection,
    fillStyle: '#141414',
    font: '',
    measureText: vi.fn((value: string) => ({
      width: Array.from(value).length * 6,
    }) as TextMetrics),
    scale: vi.fn(),
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillText: vi.fn(),
  } satisfies Partial<CanvasRenderingContext2D>;
  context.fillText.mockImplementation((text: string) => {
    textDraws.push({
      direction: context.direction,
      fillStyle: String(context.fillStyle),
      font: context.font,
      text,
    });
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(ONE_PIXEL_PNG);
  return textDraws;
};

/** 读取宽高表格指定列对应的单元格类型。 */
const getWidePdfCellKind = (columnIndex: number): 'evidence' | 'normal' | 'result' => {
  if (columnIndex === 9) {
    return 'result';
  }
  if (columnIndex === 10) {
    return 'evidence';
  }
  return 'normal';
};

/** 生成宽高表格单元格中可追踪的测试文字。 */
const getWidePdfCellText = (
  rowIndex: number,
  columnIndex: number,
  rowCount: number,
  columnCount: number
): string => {
  if (rowIndex === rowCount - 1 && columnIndex === columnCount - 1) {
    return 'LAST-ROW-LAST-COLUMN';
  }
  if (rowIndex === rowCount - 1 && columnIndex === 9) {
    return 'Passed:\n• LateScreen1\nFailed:\n• LateScreen2';
  }
  if (rowIndex === 0) {
    return `Column ${columnIndex + 1}`;
  }
  return `Row ${rowIndex + 1} Column ${columnIndex + 1}`;
};

/** 为宽表最后一行 Evidence 单元格生成会触发整行换页的图片栈。 */
const getWidePdfCellImages = (
  rowIndex: number,
  columnIndex: number,
  rowCount: number
): CopyTestExportCellImage[] => {
  if (rowIndex !== rowCount - 1 || columnIndex !== 10) {
    return [];
  }
  return Array.from({ length: 5 }, (_, imageIndex) => ({
    dataUrl: imageIndex % 2 === 0 ? ONE_PIXEL_PNG : RED_ONE_PIXEL_PNG,
    fileName: `late-screen-${imageIndex + 1}.png`,
    height: 200,
    label: `LateScreen${imageIndex + 1}`,
    width: 100,
  }));
};

/** 构建同时超过 A4 宽度和单页行容量的多行 PDF 表格模型。 */
const buildWideMultiRowPdfModel = (): CopyTestExportTableModel => {
  /** 用于覆盖宽表分页风险的逻辑列数。 */
  const columnCount = 12;
  /** 用于稳定超过单页容量并覆盖大量勾选行的物理行数。 */
  const rowCount = 96;
  return {
    columnCount,
    missingImageFileNames: [],
    rowCount,
    rows: Array.from({ length: rowCount }, (_, rowIndex) => ({
      cells: Array.from({ length: columnCount }, (_, columnIndex) => ({
        colSpan: 1,
        columnIndex,
        header: rowIndex === 0,
        images: getWidePdfCellImages(rowIndex, columnIndex, rowCount),
        kind: getWidePdfCellKind(columnIndex),
        rowIndex,
        rowSpan: 1,
        text: getWidePdfCellText(rowIndex, columnIndex, rowCount, columnCount),
      })),
      index: rowIndex,
    })),
  };
};

/** 构建带完整两行 rowspan 表头的多页 PDF 模型。 */
const buildMultiPageHeaderRowSpanPdfModel = (): CopyTestExportTableModel => {
  /** 用于稳定触发至少两页的正文物理行数。 */
  const bodyRowCount = 80;
  /** 可以完整留在 AutoTable head 区域的前两行表头。 */
  const headerRows = HEADER_ROWSPAN_PDF_MODEL.rows.slice(0, 2);
  return {
    columnCount: 3,
    missingImageFileNames: [],
    rowCount: headerRows.length + bodyRowCount,
    rows: [
      ...headerRows,
      ...Array.from({ length: bodyRowCount }, (_, bodyIndex): CopyTestExportRow => {
        /** 当前正文行在完整表格中的物理行下标。 */
        const rowIndex = headerRows.length + bodyIndex;
        return {
          cells: [
            { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex, rowSpan: 1, text: `Source ${bodyIndex + 1}` },
            { colSpan: 1, columnIndex: 1, header: false, images: [], kind: 'normal', rowIndex, rowSpan: 1, text: `Detail ${bodyIndex + 1}` },
            { colSpan: 1, columnIndex: 2, header: false, images: [], kind: 'result', rowIndex, rowSpan: 1, text: `Result ${bodyIndex + 1}` },
          ],
          index: rowIndex,
        };
      }),
    ],
  };
};

/** 构建两个高 rowspan 正文组，验证分页只发生在完整合并块之间。 */
const buildMultiPageBodyRowSpanPdfModel = (): CopyTestExportTableModel => {
  /** 每个合并组的物理行数会让整块高度超过默认 A4 页高。 */
  const groupRowCount = 48;
  /** 两个完整组用于验证真实纵向分页。 */
  const groupCount = 2;
  /** 除独立表头外的正文物理行数。 */
  const bodyRowCount = groupRowCount * groupCount;
  return {
    columnCount: 2,
    missingImageFileNames: [],
    rowCount: bodyRowCount + 1,
    rows: [
      {
        cells: [
          { colSpan: 1, columnIndex: 0, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Group' },
          { colSpan: 1, columnIndex: 1, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Detail' },
        ],
        index: 0,
      },
      ...Array.from({ length: bodyRowCount }, (_, bodyIndex) => {
        /** 当前正文行在完整表格中的物理行下标。 */
        const rowIndex = bodyIndex + 1;
        /** 当前物理行直接拥有的普通和可选 rowspan 锚点单元格。 */
        const cells: CopyTestExportCell[] = [{
          colSpan: 1,
          columnIndex: 1,
          header: false,
          images: [],
          kind: 'normal',
          rowIndex,
          rowSpan: 1,
          text: `Detail ${bodyIndex + 1}`,
        }];
        if (bodyIndex % groupRowCount === 0) {
          cells.unshift({
            colSpan: 1,
            columnIndex: 0,
            header: false,
            images: [],
            kind: 'normal',
            rowIndex,
            rowSpan: groupRowCount,
            text: `Group ${bodyIndex / groupRowCount + 1}`,
          });
        }
        return { cells, index: rowIndex };
      }),
    ],
  };
};

/** 构建跨三行且包含超页图片栈的 Evidence 分组。 */
const buildTallRowSpanEvidencePdfModel = (): CopyTestExportTableModel => {
  /** 足以让合并 Evidence 单元格跨越多页的缓存图片。 */
  const images = Array.from({ length: 14 }, (_, index) => ({
    dataUrl: index % 2 === 0 ? ONE_PIXEL_PNG : RED_ONE_PIXEL_PNG,
    fileName: `group-screen-${index + 1}.png`,
    height: 200,
    label: `GroupScreen${String(index + 1).padStart(2, '0')}`,
    width: 100,
  }));
  return {
    columnCount: 2,
    missingImageFileNames: [],
    rowCount: 4,
    rows: [
      {
        cells: [
          { colSpan: 1, columnIndex: 0, header: true, images: [], kind: 'normal', rowIndex: 0, rowSpan: 1, text: 'Detail' },
          { colSpan: 1, columnIndex: 1, header: true, images: [], kind: 'evidence', rowIndex: 0, rowSpan: 1, text: 'Test Evidence' },
        ],
        index: 0,
      },
      {
        cells: [
          { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex: 1, rowSpan: 1, text: 'Grouped detail 1' },
          {
            colSpan: 1,
            columnIndex: 1,
            header: false,
            images,
            kind: 'evidence',
            rowIndex: 1,
            rowSpan: 3,
            text: images.map(image => image.label).join('\n'),
          },
        ],
        index: 1,
      },
      {
        cells: [
          { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex: 2, rowSpan: 1, text: 'Grouped detail 2' },
        ],
        index: 2,
      },
      {
        cells: [
          { colSpan: 1, columnIndex: 0, header: false, images: [], kind: 'normal', rowIndex: 3, rowSpan: 1, text: 'Grouped detail 3' },
        ],
        index: 3,
      },
    ],
  };
};

/** 从 CFB ZIP 容器中读取一个文件的二进制内容。 */
const readArchiveFile = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string
): Uint8Array => {
  /** 当前 ZIP 路径对应的 CFB 文件条目。 */
  const entry = XLSX.CFB.find(archive, `Root Entry/${path}`) as {
    /** 当前文件解压后的二进制内容。 */
    content?: ArrayLike<number>;
  } | null;
  return Uint8Array.from(entry?.content || []);
};

/** 从 CFB ZIP 容器中读取一个 UTF-8 XML 文件。 */
const readArchiveXml = (
  archive: ReturnType<typeof XLSX.CFB.read>,
  path: string
): string => {
  return new TextDecoder().decode(readArchiveFile(archive, path));
};

/** 将 Blob 解包为可以检查 OOXML 内部文件的 CFB ZIP 容器。 */
const readBlobArchive = async (
  blob: Blob
): Promise<ReturnType<typeof XLSX.CFB.read>> => {
  return XLSX.CFB.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
};

/** 列出 OOXML 压缩包中的全部真实文件路径。 */
const getArchiveFilePaths = (
  archive: ReturnType<typeof XLSX.CFB.read>
): string[] => {
  return archive.FullPaths
    .map((path: string) => {
      /** 移除 CFB 为 ZIP 文件添加的虚拟根目录前缀。 */
      const pathWithoutRoot = path.startsWith('Root Entry/')
        ? path.slice('Root Entry/'.length)
        : path;
      return pathWithoutRoot.startsWith('/') ? pathWithoutRoot.slice(1) : pathWithoutRoot;
    })
    .filter((path: string) => {
      return Boolean(path) && !path.endsWith('/');
    });
};

/** 从 Word 主文档中查找包含指定文本的完整表格单元格 XML。 */
const getWordTableCellXml = (
  documentXml: string,
  text: string
): string => {
  /** Word 主文档中全部完整单元格的 XML 片段。 */
  const tableCells = documentXml.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) || [];
  return tableCells.find(tableCell => tableCell.includes(text)) || '';
};

/** 从一个 OOXML 关系标签中读取指定属性。 */
const getRelationshipAttribute = (
  relationshipTag: string,
  attributeName: string
): string => {
  return new RegExp(`${attributeName}="([^"]+)"`).exec(relationshipTag)?.[1] || '';
};

/** 构建仅包含一个普通 Word 单元格的文本转义模型。 */
const buildSingleWordTextModel = (
  text: string
): CopyTestExportTableModel => {
  return {
    columnCount: 1,
    missingImageFileNames: [],
    rowCount: 1,
    rows: [{
      cells: [{
        colSpan: 1,
        columnIndex: 0,
        header: false,
        images: [],
        kind: 'normal',
        rowIndex: 0,
        rowSpan: 1,
        text,
      }],
      index: 0,
    }],
  };
};

/** 构建仅包含一个 Evidence 正文单元格的 Word 图片降级模型。 */
const buildSingleWordEvidenceModel = (
  images: CopyTestExportCellImage[]
): CopyTestExportTableModel => {
  return {
    columnCount: 1,
    missingImageFileNames: [],
    rowCount: 2,
    rows: [
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: true,
          images: [],
          kind: 'evidence',
          rowIndex: 0,
          rowSpan: 1,
          text: 'Test Evidence',
        }],
        index: 0,
      },
      {
        cells: [{
          colSpan: 1,
          columnIndex: 0,
          header: false,
          images,
          kind: 'evidence',
          rowIndex: 1,
          rowSpan: 1,
          text: '',
        }],
        index: 1,
      },
    ],
  };
};

/** 将测试 data URL 解码为用于媒体文件比对的二进制。 */
const decodeTestImage = (dataUrl: string): Uint8Array => {
  return Uint8Array.from(globalThis.atob(dataUrl.split(',')[1]), character => {
    return character.charCodeAt(0);
  });
};

/** 从真实 PDF Blob 中统计页面对象数量。 */
const getTestPdfPageCount = async (blob: Blob): Promise<number> => {
  /** PDF 目录中不包含 Pages 容器的实际 Page 对象。 */
  const pageObjects = new TextDecoder('latin1')
    .decode(await blob.arrayBuffer())
    .match(/\/Type \/Page\b/g);
  return pageObjects?.length || 0;
};

/** 从真实 PDF Blob 的第一页读取 MediaBox 点数宽高。 */
const getTestPdfMediaBox = async (blob: Blob): Promise<{ height: number; width: number }> => {
  /** PDF 文本中第一页声明的 MediaBox 四个坐标。 */
  const mediaBox = /\/MediaBox \[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(
    new TextDecoder('latin1').decode(await blob.arrayBuffer())
  );
  if (!mediaBox) {
    throw new Error('PDF MediaBox was not found');
  }
  return {
    height: Number(mediaBox[2]),
    width: Number(mediaBox[1]),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CopyTest format exporters', () => {
  it('exports the complete table, colored Result labels and real Evidence images to Excel', async () => {
    expect(buildCopyTestExcelRows(EXPORT_MODEL)[1]).toEqual([
      'Flow',
      'Owner A',
      'Passed:\n• Screen01',
      'Screen01\nScreen02',
      'Passed:\nFirst note',
    ]);
    expect(buildCopyTestExcelMerges(EXPORT_MODEL)).toEqual([
      { e: { c: 1, r: 0 }, s: { c: 0, r: 0 } },
      { e: { c: 0, r: 2 }, s: { c: 0, r: 1 } },
      { e: { c: 3, r: 2 }, s: { c: 3, r: 1 } },
    ]);

    /** 使用真实 SheetJS 生成的 Excel Blob。 */
    const excelBlob = createCopyTestExcelBlob(EXPORT_MODEL);
    /** 解包 Excel 后用于检查 Drawing、富文本和图片的 CFB 容器。 */
    const archive = await readBlobArchive(excelBlob);
    /** 回读 Excel Blob 后得到的 SheetJS 工作簿。 */
    const workbook = XLSX.read(await excelBlob.arrayBuffer(), { type: 'array' });
    /** 回读工作簿中的唯一 CopyTest 工作表。 */
    const worksheet = workbook.Sheets.CopyTest;
    expect(excelBlob.type).toContain('spreadsheetml');
    expect(worksheet.A2.v).toBe('Flow');
    expect(worksheet.E3.v).toBe('LAST-CELL');
    expect(worksheet.C2.v).toBe('Passed:\n• Screen01');
    expect(worksheet.C3.v).toBe('Failed:\n• Copy mismatch');
    expect(worksheet['!merges']).toEqual([
      { e: { c: 1, r: 0 }, s: { c: 0, r: 0 } },
      { e: { c: 0, r: 2 }, s: { c: 0, r: 1 } },
      { e: { c: 3, r: 2 }, s: { c: 3, r: 1 } },
    ]);
    /** Excel 工作表中包含状态富文本和 Drawing 引用的 XML。 */
    const worksheetXml = readArchiveXml(archive, 'xl/worksheets/sheet1.xml');
    expect(worksheetXml.match(/rgb="FF00875A"/g)).toHaveLength(1);
    expect(worksheetXml.match(/rgb="FFFF0000"/g)).toHaveLength(1);
    expect(worksheetXml).toContain('<drawing');
    expect(worksheetXml).toMatch(/r="D2"[^>]*s="1"/);
    /** 普通 Notes 单元格中的 Passed: 不得继承 Result 状态色。 */
    const ordinaryPassedCell = /<c[^>]*r="E2"[^>]*>[\s\S]*?<\/c>/.exec(
      worksheetXml
    )?.[0];
    expect(ordinaryPassedCell).toContain('Passed:');
    expect(ordinaryPassedCell).not.toContain('rgb=');
    expect(readArchiveXml(archive, 'xl/styles.xml')).toContain(
      'vertical="top" wrapText="1"'
    );
    /** Excel Drawing 中两张图片都锚定在 Evidence 的 D2 单元格。 */
    const drawingXml = readArchiveXml(archive, 'xl/drawings/drawing1.xml');
    expect(drawingXml.match(/<xdr:oneCellAnchor>/g)).toHaveLength(2);
    expect(drawingXml.match(/<xdr:col>3<\/xdr:col>/g)).toHaveLength(2);
    expect(drawingXml.match(/<xdr:row>1<\/xdr:row>/g)).toHaveLength(2);
    expect(readArchiveXml(
      archive,
      'xl/drawings/_rels/drawing1.xml.rels'
    )).toContain('../media/image2.png');
    expect(readArchiveFile(archive, 'xl/media/image1.png')).toEqual(
      decodeTestImage(ONE_PIXEL_PNG)
    );
    expect(readArchiveFile(archive, 'xl/media/image2.png')).toEqual(
      decodeTestImage(RED_ONE_PIXEL_PNG)
    );
  });

  it('colors every Passed and Failed status line in one mixed Excel Result cell', async () => {
    /** 同时包含 Passed 和 Failed 分组的单个 Result 文本。 */
    const mixedResultText = [
      'Passed:',
      '• Screen01',
      'Failed:',
      '• Screen02',
      '  • Copy mismatch',
    ].join('\n');
    /** 使用真实 SheetJS 和 OOXML 补丁生成的混合状态工作簿。 */
    const excelBlob = createCopyTestExcelBlob(
      buildSingleResultPdfModel(mixedResultText)
    );
    /** 混合状态工作簿的工作表 XML。 */
    const worksheetXml = readArchiveXml(
      await readBlobArchive(excelBlob),
      'xl/worksheets/sheet1.xml'
    );
    /** 混合 Result 对应的 A2 单元格 XML。 */
    const mixedResultCell = /<c[^>]*r="A2"[^>]*>[\s\S]*?<\/c>/.exec(
      worksheetXml
    )?.[0];
    /** 回读工作簿验证富文本改写没有改变原始值。 */
    const worksheet = XLSX.read(await excelBlob.arrayBuffer(), {
      type: 'array',
    }).Sheets.CopyTest;

    expect(worksheet.A2.v).toBe(mixedResultText);
    expect(mixedResultCell?.match(/rgb="FF00875A"/g)).toHaveLength(1);
    expect(mixedResultCell?.match(/rgb="FFFF0000"/g)).toHaveLength(1);
    expect(mixedResultCell?.match(/<b\/>/g)).toHaveLength(2);
    expect(mixedResultCell).toContain('• Screen01');
    expect(mixedResultCell).toContain('Copy mismatch');
  });

  it('shows an unavailable marker when Excel cannot embed an image directly', () => {
    /** 仅把第一张 Evidence 图片替换为 Excel 不支持格式的完整模型。 */
    const unsupportedImageModel: CopyTestExportTableModel = {
      ...EXPORT_MODEL,
      rows: EXPORT_MODEL.rows.map(row => ({
        ...row,
        cells: row.cells.map(cell => {
          if (cell.kind !== 'evidence' || cell.header) {
            return cell;
          }
          return {
            ...cell,
            images: [{
              dataUrl: 'data:image/webp;base64,V0VCUA==',
              fileName: 'screen.webp',
              height: 40,
              label: 'Screen01',
              width: 60,
            }],
          };
        }),
      })),
    };

    expect(buildCopyTestExcelRows(unsupportedImageModel)[1][3]).toContain(
      'Screen01: Image unavailable (screen.webp)'
    );
  });

  it('exports a complete fixed-layout Word OOXML table with merges, colors and real images', async () => {
    /** 使用真实 OOXML ZIP 打包流程生成的 Word Blob。 */
    const wordBlob = await createCopyTestWordBlob(EXPORT_MODEL);
    /** Word Blob 的完整 ZIP 二进制，用于验证文件签名。 */
    const wordBytes = new Uint8Array(await wordBlob.arrayBuffer());
    /** Word OOXML 压缩包中的全部文档资源。 */
    const wordArchive = await readBlobArchive(wordBlob);
    /** Word OOXML 压缩包中的全部真实文件路径。 */
    const wordFilePaths = getArchiveFilePaths(wordArchive);
    /** Word 主文档 XML。 */
    const wordDocumentXml = readArchiveXml(wordArchive, 'word/document.xml');
    /** Word OOXML 各文档资源的内容类型声明。 */
    const wordContentTypesXml = readArchiveXml(
      wordArchive,
      '[Content_Types].xml'
    );
    /** Word 根目录指向主文档的关系定义。 */
    const rootRelationshipsXml = readArchiveXml(wordArchive, '_rels/.rels');
    /** Word 压缩包中排除目录条目后的真实媒体文件路径。 */
    const wordMediaPaths = wordFilePaths
      .filter((path: string) => {
        return path.startsWith('word/media/');
      });
    /** Word 文档到真实媒体文件的关系定义。 */
    const wordRelationshipsXml = readArchiveXml(
      wordArchive,
      'word/_rels/document.xml.rels'
    );
    /** Word 文档中的全部图片关系标签。 */
    const wordImageRelationships = wordRelationshipsXml.match(
      /<Relationship\b[^>]*Type="[^"]*\/image"[^>]*\/?>/g
    ) || [];
    /** Word 图片 Drawing 引用的全部关系编号。 */
    const embeddedImageRelationshipIds = Array.from(
      wordDocumentXml.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g),
      match => match[1]
    );
    /** Word 图片关系对应的全部关系编号。 */
    const imageRelationshipIds = wordImageRelationships.map(relationship => {
      return getRelationshipAttribute(relationship, 'Id');
    });
    /** Word 图片关系对应的全部相对媒体路径。 */
    const imageRelationshipTargets = wordImageRelationships.map(relationship => {
      return getRelationshipAttribute(relationship, 'Target');
    });
    /** 包含普通 Passed 文本但不属于 Result 类型的单元格 XML。 */
    const ordinaryPassedCell = getWordTableCellXml(wordDocumentXml, 'First note');

    expect(wordBlob.type).toBe(WORD_MIME_TYPE);
    expect(wordBlob.size).toBeGreaterThan(100);
    expect(Array.from(wordBytes.slice(0, 4))).toEqual([0x50, 0x4B, 0x03, 0x04]);
    expect(wordFilePaths).toEqual(expect.arrayContaining([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
    ]));
    expect(rootRelationshipsXml).toMatch(
      /<Relationship\b(?=[^>]*Type="[^"]*\/officeDocument")(?=[^>]*Target="word\/document\.xml")[^>]*\/?>/
    );
    expect(wordContentTypesXml).toMatch(
      /<Override\b(?=[^>]*PartName="\/word\/document\.xml")(?=[^>]*ContentType="application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml")[^>]*\/?>/
    );
    expect(wordContentTypesXml).toMatch(
      /<Default\b(?=[^>]*Extension="png")(?=[^>]*ContentType="image\/png")[^>]*\/?>/
    );
    expect(wordDocumentXml).toMatch(
      /<w:tblLayout\b[^>]*w:type="fixed"[^>]*\/?>/
    );
    expect(wordDocumentXml).not.toContain('<w:tblHeader');
    expect(wordDocumentXml).toMatch(
      /<w:pgSz\b(?=[^>]*w:w="16838")(?=[^>]*w:h="11906")(?=[^>]*w:orient="landscape")[^>]*\/?>/
    );
    expect(wordDocumentXml).toContain('LAST-CELL');
    expect(wordDocumentXml.match(
      /<w:color\b[^>]*w:val="00875A"[^>]*\/?>/g
    )).toHaveLength(1);
    expect(wordDocumentXml.match(
      /<w:color\b[^>]*w:val="FF0000"[^>]*\/?>/g
    )).toHaveLength(1);
    expect(ordinaryPassedCell).toContain('Passed:');
    expect(ordinaryPassedCell).not.toContain('<w:color');
    expect(wordDocumentXml.match(
      /<w:vMerge\b[^>]*w:val="restart"[^>]*\/?>/g
    )).toHaveLength(2);
    expect(wordDocumentXml.match(
      /<w:vMerge\b[^>]*w:val="continue"[^>]*\/?>/g
    )).toHaveLength(2);
    expect(wordDocumentXml.match(
      /<w:gridSpan\b[^>]*w:val="2"[^>]*\/?>/g
    )).toHaveLength(1);
    expect(wordDocumentXml.match(/<a:blip\b/g)).toHaveLength(2);
    expect(wordMediaPaths).toHaveLength(2);
    expect(wordMediaPaths.map(path => readArchiveFile(wordArchive, path))).toContainEqual(
      decodeTestImage(ONE_PIXEL_PNG)
    );
    expect(wordMediaPaths.map(path => readArchiveFile(wordArchive, path))).toContainEqual(
      decodeTestImage(RED_ONE_PIXEL_PNG)
    );
    expect(wordImageRelationships).toHaveLength(2);
    expect(embeddedImageRelationshipIds).toEqual(imageRelationshipIds);
    expect(imageRelationshipTargets.map(target => target.split('/').pop())).toEqual(
      wordMediaPaths.map(path => path.split('/').pop())
    );
  });

  it('colors both status lines in one mixed Word Result cell', async () => {
    /** 同一 Result 单元格中包含两个状态分组的完整导出文本。 */
    const mixedResultText = [
      'Passed:',
      '• Screen01',
      'Failed:',
      '• Screen02',
      '  • Copy mismatch',
    ].join('\n');
    const wordBlob = await createCopyTestWordBlob(
      buildSingleResultPdfModel(mixedResultText)
    );
    const wordDocumentXml = readArchiveXml(
      await readBlobArchive(wordBlob),
      'word/document.xml'
    );
    const mixedResultCell = getWordTableCellXml(wordDocumentXml, 'Screen02');

    expect(mixedResultCell).toContain('Passed:');
    expect(mixedResultCell).toContain('Failed:');
    expect(mixedResultCell.match(
      /<w:color\b[^>]*w:val="00875A"[^>]*\/?>/g
    )).toHaveLength(1);
    expect(mixedResultCell.match(
      /<w:color\b[^>]*w:val="FF0000"[^>]*\/?>/g
    )).toHaveLength(1);
  });

  it('escapes special characters into valid Word document XML', async () => {
    /** 包含全部文本节点特殊字符的真实 Word Blob。 */
    const wordBlob = await createCopyTestWordBlob(
      buildSingleWordTextModel(WORD_XML_SPECIAL_TEXT)
    );
    /** 特殊字符模型生成的 Word 主文档 XML。 */
    const wordDocumentXml = readArchiveXml(
      await readBlobArchive(wordBlob),
      'word/document.xml'
    );
    /** 通过 XML 解析器回读的 Word 主文档。 */
    const parsedDocument = new DOMParser().parseFromString(
      wordDocumentXml,
      'application/xml'
    );

    expect(wordDocumentXml).toContain(WORD_XML_ESCAPED_SPECIAL_TEXT);
    expect(parsedDocument.querySelector('parsererror')).toBeNull();
  });

  it('falls back for unsupported or invalid Word images without creating media parts', async () => {
    /** Word 不支持的 WebP Evidence 图片。 */
    const unsupportedImage: CopyTestExportCellImage = {
      dataUrl: 'data:image/webp;base64,V0VCUA==',
      fileName: 'screen.webp',
      height: 40,
      label: 'Screen01',
      width: 60,
    };
    /** MIME 可识别但 base64 内容无效的 PNG Evidence 图片。 */
    const invalidImage: CopyTestExportCellImage = {
      dataUrl: 'data:image/png;base64,%%%',
      fileName: 'broken.png',
      height: 40,
      label: 'Screen02',
      width: 60,
    };
    /** 只包含不可嵌入图片的真实 Word Blob。 */
    const wordBlob = await createCopyTestWordBlob(
      buildSingleWordEvidenceModel([unsupportedImage, invalidImage])
    );
    /** 图片降级模型的 Word OOXML 压缩包。 */
    const wordArchive = await readBlobArchive(wordBlob);
    /** 图片降级模型的 Word 主文档 XML。 */
    const wordDocumentXml = readArchiveXml(wordArchive, 'word/document.xml');
    /** 图片降级模型的 Word 文档关系 XML。 */
    const wordRelationshipsXml = readArchiveXml(
      wordArchive,
      'word/_rels/document.xml.rels'
    );
    /** 图片降级模型中意外生成的全部媒体文件。 */
    const wordMediaPaths = getArchiveFilePaths(wordArchive).filter(path => {
      return path.startsWith('word/media/');
    });

    expect(wordDocumentXml).toContain(
      'Image unavailable in Word: screen.webp'
    );
    expect(wordDocumentXml).toContain(
      'Image unavailable in Word: broken.png'
    );
    expect(wordDocumentXml).not.toContain('<a:blip');
    expect(wordRelationshipsXml).not.toContain('/image');
    expect(wordMediaPaths).toEqual([]);
  });

  it('exports the complete table, colored Result labels and Evidence images to PDF', async () => {
    /** 监控真实 PDF 文档中每次 Evidence 图片绘制。 */
    const addImage = vi.spyOn(jsPDF.API, 'addImage');
    /** 使用真实 jsPDF 与 AutoTable 生成的 PDF Blob。 */
    const pdfBlob = createCopyTestPdfBlob(EXPORT_MODEL);
    /** PDF 格式映射后的完整 AutoTable 表头和正文。 */
    const pdfRows = buildCopyTestPdfTableRows(EXPORT_MODEL);

    expect(pdfBlob.type).toBe('application/pdf');
    expect(pdfBlob.size).toBeGreaterThan(100);
    expect(await getTestPdfPageCount(pdfBlob)).toBe(1);
    expect(JSON.stringify(pdfRows)).toContain('LAST-CELL');
    expect(JSON.stringify(pdfRows)).toContain('[0,135,90]');
    expect(JSON.stringify(pdfRows)).toContain('[255,0,0]');
    /** PDF 表头的第一个单元格保留横向合并。 */
    const pdfHeaderCells = pdfRows.head[0] as Array<{ colSpan?: number }>;
    expect(pdfHeaderCells[0].colSpan).toBe(2);
    /** 普通 Notes 单元格即使包含 Passed: 也没有状态颜色。 */
    const pdfFirstBodyCells = pdfRows.body[0] as Array<{
      /** 仅 Result 单元格可具有的状态颜色。 */
      statusColor?: [number, number, number];
    }>;
    expect(pdfFirstBodyCells[4].statusColor).toBeUndefined();
    /** 两张 Evidence 图片按输入顺序绘制且纵向位置递增。 */
    const evidenceImageCalls = addImage.mock.calls.filter(call => {
      return call[0] === ONE_PIXEL_PNG || call[0] === RED_ONE_PIXEL_PNG;
    });
    expect(evidenceImageCalls).toHaveLength(2);
    expect(evidenceImageCalls.map(call => call[0])).toEqual([
      ONE_PIXEL_PNG,
      RED_ONE_PIXEL_PNG,
    ]);
    expect(Number(evidenceImageCalls[1][3])).toBeGreaterThan(
      Number(evidenceImageCalls[0][3])
    );
    expect(new TextDecoder('latin1').decode(await pdfBlob.arrayBuffer())).toContain('/Subtype /Image');
  });

  it('draws PDF Result status, Screen, and failure details on separate baselines', () => {
    /** 真实 jsPDF 文本绘制调用，用于验证 Result 行不会再次重叠。 */
    const textCapture = installPdfTextCapture();
    try {
      createCopyTestPdfBlob(buildSingleResultPdfModel([
        'Failed:',
        '• Screen01',
        '• The expected copy is incomplete.',
      ].join('\n')));
    } finally {
      textCapture.remove();
    }
    /** 红色 Failed 状态的唯一绘制调用。 */
    const statusCall = textCapture.calls.find(call => call[0] === 'Failed:');
    /** 黑色 Screen 引用的唯一绘制调用。 */
    const screenCall = textCapture.calls.find(call => call[0] === '• Screen01');
    /** 黑色失败原因的唯一绘制调用。 */
    const failureCall = textCapture.calls.find(
      call => call[0] === '• The expected copy is incomplete.'
    );

    expect(statusCall).toBeTruthy();
    expect(screenCall).toBeTruthy();
    expect(failureCall).toBeTruthy();
    expect(textCapture.calls.filter(call => call[0] === 'Failed:')).toHaveLength(1);
    expect(Number(screenCall?.[2])).toBeGreaterThan(Number(statusCall?.[2]) + 10);
    expect(Number(failureCall?.[2])).toBeGreaterThan(Number(screenCall?.[2]) + 8);
    expect(statusCall?.[3]).toEqual(expect.objectContaining({ baseline: 'top' }));
  });

  it('colors and bolds every status line in one mixed vector PDF Result cell', () => {
    /** 真实 jsPDF 文本绘制调用和调用时样式。 */
    const textCapture = installPdfTextCapture();
    try {
      createCopyTestPdfBlob(buildSingleResultPdfModel([
        'Passed:',
        '• Screen01',
        'Failed:',
        '• Screen02',
        '  • Copy mismatch',
      ].join('\n')));
    } finally {
      textCapture.remove();
    }
    /** 绿色 Passed 状态行的真实绘制样式。 */
    const passedDraw = textCapture.draws.find(draw => draw.text === 'Passed:');
    /** 红色 Failed 状态行的真实绘制样式。 */
    const failedDraw = textCapture.draws.find(draw => draw.text === 'Failed:');
    /** 普通 Screen 行的真实绘制样式。 */
    const screenDraw = textCapture.draws.find(draw => draw.text === '• Screen02');

    expect(passedDraw).toEqual(expect.objectContaining({
      fontStyle: 'bold',
      text: 'Passed:',
    }));
    expect(passedDraw?.color).toMatch(/^#008[67]5a$/i);
    expect(failedDraw).toEqual(expect.objectContaining({
      color: '#ff0000',
      fontStyle: 'bold',
      text: 'Failed:',
    }));
    expect(screenDraw?.fontStyle).toBe('normal');
    expect(screenDraw?.color).not.toBe(passedDraw?.color);
    expect(screenDraw?.color).not.toBe(failedDraw?.color);
  });

  it('rasterizes multilingual PDF text with browser font fallback and RTL direction', () => {
    /** 多语言 Canvas 实际绘制记录。 */
    const textDraws = installPdfCanvasStub();
    /** 包含多种脚本且必须全部经过浏览器字体回退的 Result 文本。 */
    const multilingualText = [
      'Passed:',
      'Русский текст',
      'Failed:',
      'العربية',
      'हिन्दी',
      'ไทย',
      '日本語',
      '한국어',
      '🙂',
    ].join('\n');
    /** PDF 中实际嵌入的栅格文字图片。 */
    const addImage = vi.spyOn(jsPDF.API, 'addImage');

    createCopyTestPdfBlob(buildSingleResultPdfModel(multilingualText));

    expect(textDraws.map(draw => draw.text)).toEqual(multilingualText.split('\n'));
    expect(textDraws.every(draw => draw.font.includes('"Noto Sans"'))).toBe(true);
    expect(textDraws.find(draw => draw.text === 'Passed:')?.fillStyle).toBe('#00875a');
    expect(textDraws.find(draw => draw.text === 'Failed:')?.fillStyle).toBe('#ff0000');
    expect(textDraws.find(draw => draw.text === 'Passed:')?.font).toContain('700');
    expect(textDraws.find(draw => draw.text === 'Failed:')?.font).toContain('700');
    expect(textDraws.find(draw => draw.text === 'Русский текст')?.fillStyle).toBe('#141414');
    expect(textDraws.find(draw => draw.text === 'العربية')?.direction).toBe('rtl');
    expect(textDraws.find(draw => draw.text === 'Русский текст')?.direction).toBe('ltr');
    expect(addImage.mock.calls.some(call => call[0] === ONE_PIXEL_PNG)).toBe(true);
  });

  it('splits a wide PDF table with many rows and late Evidence across pages', async () => {
    /** 同时要求自然横向宽度和纵向分页的完整表格。 */
    const model = buildWideMultiRowPdfModel();
    /** 捕获最后一个高 Evidence 行中的真实图片绘制。 */
    const addImage = vi.spyOn(
      jsPDF.API as unknown as { addImage: (...args: unknown[]) => jsPDF },
      'addImage'
    );
    /** 捕获每页真实绘制的表头和最后一个单元格。 */
    const textCapture = installPdfTextCapture();
    /** 使用真实 jsPDF 与 AutoTable 生成的多页表格 PDF。 */
    const pdfBlob = (() => {
      try {
        return createCopyTestPdfBlob(model);
      } finally {
        textCapture.remove();
      }
    })();
    /** 真实 PDF 第一页声明的自然宽度和稳定页面高度。 */
    const mediaBox = await getTestPdfMediaBox(pdfBlob);
    /** 真实 PDF 输出的纵向分页数量。 */
    const pageCount = await getTestPdfPageCount(pdfBlob);
    /** PDF 格式映射后的全部正文行。 */
    const pdfRows = buildCopyTestPdfTableRows(model);
    /** AutoTable 最后一个真实正文物理行。 */
    const lastPdfRow = pdfRows.body[pdfRows.body.length - 1] as unknown[];
    /** AutoTable 最后物理行中的最后逻辑单元格。 */
    const lastPdfCell = lastPdfRow[lastPdfRow.length - 1];
    /** 后续页高 Evidence 行中的全部真实图片绘制。 */
    const evidenceImageCalls = addImage.mock.calls.filter(call => {
      return call[0] === ONE_PIXEL_PNG || call[0] === RED_ONE_PIXEL_PNG;
    });
    /** 每一页都应按顺序绘制一次的真实页码。 */
    const expectedPageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

    expect(pageCount).toBeGreaterThan(1);
    expect(mediaBox.width).toBeGreaterThan(841.89);
    expect(mediaBox.height).toBeCloseTo(841.89, 1);
    expect(pdfRows.body).toHaveLength(model.rowCount - 1);
    expect(lastPdfCell).toEqual(expect.objectContaining({
      content: 'LAST-ROW-LAST-COLUMN',
    }));
    expect(textCapture.draws
      .filter(draw => draw.text === 'Column 1')
      .map(draw => draw.pageNumber)).toEqual(expectedPageNumbers);
    expect(textCapture.draws
      .filter(draw => draw.text === 'LAST-ROW-LAST-COLUMN')
      .map(draw => draw.pageNumber)).toEqual([pageCount]);
    expect(textCapture.draws
      .filter(draw => draw.text === 'Passed:' || draw.text === 'Failed:')
      .map(draw => draw.pageNumber)).toEqual([pageCount, pageCount]);
    expect(evidenceImageCalls).toHaveLength(5);
    evidenceImageCalls.forEach(call => {
      /** 当前图片在最终页中的实际纵坐标。 */
      const imageY = Number(call[3]);
      /** 当前图片在最终页中的实际点数高度。 */
      const imageHeight = Number(call[5]);
      expect(imageY).toBeGreaterThanOrEqual(24);
      expect(imageY + imageHeight).toBeLessThanOrEqual(mediaBox.height - 24);
    });
  });

  it('keeps a complete PDF header rowspan section without shifting columns', async () => {
    /** 完整包含 rowspan 的连续表头应共同进入 AutoTable head。 */
    const pdfRows = buildCopyTestPdfTableRows(HEADER_ROWSPAN_PDF_MODEL);
    /** 使用真实布局生成的表头跨行 PDF。 */
    const pdfBlob = createCopyTestPdfBlob(HEADER_ROWSPAN_PDF_MODEL);
    /** 第二物理行中第一个真实单元格的原始模型。 */
    const secondRowFirstCell = (pdfRows.head[1] as unknown[])[0] as {
      /** AutoTable 单元格附带的原始 CopyTest 单元格。 */
      copyTestCell: { columnIndex: number };
    };

    expect(pdfRows.head).toHaveLength(2);
    expect(pdfRows.body).toHaveLength(1);
    expect(secondRowFirstCell.copyTestCell.columnIndex).toBe(1);
    expect(await getTestPdfPageCount(pdfBlob)).toBe(1);
  });

  it('repeats a complete multi-row PDF header section on every page', async () => {
    /** 带两行合并表头并具有大量正文的真实表格模型。 */
    const model = buildMultiPageHeaderRowSpanPdfModel();
    /** 捕获两行表头在每个真实 PDF 页面的绘制位置。 */
    const textCapture = installPdfTextCapture();
    const pdfBlob = (() => {
      try {
        return createCopyTestPdfBlob(model);
      } finally {
        textCapture.remove();
      }
    })();
    /** 真实 PDF 输出的纵向分页数量。 */
    const pageCount = await getTestPdfPageCount(pdfBlob);
    /** 每一页应按顺序包含两行完整表头。 */
    const expectedPageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

    expect(pageCount).toBeGreaterThan(1);
    expect(textCapture.draws
      .filter(draw => draw.text === 'Merged header')
      .map(draw => draw.pageNumber)).toEqual(expectedPageNumbers);
    expect(textCapture.draws
      .filter(draw => draw.text === 'Subheader B')
      .map(draw => draw.pageNumber)).toEqual(expectedPageNumbers);
  });

  it('paginates oversized PDF rowspan body groups across fixed-height pages', async () => {
    /** 两个各自高于默认页内容区的 rowspan 正文组。 */
    const model = buildMultiPageBodyRowSpanPdfModel();
    /** AutoTable 不应记录无法正确绘制高 rowspan 的警告。 */
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    /** 捕获两个合并正文组及重复表头所在的真实页码。 */
    const textCapture = installPdfTextCapture();
    const pdfBlob = (() => {
      try {
        return createCopyTestPdfBlob(model);
      } finally {
        textCapture.remove();
      }
    })();
    /** 固定 A4 高度并由 continuation rows 分页的页面布局。 */
    const pageLayout = buildCopyTestPdfPageLayout(model);
    /** 真实 PDF 输出的纵向分页数量。 */
    const pageCount = await getTestPdfPageCount(pdfBlob);

    expect(pageLayout.height).toBeCloseTo(841.89, 1);
    expect(pageCount).toBeGreaterThan(2);
    expect(textCapture.draws
      .filter(draw => draw.text === 'Group')
      .map(draw => draw.pageNumber)).toEqual(
        Array.from({ length: pageCount }, (_, index) => index + 1)
      );
    expect(textCapture.draws.filter(draw => draw.text === 'Group 1')).toHaveLength(1);
    expect(textCapture.draws.filter(draw => draw.text === 'Group 2')).toHaveLength(1);
    expect(textCapture.draws.filter(draw => draw.text === 'Detail 1')).toHaveLength(1);
    expect(textCapture.draws.filter(draw => draw.text === 'Detail 96')).toHaveLength(1);
    expect(consoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining('will not be drawn correctly')
    );
  });

  it('paginates cached Evidence images inside a grouped rowspan cell', async () => {
    /** 同时覆盖分组 rowspan 和超页 Evidence 图片栈的真实模型。 */
    const model = buildTallRowSpanEvidencePdfModel();
    /** AutoTable 不应尝试直接分页一个超页 rowspan 单元格。 */
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    /** 捕获全部 Evidence 图片的真实 PDF 绘制坐标。 */
    const addImage = vi.spyOn(
      jsPDF.API as unknown as { addImage: (...args: unknown[]) => jsPDF },
      'addImage'
    );
    /** 捕获分组明细和重复表头的真实页码。 */
    const textCapture = installPdfTextCapture();
    /** 使用固定页高 continuation rows 生成的分组 PDF。 */
    const pdfBlob = (() => {
      try {
        return createCopyTestPdfBlob(model);
      } finally {
        textCapture.remove();
      }
    })();
    /** 排除其他图片后得到的全部缓存 Evidence 图片调用。 */
    const evidenceImageCalls = addImage.mock.calls.filter(call => {
      return call[0] === ONE_PIXEL_PNG || call[0] === RED_ONE_PIXEL_PNG;
    });
    /** 分组内容跨页后的真实 PDF 页数。 */
    const pageCount = await getTestPdfPageCount(pdfBlob);

    expect(pageCount).toBeGreaterThan(1);
    expect(evidenceImageCalls).toHaveLength(14);
    evidenceImageCalls.forEach(call => {
      expect(Number(call[5])).toBe(120);
      expect(Number(call[3]) + Number(call[5])).toBeLessThanOrEqual(841.89 - 24);
    });
    expect(textCapture.draws
      .filter(draw => draw.text === 'Test Evidence')
      .map(draw => draw.pageNumber)).toEqual(
        Array.from({ length: pageCount }, (_, index) => index + 1)
      );
    ['Grouped detail 1', 'Grouped detail 2', 'Grouped detail 3'].forEach(text => {
      expect(textCapture.draws.filter(draw => draw.text === text)).toHaveLength(1);
    });
    expect(consoleLog).not.toHaveBeenCalledWith(
      expect.stringContaining('will not be drawn correctly')
    );
  });

  it('paginates one tall PDF Evidence row without shrinking its images', async () => {
    /** 六张纵向排列后会超过一页原始高度的 Evidence 图片。 */
    const images = Array.from({ length: 6 }, (_, index) => ({
      dataUrl: index % 2 === 0 ? ONE_PIXEL_PNG : RED_ONE_PIXEL_PNG,
      fileName: `screen-${index + 1}.png`,
      height: 200,
      label: `Screen${String(index + 1).padStart(2, '0')}`,
      width: 100,
    }));
    /** 具有多行长表头且正文不含 rowspan 的高 Evidence 表格。 */
    const tallEvidenceModel = buildSingleEvidencePdfModel(
      images.map(image => image.label).join('\n'),
      images,
      'Long Test Evidence Header '.repeat(30)
    );
    /** 捕获缩放后全部 Evidence 图片的实际 PDF 坐标。 */
    const addImage = vi.spyOn(jsPDF.API, 'addImage');
    /** 使用固定页高和 continuation rows 生成真实多页 PDF。 */
    const pdfBlob = createCopyTestPdfBlob(tallEvidenceModel);
    /** 排除其他潜在栅格文字后剩余的 Evidence 绘制调用。 */
    const evidenceImageCalls = addImage.mock.calls.filter(call => {
      return call[0] === ONE_PIXEL_PNG || call[0] === RED_ONE_PIXEL_PNG;
    });
    /** 真实 PDF 第一页声明的固定页面尺寸。 */
    const mediaBox = await getTestPdfMediaBox(pdfBlob);
    /** 固定高度页面的右侧安全边界。 */
    const pageRight = mediaBox.width - 24;
    /** 固定高度页面的底部安全边界。 */
    const pageBottom = mediaBox.height - 24;
    /** 最后一张图片的实际 PDF 底边。 */
    const lastImageCall = evidenceImageCalls[evidenceImageCalls.length - 1];
    const lastImageBottom = Number(lastImageCall[3]) + Number(lastImageCall[5]);
    /** 图片纵坐标回到页面顶部表示图片栈已进入下一页。 */
    const imageYPositions = evidenceImageCalls.map(call => Number(call[3]));
    const hasImagePageBreak = imageYPositions.some((imageY, index) => {
      return index > 0 && imageY < imageYPositions[index - 1];
    });

    expect(evidenceImageCalls).toHaveLength(images.length);
    expect(Number(evidenceImageCalls[0][5])).toBe(120);
    expect(mediaBox.height).toBeCloseTo(841.89, 1);
    expect(lastImageBottom).toBeLessThanOrEqual(pageBottom);
    expect(hasImagePageBreak).toBe(true);
    expect(await getTestPdfPageCount(pdfBlob)).toBeGreaterThan(1);
    evidenceImageCalls.forEach((call, index) => {
      /** 当前图片在真实 PDF 页面中的横坐标。 */
      const x = Number(call[2]);
      /** 当前图片在真实 PDF 页面中的纵坐标。 */
      const y = Number(call[3]);
      /** 当前图片在真实 PDF 页面中的点数宽度。 */
      const width = Number(call[4]);
      /** 当前图片在真实 PDF 页面中的点数高度。 */
      const height = Number(call[5]);
      expect(x).toBeGreaterThanOrEqual(24);
      expect(y).toBeGreaterThanOrEqual(24);
      expect(x + width).toBeLessThanOrEqual(pageRight);
      expect(y + height).toBeLessThanOrEqual(pageBottom);
      if (index > 0 && y >= imageYPositions[index - 1]) {
        /** 前一张图片在真实 PDF 页面中的绘制参数。 */
        const previousCall = evidenceImageCalls[index - 1];
        /** 前一张图片不得与当前图片发生纵向重叠的底边。 */
        const previousBottom = Number(previousCall[3]) + Number(previousCall[5]);
        expect(y).toBeGreaterThanOrEqual(previousBottom);
      }
    });
  });

  it('paginates a very large PDF Evidence image cache at full image size', async () => {
    /** 模拟连续选择多个 Comparison Column 后累计缓存的大量 Evidence 图片。 */
    const images = Array.from({ length: 120 }, (_, index) => ({
      dataUrl: index % 2 === 0 ? ONE_PIXEL_PNG : RED_ONE_PIXEL_PNG,
      fileName: `cached-screen-${index + 1}.png`,
      height: 200,
      label: `Screen${String(index + 1).padStart(3, '0')}`,
      width: 100,
    }));
    /** 单个 Evidence 单元格同时包含全部已缓存图片的真实导出模型。 */
    const model = buildSingleEvidencePdfModel(
      images.map(image => image.label).join('\n'),
      images
    );
    /** 捕获跨页后全部 Evidence 图片的实际 PDF 坐标。 */
    const addImage = vi.spyOn(
      jsPDF.API as unknown as { addImage: (...args: unknown[]) => jsPDF },
      'addImage'
    );
    /** 大量图片应生成固定页面高度的真实多页 PDF。 */
    const pdfBlob = createCopyTestPdfBlob(model);
    /** 排除其他潜在栅格文字后剩余的 Evidence 绘制调用。 */
    const evidenceImageCalls = addImage.mock.calls.filter(call => {
      return call[0] === ONE_PIXEL_PNG || call[0] === RED_ONE_PIXEL_PNG;
    });
    /** 真实 PDF 第一页声明的安全页面尺寸。 */
    const mediaBox = await getTestPdfMediaBox(pdfBlob);
    /** 最后一张缓存图片的实际 PDF 底边。 */
    const lastImageCall = evidenceImageCalls[evidenceImageCalls.length - 1];
    const lastImageBottom = Number(lastImageCall[3]) + Number(lastImageCall[5]);
    /** 图片纵坐标回到页面顶部表示图片栈确实跨入了下一页。 */
    const imageYPositions = evidenceImageCalls.map(call => Number(call[3]));
    const hasImagePageBreak = imageYPositions.some((imageY, index) => {
      return index > 0 && imageY < imageYPositions[index - 1];
    });

    expect(evidenceImageCalls).toHaveLength(images.length);
    expect(Number(evidenceImageCalls[0][5])).toBe(120);
    expect(mediaBox.height).toBeCloseTo(841.89, 1);
    expect(lastImageBottom).toBeLessThanOrEqual(mediaBox.height - 24);
    expect(hasImagePageBreak).toBe(true);
    expect(await getTestPdfPageCount(pdfBlob)).toBeGreaterThan(1);
  });

  it('paginates long Evidence text instead of expanding beyond the page limit', async () => {
    /** 超长文字单元格中仍必须保留的一张真实图片。 */
    const image: CopyTestExportCellImage = {
      dataUrl: ONE_PIXEL_PNG,
      fileName: 'screen.png',
      height: 200,
      label: 'Screen01',
      width: 100,
    };
    /** 8pt 下可以放入页面、但按 jsPDF 默认 16pt 会被误判过高的单行文字。 */
    const fittingText = 'Long evidence text '.repeat(90);
    /** 明显高于 A4 但仍可以放进单页 PDF 规范范围的文字。 */
    const tallText = 'Long evidence text '.repeat(220);
    /** 超过 jsPDF 单页安全边长的显式多行文字。 */
    const oversizedText = 'Evidence line\n'.repeat(1_600);

    /** 短内容保持单页，较长和超长内容分别拆为更多固定高度页面。 */
    const fittingPdf = createCopyTestPdfBlob(
      buildSingleEvidencePdfModel(fittingText, [image])
    );
    const tallPdf = createCopyTestPdfBlob(
      buildSingleEvidencePdfModel(tallText, [image])
    );
    const oversizedPdf = createCopyTestPdfBlob(
      buildSingleEvidencePdfModel(oversizedText, [image])
    );
    const tallPageCount = await getTestPdfPageCount(tallPdf);
    expect(await getTestPdfPageCount(fittingPdf)).toBe(1);
    expect(tallPageCount).toBeGreaterThan(1);
    expect(await getTestPdfPageCount(oversizedPdf)).toBeGreaterThan(tallPageCount);
    expect(buildCopyTestPdfPageLayout(
      buildSingleEvidencePdfModel(tallText, [image])
    ).height).toBeCloseTo(841.89, 1);
    expect(buildCopyTestPdfPageLayout(
      buildSingleEvidencePdfModel(oversizedText, [image])
    ).height).toBeCloseTo(841.89, 1);
  });
});
