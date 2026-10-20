/** 从附件引用和图片顶部的普通文字恢复运行时标识，不依赖属性跨编辑保存。 */
import type { CopyTestTableModel } from './tableModel';
import { getCopyTestStoredImageDisplayName } from './copyTestImageUtils';
import { restoreCopyTestResultReferences } from './copyTestResultRecovery';
import {
  COPY_TEST_EVIDENCE_CARD_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
} from './tableConstants';

export interface RecoveredEvidenceImage {
  fileName: string;
  instanceId: string;
  label: string;
  previousLabel: string;
  image: Element;
}

/** 遇到上一张图即停止，避免无标题图片借用其他图片的名字。 */
const readCaption = (image: Element, cell: Element): string => {
  const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let caption = '';
  let node = walker.nextNode();
  while (node && node !== image) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'ac:image') {
      caption = '';
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      caption = node.textContent.trim();
    }
    node = walker.nextNode();
  }
  return caption;
};

export const readCopyTestEvidenceImages = (cell: Element): RecoveredEvidenceImage[] => {
  const images = Array.from(cell.querySelectorAll('*')).filter(element => {
    return element.tagName.toLowerCase() === 'ac:image' && element.closest('td,th') === cell;
  });
  return images.flatMap((image, imageIndex) => {
    const attachment = Array.from(image.children).find(child => child.tagName.toLowerCase() === 'ri:attachment');
    const fileName = attachment?.getAttribute('ri:filename')?.trim();
    if (!fileName) {
      return [];
    }
    const previousLabel = readCaption(image, cell);
    return [{
      fileName, image, previousLabel,
      instanceId: image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '',
      label: getCopyTestStoredImageDisplayName({
        attachmentFileName: fileName, existingLabel: previousLabel, imageIndex,
        displayFileName: image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE),
      }),
    }];
  });
};

const restoreImages = (cell: Element, prefix: string): RecoveredEvidenceImage[] => {
  const images = readCopyTestEvidenceImages(cell);
  images.forEach((entry, index) => {
    const duplicate = images.filter(image => image.fileName === entry.fileName).length > 1;
    entry.instanceId = `${prefix}:${entry.fileName}${duplicate ? `:${index}` : ''}`;
    entry.image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, entry.fileName);
    entry.image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE, entry.instanceId);
    // 标题已经是去扩展名的文字；加回真实扩展名，避免多点名称被再次截断。
    const extension = /\.[^.]+$/.exec(entry.fileName)?.[0] || '.png';
    entry.image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE, `${entry.label}${extension}`);
  });
  if (cell.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="evidence"]`)) {
    return images;
  }
  const root = cell.ownerDocument.createElement('div');
  root.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, 'evidence');
  images.forEach(entry => {
    const card = cell.ownerDocument.createElement('div');
    const caption = cell.ownerDocument.createElement('strong');
    card.setAttribute(COPY_TEST_EVIDENCE_CARD_ATTRIBUTE, 'true');
    caption.textContent = entry.label;
    card.append(caption, cell.ownerDocument.createElement('br'), entry.image);
    root.append(card);
  });
  if (images.length > 0) {
    cell.replaceChildren(root);
  }
  return images;
};

export const restoreCopyTestEvidenceMetadata = (
  model: CopyTestTableModel,
  evidenceColumnIndex: number,
  sourceColumnKey: string,
  resultColumnIndex: number
): void => {
  model.rows.slice(1).forEach(row => {
    const slot = row.slots[evidenceColumnIndex];
    if (!slot?.owned) {
      return;
    }
    const images = restoreImages(slot.cell.element, `${sourceColumnKey}:${row.index}`);
    model.rows.slice(row.index, row.index + slot.cell.rowSpan).forEach(coveredRow => {
      const result = coveredRow.slots[resultColumnIndex];
      if (result?.owned) {
        restoreCopyTestResultReferences(result.cell.element, images);
      }
    });
  });
};
