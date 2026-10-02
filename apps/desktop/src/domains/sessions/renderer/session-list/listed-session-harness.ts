import { type Harness, parseHarness } from '@/harnesses/harness'

type CachedList = { pages: readonly { rows: readonly { id: string; harness: string }[] }[] }

// The Harness a loaded Session list row names for a Session, or null when no row names a known one.
export function listedSessionHarness(
  lists: readonly (CachedList | undefined)[],
  sessionId: string,
): Harness | null {
  for (const list of lists)
    for (const page of list?.pages ?? []) {
      const row = page.rows.find((candidate) => candidate.id === sessionId)
      if (row !== undefined) return parseHarness(row.harness)
    }
  return null
}
