import type { CodexChannel } from '../drive'
import { pagesOf, threadOf, turnsOf } from './vendor-convert'
import {
  CodexHistoryUnavailableError,
  EXPERIMENTAL_TURN_PAGE_METHOD,
  type HistoryMethod,
  type HistoryTransport,
  readSchema,
  STORED_THREAD_LIST_METHOD,
  STORED_THREAD_READ_METHOD,
  type StoredThread,
  type StoredTurn,
  threadSchema,
  turnSchema,
} from './vendor-model'
import { listParams, loadedParams, readParams, turnsParams } from './vendor-request-params'

export { readResumePermission } from './resume-permission'
export type {
  HistoryTransport,
  StoredThread,
  VendorStatus,
} from './vendor-model'
export {
  CodexHistoryUnavailableError,
  EXPERIMENTAL_TURN_PAGE_METHOD,
  STORED_THREAD_READ_METHOD,
} from './vendor-model'

export async function listStoredThreads(transport: HistoryTransport): Promise<StoredThread[]> {
  try {
    const pages = await pagesOf(transport, STORED_THREAD_LIST_METHOD, { limit: 50 })
    return pages.flatMap((page) =>
      page.data.map((entry) => threadOf(threadSchema.parse(entry), undefined)),
    )
  } catch (error) {
    if (error instanceof CodexHistoryUnavailableError) throw error
    throw new CodexHistoryUnavailableError(
      error instanceof Error ? error.message : 'Session history is unavailable.',
    )
  }
}

async function readExperimentalTurns(
  transport: HistoryTransport,
  threadId: string,
): Promise<StoredTurn[]> {
  const pages = await pagesOf(transport, EXPERIMENTAL_TURN_PAGE_METHOD, {
    threadId,
    itemsView: 'full',
    limit: 50,
    sortDirection: 'asc',
  })
  return turnsOf(pages.flatMap((page) => page.data.map((entry) => turnSchema.parse(entry))))
}

export async function readStoredThread(
  transport: HistoryTransport,
  threadId: string,
): Promise<StoredThread> {
  let experimental: StoredTurn[] | undefined
  try {
    experimental = await readExperimentalTurns(transport, threadId)
  } catch {
    experimental = undefined
  }
  try {
    const result = await transport.request(STORED_THREAD_READ_METHOD, {
      threadId,
      includeTurns: experimental === undefined,
    })
    const parsed = readSchema.safeParse(result)
    if (!parsed.success) throw new CodexHistoryUnavailableError()
    if (experimental === undefined && parsed.data.thread.turns === undefined) {
      throw new CodexHistoryUnavailableError()
    }
    const thread = threadOf(parsed.data.thread)
    return experimental === undefined ? thread : { ...thread, turns: experimental }
  } catch (error) {
    if (experimental !== undefined) {
      return {
        id: threadId,
        cwd: null,
        title: null,
        branch: null,
        updatedAt: null,
        status: { type: 'unknown' },
        turns: experimental,
      }
    }
    if (error instanceof CodexHistoryUnavailableError) throw error
    throw new CodexHistoryUnavailableError(
      error instanceof Error ? error.message : 'Session history is unavailable.',
    )
  }
}

export async function requestStoredHistory(
  channel: CodexChannel,
  method: HistoryMethod,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case 'thread/list':
      return channel.request('thread/list', listParams(params), (value) => value)
    case 'thread/read':
      return channel.request('thread/read', readParams(params), (value) => value)
    case 'thread/turns/list':
      return channel.request('thread/turns/list', turnsParams(params), (value) => value)
    case 'thread/loaded/list':
      return channel.request('thread/loaded/list', loadedParams(params), (value) => value)
  }
}
