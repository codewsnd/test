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
import {
  planCopyTestEvidenceGroups,
  type CopyTestEvidenceScreen,
  type CopyTestEvidenceSourceGroup,
} from './copyTestEvidencePlanner';
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
  /** 删除后仍可用于重新规划 Evidence 的逐行校验结果。 */
  validationResults?: CopyTestValidationResultWithEvidence[];
  /** 从当前表格恢复或沿用的 Evidence 图片顺序。 */
  validationImages?: CopyTestImage[];
}

/** 删除 Evidence 时复用的最近一次结构化校验快照。 */
export interface CopyTestValidationSnapshot {
  /** 最近一次校验使用且保留上传顺序的图片。 */
  images: CopyTestImage[];
  /** 最近一次校验产生的逐来源原子行结果。 */
  results: CopyTestValidationResultWithEvidence[];
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
  /** 合并组内不可拆分的来源行组、校验结果及其 Result Screen 子集。 */
  rowGroups: EvidenceGroupRow[];
}

/** Evidence 合并组中的单个来源原子行。 */
interface EvidenceGroupRow extends CopyTestRowGroup {
  /** 当前来源原子行的逐行校验结果。 */
  result: CopyTestValidationResultWithEvidence;
  /** 当前 Result 真正引用的组内 Screen 子集。 */
  screens: ScreenRef[];
}

/** 逻辑行和模型结果的绑定。 */
interface LogicalRowResult {
  /** 当前来源行组对应的校验结果；未选择时为 null。 */
  result: CopyTestValidationResultWithEvidence | null;
  /** Comparison Column 中不可拆分的来源行组。 */
  rowGroup: CopyTestRowGroup;
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
        evidenceImages: images.filter(
          /** 只绑定模型显式列出的附件文件名，不做隐式回退。 */
          image => fileNames.includes(image.fileName)
        ),
      };
    }
  );
};

/** 使用来源 ownership、组锚点和图片标识生成不依赖 Screen 序号的实例 ID。 */
const getImageInstanceId = (
  image: CopyTestImage,
  rowIndex: number,
  sourceColumnKey: string
): string => {
  return `${sourceColumnKey}:${rowIndex}:${getCopyTestImageId(image)}`;
};

/** 创建共享给 Evidence 和逐行 Result 的图片引用。 */
const createScreenRefs = (
  screens: CopyTestEvidenceScreen[],
  anchorRowIndex: number,
  sourceColumnKey: string
): ScreenRef[] => {
  return screens.map(
    /** 为当前行组的每张 Evidence 图片生成稳定引用与展示标签。 */
    screen => ({
      image: screen.image,
      imageId: getCopyTestImageId(screen.image),
      instanceId: getImageInstanceId(screen.image, anchorRowIndex, sourceColumnKey),
      label: screen.label,
    })
  );
};

/** 读取失败原因。 */
const getFailureReasons = (result: CopyTestValidationResultWithEvidence): string[] => {
  return result.languageIssues.filter(
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
  /** 来源原子组对外唯一使用的业务锚点下标。 */
  const anchorDataRowIndex = group.dataRowIndexes[0];
  if (anchorDataRowIndex === undefined) {
    return null;
  }
  return resultMap.get(anchorDataRowIndex) || null;
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

/** 将逻辑行结果转换为 Evidence Planner 的不可拆分来源原子组。 */
const buildEvidenceSourceGroups = (items: LogicalRowResult[]): CopyTestEvidenceSourceGroup[] => {
  return items.map(item => ({
    anchorRowIndex: item.rowGroup.anchorRowIndex,
    evidenceImages: item.result?.evidenceImages || [],
    hasResult: Boolean(item.result),
    rowSpan: item.rowGroup.rowSpan,
    selected: Boolean(item.result),
  }));
};

/** 按文件名从组内共享 Screen 中筛选单行 Result 子集。 */
const filterRowScreens = (
  screens: ScreenRef[],
  result: CopyTestValidationResultWithEvidence
): ScreenRef[] => {
  /** 当前逐行结果实际引用的 Evidence 文件名。 */
  const fileNames = new Set(result.evidenceImages.map(image => image.fileName));
  return screens.filter(screen => fileNames.has(screen.image.fileName));
};

/** 将 Planner 结果绑定回来源行组及其逐行校验结果。 */
const buildEvidenceGroupRows = (
  sourceGroups: CopyTestEvidenceSourceGroup[],
  itemByAnchorRowIndex: Map<number, LogicalRowResult>,
  screens: ScreenRef[]
): EvidenceGroupRow[] => {
  return sourceGroups.flatMap(sourceGroup => {
    /** 与 Planner 来源原子组锚点对应的逻辑行结果。 */
    const item = itemByAnchorRowIndex.get(sourceGroup.anchorRowIndex);
    if (!item?.result) {
      return [];
    }

    return [{
      ...item.rowGroup,
      result: item.result,
      screens: filterRowScreens(screens, item.result),
    }];
  });
};

/** 使用逐行图片关系构建前端确定性 Evidence 合并组。 */
const buildEvidenceGroups = (
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[],
  uploadedImages: CopyTestImage[],
  sourceColumnKey: string
): EvidenceGroup[] => {
  /** 所有原子来源行组与聚合校验结果的顺序绑定。 */
  const items = buildLogicalRowResults(rowGroups, results);
  /** 便于 Planner 输出按物理锚点绑定回完整行结果的索引。 */
  const itemByAnchorRowIndex = new Map(items.map(item => [item.rowGroup.anchorRowIndex, item]));
  return planCopyTestEvidenceGroups(buildEvidenceSourceGroups(items), uploadedImages).map(plan => {
    /** Evidence 与组内 Result 共同使用的唯一 Screen 注册表。 */
    const screens = createScreenRefs(plan.screens, plan.anchorRowIndex, sourceColumnKey);
    return {
      anchorRowIndex: plan.anchorRowIndex,
      rowGroups: buildEvidenceGroupRows(plan.sourceGroups, itemByAnchorRowIndex, screens),
      rowSpan: plan.rowSpan,
      screens,
    };
  });
};

/** 清理未校验或没有 Evidence 图片的逻辑行受控内容。 */
const clearUnrenderedRows = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[],
  renderableAnchorRowIndexes: Set<number>
): void => {
  rowGroups
    .filter(
      /** 选择本次没有可渲染图片结果的不可拆分来源行组。 */
      group => !renderableAnchorRowIndexes.has(group.anchorRowIndex)
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

/** 把当前来源列的生成双列恢复为来源原子 rowspan，并刷新结构模型。 */
const restoreGeneratedColumnStructure = (
  doc: Document,
  context: GeneratedColumnContext,
  selectedColumnIndex: number
): GeneratedColumnContext => {
  syncGeneratedColumnSpans(
    doc,
    context.model,
    selectedColumnIndex,
    context.resultColumnIndex,
    COPY_TEST_GENERATED_RESULT_TYPE,
    context.sourceColumnKey
  );
  syncGeneratedColumnSpans(
    doc,
    context.model,
    selectedColumnIndex,
    context.evidenceColumnIndex,
    COPY_TEST_GENERATED_EVIDENCE_TYPE,
    context.sourceColumnKey
  );
  return {
    ...context,
    model: parseTableModel(context.tableElement),
  };
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
  selectedColumnLabel: string,
  uploadedImages: CopyTestImage[]
): CopyTestWorkingTable => {
  /** 已补齐当前来源列双列及严格 ownership 的编辑上下文。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    throw new Error('Generated result columns cannot be created');
  }

  /** 生成受控内容时必须复用的工作表格 owner document。 */
  const doc = ensured.context.tableElement.ownerDocument;
  /** 清除旧 Evidence 合并结构后与来源原子组重新对齐的编辑上下文。 */
  const context = restoreGeneratedColumnStructure(doc, ensured.context, selectedColumnIndex);
  /** 结构恢复后供来源 rowSpan 投影使用的最新工作表格。 */
  const restoredTable = refreshWorkingTable(
    table,
    toConfluenceStorageHtml(context.tableElement.outerHTML)
  );
  /** 当前 Comparison Column 按来源 rowspan 划分的原子行组。 */
  const rowGroups = buildCopyTestRowGroups(restoredTable, selectedColumnIndex);
  /** 逐行关系经过图片顺序与连续性规则计算出的全部 Evidence 组。 */
  const evidenceGroups = buildEvidenceGroups(
    rowGroups,
    results,
    uploadedImages,
    context.sourceColumnKey
  );
  /** 本次实际拥有可渲染图片 Result 的来源物理锚点集合。 */
  const renderableAnchorRowIndexes = new Set(
    evidenceGroups.flatMap(group => group.rowGroups.map(rowGroup => rowGroup.anchorRowIndex))
  );
  clearUnrenderedRows(doc, context, rowGroups, renderableAnchorRowIndexes);
  evidenceGroups.forEach(
    /** 按前端确定性规划同步逐行 Result 和共享 Evidence 单元格。 */
    evidenceGroup => {
      evidenceGroup.rowGroups.forEach(
        /** 每个不可拆分来源行组只写入自身实际命中的 Screen 子集。 */
        rowGroup => {
          writeResultCell(doc, context, rowGroup, rowGroup.result, rowGroup.screens);
        }
      );
      writeEvidenceCell(doc, context, evidenceGroup);
    }
  );

  return refreshWorkingTable(table, toConfluenceStorageHtml(context.tableElement.outerHTML));
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

/** 从 Result 根块读取去重后的图片文件名。 */
const readResultImageFileNames = (resultRoot: Element): string[] => {
  /** 当前 Result 根块中按 DOM 顺序出现的图片文件名。 */
  const fileNames = Array.from(
    resultRoot.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`)
  ).flatMap(reference => {
    /** Result Screen 引用中保存的稳定图片文件名。 */
    const fileName = reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE)?.trim();
    return fileName ? [fileName] : [];
  });
  return Array.from(new Set(fileNames));
};

/** 从失败 Result 根块读取去重的问题说明。 */
const readResultLanguageIssues = (resultRoot: Element): string[] => {
  /** Result Screen 二级列表中保存的问题说明。 */
  const issues = Array.from(resultRoot.querySelectorAll('ul ul li')).flatMap(item => {
    /** 去除前后空白后的单条问题说明。 */
    const issue = item.textContent?.trim();
    return issue ? [issue] : [];
  });
  return Array.from(new Set(issues));
};

/** 从当前 managed Result 单元格恢复单个来源原子组结果。 */
const hydrateValidationResult = (
  group: CopyTestRowGroup,
  resultCell: Element | undefined,
  imageByFileName: Map<string, CopyTestImage>
): CopyTestValidationResultWithEvidence | null => {
  /** 当前单元格中唯一受 CopyTest 管理的 Result 根块。 */
  const resultRoot = resultCell
    ? getManagedContentElements(resultCell, COPY_TEST_GENERATED_RESULT_TYPE)[0]
    : undefined;
  /** 来源原子组对外使用的业务锚点下标。 */
  const rowIndex = group.dataRowIndexes[0];
  if (!resultRoot || rowIndex === undefined) {
    return null;
  }

  /** 当前逐行 Result 真正引用的图片文件名。 */
  const evidenceImageFileNames = readResultImageFileNames(resultRoot);
  if (evidenceImageFileNames.length === 0) {
    return null;
  }

  /** Result 状态节点是否明确标记为 Passed。 */
  const passed = resultRoot.querySelector(COPY_TEST_CONTENT_LABEL_TAG)?.textContent?.trim() === PASSED_LABEL;
  return {
    evidenceImageFileNames,
    evidenceImages: evidenceImageFileNames.flatMap(fileName => {
      /** 当前文件名对应的轻量图片引用。 */
      const image = imageByFileName.get(fileName);
      return image ? [image] : [];
    }),
    languageIssues: passed ? [] : readResultLanguageIssues(resultRoot),
    passed,
    rowIndex,
  };
};

/** 从当前 Pair 的 Evidence DOM 顺序恢复轻量图片集合。 */
const hydrateValidationImages = (
  table: CopyTestWorkingTable,
  evidenceColumnIndex: number
): CopyTestImage[] => {
  /** 已按首次出现顺序恢复的图片文件名。 */
  const fileNames = table.model.rows.slice(FIRST_DATA_ROW_INDEX).flatMap(row => {
    /** 当前物理行直接拥有的 Evidence 单元格。 */
    const cell = row.slots[evidenceColumnIndex]?.owned
      ? row.slots[evidenceColumnIndex]?.cell.element
      : undefined;
    if (!cell) {
      return [];
    }
    return Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)).flatMap(image => {
      /** Evidence 图片节点保存的稳定文件名。 */
      const fileName = image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE)?.trim();
      return fileName ? [fileName] : [];
    });
  });
  return Array.from(new Set(fileNames)).map(fileName => ({ base64: '', fileName }));
};

/** 从新契约生成的 working DOM 恢复删除所需的逐行校验快照。 */
const hydrateValidationSnapshot = (
  table: CopyTestWorkingTable,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestValidationSnapshot | null => {
  /** 当前来源列稳定 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 当前 Pair 的 Result/Evidence 逻辑列下标。 */
  const indexes = findGeneratedColumnIndexes(table.headers, sourceColumnKey);
  if (indexes.result === undefined || indexes.evidence === undefined) {
    return null;
  }

  /** 按 Evidence DOM 顺序恢复的轻量图片集合。 */
  const images = hydrateValidationImages(table, indexes.evidence);
  /** 便于 Result 文件名绑定轻量图片的索引。 */
  const imageByFileName = new Map(images.map(image => [image.fileName, image]));
  /** 当前来源列全部不可拆分原子组。 */
  const rowGroups = buildCopyTestRowGroups(table, selectedColumnIndex);
  /** 从每个来源锚点 managed Result 恢复出的逐行关系。 */
  const results = rowGroups.flatMap(group => {
    /** 当前来源锚点直接拥有的 Result 单元格。 */
    const resultCell = table.model.rows[group.anchorRowIndex]?.slots[indexes.result!]?.cell.element;
    /** 当前来源原子组恢复出的可选逐行结果。 */
    const result = hydrateValidationResult(group, resultCell, imageByFileName);
    return result ? [result] : [];
  });
  return images.length > 0 && results.length > 0 ? { images, results } : null;
};

/** 判断工作表格中是否仍有指定图片的任意 Evidence 引用。 */
const isEvidenceImageStillUsed = (table: CopyTestWorkingTable, imageId: string): boolean => {
  /** 当前工作表格中全部受控 Evidence 图片节点。 */
  const imageElements = parseHtml(table.workingHtml)
    .querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`);
  return Array.from(imageElements).some(
    /** 使用属性值比较，避免把文件名直接拼入 CSS selector。 */
    element => element.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) === imageId
  );
};

/** 从目标 Evidence 组的逐行结果中移除指定图片。 */
const removeImageFromValidationGroup = (
  results: CopyTestValidationResultWithEvidence[],
  group: EvidenceGroup,
  imageFileName: string
): CopyTestValidationResultWithEvidence[] => {
  /** 目标 Evidence 实例实际覆盖的来源原子行索引。 */
  const targetRowIndexes = new Set(group.rowGroups.map(rowGroup => rowGroup.result.rowIndex));
  return results.map(result => {
    if (!targetRowIndexes.has(result.rowIndex)) {
      return result;
    }

    return {
      ...result,
      evidenceImageFileNames: result.evidenceImageFileNames.filter(fileName => fileName !== imageFileName),
      evidenceImages: result.evidenceImages.filter(image => image.fileName !== imageFileName),
    };
  });
};

/** 使用结构化校验快照删除图片并全量重新投影当前生成双列。 */
const deleteEvidenceImageFromSnapshot = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  snapshot: CopyTestValidationSnapshot
): CopyTestEvidenceDeleteResult => {
  /** 当前 Comparison Column 的不可拆分来源原子组。 */
  const rowGroups = buildCopyTestRowGroups(table, selectedColumnIndex);
  /** 当前来源列稳定 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 包含待删除图片实例的唯一 Evidence 规划组。 */
  const targetGroup = buildEvidenceGroups(
    rowGroups,
    snapshot.results,
    snapshot.images,
    sourceColumnKey
  ).find(group => group.screens.some(screen => {
    return screen.imageId === target.imageId && screen.instanceId === target.instanceId;
  }));
  if (!targetGroup) {
    return { imageStillUsed: false, removed: false, table };
  }

  /** 与删除实例对应的组内图片。 */
  const targetScreen = targetGroup.screens.find(screen => screen.instanceId === target.instanceId)!;
  /** 只从目标 Evidence 实例覆盖的逐行关系中移除图片后的结果。 */
  const validationResults = removeImageFromValidationGroup(
    snapshot.results,
    targetGroup,
    targetScreen.image.fileName
  );
  /** 基于剩余逐行关系重新规划并写入的工作表格。 */
  const nextTable = applyCopyTestValidationResults(
    table,
    validationResults,
    selectedColumnIndex,
    selectedColumnLabel,
    snapshot.images
  );
  return {
    imageStillUsed: isEvidenceImageStillUsed(nextTable, target.imageId),
    removed: true,
    table: nextTable,
    validationImages: snapshot.images,
    validationResults,
  };
};

/** 删除 Evidence 图片并同步当前 source column 的 Result 引用。 */
export const deleteCopyTestEvidenceImage = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  snapshot?: CopyTestValidationSnapshot
): CopyTestEvidenceDeleteResult => {
  /** 调用方快照缺失时从新契约 working DOM 恢复逐行图片关系。 */
  const effectiveSnapshot = snapshot || hydrateValidationSnapshot(
    table,
    selectedColumnIndex,
    selectedColumnLabel
  );
  if (!effectiveSnapshot) {
    return { imageStillUsed: false, removed: false, table };
  }
  return deleteEvidenceImageFromSnapshot(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel,
    effectiveSnapshot
  );
};
