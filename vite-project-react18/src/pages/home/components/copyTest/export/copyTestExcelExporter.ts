/**
 * 文件作用：使用 SheetJS 将中立表格模型导出为 Excel 文件。
 */
import * as XLSX from 'xlsx';
import {
  COPY_TEST_EXCEL_MIME_TYPE,
  COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH,
  COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH,
  COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH,
} from './copyTestExportConstants';
import { downloadCopyTestBlob } from './copyTestExportDownload';
import {
  canEmbedCopyTestExcelImage,
  COPY_TEST_EXCEL_TEXT_LINE_HEIGHT,
  enhanceCopyTestExcelWorkbook,
  getCopyTestExcelImageContentHeight,
} from './copyTestExcelOoxml';
import type {
  CopyTestExportCell,
  CopyTestExportCellKind,
  CopyTestExportTableModel,
} from './copyTestExportTypes';

/** Excel 工作簿中当前选中表格使用的工作表名称。 */
const COPY_TEST_EXCEL_SHEET_NAME = 'CopyTest';

/** 将 Evidence 图片转换为 Excel 可读的 Screen 标签和缺失图片说明。 */
const buildExcelImageLines = (cell: CopyTestExportCell): string[] => {
  return cell.images.map(image => {
    return canEmbedCopyTestExcelImage(image)
      ? image.label
      : `${image.label}: Image unavailable (${image.fileName})`;
  });
};

/** 生成 Excel 单元格文本，并由 OOXML Drawing 在文字下方展示图片。 */
const getExcelCellText = (cell: CopyTestExportCell): string => {
  /** 当前单元格中每张 Evidence 图片的可追溯文本。 */
  const imageLines = buildExcelImageLines(cell);
  if (imageLines.length === 0) {
    return cell.text;
  }
  /** 去除已被 Screen + 文件名替代的独立 Screen 标签行。 */
  const imageLabels = new Set(cell.images.map(image => image.label));
  /** 当前单元格中不属于独立 Screen 标签的原始文本行。 */
  const contentLines = cell.text.split('\n').filter(line => !imageLabels.has(line));
  return [...contentLines, ...imageLines].filter(Boolean).join('\n');
};

/** 构建保留逻辑空位的二维 Excel 数据。 */
export const buildCopyTestExcelRows = (model: CopyTestExportTableModel): string[][] => {
  /** 按物理行数和逻辑列数初始化的空二维数据。 */
  const rows = Array.from(
    { length: model.rowCount },
    () => Array.from({ length: model.columnCount }, () => '')
  );
  model.rows.forEach(row => {
    row.cells.forEach(cell => {
      rows[cell.rowIndex][cell.columnIndex] = getExcelCellText(cell);
    });
  });
  return rows;
};

/** 构建 SheetJS 使用的全部非单格合并范围。 */
export const buildCopyTestExcelMerges = (
  model: CopyTestExportTableModel
): XLSX.Range[] => {
  return model.rows.flatMap(row => {
    return row.cells.flatMap(cell => {
      if (cell.rowSpan === 1 && cell.colSpan === 1) {
        return [];
      }
      return [{
        e: {
          c: cell.columnIndex + cell.colSpan - 1,
          r: cell.rowIndex + cell.rowSpan - 1,
        },
        s: { c: cell.columnIndex, r: cell.rowIndex },
      }];
    });
  });
};

/** 读取覆盖指定逻辑列的第一个生成列类型。 */
const getColumnKind = (
  model: CopyTestExportTableModel,
  columnIndex: number
): CopyTestExportCellKind => {
  /** 第一个覆盖当前逻辑列的 Result 或 Evidence 单元格。 */
  const generatedCell = model.rows.flatMap(row => row.cells).find(cell => {
    return cell.kind !== 'normal'
      && columnIndex >= cell.columnIndex
      && columnIndex < cell.columnIndex + cell.colSpan;
  });
  return generatedCell?.kind || 'normal';
};

/** 将列类型转换为 SheetJS 像素列宽。 */
const getExcelColumnWidth = (kind: CopyTestExportCellKind): number => {
  if (kind === 'result') {
    return COPY_TEST_EXPORT_RESULT_COLUMN_WIDTH;
  }
  if (kind === 'evidence') {
    return COPY_TEST_EXPORT_EVIDENCE_COLUMN_WIDTH;
  }
  return COPY_TEST_EXPORT_DEFAULT_COLUMN_WIDTH;
};

/** 构建每个逻辑列的 Excel 宽度配置。 */
const buildExcelColumnWidths = (
  model: CopyTestExportTableModel
): XLSX.ColInfo[] => {
  return Array.from({ length: model.columnCount }, (_, columnIndex) => ({
    wpx: getExcelColumnWidth(getColumnKind(model, columnIndex)),
  }));
};

/** 构建能容纳单元格文字和真实 Evidence 图片的 Excel 行高配置。 */
const buildExcelRowHeights = (model: CopyTestExportTableModel): XLSX.RowInfo[] => {
  return model.rows.map(row => {
    /** 当前行锚点单元格中的最大文本行数。 */
    const lineCount = row.cells.reduce((maximum, cell) => {
      return Math.max(maximum, getExcelCellText(cell).split('\n').length);
    }, 1);
    /** 当前行锚点单元格中的最大图片展示高度。 */
    const imageContentHeight = row.cells.reduce((maximum, cell) => {
      return Math.max(maximum, getCopyTestExcelImageContentHeight(cell));
    }, 0);
    return {
      hpx: Math.max(
        24,
        lineCount * COPY_TEST_EXCEL_TEXT_LINE_HEIGHT + imageContentHeight + 6
      ),
    };
  });
};

/** 使用中立模型创建 Excel Blob。 */
export const createCopyTestExcelBlob = (model: CopyTestExportTableModel): Blob => {
  /** 由二维数据生成的 SheetJS 工作表。 */
  const worksheet = XLSX.utils.aoa_to_sheet(buildCopyTestExcelRows(model));
  worksheet['!merges'] = buildCopyTestExcelMerges(model);
  worksheet['!cols'] = buildExcelColumnWidths(model);
  worksheet['!rows'] = buildExcelRowHeights(model);

  /** 只包含当前选中表格的 Excel 工作簿。 */
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, COPY_TEST_EXCEL_SHEET_NAME);
  /** SheetJS 生成的标准 XLSX 基础二进制数组。 */
  const workbookData = XLSX.write(workbook, {
    bookType: 'xlsx',
    compression: true,
    type: 'array',
  }) as ArrayBuffer;
  /** 补入 Result 富文本和 Evidence Drawing 后的最终 XLSX 二进制。 */
  const enhancedWorkbookData = enhanceCopyTestExcelWorkbook(workbookData, model);
  return new Blob([enhancedWorkbookData], { type: COPY_TEST_EXCEL_MIME_TYPE });
};

/** 创建并下载当前选中表格的 Excel 文件。 */
export const exportCopyTestTableToExcel = (
  model: CopyTestExportTableModel,
  fileName: string
): void => {
  downloadCopyTestBlob(createCopyTestExcelBlob(model), fileName);
};
