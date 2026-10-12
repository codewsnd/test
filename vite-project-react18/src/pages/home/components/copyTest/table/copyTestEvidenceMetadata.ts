/** 恢复编辑器清除的图片预览标识，附件引用始终以 ri:filename 为准。 */
import type { CopyTestTableModel } from './tableModel';
import {
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
} from './tableConstants';

const restoreImageMetadata = (image: Element, instancePrefix: string, imageIndex: number): void => {
  const attachment = Array.from(image.children).find(child => child.tagName.toLowerCase() === 'ri:attachment');
  const fileName = attachment?.getAttribute('ri:filename')?.trim();
  if (!fileName) {
    return;
  }
  const previousId = image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE);
  if (previousId !== fileName || !image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE)) {
    image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE, fileName);
    image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE, `${instancePrefix}:${imageIndex}:${fileName}`);
  }
  if (!image.hasAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE)) {
    image.setAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE, fileName);
  }
};

export const restoreCopyTestEvidenceMetadata = (
  model: CopyTestTableModel,
  evidenceColumnIndex: number,
  sourceColumnKey: string
): void => {
  model.rows.slice(1).forEach(row => {
    const slot = row.slots[evidenceColumnIndex];
    if (!slot?.owned) {
      return;
    }
    const cell = slot.cell.element;
    const images = Array.from(cell.querySelectorAll('*')).filter(element => {
      return element.tagName.toLowerCase() === 'ac:image' && element.closest('td, th') === cell;
    });
    images.forEach((image, index) => restoreImageMetadata(image, `${sourceColumnKey}:${row.index}`, index));
  });
};
