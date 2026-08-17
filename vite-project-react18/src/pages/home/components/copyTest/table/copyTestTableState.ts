/**
 * 文件作用：从 working DOM 恢复状态，并处理 Result 切换和 Evidence 删除。
 */
import type { CopyTestImage } from '../api/copyTestApi';
import {
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
  COPY_TEST_RESULT_FAILED_GROUP_VALUE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_RESULT_PASSED_GROUP_VALUE,
  COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE,
  COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE,
  COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
} from './tableConstants';
import {
  parseHtml,
  parseTableModel,
  toConfluenceStorageHtml,
  type CopyTestGeneratedColumnType,
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
  applyCellRowSpan,
  ensureCopyTestGeneratedColumns,
  ensureWritableGeneratedCell,
  isGeneratedCellForSource,
  removeCoveredGeneratedCells,
  type GeneratedColumnContext,
} from './copyTestTableColumns';
import {
  COPY_TEST_CONTENT_LABEL_TAG,
  COPY_TEST_RESULT_LANGUAGE_ISSUE_ATTRIBUTE,
  FAILED_LABEL,
  PASSED_LABEL,
  buildEvidenceGroups,
  clearUnrenderedRows,
  createResultContentFromEntries,
  getManagedContentElements,
  normalizeLanguageIssues,
  writeEvidenceCell,
  writeResultCell,
  type CopyTestEvidenceDeleteResult,
  type CopyTestEvidenceDeleteTarget,
  type CopyTestResultStatusToggleResult,
  type CopyTestResultStatusUpdate,
  type CopyTestValidationResultWithEvidence,
  type CopyTestValidationSnapshot,
  type CurrentEvidenceDeleteGroup,
  type EvidenceGroup,
  type ResultScreenEntry,
} from './copyTestTableRender';

/** 表格标签名。 */
const TABLE_TAG_NAME = 'table';

/** 数据行起始下标。 */
const FIRST_DATA_ROW_INDEX = 1;

/** 从 Result 根节点读取人工切换时保留的错误信息。 */
const readRetainedLanguageIssues = (resultRoot: Element): string[] => {
  /** Result 根节点中保存的 JSON 错误信息。 */
  const value = resultRoot.getAttribute(COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE);
  if (!value) {
    return [];
  }

  try {
    return normalizeLanguageIssues(JSON.parse(value));
  } catch {
    return [];
  }
};

/** 从一个 Screen 条目读取可见的错误信息。 */
const readVisibleScreenLanguageIssues = (reference: Element): string[] => {
  /** 新结构中通过 ownership 属性标记的问题说明。 */
  const ownedIssueItems = Array.from(
    reference.querySelectorAll(`[${COPY_TEST_RESULT_LANGUAGE_ISSUE_ATTRIBUTE}]`)
  );
  /** 兼容旧结构中未带 ownership 标记的二级问题列表。 */
  const issueItems = ownedIssueItems.length > 0
    ? ownedIssueItems
    : Array.from(reference.querySelectorAll('ul li'));
  return normalizeLanguageIssues(issueItems.flatMap(item => {
    /** 去除前后空白后的单条问题说明。 */
    const issue = item.textContent?.trim();
    return issue ? [issue] : [];
  }));
};

/** 读取旧单分组 Result 根节点的明确状态。 */
const readLegacyResultPassedState = (resultRoot: Element): boolean | undefined => {
  /** 旧结构中由 Result 根节点直接拥有的状态强调文本。 */
  const status = Array.from(resultRoot.children).find(child => {
    return child.tagName.toLowerCase() === COPY_TEST_CONTENT_LABEL_TAG;
  });
  const label = status?.textContent?.trim();
  if (label === PASSED_LABEL) {
    return true;
  }
  return label === FAILED_LABEL ? false : undefined;
};

/** 读取一个 Screen 所属的新分组或旧根节点状态。 */
const readScreenPassedState = (
  reference: Element,
  resultRoot: Element
): boolean | undefined => {
  /** Screen 列表的直接所有者，可能是新状态分组或旧 Result 根节点。 */
  const owner = reference.parentElement?.parentElement;
  if (owner === resultRoot) {
    return readLegacyResultPassedState(resultRoot);
  }
  if (owner?.parentElement !== resultRoot) {
    return undefined;
  }

  /** 新结构状态分组的明确属性值。 */
  const value = owner.getAttribute(COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE);
  if (value === COPY_TEST_RESULT_PASSED_GROUP_VALUE) {
    return true;
  }
  return value === COPY_TEST_RESULT_FAILED_GROUP_VALUE ? false : undefined;
};

/** 读取 Result Screen 引用开头的可见标签。 */
const readResultScreenLabel = (reference: Element): string => {
  /** Screen 引用中位于嵌套错误列表之前的文本节点。 */
  const labelNode = Array.from(reference.childNodes).find(node => {
    return node.nodeType === Node.TEXT_NODE && node.textContent?.trim();
  });
  return labelNode?.textContent?.trim() || '';
};

/** 读取 Screen 的持久顺序，旧结构回退到 ScreenNN 或 DOM 顺序。 */
const readResultScreenOrder = (
  reference: Element,
  label: string,
  domIndex: number
): number => {
  /** 新结构持久化的零基顺序。 */
  const storedValue = reference.getAttribute(COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE);
  const storedOrder = Number(storedValue);
  if (storedValue !== null && Number.isInteger(storedOrder) && storedOrder >= 0) {
    return storedOrder;
  }

  /** 旧结构 ScreenNN 标签中的一基序号，兼容后续的文件名。 */
  const labelMatch = /^Screen(\d+)(?:\s|$)/i.exec(label);
  return labelMatch ? Math.max(0, Number(labelMatch[1]) - 1) : domIndex;
};

/** 读取单个 Screen 自己的问题，兼容旧根级 retained 属性。 */
const readScreenLanguageIssues = (
  reference: Element,
  resultRoot: Element
): string[] => {
  /** 新结构在 Screen 条目上持久保留的问题。 */
  const retainedIssues = readRetainedLanguageIssues(reference);
  if (retainedIssues.length > 0) {
    return retainedIssues;
  }

  /** Failed Screen 当前可见的问题。 */
  const visibleIssues = readVisibleScreenLanguageIssues(reference);
  if (visibleIssues.length > 0) {
    return visibleIssues;
  }
  return readRetainedLanguageIssues(resultRoot);
};

/** 判断 Result Screen 身份在同一来源行内是否唯一。 */
const hasUniqueResultScreenIdentities = (entries: ResultScreenEntry[]): boolean => {
  const imageIds = new Set(entries.map(entry => entry.imageId));
  const instanceIds = new Set(entries.map(entry => entry.instanceId));
  const orders = new Set(entries.map(entry => entry.order));
  return imageIds.size === entries.length
    && instanceIds.size === entries.length
    && orders.size === entries.length;
};

/** 从 Result 根节点恢复所有 Screen 的独立状态。 */
const readResultScreenEntries = (resultRoot: Element): ResultScreenEntry[] => {
  /** 按当前 DOM 扫描出的候选 Screen 引用。 */
  const references = Array.from(
    resultRoot.querySelectorAll(`[${COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE}]`)
  );
  /** 候选引用恢复出的规范 Screen 状态。 */
  const entries = references.flatMap((reference, domIndex) => {
    /** 当前 Result Screen 引用的稳定图片 ID。 */
    const imageId = reference.getAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE)?.trim() || '';
    /** 当前 Result Screen 引用的稳定图片实例 ID。 */
    const instanceId = reference.getAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE)?.trim() || '';
    /** 当前 Result Screen 引用的展示标签。 */
    const label = readResultScreenLabel(reference);
    /** 当前 Screen 所属状态分组。 */
    const passed = readScreenPassedState(reference, resultRoot);
    if (!imageId || !instanceId || !label || passed === undefined) {
      return [];
    }
    return [{
      image: { base64: '', fileName: imageId },
      imageId,
      instanceId,
      label,
      languageIssues: readScreenLanguageIssues(reference, resultRoot),
      order: readResultScreenOrder(reference, label, domIndex),
      passed,
    }];
  });
  if (
    entries.length === 0
    || entries.length !== references.length
    || !hasUniqueResultScreenIdentities(entries)
  ) {
    return [];
  }
  return entries.sort((left, right) => left.order - right.order);
};

/** 精确查找当前 Result 中唯一匹配的 Screen。 */
const findTargetResultScreen = (
  entries: ResultScreenEntry[],
  update: CopyTestResultStatusUpdate
): ResultScreenEntry | undefined => {
  const matches = entries.filter(entry => {
    return entry.imageId === update.imageId && entry.instanceId === update.instanceId;
  });
  return matches.length === 1 ? matches[0] : undefined;
};

/** 只移动一个 managed Result Screen，保持其他 Screen 状态和顺序不变。 */
const replaceManagedResultScreenStatus = (
  resultRoot: Element,
  update: CopyTestResultStatusUpdate
): boolean => {
  /** 当前 Result 原样恢复出的全部 Screen 独立状态。 */
  const entries = readResultScreenEntries(resultRoot);
  /** 当前消息严格匹配的唯一 Screen。 */
  const target = findTargetResultScreen(entries, update);
  if (!target || target.passed === update.passed) {
    return false;
  }

  target.passed = update.passed;
  resultRoot.replaceWith(
    createResultContentFromEntries(resultRoot.ownerDocument, entries)
  );
  return true;
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

  /** 从新分组或旧单状态结构恢复出的全部 Screen。 */
  const entries = readResultScreenEntries(resultRoot);
  if (entries.length === 0) {
    return null;
  }

  /** 当前逐行 Result 真正引用的图片文件名。 */
  const evidenceImageFileNames = entries.map(entry => entry.imageId);
  /** 各 Screen 保留问题的去重并集，用作旧行级契约投影。 */
  const languageIssues = normalizeLanguageIssues(
    entries.flatMap(entry => entry.languageIssues)
  );
  return {
    evidenceImageFileNames,
    evidenceImages: evidenceImageFileNames.flatMap(fileName => {
      /** 当前文件名对应的轻量图片引用。 */
      const image = imageByFileName.get(fileName);
      return image ? [image] : [];
    }),
    languageIssues,
    /** 保持 AI 契约：至少一张 Screen 为 Passed 时，该来源行视为 Passed。 */
    passed: entries.some(entry => entry.passed),
    rowIndex,
    screenStatuses: entries.map(entry => ({
      imageId: entry.imageId,
      languageIssues: entry.languageIssues,
      passed: entry.passed,
    })),
  };
};

/** 从当前 Pair 的 Evidence DOM 顺序恢复轻量图片集合。 */
const hydrateValidationImages = (
  table: CopyTestWorkingTable,
  evidenceColumnIndex: number
): CopyTestImage[] => {
  /** 已按首次出现顺序恢复的轻量图片。 */
  const images = table.model.rows.slice(FIRST_DATA_ROW_INDEX).flatMap(row => {
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
      if (!fileName) {
        return [];
      }
      /** 新结构在可访问性文本中持久保存用户原始文件名。 */
      const displayFileName = image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE);
      return [{
        base64: '',
        fileName,
        originalFileName: displayFileName?.trim() && displayFileName !== fileName
          ? displayFileName
          : undefined,
      }];
    });
  });
  /** 同一图片多次引用时只保留首次出现的显示信息。 */
  return Array.from(new Map(images.map(image => [image.fileName, image])).values());
};

/** 从新契约生成的 working DOM 只读恢复逐行校验快照。 */
export const hydrateCopyTestValidationSnapshot = (
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
  return results.length > 0 ? { images, results } : null;
};

/** 定位当前来源 Pair 中待人工更新的 managed Result 根节点。 */
const findManagedResultForStatusUpdate = (
  table: CopyTestWorkingTable,
  tableElement: HTMLTableElement,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  update: CopyTestResultStatusUpdate
): Element | undefined => {
  /** 当前 Comparison Column 对应的严格 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  if (update.sourceColumnKey !== sourceColumnKey) {
    return undefined;
  }

  /** 与业务数据行下标对应的不可拆分来源原子组。 */
  const rowGroup = buildCopyTestRowGroups(table, selectedColumnIndex).find(group => {
    return group.dataRowIndexes[0] === update.rowIndex;
  });
  if (!rowGroup) {
    return undefined;
  }

  /** 新解析工作副本中的 Result 列和目标来源锚点单元格。 */
  const model = parseTableModel(tableElement);
  const resultColumnIndex = findGeneratedColumnIndexes(model.headers, sourceColumnKey).result;
  const resultSlot = resultColumnIndex === undefined
    ? undefined
    : model.rows[rowGroup.anchorRowIndex]?.slots[resultColumnIndex];
  if (!resultSlot?.owned || !isGeneratedCellForSource(
    resultSlot.cell,
    COPY_TEST_GENERATED_RESULT_TYPE,
    sourceColumnKey
  )) {
    return undefined;
  }

  return getManagedContentElements(
    resultSlot.cell.element,
    COPY_TEST_GENERATED_RESULT_TYPE
  )[0];
};

/** 将当前来源 Pair 的单个 Screen 移入明确的 Passed 或 Failed 分组。 */
export const setCopyTestResultStatus = (
  table: CopyTestWorkingTable,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  update: CopyTestResultStatusUpdate
): CopyTestResultStatusToggleResult => {
  /** 从 workingHtml 创建的独立可编辑表格副本。 */
  const doc = parseHtml(table.workingHtml);
  const tableElement = doc.querySelector<HTMLTableElement>(TABLE_TAG_NAME);
  if (!tableElement) {
    return { changed: false, table };
  }

  /** 严格匹配当前来源列和业务行的 managed Result 根节点。 */
  const resultRoot = findManagedResultForStatusUpdate(
    table,
    tableElement,
    selectedColumnIndex,
    selectedColumnLabel,
    update
  );
  if (!resultRoot || !replaceManagedResultScreenStatus(resultRoot, update)) {
    return { changed: false, table };
  }

  /** 只包含目标 Screen 分组变化的新工作表格。 */
  const workingHtml = toConfluenceStorageHtml(tableElement.outerHTML);
  return {
    changed: true,
    passed: update.passed,
    table: refreshWorkingTable(table, workingHtml),
  };
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

/** 读取当前来源列中与删除目标精确匹配的 Evidence 连通块。 */
const findCurrentEvidenceDeleteGroups = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): CurrentEvidenceDeleteGroup[] => {
  /** 当前来源列用于隔离 Test 双列的稳定 ownership key。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  /** 当前 Pair 的 Result/Evidence 逻辑列下标。 */
  const indexes = findGeneratedColumnIndexes(table.headers, sourceColumnKey);
  /** 当前来源列严格 Evidence 列的逻辑下标。 */
  const evidenceColumnIndex = indexes.evidence;
  if (evidenceColumnIndex === undefined) {
    return [];
  }

  return table.model.rows.slice(FIRST_DATA_ROW_INDEX).flatMap(row => {
    /** 当前物理行直接拥有的严格 Evidence 单元格。 */
    const slot = row.slots[evidenceColumnIndex];
    if (!slot?.owned) {
      return [];
    }

    /** 当前严格 Evidence 槽位直接拥有的物理单元格。 */
    const cell = slot.cell.element;
    if (cell.getAttribute(COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE) !== COPY_TEST_GENERATED_EVIDENCE_TYPE
      || cell.getAttribute(COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE) !== sourceColumnKey) {
      return [];
    }

    /** 当前单元格内与删除目标完全一致的图片节点。 */
    const targetImages = Array.from(cell.querySelectorAll(
      `[${COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE}]`
    )).filter(image => {
      return image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) === target.imageId
        && image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) === target.instanceId;
    });
    if (targetImages.length === 0) {
      return [];
    }

    /** 当前 Evidence 受控根块中按展示顺序保存的全部图片实例。 */
    const evidenceRoot = targetImages[0].closest(
      `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
    );
    /** 用于识别重复删除目标的当前连通块摘要。 */
    const group: CurrentEvidenceDeleteGroup = {
      anchorRowIndex: row.index,
      instanceIds: Array.from(evidenceRoot?.querySelectorAll(
        `[${COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE}]`
      ) || []).map(image => {
        return image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) || '';
      }),
      rowSpan: slot.cell.rowSpan,
    };
    return targetImages.map(() => group);
  });
};

/** 从结构化快照中查找包含删除目标的唯一 Evidence 规划组。 */
const findSnapshotEvidenceDeleteGroup = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  snapshot: CopyTestValidationSnapshot
): EvidenceGroup | undefined => {
  /** 当前 Comparison Column 的不可拆分来源原子组。 */
  const rowGroups = buildCopyTestRowGroups(table, selectedColumnIndex);
  /** 当前来源列稳定 ownership 键。 */
  const sourceColumnKey = getSourceColumnKey(selectedColumnIndex, selectedColumnLabel);
  return buildEvidenceGroups(
    rowGroups,
    snapshot.results,
    snapshot.images,
    sourceColumnKey
  ).find(group => group.screens.some(screen => {
    return screen.imageId === target.imageId && screen.instanceId === target.instanceId;
  }));
};

/** 判断调用方快照的目标连通块是否与当前 working DOM 完全对齐。 */
const isSnapshotDeleteGroupCurrent = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  snapshot: CopyTestValidationSnapshot,
  currentGroup: CurrentEvidenceDeleteGroup
): boolean => {
  /** 调用方快照中包含目标实例的 Evidence 规划组。 */
  const snapshotGroup = findSnapshotEvidenceDeleteGroup(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel,
    snapshot
  );
  if (!snapshotGroup) {
    return false;
  }

  /** 快照目标组按展示顺序生成的稳定实例标识。 */
  const snapshotInstanceIds = snapshotGroup.screens.map(screen => screen.instanceId);
  return snapshotGroup.anchorRowIndex === currentGroup.anchorRowIndex
    && snapshotGroup.rowSpan === currentGroup.rowSpan
    && snapshotInstanceIds.length === currentGroup.instanceIds.length
    && snapshotInstanceIds.every((instanceId, index) => {
      return instanceId === currentGroup.instanceIds[index];
    });
};

/** 判断删除结果已真正移除当前来源列中的精确目标实例。 */
const isCompletedEvidenceDeletion = (
  result: CopyTestEvidenceDeleteResult,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string
): boolean => {
  return result.removed && findCurrentEvidenceDeleteGroups(
    result.table,
    target,
    selectedColumnIndex,
    selectedColumnLabel
  ).length === 0;
};

/** 从目标 Evidence 组移除指定图片，并丢弃删除后没有图片的 Result。 */
const removeImageFromValidationGroup = (
  results: CopyTestValidationResultWithEvidence[],
  group: EvidenceGroup,
  imageFileName: string
): CopyTestValidationResultWithEvidence[] => {
  /** 目标 Evidence 实例实际覆盖的来源原子行索引。 */
  const targetRowIndexes = new Set(group.rowGroups.map(rowGroup => rowGroup.result.rowIndex));
  return results.flatMap(result => {
    if (!targetRowIndexes.has(result.rowIndex)) {
      return [result];
    }

    /** 删除目标后当前 Result 剩余的 Evidence 文件名。 */
    const evidenceImageFileNames = result.evidenceImageFileNames.filter(
      fileName => fileName !== imageFileName
    );
    if (evidenceImageFileNames.length === 0) {
      return [];
    }

    /** 删除目标文件后仍存在的逐 Screen 人工状态。 */
    const screenStatuses = result.screenStatuses?.filter(status => {
      return status.imageId !== imageFileName;
    });
    return [{
      ...result,
      evidenceImageFileNames,
      evidenceImages: result.evidenceImages.filter(image => image.fileName !== imageFileName),
      languageIssues: screenStatuses
        ? normalizeLanguageIssues(screenStatuses.flatMap(status => status.languageIssues))
        : result.languageIssues,
      passed: screenStatuses
        ? screenStatuses.some(status => status.passed)
        : result.passed,
      screenStatuses,
    }];
  });
};

/** 读取目标 Evidence 实例所在连通块的本地图片顺序。 */
const readTargetEvidenceImageOrder = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  snapshot: CopyTestValidationSnapshot,
  targetGroup: EvidenceGroup
): CopyTestImage[] => {
  /** 当前表格中与删除目标稳定标识完全匹配的 Evidence 图片节点。 */
  const targetImage = Array.from(parseHtml(table.workingHtml).querySelectorAll(
    `[${COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE}]`
  )).find(image => {
    return image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) === target.imageId
      && image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE) === target.instanceId;
  });
  /** 删除目标所在 Evidence 受控根块。 */
  const evidenceRoot = targetImage?.closest(
    `[${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"]`
  );
  /** 快照图片按稳定文件名建立的查找表。 */
  const imageByFileName = new Map(snapshot.images.map(image => [image.fileName, image]));
  /** DOM 中当前连通块自己的 Screen 顺序，不受其他 Evidence 块影响。 */
  const orderedImages = Array.from(
    evidenceRoot?.querySelectorAll(`[${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}]`) || []
  ).flatMap(image => {
    /** 当前 Evidence 图片的稳定文件名。 */
    const fileName = image.getAttribute(COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE) || '';
    /** 当前文件名对应的快照图片。 */
    const snapshotImage = imageByFileName.get(fileName);
    return snapshotImage ? [snapshotImage] : [];
  });
  return orderedImages.length > 0 ? orderedImages : targetGroup.screens.map(screen => screen.image);
};

/** 将指定来源原子组的单个生成列恢复为来源 rowspan。 */
const restoreGeneratedRowsForType = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[],
  columnIndex: number,
  type: CopyTestGeneratedColumnType
): void => {
  rowGroups.forEach(group => {
    /** 当前来源原子组锚点对应的可写生成单元格。 */
    const cell = ensureWritableGeneratedCell(
      doc,
      context.model,
      group.anchorRowIndex,
      columnIndex,
      type,
      context.sourceColumnKey
    );
    applyCellRowSpan(cell, group.rowSpan);
    removeCoveredGeneratedCells(
      context.model,
      group.anchorRowIndex,
      group.rowSpan,
      type,
      context.sourceColumnKey
    );
  });
};

/** 仅恢复待重投影原子组的 Result/Evidence 结构。 */
const restoreGeneratedRows = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[]
): GeneratedColumnContext => {
  restoreGeneratedRowsForType(
    doc,
    context,
    rowGroups,
    context.resultColumnIndex,
    COPY_TEST_GENERATED_RESULT_TYPE
  );
  restoreGeneratedRowsForType(
    doc,
    context,
    rowGroups,
    context.evidenceColumnIndex,
    COPY_TEST_GENERATED_EVIDENCE_TYPE
  );
  return {
    ...context,
    model: parseTableModel(context.tableElement),
  };
};

/** 仅重投影受删除影响的 Evidence 连通块。 */
const applyValidationResultsToEvidenceGroup = (
  table: CopyTestWorkingTable,
  results: CopyTestValidationResultWithEvidence[],
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  uploadedImages: CopyTestImage[],
  targetGroup: EvidenceGroup
): CopyTestWorkingTable => {
  /** 当前来源列已有生成双列及其编辑上下文。 */
  const ensured = ensureCopyTestGeneratedColumns(table.workingHtml, selectedColumnIndex, selectedColumnLabel);
  if (!ensured) {
    return table;
  }

  /** 目标连通块中所有不可拆分来源原子组。 */
  const rowGroups: CopyTestRowGroup[] = targetGroup.rowGroups;
  /** 局部恢复 rowspan 后可安全重写目标连通块的上下文。 */
  const context = restoreGeneratedRows(
    ensured.context.tableElement.ownerDocument,
    ensured.context,
    rowGroups
  );
  /** 删除后在目标范围内重新计算的 Evidence 子连通块。 */
  const evidenceGroups = buildEvidenceGroups(
    rowGroups,
    results,
    uploadedImages,
    context.sourceColumnKey
  );
  /** 删除后仍有图片结果的来源锚点。 */
  const renderableAnchorRowIndexes = new Set(
    evidenceGroups.flatMap(group => group.rowGroups.map(rowGroup => rowGroup.anchorRowIndex))
  );
  const doc = context.tableElement.ownerDocument;
  clearUnrenderedRows(doc, context, rowGroups, renderableAnchorRowIndexes);
  evidenceGroups.forEach(evidenceGroup => {
    evidenceGroup.rowGroups.forEach(rowGroup => {
      writeResultCell(doc, context, rowGroup, rowGroup.result, rowGroup.screens);
    });
    writeEvidenceCell(doc, context, evidenceGroup);
  });
  return refreshWorkingTable(table, toConfluenceStorageHtml(context.tableElement.outerHTML));
};

/** 使用结构化校验快照删除图片并局部重投影目标 Evidence 连通块。 */
const deleteEvidenceImageFromSnapshot = (
  table: CopyTestWorkingTable,
  target: CopyTestEvidenceDeleteTarget,
  selectedColumnIndex: number,
  selectedColumnLabel: string,
  snapshot: CopyTestValidationSnapshot
): CopyTestEvidenceDeleteResult => {
  /** 包含待删除图片实例的唯一 Evidence 规划组。 */
  const targetGroup = findSnapshotEvidenceDeleteGroup(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel,
    snapshot
  );
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
  /** 目标连通块在当前 DOM 中独立维护的 Screen 顺序。 */
  const targetGroupImages = readTargetEvidenceImageOrder(table, target, snapshot, targetGroup);
  /** 基于剩余逐行关系仅重新规划目标 Evidence 连通块的工作表格。 */
  const nextTable = applyValidationResultsToEvidenceGroup(
    table,
    validationResults,
    selectedColumnIndex,
    selectedColumnLabel,
    targetGroupImages,
    targetGroup
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
  /** 当前 working DOM 中必须唯一存在的精确 Evidence 删除目标。 */
  const currentGroups = findCurrentEvidenceDeleteGroups(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel
  );
  if (currentGroups.length !== 1) {
    return { imageStillUsed: false, removed: false, table };
  }

  /** 当前 working DOM 才是用户所见 Evidence 实例的权威状态。 */
  const liveSnapshot = hydrateCopyTestValidationSnapshot(
    table,
    selectedColumnIndex,
    selectedColumnLabel
  );
  if (liveSnapshot) {
    /** 使用当前 DOM 状态执行的首选删除结果。 */
    const liveResult = deleteEvidenceImageFromSnapshot(
      table,
      target,
      selectedColumnIndex,
      selectedColumnLabel,
      liveSnapshot
    );
    if (isCompletedEvidenceDeletion(
      liveResult,
      target,
      selectedColumnIndex,
      selectedColumnLabel
    )) {
      return liveResult;
    }
  }

  if (!snapshot || !isSnapshotDeleteGroupCurrent(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel,
    snapshot,
    currentGroups[0]
  )) {
    return { imageStillUsed: false, removed: false, table };
  }

  /** DOM 关系不完整时使用已确认与当前连通块一致的调用方快照再次删除。 */
  const snapshotResult = deleteEvidenceImageFromSnapshot(
    table,
    target,
    selectedColumnIndex,
    selectedColumnLabel,
    snapshot
  );
  return isCompletedEvidenceDeletion(
    snapshotResult,
    target,
    selectedColumnIndex,
    selectedColumnLabel
  ) ? snapshotResult : { imageStillUsed: false, removed: false, table };
};
