import { statSync } from 'node:fs'
import { z } from 'zod'

// The part of `node:sqlite`'s `DatabaseSync` this reads; `bun:sqlite`'s `Database` has it too.
export type StateStore = {
  prepare: (sql: string) => { all: (...parameters: string[]) => unknown[] }
  close: () => void
}
export type OpenStateStore = (file: string) => StateStore
export type ThreadNames = (threadIds: readonly string[]) => ReadonlyMap<string, string>

const THREAD_NAMES_QUERY = `SELECT id, name FROM threads
  WHERE id IN (SELECT value FROM json_each(?)) AND trim(coalesce(name, '')) != ''`

const threadNameSchema = z.object({ id: z.string(), name: z.string().trim().min(1) })

// Null when the store cannot answer, so a sweep after the lock lifts asks again.
function queryNames(file: string, open: OpenStateStore, threadIds: readonly string[]) {
  let store: StateStore | null = null
  try {
    store = open(file)
    const rows = store.prepare(THREAD_NAMES_QUERY).all(JSON.stringify(threadIds))
    return new Map(
      rows.flatMap((row) => {
        const parsed = threadNameSchema.safeParse(row)
        return parsed.success ? [[parsed.data.id, parsed.data.name] as const] : []
      }),
    )
  } catch {
    return null
  } finally {
    store?.close()
  }
}

// A commit in WAL mode lands in `-wal` and leaves the main file alone until a checkpoint.
function storeStamp(file: string): string | null {
  const [main, wal] = [file, `${file}-wal`].map((part) => statSync(part, { throwIfNoEntry: false }))
  if (main === undefined) return null
  return [main, wal].map((stats) => (stats ? `${stats.mtimeMs}:${stats.size}` : '-')).join('|')
}

function knownNames(threadIds: readonly string[], answered: ReadonlyMap<string, string | null>) {
  return new Map(
    threadIds.flatMap((id) => {
      const name = answered.get(id)
      return typeof name === 'string' ? [[id, name] as const] : []
    }),
  )
}

// ADR-0042: the name Codex Desktop gives a thread. The store is opened only for ids it has not yet
// answered, and answers are kept until the store or its WAL changes. A read that fails keeps the
// answers it had, so a locked store never blanks a name, and the next sweep asks again.
export function readThreadNames(file: string, open: OpenStateStore): ThreadNames {
  let stamp: string | null = null
  const answered = new Map<string, string | null>()
  return (threadIds) => {
    const current = storeStamp(file)
    const asked = current === stamp ? threadIds.filter((id) => !answered.has(id)) : [...threadIds]
    const names = current === null || asked.length === 0 ? null : queryNames(file, open, asked)
    if (current === null || names !== null) {
      if (current !== stamp) answered.clear()
      stamp = current
      for (const id of asked) answered.set(id, names?.get(id) ?? null)
    }
    return knownNames(threadIds, answered)
  }
}
