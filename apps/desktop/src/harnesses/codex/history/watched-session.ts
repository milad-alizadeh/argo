import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import {
  type HistoryTransport,
  listStoredThreads,
  readStoredThread,
  type StoredThread,
} from './vendor-history'
import { matchWorkspace, projectionFromStoredThread } from './watched-projection'

export type WatchedCodexSessions = {
  refresh: () => Promise<SessionProjection[]>
  refreshForSearch: () => Promise<SessionProjection[]>
  refreshThread: (threadId: string) => Promise<void>
  readProjection: (threadId: string) => Promise<SessionProjection | null>
  projections: () => SessionProjection[]
  checkoutFor: (nativeId: string) => string | null
}

type WatchedCodexSessionOptions = {
  transport: HistoryTransport
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
}

class WatchedCodexHistory implements WatchedCodexSessions {
  private projectionsById = new Map<string, SessionProjection>()
  private storedThreads = new Map<string, StoredThread>()
  private readonly checkouts = new Map<string, string | null>()
  private knownWorkspaces: readonly { id: string; path: string }[] = []
  private revision = 0
  private pending = Promise.resolve()
  private refreshInFlight: Promise<SessionProjection[]> | null = null
  private readonly options: WatchedCodexSessionOptions

  constructor(options: WatchedCodexSessionOptions) {
    this.options = options
  }

  private remember(thread: StoredThread, health: SessionProjection['sourceHealth'] = 'ready') {
    const previous = this.storedThreads.get(thread.id)
    const merged = {
      ...previous,
      ...thread,
      cwd: thread.cwd ?? previous?.cwd ?? null,
      title: thread.title ?? previous?.title ?? null,
      branch: thread.branch ?? previous?.branch ?? null,
      updatedAt: thread.updatedAt ?? previous?.updatedAt ?? null,
      status:
        thread.status.type === 'unknown' && previous !== undefined
          ? previous.status
          : thread.status,
    }
    this.revision += 1
    const workspace = matchWorkspace(merged.cwd, this.knownWorkspaces)
    this.storedThreads.set(thread.id, merged)
    this.checkouts.set(thread.id, merged.cwd)
    this.projectionsById.set(
      thread.id,
      projectionFromStoredThread(merged, workspace, {
        revision: this.revision,
        sourceHealth: health,
      }),
    )
  }

  private async refreshNow(mode: 'fast' | 'complete' = 'fast') {
    this.knownWorkspaces = await this.options.knownWorkspaces()
    const threads = await listStoredThreads(this.options.transport, mode)
    const next = new Map<string, SessionProjection>()
    const nextStored = new Map<string, StoredThread>()
    this.checkouts.clear()
    for (const thread of threads) {
      this.revision += 1
      this.checkouts.set(thread.id, thread.cwd)
      nextStored.set(thread.id, thread)
      next.set(
        thread.id,
        projectionFromStoredThread(thread, matchWorkspace(thread.cwd, this.knownWorkspaces), {
          revision: this.revision,
        }),
      )
    }
    this.storedThreads = nextStored
    this.projectionsById = next
    return this.projections()
  }

  refresh() {
    if (this.refreshInFlight !== null) return this.refreshInFlight
    const run = this.pending.then(() => this.refreshNow())
    this.refreshInFlight = run
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    const clear = () => {
      if (this.refreshInFlight === run) this.refreshInFlight = null
    }
    run.then(clear, clear)
    return run
  }

  refreshForSearch() {
    const run = this.pending.then(() => this.refreshNow('complete'))
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  refreshThread(threadId: string) {
    const run = this.pending.then(async () => {
      this.knownWorkspaces = await this.options.knownWorkspaces()
      this.remember(await readStoredThread(this.options.transport, threadId))
    })
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async readProjection(threadId: string) {
    await this.refreshThread(threadId)
    return this.projectionsById.get(threadId) ?? null
  }

  projections() {
    return [...this.projectionsById.values()]
  }

  checkoutFor(nativeId: string) {
    return this.checkouts.get(nativeId) ?? null
  }
}

export function createWatchedCodexSessions(
  options: WatchedCodexSessionOptions,
): WatchedCodexSessions {
  return new WatchedCodexHistory(options)
}
