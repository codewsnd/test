/** 只从系统生成的普通列表恢复关联；有歧义的旧结果不猜测状态。 */
import type { RecoveredEvidenceImage } from './copyTestEvidenceMetadata';
import { getCopyTestFileNameStem } from './copyTestImageUtils';
import { createResultContentFromEntries, type ResultScreenEntry } from './copyTestTableRender';
import {
  COPY_TEST_AI_COMPARISON_LABEL,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
} from './tableConstants';

interface VisibleResult {
  item: Element;
  label: string;
  passed: boolean | undefined;
  issues: string[];
}

const PENDING_LABEL = 'Needs revalidation:';
const STATUS_LABELS = ['Passed:', 'Failed:', PENDING_LABEL];

const readResults = (cell: Element): VisibleResult[] => {
  let status: string | undefined;
  const results: VisibleResult[] = [];
  Array.from(cell.querySelectorAll('strong,li')).forEach(element => {
    if (element.closest('td,th') !== cell || element.parentElement?.closest('li')) {
      return;
    }
    const text = element.textContent?.trim() || '';
    if (element.tagName.toLowerCase() === 'strong') {
      if (STATUS_LABELS.includes(text)) {
        status = text;
      }
      return;
    }
    if (status !== undefined) {
      const clone = element.cloneNode(true) as Element;
      clone.querySelectorAll('ul,ol').forEach(list => list.remove());
      results.push({
        item: element, label: clone.textContent?.trim() || '',
        passed: status === PENDING_LABEL ? undefined : status === STATUS_LABELS[0],
        issues: Array.from(element.querySelectorAll('ul > li')).map(item => item.textContent?.trim() || ''),
      });
    }
  });
  return results;
};

const findCandidates = (result: VisibleResult, images: RecoveredEvidenceImage[]): RecoveredEvidenceImage[] => {
  const id = result.item.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE);
  const byId = images.filter(image => image.fileName === id);
  if (byId.length === 1) {
    return byId;
  }
  const byLabel = images.filter(image => {
    return [image.label, image.previousLabel, image.fileName, getCopyTestFileNameStem(image.fileName)]
      .includes(result.label);
  });
  if (byLabel.length > 0) {
    return byLabel;
  }
  const screen = /^Screen(\d+)(?:\s*\(.+\))?$/i.exec(result.label);
  const ordered = screen ? images[Number(screen[1]) - 1] : undefined;
  return ordered ? [ordered] : [];
};

/** 同名、同状态、同原因且数量相等时，按出现顺序对应是等价的。 */
const resolveImage = (
  result: VisibleResult, candidates: RecoveredEvidenceImage[], results: VisibleResult[]
): RecoveredEvidenceImage | undefined => {
  if (candidates.length === 1) {
    return candidates[0];
  }
  const siblings = results.filter(item => item.label === result.label);
  const equivalent = siblings.length === candidates.length && siblings.every(item => {
    return item.passed === result.passed && JSON.stringify(item.issues) === JSON.stringify(result.issues);
  });
  return equivalent ? candidates[siblings.indexOf(result)] : undefined;
};

const hasCurrentReferences = (cell: Element, images: RecoveredEvidenceImage[]): boolean => {
  const references = Array.from(cell.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`));
  return Boolean(cell.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="result"]`))
    && references.length > 0 && references.every(reference => {
      return images.some(image => {
        return reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE) === image.fileName
          && reference.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE) === image.instanceId;
      });
    });
};

const restoreEntries = (
  cell: Element, results: VisibleResult[], images: RecoveredEvidenceImage[]
): ResultScreenEntry[] => {
  const hasAiLabel = Array.from(cell.querySelectorAll('div,p')).some(element => {
    return element.textContent?.trim() === COPY_TEST_AI_COMPARISON_LABEL;
  });
  return results.flatMap(result => {
    const image = resolveImage(result, findCandidates(result, images), results);
    if (!image || result.passed === undefined) {
      return [];
    }
    return [{
      image: { base64: '', fileName: image.fileName }, imageId: image.fileName,
      instanceId: image.instanceId, label: image.label, order: images.indexOf(image),
      passed: result.passed, languageIssues: result.issues,
      aiPassed: hasAiLabel ? result.passed : undefined,
    }];
  });
};

export const restoreCopyTestResultReferences = (cell: Element, images: RecoveredEvidenceImage[]): void => {
  if (images.length === 0 || hasCurrentReferences(cell, images)) {
    return;
  }
  const results = readResults(cell);
  const entries = restoreEntries(cell, results, images);
  if (entries.length === 0 || entries.length !== results.length
    || new Set(entries.map(entry => entry.imageId)).size !== entries.length) {
    return;
  }
  cell.replaceChildren(createResultContentFromEntries(cell.ownerDocument, entries));
};

const remainingResults = (
  results: VisibleResult[], images: RecoveredEvidenceImage[], instanceId: string
): VisibleResult[] => {
  const pending = new Set<RecoveredEvidenceImage>();
  const remaining = results.flatMap(result => {
    const candidates = findCandidates(result, images);
    const resolved = resolveImage(result, candidates, results);
    if (resolved) {
      return resolved.instanceId === instanceId ? [] : [result];
    }
    if (!candidates.some(image => image.instanceId === instanceId)) {
      return [result];
    }
    candidates.filter(image => image.instanceId !== instanceId).forEach(image => pending.add(image));
    return [];
  });
  return [...remaining, ...Array.from(pending, image => ({
    item: image.image, label: image.label, passed: undefined, issues: [],
  }))];
};

const appendGroup = (root: Element, results: VisibleResult[], passed: boolean | undefined): void => {
  const group = results.filter(result => result.passed === passed);
  if (group.length === 0) {
    return;
  }
  const doc = root.ownerDocument;
  const heading = doc.createElement('strong');
  heading.textContent = passed === undefined ? PENDING_LABEL : STATUS_LABELS[passed ? 0 : 1];
  const list = doc.createElement('ul');
  group.forEach(result => {
    const item = doc.createElement('li');
    item.textContent = result.label;
    if (result.issues.length > 0) {
      const issues = doc.createElement('ul');
      result.issues.forEach(issue => {
        const detail = doc.createElement('li');
        detail.textContent = issue;
        issues.append(detail);
      });
      item.append(issues);
    }
    list.append(item);
  });
  root.append(heading, list);
};

export const createLegacyResultAfterDeletion = (
  cell: Element, images: RecoveredEvidenceImage[], instanceId: string
): Element | null => {
  if (cell.querySelector(`[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="result"]`)) {
    return null;
  }
  const results = readResults(cell);
  if ((results.length === 0 && cell.textContent?.trim())
    || results.some(result => findCandidates(result, images).length === 0)) {
    return null;
  }
  const remaining = remainingResults(results, images, instanceId);
  const root = cell.ownerDocument.createElement('div');
  [true, false, undefined].forEach(passed => appendGroup(root, remaining, passed));
  return root;
};
