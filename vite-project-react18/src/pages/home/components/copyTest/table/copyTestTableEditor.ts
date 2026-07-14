/**
 * 文件作用：编辑单张 CopyTest working table，只写当前 Comparison Column 的生成列。
 */
import type { CopyTestImage, CopyTestValidationResult } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
  COPY_TEST_FAILED_COLOR,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_PASSED_COLOR,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
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
  /** 根据模型文件名绑定出的 Evidence 内存图片。 */
  evidenceImages: CopyTestImage[];
}

/** Evidence 图片删除目标。 */
export interface CopyTestEvidenceDeleteTarget {
  /** Evidence 图片的稳定文件名标识。 */
  imageId: string;
  /** 图片在当前生成单元格中的稳定实例标识。 */
  instanceId: string;
}

/** Evidence 删除结果。 */
export interface CopyTestEvidenceDeleteResult {
  /** 同一文件是否仍被当前表格的其他 Evidence 引用。 */
  imageStillUsed: boolean;
  /** 是否找到并删除了指定图片实例。 */
  removed: boolean;
  /** 完成删除后的工作表格。 */
  table: CopyTestWorkingTable;
}

/** 生成列上下文。 */
interface GeneratedColumnContext {
  /** 当前 Comparison Column 的 Evidence 列下标。 */
  evidenceColumnIndex: number;
  /** 包含生成列的最新表格模型。 */
  model: CopyTestTableModel;
  /** 当前 Comparison Column 的 Result 列下标。 */
  resultColumnIndex: number;
  /** 两个生成列共同使用的 ownership 键。 */
  sourceColumnKey: string;
  /** 承载生成列修改的真实表格元素。 */
  tableElement: HTMLTableElement;
}

/** 写入用的图片引用。 */
interface ScreenRef {
  /** 当前引用对应的内存图片。 */
  image: CopyTestImage;
  /** 由附件文件名确定的稳定图片标识。 */
  imageId: string;
  /** 图片在当前 Result/Evidence 组中的稳定实例标识。 */
  instanceId: string;
  /** Result 和 Evidence 共同显示的 Screen 标签。 */
  label: string;
}

/** Evidence 合并组。 */
interface EvidenceGroup {
  /** Evidence 合并组起始物理行下标。 */
  anchorRowIndex: number;
  /** Evidence 单元格实际覆盖的物理行数。 */
  rowSpan: number;
  /** 合并组共享的图片引用。 */
  screens: ScreenRef[];
  /** 合并组内不可拆分的来源行组及其校验结果。 */
  rowGroups: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }>;
}

/** 逻辑行和模型结果的绑定。 */
interface LogicalRowResult {
  /** 当前来源行组对应的校验结果；未选择时为 null。 */
  result: CopyTestValidationResultWithEvidence | null;
  /** Comparison Column 中不可拆分的来源行组。 */
  rowGroup: CopyTestRowGroup;
}

/** 表格行范围。 */
interface TableRowRange {
  /** 闭区间结束行下标。 */
  end: number;
  /** 闭区间起始行下标。 */
  start: number;
}

/** 显式 Evidence 分组读取结果。 */
interface ExplicitEvidenceRows {
  /** 这些逻辑行组合计覆盖的物理行数。 */
  rowSpan: number;
  /** 模型显式声明共享 Evidence 的逻辑行组。 */
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

/** 生成受控内容根节点使用的块级标签名。 */
const COPY_TEST_CONTENT_BLOCK_TAG = 'div';

/** 生成 Result/Evidence 标题节点使用的强调标签名。 */
const COPY_TEST_CONTENT_LABEL_TAG = 'strong';

/** DOM 布尔属性写入时使用的统一字符串值。 */
const DOM_TRUE_ATTRIBUTE_VALUE = 'true';

/** 应用生成列 metadata。 */
const applyGeneratedMetadata = (cell: Element, type: CopyTestGeneratedColumnType, sourceColumnKey: string): void => {
  cell.setAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE, type);
  cell.setAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE, sourceColumnKey);
  cell.setAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE, sourceColumnKey);
  cell.setAttribute(COPY_TEST_SCHEMA_ATTRIBUTE, COPY_TEST_SCHEMA_VERSION);
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
    .filter(
      /** 只选择类型和 ownership 均属于当前来源列的生成单元格。 */
      cell => isGeneratedCellForSource(cell, type, sourceColumnKey)
    )
    .forEach(
      /** 从真实 DOM 行中移除命中的生成单元格。 */
      cell => cell.element.remove()
    );
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
const getSourceRowSpan = (model: CopyTestTableModel, rowIndex: number, selectedColumnIndex: number): number => {
  /** 当前物理行在来源逻辑列上的槽位。 */
  const slot = model.rows[rowIndex]?.slots[selectedColumnIndex];
  return slot?.owned ? slot.cell.rowSpan : 1;
};

/** 判断当前行是否被源列 rowspan 覆盖。 */
const isCoveredBySourceRowSpan = (
  model: CopyTestTableModel,
  rowIndex: number,
  selectedColumnIndex: number
): boolean => {
  /** 当前物理行在来源逻辑列上的槽位。 */
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
  /** 表头行创建 th，数据行创建 td 的新生成单元格。 */
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
  model: CopyTestTableModel,
  type: CopyTestGeneratedColumnType,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  sourceColumnKey: string
): void => {
  model.rows.forEach(
    /** 在表头及每个来源行组锚点末尾追加生成单元格。 */
    ({ element: row, index: rowIndex }) => {
      if (rowIndex > 0 && isCoveredBySourceRowSpan(model, rowIndex, selectedColumnIndex)) {
        return;
      }

      /** 仅表头行需要生成列标题。 */
      const label = rowIndex === 0 ? getGeneratedColumnLabel(type, selectedColumnLabel) : undefined;
      /** 当前行待追加的 Result 或 Evidence 单元格。 */
      const cell = createGeneratedCell(doc, type, sourceColumnKey, label);
      applyCellRowSpan(cell, rowIndex > 0 ? getSourceRowSpan(model, rowIndex, selectedColumnIndex) : 1);
      row.appendChild(cell);
    }
  );
};

/** 给已有生成列补齐 metadata。 */
const applyGeneratedMetadataToColumn = (
  model: CopyTestTableModel,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.forEach(
    /** 为该逻辑列中每个直接拥有的单元格刷新严格 ownership 元数据。 */
    row => {
      /** 当前物理行在目标生成逻辑列上的槽位。 */
      const slot = row.slots[columnIndex];
      if (slot?.owned) {
        applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
      }
    }
  );
};

/** 确保指定行有可写入的生成列单元格。 */
const ensureWritableGeneratedCell = (
  doc: Document,
  model: CopyTestTableModel,
  rowIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): HTMLTableCellElement => {
  /** 当前行目标生成逻辑列已有的槽位。 */
  const slot = model.rows[rowIndex]?.slots[columnIndex];
  if (slot?.owned && slot.cell.element instanceof HTMLTableCellElement) {
    applyGeneratedMetadata(slot.cell.element, type, sourceColumnKey);
    return slot.cell.element;
  }

  /** 需要补入生成单元格的结构化物理行。 */
  const modelRow = model.rows[rowIndex];
  /** 对应的真实 DOM 行元素。 */
  const row = modelRow?.element;
  /** 当前来源列新建的可写数据单元格。 */
  const cell = doc.createElement('td');
  /** 目标逻辑列右侧首个由当前物理行直接拥有的 DOM 单元格。 */
  const nextOwnedCell = modelRow?.cells.find(
    /** 保持原逻辑列顺序，将新单元格插入右侧邻居之前。 */
    item => item.columnIndex > columnIndex
  )?.element;
  applyGeneratedMetadata(cell, type, sourceColumnKey);
  row?.insertBefore(cell, nextOwnedCell || null);
  return cell;
};

/** 同步生成列的基础 rowspan。 */
const syncGeneratedColumnSpans = (
  doc: Document,
  model: CopyTestTableModel,
  selectedColumnIndex: number,
  columnIndex: number,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): void => {
  model.rows.slice(FIRST_DATA_ROW_INDEX).forEach(
    /** 逐个数据物理行同步生成列与来源列的纵向覆盖范围。 */
    row => {
      if (isCoveredBySourceRowSpan(model, row.index, selectedColumnIndex)) {
        removeGeneratedCellsInRow(model, row.index, type, sourceColumnKey);
        return;
      }

      /** 来源单元格从当前锚点开始覆盖的物理行数。 */
      const rowSpan = getSourceRowSpan(model, row.index, selectedColumnIndex);
      /** 与来源行组锚点对齐的可写生成单元格。 */
      const cell = ensureWritableGeneratedCell(doc, model, row.index, columnIndex, type, sourceColumnKey);
      applyCellRowSpan(cell, rowSpan);
      removeCoveredGeneratedCells(model, row.index, rowSpan, type, sourceColumnKey);
    }
  );
};

/** 确保当前 Comparison Column 的 Result/Evidence 两列存在。 */
const ensureCopyTestGeneratedColumns = (
  tableHtml: string,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): { context: GeneratedColumnContext; html: string } | null => {
  /** 当前工作表格片段解析得到的可编辑 DOM。 */
  const doc = parseHtml(tableHtml);
  /** 工作片段中的目标表格根元素。 */
  const tableElement = doc.querySelector<HTMLTableElement>(TABLE_TAG_NAME);
  if (!tableElement) {
    return null;
  }

  /** 当前 Comparison Column 的稳定 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 追加缺失列之前的表格结构模型。 */
  const initialModel = parseTableModel(tableElement);
  /** 当前严格 schema 下已存在的 Result/Evidence 列下标。 */
  const initialIndexes = findGeneratedColumnIndexes(initialModel.headers, sourceColumnKey);
  /** 本次是否需要新建 Result 列。 */
  const resultColumnCreated = initialIndexes.result === undefined;
  /** 本次是否需要新建 Evidence 列。 */
  const evidenceColumnCreated = initialIndexes.evidence === undefined;
  if (resultColumnCreated) {
    appendGeneratedColumn(
      doc,
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
      initialModel,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      selectedColumnIndex,
      selectedColumnLabel,
      sourceColumnKey
    );
  }

  /** 补齐缺失列后重新解析的表格模型。 */
  const model = parseTableModel(tableElement);
  /** 补齐后当前来源列的严格 Result/Evidence 下标。 */
  const indexes = findGeneratedColumnIndexes(model.headers, sourceColumnKey);
  if (indexes.result === undefined || indexes.evidence === undefined) {
    return null;
  }

  applyGeneratedMetadataToColumn(model, indexes.result, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey);
  applyGeneratedMetadataToColumn(model, indexes.evidence, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey);
  if (resultColumnCreated) {
    syncGeneratedColumnSpans(
      doc,
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
      model,
      selectedColumnIndex,
      indexes.evidence,
      COPY_TEST_GENERATED_EVIDENCE_TYPE,
      sourceColumnKey
    );
  }

  /** 完成 metadata 与 rowspan 同步后的最终模型。 */
  const syncedModel = parseTableModel(tableElement);
  return {
    context: {
      evidenceColumnIndex: indexes.evidence,
      model: syncedModel,
      resultColumnIndex: indexes.result,
      sourceColumnKey,
      tableElement,
    },
    html: toConfluenceStorageHtml(tableElement.outerHTML),
  };
};

/** 严格按模型返回的附件文件名绑定 Evidence 图片。 */
export const bindResultImages = (
  results: CopyTestValidationResult[],
  images: CopyTestImage[]
): CopyTestValidationResultWithEvidence[] => {
  return results.map(
    /** 将单条模型结果声明的附件文件名解析为内存图片引用。 */
    result => {
      /** 当前结果明确声明的 Evidence 文件名。 */
      const fileNames = result.evidenceImageFileNames;
      return {
        ...result,
        evidenceImages: fileNames
          ? images.filter(
              /** 只绑定模型显式列出的附件文件名，不做隐式回退。 */
              image => fileNames.includes(image.fileName)
            )
          : [],
      };
    }
  );
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
const createScreenRefs = (images: CopyTestImage[], anchorRowIndex: number): ScreenRef[] => {
  return images.map(
    /** 为当前行组的每张 Evidence 图片生成稳定引用与展示标签。 */
    (image, imageIndex) => ({
      image,
      imageId: getCopyTestImageId(image),
      instanceId: getImageInstanceId(image, anchorRowIndex, imageIndex),
      label: getScreenLabel(imageIndex),
    })
  );
};

/** 读取失败原因。 */
const getFailureReasons = (result: CopyTestValidationResultWithEvidence): string[] => {
  return (result.languageIssues || []).filter(
    /** 忽略模型返回的空白问题描述。 */
    reason => reason.trim() !== ''
  );
};

/** 追加 Result 的图片列表。 */
const appendResultScreenList = (
  doc: Document,
  container: HTMLElement,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): void => {
  /** 承载当前 Result 所有 Screen 引用的无序列表。 */
  const list = doc.createElement('ul');
  /** 当前失败结果去除空白项后的问题描述。 */
  const failureReasons = getFailureReasons(result);
  screens.forEach(
    /** 为每张 Evidence 图片写入可精确删除的 Result 引用项。 */
    screen => {
      /** 带图片 ID 与实例 ID 的 Result 一级列表项。 */
      const item = doc.createElement(RESULT_LIST_ITEM_TAG);
      item.setAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE, screen.imageId);
      item.setAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE, screen.instanceId);
      item.appendChild(doc.createTextNode(screen.label));
      if (!result.passed && failureReasons.length > 0) {
        /** 当前 Screen 下展示全部失败原因的二级列表。 */
        const issueList = doc.createElement('ul');
        failureReasons.forEach(
          /** 将每条非空失败原因写入独立列表项。 */
          reason => {
            /** 单条失败原因的二级列表项。 */
            const issueItem = doc.createElement(RESULT_LIST_ITEM_TAG);
            issueItem.textContent = reason;
            issueList.appendChild(issueItem);
          }
        );
        item.appendChild(issueList);
      }
      list.appendChild(item);
    }
  );
  container.appendChild(list);
};

/** 创建 Result 受控内容。 */
const createResultContent = (
  doc: Document,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): HTMLElement => {
  /** 标记为 CopyTest Result 受控内容的根块。 */
  const container = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  /** 显示 Passed 或 Failed 状态的强调节点。 */
  const status = doc.createElement(COPY_TEST_CONTENT_LABEL_TAG);
  container.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, COPY_TEST_GENERATED_RESULT_TYPE);
  status.textContent = result.passed ? PASSED_LABEL : FAILED_LABEL;
  status.setAttribute(
    'style',
    `color:${result.passed ? COPY_TEST_PASSED_COLOR : COPY_TEST_FAILED_COLOR};font-weight:700;`
  );
  container.appendChild(status);
  appendResultScreenList(doc, container, result, screens);
  return container;
};

/** 创建 Evidence 图片节点。 */
const createEvidenceImage = (doc: Document, screen: ScreenRef): Element => {
  /** Confluence Storage 的图片容器节点。 */
  const imageElement = doc.createElement('ac:image');
  /** 指向已上传附件文件名的 Confluence 引用节点。 */
  const attachment = doc.createElement('ri:attachment');
  imageElement.setAttribute('ac:width', String(COPY_TEST_EVIDENCE_IMAGE_WIDTH));
  imageElement.setAttribute('ac:height', String(COPY_TEST_EVIDENCE_IMAGE_HEIGHT));
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, screen.imageId);
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE, screen.instanceId);
  imageElement.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE, screen.image.fileName);
  attachment.setAttribute('ri:filename', screen.image.fileName);
  imageElement.appendChild(attachment);
  return imageElement;
};

/** 创建 Evidence 受控内容。 */
const createEvidenceContent = (doc: Document, screens: ScreenRef[]): HTMLElement => {
  /** 标记为 CopyTest Evidence 受控内容的根块。 */
  const container = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  container.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, COPY_TEST_GENERATED_EVIDENCE_TYPE);
  screens.forEach(
    /** 为每张图片生成带 Screen 标签和稳定实例标识的 Evidence 卡片。 */
    screen => {
      /** 支持整卡删除的单张 Evidence 容器。 */
      const card = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
      /** 当前 Evidence 图片对应的 Screen 展示标签。 */
      const label = doc.createElement(COPY_TEST_CONTENT_LABEL_TAG);
      card.setAttribute(COPY_TEST_EVIDENCE_CARD_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
      label.textContent = screen.label;
      card.appendChild(label);
      card.appendChild(doc.createElement('br'));
      card.appendChild(createEvidenceImage(doc, screen));
      container.appendChild(card);
    }
  );
  return container;
};

/** 查找受控内容。 */
const getManagedContentElements = (cell: Element, type: CopyTestGeneratedColumnType): Element[] => {
  /** 精确匹配指定 Result 或 Evidence 受控根块的属性选择器。 */
  const selector = `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${type}"]`;
  return cell.matches(selector) ? [cell] : Array.from(cell.querySelectorAll(selector));
};

/** 删除受控内容。 */
const removeManagedContent = (cell: Element, type: CopyTestGeneratedColumnType): void => {
  getManagedContentElements(cell, type).forEach(
    /** 只删除 CopyTest 标记的受控块，保留单元格内人工内容。 */
    element => element.remove()
  );
};

/** 替换受控内容并保留人工内容。 */
const replaceManagedContent = (cell: Element, content: Element, type: CopyTestGeneratedColumnType): void => {
  /** 单元格内已有的同类型 CopyTest 受控块。 */
  const existingContents = getManagedContentElements(cell, type);
  if (existingContents.length > 0) {
    existingContents[0].replaceWith(content);
    existingContents.slice(1).forEach(
      /** 清理历史遗留的重复受控块，避免重复回写。 */
      element => element.remove()
    );
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
  return new Map(
    results.map(
      /** 以接口数据行下标建立结果快速查找项。 */
      result => [result.rowIndex, result]
    )
  );
};

/** 合并一个逻辑行组内的校验结果。 */
const getLogicalResult = (
  resultMap: Map<number, CopyTestValidationResultWithEvidence>,
  group: CopyTestRowGroup
): CopyTestValidationResultWithEvidence | null => {
  /** 当前不可拆分来源行组中实际返回的全部校验结果。 */
  const groupResults = group.dataRowIndexes
    .map(
      /** 按业务数据行下标读取可能存在的校验结果。 */
      rowIndex => resultMap.get(rowIndex)
    )
    .filter(
      /** 去除未选择或接口未返回结果的业务行。 */
      (result): result is CopyTestValidationResultWithEvidence => Boolean(result)
    );
  if (groupResults.length === 0) {
    return null;
  }

  /** 提供显式 Evidence 合并契约的行组首条结果。 */
  const firstResult = groupResults[0];
  return {
    evidenceImageFileNames: Array.from(
      new Set(
        groupResults.flatMap(
          /** 合并组内模型显式声明的全部 Evidence 文件名。 */
          result => result.evidenceImageFileNames || []
        )
      )
    ),
    evidenceImages: groupResults.flatMap(
      /** 合并组内所有已绑定的 Evidence 图片引用。 */
      result => result.evidenceImages
    ),
    evidenceRowSpan: firstResult.evidenceRowSpan,
    hideEvidenceCell: firstResult.hideEvidenceCell,
    languageIssues: Array.from(
      new Set(
        groupResults.flatMap(
          /** 合并并去重行组内所有模型问题描述。 */
          result => result.languageIssues || []
        )
      )
    ),
    passed: groupResults.every(
      /** 只有行组内每条已返回结果都通过时，整体才通过。 */
      result => result.passed
    ),
    rowIndex: group.dataRowIndexes[0],
  };
};

/** 构建逻辑行和校验结果的绑定。 */
const buildLogicalRowResults = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[]
): LogicalRowResult[] => {
  /** 按数据行下标索引全部校验结果。 */
  const resultMap = buildResultMap(results);
  return rowGroups.map(
    /** 将每个不可拆分来源行组绑定到其聚合校验结果。 */
    rowGroup => ({
      result: getLogicalResult(resultMap, rowGroup),
      rowGroup,
    })
  );
};

/** 读取模型分组需要覆盖的逻辑行。 */
const readExplicitEvidenceRows = (items: LogicalRowResult[], startIndex: number): ExplicitEvidenceRows => {
  /** 当前候选 Evidence 合并组的首个逻辑行结果。 */
  const firstItem = items[startIndex];
  if (!firstItem.result || firstItem.result.hideEvidenceCell) {
    return { rows: [], rowSpan: 0 };
  }

  /** 模型显式要求当前 Evidence 单元格覆盖的逻辑行组数量。 */
  const targetGroupCount = Math.max(1, firstItem.result.evidenceRowSpan || 1);
  /** 从当前锚点起收集到的可写逻辑行组。 */
  const rows: Array<CopyTestRowGroup & { result: CopyTestValidationResultWithEvidence }> = [];
  for (let index = startIndex; index < items.length && rows.length < targetGroupCount; index += 1) {
    /** 当前扫描位置的逻辑行及其可选结果。 */
    const item = items[index];
    if (item.result) {
      rows.push({ ...item.rowGroup, result: item.result });
    }
  }
  return {
    rows,
    rowSpan: rows.reduce(
      /** 将每个原子行组的物理跨度累加为 Evidence 单元格 rowspan。 */
      (total, row) => total + row.rowSpan,
      0
    ),
  };
};

/** 从逻辑行创建 Evidence 合并组。 */
const createEvidenceGroup = (evidenceRows: ExplicitEvidenceRows): EvidenceGroup | null => {
  /** 模型显式分组中收集的逻辑行及其合计物理跨度。 */
  const { rows, rowSpan } = evidenceRows;
  if (rows.length === 0) {
    return null;
  }

  /** 提供 Evidence 图片集合和锚点的分组首行。 */
  const firstRow = rows[0];
  return {
    anchorRowIndex: firstRow.anchorRowIndex,
    rowGroups: rows,
    rowSpan,
    screens: createScreenRefs(firstRow.result.evidenceImages, firstRow.anchorRowIndex),
  };
};

/** 构建模型显式指定的 Evidence 合并组。 */
const buildExplicitEvidenceGroups = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[]
): EvidenceGroup[] => {
  /** 所有原子来源行组与聚合校验结果的顺序绑定。 */
  const items = buildLogicalRowResults(rowGroups, results);
  return items.flatMap(
    /** 仅从显式可见 Evidence 结果锚点创建合并组。 */
    (item, index) => {
      if (!item.result || item.result.hideEvidenceCell) {
        return [];
      }

      /** 从当前模型锚点构造的 Evidence 合并组。 */
      const group = createEvidenceGroup(readExplicitEvidenceRows(items, index));
      return group ? [group] : [];
    }
  );
};

/** 清理未校验逻辑行的受控内容。 */
const clearSkippedRows = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[],
  resultMap: Map<number, CopyTestValidationResultWithEvidence>
): void => {
  rowGroups
    .filter(
      /** 选择本次没有任何校验结果的不可拆分来源行组。 */
      group => !getLogicalResult(resultMap, group)
    )
    .forEach(
      /** 清除跳过行组的旧受控内容并恢复与来源列一致的跨度。 */
      group => {
        /** 当前行组锚点对应的 Result 单元格。 */
        const resultCell = ensureWritableGeneratedCell(
          doc,
          context.model,
          group.anchorRowIndex,
          context.resultColumnIndex,
          COPY_TEST_GENERATED_RESULT_TYPE,
          context.sourceColumnKey
        );
        /** 当前行组锚点对应的 Evidence 单元格。 */
        const evidenceCell = ensureWritableGeneratedCell(
          doc,
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
        removeCoveredGeneratedCells(
          context.model,
          group.anchorRowIndex,
          group.rowSpan,
          COPY_TEST_GENERATED_RESULT_TYPE,
          context.sourceColumnKey
        );
        removeCoveredGeneratedCells(
          context.model,
          group.anchorRowIndex,
          group.rowSpan,
          COPY_TEST_GENERATED_EVIDENCE_TYPE,
          context.sourceColumnKey
        );
      }
    );
};

/** 写 Result 单元格。 */
const writeResultCell = (
  doc: Document,
  context: GeneratedColumnContext,
  group: CopyTestRowGroup,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): void => {
  /** 与来源原子行组锚点和 rowspan 对齐的 Result 单元格。 */
  const cell = ensureWritableGeneratedCell(
    doc,
    context.model,
    group.anchorRowIndex,
    context.resultColumnIndex,
    COPY_TEST_GENERATED_RESULT_TYPE,
    context.sourceColumnKey
  );
  applyCellRowSpan(cell, group.rowSpan);
  replaceManagedContent(cell, createResultContent(doc, result, screens), COPY_TEST_GENERATED_RESULT_TYPE);
  removeCoveredGeneratedCells(
    context.model,
    group.anchorRowIndex,
    group.rowSpan,
    COPY_TEST_GENERATED_RESULT_TYPE,
    context.sourceColumnKey
  );
};

/** 写 Evidence 单元格。 */
const writeEvidenceCell = (doc: Document, context: GeneratedColumnContext, group: EvidenceGroup): void => {
  /** 与显式 Evidence 合并组锚点和 rowspan 对齐的 Evidence 单元格。 */
  const cell = ensureWritableGeneratedCell(
    doc,
    context.model,
    group.anchorRowIndex,
    context.evidenceColumnIndex,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    context.sourceColumnKey
  );
  applyCellRowSpan(cell, group.rowSpan);
  replaceManagedContent(cell, createEvidenceContent(doc, group.screens), COPY_TEST_GENERATED_EVIDENCE_TYPE);
  removeCoveredGeneratedCells(
    context.model,
    group.anchorRowIndex,
    group.rowSpan,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    context.sourceColumnKey
  );
};

/** 应用校验结果到当前 working table。 */
export const applyCopyTestValidationResults = (
  table: CopyTestWorkingTable,
  results: CopyTestValidationResultWithEvidence[],
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable => {
  /** 已补齐当前来源列双列及严格 ownership 的编辑上下文。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    throw new Error('Generated result columns cannot be created');
  }

  /** 生成受控内容时必须复用的工作表格 owner document。 */
  const doc = ensured.context.tableElement.ownerDocument;
  /** 当前 Comparison Column 按来源 rowspan 划分的原子行组。 */
  const rowGroups = buildCopyTestRowGroups(refreshWorkingTable(table, ensured.html), selectedColumnIndex);
  /** 用于识别本次未校验行组的结果索引。 */
  const resultMap = buildResultMap(results);
  clearSkippedRows(doc, ensured.context, rowGroups, resultMap);
  buildExplicitEvidenceGroups(rowGroups, results).forEach(
    /** 按模型显式分组同步对应 Result 行组和共享 Evidence 单元格。 */
    evidenceGroup => {
      evidenceGroup.rowGroups.forEach(
        /** 每个不可拆分来源行组独立写 Result，但共享同组 Screen 引用。 */
        rowGroup => {
          writeResultCell(doc, ensured.context, rowGroup, rowGroup.result, evidenceGroup.screens);
        }
      );
      writeEvidenceCell(doc, ensured.context, evidenceGroup);
    }
  );

  return refreshWorkingTable(table, toConfluenceStorageHtml(ensured.context.tableElement.outerHTML));
};

/** 确保当前列生成列并返回新工作表格。 */
export const ensureCopyTestWorkingColumns = (
  table: CopyTestWorkingTable,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable => {
  /** 当前来源列双列补齐后的编辑结果；无有效 table 时为空。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  return ensured ? refreshWorkingTable(table, ensured.html) : table;
};

/** 读取同 source column 的生成单元格。 */
const getGeneratedCellsForSource = (
  tableElement: Element,
  type: CopyTestGeneratedColumnType,
  sourceColumnKey: string
): Element[] => {
  return Array.from(tableElement.querySelectorAll('td,th')).filter(
    /** 只认领类型、source key、owner 和 schema 均属于当前来源列的生成单元格。 */
    cell => {
      return (
        cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === type &&
        cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) === sourceColumnKey &&
        cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE) === sourceColumnKey &&
        cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE) === COPY_TEST_SCHEMA_VERSION
      );
    }
  );
};

/** 读取单元格在当前模型里的行范围。 */
const getCellRowRange = (model: CopyTestTableModel, cell: Element): TableRowRange | null => {
  /** 与目标 DOM 单元格引用完全相同的结构化单元格模型。 */
  const matchedCell = model.rows
    .flatMap(
      /** 展开所有物理行直接拥有的单元格模型。 */
      row => row.cells
    )
    .find(
      /** 通过 DOM 对象身份精确定位目标单元格。 */
      item => item.element === cell
    );
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
const getAffectedResultRanges = (rowGroups: CopyTestRowGroup[], evidenceRange: TableRowRange): TableRowRange[] => {
  /** 与 Evidence 物理范围相交的所有来源原子行组范围。 */
  const matchedRanges = rowGroups.map(getRowGroupRange).filter(
    /** 只保留被待删除 Evidence 单元格覆盖到的 Result 行组。 */
    groupRange => isRowRangeIntersected(groupRange, evidenceRange)
  );
  return matchedRanges.length > 0 ? matchedRanges : [evidenceRange];
};

/** 判断 Result 单元格是否落在受影响范围内。 */
const isResultCellInAffectedRanges = (
  model: CopyTestTableModel,
  cell: Element,
  affectedRanges: TableRowRange[]
): boolean => {
  /** 当前 Result 单元格在物理行上的闭区间。 */
  const resultRange = getCellRowRange(model, cell);
  return Boolean(
    resultRange &&
    affectedRanges.some(
      /** 任一删除影响范围相交即需要同步该 Result 单元格。 */
      range => isRowRangeIntersected(resultRange, range)
    )
  );
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
  return getGeneratedCellsForSource(tableElement, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey).some(
    /** 检查每个同 ownership Evidence 单元格是否在目标范围内仍含图片。 */
    cell => {
      /** 当前 Evidence 单元格覆盖的物理行闭区间。 */
      const evidenceRange = getCellRowRange(model, cell);
      return Boolean(evidenceRange && isRowRangeIntersected(evidenceRange, range) && hasEvidenceImage(cell));
    }
  );
};

/** 判断 Result 引用是否匹配删除目标。 */
const isResultReferenceTarget = (element: Element, target: CopyTestEvidenceDeleteTarget): boolean => {
  return (
    element.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) === target.imageId &&
    element.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE) === target.instanceId
  );
};

/** 删除空 Result 受控块。 */
const removeEmptyResultRoot = (element: Element): void => {
  /** 指定引用所在的 Result 受控内容根块。 */
  const root = element.closest(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`);
  if (!root) {
    return;
  }

  /** 删除目标后该 Result 根块中是否仍有其他图片引用。 */
  const hasRemainingReference = root.querySelector(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`) !== null;
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
  /** 已补齐并识别当前来源列双列的编辑上下文。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    return { imageStillUsed: false, removed: false, table };
  }

  /** 用于隔离当前 Comparison Column 双列的 ownership 键。 */
  const sourceColumnKey = ensured.context.sourceColumnKey;
  /** 当前 Comparison Column 的不可拆分来源行组。 */
  const rowGroups = buildCopyTestRowGroups(refreshWorkingTable(table, ensured.html), selectedColumnIndex);
  /** 待同步删除 Result 引用的物理行范围集合。 */
  const affectedResultRanges: TableRowRange[] = [];
  let removed = false;
  getGeneratedCellsForSource(ensured.context.tableElement, COPY_TEST_GENERATED_EVIDENCE_TYPE, sourceColumnKey).forEach(
    /** 仅在当前 ownership 的 Evidence 单元格中查找目标图片实例。 */
    cell => {
      cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${target.imageId}"]`).forEach(
        /** 图片 ID 和实例 ID 都精确匹配时删除对应 Evidence 卡片。 */
        imageElement => {
          if (imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) !== target.instanceId) {
            return;
          }
          /** 目标 Evidence 单元格覆盖的物理行闭区间。 */
          const evidenceRange = getCellRowRange(ensured.context.model, cell);
          if (evidenceRange) {
            affectedResultRanges.push(...getAffectedResultRanges(rowGroups, evidenceRange));
          }
          (imageElement.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`) || imageElement).remove();
          removed = true;
        }
      );
      if (!cell.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)) {
        removeManagedContent(cell, COPY_TEST_GENERATED_EVIDENCE_TYPE);
      }
    }
  );

  if (!removed) {
    return { imageStillUsed: false, removed: false, table };
  }

  getGeneratedCellsForSource(ensured.context.tableElement, COPY_TEST_GENERATED_RESULT_TYPE, sourceColumnKey).forEach(
    /** 只在受 Evidence 删除影响的当前 ownership Result 单元格中同步引用。 */
    cell => {
      if (!isResultCellInAffectedRanges(ensured.context.model, cell, affectedResultRanges)) {
        return;
      }

      cell.querySelectorAll(RESULT_LIST_ITEM_TAG).forEach(
        /** 精确删除与 Evidence 图片实例对应的 Result 列表项。 */
        resultReference => {
          if (!isResultReferenceTarget(resultReference, target)) {
            return;
          }
          /** Result 引用所属的 CopyTest 受控内容根块。 */
          const root = resultReference.closest(
            `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"]`
          );
          resultReference.remove();
          if (root instanceof Element) {
            removeEmptyResultRoot(root);
          }
        }
      );

      /** 当前 Result 单元格覆盖的物理行闭区间。 */
      const resultRange = getCellRowRange(ensured.context.model, cell);
      if (
        resultRange &&
        !hasEvidenceImageInRange(ensured.context.model, ensured.context.tableElement, sourceColumnKey, resultRange)
      ) {
        removeManagedContent(cell, COPY_TEST_GENERATED_RESULT_TYPE);
      }
    }
  );

  /** 删除后整张工作表格中是否仍有相同附件文件的 Evidence 引用。 */
  const imageStillUsed =
    ensured.context.tableElement.querySelector(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="${target.imageId}"]`) !==
    null;
  return {
    imageStillUsed,
    removed,
    table: refreshWorkingTable(table, toConfluenceStorageHtml(ensured.context.tableElement.outerHTML)),
  };
};
