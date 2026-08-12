/**
 * 文件作用：把历史 CopyTest Result/Evidence 的 Screen 标签迁移为图片文件名。
 */
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
import { getCopyTestStoredImageDisplayName } from './copyTestImageUtils';
import { parseHtml, toConfluenceStorageHtml } from './tableModel';

/** 迁移过程中识别出的严格 CopyTest 受管单元格。 */
interface ManagedCell {
  /** 当前 Result/Evidence 单元格。 */
  cell: HTMLTableCellElement;
  /** 单元格所属 Comparison Column 的稳定键。 */
  sourceColumnKey: string;
}

/** 历史图片标签迁移后的 working HTML 和发生变化的 Pair。 */
export interface CopyTestImageLabelMigrationResult {
  /** 完成幂等标签迁移后的单表 HTML。 */
  html: string;
  /** 至少一个 Result/Evidence 标签发生变化的来源列键。 */
  sourceColumnKeys: string[];
}

/** 使用 source key 和内部图片 ID 生成不会跨 Pair 冲突的标签索引键。 */
const getImageLabelKey = (sourceColumnKey: string, imageId: string): string => {
  return `${sourceColumnKey}\u0000${imageId}`;
};

/** 判断元素是否由指定顶层单元格直接拥有。 */
const isOwnedByCell = (element: Element, cell: HTMLTableCellElement): boolean => {
  return element.closest('th,td') === cell;
};

/** 读取严格属于当前 CopyTest schema 的指定类型单元格。 */
const getManagedCells = (
  table: HTMLTableElement,
  type: typeof COPY_TEST_GENERATED_RESULT_TYPE | typeof COPY_TEST_GENERATED_EVIDENCE_TYPE
): ManagedCell[] => {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>('th,td')).flatMap(cell => {
    /** 当前单元格声明的来源列键。 */
    const sourceColumnKey = cell.getAttribute(
      COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE
    )?.trim() || '';
    /** 完整 ownership 防止修改业务列或嵌套表格。 */
    const isManaged = cell.closest('table') === table
      && sourceColumnKey !== ''
      && cell.getAttribute(COPY_TEST_SCHEMA_ATTRIBUTE) === COPY_TEST_SCHEMA_VERSION
      && cell.getAttribute(COPY_TEST_OWNER_ID_ATTRIBUTE) === sourceColumnKey
      && cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) === type;
    return isManaged ? [{ cell, sourceColumnKey }] : [];
  });
};

/** 读取 ac:image 的直属 ri:attachment 文件名。 */
const getAttachmentFileName = (image: Element): string => {
  /** 当前 Confluence 图片的直属附件引用。 */
  const attachment = Array.from(image.children).find(child => {
    return child.tagName.toLowerCase() === 'ri:attachment';
  });
  return attachment?.getAttribute('ri:filename')?.trim() || '';
};

/** 读取 Evidence 图片所在受管卡片。 */
const getEvidenceCard = (
  image: Element,
  cell: HTMLTableCellElement
): HTMLElement | null => {
  /** 当前图片向上最近的 Evidence 卡片。 */
  const card = image.closest<HTMLElement>(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`);
  return card && isOwnedByCell(card, cell) ? card : null;
};

/** 读取 Evidence 卡片的直属可见标签。 */
const getCardLabel = (card: HTMLElement | null): HTMLElement | null => {
  if (!card) {
    return null;
  }
  return Array.from(card.children).find(child => {
    return child.tagName.toLowerCase() === 'strong';
  }) as HTMLElement | undefined || null;
};

/** 读取 Result 条目中位于嵌套问题列表之前的直属标签文本节点。 */
const getResultLabelNode = (reference: HTMLElement): ChildNode | undefined => {
  return Array.from(reference.childNodes).find(node => {
    return node.nodeType === Node.TEXT_NODE && node.textContent?.trim();
  });
};

/** 确保受管 Evidence 卡片包含可见文件名标签。 */
const ensureCardLabel = (
  card: HTMLElement | null,
  image: Element
): HTMLElement | null => {
  /** 已有标签只需复用，避免重排历史卡片。 */
  const existingLabel = getCardLabel(card);
  if (existingLabel || !card) {
    return existingLabel;
  }

  /** 缺失标签时在图片之前补齐与当前结构一致的 strong + br。 */
  const label = image.ownerDocument.createElement('strong');
  const lineBreak = image.ownerDocument.createElement('br');
  card.insertBefore(label, image);
  card.insertBefore(lineBreak, image);
  return label;
};

/** 设置可见标签，并返回内容是否发生变化。 */
const setLabelText = (label: HTMLElement | null, displayName: string): boolean => {
  if (!label || !displayName || label.textContent === displayName) {
    return false;
  }
  label.textContent = displayName;
  return true;
};

/** 迁移 Evidence 标签并构建供 Result 复用的展示名称索引。 */
const migrateEvidenceLabels = (
  table: HTMLTableElement,
  imageLabels: Map<string, string>,
  changedSourceColumnKeys: Set<string>
): boolean => {
  /** 当前表格是否修改过至少一个可见标签。 */
  let changed = false;
  getManagedCells(table, COPY_TEST_GENERATED_EVIDENCE_TYPE).forEach(({ cell, sourceColumnKey }) => {
    Array.from(cell.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`))
      .filter(image => isOwnedByCell(image, cell))
      .forEach(image => {
        /** 内部图片 ID 和附件名在当前 schema 中通常相同。 */
        const imageId = image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE)?.trim() || '';
        const attachmentFileName = getAttachmentFileName(image) || imageId;
        if (!imageId || !attachmentFileName) {
          return;
        }

        /** 旧卡片标签用于在 metadata 缺失时恢复已经展示过的原名。 */
        const card = getEvidenceCard(image, cell);
        const label = ensureCardLabel(card, image);
        const displayName = getCopyTestStoredImageDisplayName({
          attachmentFileName,
          displayFileName: image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE),
          existingLabel: label?.textContent,
        });
        imageLabels.set(getImageLabelKey(sourceColumnKey, imageId), displayName);
        const labelChanged = setLabelText(label, displayName);
        if (labelChanged) {
          changedSourceColumnKeys.add(sourceColumnKey);
        }
        changed = labelChanged || changed;
      });
  });
  return changed;
};

/** 迁移 Result 中与 Evidence 图片 ID 对应的可见标签。 */
const migrateResultLabels = (
  table: HTMLTableElement,
  imageLabels: Map<string, string>,
  changedSourceColumnKeys: Set<string>
): boolean => {
  /** 当前表格是否修改过至少一个 Result 标签。 */
  let changed = false;
  getManagedCells(table, COPY_TEST_GENERATED_RESULT_TYPE).forEach(({ cell, sourceColumnKey }) => {
    Array.from(cell.querySelectorAll<HTMLElement>(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`))
      .filter(reference => isOwnedByCell(reference, cell))
      .forEach(reference => {
        /** Result 仅通过内部图片 ID 与同 Pair Evidence 建立关系。 */
        const imageId = reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE)?.trim() || '';
        /** Result 标签是嵌套错误列表之前的直属文本节点。 */
        const labelNode = getResultLabelNode(reference);
        const displayName = imageLabels.get(getImageLabelKey(sourceColumnKey, imageId))
          || getCopyTestStoredImageDisplayName({
            attachmentFileName: imageId,
            existingLabel: labelNode?.textContent,
          });
        if (labelNode && displayName && labelNode.textContent !== displayName) {
          labelNode.textContent = displayName;
          changedSourceColumnKeys.add(sourceColumnKey);
          changed = true;
        }
      });
  });
  return changed;
};

/** 幂等迁移单张 working table，并报告需要回写的来源 Pair。 */
export const migrateCopyTestImageLabelsWithDetails = (
  tableHtml: string
): CopyTestImageLabelMigrationResult => {
  /** 只处理调用方提供的第一张顶层 working table。 */
  const doc = parseHtml(tableHtml);
  const table = Array.from(doc.querySelectorAll<HTMLTableElement>('table')).find(candidate => {
    return !candidate.parentElement?.closest('table');
  });
  if (!table) {
    return { html: tableHtml, sourceColumnKeys: [] };
  }

  /** Evidence 和 Result 之间按 Pair + image ID 共享的展示名称。 */
  const imageLabels = new Map<string, string>();
  /** 标签发生变化且允许用户明确回写的来源 Pair。 */
  const changedSourceColumnKeys = new Set<string>();
  const evidenceChanged = migrateEvidenceLabels(
    table,
    imageLabels,
    changedSourceColumnKeys
  );
  const resultChanged = migrateResultLabels(
    table,
    imageLabels,
    changedSourceColumnKeys
  );
  return {
    html: evidenceChanged || resultChanged
      ? toConfluenceStorageHtml(table.outerHTML)
      : tableHtml,
    sourceColumnKeys: Array.from(changedSourceColumnKeys),
  };
};

/** 只读取完成历史图片标签迁移后的 HTML。 */
export const migrateCopyTestImageLabels = (tableHtml: string): string => {
  return migrateCopyTestImageLabelsWithDetails(tableHtml).html;
};
