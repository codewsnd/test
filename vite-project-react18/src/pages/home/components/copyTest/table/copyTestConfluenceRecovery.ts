/** Confluence 编辑器移除自定义属性后，保守恢复既有双列的模型身份。 */
import type { CopyTestCellModel, CopyTestRowModel } from './tableModel';
import {
  COPY_TEST_EVIDENCE_HEADER_PREFIX,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_RESULT_HEADER_PREFIX,
  COPY_TEST_SCHEMA_ATTRIBUTE,
} from './tableConstants';

const OWNERSHIP_ATTRIBUTES = [
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_OWNER_ID_ATTRIBUTE,
  COPY_TEST_SCHEMA_ATTRIBUTE,
];
const HISTORICAL_STATUS_PATTERN = /^(?:Passed|Failed|Needs revalidation):$/;

const normalizeHeader = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** 同名、跨列或部分 ownership 均不能作为自动恢复依据。 */
const findUniqueHeader = (headers: CopyTestCellModel[], label: string): CopyTestCellModel | undefined => {
  const matches = headers.filter(cell => normalizeHeader(cell.text) === label);
  return matches.length === 1 && matches[0].colSpan === 1 ? matches[0] : undefined;
};

const getOwnedColumnCells = (rows: CopyTestRowModel[], columnIndex: number): CopyTestCellModel[] => {
  return rows.flatMap(row => {
    const slot = row.slots[columnIndex];
    return slot?.owned ? [slot.cell] : [];
  });
};

const hasNoOwnership = (cell: CopyTestCellModel): boolean => {
  return cell.colSpan === 1
    && !OWNERSHIP_ATTRIBUTES.some(attribute => cell.element.hasAttribute(attribute));
};

/** 用户不编辑系统双列，兼容无 AI 标记的旧结果及删除后的空列。 */
const hasHistoricalResult = (cell: CopyTestCellModel): boolean => {
  if (!cell.element.textContent?.trim()) {
    return true;
  }
  const descendants = Array.from(cell.element.querySelectorAll('div, strong'))
    .filter(element => element.closest('td, th') === cell.element);
  return descendants.some(element => HISTORICAL_STATUS_PATTERN.test(normalizeHeader(element.textContent || '')))
    && Boolean(cell.element.querySelector('ul > li'));
};

/** 仅恢复模型字段，原始 storage 和 DOM 属性保持不变，供精确导出定位使用。 */
const recoverPair = (rows: CopyTestRowModel[], headers: CopyTestCellModel[], source: CopyTestCellModel): void => {
  const label = normalizeHeader(source.text);
  if (!label || findUniqueHeader(headers, label) !== source) {
    return;
  }
  const result = findUniqueHeader(headers, `${COPY_TEST_RESULT_HEADER_PREFIX} ${label}`);
  const evidence = findUniqueHeader(headers, `${COPY_TEST_EVIDENCE_HEADER_PREFIX} ${label}`);
  if (!result || !evidence || evidence.columnIndex !== result.columnIndex + 1) {
    return;
  }
  const resultCells = getOwnedColumnCells(rows, result.columnIndex);
  const evidenceCells = getOwnedColumnCells(rows, evidence.columnIndex);
  const allCells = [...resultCells, ...evidenceCells];
  if (!allCells.every(hasNoOwnership)
    || !resultCells.slice(1).every(hasHistoricalResult)) {
    return;
  }
  const sourceColumnKey = `${source.columnIndex}:${label}`;
  resultCells.forEach(cell => {
    cell.generatedType = 'result';
    cell.sourceColumnKey = sourceColumnKey;
  });
  evidenceCells.forEach(cell => {
    cell.generatedType = 'evidence';
    cell.sourceColumnKey = sourceColumnKey;
  });
};

export const recoverCopyTestColumnIdentities = (rows: CopyTestRowModel[]): void => {
  const headers = rows[0]?.cells || [];
  headers.filter(cell => {
    const label = normalizeHeader(cell.text);
    return !cell.generatedType && !label.startsWith(COPY_TEST_RESULT_HEADER_PREFIX)
      && !label.startsWith(COPY_TEST_EVIDENCE_HEADER_PREFIX);
  }).forEach(source => recoverPair(rows, headers, source));
};
