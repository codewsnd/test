/**
 * 文件作用：处理 CopyTest 表格中的 Confluence 图片预览、导出清理和图片 payload。
 */
import type { CopyTestImage } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_COLUMN_WIDTH,
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_COLUMN_WIDTH,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from './tableConstants';
import { parseHtml, toConfluenceStorageHtml } from './tableModel';
import { isValidCopyTestExportScope } from './copyTestExportScope';
import {
  getRawRangeText,
  replaceRangesDescending,
  scanTopLevelTableRawRanges,
  type CopyTestRawCellRange,
  type CopyTestRawReplacement,
} from './copyTestStoragePatch';

/** CopyTest 导出给后端的 payload。 */
export interface CopyTestExportPayload {
  /** storage 中实际引用且能从当前内存图片集解析出的附件。 */
  images: CopyTestImage[];
  /** 清除临时导出标记并规范图片尺寸后的完整 storage。 */
  storageHtml: string;
}

/** 导入时分离保存的 storage 和内存预览图片。 */
export interface CopyTestStorageImagePreviewBundle {
  /** storage 通过规范附件文件名引用到的内存预览图片。 */
  images: CopyTestImage[];
  /** 保持原字节不变的 Confluence storage。 */
  storageHtml: string;
}

/** Confluence storage 图片唯一允许的元素名。 */
const STORAGE_IMAGE_TAG_NAME = 'ac:image';

/** Confluence storage 附件唯一允许的元素名。 */
const STORAGE_ATTACHMENT_TAG_NAME = 'ri:attachment';

/** 导出后必须移除的临时作用域属性集合。 */
const COPY_TEST_EXPORT_RUNTIME_ATTRIBUTES = [
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
] as const;

/** iframe 预览运行时属性前缀。 */
const COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX = 'data-copy-test-preview-';

/** 严格 managed 单元格必须同时包含的 ownership 属性名。 */
const COPY_TEST_OWNERSHIP_ATTRIBUTE_NAMES = [
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
] as const;

/** 当前 source column 导出时收集的图片和文件名。 */
interface CopyTestImageExportContext {
  /** 本次导出目标列的瞬时作用域 token。 */
  exportScope: string;
  /** 当前 Evidence 单元格按出现顺序引用的附件文件名集合。 */
  fileNames: Set<string>;
  /** 当前 Result/Evidence 双列所属的源列 key。 */
  sourceColumnKey: string;
}

/** 已解析且 ownership 明确的 CopyTest 单元格。 */
interface CopyTestManagedCell {
  /** 当前 raw range 对应的顶层表格单元格。 */
  cell: HTMLTableCellElement;
  /** 当前 managed 单元格的 Result 或 Evidence 类型。 */
  type: typeof COPY_TEST_GENERATED_EVIDENCE_TYPE | typeof COPY_TEST_GENERATED_RESULT_TYPE;
}

/** 查找 ac:image 的直接 ri:attachment 子元素。 */
const findStorageAttachmentElement = (imageElement: Element): Element | undefined => {
  return Array.from(imageElement.children).find(child => {
    return child.tagName.toLowerCase() === STORAGE_ATTACHMENT_TAG_NAME;
  });
};

/** 仅从 ri:attachment[ri:filename] 读取规范附件文件名。 */
const getStorageImageFileName = (imageElement: Element): string => {
  /** 当前 ac:image 的直接附件子元素。 */
  const attachment = findStorageAttachmentElement(imageElement);
  return attachment?.getAttribute('ri:filename')?.trim() || '';
};

/** 判断元素是否完整符合 ac:image > ri:attachment[ri:filename] 唯一格式。 */
export const isStorageImageElement = (element: Element): boolean => {
  return element.tagName.toLowerCase() === STORAGE_IMAGE_TAG_NAME
    && Boolean(getStorageImageFileName(element));
};

/** 已解析的显式 CopyTest Evidence cell 及其 raw 范围。 */
interface CopyTestManagedEvidenceCell {
  /** 通过 schema 2 ownership 校验的 Evidence 单元格。 */
  cell: HTMLTableCellElement;
  /** Evidence 单元格在原始 storage 中的精确范围。 */
  range: CopyTestRawCellRange;
}

/** 读取 managed 单元格的非空源列 key。 */
const getManagedSourceColumnKey = (cell: Element): string => {
  return cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE)?.trim() || '';
};

/** 校验 schema 2、source key 和 owner id 构成的严格 ownership。 */
const hasStrictCopyTestOwnership = (cell: Element): boolean => {
  /** 当前 managed 单元格声明的非空来源列 key。 */
  const sourceColumnKey = getManagedSourceColumnKey(cell);
  return Boolean(sourceColumnKey)
    && cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE) === COPY_TEST_SCHEMA_VERSION
    && cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE) === sourceColumnKey;
};

/** 判断 raw cell open tag 是否包含完整 ownership 属性名。 */
const hasCompleteCopyTestMetadata = (storageHtml: string, cellRange: CopyTestRawCellRange): boolean => {
  /** 保持 raw 结构的单元格起始标签，用于避免容错解析补齐缺失属性。 */
  const openTag = getRawRangeText(storageHtml, cellRange.openTagRange).toLowerCase();
  return COPY_TEST_OWNERSHIP_ATTRIBUTE_NAMES.every(attributeName => openTag.includes(attributeName));
};

/** 仅解析 ownership 完整且 type 为 evidence 的 schema 2 单元格。 */
const parseManagedEvidenceCell = (rawCell: string): HTMLTableCellElement | null => {
  /** 包装当前 raw 单元格后得到的临时解析文档。 */
  const doc = parseHtml(`<table><tr>${rawCell}</tr></table>`);
  /** 临时文档中的唯一候选表格单元格。 */
  const cell = doc.querySelector<HTMLTableCellElement>('tr > th, tr > td');
  if (!cell
    || !hasStrictCopyTestOwnership(cell)
    || cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) !== COPY_TEST_GENERATED_EVIDENCE_TYPE) {
    return null;
  }
  return cell;
};

/** 只读取当前 managed cell 自身的图片，不跨越嵌套单元格。 */
const getOwnedStorageImageElements = (cell: HTMLTableCellElement): Element[] => {
  return Array.from(cell.querySelectorAll('*')).filter(element => {
    return isStorageImageElement(element) && element.closest('th,td') === cell;
  });
};

/** 扫描所有显式 managed Evidence cells。 */
const getManagedEvidenceCells = (storageHtml: string): CopyTestManagedEvidenceCell[] => {
  return scanTopLevelTableRawRanges(storageHtml).flatMap(table => {
    return table.rows.flatMap(row => {
      return row.cells.flatMap(range => {
        if (!hasCompleteCopyTestMetadata(storageHtml, range)) {
          return [];
        }
        /** 通过严格 ownership 校验后可安全读取图片的 Evidence 单元格。 */
        const cell = parseManagedEvidenceCell(getRawRangeText(storageHtml, range));
        return cell ? [{ cell, range }] : [];
      });
    });
  });
};

/** 读取 storage 内引用到的附件文件名。 */
export const getConfluenceStorageTableImageFileNames = (storageHtml: string): string[] => {
  /** 按首次出现顺序去重保存的规范附件文件名。 */
  const fileNames = new Set<string>();
  getManagedEvidenceCells(storageHtml).forEach(({ cell }) => {
    getOwnedStorageImageElements(cell).forEach(element => {
      /** 当前规范图片元素直接附件节点声明的文件名。 */
      const fileName = getStorageImageFileName(element);
      if (fileName) {
        fileNames.add(fileName);
      }
    });
  });
  return Array.from(fileNames);
};

/** 按规范附件文件名过滤预览图片，并保持导入 storage 原文不变。 */
export const buildConfluenceStorageTableImagePreviewBundle = (
  storageHtml: string,
  images: CopyTestImage[]
): CopyTestStorageImagePreviewBundle => {
  /** storage 中严格 managed Evidence 单元格实际引用的文件名集合。 */
  const requestedFileNames = new Set(getConfluenceStorageTableImageFileNames(storageHtml));
  /** 能与 storage 附件文件名匹配、可供浏览器展示的内存图片。 */
  const previewImages = images.filter(image => requestedFileNames.has(image.fileName));
  return {
    images: previewImages,
    storageHtml,
  };
};

/** 仅在值变化时写入属性。 */
const setAttributeIfChanged = (element: Element, attributeName: string, value: string): boolean => {
  if (element.getAttribute(attributeName) === value) {
    return false;
  }
  element.setAttribute(attributeName, value);
  return true;
};

/** 规范当前 Evidence 图片尺寸并报告是否发生变化。 */
const normalizeEvidenceImageSize = (element: Element): boolean => {
  /** 图片宽度是否被修正为 Confluence 导出固定值。 */
  const widthChanged = setAttributeIfChanged(
    element,
    'ac:width',
    String(COPY_TEST_EVIDENCE_IMAGE_WIDTH)
  );
  /** 图片高度是否被修正为 Confluence 导出固定值。 */
  const heightChanged = setAttributeIfChanged(
    element,
    'ac:height',
    String(COPY_TEST_EVIDENCE_IMAGE_HEIGHT)
  );
  return widthChanged || heightChanged;
};

/** 删除一个存在的属性并报告是否发生变化。 */
const removeAttributeIfPresent = (element: Element, attributeName: string): boolean => {
  if (!element.hasAttribute(attributeName)) {
    return false;
  }
  element.removeAttribute(attributeName);
  return true;
};

/** 清理指定 runtime 属性。 */
const stripNamedRuntimeAttributes = (
  element: Element,
  attributeNames: readonly string[]
): boolean => {
  /** 当前元素是否删除过至少一个命名运行时属性。 */
  let changed = false;
  attributeNames.forEach(attributeName => {
    changed = removeAttributeIfPresent(element, attributeName) || changed;
  });
  return changed;
};

/** 清理 Evidence 预览专用的动态属性。 */
const stripPreviewRuntimeAttributes = (element: Element): boolean => {
  /** 当前元素上所有使用预览运行时前缀的属性名。 */
  const attributeNames = Array.from(element.attributes)
    .map(attribute => attribute.name)
    .filter(attributeName => attributeName.startsWith(COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX));
  attributeNames.forEach(attributeName => element.removeAttribute(attributeName));
  return attributeNames.length > 0;
};

/** 仅清理导出作用域和预览前缀标记，保留稳定图片 metadata。 */
const stripManagedRuntimeAttributes = (element: Element): boolean => {
  /** 固定命名的导出运行时属性是否发生清理。 */
  const namedChanged = stripNamedRuntimeAttributes(element, COPY_TEST_EXPORT_RUNTIME_ATTRIBUTES);
  /** 动态预览运行时属性是否发生清理。 */
  const previewChanged = stripPreviewRuntimeAttributes(element);
  return namedChanged || previewChanged;
};

/** 按唯一文件名构建当前内存图片查找表。 */
const buildImageMap = (images: CopyTestImage[]): Map<string, CopyTestImage> => {
  return new Map(images.map(image => [image.fileName, image]));
};

/** 仅从调用方提供的内存图片构建导出附件 payload。 */
const buildExportImages = (
  fileNames: string[],
  providedImages: CopyTestImage[]
): CopyTestImage[] => {
  /** 以唯一附件文件名索引的调用方内存图片。 */
  const imageMap = buildImageMap(providedImages);
  return fileNames.flatMap(fileName => {
    /** 与当前 storage 附件引用匹配的内存图片。 */
    const image = imageMap.get(fileName);
    return image?.base64.trim()
      ? [{ base64: image.base64, fileName: image.fileName }]
      : [];
  });
};

/** 读取 cell 自身和全部后代元素。 */
const getCellElements = (cell: Element): Element[] => {
  return [cell, ...Array.from(cell.querySelectorAll('*'))];
};

/** 判断 metadata type 是否是受支持的 Result/Evidence 类型。 */
const isManagedColumnType = (
  type: string | null
): type is typeof COPY_TEST_GENERATED_EVIDENCE_TYPE | typeof COPY_TEST_GENERATED_RESULT_TYPE => {
  return type === COPY_TEST_GENERATED_EVIDENCE_TYPE || type === COPY_TEST_GENERATED_RESULT_TYPE;
};

/** 将当前受管 Result 或 Evidence 单元格宽度规范为对应的 Confluence 默认值。 */
const normalizeManagedColumnWidth = (
  cell: HTMLTableCellElement,
  type: CopyTestManagedCell['type']
): boolean => {
  /** 当前生成列类型对应的默认像素宽度。 */
  const width = type === COPY_TEST_GENERATED_RESULT_TYPE
    ? COPY_TEST_RESULT_COLUMN_WIDTH
    : COPY_TEST_EVIDENCE_COLUMN_WIDTH;
  /** 写入 Confluence storage 的规范 CSS 宽度。 */
  const widthStyle = `${width}px`;
  if (cell.style.width === widthStyle) {
    return false;
  }
  cell.style.width = widthStyle;
  return true;
};

/** 按 schema 2 ownership、source key 和导出作用域解析当前 managed cell。 */
const parseManagedCell = (
  rawCell: string,
  sourceColumnKey: string,
  exportScope: string
): CopyTestManagedCell | null => {
  /** 包装当前 raw 单元格后得到的临时解析文档。 */
  const doc = parseHtml(`<table><tr>${rawCell}</tr></table>`);
  /** 临时文档中的唯一候选表格单元格。 */
  const cell = doc.querySelector<HTMLTableCellElement>('tr > th, tr > td');
  if (!cell || !hasStrictCopyTestOwnership(cell)) {
    return null;
  }
  /** 当前单元格是否不属于此次瞬时导出作用域。 */
  const outsideExportScope = cell.getAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE) !== exportScope;
  if (outsideExportScope || getManagedSourceColumnKey(cell) !== sourceColumnKey) {
    return null;
  }
  /** ownership 校验通过后的 managed Result/Evidence 类型。 */
  const type = cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE);
  if (!isManagedColumnType(type)) {
    return null;
  }
  return { cell, type };
};

/** 收集并规范一张当前 owner 的 Evidence 图片。 */
const processEvidenceImage = (
  imageElement: Element,
  context: CopyTestImageExportContext
): boolean => {
  /** 当前规范附件节点声明的非空文件名。 */
  const fileName = getStorageImageFileName(imageElement);
  if (!fileName) {
    return false;
  }
  context.fileNames.add(fileName);
  return normalizeEvidenceImageSize(imageElement);
};

/** 处理当前 owner 的 Evidence cell。 */
const processEvidenceCell = (
  cell: HTMLTableCellElement,
  context: CopyTestImageExportContext
): boolean => {
  /** Evidence 单元格内容是否执行过尺寸规范或运行时属性清理。 */
  let changed = false;
  getCellElements(cell).forEach(element => {
    if (isStorageImageElement(element)) {
      changed = processEvidenceImage(element, context) || changed;
    }
    changed = stripManagedRuntimeAttributes(element) || changed;
  });
  return changed;
};

/** 处理当前 owner 的 Result cell，仅清理作用域和预览属性。 */
const processResultCell = (cell: HTMLTableCellElement): boolean => {
  /** Result 单元格内容是否清理过运行时属性。 */
  let changed = false;
  getCellElements(cell).forEach(element => {
    changed = stripManagedRuntimeAttributes(element) || changed;
  });
  return changed;
};

/** 处理一个显式属于当前 owner 的 raw cell。 */
const buildManagedCellReplacement = (
  storageHtml: string,
  cellRange: CopyTestRawCellRange,
  context: CopyTestImageExportContext
): CopyTestRawReplacement | null => {
  if (!hasCompleteCopyTestMetadata(storageHtml, cellRange)) {
    return null;
  }

  /** 当前顶层单元格在 storage 中未经重写的原始文本。 */
  const rawCell = getRawRangeText(storageHtml, cellRange);
  /** 通过 schema、owner、source key 与 export scope 校验的单元格。 */
  const managedCell = parseManagedCell(
    rawCell,
    context.sourceColumnKey,
    context.exportScope
  );
  if (!managedCell) {
    return null;
  }

  /** 当前 managed 单元格的 Confluence 默认宽度是否发生规范化。 */
  const widthChanged = normalizeManagedColumnWidth(managedCell.cell, managedCell.type);
  /** 对当前 managed 单元格执行类型专属处理后是否发生内容变化。 */
  const contentChanged = managedCell.type === COPY_TEST_GENERATED_EVIDENCE_TYPE
    ? processEvidenceCell(managedCell.cell, context)
    : processResultCell(managedCell.cell);
  if (!widthChanged && !contentChanged) {
    return null;
  }
  return {
    range: cellRange,
    replacement: toConfluenceStorageHtml(managedCell.cell.outerHTML),
  };
};

/** 构建当前 owner 所有 managed cell 的 raw replacements。 */
const buildManagedCellReplacements = (
  storageHtml: string,
  context: CopyTestImageExportContext
): CopyTestRawReplacement[] => {
  return scanTopLevelTableRawRanges(storageHtml).flatMap(table => {
    return table.rows.flatMap(row => {
      return row.cells.flatMap(cellRange => {
        /** 当前 raw 单元格需要应用的精确替换；无变化时为空。 */
        const replacement = buildManagedCellReplacement(storageHtml, cellRange, context);
        return replacement ? [replacement] : [];
      });
    });
  });
};

/** 仅清理当前 source column 的 managed cells，并构造后端上传 payload。 */
export const buildConfluenceStorageTableExportPayload = (
  storageHtml: string,
  sourceColumnKey: string,
  exportScope: string,
  images: CopyTestImage[] = []
): CopyTestExportPayload => {
  if (!isValidCopyTestExportScope(exportScope)) {
    return { images: [], storageHtml };
  }
  /** 当前 source column 导出过程共享的作用域和图片收集状态。 */
  const context: CopyTestImageExportContext = {
    exportScope,
    fileNames: new Set<string>(),
    sourceColumnKey,
  };
  /** 只针对当前 owner managed cells 生成的 raw storage 替换集合。 */
  const replacements = buildManagedCellReplacements(storageHtml, context);
  return {
    images: buildExportImages(Array.from(context.fileNames), images),
    storageHtml: replaceRangesDescending(storageHtml, replacements),
  };
};
