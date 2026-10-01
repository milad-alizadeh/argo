import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { type LockState, probeLocks } from '@/harnesses/host/lock-probe'
import type {
  ExternalActivityReading,
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { type CodexRequest, isThreadNotLoaded, type ThreadItem } from '../app-server'
import { codexCollabFacts, codexFeedContent } from './codex-feed'
import { createCodexStatusHooks } from './codex-status-hooks'

// A turns read that fails this soon after the rollout changed is a Turn still starting.
const CODEX_TURN_START_MS = 2_000

// A Codex writer holds `<thread id>.lock` here while its thread is open.
const LOCK_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.lock$/
// Codex's own lock over the whole folder (`rollout/src/writer_lock.rs`), which names no thread.
const COORDINATION_LOCK = '.coordination.lock'

const threadPathSchema = z.looseObject({
  thread: z.looseObject({ id: z.string().min(1), path: z.string().min(1).nullable() }),
})

const turnSchema = z.looseObject({
  id: z.string().min(1),
  items: z.array(z.looseObject({ type: z.string().min(1) })),
  completedAt: z.number().nullable(),
})
const turnsPageSchema = z.looseObject({ data: z.array(turnSchema) })
type Turn = z.infer<typeof turnSchema>

// A finished Turn is idle. An unfinished one is running while its writer holds the lock, and
// unknown once the writer is gone, since a crash leaves it unfinished too.
function turnStatus(turn: Turn | undefined, lock: LockState): ExternalSessionStatus {
  if (turn === undefined || turn.completedAt !== null) return 'idle'
  return lock === 'held' ? 'running' : 'unknown'
}

function turnContent(turn: Turn | undefined): FeedContent[] {
  if (turn === undefined) return []
  // The generated `ThreadItem` union is the item shape; the mapping counts an unknown item.
  const items = turn.items as ThreadItem[]
  const collab = codexCollabFacts(items)
  let rejected = 0
  const content = items.flatMap((item) =>
    codexFeedContent(item, () => (rejected += 1), collab.get(item.id)),
  )
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex history shape(s).`)
  return content
}

// What the newest Turn of a thread is doing, with its writer lock's state.
async function readNewestTurn(
  request: CodexRequest,
  { nativeId, lockFile }: { nativeId: string; lockFile: string },
  changedAt: number,
): Promise<ExternalActivityReading> {
  const lock = (await probeLocks([lockFile])).get(lockFile) ?? 'missing'
  let page: unknown
  try {
    page = await request(
      'thread/turns/list',
      { threadId: nativeId, limit: 1, itemsView: 'full' },
      (value) => value,
    )
  } catch (error) {
    if (isThreadNotLoaded(error))
      return { turn: [], status: lock === 'held' ? 'idle' : null, retry: false }
    if (Date.now() - changedAt < CODEX_TURN_START_MS)
      return { turn: [], status: 'running', retry: true }
    throw error
  }
  const parsed = turnsPageSchema.safeParse(page)
  if (!parsed.success) {
    console.warn('Rejected 1 unrecognised Codex turns page.')
    throw parsed.error
  }
  const turn = parsed.data.data.at(-1)
  return { turn: turnContent(turn), status: turnStatus(turn, lock), retry: false }
}

// The thread each lock file names, and a count of the names that are no lock Codex writes.
function lockedThreadIds(names: readonly string[]) {
  const nativeIds: string[] = []
  let rejected = 0
  for (const name of names) {
    if (name === COORDINATION_LOCK) continue
    const nativeId = LOCK_NAME.exec(name)?.[1]
    if (nativeId === undefined) rejected += 1
    else nativeIds.push(nativeId)
  }
  return { nativeIds, rejected }
}

// Sessions Codex runs outside Argo: each open thread's writer lock names it, and app-server
// `thread/turns/list` says what its newest Turn is doing (ADR-0047). A status hook outranks it.
export function createCodexExternalSessions(
  request: CodexRequest,
  codexHome: string,
): ExternalSessions {
  const lockFolder = path.join(codexHome, 'thread-writer-locks')
  const lockFile = (nativeId: string) => path.join(lockFolder, `${nativeId}.lock`)
  // A thread's rollout path never changes, so each is asked for once.
  const rollouts = new Map<string, string | null>()

  async function rolloutOf(nativeId: string): Promise<string | null> {
    const known = rollouts.get(nativeId)
    if (known !== undefined) return known
    try {
      const { thread } = await request(
        'thread/read',
        { threadId: nativeId, includeTurns: false },
        (value) => threadPathSchema.parse(value),
      )
      rollouts.set(nativeId, thread.path)
      return thread.path
    } catch (error) {
      // Asked again next tick: Codex answers `thread not loaded` until a new thread is stored.
      if (isThreadNotLoaded(error)) return null
      console.warn('Could not read a Codex thread path:', error)
      return null
    }
  }

  async function listLive() {
    let names: string[]
    try {
      names = await readdir(lockFolder)
    } catch (error) {
      // No lock folder means no Codex writer has run; any other error says nothing about threads.
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT'
      if (missing) return { sessions: [], rejected: 0 }
      throw error
    }
    const { nativeIds, rejected } = lockedThreadIds(names)
    const locks = await probeLocks(nativeIds.map(lockFile))
    const sessions: LiveExternalSession[] = []
    for (const nativeId of nativeIds)
      if (locks.get(lockFile(nativeId)) === 'held')
        sessions.push({ nativeId, status: null, transcript: await rolloutOf(nativeId) })
    return { sessions, rejected }
  }

  const readActivity = (nativeId: string, changedAt: number) =>
    readNewestTurn(request, { nativeId, lockFile: lockFile(nativeId) }, changedAt)

  return { listLive, readActivity, hooks: createCodexStatusHooks(request) }
}
