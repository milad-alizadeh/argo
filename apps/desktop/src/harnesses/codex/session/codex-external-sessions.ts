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
import { type CodexRequest, isThreadNotLoaded } from '../app-server'
import { createCodexStatusHooks } from './codex-status-hooks'
import { type CodexTurn, codexTurnContent, readCodexTurnPage } from './codex-turn-pages'

// A turns read that fails this soon after the rollout changed is a Turn still starting.
const CODEX_TURN_START_MS = 2_000

// A Codex writer holds `<thread id>.lock` here while its thread is open.
const LOCK_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.lock$/
// Codex's own lock over the whole folder (`rollout/src/writer_lock.rs`), which names no thread.
const COORDINATION_LOCK = '.coordination.lock'

const threadPathSchema = z.looseObject({
  thread: z.looseObject({ id: z.string().min(1), path: z.string().min(1).nullable() }),
})

// A finished Turn is idle. An unfinished one is running while its writer holds the lock, and
// unknown once the writer is gone, since a crash leaves it unfinished too.
function turnStatus(turn: CodexTurn | undefined, lock: LockState): ExternalSessionStatus {
  if (turn === undefined || turn.completedAt !== null) return 'idle'
  return lock === 'held' ? 'running' : 'unknown'
}

function turnContent(turn: CodexTurn | undefined): FeedContent[] {
  if (turn === undefined) return []
  let rejected = 0
  const content = codexTurnContent(turn, () => (rejected += 1))
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
  let turns: CodexTurn[]
  try {
    const page = await readCodexTurnPage(request, {
      threadId: nativeId,
      limit: 1,
      itemsView: 'full',
      sortDirection: 'desc',
    })
    turns = page.turns
  } catch (error) {
    if (isThreadNotLoaded(error))
      return { turn: [], status: lock === 'held' ? 'idle' : null, retry: false }
    if (Date.now() - changedAt < CODEX_TURN_START_MS)
      return { turn: [], status: 'running', retry: true }
    throw error
  }
  const turn = turns[0]
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
// `thread/turns/list` says what its newest Turn is doing (ADR-0047).
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

  return {
    listLive,
    readActivity,
    hooks: createCodexStatusHooks(request),
  }
}
