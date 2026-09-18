// The one title/id match rule search reads by (#2375), shared by the indexed path
// (`store-search.ts`) and the window-fallback path (`search-reads.ts`) so they can't drift apart.
import type { SessionRosterRow } from '../contract/models'

export function matchesSearchQuery(row: SessionRosterRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return false
  const titleMatch = row.title?.text.toLocaleLowerCase().includes(needle) ?? false
  const idMatch = [row.id, ...row.retiredIds].some((id) => id.toLocaleLowerCase().includes(needle))
  return titleMatch || idMatch
}
