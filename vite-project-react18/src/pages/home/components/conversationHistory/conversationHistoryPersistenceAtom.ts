import { message, Modal } from 'antd';
import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import { aiChat } from '@/api';
import {
  renameConversationApi,
  saveConversationApi,
  saveConversationStateApi,
  type ConversationHistory,
  type ConversationStatePatch,
  type ConversationStatePatchRequest
} from '@/api/conversationHistoryApi';
import type { ConversationState, ConversationTurn } from '../chat/types';

const OPERATION_CREATE = 'create';
const OPERATION_UPDATE = 'update';

type PersistenceOperation = typeof OPERATION_CREATE | typeof OPERATION_UPDATE;

type ConversationHistoryPersistenceRequest = {
  operation: PersistenceOperation;
  previousConversation?: ConversationHistory;
  conversation: ConversationHistory;
  conversationHistoriesAtom: PrimitiveAtom<ConversationHistory[]>;
};

type SetConversationHistories = (
  updater: (prev: ConversationHistory[]) => ConversationHistory[]
) => void;

type QueuedPersistenceTask = Omit<
  ConversationHistoryPersistenceRequest,
  'conversationHistoriesAtom'
> & {
  setConversationHistories: SetConversationHistories;
};

type PendingCounters = Record<PersistenceOperation, number>;

// 每个持久化任务最多重试次数。
const MAX_PERSISTENCE_ATTEMPTS = 3;
// 持久化失败后的基础退避等待时间，实际等待会按重试次数递增。
const RETRY_DELAY_MS = 1000;
// 后端不可用时展示给用户的统一错误文案。
const BACKEND_UNAVAILABLE_MESSAGE = 'Backend service is unavailable';
// AI 生成会话标题的最大字符数。
const GENERATED_TITLE_MAX_LENGTH = 20;

// 全局串行持久化队列，确保创建和更新按入队顺序执行。
let persistenceQueue = Promise.resolve();
// 标记 beforeunload 防护是否已安装，避免重复绑定浏览器事件。
let unloadGuardInstalled = false;
// 当前所有未完成持久化任务数量，用于关闭页提示和弹窗关闭判断。
let pendingPersistenceCount = 0;
// 当前未完成创建任务数量，用于生成关闭页提示文案。
let pendingCreateCount = 0;
// 当前未完成更新任务数量，用于生成关闭页提示文案。
let pendingUpdateCount = 0;
// 标记等待保存完成的提示弹窗是否已经展示。
let pendingPersistenceModalVisible = false;
// 保存当前等待弹窗的销毁函数，所有任务完成后主动关闭弹窗。
let pendingPersistenceModalDestroy: (() => void) | undefined;

// 按会话维度记录创建和更新任务数量，避免同一会话多个任务互相误清状态。
const pendingCountersByConversationId = new Map<string, PendingCounters>();
// 记录创建失败的会话 ID，阻止后续更新继续打到不存在的后端记录。
const createFailedConversationIds = new Set<string>();
// 记录已提示过“创建失败导致更新阻塞”的会话 ID，避免重复弹错误提示。
const createBlockedUpdateNotifiedIds = new Set<string>();

// 判断两个可序列化值是否相同，用于构造增量 patch。
const isSameValue = (previousValue: unknown, nextValue: unknown) =>
  JSON.stringify(previousValue ?? null) === JSON.stringify(nextValue ?? null);

// 等待指定毫秒数，用于失败重试之间的退避延迟。
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

// 获取某个会话当前排队中的创建和更新任务数量。
const getPendingCounters = (conversationId: string): PendingCounters =>
  pendingCountersByConversationId.get(conversationId) ?? {
    [OPERATION_CREATE]: 0,
    [OPERATION_UPDATE]: 0
  };

// 根据队列任务更新会话的前端持久化状态标记。
const setConversationFlags = (
  task: QueuedPersistenceTask,
  flags: Pick<ConversationHistory, 'isCreating' | 'isUpdating'>
) => {
  task.setConversationHistories((prev) =>
    prev.map((conversation) =>
      conversation.id === task.conversation.id
        ? {
            ...conversation,
            ...flags
          }
        : conversation
    )
  );
};

// 记录一个新的持久化任务进入队列，并同步全局与会话维度的计数。
const incrementPendingTask = (task: QueuedPersistenceTask) => {
  const counters = getPendingCounters(task.conversation.id);
  counters[task.operation] += 1;
  pendingCountersByConversationId.set(task.conversation.id, counters);

  pendingPersistenceCount += 1;
  if (task.operation === OPERATION_CREATE) {
    pendingCreateCount += 1;
  } else {
    pendingUpdateCount += 1;
  }
};

// 记录一个持久化任务结束，并清理已归零的计数。
const decrementPendingTask = (task: QueuedPersistenceTask) => {
  const counters = getPendingCounters(task.conversation.id);
  counters[task.operation] = Math.max(0, counters[task.operation] - 1);

  if (counters[OPERATION_CREATE] === 0 && counters[OPERATION_UPDATE] === 0) {
    pendingCountersByConversationId.delete(task.conversation.id);
  } else {
    pendingCountersByConversationId.set(task.conversation.id, counters);
  }

  pendingPersistenceCount = Math.max(0, pendingPersistenceCount - 1);
  if (task.operation === OPERATION_CREATE) {
    pendingCreateCount = Math.max(0, pendingCreateCount - 1);
  } else {
    pendingUpdateCount = Math.max(0, pendingUpdateCount - 1);
  }
};

// 判断指定会话是否仍有某类持久化任务未完成。
const hasPendingTaskForConversation = (
  conversationId: string,
  operation: PersistenceOperation
) => (pendingCountersByConversationId.get(conversationId)?.[operation] ?? 0) > 0;

// 生成当前未完成操作的英文标签，用于关闭页面时的提示文案。
const getPendingOperationLabel = () => {
  const labels: string[] = [];

  if (pendingCreateCount > 0) {
    labels.push(OPERATION_CREATE);
  }

  if (pendingUpdateCount > 0) {
    labels.push(OPERATION_UPDATE);
  }

  return labels.join(' and ') || 'save';
};

// 当所有持久化任务结束后，关闭之前弹出的等待提示弹窗。
const closePendingPersistenceModalIfDone = () => {
  if (pendingPersistenceCount > 0 || !pendingPersistenceModalDestroy) {
    return;
  }

  pendingPersistenceModalDestroy();
  pendingPersistenceModalDestroy = undefined;
  pendingPersistenceModalVisible = false;
};

// 暴露当前是否仍有会话持久化任务未完成。
export const hasPendingConversationHistoryPersistence = () =>
  pendingPersistenceCount > 0;

// 在用户尝试关闭页面时，弹出 Modal 告知会话仍在保存中。
const showPendingPersistenceModal = () => {
  if (pendingPersistenceModalVisible || typeof window === 'undefined') {
    return;
  }

  pendingPersistenceModalVisible = true;
  const modal = Modal.warning({
    title: 'Conversation is still saving',
    content: `Conversation ${getPendingOperationLabel()} is still running. Please keep this tab open until backend persistence finishes.`,
    okText: 'OK'
  });

  pendingPersistenceModalDestroy = modal.destroy;
};

// 创建或更新重试耗尽后，向用户展示后端不可用错误。
const notifyBackendUnavailable = (operation: PersistenceOperation) => {
  const action = operation === OPERATION_CREATE ? 'creating' : 'updating';
  message.error(`${BACKEND_UNAVAILABLE_MESSAGE} while ${action} conversation`);
};

// 移除只属于前端状态的字段，避免把 isCreating/isUpdating 写入后端。
const toPersistableConversation = (conversation: ConversationHistory) => {
  const persistableConversation = { ...conversation };
  delete persistableConversation.isCreating;
  delete persistableConversation.isUpdating;
  return persistableConversation;
};

// 同步后端保存成功后返回的标题、标题生成状态和更新时间到本地会话列表。
const syncPersistedConversationMetadata = (
  task: QueuedPersistenceTask,
  persistedConversation?: ConversationHistory
) => {
  if (!persistedConversation) {
    return;
  }

  // 保存成功后只回写后端确认的标题元数据，避免用接口响应覆盖本地仍在排队的会话内容。
  task.setConversationHistories((prev) =>
    prev.map((conversation) =>
      conversation.id === task.conversation.id
        ? {
            ...conversation,
            title: persistedConversation.title,
            titleGenerating: conversation.conversationState?.currentTurnId
              ? true
              : persistedConversation.titleGenerating,
            updatedAt: persistedConversation.updatedAt
          }
        : conversation
    )
  );
};

// 更新本地标题生成状态，避免 rename 期间侧边栏标题加载态不准确。
const setLocalTitleGenerating = (
  task: QueuedPersistenceTask,
  titleGenerating: boolean
) => {
  task.setConversationHistories((prev) =>
    prev.map((conversation) => {
      if (conversation.id !== task.conversation.id) {
        return conversation;
      }

      // 当前仍有 turn 在生成时，失败兜底不能把标题加载态提前关掉。
      if (!titleGenerating && conversation.conversationState?.currentTurnId) {
        return conversation;
      }

      return {
        ...conversation,
        titleGenerating
      };
    })
  );
};

// 当本次更新不会进入 rename 时，清理本地标题加载态，并避免后端旧值再次覆盖为 true。
const clearTitleGeneratingWhenRenameSkipped = (
  task: QueuedPersistenceTask,
  persistedConversation?: ConversationHistory
) => {
  setLocalTitleGenerating(task, false);

  return persistedConversation
    ? {
        ...persistedConversation,
        titleGenerating: false
      }
    : undefined;
};

// 构造 AI 生成会话标题所需的提示词，只使用当前 turn 的用户输入和 AI 回复。
const buildGeneratedTitlePrompt = (turn: ConversationTurn) => {
  const userInput = turn.userInput.content;
  const aiResponse = turn.aiResponse.content.replace(/<think>[\s\S]*?<\/think>/g, '') || '';

  return `Generate a concise conversation title (maximum 20 characters) based on the following conversation. The title should:
1. Be in the same language as the user's input
2. Capture the main topic or question
3. Be specific and descriptive
4. Use clear, natural language

User Input: ${userInput}
AI Response: ${aiResponse}

Please provide only the title, no additional text or explanation.`;
};

// 调用 AI 生成会话标题，失败时使用用户输入的前 20 个字符作为兜底标题。
const generateConversationTitle = async (turn: ConversationTurn) => {
  const fallbackTitle = turn.userInput.content.trim().substring(0, GENERATED_TITLE_MAX_LENGTH);

  try {
    const response = await aiChat({
      messages: [{
        role: 'user',
        content: buildGeneratedTitlePrompt(turn)
      }]
    });
    return response.data?.content?.toString().trim().substring(0, GENERATED_TITLE_MAX_LENGTH) || fallbackTitle;
  } catch (error) {
    console.error('Failed to generate conversation title', error);
    return fallbackTitle;
  }
};

// 选择用于生成标题的 turn，只允许使用本次增量 patch 中已完成且有回复内容的 turn。
const getTitleSourceTurn = (
  conversationStatePatch: ConversationStatePatch | null
) => {
  const changedTurn = conversationStatePatch?.turns?.[0];
  if (changedTurn?.aiResponse.status === 'completed' && changedTurn.aiResponse.content) {
    return changedTurn;
  }

  return undefined;
};

// 生成标题并通过 rename 接口持久化，返回后端确认后的会话数据用于回写本地元信息。
const persistGeneratedTitle = async (
  task: QueuedPersistenceTask,
  titleSourceTurn: ConversationTurn
) => {
  setLocalTitleGenerating(task, true);
  try {
    const title = await generateConversationTitle(titleSourceTurn);
    return await renameConversationApi(task.conversation.id, title);
  } finally {
    setLocalTitleGenerating(task, false);
  }
};

// 找出最后一条新增或发生变化的 turn，后端会按 turn.id 追加或替换。
const buildChangedTurnPatch = (
  previousTurns: ConversationTurn[] = [],
  nextTurns: ConversationTurn[] = []
) => {
  const previousTurnsById = new Map(
    previousTurns.map((turn) => [turn.id, turn])
  );

  const changedTurns = nextTurns.filter(
    (turn) => !isSameValue(previousTurnsById.get(turn.id), turn)
  );

  return changedTurns[changedTurns.length - 1];
};

// 根据前后会话状态生成最小 conversationState patch。
const buildConversationStatePatch = (
  previousState?: ConversationState,
  nextState?: ConversationState
) => {
  if (!nextState) {
    return null;
  }

  const patch: ConversationStatePatch = {};
  const changedTurn = buildChangedTurnPatch(
    previousState?.turns,
    nextState.turns
  );

  if (changedTurn) {
    patch.turns = [changedTurn];
  }

  if (!isSameValue(previousState?.agentId, nextState.agentId)) {
    patch.agentId = nextState.agentId ?? null;
  }

  if (!isSameValue(previousState?.agentName, nextState.agentName)) {
    patch.agentName = nextState.agentName ?? null;
  }

  if (!isSameValue(previousState?.currentTurnId, nextState.currentTurnId)) {
    patch.currentTurnId = nextState.currentTurnId ?? null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
};

// 构造增量更新会话状态所需的请求体。
const buildConversationStatePatchRequest = (
  task: QueuedPersistenceTask,
  conversationStatePatch: ConversationStatePatch
): ConversationStatePatchRequest => {
  const request: ConversationStatePatchRequest = {
    conversationState: conversationStatePatch
  };

  if (task.previousConversation?.updatedAt !== task.conversation.updatedAt) {
    request.updatedAt = task.conversation.updatedAt;
  }

  return request;
};

// 执行创建请求，创建仍然需要使用完整会话数据。
const persistConversationCreate = async (task: QueuedPersistenceTask) => {
  const persistedConversation = await saveConversationApi(toPersistableConversation(task.conversation));

  // 创建接口本身不会 rename；如果本地没有正在生成的 turn，不能让后端旧值把 loading 卡住。
  return {
    ...persistedConversation,
    titleGenerating: false
  };
};

// 执行会话增量更新：先保存 state patch，再通过 rename 接口更新生成标题。
const persistConversationUpdate = async (task: QueuedPersistenceTask) => {
  const conversationStatePatch = buildConversationStatePatch(
    task.previousConversation?.conversationState,
    task.conversation.conversationState
  );

  let patchedConversation: ConversationHistory | undefined;

  if (conversationStatePatch) {
    patchedConversation = await saveConversationStateApi(
      task.conversation.id,
      buildConversationStatePatchRequest(task, conversationStatePatch)
    );
  }

  const titleSourceTurn = getTitleSourceTurn(conversationStatePatch);
  if (!titleSourceTurn) {
    return clearTitleGeneratingWhenRenameSkipped(task, patchedConversation);
  }

  return await persistGeneratedTitle(task, titleSourceTurn) ?? patchedConversation;
};

// 根据任务类型分发到创建或增量更新接口。
const persistConversation = async (task: QueuedPersistenceTask) => {
  if (task.operation === OPERATION_CREATE) {
    return await persistConversationCreate(task);
  }

  return await persistConversationUpdate(task);
};

// 执行单次会话创建或增量更新，并在失败时最多重试三次。
const persistConversationWithRetry = async (task: QueuedPersistenceTask) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PERSISTENCE_ATTEMPTS; attempt += 1) {
    try {
      return await persistConversation(task);
    } catch (error) {
      lastError = error;

      if (attempt < MAX_PERSISTENCE_ATTEMPTS) {
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }

  notifyBackendUnavailable(task.operation);
  throw lastError;
};

// 执行队列中的一个持久化任务，保证创建失败时不会继续更新同一会话。
const runPersistenceTask = async (task: QueuedPersistenceTask) => {
  try {
    if (
      task.operation === OPERATION_UPDATE &&
      createFailedConversationIds.has(task.conversation.id)
    ) {
      if (!createBlockedUpdateNotifiedIds.has(task.conversation.id)) {
        notifyBackendUnavailable(OPERATION_UPDATE);
        createBlockedUpdateNotifiedIds.add(task.conversation.id);
      }
      clearTitleGeneratingWhenRenameSkipped(task);
      return;
    }

    const persistedConversation = await persistConversationWithRetry(task);
    syncPersistedConversationMetadata(task, persistedConversation);

    if (task.operation === OPERATION_CREATE) {
      createFailedConversationIds.delete(task.conversation.id);
      createBlockedUpdateNotifiedIds.delete(task.conversation.id);
    }
  } catch (error) {
    if (task.operation === OPERATION_CREATE) {
      createFailedConversationIds.add(task.conversation.id);
    }

    clearTitleGeneratingWhenRenameSkipped(task);

    console.error(
      `Failed to ${task.operation} conversation history after retries`,
      error
    );
  } finally {
    decrementPendingTask(task);

    if (!hasPendingTaskForConversation(task.conversation.id, task.operation)) {
      setConversationFlags(
        task,
        task.operation === OPERATION_CREATE
          ? { isCreating: false }
          : { isUpdating: false }
      );
    }

    closePendingPersistenceModalIfDone();
  }
};

// 将创建或更新任务加入串行队列，并立即设置本地保存状态。
const enqueuePersistenceTask = (task: QueuedPersistenceTask) => {
  incrementPendingTask(task);
  setConversationFlags(
    task,
    task.operation === OPERATION_CREATE
      ? { isCreating: true }
      : { isUpdating: true }
  );

  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(() => runPersistenceTask(task))
    .catch((error) => {
      console.error('Conversation history persistence queue failed', error);
    });
};

// 拦截关闭浏览器或标签页的行为，提示用户等待创建或更新完成。
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasPendingConversationHistoryPersistence()) {
    return undefined;
  }

  showPendingPersistenceModal();

  const warningMessage =
    'Conversation changes are still saving. Please wait until backend persistence finishes.';
  event.preventDefault();
  return warningMessage;
};

// 安装全局 beforeunload 防护，避免重复绑定监听器。
export const installConversationHistoryPersistenceGuard = () => {
  if (unloadGuardInstalled || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('beforeunload', handleBeforeUnload);
  unloadGuardInstalled = true;
};

// Jotai 写入 atom：把外部传入的会话创建或更新请求转成队列任务。
export const enqueueConversationHistoryPersistenceAtom = atom(
  null,
  (_get, set, request: ConversationHistoryPersistenceRequest) => {
    enqueuePersistenceTask({
      operation: request.operation,
      previousConversation: request.previousConversation,
      conversation: request.conversation,
      setConversationHistories: (updater) => {
        set(request.conversationHistoriesAtom, updater);
      }
    });
  }
);
