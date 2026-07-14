/**
 * 文件作用：处理 CopyTest 表格中的 Confluence 图片预览、导出清理和图片 payload。
 */
import type { CopyTestImage } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
} from './tableConstants';
import { parseHtml, toConfluenceStorageHtml } from './tableModel';
import { getCopyTestImageId } from './copyTestImageUtils';
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
  images: CopyTestImage[];
  storageHtml: string;
}

/** 导入时分离保存的 storage 和内存预览图片。 */
export interface CopyTestStorageImagePreviewBundle {
  images: CopyTestImage[];
  storageHtml: string;
}

/** 定义 STORAGE_IMAGE_TAG_NAMES 常量。 */
const STORAGE_IMAGE_TAG_NAMES = ['ac:image', 'image', 'img'];

/** 定义 STORAGE_ATTACHMENT_TAG_NAMES 常量。 */
const STORAGE_ATTACHMENT_TAG_NAMES = ['ri:attachment', 'attachment'];

/** 定义 COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE 常量。 */
const COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE = 'data-copy-test-storage-image-src';

/** Evidence 单元格导出时移除的 runtime 属性。 */
const COPY_TEST_EVIDENCE_RUNTIME_ATTRIBUTES = [
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
];

/** Result 单元格导出时仅移除的图片引用属性。 */
const COPY_TEST_RESULT_RUNTIME_ATTRIBUTES = [
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EXPORT_SCOPE_ATTRIBUTE,
];

/** iframe 预览运行时属性前缀。 */
const COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX = 'data-copy-test-preview-';

/** 当前 source column 导出时收集的图片和文件名。 */
interface CopyTestImageExportContext {
  exportScope: string;
  fileNames: Set<string>;
  runtimeImages: CopyTestImage[];
  sourceColumnKey: string;
}

/** 已解析且 ownership 明确的 CopyTest 单元格。 */
interface CopyTestManagedCell {
  cell: HTMLTableCellElement;
  type: typeof COPY_TEST_GENERATED_EVIDENCE_TYPE | typeof COPY_TEST_GENERATED_RESULT_TYPE;
}

/** 判断元素是否是 Confluence storage 图片元素。 */
export const isStorageImageElement = (element: Element): boolean => {
  return STORAGE_IMAGE_TAG_NAMES.includes(element.tagName.toLowerCase());
};

/** 查找图片元素里的附件元素。 */
const findStorageAttachmentElement = (imageElement: Element): Element | undefined => {
  return Array.from(imageElement.children).find(child => {
    return STORAGE_ATTACHMENT_TAG_NAMES.includes(child.tagName.toLowerCase());
  });
};

/** 读取 storage 图片文件名。 */
const getStorageImageFileName = (imageElement: Element): string => {
  const attachment = findStorageAttachmentElement(imageElement);
  return attachment?.getAttribute('ri:filename')
    || attachment?.getAttribute('filename')
    || imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE)
    || '';
};

/** 已解析的显式 CopyTest Evidence cell 及其 raw 范围。 */
interface CopyTestManagedEvidenceCell {
  cell: HTMLTableCellElement;
  range: CopyTestRawCellRange;
}

/** 判断 raw cell 是否可能包含显式 CopyTest ownership。 */
const hasExplicitCopyTestMetadata = (storageHtml: string, cellRange: CopyTestRawCellRange): boolean => {
  const openTag = getRawRangeText(storageHtml, cellRange.openTagRange).toLowerCase();
  return openTag.includes(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE)
    && openTag.includes(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE);
};

/** 仅解析同时具有 evidence type 和非空 source-key 的 cell。 */
const parseManagedEvidenceCell = (rawCell: string): HTMLTableCellElement | null => {
  const doc = parseHtml(`<table><tr>${rawCell}</tr></table>`);
  const cell = doc.querySelector<HTMLTableCellElement>('tr > th, tr > td');
  if (!cell
    || cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) !== COPY_TEST_GENERATED_EVIDENCE_TYPE) {
    return null;
  }
  const sourceColumnKey = cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE)?.trim();
  return sourceColumnKey ? cell : null;
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
        if (!hasExplicitCopyTestMetadata(storageHtml, range)) {
          return [];
        }
        const cell = parseManagedEvidenceCell(getRawRangeText(storageHtml, range));
        return cell ? [{ cell, range }] : [];
      });
    });
  });
};

/** 给一个 managed Evidence cell 补充轻量图片索引并移除历史 base64 runtime 属性。 */
const applyManagedEvidenceImageIndexes = (
  cell: HTMLTableCellElement,
  imageMap: Map<string, CopyTestImage>,
  startIndex: number
): boolean => {
  let changed = false;
  getOwnedStorageImageElements(cell).forEach((element, offset) => {
    changed = removeAttributeIfPresent(element, COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE) || changed;
    changed = removeAttributeIfPresent(element, COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE) || changed;
    const image = imageMap.get(getStorageImageFileName(element));
    if (!image) {
      return;
    }
    const imageId = getCopyTestImageId(image);
    changed = setAttributeIfChanged(element, COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, imageId) || changed;
    changed = setAttributeIfChanged(
      element,
      COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
      `${imageId}:existing:${startIndex + offset}`
    ) || changed;
    changed = setAttributeIfChanged(
      element,
      COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
      image.fileName
    ) || changed;
  });
  return changed;
};

/** 读取 storage 内引用到的附件文件名。 */
export const getConfluenceStorageTableImageFileNames = (storageHtml: string): string[] => {
  const fileNames = new Set<string>();
  getManagedEvidenceCells(storageHtml).forEach(({ cell }) => {
    getOwnedStorageImageElements(cell).forEach(element => {
      const fileName = getStorageImageFileName(element);
      if (fileName) {
        fileNames.add(fileName);
      }
    });
  });
  return Array.from(fileNames);
};

/** 给已有 Confluence 图片补充轻量预览索引，base64 仍保留在独立内存图片集中。 */
export const applyConfluenceStorageTableImages = (
  storageHtml: string,
  images: CopyTestImage[]
): string => {
  const imageMap = new Map(images.map(image => [image.fileName, image]));
  let imageIndex = 0;
  const replacements = getManagedEvidenceCells(storageHtml).flatMap(({ cell, range }) => {
    const changed = applyManagedEvidenceImageIndexes(cell, imageMap, imageIndex);
    imageIndex += getOwnedStorageImageElements(cell).length;
    return changed ? [{
      range,
      replacement: toConfluenceStorageHtml(cell.outerHTML),
    }] : [];
  });
  return replaceRangesDescending(storageHtml, replacements);
};

/** 过滤附件响应并构建不含 base64 的导入 storage bundle。 */
export const buildConfluenceStorageTableImagePreviewBundle = (
  storageHtml: string,
  images: CopyTestImage[]
): CopyTestStorageImagePreviewBundle => {
  const requestedFileNames = new Set(getConfluenceStorageTableImageFileNames(storageHtml));
  const previewImages = images.filter(image => requestedFileNames.has(image.fileName));
  return {
    images: previewImages,
    storageHtml: applyConfluenceStorageTableImages(storageHtml, previewImages),
  };
};

/** 读取 runtime 图片数据。 */
const readRuntimeImage = (imageElement: Element): CopyTestImage | null => {
  const fileName = getStorageImageFileName(imageElement);
  const base64 = imageElement.getAttribute(COPY_TEST_STORAGE_IMAGE_SRC_ATTRIBUTE)
    || imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE)
    || '';
  return fileName && base64 ? { base64, fileName } : null;
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
  const widthChanged = setAttributeIfChanged(
    element,
    'ac:width',
    String(COPY_TEST_EVIDENCE_IMAGE_WIDTH)
  );
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
  let changed = false;
  attributeNames.forEach(attributeName => {
    changed = removeAttributeIfPresent(element, attributeName) || changed;
  });
  return changed;
};

/** 清理 Evidence 预览专用的动态属性。 */
const stripPreviewRuntimeAttributes = (element: Element): boolean => {
  const attributeNames = Array.from(element.attributes)
    .map(attribute => attribute.name)
    .filter(attributeName => attributeName.startsWith(COPY_TEST_PREVIEW_RUNTIME_ATTRIBUTE_PREFIX));
  attributeNames.forEach(attributeName => element.removeAttribute(attributeName));
  return attributeNames.length > 0;
};

/** 清理当前 Evidence 单元格元素的 runtime 属性。 */
const stripEvidenceRuntimeAttributes = (element: Element): boolean => {
  const namedChanged = stripNamedRuntimeAttributes(element, COPY_TEST_EVIDENCE_RUNTIME_ATTRIBUTES);
  const previewChanged = stripPreviewRuntimeAttributes(element);
  return namedChanged || previewChanged;
};

/** 构建图片查找表。 */
const buildImageMap = (
  runtimeImages: CopyTestImage[],
  providedImages: CopyTestImage[]
): Map<string, CopyTestImage> => {
  const imageMap = new Map<string, CopyTestImage>();
  runtimeImages.forEach(image => imageMap.set(image.fileName, image));
  providedImages.forEach(image => imageMap.set(image.fileName, image));
  return imageMap;
};

/** 构建导出图片 payload。 */
const buildExportImages = (
  fileNames: string[],
  runtimeImages: CopyTestImage[],
  providedImages: CopyTestImage[]
): CopyTestImage[] => {
  const imageMap = buildImageMap(runtimeImages, providedImages);
  return fileNames.flatMap(fileName => {
    const image = imageMap.get(fileName);
    return image ? [{ base64: image.base64, fileName: image.fileName }] : [];
  });
};

/** 读取 cell 自身和全部后代元素。 */
const getCellElements = (cell: Element): Element[] => {
  return [cell, ...Array.from(cell.querySelectorAll('*'))];
};
/** 按显式 type/source metadata 解析当前 owner 的 CopyTest cell。 */
const parseManagedCell = (
  rawCell: string,
  sourceColumnKey: string,
  exportScope: string
): CopyTestManagedCell | null => {
  const doc = parseHtml(`<table><tr>${rawCell}</tr></table>`);
  const cell = doc.querySelector<HTMLTableCellElement>('tr > th, tr > td');
  if (!cell) {
    return null;
  }
  const outsideExportScope = cell.getAttribute(COPY_TEST_EXPORT_SCOPE_ATTRIBUTE) !== exportScope;
  if (outsideExportScope
    || cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) !== sourceColumnKey) {
    return null;
  }

  const type = cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE);
  if (type !== COPY_TEST_GENERATED_EVIDENCE_TYPE && type !== COPY_TEST_GENERATED_RESULT_TYPE) {
    return null;
  }
  return { cell, type };
};

/** 收集并规范一张当前 owner 的 Evidence 图片。 */
const processEvidenceImage = (
  imageElement: Element,
  context: CopyTestImageExportContext
): boolean => {
  const fileName = getStorageImageFileName(imageElement);
  if (fileName) {
    context.fileNames.add(fileName);
  }
  const runtimeImage = readRuntimeImage(imageElement);
  if (runtimeImage) {
    context.runtimeImages.push(runtimeImage);
  }
  return normalizeEvidenceImageSize(imageElement);
};

/** 处理当前 owner 的 Evidence cell。 */
const processEvidenceCell = (
  cell: HTMLTableCellElement,
  context: CopyTestImageExportContext
): boolean => {
  let changed = false;
  getCellElements(cell).forEach(element => {
    if (isStorageImageElement(element)) {
      changed = processEvidenceImage(element, context) || changed;
    }
    changed = stripEvidenceRuntimeAttributes(element) || changed;
  });
  return changed;
};

/** 处理当前 owner 的 Result cell，仅清理图片引用 runtime 属性。 */
const processResultCell = (cell: HTMLTableCellElement): boolean => {
  let changed = false;
  getCellElements(cell).forEach(element => {
    changed = stripNamedRuntimeAttributes(element, COPY_TEST_RESULT_RUNTIME_ATTRIBUTES) || changed;
  });
  return changed;
};

/** 处理一个显式属于当前 owner 的 raw cell。 */
const buildManagedCellReplacement = (
  storageHtml: string,
  cellRange: CopyTestRawCellRange,
  context: CopyTestImageExportContext
): CopyTestRawReplacement | null => {
  if (!hasExplicitCopyTestMetadata(storageHtml, cellRange)) {
    return null;
  }

  const rawCell = getRawRangeText(storageHtml, cellRange);
  const managedCell = parseManagedCell(
    rawCell,
    context.sourceColumnKey,
    context.exportScope
  );
  if (!managedCell) {
    return null;
  }

  const changed = managedCell.type === COPY_TEST_GENERATED_EVIDENCE_TYPE
    ? processEvidenceCell(managedCell.cell, context)
    : processResultCell(managedCell.cell);
  if (!changed) {
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
  const context: CopyTestImageExportContext = {
    exportScope,
    fileNames: new Set<string>(),
    runtimeImages: [],
    sourceColumnKey,
  };
  const replacements = buildManagedCellReplacements(storageHtml, context);
  return {
    images: buildExportImages(Array.from(context.fileNames), context.runtimeImages, images),
    storageHtml: replaceRangesDescending(storageHtml, replacements),
  };
};
