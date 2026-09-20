import { z } from 'zod'
import {
  createWriteQueue,
  portablePath,
  readDocument,
  writeDocument,
} from '@/platform/main/storage/portable-file'

export type UnreadSession = {
  id: string
  retiredIds: readonly string[]
  status: 'idle' | 'running' | 'stopped' | 'ended' | string
  updatedAt: string | null
}

type StoredUnreadSession = { unread: boolean; updatedAt: string | null }

const storedUnreadSessionSchema = z.strictObject({
  unread: z.boolean(),
  updatedAt: z.string().nullable(),
})
const unreadDocumentSchema = z.record(z.string(), storedUnreadSessionSchema)

export type SessionUnreadStore = {
  focus: (sessionId: string) => Promise<boolean>
  project: <Row extends UnreadSession>(rows: readonly Row[]) => Promise<(Row & { unread: boolean })[]>
  setUnread: (sessionIds: readonly string[], unread: boolean) => Promise<boolean>
}

export function sessionUnreadPath(userData: string): string {
  return portablePath(userData, 'session-unread.json')
}

function isFinished(status: UnreadSession['status']) {
  return status === 'idle' || status === 'stopped' || status === 'ended'
}

function keyFor(row: Pick<UnreadSession, 'id' | 'retiredIds'>, entries: Record<string, StoredUnreadSession>) {
  return [row.id, ...row.retiredIds].find((id) => entries[id] !== undefined) ?? row.id
}

function projected<Row extends UnreadSession>(
  rows: readonly Row[],
  entries: Record<string, StoredUnreadSession>,
) {
  let changed = false
  const sessions = rows.map((row) => {
    const key = keyFor(row, entries)
    const previous = entries[key]
    if (previous === undefined) {
      entries[key] = { unread: false, updatedAt: row.updatedAt }
      changed = true
      return { ...row, unread: false }
    }
    const newer = previous.updatedAt !== row.updatedAt
    const unread = previous.unread || (newer && isFinished(row.status))
    if (newer || unread !== previous.unread || key !== row.id) {
      delete entries[key]
      entries[row.id] = { unread, updatedAt: row.updatedAt }
      changed = true
    }
    return { ...row, unread }
  })
  return { changed, sessions }
}

function inMemory(initial: Record<string, StoredUnreadSession> = {}): SessionUnreadStore {
  let entries = initial
  return {
    async focus(sessionId) {
      const current = entries[sessionId]
      if (current === undefined || !current.unread) return true
      entries = { ...entries, [sessionId]: { ...current, unread: false } }
      return true
    },
    async project(rows) {
      const result = projected(rows, { ...entries })
      entries = result.changed ? { ...entries, ...Object.fromEntries(result.sessions.map(({ id, unread, updatedAt }) => [id, { unread, updatedAt }])) } : entries
      return result.sessions
    },
    async setUnread(sessionIds, unread) {
      entries = Object.fromEntries(
        Object.entries(entries).map(([id, value]) => [
          id,
          sessionIds.includes(id) ? { ...value, unread } : value,
        ]),
      )
      return true
    },
  }
}

export function createInMemorySessionUnreadStore(): SessionUnreadStore {
  return inMemory()
}

async function readUnread(path: string): Promise<Record<string, StoredUnreadSession>> {
  const read = await readDocument(path)
  if (!read.ok) return {}
  const parsed = unreadDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

export function createSessionUnreadStore(path: string): SessionUnreadStore {
  const enqueue = createWriteQueue()
  let loaded: Promise<Record<string, StoredUnreadSession>> | null = null
  const entries = () => (loaded ??= readUnread(path))
  const save = (next: Record<string, StoredUnreadSession>) =>
    enqueue(async () => {
      const wrote = await writeDocument(path, next)
      if (wrote) loaded = Promise.resolve(next)
      return wrote
    })
  return {
    async focus(sessionId) {
      const current = await entries()
      const value = current[sessionId]
      if (value === undefined || !value.unread) return true
      return save({ ...current, [sessionId]: { ...value, unread: false } })
    },
    async project(rows) {
      const current = await entries()
      const result = projected(rows, { ...current })
      if (result.changed) {
        const next = Object.fromEntries(
          result.sessions.map(({ id, unread, updatedAt }) => [id, { unread, updatedAt }]),
        ) as Record<string, StoredUnreadSession>
        await save({ ...current, ...next })
      }
      return result.sessions
    },
    async setUnread(sessionIds, unread) {
      const current = await entries()
      const next = Object.fromEntries(
        Object.entries(current).map(([id, value]) => [
          id,
          sessionIds.includes(id) ? { ...value, unread } : value,
        ]),
      )
      return save(next)
    },
  }
}
