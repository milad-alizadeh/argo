// The full-history title/id search (#2375), split out of `store.ts` to keep it under the file
// line ceiling, the same way `store-backfill.ts` already is.
import type { DatabaseSync } from 'node:sqlite'
import { type SessionRosterRow, sessionRosterRowSchema } from '../../contract/models'
import { matchesSearchQuery } from '../search-match'

const EXCERPT_RADIUS = 80

function plainTextQuery(query: string): string {
  return (query.match(/[\p{L}\p{N}_]+/gu) ?? []).map((word) => `"${word}"`).join(' AND ')
}

function excerptOf(text: string, query: string): string | null {
  const needle = query.match(/[\p{L}\p{N}_]+/gu)?.[0]
  if (needle === undefined) return null
  const start = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
  if (start < 0) return null
  const from = Math.max(0, start - EXCERPT_RADIUS)
  const to = Math.min(text.length, start + needle.length + EXCERPT_RADIUS)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}

export function searchChainsOf(
  database: DatabaseSync,
  cli: string,
  query: string,
): SessionRosterRow[] {
  const titleOrId = database
    .prepare('SELECT chain_id, row_json FROM session_chain WHERE cli = ? ORDER BY updated_at DESC')
    .all(cli) as { chain_id: string; row_json: string }[]
  const content = plainTextQuery(query)
  const contentMatches =
    content === ''
      ? []
      : (database
          .prepare(
            'SELECT chain_id, text FROM session_search WHERE cli = ? AND session_search MATCH ?',
          )
          .all(cli, content) as { chain_id: string; text: string }[])
  const excerpts = new Map(
    contentMatches.map((match) => [match.chain_id, excerptOf(match.text, query)]),
  )
  return titleOrId.flatMap((record) => {
    const parsed = sessionRosterRowSchema.safeParse(JSON.parse(record.row_json))
    if (!parsed.success) return []
    const excerpt = excerpts.get(record.chain_id) ?? null
    if (!matchesSearchQuery(parsed.data, query) && excerpt === null) return []
    return excerpt === null ? [parsed.data] : [{ ...parsed.data, searchExcerpt: excerpt }]
  })
}
