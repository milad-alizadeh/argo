// The full-history title/id search (#2375), split out of `store.ts` to keep it under the file
// line ceiling, the same way `store-backfill.ts` already is.
import type { DatabaseSync } from 'node:sqlite'
import { type SessionRosterRow, sessionRosterRowSchema } from '../models'
import { matchesSearchQuery } from '../search-match'

export function searchChainsOf(
  database: DatabaseSync,
  cli: string,
  query: string,
): SessionRosterRow[] {
  const records = database
    .prepare('SELECT row_json FROM session_chain WHERE cli = ? ORDER BY updated_at DESC')
    .all(cli) as { row_json: string }[]
  return records.flatMap((record) => {
    const parsed = sessionRosterRowSchema.safeParse(JSON.parse(record.row_json))
    if (!parsed.success) return []
    return matchesSearchQuery(parsed.data, query) ? [parsed.data] : []
  })
}
