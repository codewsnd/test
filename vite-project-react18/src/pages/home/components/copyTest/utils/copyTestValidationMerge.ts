import type { CopyTestImage, CopyTestRowInput, CopyTestValidationResult } from '../api/copyTestApi';
import type { CopyTestDisplayConfiguration, CopyTestValidationResultWithEvidence } from '../types';
import type { CopyTestResultScreenStatus } from '../table/copyTestTableRender';

/** 每个应用分组只锁定一个有效候选，其他行不能隐式引入第二张截图。 */
const getSingleGroupWinners = (
  results: CopyTestValidationResult[],
  groupByRow: Map<number, number>,
  available: Set<string>
): Map<number, string> => {
  const winners = new Map<number, string>();
  results.forEach(result => {
    const groupId = groupByRow.get(result.rowIndex);
    const fileName = result.evidenceImageFileNames.find(name => available.has(name));
    if (groupId !== undefined && fileName && !winners.has(groupId)) {
      winners.set(groupId, fileName);
    }
  });
  return winners;
};

/** 匹配以实际返回的本批附件引用为准，Failed 也可以有匹配截图。 */
export const selectCopyTestMatchedResults = (
  results: CopyTestValidationResult[],
  images: CopyTestImage[],
  rows: CopyTestRowInput[],
  evidenceMode: CopyTestDisplayConfiguration['evidenceMode']
): CopyTestValidationResult[] => {
  const available = new Set(images.map(image => image.fileName));
  const groupByRow = new Map(rows.map(row => [row.rowIndex, row.evidenceGroupId]));
  const winners = getSingleGroupWinners(results, groupByRow, available);
  return results.filter(result => groupByRow.has(result.rowIndex)).flatMap(result => {
    const fileNames = [...new Set(result.evidenceImageFileNames)].filter(name => available.has(name));
    const winner = winners.get(groupByRow.get(result.rowIndex)!);
    const evidenceImageFileNames = evidenceMode === 'single' ? fileNames.filter(name => name === winner) : fileNames;
    return evidenceImageFileNames.length > 0 ? [{ ...result, evidenceImageFileNames }] : [];
  });
};

/** 同一批图片在多个行中出现只计数一次。 */
export const countCopyTestMatchedImages = (results: CopyTestValidationResult[]): number => {
  return new Set(results.flatMap(result => result.evidenceImageFileNames)).size;
};

/** 以文件名或非空图片内容识别重复截图。 */
const isSameImage = (left: CopyTestImage, right: CopyTestImage): boolean => {
  return left.fileName === right.fileName || (left.base64.trim() !== '' && left.base64 === right.base64);
};

/** 将旧行级结果补成逐图状态，防止追加时新结果覆盖旧图状态。 */
const getScreenStatuses = (result: CopyTestValidationResultWithEvidence): CopyTestResultScreenStatus[] => {
  const statuses = new Map(result.screenStatuses?.map(status => [status.imageId, status]));
  return result.evidenceImageFileNames.map(imageId => statuses.get(imageId) ?? {
    imageId,
    passed: result.passed,
    aiPassed: result.passed,
    languageIssues: result.languageIssues,
  });
};

/** Add 只追加未出现过的匹配图片，历史逐图状态和顺序保持不变。 */
const appendMatchedResult = (
  previous: CopyTestValidationResultWithEvidence,
  current: CopyTestValidationResultWithEvidence
): CopyTestValidationResultWithEvidence => {
  const newImages = current.evidenceImages.filter(image => {
    return !previous.evidenceImages.some(existing => isSameImage(existing, image));
  });
  const newNames = new Set(newImages.map(image => image.fileName));
  const screenStatuses = [
    ...getScreenStatuses(previous),
    ...getScreenStatuses(current).filter(status => newNames.has(status.imageId)),
  ];
  return {
    ...previous,
    evidenceImages: [...previous.evidenceImages, ...newImages],
    evidenceImageFileNames: [...previous.evidenceImageFileNames, ...newNames],
    screenStatuses,
    passed: screenStatuses.some(status => status.passed),
    languageIssues: [...new Set(screenStatuses.flatMap(status => status.languageIssues))],
  };
};

/** 无匹配行不参与写入；有匹配行按 Add 或 Replace 更新。 */
export const mergeCopyTestMatchedResults = (
  historical: CopyTestValidationResultWithEvidence[],
  current: CopyTestValidationResultWithEvidence[],
  evidenceUpdateMode: CopyTestDisplayConfiguration['evidenceUpdateMode']
): CopyTestValidationResultWithEvidence[] => {
  const results = new Map(historical.map(result => [result.rowIndex, result]));
  current.filter(result => result.evidenceImages.length > 0).forEach(result => {
    const previous = results.get(result.rowIndex);
    const next = evidenceUpdateMode === 'add' && previous ? appendMatchedResult(previous, result) : result;
    results.set(result.rowIndex, next);
  });
  return [...results.values()].sort((left, right) => left.rowIndex - right.rowIndex);
};
