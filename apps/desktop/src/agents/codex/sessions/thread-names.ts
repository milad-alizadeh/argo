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

// ADR-0042: the name Codex Desktop gives a thread, read in one query per discovery sweep. A store
// that is missing, locked or shaped differently names nothing, and the title falls back.
export function readThreadNames(file: string, open: OpenStateStore): ThreadNames {
  return (threadIds) => {
    if (threadIds.length === 0) return new Map()
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
      return new Map()
    } finally {
      store?.close()
    }
  }
}
