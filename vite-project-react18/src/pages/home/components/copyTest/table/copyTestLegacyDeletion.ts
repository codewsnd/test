/** 旧格式无法恢复完整快照时，局部删除精确图片实例和对应的普通结果。 */
import { readCopyTestEvidenceImages } from './copyTestEvidenceMetadata';
import { createLegacyResultAfterDeletion } from './copyTestResultRecovery';
import type { CopyTestEvidenceDeleteTarget } from './copyTestTableRender';
import { parseHtml, parseTableModel, toConfluenceStorageHtml } from './tableModel';
import {
  findGeneratedColumnIndexes, getSourceColumnKey, refreshWorkingTable, type CopyTestWorkingTable,
} from './copyTestTableParser';
import { COPY_TEST_EVIDENCE_CARD_ATTRIBUTE } from './tableConstants';

export const deleteLegacyEvidenceImage = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CopyTestWorkingTable | null => {
  const element = parseHtml(table.workingHtml).querySelector<HTMLTableElement>('table');
  const indexes = findGeneratedColumnIndexes(table.headers, getSourceColumnKey(selectedColumnIndex, selectedColumnLabel));
  if (!element || indexes.evidence === undefined || indexes.result === undefined) {
    return null;
  }
  const model = parseTableModel(element);
  const slots = model.rows.slice(1).flatMap(row => {
    const slot = row.slots[indexes.evidence!];
    return slot?.owned ? [{ slot, row }] : [];
  });
  const targets = slots.flatMap(({ slot, row }) => {
    const images = readCopyTestEvidenceImages(slot.cell.element);
    return images.filter(image => image.fileName === target.imageId && image.instanceId === target.instanceId)
      .map(image => ({ image, images, slot, row }));
  });
  if (targets.length !== 1) {
    return null;
  }
  const { image, images, slot, row } = targets[0];
  const card = image.image.closest(`[${COPY_TEST_EVIDENCE_CARD_ATTRIBUTE}]`);
  const results = model.rows.slice(row.index, row.index + slot.cell.rowSpan).flatMap(coveredRow => {
    const result = coveredRow.slots[indexes.result!];
    return result?.owned ? [result.cell.element] : [];
  });
  // 不把空/损坏的新快照误当作旧格式；原有快照校验仍然生效。
  if (!card || !results.some(result => result.textContent?.trim())) {
    return null;
  }
  const replacements = results.map(cell => createLegacyResultAfterDeletion(cell, images, target.instanceId));
  if (replacements.some(replacement => !replacement)) {
    return null;
  }
  results.forEach((cell, index) => cell.replaceChildren(replacements[index]!));
  card.remove();
  return refreshWorkingTable(table, toConfluenceStorageHtml(element.outerHTML));
};
