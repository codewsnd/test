/**
 * 文件作用：编辑单张 CopyTest working table，只写当前 Comparison Column 的生成列。
 */
import type {
  CopyTestImage,
  CopyTestValidationResult,
} from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
  COPY_TEST_FAILED_COLOR,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_PASSED_COLOR,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
} from './tableConstants';
import {
  getGeneratedColumnLabel,
  parseHtml,
  parseTableModel,
  toConfluenceStorageHtml,
  type CopyTestCellModel,
  type CopyTestGeneratedColumnType,
  type CopyTestTableModel,
} from './tableModel';
import {
  buildCopyTestRowGroups,
  findGeneratedColumnIndexes,
  getSourceColumnKey,
  refreshWorkingTable,
  type CopyTestRowGroup,
  type CopyTestWorkingTable,
} from './copyTestTableParser';
import { getCopyTestImageId } from './copyTestImageUtils';

/** 支持 CopyTest Evidence 图片的校验结果。 */
export interface CopyTestValidationResultWithEvidence extends CopyTestValidationResult {
  evidenceImages?: CopyTestImage[];
  resultImages?: CopyTestImage[];
}

/** Evidence 图片删除目标。 */
export interface CopyTestEvidenceDeleteTarget {
  imageId: string;
  instanceId?: string;
}

/** Evidence 删除结果。 */
export interface CopyTestEvidenceDeleteResult {
  imageStillUsed: boolean;
  removed: boolean;
  table: CopyTestWorkingTable;
}

/** 生成列上下文。 */
interface GeneratedColumnContext {
  evidenceColumnIndex: number;
  model: CopyTestTableModel;
  resultColumnIndex: number;
  selectedColumnIndex: number;
  selectedColumnLabel: string;
  sourceColumnKey: string;
  tableElement: HTMLTableElement;
}

/** 写入用的图片引用。 */
interface ScreenRef {
  image: CopyTestImage;
  imageId: string;
  instanceId: string;
  label: string;
}

/** Evidence 合并组。 */
interface EvidenceGroup {
  anchorRowIndex: number;
  rowSpan: number;
  screens: ScreenRef[];
  rowGroups: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }>;
}

/** 逻辑行和模型结果的绑定。 */
interface LogicalRowResult {
  result: CopyTestValidationResultWithEvidence | null;
  rowGroup: CopyTestRowGroup;
}

/** 表格行范围。 */
interface TableRowRange {
  end: number;
  start: number;
}

/** 显式 Evidence 分组读取结果。 */
interface ExplicitEvidenceRows {
  rowSpan: number;
  rows: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }>;
}

/** 表格标签名。 */
const TABLE_TAG_NAME = 'table';

/** 数据行起始下标。 */
const FIRST_DATA_ROW_INDEX = 1;

/** Result 状态文案。 */
const PASSED_LABEL = 'Passed:';

/** Result 状态文案。 */
const FAILED_LABEL = 'Failed:';

/** Result 列表项标签名，集中维护 Result 引用节点。 */
const RESULT_LIST_ITEM_TAG = 'li';

/** Result 中图片引用的 Screen 标签格式。 */
const SCREEN_REFERENCE_LABEL_PATTERN = /^Screen\d+$/u;

/** 生成受控内容根节点使用的块级标签名。 */
const COPY_TEST_CONTENT_BLOCK_TAG = 'div';

/** 生成 Result/Evidence 标题节点使用的强调标签名。 */
const COPY_TEST_CONTENT_LABEL_TAG = 'strong';

/** DOM 布尔属性写入时使用的统一字符串值。 */
const DOM_TRUE_ATTRIBUTE_VALUE = 'true';

/** 应用生成列 metadata。 */
const applyGeneratedMetadata = (
  cell: Element,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  cell.setAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE, type);
  cell.setAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE, sourceColumnKey);
};

/** 应用单元格 rowspan。 */
const applyCellRowSpan = (cell: Element, rowSpan: number): void => {
  if (rowSpan > 1) {
    cell.setAttribute('rowspan', String(rowSpan));
    return;
  }

  cell.removeAttribute('rowspan');
};

/** 判断生成单元格是否属于当前 source column。 */
const isGeneratedCellForSource = (
  cell: CopyTestCellModel,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): boolean => {
  return cell.generatedType === type && cell.sourceColumnKey === sourceColumnKey;
};

/** 移除某一行里当前 source column 的生成单元格。 */
const removeGeneratedCellsInRow = (
  model: CopyTestTableModel,
  rowIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows[rowIndex]?.cells
    .filter(cell => isGeneratedCellForSource(cell, type, sourceColumnKey))
    .forEach(cell => cell.element.remove());
};

/** 移除被 rowspan 覆盖的当前 source column 生成单元格。 */
const removeCoveredGeneratedCells = (
  model: CopyTestTableModel,
  rowIndex: number,
  rowSpan: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  for (let offset = 1; offset < rowSpan; offset += 1) {
    removeGeneratedCellsInRow(model, rowIndex + offset, type, sourceColumnKey);
  }
};

/** 读取源列单元格的 rowspan。 */
const getSourceRowSpan = (
  model: CopyTestTableModel,
  rowIndex: number,
  selectedColumnIndex: number
): number => {
  const slot = model.rows[rowIndex]?.slots[selectedColumnIndex];
  return slot?.owned ? slot.cell.rowSpan : 1;
};

/** 判断当前行是否被源列 rowspan 覆盖。 */
const isCoveredBySourceRowSpan = (
  model: CopyTestTableModel,
  rowIndex: number,
  selectedColumnIndex: number
): boolean => {
  const slot = model.rows[rowIndex]?.slots[selectedColumnIndex];
  return Boolean(slot && !slot.owned);
};

/** 创建生成列单元格。 */
const createGeneratedCell = (
  doc: Document,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string,
  text?: string
): HTMLTableCellElement => {
  const cell = doc.createElement(text ? 'th' : 'td');
  applyGeneratedMetadata(cell, type, sourceColumnKey);
  if (text) {
    cell.textContent = text;
  }
  return cell;
};

/** 追加一整列生成列。 */
const appendGeneratedColumn = (
  doc: Document,
  tableElement: HTMLTableElement,
  model: CopyTestTableModel,
  type: CopyTestGeneratedColumnType,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  sourceColumnKey: string
): void => {
  Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tr')).forEach((row, rowIndex) => {
    if (rowIndex > 0 && isCoveredBySourceRowSpan(model, rowIndex, selectedColumnIndex)) {
      return;
    }

    const label = rowIndex === 0 ? getGeneratedColumnLabel(type, selectedColumnLabel) : undefined;
    const cell = createGeneratedCell(doc, type, sourceColumnKey, label);
    applyCellRowSpan(cell, rowIndex > 0 ? getSourceRowSpan(model, rowIndex, selectedColumnIndex) : 1);
    row.appendChild(cell);
  });
};

/** 给已有生成列补齐 metadata。 */
const applyGeneratedMetadataToColumn = (
  model: CopyTestTableModel,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.forEach(row => {
    const slot = row.slots[columnIndex];
    if (slot?.owned) {
      applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
    }
  });
};

/** 确保指定行有可写入的生成列单元格。 */
const ensureWritableGeneratedCell = (
  doc: Document,
  tableElement: HTMLTableElement,
  model: CopyTestTableModel,
  rowIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): HTMLTableCellElement => {
  const slot = model.rows[rowIndex]?.slots[columnIndex];
  if (slot?.owned && slot.cell.element instanceof HTMLTableCellElement) {
    applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
    return slot.cell.element;
  }

  const modelRow = model.rows[rowIndex];
  const row = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tr'))[rowIndex];
  const cell = doc.createElement('td');
  const nextOwnedCell = modelRow?.cells.find(item => item.columnIndex > columnIndex)?.element;
  applyGeneratedMetadata(cell, type, sourceColumnKey);
  row?.insertBefore(cell, nextOwnedCell || null);
  return cell;
};

/** 同步生成列的基础 rowspan。 */
const syncGeneratedColumnSpans = (
  doc: Document,
  tableElement: HTMLTableElement,
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.slice(FIRST_DATA_ROW_INDEX).forEach(row => {
    if (isCoveredBySourceRowSpan(model, row.index, selectedColumnIndex)) {
      removeGeneratedCellsInRow(model, row.index, type, sourceColumnKey);
      return;
    }

    const rowSpan = getSourceRowSpan(model, row.index, selectedColumnIndex);
    const cell = ensureWritableGeneratedCell(doc, tableElement, model, row.index, columnIndex, type, sourceColumnKey);
    applyCellRowSpan(cell, rowSpan);
    removeCoveredGeneratedCells(model, row.index, rowSpan, type, sourceColumnKey);
  });
};

/** 确保当前 Comparison Column 的 Result/Evidence 两列存在。 */
export const ensureCopyTestGeneratedColumns = (
  tableHtml: string,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): { context: GeneratedColumnContext; html: string } | null => {
  const doc = parseHtml(tableHtml);
  const tableElement = doc.querySelector<HTMLTableElement>(TABLE_TAG_NAME);
  if (!tableElement) {
    return null;
  }

  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  const initialModel = parseTableModel(tableElement);
  const initialIndexes = findGeneratedColumnIndexes(initialModel.headers, sourceColumnKey, selectedColumnLabel);
  const resultColumnCreated = initialIndexes.result === undefined;
  const evidenceColumnCreated = initialIndexes.evidence === undefined;
  if (resultColumnCreated) {
    appendGeneratedColumn(
      doc,
      tableElement,
      initialModel,
      COPY_TEST_GENERATED_RESULT_TYPE,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey
    );
  }
  if (evidenceColumnCreated) {
    appendGeneratedColumn(
      doc,
      tableElement,
      initialModel,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey
    );
  }

  const model = parseTableModel(tableElement);
  const indexes = findGeneratedColumnIndexes(model.headers, sourceColumnKey, selectedColumnLabel);
  if (indexes.result === undefined || indexes.evidence === undefined) {
    return null;
  }

  applyGeneratedMetadataToColumn(model, indexes.result, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey);
  applyGeneratedMetadataToColumn(model, indexes.evidence, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey);
  if (resultColumnCreated) {
    syncGeneratedColumnSpans(
      doc,
      tableElement,
      model,
      selectedColumnIndex,
      indexes.result,
      COPY_TEST_GENERATED_RESULT_TYPE,
      sourceColumnKey
    );
  }
  if (evidenceColumnCreated) {
    syncGeneratedColumnSpans(
      doc,
      tableElement,
      model,
      selectedColumnIndex,
      indexes.evidence,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      sourceColumnKey
    );
  }

  const syncedModel = parseTableModel(tableElement);
  return {
    context: {
      evidenceColumnIndex: indexes.evidence,
      model: syncedModel,
      resultColumnIndex: indexes.result,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey,
      tableElement,
    },
    html: toConfluenceStorageHtml(tableElement.outerHTML),
  };
};

/** 绑定 Result 图片，优先使用模型返回的文件名筛选。 */
export const bindResultImages = <T extends CopyTestValidationResultWithEvidence>(
  results: T[],
  fallbackImages: CopyTestImage[]
): T[] => {
  return results.map(result => {
    const fileNames = result.evidenceImageFileNames;
    const images = fileNames && fileNames.length > 0
      ? fallbackImages.filter(image => fileNames.includes(image.fileName))
      : fallbackImages;
    return {
      ...result,
      evidenceImages: result.evidenceImages || images,
      resultImages: result.resultImages || images,
    };
  });
};

/** 读取 Evidence 图片。 */
const getEvidenceImages = (
  result: CopyTestValidationResultWithEvidence,
  fallbackImages: CopyTestImage[]
): CopyTestImage[] => {
  if (result.evidenceImages?.length) {
    return result.evidenceImages;
  }

  const fileNames = result.evidenceImageFileNames || [];
  return fileNames.length > 0 ? fallbackImages.filter(image => fileNames.includes(image.fileName)) : fallbackImages;
};

/** Screen 标签。 */
const getScreenLabel = (imageIndex: number): string => {
  return `Screen${String(imageIndex + 1).padStart(2, '0')}`;
};

/** 图片实例 ID。 */
const getImageInstanceId = (image: CopyTestImage, rowIndex: number, imageIndex: number): string => {
  return `${getCopyTestImageId(image)}:${rowIndex}:${imageIndex}`;
};

/** 创建图片引用。 */
const createScreenRefs = (
  images: CopyTestImage[],
  anchorRowIndex: number
): ScreenRef[] => {
  return images.map((image, imageIndex) => ({
    image,
    imageId: getCopyTestImageId(image),
    instanceId: getImageInstanceId(image, anchorRowIndex, imageIndex),
    label: getScreenLabel(imageIndex),
  }));
};

/** 读取失败原因。 */
const getFailureReasons = (result: CopyTestValidationResultWithEvidence): string[] => {
  return (result.languageIssues || []).filter(reason => reason.trim() !== '');
};

/** 追加 Result 的图片列表。 */
const appendResultScreenList = (
  doc: Document,
  container: HTMLElement,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): void => {
  const list = doc.createElement('ul');
  const failureReasons = getFailureReasons(result);
  screens.forEach(screen => {
    const item = doc.createElement(RESULT_LIST_ITEM_TAG);
    item.setAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE, screen.imageId);
    item.setAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE, screen.instanceId);
    item.appendChild(doc.createTextNode(screen.label));
    if (!result.passed && failureReasons.length > 0) {
      const issueList = doc.createElement('ul');
      failureReasons.forEach(reason => {
        const issueItem = doc.createElement(RESULT_LIST_ITEM_TAG);
        issueItem.textContent = reason;
        issueList.appendChild(issueItem);
      });
      item.appendChild(issueList);
    }
    list.appendChild(item);
  });
  container.appendChild(list);
};

/** 创建 Result 受控内容。 */
const createResultContent = (
  doc: Document,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): HTMLElement => {
  const container = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  const status = doc.createElement(COPY_TEST_CONTENT_LABEL_TAG);
  container.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, COPY_TEST_GENERATED_RESULT_TYPE);
  status.textContent = result.passed ? PASSED_LABEL : FAILED_LABEL;
  status.setAttribute('style', `color:${result.passed ? COPY_TEST_PASSED_COLOR : COPY_TEST_FAILED_COLOR};font-weight:700;`);
  container.appendChild(status);
  appendResultScreenList(doc, container, result, screens);
  return container;
};

/** 创建 Evidence 图片节点。 */
const createEvidenceImage = (doc: Document, screen: ScreenRef): Element => {
  const imageElement = doc.createElement('ac:image');
  const attachment = doc.createElement('ri:attachment');
  imageElement.setAttribute('ac:width', String(COPY_TEST_EVIDENCE_IMAGE_WIDTH));
  imageElement.setAttribute('ac:height', String(COPY_TEST_EVIDENCE_IMAGE_HEIGHT));
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, screen.imageId);
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE, screen.instanceId);
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE, screen.image.base64);
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE, screen.image.fileName);
  attachment.setAttribute('ri:filename', screen.image.fileName);
  imageElement.appendChild(attachment);
  return imageElement;
};

/** 创建 Evidence 受控内容。 */
const createEvidenceContent = (doc: Document, screens: ScreenRef[]): HTMLElement => {
  const container = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  container.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, COPY_TEST_GENERATED_EVIDENCE_TYPE);
  screens.forEach(screen => {
    const card = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
    const label = doc.createElement(COPY_TEST_CONTENT_LABEL_TAG);
    card.setAttribute(COPY_TEST_EVIDENCE_CARD_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
    label.textContent = screen.label;
    card.appendChild(label);
    card.appendChild(doc.createElement('br'));
    card.appendChild(createEvidenceImage(doc, screen));
    container.appendChild(card);
  });
  return container;
};

/** 查找受控内容。 */
const getManagedContentElements = (
  cell: Element,
  type: CopyTestGeneratedColumnType
): Element[] => {
  const selector = `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${type}"]`;
  return cell.matches(selector) ? [cell] : Array.from(cell.querySelectorAll(selector));
};

/** 删除受控内容。 */
const removeManagedContent = (
  cell: Element,
  type: CopyTestGeneratedColumnType
): void => {
  getManagedContentElements(cell, type).forEach(element => element.remove());
};

/** 替换受控内容并保留人工内容。 */
const replaceManagedContent = (
  cell: Element,
  content: Element,
  type: CopyTestGeneratedColumnType
): void => {
  const existingContents = getManagedContentElements(cell, type);
  if (existingContents.length > 0) {
    existingContents[0].replaceWith(content);
    existingContents.slice(1).forEach(element => element.remove());
    return;
  }

  if (cell.childNodes.length > 0) {
    cell.appendChild(cell.ownerDocument.createElement('br'));
  }
  cell.appendChild(content);
};

/** 按数据行下标读取校验结果。 */
const buildResultMap = (
  results: CopyTestValidationResultWithEvidence[]
): Map<number, CopyTestValidationResultWithEvidence> => {
  return new Map(results.map(result => [result.rowIndex, result]));
};

/** 合并一个逻辑行组内的校验结果。 */
const getLogicalResult = (
  resultMap: Map<number, CopyTestValidationResultWithEvidence>,
  group: CopyTestRowGroup
): CopyTestValidationResultWithEvidence | null => {
  const groupResults = group.dataRowIndexes
    .map(rowIndex => resultMap.get(rowIndex))
    .filter((result): result is CopyTestValidationResultWithEvidence => Boolean(result));
  if (groupResults.length === 0) {
    return null;
  }

  const firstResult = groupResults[0];
  return {
    evidenceImageFileNames: Array.from(new Set(groupResults.flatMap(result => result.evidenceImageFileNames || []))),
    evidenceImages: groupResults.flatMap(result => result.evidenceImages || []),
    evidenceRowSpan: firstResult.evidenceRowSpan,
    hideEvidenceCell: firstResult.hideEvidenceCell,
    languageIssues: Array.from(new Set(groupResults.flatMap(result => result.languageIssues || []))),
    passed: groupResults.every(result => result.passed),
    resultImages: groupResults.flatMap(result => result.resultImages || []),
    rowIndex: group.dataRowIndexes[0],
  };
};

/** Evidence 合并 key。 */
const getEvidenceKey = (
  result: CopyTestValidationResultWithEvidence,
  fallbackImages: CopyTestImage[]
): string => {
  return getEvidenceImages(result, fallbackImages).map(getCopyTestImageId).join('|');
};

/** 判断模型是否显式返回 Evidence 分组信息。 */
const hasExplicitEvidenceGrouping = (results: CopyTestValidationResultWithEvidence[]): boolean => {
  return results.some(result => Boolean(result.hideEvidenceCell) || Boolean(result.evidenceRowSpan && result.evidenceRowSpan > 1));
};

/** 构建逻辑行和校验结果的绑定。 */
const buildLogicalRowResults = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[]
): LogicalRowResult[] => {
  const resultMap = buildResultMap(results);
  return rowGroups.map(rowGroup => ({
    result: getLogicalResult(resultMap, rowGroup),
    rowGroup,
  }));
};

/** 读取模型分组需要覆盖的逻辑行。 */
const readExplicitEvidenceRows = (
  items: LogicalRowResult[],
  startIndex: number
): ExplicitEvidenceRows => {
  const firstItem = items[startIndex];
  if (!firstItem.result || firstItem.result.hideEvidenceCell) {
    return { rows: [], rowSpan: 0 };
  }

  const targetRowSpan = Math.max(1, firstItem.result.evidenceRowSpan || 1);
  const rows: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }> = [];
  let coveredRows = 0;
  for (let index = startIndex; index < items.length && coveredRows < targetRowSpan; index += 1) {
    const item = items[index];
    coveredRows += item.rowGroup.rowSpan;
    if (item.result) {
      rows.push({ ...item.rowGroup, result: item.result });
    }
  }
  return { rows, rowSpan: coveredRows };
};

/** 从逻辑行创建 Evidence 合并组。 */
const createEvidenceGroup = (
  evidenceRows: ExplicitEvidenceRows,
  images: CopyTestImage[]
): EvidenceGroup | null => {
  const { rows, rowSpan } = evidenceRows;
  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  return {
    anchorRowIndex: firstRow.anchorRowIndex,
    rowGroups: rows,
    rowSpan,
    screens: createScreenRefs(getEvidenceImages(firstRow.result, images), firstRow.anchorRowIndex),
  };
};

/** 构建模型显式指定的 Evidence 合并组。 */
const buildExplicitEvidenceGroups = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[],
  images: CopyTestImage[]
): EvidenceGroup[] => {
  const items = buildLogicalRowResults(rowGroups, results);
  return items.flatMap((item, index) => {
    if (!item.result || item.result.hideEvidenceCell) {
      return [];
    }

    const group = createEvidenceGroup(readExplicitEvidenceRows(items, index), images);
    return group ? [group] : [];
  });
};

/** 构建旧模型兼容的 Evidence 连续合并组。 */
const buildImplicitEvidenceGroups = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[],
  images: CopyTestImage[]
): EvidenceGroup[] => {
  const resultMap = buildResultMap(results);
  const groups: EvidenceGroup[] = [];
  let rowGroupIndex = 0;
  while (rowGroupIndex < rowGroups.length) {
    const firstResult = getLogicalResult(resultMap, rowGroups[rowGroupIndex]);
    if (!firstResult) {
      rowGroupIndex += 1;
      continue;
    }

    const key = getEvidenceKey(firstResult, images);
    const mergedGroups: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }> = [{
      ...rowGroups[rowGroupIndex],
      result: firstResult,
    }];
    let nextIndex = rowGroupIndex + 1;
    while (key && nextIndex < rowGroups.length) {
      const nextResult = getLogicalResult(resultMap, rowGroups[nextIndex]);
      if (!nextResult || getEvidenceKey(nextResult, images) !== key) {
        break;
      }
      mergedGroups.push({ ...rowGroups[nextIndex], result: nextResult });
      nextIndex += 1;
    }

    groups.push({
      anchorRowIndex: mergedGroups[0].anchorRowIndex,
      rowSpan: mergedGroups.reduce((total, group) => total + group.rowSpan, 0),
      rowGroups: mergedGroups,
      screens: createScreenRefs(getEvidenceImages(firstResult, images), mergedGroups[0].anchorRowIndex),
    });
    rowGroupIndex = nextIndex;
  }
  return groups;
};

/** 构建 Evidence 连续合并组。 */
const buildEvidenceGroups = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[],
  images: CopyTestImage[]
): EvidenceGroup[] => {
  if (hasExplicitEvidenceGrouping(results)) {
    return buildExplicitEvidenceGroups(rowGroups, results, images);
  }

  return buildImplicitEvidenceGroups(rowGroups, results, images);
};

/** 清理未校验逻辑行的受控内容。 */
const clearSkippedRows = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[],
  resultMap: Map<number, CopyTestValidationResultWithEvidence>
): void => {
  rowGroups.filter(group => !getLogicalResult(resultMap, group)).forEach(group => {
    const resultCell = ensureWritableGeneratedCell(
      doc,
      context.tableElement,
      context.model,
      group.anchorRowIndex,
      context.resultColumnIndex,
      COPY_TEST_GENERATED_RESULT_TYPE,
      context.sourceColumnKey
    );
    const evidenceCell = ensureWritableGeneratedCell(
      doc,
      context.tableElement,
      context.model,
      group.anchorRowIndex,
      context.evidenceColumnIndex,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      context.sourceColumnKey
    );
    applyCellRowSpan(resultCell, group.rowSpan);
    applyCellRowSpan(evidenceCell, group.rowSpan);
    removeManagedContent(resultCell, COPY_TEST_GENERATED_RESULT_TYPE);
    removeManagedContent(evidenceCell, COPY_TEST_GENERATED_EVIDENCE_TYPE);
    removeCoveredGeneratedCells(context.model, group.anchorRowIndex, group.rowSpan, COPY_TEST_GENERATED_RESULT_TYPE, context.sourceColumnKey);
    removeCoveredGeneratedCells(context.model, group.anchorRowIndex, group.rowSpan, COPY_TEST_GENERATED_EVIDENCE_TYPE, context.sourceColumnKey);
  });
};

/** 写 Result 单元格。 */
const writeResultCell = (
  doc: Document,
  context: GeneratedColumnContext,
  group: CopyTestRowGroup,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): void => {
  const cell = ensureWritableGeneratedCell(
    doc,
    context.tableElement,
    context.model,
    group.anchorRowIndex,
    context.resultColumnIndex,
    COPY_TEST_GENERATED_RESULT_TYPE,
    context.sourceColumnKey
  );
  applyCellRowSpan(cell, group.rowSpan);
  replaceManagedContent(cell, createResultContent(doc, result, screens), COPY_TEST_GENERATED_RESULT_TYPE);
  removeCoveredGeneratedCells(context.model, group.anchorRowIndex, group.rowSpan, COPY_TEST_GENERATED_RESULT_TYPE, context.sourceColumnKey);
};

/** 写 Evidence 单元格。 */
const writeEvidenceCell = (
  doc: Document,
  context: GeneratedColumnContext,
  group: EvidenceGroup
): void => {
  const cell = ensureWritableGeneratedCell(
    doc,
    context.tableElement,
    context.model,
    group.anchorRowIndex,
    context.evidenceColumnIndex,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    context.sourceColumnKey
  );
  applyCellRowSpan(cell, group.rowSpan);
  replaceManagedContent(cell, createEvidenceContent(doc, group.screens), COPY_TEST_GENERATED_EVIDENCE_TYPE);
  removeCoveredGeneratedCells(context.model, group.anchorRowIndex, group.rowSpan, COPY_TEST_GENERATED_EVIDENCE_TYPE, context.sourceColumnKey);
};

/** 应用校验结果到当前 working table。 */
export const applyCopyTestValidationResults = (
  table: CopyTestWorkingTable,
  results: CopyTestValidationResultWithEvidence[],
  images: CopyTestImage[],
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable => {
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    throw new Error('Generated result columns cannot be created');
  }

  const doc = ensured.context.tableElement.ownerDocument;
  const rowGroups = buildCopyTestRowGroups(
    refreshWorkingTable(table, ensured.html),
    selectedColumnIndex
  );
  const resultMap = buildResultMap(results);
  clearSkippedRows(doc, ensured.context, rowGroups, resultMap);
  buildEvidenceGroups(rowGroups, results, images).forEach(evidenceGroup => {
    evidenceGroup.rowGroups.forEach(rowGroup => {
      writeResultCell(doc, ensured.context, rowGroup, rowGroup.result, evidenceGroup.screens);
    });
    writeEvidenceCell(doc, ensured.context, evidenceGroup);
  });

  return refreshWorkingTable(table, toConfluenceStorageHtml(ensured.context.tableElement.outerHTML));
};

/** 确保当前列生成列并返回新工作表格。 */
export const ensureCopyTestWorkingColumns = (
  table: CopyTestWorkingTable,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable => {
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  return ensured ? refreshWorkingTable(table, ensured.html) : table;
};

/** 读取同 source column 的生成单元格。 */
const getGeneratedCellsForSource = (
  tableElement: Element,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): Element[] => {
  return Array.from(tableElement.querySelectorAll('td,th')).filter(cell => {
    return cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === type
      && cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === sourceColumnKey;
  });
};

/** 读取单元格在当前模型里的行范围。 */
const getCellRowRange = (
  model: CopyTestTableModel,
  cell: Element
): TableRowRange | null => {
  const matchedCell = model.rows
    .flatMap(row => row.cells)
    .find(item => item.element === cell);
  if (!matchedCell) {
    return null;
  }

  return {
    end: matchedCell.rowIndex + matchedCell.rowSpan - 1,
    start: matchedCell.rowIndex,
  };
};

/** 判断两个行范围是否相交。 */
const isRowRangeIntersected = (left: TableRowRange, right: TableRowRange): boolean => {
  return left.start <= right.end && left.end >= right.start;
};

/** 将当前 Comparison Column 的逻辑行组转换成表格行范围。 */
const getRowGroupRange = (group: CopyTestRowGroup): TableRowRange => {
  return {
    end: group.anchorRowIndex + group.rowSpan - 1,
    start: group.anchorRowIndex,
  };
};

/** 根据 Evidence 单元格范围读取受影响的逻辑行组范围。 */
const getAffectedResultRanges = (
  rowGroups: CopyTestRowGroup[],
  evidenceRange: TableRowRange
): TableRowRange[] => {
  const matchedRanges = rowGroups
    .map(getRowGroupRange)
    .filter(groupRange => isRowRangeIntersected(groupRange, evidenceRange));
  return matchedRanges.length > 0 ? matchedRanges : [evidenceRange];
};

/** 判断 Result 单元格是否落在受影响范围内。 */
const isResultCellInAffectedRanges = (
  model: CopyTestTableModel,
  cell: Element,
  affectedRanges: TableRowRange[]
): boolean => {
  const resultRange = getCellRowRange(model, cell);
  return Boolean(resultRange && affectedRanges.some(range => isRowRangeIntersected(resultRange, range)));
};

/** 判断单元格里是否仍有 Evidence 图片。 */
const hasEvidenceImage = (cell: Element): boolean => {
  return cell.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`) !== null;
};

/** 判断指定行范围内是否还有 Evidence 图片。 */
const hasEvidenceImageInRange = (
  model: CopyTestTableModel,
  tableElement: Element,
  sourceColumnKey: string,
  range: TableRowRange
): boolean => {
  return getGeneratedCellsForSource(tableElement, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey)
    .some(cell => {
      const evidenceRange = getCellRowRange(model, cell);
      return Boolean(evidenceRange && isRowRangeIntersected(evidenceRange, range) && hasEvidenceImage(cell));
    });
};

/** 读取 Evidence 图片卡片的 Screen 标签。 */
const getEvidenceScreenLabel = (imageElement: Element): string | undefined => {
  const card = imageElement.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`) || imageElement.parentElement;
  return card?.querySelector(COPY_TEST_CONTENT_LABEL_TAG)?.textContent?.trim() || undefined;
};

/** 读取 Result 图片引用的直接 Screen 标签。 */
const getResultReferenceLabel = (element: Element): string => {
  return Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join('')
    .trim();
};

/** 判断 Result 引用是否匹配删除目标。 */
const isResultReferenceTarget = (
  element: Element,
  target: CopyTestEvidenceDeleteTarget,
  screenLabel?: string
): boolean => {
  const resultImageId = element.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE);
  if (resultImageId) {
    return resultImageId === target.imageId
      && (!target.instanceId || element.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE) === target.instanceId);
  }

  return Boolean(screenLabel && getResultReferenceLabel(element) === screenLabel);
};

/** 删除空 Result 受控块。 */
const removeEmptyResultRoot = (element: Element): void => {
  const root = element.closest(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`);
  if (!root) {
    return;
  }

  const hasRemainingReference = Array.from(root.querySelectorAll(RESULT_LIST_ITEM_TAG))
    .some(item => SCREEN_REFERENCE_LABEL_PATTERN.test(getResultReferenceLabel(item)));
  if (!hasRemainingReference) {
    root.remove();
  }
};

/** 删除 Evidence 图片并同步当前 source column 的 Result 引用。 */
export const deleteCopyTestEvidenceImage = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestEvidenceDeleteResult => {
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    return { imageStillUsed: false, removed: false, table };
  }

  const sourceColumnKey = ensured.context.sourceColumnKey;
  const rowGroups = buildCopyTestRowGroups(refreshWorkingTable(table, ensured.html), selectedColumnIndex);
  const affectedResultRanges: TableRowRange[] = [];
  const removedScreenLabels: string[] = [];
  let removed = false;
  getGeneratedCellsForSource(ensured.context.tableElement, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey).forEach(cell => {
    cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${target.imageId}"]`).forEach(imageElement => {
      if (target.instanceId && imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) !== target.instanceId) {
        return;
      }
      const screenLabel = getEvidenceScreenLabel(imageElement);
      if (screenLabel) {
        removedScreenLabels.push(screenLabel);
      }
      const evidenceRange = getCellRowRange(ensured.context.model, cell);
      if (evidenceRange) {
        affectedResultRanges.push(...getAffectedResultRanges(rowGroups, evidenceRange));
      }
      (imageElement.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`) || imageElement).remove();
      removed = true;
    });
    if (!cell.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)) {
      removeManagedContent(cell, COPY_TEST_GENERATED_EVIDENCE_TYPE);
    }
  });

  if (!removed) {
    return { imageStillUsed: false, removed: false, table };
  }

  getGeneratedCellsForSource(ensured.context.tableElement, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey).forEach(cell => {
    if (!isResultCellInAffectedRanges(ensured.context.model, cell, affectedResultRanges)) {
      return;
    }

    cell.querySelectorAll(RESULT_LIST_ITEM_TAG).forEach(resultReference => {
      const matched = isResultReferenceTarget(resultReference, target)
        || removedScreenLabels.some(screenLabel => isResultReferenceTarget(resultReference, target, screenLabel));
      if (!matched) {
        return;
      }
      const root = resultReference.closest(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`);
      resultReference.remove();
      if (root instanceof Element) {
        removeEmptyResultRoot(root);
      }
    });

    const resultRange = getCellRowRange(ensured.context.model, cell);
    if (
      resultRange
      && !hasEvidenceImageInRange(ensured.context.model, ensured.context.tableElement, sourceColumnKey, resultRange)
    ) {
      removeManagedContent(cell, COPY_TEST_GENERATED_RESULT_TYPE);
    }
  });

  const imageStillUsed = ensured.context.tableElement.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${target.imageId}"]`) !== null;
  return {
    imageStillUsed,
    removed,
    table: refreshWorkingTable(table, toConfluenceStorageHtml(ensured.context.tableElement.outerHTML)),
  };
};
