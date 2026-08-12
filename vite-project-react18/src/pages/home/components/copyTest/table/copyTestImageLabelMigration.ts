/**
 * 文件作用：把已导入 CopyTest 表格中的历史 Screen 标签迁移为真实图片文件名。
 */
import { getCopyTestStoredImageDisplayName } from './copyTestImageUtils';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
  COPY_TEST_SCHEMA_VERSION,
} from './tableConstants';
import { parseHtml, toConfluenceStorageHtml } from './tableModel';

/** CopyTest 标签迁移后的 working HTML 和受影响来源列。 */
export interface CopyTestImageLabelMigrationResult {
  /** 完成历史标签迁移后的单表 HTML；没有变化时原样返回输入。 */
  html: string;
  /** 实际发生标签变化的来源列 ownership key。 */
  sourceColumnKeys: string[];
}

/** 当前迁移允许处理的严格生成列类型。 */
type CopyTestManagedColumnType =
  | typeof COPY_TEST_GENERATED_EVIDENCE_TYPE
  | typeof COPY_TEST_GENERATED_RESULT_TYPE;

/** 已通过 schema、owner 和来源列校验的生成单元格。 */
interface CopyTestManagedCell {
  /** 当前 Result 或 Evidence 单元格。 */
  cell: HTMLTableCellElement;
  /** 当前生成单元格所属来源列的稳定 key。 */
  sourceColumnKey: string;
  /** 当前生成单元格的业务类型。 */
  type: CopyTestManagedColumnType;
}

/** 单张历史 Evidence 图片恢复出的展示标签。 */
interface CopyTestStoredImageLabel {
  /** Evidence 和 Result 共同使用的稳定图片 ID。 */
  imageId: string;
  /** 去掉路径和扩展名后的用户可识别标签。 */
  label: string;
  /** Evidence 卡片中保存可见标签的 strong 节点。 */
  labelElement?: Element;
}

/** 按来源列和图片 ID 保存的历史标签索引。 */
type CopyTestStoredImageLabelMap = Map<string, Map<string, string>>;

/** 判断生成列类型是否属于当前迁移支持的 Result/Evidence。 */
const isManagedColumnType = (value: string | null): value is CopyTestManagedColumnType => {
  return value === COPY_TEST_GENERATED_RESULT_TYPE
    || value === COPY_TEST_GENERATED_EVIDENCE_TYPE;
};

/** 读取单元格的严格 CopyTest ownership；不认领旧版或不完整 metadata。 */
const readManagedCell = (
  cell: HTMLTableCellElement,
  table: HTMLTableElement
): CopyTestManagedCell | null => {
  if (cell.closest('table') !== table) {
    return null;
  }

  /** 当前单元格声明的 Result/Evidence 类型。 */
  const type = cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE);
  /** 当前单元格声明的来源列 key。 */
  const sourceColumnKey = cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE);
  if (
    !isManagedColumnType(type)
    || !sourceColumnKey
    || cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE) !== sourceColumnKey
    || cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE) !== COPY_TEST_SCHEMA_VERSION
  ) {
    return null;
  }

  return { cell, sourceColumnKey, type };
};

/** 按 DOM 顺序读取当前顶层表格的严格受管单元格。 */
const getManagedCells = (table: HTMLTableElement): CopyTestManagedCell[] => {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>('th,td')).flatMap(cell => {
    /** 当前 DOM 单元格通过严格 ownership 校验后的结果。 */
    const managedCell = readManagedCell(cell, table);
    return managedCell ? [managedCell] : [];
  });
};

/** 查找指定元素中由它直接拥有的标签子元素。 */
const findDirectChildByTagName = (element: Element, tagName: string): Element | undefined => {
  return Array.from(element.children).find(child => child.tagName.toLowerCase() === tagName);
};

/** 读取 ac:image 直属 ri:attachment 中的规范附件文件名。 */
const getAttachmentFileName = (imageElement: Element): string => {
  return findDirectChildByTagName(imageElement, 'ri:attachment')
    ?.getAttribute('ri:filename')
    ?.trim() || '';
};

/** 读取 Evidence 卡片中的稳定图片身份和目标展示标签。 */
const readStoredImageLabel = (card: Element): CopyTestStoredImageLabel | null => {
  /** 当前卡片所在的严格受管单元格。 */
  const ownerCell = card.closest('th,td');
  /** 当前卡片唯一且仍由同一单元格拥有的 ac:image 候选。 */
  const imageCandidates = Array.from(
    card.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`)
  ).filter(element => {
    return element.tagName.toLowerCase() === 'ac:image'
      && element.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`) === card
      && element.closest('th,td') === ownerCell;
  });
  if (!ownerCell || imageCandidates.length !== 1) {
    return null;
  }

  /** 已排除缺失或歧义结构的唯一 Evidence 图片。 */
  const imageElement = imageCandidates[0];
  /** Result 与 Evidence 之间共享的内部图片 ID。 */
  const imageId = imageElement
    .getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE)
    ?.trim() || '';
  /** Confluence 附件引用中的内部文件名。 */
  const attachmentFileName = getAttachmentFileName(imageElement);
  if (!imageId || !attachmentFileName) {
    return null;
  }

  /** Evidence 卡片直接拥有的历史可见标签节点。 */
  const labelElement = findDirectChildByTagName(card, 'strong');
  return {
    imageId,
    label: getCopyTestStoredImageDisplayName({
      attachmentFileName,
      displayFileName: imageElement.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE),
      existingLabel: labelElement?.textContent,
    }),
    labelElement,
  };
};

/** 读取当前单元格直接拥有的 Evidence 卡片。 */
const getOwnedEvidenceCards = (cell: HTMLTableCellElement): Element[] => {
  return Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`))
    .filter(card => card.closest('th,td') === cell);
};

/** 为单个来源列登记第一份稳定图片标签。 */
const registerStoredImageLabel = (
  labelsBySourceColumn: CopyTestStoredImageLabelMap,
  sourceColumnKey: string,
  image: CopyTestStoredImageLabel
): void => {
  /** 当前来源列已经登记的图片标签。 */
  const labelsByImageId = labelsBySourceColumn.get(sourceColumnKey) || new Map<string, string>();
  if (!labelsByImageId.has(image.imageId)) {
    labelsByImageId.set(image.imageId, image.label);
  }
  labelsBySourceColumn.set(sourceColumnKey, labelsByImageId);
};

/** 在修改 DOM 前构建来源列隔离的 Evidence 标签索引。 */
const buildStoredImageLabelMap = (cells: CopyTestManagedCell[]): CopyTestStoredImageLabelMap => {
  /** 防止相同图片 ID 在不同 Comparison Column 之间串用标签。 */
  const labelsBySourceColumn: CopyTestStoredImageLabelMap = new Map();
  cells
    .filter(item => item.type === COPY_TEST_GENERATED_EVIDENCE_TYPE)
    .forEach(item => {
      getOwnedEvidenceCards(item.cell).forEach(card => {
        /** 当前 Evidence 卡片恢复出的图片身份和展示标签。 */
        const image = readStoredImageLabel(card);
        if (image) {
          registerStoredImageLabel(labelsBySourceColumn, item.sourceColumnKey, image);
        }
      });
    });
  return labelsBySourceColumn;
};

/** 替换元素直接拥有的第一个非空文本节点，并保留嵌套问题列表。 */
const replaceVisibleLabel = (element: Element, label: string): boolean => {
  /** 位于嵌套列表或其他子元素之前的可见标签文本节点。 */
  const labelNode = Array.from(element.childNodes).find(node => {
    return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
  });
  if (!labelNode || labelNode.textContent?.trim() === label) {
    return false;
  }

  labelNode.textContent = label;
  return true;
};

/** 迁移一个 Evidence 单元格中的历史卡片标签。 */
const migrateEvidenceCell = (item: CopyTestManagedCell): boolean => {
  /** 当前单元格内是否至少迁移了一张图片标签。 */
  let changed = false;
  getOwnedEvidenceCards(item.cell).forEach(card => {
    /** 当前卡片恢复出的图片身份、目标标签和可见节点。 */
    const image = readStoredImageLabel(card);
    if (image?.labelElement && replaceVisibleLabel(image.labelElement, image.label)) {
      changed = true;
    }
  });
  return changed;
};

/** 迁移一个 Result 单元格中的历史图片引用标签。 */
const migrateResultCell = (
  item: CopyTestManagedCell,
  labelsBySourceColumn: CopyTestStoredImageLabelMap
): boolean => {
  /** 当前 Result 来源列对应的 Evidence 图片标签。 */
  const labelsByImageId = labelsBySourceColumn.get(item.sourceColumnKey);
  if (!labelsByImageId) {
    return false;
  }

  /** 当前单元格内是否至少迁移了一条 Result 图片引用。 */
  let changed = false;
  Array.from(item.cell.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`))
    .filter(reference => reference.closest('th,td') === item.cell)
    .forEach(reference => {
      /** 当前 Result 引用的内部图片 ID。 */
      const imageId = reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE)?.trim() || '';
      /** 同一来源列 Evidence 中恢复出的目标标签。 */
      const label = labelsByImageId.get(imageId);
      if (label && replaceVisibleLabel(reference, label)) {
        changed = true;
      }
    });
  return changed;
};

/** 迁移单个严格受管单元格并返回是否发生变化。 */
const migrateManagedCell = (
  item: CopyTestManagedCell,
  labelsBySourceColumn: CopyTestStoredImageLabelMap
): boolean => {
  return item.type === COPY_TEST_GENERATED_EVIDENCE_TYPE
    ? migrateEvidenceCell(item)
    : migrateResultCell(item, labelsBySourceColumn);
};

/** 将历史 ScreenNN 标签迁移为文件名，并返回需要回写的来源列 key。 */
export const migrateCopyTestImageLabelsWithDetails = (
  tableHtml: string
): CopyTestImageLabelMigrationResult => {
  /** 当前 working HTML 中唯一需要迁移的顶层表格。 */
  const table = parseHtml(tableHtml).querySelector<HTMLTableElement>('table');
  if (!table) {
    return { html: tableHtml, sourceColumnKeys: [] };
  }

  /** 当前表格全部严格受管 Result/Evidence 单元格。 */
  const managedCells = getManagedCells(table);
  /** 修改 Result 前预先恢复的来源列级图片标签。 */
  const labelsBySourceColumn = buildStoredImageLabelMap(managedCells);
  /** 实际发生迁移的来源列，按表格中首次变化顺序去重。 */
  const changedSourceColumnKeys = new Set<string>();
  managedCells.forEach(item => {
    if (migrateManagedCell(item, labelsBySourceColumn)) {
      changedSourceColumnKeys.add(item.sourceColumnKey);
    }
  });

  if (changedSourceColumnKeys.size === 0) {
    return { html: tableHtml, sourceColumnKeys: [] };
  }
  return {
    html: toConfluenceStorageHtml(table.outerHTML),
    sourceColumnKeys: Array.from(changedSourceColumnKeys),
  };
};
