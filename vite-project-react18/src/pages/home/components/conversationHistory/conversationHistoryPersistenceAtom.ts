import { atom } from 'jotai';

import type {
  ConversationHistory,
  ConversationStatePatch
} from '@/api/conversationHistoryApi';
import {
  patchConversationStateApi,
  renameConversationApi,
  saveConversationApi
} from '@/api/conversationHistoryApi';

const PERSISTENCE_MAX_RETRIES = 2;
const PERSISTENCE_RETRY_DELAY_MS = 300;

const conversationPersistenceQueues = new Map<string, Promise<unknown>>();

const delay = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const enqueueConversationPersistenceTask = async <T>(
  conversationId: string,
  task: () => Promise<T>
): Promise<T> => {
  const previousTask = conversationPersistenceQueues.get(conversationId) ?? Promise.resolve();
  const currentTask = previousTask.catch(() => undefined).then(task);
  const trackedTask = currentTask.catch(() => undefined);

  conversationPersistenceQueues.set(conversationId, trackedTask);

  try {
    return await currentTask;
  } finally {
    if (conversationPersistenceQueues.get(conversationId) === trackedTask) {
      conversationPersistenceQueues.delete(conversationId);
    }
  }
};

const runWithPersistenceRetry = async <T>(
  label: string,
  task: () => Promise<T>
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= PERSISTENCE_MAX_RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === PERSISTENCE_MAX_RETRIES) {
        break;
      }

      console.warn(`${label} failed, retrying...`, error);
      await delay(PERSISTENCE_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
};

export const persistConversationCreationAtom = atom(
  null,
  async (_get, _set, conversation: ConversationHistory) =>
    enqueueConversationPersistenceTask(conversation.id, () =>
      runWithPersistenceRetry(`Create conversation ${conversation.id}`, () => saveConversationApi(conversation))
    )
);

export const persistConversationSnapshotAtom = atom(
  null,
  async (_get, _set, conversation: ConversationHistory) =>
    enqueueConversationPersistenceTask(conversation.id, () =>
      runWithPersistenceRetry(`Save conversation ${conversation.id}`, () => saveConversationApi(conversation))
    )
);

export const persistConversationStatePatchAtom = atom(
  null,
  async (_get, _set, {
    conversationHistoryId,
    staffId,
    conversationState,
    updatedAt
  }: {
    conversationHistoryId: string;
    staffId: string;
    conversationState: ConversationStatePatch;
    updatedAt: string;
  }) =>
    enqueueConversationPersistenceTask(conversationHistoryId, () =>
      runWithPersistenceRetry(`Patch conversation ${conversationHistoryId}`, () =>
        patchConversationStateApi(conversationHistoryId, {
          staffId,
          conversationState,
          updatedAt
        })
      )
    )
);

export const persistConversationRenameAtom = atom(
  null,
  async (_get, _set, {
    conversationHistoryId,
    title
  }: {
    conversationHistoryId: string;
    title: string;
  }) =>
    enqueueConversationPersistenceTask(conversationHistoryId, () =>
      runWithPersistenceRetry(`Rename conversation ${conversationHistoryId}`, () =>
        renameConversationApi(conversationHistoryId, title)
      )
    )
);
