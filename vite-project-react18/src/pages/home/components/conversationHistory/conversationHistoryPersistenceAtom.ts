import { message, Modal } from 'antd';
import { atom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import {
  patchConversationStateApi,
  renameConversationApi,
  saveConversationApi,
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

const MAX_PERSISTENCE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const BACKEND_UNAVAILABLE_MESSAGE = 'Backend service is unavailable';

let persistenceQueue = Promise.resolve();
let unloadGuardInstalled = false;
let pendingPersistenceCount = 0;
let pendingCreateCount = 0;
let pendingUpdateCount = 0;
let pendingPersistenceModalVisible = false;
let pendingPersistenceModalDestroy: (() => void) | undefined;

const pendingCountersByConversationId = new Map<string, PendingCounters>();
const createFailedConversationIds = new Set<string>();
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

// 判断当前更新是否需要调用重命名接口。
const shouldRenameConversation = (task: QueuedPersistenceTask) =>
  !task.previousConversation ||
  task.previousConversation.title !== task.conversation.title ||
  task.previousConversation.titleGenerating !== task.conversation.titleGenerating;

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
  await saveConversationApi(toPersistableConversation(task.conversation));
};

// 执行会话增量更新：标题走 rename，状态走 patch state。
const persistConversationUpdate = async (task: QueuedPersistenceTask) => {
  if (shouldRenameConversation(task)) {
    await renameConversationApi(task.conversation.id, task.conversation.title);
  }

  const conversationStatePatch = buildConversationStatePatch(
    task.previousConversation?.conversationState,
    task.conversation.conversationState
  );

  if (!conversationStatePatch) {
    return;
  }

  await patchConversationStateApi(
    task.conversation.id,
    buildConversationStatePatchRequest(task, conversationStatePatch)
  );
};

// 根据任务类型分发到创建或增量更新接口。
const persistConversation = async (task: QueuedPersistenceTask) => {
  if (task.operation === OPERATION_CREATE) {
    await persistConversationCreate(task);
    return;
  }

  await persistConversationUpdate(task);
};

// 执行单次会话创建或增量更新，并在失败时最多重试三次。
const persistConversationWithRetry = async (task: QueuedPersistenceTask) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PERSISTENCE_ATTEMPTS; attempt += 1) {
    try {
      await persistConversation(task);
      return;
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
      return;
    }

    await persistConversationWithRetry(task);

    if (task.operation === OPERATION_CREATE) {
      createFailedConversationIds.delete(task.conversation.id);
      createBlockedUpdateNotifiedIds.delete(task.conversation.id);
    }
  } catch (error) {
    if (task.operation === OPERATION_CREATE) {
      createFailedConversationIds.add(task.conversation.id);
    }

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
