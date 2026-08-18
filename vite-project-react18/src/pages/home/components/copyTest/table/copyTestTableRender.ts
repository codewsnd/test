/**
 * 文件作用：规划并渲染 CopyTest 校验结果与 Evidence 内容。
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
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_PASSED_COLOR,
  COPY_TEST_RESULT_FAILED_GROUP_VALUE,
  COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_RESULT_PASSED_GROUP_VALUE,
  COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE,
  COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE,
  COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
} from './tableConstants';
import {
  parseTableModel,
  toConfluenceStorageHtml,
  type CopyTestGeneratedColumnType,
} from './tableModel';
import {
  buildCopyTestRowGroups,
  refreshWorkingTable,
  type CopyTestRowGroup,
  type CopyTestWorkingTable,
} from './copyTestTableParser';
import {
  planCopyTestEvidenceGroups,
  type CopyTestEvidenceRowResultPlan,
  type CopyTestEvidenceScreen,
  type CopyTestEvidenceSourceGroup,
} from './copyTestEvidencePlanner';
import {
  getCopyTestImageDisplayFileName,
  getCopyTestImageId,
} from './copyTestImageUtils';
import {
  applyCellRowSpan,
  ensureCopyTestGeneratedColumns,
  ensureWritableGeneratedCell,
  removeCoveredGeneratedCells,
  syncGeneratedColumnSpans,
  type GeneratedColumnContext,
} from './copyTestTableColumns';

/** 支持 CopyTest Evidence 图片的校验结果。 */
export interface CopyTestValidationResultWithEvidence extends CopyTestValidationResult {
  /** 根据模型文件名绑定出的 Evidence 内存图片。 */
  evidenceImages: CopyTestImage[];
  /** 同一来源行内按图片文件名保存的人工 Screen 状态；缺省时继承行级 AI 结果。 */
  screenStatuses?: CopyTestResultScreenStatus[];
}

/** 单个 Result Screen 的持久状态。 */
export interface CopyTestResultScreenStatus {
  /** Evidence 附件文件名，也是同一来源行内的稳定 Screen 身份。 */
  imageId: string;
  /** 当前 Screen 在 Failed 状态下需要显示或往返保留的问题。 */
  languageIssues: string[];
  /** 当前 Screen 是否属于 Passed 分组。 */
  passed: boolean;
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

/** 预览层请求写入的明确 Result 目标状态。 */
export interface CopyTestResultStatusUpdate {
  /** 当前 Screen 对应的 Evidence 附件文件名。 */
  imageId: string;
  /** 当前 Result DOM 中用于防止误定位的 Screen 实例 ID。 */
  instanceId: string;
  /** 目标状态是否为 Passed。 */
  passed: boolean;
  /** 来源原子组使用的业务数据行下标。 */
  rowIndex: number;
  /** 当前 Result/Evidence Pair 所属的来源列键。 */
  sourceColumnKey: string;
}

/** 人工移动单个 Result Screen 状态后的结果。 */
export interface CopyTestResultStatusToggleResult {
  /** 是否找到并移动了目标 Screen。 */
  changed: boolean;
  /** 移动后的 Screen 是否为 Passed；未移动时为空。 */
  passed?: boolean;
  /** 完成人工 Screen 状态移动后的工作表格。 */
  table: CopyTestWorkingTable;
}

/** 写入用的图片引用。 */
export interface ScreenRef {
  /** 当前引用对应的内存图片。 */
  image: CopyTestImage;
  /** 由附件文件名确定的稳定图片标识。 */
  imageId: string;
  /** 图片在当前 Result/Evidence 组中的稳定实例标识。 */
  instanceId: string;
  /** Result 和 Evidence 共同显示的 Screen 标签。 */
  label: string;
  /** Screen 在当前 Evidence 序列中的稳定显示顺序。 */
  order: number;
}

/** Result DOM 中可独立移动的单个 Screen。 */
export interface ResultScreenEntry extends ScreenRef {
  /** 当前 Screen 往返保留的问题说明。 */
  languageIssues: string[];
  /** 当前 Screen 是否位于 Passed 分组。 */
  passed: boolean;
}

/** Evidence 合并组。 */
export interface EvidenceGroup {
  /** Evidence 合并组起始物理行下标。 */
  anchorRowIndex: number;
  /** Evidence 单元格实际覆盖的物理行数。 */
  rowSpan: number;
  /** 合并组共享的图片引用。 */
  screens: ScreenRef[];
  /** 合并组内不可拆分的来源行组、校验结果及其 Result Screen 子集。 */
  rowGroups: EvidenceGroupRow[];
  /** Evidence section 内全部来源原子组；不因无结果、无图或删除而缩小。 */
  sourceRowGroups: CopyTestRowGroup[];
}

/** 当前 working DOM 中待删除 Evidence 连通块的结构摘要。 */
export interface CurrentEvidenceDeleteGroup {
  /** Evidence 连通块起始物理行下标。 */
  anchorRowIndex: number;
  /** Evidence 连通块内按展示顺序保存的图片实例标识。 */
  instanceIds: string[];
  /** Evidence 单元格实际覆盖的物理行数。 */
  rowSpan: number;
}

/** Evidence 合并组中的单个来源原子行。 */
export interface EvidenceGroupRow extends CopyTestRowGroup {
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

/** Result 状态文案。 */
export const PASSED_LABEL = 'Passed:';

/** Result 状态文案。 */
export const FAILED_LABEL = 'Failed:';

/** Result 列表项标签名，集中维护 Result 引用节点。 */
const RESULT_LIST_ITEM_TAG = 'li';

/** 标记由 CopyTest 写入的单条失败原因，支持无 Screen Result 的稳定恢复。 */
export const COPY_TEST_RESULT_LANGUAGE_ISSUE_ATTRIBUTE = 'data-copy-test-result-language-issue';

/** 生成受控内容根节点使用的块级标签名。 */
const COPY_TEST_CONTENT_BLOCK_TAG = 'div';

/** 生成 Result/Evidence 标题节点使用的强调标签名。 */
export const COPY_TEST_CONTENT_LABEL_TAG = 'strong';

/** DOM 布尔属性写入时使用的统一字符串值。 */
const DOM_TRUE_ATTRIBUTE_VALUE = 'true';


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
    (screen, screenIndex) => ({
      image: screen.image,
      imageId: getCopyTestImageId(screen.image),
      instanceId: getImageInstanceId(screen.image, anchorRowIndex, sourceColumnKey),
      label: screen.label,
      order: screenIndex,
    })
  );
};

/** 将错误信息规范为去重后的非空字符串。 */
export const normalizeLanguageIssues = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  /** 通过字符串与非空校验的问题说明。 */
  const issues = value.flatMap(item => {
    return typeof item === 'string' && item.trim() !== '' ? [item] : [];
  });
  return Array.from(new Set(issues));
};

/** 读取失败原因。 */
const getFailureReasons = (result: CopyTestValidationResultWithEvidence): string[] => {
  return normalizeLanguageIssues(result.languageIssues);
};

/** 在 Result Screen（兼容旧根节点）保存可供状态往返恢复的错误信息。 */
const writeRetainedLanguageIssues = (container: Element, languageIssues: string[]): void => {
  if (languageIssues.length === 0) {
    container.removeAttribute(COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE);
    return;
  }

  container.setAttribute(
    COPY_TEST_RESULT_RETAINED_LANGUAGE_ISSUES_ATTRIBUTE,
    JSON.stringify(languageIssues)
  );
};

/** 将失败原因追加到指定列表，并写入可稳定恢复的 ownership 标记。 */
const appendFailureReasonItems = (
  doc: Document,
  list: HTMLUListElement,
  failureReasons: string[]
): void => {
  failureReasons.forEach(
    /** 把每条非空失败原因写入独立列表项。 */
    reason => {
      /** 单条失败原因的列表项。 */
      const issueItem = doc.createElement(RESULT_LIST_ITEM_TAG);
      issueItem.setAttribute(COPY_TEST_RESULT_LANGUAGE_ISSUE_ATTRIBUTE, DOM_TRUE_ATTRIBUTE_VALUE);
      issueItem.textContent = reason;
      list.appendChild(issueItem);
    }
  );
};

/** 按持久 Screen 状态把图片引用转换为可独立移动的 Result 条目。 */
const buildResultScreenEntries = (
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): ResultScreenEntry[] => {
  /** 人工状态按同一来源行内稳定的图片文件名索引。 */
  const statusByImageId = new Map(
    (result.screenStatuses || []).map(status => [status.imageId, status])
  );
  /** 没有人工状态时全部 Screen 继承的行级 AI 问题。 */
  const fallbackLanguageIssues = getFailureReasons(result);
  return screens.map(screen => {
    /** 当前图片可选的人工状态。 */
    const status = statusByImageId.get(screen.imageId);
    return {
      ...screen,
      languageIssues: status
        ? normalizeLanguageIssues(status.languageIssues)
        : fallbackLanguageIssues,
      passed: status?.passed ?? result.passed,
    };
  });
};

/** 创建单个 Result Screen 条目。 */
const createResultScreenItem = (
  doc: Document,
  entry: ResultScreenEntry
): HTMLLIElement => {
  /** 带图片身份、顺序与隐藏问题的 Result 一级列表项。 */
  const item = doc.createElement(RESULT_LIST_ITEM_TAG);
  item.setAttribute(COPY_TEST_RESULT_IMAGE_ID_ATTRIBUTE, entry.imageId);
  item.setAttribute(COPY_TEST_RESULT_IMAGE_INSTANCE_ATTRIBUTE, entry.instanceId);
  item.setAttribute(COPY_TEST_RESULT_SCREEN_ORDER_ATTRIBUTE, String(entry.order));
  writeRetainedLanguageIssues(item, entry.languageIssues);
  item.appendChild(doc.createTextNode(entry.label));
  if (!entry.passed && entry.languageIssues.length > 0) {
    /** 当前 Failed Screen 下展示全部失败原因的二级列表。 */
    const issueList = doc.createElement('ul');
    appendFailureReasonItems(doc, issueList, entry.languageIssues);
    item.appendChild(issueList);
  }
  return item;
};

/** 创建 Passed 或 Failed 状态分组。 */
const createResultStatusGroup = (
  doc: Document,
  passed: boolean,
  entries: ResultScreenEntry[]
): HTMLElement => {
  /** 一个状态分组使用的持久容器。 */
  const group = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  /** 显示 Passed 或 Failed 状态的强调节点。 */
  const status = doc.createElement(COPY_TEST_CONTENT_LABEL_TAG);
  /** 当前状态分组承载的 Screen 列表。 */
  const list = doc.createElement('ul');
  group.setAttribute(
    COPY_TEST_RESULT_STATUS_GROUP_ATTRIBUTE,
    passed ? COPY_TEST_RESULT_PASSED_GROUP_VALUE : COPY_TEST_RESULT_FAILED_GROUP_VALUE
  );
  status.textContent = passed ? PASSED_LABEL : FAILED_LABEL;
  status.setAttribute(
    'style',
    `color:${passed ? COPY_TEST_PASSED_COLOR : COPY_TEST_FAILED_COLOR};font-weight:700;`
  );
  entries.forEach(entry => list.appendChild(createResultScreenItem(doc, entry)));
  group.appendChild(status);
  group.appendChild(list);
  return group;
};

/** 从规范 Screen 条目创建唯一 managed Result 根节点。 */
export const createResultContentFromEntries = (
  doc: Document,
  entries: ResultScreenEntry[]
): HTMLElement => {
  /** 标记为 CopyTest Result 受控内容的唯一根块。 */
  const container = doc.createElement(COPY_TEST_CONTENT_BLOCK_TAG);
  container.setAttribute(COPY_TEST_GENERATED_CONTENT_ATTRIBUTE, COPY_TEST_GENERATED_RESULT_TYPE);
  [true, false].forEach(passed => {
    /** 当前 Passed 或 Failed 分组内按 Evidence 顺序排列的 Screen。 */
    const groupEntries = entries
      .filter(entry => entry.passed === passed)
      .sort((left, right) => left.order - right.order);
    if (groupEntries.length > 0) {
      container.appendChild(createResultStatusGroup(doc, passed, groupEntries));
    }
  });
  return container;
};

/** 创建 Result 受控内容。 */
const createResultContent = (
  doc: Document,
  result: CopyTestValidationResultWithEvidence,
  screens: ScreenRef[]
): HTMLElement => {
  return createResultContentFromEntries(
    doc,
    buildResultScreenEntries(result, screens)
  );
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
  imageElement.setAttribute(
    COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
    getCopyTestImageDisplayFileName(screen.image)
  );
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
export const getManagedContentElements = (cell: Element, type: CopyTestGeneratedColumnType): Element[] => {
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
    evidenceGroupId: item.rowGroup.evidenceGroupId
      ?? item.rowGroup.dataRowIndexes[0]
      ?? item.rowGroup.anchorRowIndex,
    evidenceImages: item.result?.evidenceImages || [],
    hasResult: Boolean(item.result),
    rowSpan: item.rowGroup.rowSpan,
    selected: Boolean(item.result),
  }));
};

/** 将 Planner 结果绑定回来源行组及其逐行校验结果。 */
const buildEvidenceGroupRows = (
  rowResults: CopyTestEvidenceRowResultPlan[],
  itemByAnchorRowIndex: Map<number, LogicalRowResult>,
  screens: ScreenRef[]
): EvidenceGroupRow[] => {
  return rowResults.flatMap(rowResult => {
    /** 与 Planner 来源原子组锚点对应的逻辑行结果。 */
    const item = itemByAnchorRowIndex.get(rowResult.anchorRowIndex);
    if (!item?.result) {
      return [];
    }

    return [{
      ...item.rowGroup,
      result: item.result,
      screens,
    }];
  });
};

/** 将 Planner 的完整结构成员绑定回来源原子组。 */
const buildEvidenceSourceRowGroups = (
  sourceGroups: CopyTestEvidenceSourceGroup[],
  itemByAnchorRowIndex: Map<number, LogicalRowResult>
): CopyTestRowGroup[] => {
  return sourceGroups.flatMap(sourceGroup => {
    /** 与 Planner 来源原子组锚点对应的原始结构。 */
    const item = itemByAnchorRowIndex.get(sourceGroup.anchorRowIndex);
    return item ? [item.rowGroup] : [];
  });
};

/** 使用逐行图片关系构建前端确定性 Evidence 合并组。 */
export const buildEvidenceGroups = (
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
      rowGroups: buildEvidenceGroupRows(plan.rowResults, itemByAnchorRowIndex, screens),
      rowSpan: plan.rowSpan,
      screens,
      sourceRowGroups: buildEvidenceSourceRowGroups(
        plan.sourceGroups,
        itemByAnchorRowIndex
      ),
    };
  });
};

/** 清理未校验或没有 Evidence 图片的逻辑行受控内容。 */
export const clearUnrenderedRows = (
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
export const writeResultCell = (
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

/** 按 Evidence 规划读取每个来源原子组自己的 Screen 子集。 */
const buildResultScreenMap = (evidenceGroups: EvidenceGroup[]): Map<number, ScreenRef[]> => {
  return new Map(evidenceGroups.flatMap(group => {
    return group.rowGroups.map(rowGroup => [rowGroup.anchorRowIndex, rowGroup.screens] as const);
  }));
};

/** 只写入至少包含一个 Evidence Screen 的 AI Result。 */
const writeValidationResultCells = (
  doc: Document,
  context: GeneratedColumnContext,
  rowGroups: CopyTestRowGroup[],
  results: CopyTestValidationResultWithEvidence[],
  evidenceGroups: EvidenceGroup[]
): void => {
  /** Evidence Planner 为有图片原子组生成的 Result Screen 索引。 */
  const screensByAnchorRowIndex = buildResultScreenMap(evidenceGroups);
  buildLogicalRowResults(rowGroups, results).forEach(item => {
    if (!item.result) {
      return;
    }

    /** 当前来源原子组经 Evidence Planner 分配的 Screen 子集。 */
    const screens = screensByAnchorRowIndex.get(item.rowGroup.anchorRowIndex) || [];
    if (screens.length === 0) {
      return;
    }

    writeResultCell(
      doc,
      context,
      item.rowGroup,
      item.result,
      screens
    );
  });
};

/** 写 Evidence 单元格。 */
export const writeEvidenceCell = (doc: Document, context: GeneratedColumnContext, group: EvidenceGroup): void => {
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
    evidenceGroups.flatMap(group => group.rowGroups.flatMap(rowGroup => {
      return rowGroup.screens.length > 0 ? [rowGroup.anchorRowIndex] : [];
    }))
  );
  clearUnrenderedRows(doc, context, rowGroups, renderableAnchorRowIndexes);
  writeValidationResultCells(doc, context, rowGroups, results, evidenceGroups);
  evidenceGroups.forEach(
    /** 按前端确定性规划写入共享 Evidence 单元格。 */
    evidenceGroup => {
      writeEvidenceCell(doc, context, evidenceGroup);
    }
  );

  return refreshWorkingTable(table, toConfluenceStorageHtml(context.tableElement.outerHTML));
};
