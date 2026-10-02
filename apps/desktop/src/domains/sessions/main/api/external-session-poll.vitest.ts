import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type {
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { ExternalSessionPoll, RUNNING_QUIET_LIMIT_MS } from './external-session-poll'

// Transcripts under this folder stat from the test; a held one signals its stat and waits.
const TRANSCRIPTS = '/stub-transcripts/'
const held = new Map<string, { entered: () => void; released: Promise<void> }>()

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return {
    ...actual,
    stat: async (file: string) => {
      if (!String(file).startsWith(TRANSCRIPTS)) return actual.stat(file)
      const hold = held.get(String(file))
      hold?.entered()
      await hold?.released
      return { ino: 1, size: 0, mtimeMs: 0 }
    },
  }
})

const FIRST = '00000000-0000-4000-8000-0000000000c1'
const SECOND = '00000000-0000-4000-8000-0000000000c2'
// The status every listing gives; null where only an activity read can tell.
let listedStatus: ExternalSessionStatus | null
// Each Session an activity read asked about, in order.
let reads: string[]
const listed = (nativeId: string): LiveExternalSession => ({
  nativeId,
  status: listedStatus,
  transcript: `${TRANSCRIPTS}${nativeId}`,
})

let caller: ReturnType<typeof sessionListCaller>
let poll: ExternalSessionPoll

beforeEach(() => {
  caller = sessionListCaller()
  listedStatus = null
  reads = []
  const external: ExternalSessions = {
    listLive: async () => ({ sessions: [listed(FIRST), listed(SECOND)], rejected: 0 }),
    readActivity: async (nativeId) => {
      reads.push(nativeId)
      return { turn: [], status: null, retry: false }
    },
  }
  poll = new ExternalSessionPoll({
    database: caller.database,
    changes: caller.sessionListChanges,
    harnesses: [{ harness: 'codex', external }],
    hasLiveChannel: () => false,
    discover: () => {},
    refreshFeed: () => {},
  })
  for (const id of [FIRST, SECOND])
    insertSession(caller.database, { id, harness: 'codex', nativeId: id, status: 'idle' })
})

afterEach(() => {
  poll.stop()
  held.clear()
  vi.restoreAllMocks()
  caller.stopWatching()
  caller.database.$client.close()
})

async function statusOf(id: string) {
  return (await caller.list({ projectId: 'project-1' })).rows.find((row) => row.id === id)?.status
}

test('a hook that lands while a tick waits on an earlier transcript keeps its status', async () => {
  await poll.tick()
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const entered = new Promise<void>((resolve) =>
    held.set(`${TRANSCRIPTS}${FIRST}`, { entered: resolve, released }),
  )
  const ticking = poll.tick()
  await entered
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  poll.hookEvent('codex', {
    event: 'PermissionRequest',
    nativeId: SECOND,
    status: 'permission',
    activity: null,
  })
  release()
  await ticking
  poll.flush()
  expect(await statusOf(SECOND)).toBe('permission')
  vi.spyOn(Date, 'now').mockReturnValue(now + RUNNING_QUIET_LIMIT_MS)
  await poll.tick()
  poll.flush()
  expect(await statusOf(SECOND)).toBe('unknown')
})

test('a listing that gives a status asks for no read at first sight', async () => {
  listedStatus = 'idle'
  await poll.tick()
  await poll.tick()
  await poll.readsSettled()
  expect(reads).toEqual([])
})

test('a listing that gives no status asks for one read at first sight', async () => {
  await poll.tick()
  await poll.tick()
  await poll.readsSettled()
  expect(reads).toEqual([FIRST, SECOND])
})
